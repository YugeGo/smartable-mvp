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
const pasteBtn = document.getElementById('paste-btn');
const dataInputPanel = document.getElementById('data-input-panel');
const dataPasteArea = document.getElementById('data-paste-area');
const dataPasteSubmit = document.getElementById('data-paste-submit');
const dataPasteCancel = document.getElementById('data-paste-cancel');
const dataPasteClose = document.getElementById('data-paste-close');
const newSessionBtn = document.getElementById('new-session-btn');
const dataSourceList = document.getElementById('data-source-list');
const dataPreviewSection = document.getElementById('data-preview');
const dataPreviewTitle = document.getElementById('data-preview-title');
const dataPreviewTable = document.getElementById('data-preview-table');
const dataPreviewFootnote = document.getElementById('data-preview-footnote');

const STORAGE_KEYS = {
    initialMessage: 'smartable:initial-message',
    bannerDismissed: 'smartable:banner-dismissed',
    session: 'smartable:session'
};

// --- 2. State Management ---
let messages = [];
// The workspace holds all data sources. Each key is a table name.
// Each value is an object: { originalData: '...', currentData: '...' }
let workspace = {};
// The name of the table currently being viewed/edited.
let activeTableName = '';

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
        const optionClone = typeof structuredClone === 'function'
            ? structuredClone(chartOption)
            : JSON.parse(JSON.stringify(chartOption));

        const enhancedOption = enhanceChartOption(optionClone, containerElement);

        const chartInstance = echarts.init(containerElement);
        chartInstance.setOption(enhancedOption, true);
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
function addMessage(sender, content, doSave = true) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message', `${sender}-message`);

    if (sender === 'ai') {
        const csvString = typeof content === 'object' && content ? content.result : '';
        const chartOption = typeof content === 'object' && content ? content.chart || null : null;

        let rendered = false;

        if (chartOption) {
            messageBubble.classList.add('chart-message');
        }

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

    // Do not save initial system messages to the session history
    if (sender === 'system' && messages.length === 0) {
        return;
    }
    messages.push({ sender, content });
    if (doSave) {
        saveSession();
    }
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

    if (!activeTableName || !workspace[activeTableName]) {
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
        const activeTable = workspace[activeTableName];
        const workspacePayload = serializeWorkspace(workspace);

        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: userCommand,
                activeTableName,
                workspace: workspacePayload
            })
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
            const targetTableRaw = typeof completion.targetTable === 'string'
                ? completion.targetTable.trim()
                : '';
            const destinationTableName = targetTableRaw || activeTableName;
            const destinationExists = Boolean(workspace[destinationTableName]);

            const baselineSchema = destinationExists
                ? extractHeaders(workspace[destinationTableName].currentData)
                : [];
            const nextSchema = extractHeaders(completion.result);
            const missingColumns = destinationExists
                ? findMissingColumns(baselineSchema, nextSchema)
                : [];

            if (missingColumns.length > 0 && baselineSchema.length > 0) {
                addMessage(
                    'system',
                    `检测到 ${destinationTableName} 的返回结果缺少列：${missingColumns.join(', ')}。已保持上一轮数据，请尝试更明确的指令或直接说明需要保留这些列。`
                );
            } else {
                if (!destinationExists) {
                    workspace[destinationTableName] = {
                        originalData: completion.result,
                        currentData: completion.result
                    };
                    addMessage('system', `已创建新的数据源 ${destinationTableName}，结果已写入。`);
                } else if (destinationTableName !== activeTableName) {
                    addMessage('system', `已将结果写入 ${destinationTableName}，现已切换到该数据源。`);
                } else {
                    workspace[destinationTableName].currentData = completion.result;
                }

                setActiveTable(destinationTableName);
            }
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
        const finalCsvString = sanitizeCsvString(rawCsvString);

        if (!finalCsvString) {
            throw new Error('Empty dataset after sanitizing');
        }

        const headers = extractHeaders(finalCsvString);
        if (headers.length === 0) {
            throw new Error('Missing header row');
        }

        const rowCount = Math.max(finalCsvString.split('\n').length - 1, 0);
        const tableName = file.name;

        workspace[tableName] = {
            originalData: finalCsvString,
            currentData: finalCsvString
        };
        messages = []; // Reset history on new upload
        setActiveTable(tableName);
        addMessage('system', `文件 ${tableName} 上传成功，数据已准备就绪。`);
        updateUploadStatus(`✅ ${tableName} · ${formatFileSize(file.size)} · ${headers.length} 列 · ${rowCount} 行`, 'success');
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

