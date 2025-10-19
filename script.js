/*
[Instruction Start]

** 1. Get All Necessary DOM Elements **
*   Get references to: `message-list`, `command-input`, `send-btn`, `upload-btn`, and the hidden `file-upload-input`.

** 2. State Management Variable **
*   Create a `let` variable `currentCsvData` initialized to an empty string.

** 3. Core Function: `addMessage` **
*   Create a new async function `addMessage(sender, content)`.
*   Inside, create a `div` for the message bubble. Add the `message` class.
*   Based on the `sender` ('user', 'ai', 'system'), add the corresponding class (`user-message`, `ai-message`, `system-message`).
*   If `sender` is 'ai' and the `content` is a string that looks like CSV, call our existing `renderCsvAsTable` function to turn it into a table element, and append that table to the message bubble. Otherwise, just set the `textContent` of the bubble.
*   Append the new message bubble to the `message-list`.
*   Scroll the `message-list` to the bottom to show the newest message.

** 4. Link Upload Button to Hidden Input **
*   Add a 'click' event listener to `upload-btn` that programmatically clicks the hidden `file-upload-input`.

** 5. File Upload Handler (Re-implemented) **
*   Reuse our previous file handling logic. Add a 'change' listener to `file-upload-input`.
*   When a file is selected, read it using SheetJS.
*   Once the `finalCsvString` is generated:
    *   Update the state: `currentCsvData = finalCsvString;`
    *   Add a system message to the chat confirming the upload: `addMessage('system', '文件上传成功，数据已准备就绪。');`

** 6. Send Button Handler: `handleSendMessage` **
*   Create an async function `handleSendMessage`.
*   Get the command from `command-input`. If it's empty, return.
*   If `currentCsvData` is empty, show an alert asking the user to upload or paste data first, and return.
*   Add the user's command to the UI: `addMessage('user', userCommand);`.
*   Clear the `command-input` and disable it.
*   Show a "typing" indicator for the AI.
*   Call the backend API using `fetch`, sending `currentCsvData` and the `userCommand`.
*   When the response is received:
    *   Remove the "typing" indicator.
    *   Get the `newCsvResult` from the AI.
    *   Add the AI's response to the UI as a new message: `addMessage('ai', newCsvResult);`.
    *   Update the state with the new result: `currentCsvData = newCsvResult;`.
    *   Re-enable the input.

** 7. Attach Final Event Listeners **
*   Add a 'click' event listener to `send-btn` that calls `handleSendMessage`.
*   Add a 'keydown' listener to `command-input` that checks if the user pressed 'Enter' (without Shift) and calls `handleSendMessage` if they did.

** 8. Helper Function: `renderCsvAsTable` **
*   Copy our previously created `renderCsvAsTable` function into this new file, as it will be needed by `addMessage`.

[Instruction End]
*/
const messageList = document.getElementById('message-list');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileUploadInput = document.getElementById('file-upload-input');

let currentCsvData = '';

async function downloadAsExcel(csvString) {
	const worksheet = XLSX.utils.csv_to_sheet(csvString);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Processed Data');
	XLSX.writeFile(workbook, '智表处理结果.xlsx');
}

async function addMessage(sender, content) {
	if (!messageList) {
		return null;
	}

	const bubble = document.createElement('div');
	bubble.classList.add('message');

	const senderClasses = {
		user: 'user-message',
		ai: 'ai-message',
		system: 'system-message'
	};
	const senderClass = senderClasses[sender] ?? 'system-message';
	bubble.classList.add(senderClass);

	if (sender === 'ai' && typeof content === 'string' && looksLikeCsv(content)) {
		renderCsvAsTable(content, bubble);
		const actions = document.createElement('div');
		actions.classList.add('action-buttons');
		const downloadBtn = document.createElement('button');
		downloadBtn.classList.add('action-btn');
		downloadBtn.textContent = '📥 下载Excel';
		downloadBtn.addEventListener('click', () => downloadAsExcel(content));
		actions.appendChild(downloadBtn);
		bubble.appendChild(actions);
	} else if (typeof content === 'string') {
		bubble.textContent = content;
	} else if (content instanceof Node) {
		bubble.appendChild(content);
	} else {
		bubble.textContent = String(content ?? '');
	}

	messageList.appendChild(bubble);
	messageList.scrollTop = messageList.scrollHeight;
	return bubble;
}

