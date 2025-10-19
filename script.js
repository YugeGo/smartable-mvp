// script.js - V1.5.1 (Chart Generation with Fix)

// --- 1. DOM Element References ---
const messageList = document.getElementById('message-list');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileUploadInput = document.getElementById('file-upload-input');
const topLoadingBar = document.getElementById('top-loading-bar');
const onboardingBanner = document.getElementById('onboarding-banner');
const bannerCloseBtn = document.getElementById('banner-close');
const uploadStatus = document.getElementById('upload-status');
const promptChips = document.querySelectorAll('.prompt-chip');

const STORAGE_KEYS = {
    initialMessage: 'smartable:initial-message',
    bannerDismissed: 'smartable:banner-dismissed'
};

// --- 2. State Management ---
let currentCsvData = '';

// --- 3. Core Functions ---

/**
 * Renders a chart using ECharts if a valid option is provided.
 * @param {object|null} chartOption The ECharts option object.
 * @param {HTMLElement} containerElement The element to render the chart into.
 */
function renderChart(chartOption, containerElement) {
    if (!chartOption) {
        return;
    }

    try {
        const chartInstance = echarts.init(containerElement);
        chartInstance.setOption(chartOption);
    } catch (error) {
        console.error('Failed to render chart:', error);
        containerElement.textContent = '图表渲染失败。';
    }
}

/**
 * Renders a CSV string as a proper HTML table inside a container.
 * @param {string} csvString The CSV data string.
 * @param {HTMLElement} containerElement The element to render the table into.
 */
function renderCsvAsTable(csvString, containerElement) {
    containerElement.innerHTML = '';

    try {
        const rows = csvString.trim().split('\n');
        if (rows.length === 0 || rows[0].trim() === '') {
            containerElement.textContent = csvString;
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        const headerRow = document.createElement('tr');
        const headers = rows[0].split(',');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText.trim();
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        for (let i = 1; i < rows.length; i += 1) {
            const dataRow = document.createElement('tr');
            const cells = rows[i].split(',');
            cells.forEach(cellText => {
                const td = document.createElement('td');
                td.textContent = cellText.trim();
                dataRow.appendChild(td);
            });
            tbody.appendChild(dataRow);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        containerElement.appendChild(table);
    } catch (error) {
        console.error('Failed to render CSV:', error);
        containerElement.textContent = csvString;
    }
}

/**
 * Dynamically adds a new message bubble to the chat UI.
 * @param {('user'|'ai'|'system')} sender The sender of the message.
 * @param {string|object} content The content of the message.
 */
function addMessage(sender, content) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message', `${sender}-message`);

    if (sender === 'ai') {
        const csvString = typeof content === 'object' && content ? content.result : '';
        const chartOption = typeof content === 'object' && content ? content.chart || null : null;

        let rendered = false;

        if (csvString && csvString.trim() !== '') {
            const tableContainer = document.createElement('div');
            tableContainer.classList.add('table-wrapper');
            renderCsvAsTable(csvString, tableContainer);
            messageBubble.appendChild(tableContainer);
            rendered = true;
        }

        if (chartOption) {
            const chartContainer = document.createElement('div');
            chartContainer.classList.add('chart-container');
            if (messageBubble.children.length > 0) {
                chartContainer.style.marginTop = '1.25rem';
            }
            messageBubble.appendChild(chartContainer);
            setTimeout(() => renderChart(chartOption, chartContainer), 0);
            rendered = true;
        }

        if (csvString && csvString.trim() !== '') {
            const actionsContainer = document.createElement('div');
            actionsContainer.classList.add('action-buttons');

            const downloadBtn = document.createElement('button');
            downloadBtn.classList.add('action-btn');
            downloadBtn.textContent = '📥 下载Excel';
            downloadBtn.addEventListener('click', () => downloadAsExcel(csvString));

            actionsContainer.appendChild(downloadBtn);
            messageBubble.appendChild(actionsContainer);
        }

        if (!rendered) {
            messageBubble.textContent = 'AI没有返回有效的数据或图表。';
        }
    } else {
        messageBubble.textContent = content;
    }

    messageList.appendChild(messageBubble);
    messageList.scrollTop = messageList.scrollHeight;
}

/**
 * Converts a CSV string to an .xlsx file and triggers download.
 * @param {string} csvString The CSV data to convert.
 */
async function downloadAsExcel(csvString) {
    try {
        const rows = csvString.trim().split('\n');
        const dataAsArrayOfArrays = rows.map(row => row.split(','));

        const worksheet = XLSX.utils.aoa_to_sheet(dataAsArrayOfArrays);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '处理结果');
        XLSX.writeFile(workbook, '智表处理结果.xlsx');
    } catch (error) {
        console.error('Failed to download Excel file:', error);
        alert('下载失败，请检查控制台错误。');
    }
}

/**
 * Handles the logic for sending a message to the backend.
 */