if (pasteBtn && dataInputPanel) {
    pasteBtn.addEventListener('click', () => {
        if (dataInputPanel.classList.contains('open')) {
            closeDataInputPanel();
        } else {
            openDataInputPanel();
        }
    });
}

if (dataPasteSubmit) {
    dataPasteSubmit.addEventListener('click', () => handlePasteSubmit());
}

if (dataPasteCancel) {
    dataPasteCancel.addEventListener('click', () => {
        if (dataPasteArea) {
            dataPasteArea.value = '';
            dataPasteArea.focus();
        }
    });
}

if (dataPasteClose) {
    dataPasteClose.addEventListener('click', () => closeDataInputPanel());
}

if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
        if (confirm('确定要开始一个新会话吗？当前所有数据和对话历史都将被清除。')) {
            localStorage.removeItem(STORAGE_KEYS.session);
            window.location.reload();
        }
    });
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dataInputPanel && dataInputPanel.classList.contains('open')) {
        closeDataInputPanel();
    }
});

initializeOnboarding();

// 兼容旧版布局：如果仍存在传统数据输入列，则隐藏
const dataInputColumn = document.getElementById('data-input-column');
if (dataInputColumn) {
    dataInputColumn.style.display = 'none';
}

function setLoadingState(isLoading) {
    sendBtn.disabled = isLoading;
    commandInput.disabled = isLoading;
    uploadBtn.disabled = isLoading;
    if (pasteBtn) {
        pasteBtn.disabled = isLoading;
    }
    if (newSessionBtn) {
        newSessionBtn.disabled = isLoading;
    }

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
    if (loadSession()) {
        return; // Session loaded, skip onboarding messages
    }

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

    renderDataSourceList();
}

function openDataInputPanel() {
    if (!dataInputPanel) {
        return;
    }

    dataInputPanel.classList.add('open');
    dataInputPanel.setAttribute('aria-hidden', 'false');
    if (pasteBtn) {
        pasteBtn.classList.add('active');
        pasteBtn.setAttribute('aria-pressed', 'true');
    }

    if (dataPasteArea) {
        setTimeout(() => dataPasteArea.focus(), 0);
    }
}

function closeDataInputPanel() {
    if (!dataInputPanel) {
        return;
    }

    dataInputPanel.classList.remove('open');
    dataInputPanel.setAttribute('aria-hidden', 'true');
    if (pasteBtn) {
        pasteBtn.classList.remove('active');
        pasteBtn.setAttribute('aria-pressed', 'false');
    }
}

function handlePasteSubmit() {
    if (!dataPasteArea) {
        return;
    }

    const rawInput = dataPasteArea.value.trim();
    if (!rawInput) {
        updateUploadStatus('请先粘贴包含表头的数据，再点击导入。', 'error');
        dataPasteArea.focus();
        return;
    }

    const sanitized = sanitizeCsvString(rawInput);
    if (!sanitized) {
        updateUploadStatus('粘贴内容为空或格式不正确，请确认后重试。', 'error');
        dataPasteArea.focus();
        return;
    }

    const headers = extractHeaders(sanitized);
    if (headers.length === 0) {
        updateUploadStatus('未检测到表头，请确认每列使用逗号或制表符分隔。', 'error');
        dataPasteArea.focus();
        return;
    }

    const rowCount = Math.max(sanitized.split('\n').length - 1, 0);
    const tableName = `粘贴数据-${new Date().toLocaleTimeString()}`;

    workspace[tableName] = {
        originalData: sanitized,
        currentData: sanitized
    };
    messages = []; // Reset history on new paste
    setActiveTable(tableName);
    addMessage('system', `粘贴数据 ${tableName} 成功，随时输入指令开始分析。`);
    updateUploadStatus(`✅ ${tableName} · ${headers.length} 列 · ${rowCount} 行`, 'success');

    dataPasteArea.value = '';
    closeDataInputPanel();
}

