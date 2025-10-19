// script.js - V1.1

// Get DOM Elements
const dataPasteArea = document.getElementById('data-paste-area');
const commandInput = document.getElementById('command-input');
const executeBtn = document.getElementById('execute-btn');
const resultDisplay = document.getElementById('result-display');
const copyBtn = document.getElementById('copy-btn'); // V1.1 Added
const fileUploadInput = document.getElementById('file-upload-input');

// V1.1 New Function: Render CSV string as an HTML table
function renderCsvAsTable(csvString, containerElement) {
    containerElement.innerHTML = ''; // Clear previous content
    try {
        const rows = csvString.trim().split('\n');
        if (rows.length === 0 || rows[0].trim() === '') {
            containerElement.textContent = csvString; // If not a table, show as text
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Header row
        const headerRow = document.createElement('tr');
        const headers = rows[0].split(',');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText.trim();
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Data rows
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
        containerElement.textContent = csvString; // Fallback to plain text if parsing fails
    }
}

// V1.1 New Function: Copy result to clipboard
copyBtn.addEventListener('click', () => {
    let textToCopy = '';
    const table = resultDisplay.querySelector('table');
    if (table) {
        // If there's a table, convert it back to a tab-separated string for Excel
        const rows = Array.from(table.rows);
        textToCopy = rows.map(row => 
            Array.from(row.cells).map(cell => cell.textContent).join('\t')
        ).join('\n');
    } else {
        textToCopy = resultDisplay.textContent;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '复制成功!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
});

// File upload handling
if (fileUploadInput) {
    fileUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        try {
            dataPasteArea.value = '正在读取文件...';
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames?.[0];
            if (!firstSheetName) {
                throw new Error('未找到工作表');
            }

            const worksheet = workbook.Sheets[firstSheetName];
            // Convert the worksheet to a raw CSV string
const rawCsvString = XLSX.utils.sheet_to_csv(worksheet);

// Process the CSV string line by line to clean it up
const cleanedLines = rawCsvString.split('\n') // 1. Split into lines
    .map(line => line.replace(/,+$/, ''))     // 2. For each line, remove trailing commas
    .filter(line => line.trim() !== '');      // 3. Remove any lines that are now completely empty

const finalCsvString = cleanedLines.join('\n'); // 4. Join the cleaned lines back together

dataPasteArea.value = finalCsvString; // Set the textarea value to the final result
        } catch (error) {
            console.error('Failed to process file:', error);
            dataPasteArea.value = '文件读取失败，请确保文件格式正确！';
        }
    });
}

// Main Event Listener for the Execute Button
executeBtn.addEventListener('click', async () => {
    const userInputData = dataPasteArea.value;
    const userCommand = commandInput.value;

    // V1.1 Update: Input validation
    if (!userInputData.trim() || !userCommand.trim()) {
        alert('请输入数据和指令！');
        return;
    }
    
    // Add Loading State
    executeBtn.disabled = true;
    executeBtn.textContent = '思考中...';
    resultDisplay.innerHTML = '<p>AI正在处理，请稍候...</p>';
    copyBtn.style.display = 'none'; // Hide copy button while loading

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: userInputData, command: userCommand }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const completion = await response.json();
        const csvResult = completion.result;
        
        // Render the result
        renderCsvAsTable(csvResult, resultDisplay);

    } catch (error) {
        console.error("Handler Error:", error);
        resultDisplay.textContent = "处理时出现错误，请稍后再试。";
    } finally {
        // Reset UI State
        executeBtn.disabled = false;
        executeBtn.textContent = '执行指令';
        copyBtn.style.display = 'inline-block'; // Show copy button again
    }
});

// V1.1 New Feature: Initial welcome message
function showWelcomeMessage() {
    resultDisplay.innerHTML = `
        <h3>欢迎使用 智表 (Smartable)！</h3>
        <p>请在左侧粘贴您的表格数据，然后在中间输入您的处理指令。</p>
        <p><strong>例如：</strong></p>
        <p><em>帮我筛选出所有类别是“水果”的记录</em></p>
        <p><em>按地区统计平均销售额</em></p>
    `;
    copyBtn.style.display = 'none'; // Hide copy button initially
}

// Show the welcome message when the page loads
showWelcomeMessage();
/*
[Instruction Start]

1.  **Get the File Input Element:**
    *   Create a constant variable to get a reference to the file input element with the id `file-upload-input`.

2.  **Add Event Listener for File Upload:**
    *   Add a 'change' event listener to this file input element. The handler function should be an `async` function.

3.  **Inside the Async Handler Function:**
    *   Get the selected file from the event object: `const file = event.target.files[0];`. If no file is selected, return early.
    *   Use a `try...catch` block to handle potential file reading errors.
    *   **Inside the `try` block:**
        *   Display a simple loading message to the user, e.g., by setting the `data-paste-area`'s value to "正在读取文件...".
        *   Read the file content as an ArrayBuffer using `await file.arrayBuffer();`.
        *   Use the `XLSX` library (which is now globally available from the CDN) to parse the file data. Call `XLSX.read(data, { type: 'array' });`.
        *   Get the name of the first sheet in the workbook.
        *   Get the worksheet object using the sheet name.
        *   Convert the worksheet object to a CSV string using `XLSX.utils.sheet_to_csv(worksheet);`.
        *   Finally, set the `data-paste-area`'s value to this generated CSV string.
    *   **Inside the `catch` block:**
        *   Log the error to the console.
        *   Show a user-friendly error message in the `data-paste-area`, e.g., "文件读取失败，请确保文件格式正确！".

[Instruction End]
*/