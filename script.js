// script.js - V1.4 (Final Version with Download Functionality)

// --- 1. DOM Element References ---
const messageList = document.getElementById('message-list');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileUploadInput = document.getElementById('file-upload-input');

// --- 2. State Management ---
let currentCsvData = ''; // Holds the most recent CSV data state for multi-turn conversation

// --- 3. Core Functions ---

/**
 * Renders a CSV string as a proper HTML table inside a container.
 * @param {string} csvString The CSV data string.
 * @param {HTMLElement} containerElement The element to render the table into.
 */
function renderCsvAsTable(csvString, containerElement) {
    containerElement.innerHTML = ''; // Clear previous content
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

        for (let i = 1; i < rows.length; i++) {
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
        console.error("Failed to render CSV:", error);
        containerElement.textContent = csvString; // Fallback
    }
}

/**
 * Dynamically adds a new message bubble to the chat UI.
 * @param {('user'|'ai'|'system')} sender The sender of the message.
 * @param {string} content The content of the message (can be text or CSV).
 */
function addMessage(sender, content) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message', `${sender}-message`);

    if (sender === 'ai') {
        // AI messages contain the results, which should be a table
        const tableContainer = document.createElement('div');
        renderCsvAsTable(content, tableContainer);
        messageBubble.appendChild(tableContainer);

        // --- V1.4 NEW: Add Action Buttons ---
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('action-buttons');

        const downloadBtn = document.createElement('button');
        downloadBtn.classList.add('action-btn');
        downloadBtn.textContent = '📥 下载Excel';
        downloadBtn.addEventListener('click', () => downloadAsExcel(content));

        actionsContainer.appendChild(downloadBtn);
        messageBubble.appendChild(actionsContainer);

    } else {
        // User and System messages are plain text
        messageBubble.textContent = content;
    }

    messageList.appendChild(messageBubble);
    messageList.scrollTop = messageList.scrollHeight; // Auto-scroll to bottom
}

/**
 * V1.4 NEW: Converts a CSV string to an .xlsx file and triggers download.
 * @param {string} csvString The CSV data to convert.
 */
async function downloadAsExcel(csvString) {
    // 这是正确的代码
try {
    // Step 1: Create a new, empty worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([]); // `aoa_to_sheet` creates a sheet from an array of arrays
    
    // Step 2: Use `sheet_add_csv` to parse the CSV string and populate the empty sheet
    XLSX.utils.sheet_add_csv(worksheet, csvString, { origin: "A1" });

    // Step 3: Proceed as before
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "处理结果");
    XLSX.writeFile(workbook, "智表处理结果.xlsx");
} catch(error) {
    console.error("Failed to download Excel file:", error);
    alert("下载失败，请检查控制台错误。");
}
}


/**
 * Handles the logic for sending a message to the backend.
 */
async function handleSendMessage() {
    const userCommand = commandInput.value.trim();
    if (!userCommand) return;

    if (!currentCsvData.trim()) {
        alert('请先上传或粘贴数据，然后再输入指令！');
        return;
    }

    addMessage('user', userCommand);
    commandInput.value = '';
    sendBtn.disabled = true;
    commandInput.disabled = true;

    // Add a typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'ai-message', 'typing-indicator');
    typingIndicator.textContent = 'AI 正在思考中...';
    messageList.appendChild(typingIndicator);
    messageList.scrollTop = messageList.scrollHeight;

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: currentCsvData, command: userCommand }),
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const completion = await response.json();
        const newCsvResult = completion.result;

        addMessage('ai', newCsvResult);
        currentCsvData = newCsvResult; // Update state for next turn

    } catch (error) {
        console.error("Handler Error:", error);
        addMessage('system', '处理时出现错误，请检查网络或联系管理员。');
    } finally {
        sendBtn.disabled = false;
        commandInput.disabled = false;
        commandInput.focus();
        // Remove typing indicator
        messageList.removeChild(typingIndicator);
    }
}

/**
 * Handles file selection and parsing.
 */
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    addMessage('system', '正在读取文件...');
    
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawCsvString = XLSX.utils.sheet_to_csv(worksheet);
        const cleanedLines = rawCsvString.split('\n')
            .map(line => line.replace(/,+$/, ''))
            .filter(line => line.trim() !== '');
        const finalCsvString = cleanedLines.join('\n');
        
        currentCsvData = finalCsvString; // Update state

        addMessage('system', '文件上传成功，数据已准备就绪。现在您可以下达指令了。');

    } catch (error) {
        console.error('Failed to process file:', error);
        addMessage('system', '文件读取失败，请确保文件格式正确！');
    }
    // Reset file input to allow uploading the same file again
    event.target.value = '';
}


// --- 4. Event Listeners ---
sendBtn.addEventListener('click', handleSendMessage);
commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent new line
        handleSendMessage();
    }
});

uploadBtn.addEventListener('click', () => fileUploadInput.click());
fileUploadInput.addEventListener('change', handleFileSelect);

// (We no longer need the dataPasteArea input listener as file upload is primary)
// We also hide the textarea and its related elements from the new UI
const dataInputColumn = document.getElementById('data-input-column'); // Assuming you create a column for it
if(dataInputColumn) dataInputColumn.style.display = 'none';