async function handleSendMessage() {
    const userCommand = commandInput.value.trim();
    if (!userCommand) {
        return;
    }

    if (!currentCsvData.trim()) {
        updateUploadStatus('请先上传或粘贴一份数据，再开始对话。', 'error');
        return;
    }

    addMessage('user', userCommand);
    commandInput.value = '';
    setLoadingState(true);

    const skeletonMessage = createSkeletonMessage();
    messageList.appendChild(skeletonMessage);
    messageList.scrollTop = messageList.scrollHeight;

    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: currentCsvData, command: userCommand })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const completion = await response.json();
        if (skeletonMessage.parentNode) {
            messageList.removeChild(skeletonMessage);
        }
        addMessage('ai', completion);

        if (completion && completion.result) {
            currentCsvData = completion.result;
        }
    } catch (error) {
        console.error('Handler Error:', error);
        if (skeletonMessage.parentNode) {
            messageList.removeChild(skeletonMessage);
        }
        addMessage('system', '处理时出现错误，请检查网络或联系管理员。');
        updateUploadStatus('请求失败，请稍后再试。', 'error');
    } finally {
        setLoadingState(false);
        commandInput.focus();
    }
}

/**
 * Handles file selection and parsing.
 */
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        updateUploadStatus('');
        return;
    }

    updateUploadStatus(`📄 正在读取 ${file.name}...`, 'loading');

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawCsvString = XLSX.utils.sheet_to_csv(worksheet);
        const cleanedLines = rawCsvString
            .split('\n')
            .map(line => line.replace(/,+$/, ''))
            .filter(line => line.trim() !== '');
        const finalCsvString = cleanedLines.join('\n');

        currentCsvData = finalCsvString;
        updateUploadStatus(`✅ ${file.name} · ${formatFileSize(file.size)} 已准备就绪`, 'success');
        addMessage('system', '文件上传成功，数据已准备就绪。现在您可以下达指令了。');
    } catch (error) {
        console.error('Failed to process file:', error);
        updateUploadStatus(`⚠️ ${file.name} 读取失败，请确保文件格式正确。`, 'error');
        addMessage('system', '文件读取失败，请确保文件格式正确！');
    }

    event.target.value = '';
}

// --- 4. Event Listeners ---
sendBtn.addEventListener('click', handleSendMessage);
commandInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
});

uploadBtn.addEventListener('click', () => fileUploadInput.click());
fileUploadInput.addEventListener('change', handleFileSelect);

initializeOnboarding();

// (We no longer need the dataPasteArea input listener as file upload is primary)
// We also hide the textarea and its related elements from the new UI
const dataInputColumn = document.getElementById('data-input-column');
if (dataInputColumn) {
    dataInputColumn.style.display = 'none';
}

function setLoadingState(isLoading) {
    sendBtn.disabled = isLoading;
    commandInput.disabled = isLoading;
    uploadBtn.disabled = isLoading;

    if (isLoading) {
        sendBtn.classList.add('loading');
        if (topLoadingBar) {
            topLoadingBar.classList.add('active');
        }
    } else {
        sendBtn.classList.remove('loading');
        if (topLoadingBar) {
            topLoadingBar.classList.remove('active');
        }
    }
}

function createSkeletonMessage() {
    const bubble = document.createElement('div');
    bubble.classList.add('message', 'ai-message', 'loading-skeleton');

    const linesWrapper = document.createElement('div');
    linesWrapper.classList.add('skeleton-lines');

    ['85%', '65%', '78%'].forEach(width => {
        const line = document.createElement('div');
        line.classList.add('skeleton-line');
        line.style.width = width;
        linesWrapper.appendChild(line);
    });

    bubble.appendChild(linesWrapper);
    const status = document.createElement('div');
    status.classList.add('skeleton-status');
    status.textContent = 'AI 正在生成内容...';
    bubble.appendChild(status);
    return bubble;
}

function updateUploadStatus(text, type) {
    if (!uploadStatus) {
        return;
    }

    uploadStatus.textContent = text || '';
    uploadStatus.className = '';

    if (text) {
        uploadStatus.classList.add('active');
        if (type) {
            uploadStatus.classList.add(type);
        }
    }
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
        return '';
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1048576) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function initializeOnboarding() {
    if (!sessionStorage.getItem(STORAGE_KEYS.initialMessage)) {
        addMessage('system', '欢迎使用智表！上传或粘贴数据后描述你的需求，我们会输出结构化表格并尝试生成图表。');
        sessionStorage.setItem(STORAGE_KEYS.initialMessage, 'true');
    }

    if (localStorage.getItem(STORAGE_KEYS.bannerDismissed) === 'true' && onboardingBanner) {
        onboardingBanner.classList.add('hidden');
    }

    if (bannerCloseBtn) {
        bannerCloseBtn.addEventListener('click', () => {
            if (onboardingBanner) {
                onboardingBanner.classList.add('hidden');
            }
            localStorage.setItem(STORAGE_KEYS.bannerDismissed, 'true');
        });
    }

    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const preset = chip.getAttribute('data-fill') || '';
            if (preset) {
                commandInput.value = preset;
                commandInput.focus();
            }
        });
    });
}