function looksLikeCsv(text) {
	const trimmed = text.trim();
	if (!trimmed.includes(',') || !trimmed.includes('\n')) {
		return false;
	}
	const [headerLine] = trimmed.split('\n');
	return headerLine.split(',').length > 1;
}

function renderCsvAsTable(csvString, containerElement) {
	containerElement.innerHTML = '';
	try {
		const rows = csvString.trim().split('\n');
		if (!rows.length || rows[0].trim() === '') {
			containerElement.textContent = csvString;
			return;
		}

		const table = document.createElement('table');
		const thead = document.createElement('thead');
		const tbody = document.createElement('tbody');

		const headerRow = document.createElement('tr');
		rows[0].split(',').forEach((headerText) => {
			const th = document.createElement('th');
			th.textContent = headerText.trim();
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);

		for (let i = 1; i < rows.length; i += 1) {
			const dataRow = document.createElement('tr');
			rows[i].split(',').forEach((cellText) => {
				const td = document.createElement('td');
				td.textContent = cellText.trim();
				dataRow.appendChild(td);
			});
			tbody.appendChild(dataRow);
		}

		table.append(thead, tbody);
		containerElement.appendChild(table);
	} catch (error) {
		console.error('Failed to render CSV:', error);
		containerElement.textContent = csvString;
	}
}

if (uploadBtn && fileUploadInput) {
	uploadBtn.addEventListener('click', () => fileUploadInput.click());
}

if (fileUploadInput) {
	fileUploadInput.addEventListener('change', async (event) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		try {
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data, { type: 'array' });
			const firstSheetName = workbook.SheetNames?.[0];
			if (!firstSheetName) {
				throw new Error('未找到工作表');
			}

			const worksheet = workbook.Sheets[firstSheetName];
			const rawCsv = XLSX.utils.sheet_to_csv(worksheet, { skipHidden: true });
			const cleanedLines = rawCsv
				.split('\n')
				.map((line) => line.replace(/,+$/, '').trimEnd())
				.filter((line) => line.trim() !== '');
			const finalCsvString = cleanedLines.join('\n').trim();

			currentCsvData = finalCsvString;
			await addMessage('system', '文件上传成功，数据已准备就绪。');
		} catch (error) {
			console.error('Failed to process file:', error);
			await addMessage('system', '文件读取失败，请确保文件格式正确！');
		} finally {
			event.target.value = '';
		}
	});
}

async function handleSendMessage() {
	if (!commandInput) {
		return;
	}

	const userCommand = commandInput.value.trim();
	if (!userCommand) {
		return;
	}
	if (!currentCsvData.trim()) {
		alert('请先上传或提供数据。');
		return;
	}

	await addMessage('user', userCommand);
	commandInput.value = '';
	commandInput.disabled = true;

	const typingIndicator = await addMessage('ai', '正在思考...');

	try {
		const response = await fetch('/api/process', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: currentCsvData, command: userCommand })
		});

		if (!response.ok) {
			throw new Error(`API request failed with status ${response.status}`);
		}

		const completion = await response.json();
		const newCsvResult = completion.result ?? '';
		if (typingIndicator?.parentNode) {
			typingIndicator.remove();
		}
		await addMessage('ai', newCsvResult);
		currentCsvData = typeof newCsvResult === 'string' ? newCsvResult : String(newCsvResult);
	} catch (error) {
		console.error('Failed to handle message:', error);
		if (typingIndicator?.parentNode) {
			typingIndicator.remove();
		}
		await addMessage('system', '处理失败，请稍后重试。');
	} finally {
		commandInput.disabled = false;
		commandInput.focus();
	}
}

if (sendBtn) {
	sendBtn.addEventListener('click', handleSendMessage);
}

if (commandInput) {
	commandInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	});
}