function extractHeaders(csvString) {
    if (!csvString || typeof csvString !== 'string') {
        return [];
    }

    const trimmed = csvString.trim();
    if (!trimmed) {
        return [];
    }

    const [headerLine] = trimmed.split('\n');
    if (!headerLine) {
        return [];
    }

    return headerLine
        .split(',')
        .map(header => header.trim())
        .filter(header => header.length > 0);
}

function sanitizeCsvString(rawCsvString) {
    if (!rawCsvString || typeof rawCsvString !== 'string') {
        return '';
    }

    const normalized = rawCsvString
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ',');

    const cleanedLines = normalized
        .split('\n')
        .map(line => line.replace(/,+$/, ''))
        .filter(line => line.trim() !== '');

    return cleanedLines.join('\n');
}

function findMissingColumns(expectedSchema, actualSchema) {
    if (!Array.isArray(expectedSchema) || expectedSchema.length === 0) {
        return [];
    }

    const actualSet = new Set(Array.isArray(actualSchema) ? actualSchema : []);
    return expectedSchema.filter(column => !actualSet.has(column));
}

function enhanceChartOption(option, container) {
    if (!option) {
        return option;
    }

    enforceContainLabel(option);
    applyBarSeriesSpacing(option);
    autoResizeChart(option, container);

    return option;
}

function enforceContainLabel(option) {
    if (Array.isArray(option.grid)) {
        option.grid = option.grid.map(gridConfig => ({
            containLabel: true,
            ...(gridConfig || {})
        }));
        return;
    }

    if (option.grid && typeof option.grid === 'object') {
        option.grid = {
            containLabel: true,
            ...option.grid
        };
        return;
    }

    option.grid = { containLabel: true };
}

function applyBarSeriesSpacing(option) {
    const seriesList = normalizeSeries(option.series);
    if (seriesList.length === 0) {
        return;
    }

    seriesList.forEach(series => {
        if (!series || typeof series !== 'object') {
            return;
        }

        const type = (series.type || '').toLowerCase();
        if (type === 'bar') {
            if (series.barCategoryGap === undefined) {
                series.barCategoryGap = '35%';
            }
            if (series.barGap === undefined) {
                series.barGap = '20%';
            }
        }
    });

    option.series = Array.isArray(option.series) ? seriesList : seriesList[0] || option.series;
}

function autoResizeChart(option, container) {
    if (!container) {
        return;
    }

    const seriesList = normalizeSeries(option.series);
    if (seriesList.length === 0) {
        container.style.height = '360px';
        return;
    }

    const hasBarSeries = seriesList.some(series => (series.type || '').toLowerCase() === 'bar');
    const hasLineSeries = seriesList.some(series => (series.type || '').toLowerCase() === 'line');

    const yCategoryCount = getCategoryCount(option.yAxis);
    const xCategoryCount = getCategoryCount(option.xAxis);

    let targetHeight = 360;

    if (hasBarSeries && yCategoryCount > 0) {
        const seriesFactor = Math.min(1.6, 1 + (seriesList.length - 1) * 0.18);
        const perItemHeight = Math.max(38, Math.min(64, 34 * seriesFactor));
        targetHeight = Math.max(targetHeight, yCategoryCount * perItemHeight + 120);
    } else if ((hasBarSeries || hasLineSeries) && xCategoryCount > 18) {
        const overflowCount = xCategoryCount - 18;
        targetHeight = Math.max(targetHeight, 360 + overflowCount * 16);
    }

    container.style.height = `${Math.min(targetHeight, 960)}px`;
}

function normalizeSeries(seriesCandidate) {
    if (Array.isArray(seriesCandidate)) {
        return seriesCandidate;
    }

    if (seriesCandidate && typeof seriesCandidate === 'object') {
        return [seriesCandidate];
    }

    return [];
}

function getCategoryCount(axisCandidate) {
    const axes = [];

    if (Array.isArray(axisCandidate)) {
        axes.push(...axisCandidate);
    } else if (axisCandidate && typeof axisCandidate === 'object') {
        axes.push(axisCandidate);
    }

    let maxCount = 0;

    axes.forEach(axis => {
        if (!axis || typeof axis !== 'object') {
            return;
        }

        const axisType = axis.type ? axis.type.toLowerCase() : 'category';
        if (axisType !== 'category') {
            return;
        }

        if (Array.isArray(axis.data)) {
            maxCount = Math.max(maxCount, axis.data.length);
            return;
        }

        if (Array.isArray(axis.categories)) {
            maxCount = Math.max(maxCount, axis.categories.length);
        }
    });

    return maxCount;
}

function serializeWorkspace(source) {
    const payload = {};

    Object.entries(source || {}).forEach(([tableName, tableValue]) => {
        if (!tableName || typeof tableName !== 'string') {
            return;
        }

        payload[tableName] = {
            currentData: tableValue?.currentData || '',
            originalData: tableValue?.originalData || tableValue?.currentData || ''
        };
    });

    return payload;
}

function renderDataSourceList() {
    if (!dataSourceList) {
        return;
    }

    dataSourceList.innerHTML = '';

    const tableNames = Object.keys(workspace);
    if (tableNames.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.classList.add('data-source-empty');
        emptyItem.textContent = '暂无数据源';
        dataSourceList.appendChild(emptyItem);
        renderActiveTablePreview();
        return;
    }

    tableNames.forEach(tableName => {
        const tableEntry = workspace[tableName];
        const { columnCount, rowCount } = getTableStats(tableEntry?.currentData);

        const item = document.createElement('div');
        item.classList.add('data-source-item');
        if (tableName === activeTableName) {
            item.classList.add('active');
        }

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.classList.add('data-source-select');
        selectBtn.textContent = tableName;
        selectBtn.addEventListener('click', () => {
            setActiveTable(tableName);
        });

        const meta = document.createElement('span');
        meta.classList.add('data-source-meta');
        meta.textContent = `${columnCount} 列 · ${rowCount} 行`;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('data-source-delete');
        deleteBtn.setAttribute('aria-label', `移除 ${tableName}`);
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', event => {
            event.stopPropagation();
            removeTable(tableName);
        });

        item.appendChild(selectBtn);
        item.appendChild(meta);
        item.appendChild(deleteBtn);
        dataSourceList.appendChild(item);
    });

    renderActiveTablePreview();
}

function getTableStats(csvString) {
    if (!csvString || typeof csvString !== 'string') {
        return { columnCount: 0, rowCount: 0 };
    }

    const headers = extractHeaders(csvString);
    const rowCount = Math.max(csvString.split('\n').length - 1, 0);
    return {
        columnCount: headers.length,
        rowCount
    };
}

function renderActiveTablePreview() {
    if (!dataPreviewSection || !dataPreviewTitle || !dataPreviewTable) {
        return;
    }

    if (!activeTableName || !workspace[activeTableName]) {
        dataPreviewSection.classList.add('empty');
        dataPreviewTitle.textContent = '当前数据源';
        dataPreviewTable.innerHTML = '<p class="data-preview-placeholder">请选择数据源以查看表格。</p>';
        if (dataPreviewFootnote) {
            dataPreviewFootnote.textContent = '';
        }
        return;
    }

    const tableEntry = workspace[activeTableName];
    const fullCsv = tableEntry.currentData || '';
        if (!fullCsv.trim()) {
            dataPreviewSection.classList.remove('empty');
            dataPreviewTitle.textContent = `当前数据源 · ${activeTableName}`;
            dataPreviewTable.innerHTML = '<p class="data-preview-placeholder">该数据源目前没有可展示的行。</p>';
            if (dataPreviewFootnote) {
                dataPreviewFootnote.textContent = '';
            }
            return;
        }
    const rows = fullCsv ? fullCsv.trim().split('\n') : [];
    const previewRowLimit = 120;
    const hasHeader = rows.length > 0;

    let previewCsv = fullCsv;
    let truncated = false;
    if (hasHeader && rows.length - 1 > previewRowLimit) {
        const header = rows[0];
        const limitedRows = rows.slice(1, previewRowLimit + 1);
        previewCsv = [header, ...limitedRows].join('\n');
        truncated = true;
    }

    dataPreviewSection.classList.remove('empty');
    dataPreviewTitle.textContent = `当前数据源 · ${activeTableName}`;
    renderCsvAsTable(previewCsv, dataPreviewTable);

    if (dataPreviewFootnote) {
        if (truncated) {
            const totalRows = Math.max(rows.length - 1, 0);
            dataPreviewFootnote.textContent = `仅展示前 ${previewRowLimit} 行（共 ${totalRows} 行）`; 
        } else {
            dataPreviewFootnote.textContent = '';
        }
    }
}

function setActiveTable(tableName) {
    if (!tableName || !workspace[tableName]) {
    activeTableName = '';
    renderDataSourceList();
    updateUploadStatus('数据源已清空，请上传或粘贴新的数据。');
    saveSession();
    return;
    }

    activeTableName = tableName;
    renderDataSourceList();

    const { columnCount, rowCount } = getTableStats(workspace[tableName].currentData);
    updateUploadStatus(`📊 当前数据源: ${tableName} · ${columnCount} 列 · ${rowCount} 行`);
    saveSession();
}

function removeTable(tableName) {
    if (!workspace[tableName]) {
        return;
    }

    delete workspace[tableName];

    if (tableName === activeTableName) {
        const remainingNames = Object.keys(workspace);
        activeTableName = remainingNames[0] || '';

        if (activeTableName) {
            const { columnCount, rowCount } = getTableStats(workspace[activeTableName].currentData);
            updateUploadStatus(`📊 已切换至 ${activeTableName} · ${columnCount} 列 · ${rowCount} 行`);
        } else {
            updateUploadStatus('数据源已清空，请上传或粘贴新的数据。');
        }
    }

    addMessage('system', `数据源 ${tableName} 已移除。`);
    renderDataSourceList();
    renderActiveTablePreview();
    saveSession();
}

function saveSession() {
    if (Object.keys(workspace).length === 0 && messages.length === 0) {
        localStorage.removeItem(STORAGE_KEYS.session);
        return;
    }

    const sessionData = {
        messages,
        workspace,
        activeTableName
    };

    try {
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(sessionData));
    } catch (error) {
        console.error('Failed to save session:', error);
        // Potentially handle storage quota exceeded error
    }
}

function loadSession() {
    const savedSession = localStorage.getItem(STORAGE_KEYS.session);
    if (!savedSession) {
        return false;
    }

    try {
        const sessionData = JSON.parse(savedSession);
        if (!sessionData || !sessionData.messages || !sessionData.workspace) {
            return false;
        }

        messages = [];
        messageList.innerHTML = '';

        sessionData.messages.forEach(msg => {
            addMessage(msg.sender, msg.content, false); // Pass false to avoid re-saving
        });

        workspace = sessionData.workspace;
        activeTableName = sessionData.activeTableName || '';

        if (activeTableName && workspace[activeTableName]) {
            const tableData = workspace[activeTableName].currentData;
            const headers = extractHeaders(tableData);
            const rowCount = Math.max(tableData.split('\n').length - 1, 0);
            updateUploadStatus(`✅ 会话已恢复: ${activeTableName} · ${headers.length} 列 · ${rowCount} 行`, 'success');
        } else {
            updateUploadStatus('✅ 会话已恢复，请从左侧选择数据源。', 'success');
        }

        renderDataSourceList();
    renderActiveTablePreview();

        return true;
    } catch (error) {
        console.error('Failed to load session:', error);
        localStorage.removeItem(STORAGE_KEYS.session);
        return false;
    }
}

