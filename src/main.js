// src/main.js - V1.6.0 (Vite Migration)
import '../style.css';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

// 让调试更方便（可选）：在全局挂载
window.echarts = echarts;
window.XLSX = XLSX;

// --- 以下为原 script.js 逻辑（已直接内联到模块中） ---

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
const demoButtons = document.querySelectorAll('.demo-btn');
const pasteBtn = document.getElementById('paste-btn');
const dataInputPanel = document.getElementById('data-input-panel');
const dataPasteArea = document.getElementById('data-paste-area');
const dataPasteSubmit = document.getElementById('data-paste-submit');
const dataPasteCancel = document.getElementById('data-paste-cancel');
const dataPasteClose = document.getElementById('data-paste-close');
const newSessionBtn = document.getElementById('new-session-btn');
const datasetTray = document.getElementById('dataset-tray');
const dataPreviewSection = document.getElementById('data-preview');
const dataPreviewTitle = document.getElementById('data-preview-title');
const dataPreviewTable = document.getElementById('data-preview-table');
const dataPreviewFootnote = document.getElementById('data-preview-footnote');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const chartShortcutsSection = document.getElementById('chart-shortcuts');
const chartShortcutList = document.getElementById('chart-shortcut-list');

const STORAGE_KEYS = {
	initialMessage: 'smartable:initial-message',
	bannerDismissed: 'smartable:banner-dismissed',
	session: 'smartable:session',
	darkMode: 'smartable:dark-mode'
};

// --- 2. State Management ---
let messages = [];
// The workspace holds all data sources. Each key is a table name.
// Each value is an object: { originalData: '...', currentData: '...' }
let workspace = {};
// The name of the table currently being viewed/edited.
let activeTableName = '';
let isDarkMode = false;

var CHART_COLOR_PRESETS = Object.freeze({
	classic: ['#2563eb', '#a855f7', '#14b8a6', '#f97316', '#facc15', '#ec4899'],
	vibrant: ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'],
	pastel: ['#93c5fd', '#d8b4fe', '#fbcfe8', '#fde68a', '#bbf7d0', '#fecaca']
});

var CHART_COLOR_PRESETS_DARK = Object.freeze({
	classic: ['#93c5fd', '#c4b5fd', '#5eead4', '#fbbf24', '#fda4af', '#f87171'],
	vibrant: ['#f87171', '#34d399', '#60a5fa', '#facc15', '#a78bfa', '#fb7185'],
	pastel: ['#bfdbfe', '#e9d5ff', '#fecdd3', '#fef3c7', '#bbf7d0', '#f5d0fe']
});

var CHART_SHORTCUTS = [
	{
		id: 'line-trend',
		label: '趋势折线图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份趋势折线图，自动识别最合适的时间或序号作为横轴，选择关键指标作为纵轴，并返回整理后的CSV及对应的ECharts配置。`
	},
	{
		id: 'bar-compare',
		label: '对比柱状图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份对比柱状图，挑选最适合的维度作为分组，展示主要度量的对比，同时输出CSV和ECharts配置。`
	},
	{
		id: 'pie-share',
		label: '占比饼图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份占比饼图，选择有代表性的分类字段计算占比，输出整理后的CSV与ECharts配置。`
	},
	{
		id: 'stacked-area',
		label: '堆叠面积图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份堆叠面积图，用于展示多个系列随时间的累计趋势，并提供CSV和ECharts配置。`
	},
	{
		id: 'scatter-relation',
		label: '散点关系图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份散点图，自动选取两个合适的度量字段分析它们的关系，并输出CSV及ECharts配置。`
	},
	{
		id: 'radar-profile',
		label: '雷达分布图',
		prompt: tableName => `请基于数据源「${tableName}」生成一份雷达图，挑选可对比的多个指标构成维度，展示各类别的特征，同时返回CSV和ECharts配置。`
	}
];

const CHART_PROMPT_SHORTCUT_IDS = ['line-trend', 'bar-compare', 'pie-share'];

// --- 3. Core Functions ---

function renderChart(chartOption, containerElement) {
	if (!chartOption) {
		return;
	}

	try {
		const optionClone = typeof structuredClone === 'function'
			? structuredClone(chartOption)
			: JSON.parse(JSON.stringify(chartOption));

		const enhancedOption = enhanceChartOption(optionClone, containerElement);

		const existingInstance = echarts.getInstanceByDom(containerElement);
		if (existingInstance) {
			existingInstance.dispose();
		}
		const chartInstance = echarts.init(containerElement);
		chartInstance.setOption(enhancedOption, true);
	} catch (error) {
		console.error('Failed to render chart:', error);
		containerElement.textContent = '图表渲染失败。';
	}
}

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
			try {
				chartContainer.dataset.chartOption = JSON.stringify(chartOption);
			} catch (error) {
				console.error('Failed to cache chart option:', error);
			}
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

			if (chartOption) {
				const exportImgBtn = document.createElement('button');
				exportImgBtn.classList.add('action-btn');
				exportImgBtn.textContent = '🖼 下载图片';
				exportImgBtn.addEventListener('click', () => exportChartImage(messageBubble));
				actionsContainer.appendChild(exportImgBtn);
			}
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

	if (sender === 'system' && messages.length === 0) {
		return;
	}
	messages.push({ sender, content });
	if (doSave) {
		saveSession();
	}
}

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

		const response = await callProcessApi({
			command: userCommand,
			activeTableName,
			workspace: workspacePayload
		});

		if (response.status === 504) {
			if (skeletonMessage.parentNode) {
				messageList.removeChild(skeletonMessage);
			}
			addMessage('system', '后端处理超时，请稍后重试或简化指令后再试。');
			updateUploadStatus('⏳ 服务响应超时，请稍后重试。', 'error');
			return;
		}

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
				showChartPrompt('post-result', destinationTableName);
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
		showChartPrompt('upload', tableName);
	} catch (error) {
		console.error('Failed to process file:', error);
		updateUploadStatus(`⚠️ ${file.name} 读取失败，请确保文件格式正确。`, 'error');
		addMessage('system', '文件读取失败，请确保文件格式正确！');
	}

	event.target.value = '';
}

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

initializeThemeControls();
initializeChartShortcuts();
initializeOnboarding();

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
	if (darkModeToggle) {
		darkModeToggle.disabled = isLoading;
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

	syncChartShortcutButtons(isLoading);
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
	const hasSession = loadSession();

	if (!hasSession && !sessionStorage.getItem(STORAGE_KEYS.initialMessage)) {
		addMessage('system', '欢迎使用智表！上传或粘贴数据后描述你的需求，我们会输出结构化表格并尝试生成图表。');
		sessionStorage.setItem(STORAGE_KEYS.initialMessage, 'true');
	}

	if (onboardingBanner) {
		const dismissed = localStorage.getItem(STORAGE_KEYS.bannerDismissed) === 'true';
		if (dismissed) {
			onboardingBanner.classList.add('hidden');
			onboardingBanner.setAttribute('aria-hidden', 'true');
		} else {
			onboardingBanner.classList.remove('hidden');
			onboardingBanner.setAttribute('aria-hidden', 'false');
		}
	}

	if (bannerCloseBtn) {
		bannerCloseBtn.addEventListener('click', () => {
			if (onboardingBanner) {
				onboardingBanner.classList.add('hidden');
				onboardingBanner.setAttribute('aria-hidden', 'true');
			}
			localStorage.setItem(STORAGE_KEYS.bannerDismissed, 'true');
			if (commandInput) {
				commandInput.focus();
			}
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

	// 一键样例体验
	demoButtons.forEach(btn => {
		btn.addEventListener('click', async () => {
			const sample = btn.getAttribute('data-sample');
			if (sample) {
				await loadSampleDataset(sample);
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

	const activeEl = document.activeElement;
	if (activeEl && dataInputPanel.contains(activeEl)) {
		if (commandInput) {
			commandInput.focus();
		} else if (pasteBtn) {
			pasteBtn.focus();
		} else if (typeof activeEl.blur === 'function') {
			activeEl.blur();
		}
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
	showChartPrompt('upload', tableName);

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

	applyChartStylePalette(option);
	applyChartTheme(option);
	enforceContainLabel(option);
	applyBarSeriesSpacing(option);
	autoResizeChart(option, container);

	return option;
}

function applyChartStylePalette(option) {
	const palette = getActiveChartPalette();
	if (Array.isArray(palette) && palette.length > 0) {
		option.color = palette;
	}
}

function getActiveChartPalette() {
	const lightPalette = CHART_COLOR_PRESETS.classic;
	const darkPalette = CHART_COLOR_PRESETS_DARK.classic;
	return isDarkMode ? darkPalette : lightPalette;
}

function applyChartTheme(option) {
	if (isDarkMode) {
		option.textStyle = {
			...(option.textStyle || {}),
			color: '#e2e8f0'
		};

		const legendList = normalizeObjectCollection(option.legend);
		if (legendList.length > 0) {
			legendList.forEach(legend => {
				legend.textStyle = {
					...(legend.textStyle || {}),
					color: '#e2e8f0'
				};
				legend.icon = legend.icon || 'circle';
			});
			option.legend = Array.isArray(option.legend) ? legendList : legendList[0];
		}

		const titleList = normalizeObjectCollection(option.title);
		if (titleList.length > 0) {
			titleList.forEach(title => {
				title.textStyle = {
					...(title.textStyle || {}),
					color: '#f8fafc',
					fontWeight: '600'
				};
				if (title.subtext) {
					title.subtextStyle = {
						...(title.subtextStyle || {}),
						color: '#cbd5f5'
					};
				}
			});
			option.title = Array.isArray(option.title) ? titleList : titleList[0];
		}

		if (option.tooltip) {
			option.tooltip = {
				...(option.tooltip || {}),
				backgroundColor: 'rgba(15, 23, 42, 0.92)',
				borderColor: 'rgba(148, 163, 184, 0.35)',
				textStyle: {
					...(option.tooltip?.textStyle || {}),
					color: '#e2e8f0'
				}
			};
		}

		option.xAxis = applyAxisTheme(option.xAxis);
		option.yAxis = applyAxisTheme(option.yAxis);
	}
}

function normalizeObjectCollection(candidate) {
	if (Array.isArray(candidate)) {
		return candidate.filter(item => item && typeof item === 'object');
	}
	if (candidate && typeof candidate === 'object') {
		return [candidate];
	}
	return [];
}

function applyAxisTheme(axisCandidate) {
	const axes = normalizeObjectCollection(axisCandidate);
	if (axes.length === 0) {
		return axisCandidate;
	}

	axes.forEach(axis => {
		axis.axisLabel = {
			...(axis.axisLabel || {}),
			color: '#cbd5f5'
		};
		axis.nameTextStyle = {
			...(axis.nameTextStyle || {}),
			color: '#94a3b8'
		};
		const axisLine = axis.axisLine || {};
		const axisLineStyle = axisLine.lineStyle || {};
		axis.axisLine = {
			...axisLine,
			lineStyle: {
				...axisLineStyle,
				color: 'rgba(148, 163, 184, 0.45)'
			}
		};

		if (axis.splitLine || axis.type === 'value' || axis.type === undefined) {
			const splitLine = axis.splitLine || {};
			const splitLineStyle = splitLine.lineStyle || {};
			axis.splitLine = {
				...splitLine,
				lineStyle: {
					...splitLineStyle,
					color: 'rgba(148, 163, 184, 0.18)'
				}
			};
		}
	});

	if (Array.isArray(axisCandidate)) {
		return axes;
	}

	return axes[0] || axisCandidate;
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
	if (datasetTray) {
		datasetTray.innerHTML = '';
	}

	const tableNames = Object.keys(workspace);

	if (!datasetTray) {
		renderActiveTablePreview();
		return;
	}

	if (tableNames.length === 0) {
		const emptyBadge = document.createElement('span');
		emptyBadge.classList.add('dataset-empty');
		emptyBadge.textContent = '尚未上传数据';
		datasetTray.appendChild(emptyBadge);
		renderActiveTablePreview();
		return;
	}

	tableNames.forEach(tableName => {
		const tableEntry = workspace[tableName];
		const { columnCount, rowCount } = getTableStats(tableEntry?.currentData);

		const chip = document.createElement('div');
		chip.classList.add('dataset-chip');
		if (tableName === activeTableName) {
			chip.classList.add('active');
		}

		const selectBtn = document.createElement('button');
		selectBtn.type = 'button';
		selectBtn.classList.add('dataset-chip-select');
		selectBtn.textContent = tableName;
		const statsLabel = `${columnCount} 列 · ${rowCount} 行`;
		selectBtn.title = statsLabel;
		selectBtn.setAttribute('aria-label', `${tableName} · ${statsLabel}`);
		selectBtn.addEventListener('click', () => {
			if (tableName !== activeTableName) {
				setActiveTable(tableName);
			}
		});

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.classList.add('dataset-chip-remove');
		removeBtn.setAttribute('aria-label', `移除 ${tableName}`);
		removeBtn.textContent = '×';
		removeBtn.addEventListener('click', event => {
			event.stopPropagation();
			removeTable(tableName);
		});

		chip.appendChild(selectBtn);
		chip.appendChild(removeBtn);
		datasetTray.appendChild(chip);
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
		dataPreviewTable.innerHTML = '<p class="data-preview-placeholder">上传或选择数据源后，这里会显示表格预览。</p>';
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
		syncChartShortcutButtons();
		return;
	}

	activeTableName = tableName;
	renderDataSourceList();

	const { columnCount, rowCount } = getTableStats(workspace[tableName].currentData);
	updateUploadStatus(`📊 当前数据源: ${tableName} · ${columnCount} 列 · ${rowCount} 行`);
	saveSession();
	syncChartShortcutButtons();
}

function removeTable(tableName) {
	if (!workspace[tableName]) {
		return;
	}

	delete workspace[tableName];

	if (messageList) {
		Array.from(messageList.querySelectorAll('.chart-suggestion')).forEach(node => {
			if (node instanceof HTMLElement && node.dataset.table === tableName) {
				node.remove();
			}
		});
	}

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
	saveSession();
	syncChartShortcutButtons();
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
			addMessage(msg.sender, msg.content, false);
		});

		workspace = sessionData.workspace;
		activeTableName = sessionData.activeTableName || '';

		if (activeTableName && workspace[activeTableName]) {
			const tableData = workspace[activeTableName].currentData;
			const headers = extractHeaders(tableData);
			const rowCount = Math.max(tableData.split('\n').length - 1, 0);
			updateUploadStatus(`✅ 会话已恢复: ${activeTableName} · ${headers.length} 列 · ${rowCount} 行`, 'success');
		} else {
			updateUploadStatus('✅ 会话已恢复，请在上方选择或上传数据源。', 'success');
		}

		renderDataSourceList();
		syncChartShortcutButtons();

		return true;
	} catch (error) {
		console.error('Failed to load session:', error);
		localStorage.removeItem(STORAGE_KEYS.session);
		return false;
	}
}

function rerenderAllCharts() {
	const chartContainers = document.querySelectorAll('.chart-container');
	chartContainers.forEach(container => {
		const rawOption = container.dataset.chartOption;
		if (!rawOption) {
			return;
		}

		try {
			const option = JSON.parse(rawOption);
			renderChart(option, container);
		} catch (error) {
			console.error('Failed to re-render chart:', error);
		}
	});
}

function applyDarkMode(enable) {
	document.body.classList.toggle('dark-mode', enable);
	if (darkModeToggle) {
		darkModeToggle.textContent = enable ? '☀️' : '🌙';
		darkModeToggle.setAttribute('aria-label', enable ? '切换到浅色模式' : '切换到深色模式');
		darkModeToggle.classList.toggle('active', enable);
	}
}

function initializeThemeControls() {
	try {
		localStorage.removeItem('smartable:chart-style');
	} catch (error) {
		console.warn('Failed to clear legacy chart style preference:', error);
	}

	const savedDarkPreference = localStorage.getItem(STORAGE_KEYS.darkMode);
	if (savedDarkPreference === 'true' || savedDarkPreference === 'false') {
		isDarkMode = savedDarkPreference === 'true';
	} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		isDarkMode = true;
	}

	applyDarkMode(isDarkMode);

	if (darkModeToggle) {
		darkModeToggle.addEventListener('click', () => {
			isDarkMode = !isDarkMode;
			localStorage.setItem(STORAGE_KEYS.darkMode, String(isDarkMode));
			applyDarkMode(isDarkMode);
			rerenderAllCharts();
		});
	}
}

function initializeChartShortcuts() {
	if (!chartShortcutList) {
		return;
	}

	chartShortcutList.innerHTML = '';

	CHART_SHORTCUTS.forEach(shortcut => {
		const button = document.createElement('button');
		button.type = 'button';
		button.classList.add('chart-shortcut');
		button.dataset.shortcutId = shortcut.id;
		button.textContent = shortcut.label;
		button.addEventListener('click', () => handleChartShortcut(shortcut));
		chartShortcutList.appendChild(button);
	});

	syncChartShortcutButtons();
}

function handleChartShortcut(shortcut) {
	if (!activeTableName || !workspace[activeTableName]) {
		updateUploadStatus('请先上传或粘贴一份数据，再使用图表快捷指令。', 'error');
		if (commandInput) {
			commandInput.focus();
		}
		return;
	}

	const command = typeof shortcut.prompt === 'function'
		? shortcut.prompt(activeTableName)
		: shortcut.prompt;

	commandInput.value = command;
	handleSendMessage();
}

function syncChartShortcutButtons(forceDisable = false) {
	if (!chartShortcutList) {
		return;
	}

	const hasActiveTable = Boolean(activeTableName && workspace[activeTableName]);
	const shouldDisable = forceDisable || !hasActiveTable;

	chartShortcutList.querySelectorAll('button').forEach(button => {
		button.disabled = shouldDisable;
		button.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
	});

	if (chartShortcutsSection) {
		chartShortcutsSection.classList.toggle('disabled', shouldDisable);
	}
}

function showChartPrompt(reason, tableName) {
	if (!messageList || !tableName || !workspace[tableName]) {
		return;
	}

	const shortcuts = CHART_SHORTCUTS.filter(shortcut => CHART_PROMPT_SHORTCUT_IDS.includes(shortcut.id));
	if (shortcuts.length === 0) {
		return;
	}

	const existingPrompt = Array.from(messageList.querySelectorAll('.chart-suggestion')).find(node => {
		const dataset = node instanceof HTMLElement ? node.dataset : undefined;
		return dataset && dataset.table === tableName && dataset.reason === reason;
	});
	if (existingPrompt) {
		existingPrompt.remove();
	}

	const container = document.createElement('div');
	container.classList.add('message', 'ai-message', 'chart-suggestion');
	container.dataset.table = tableName;
	container.dataset.reason = reason;

	const title = document.createElement('p');
	title.classList.add('chart-suggestion-title');
	title.textContent = reason === 'upload'
		? '要把这份数据快速生成图表吗？'
		: '需要把最新结果转换成图表吗？';
	container.appendChild(title);

	const subtitle = document.createElement('p');
	subtitle.classList.add('chart-suggestion-subtitle');
	subtitle.textContent = `数据源：${tableName}`;
	container.appendChild(subtitle);

	const actions = document.createElement('div');
	actions.classList.add('chart-suggestion-actions');

	shortcuts.forEach(shortcut => {
		const actionBtn = document.createElement('button');
		actionBtn.type = 'button';
		actionBtn.classList.add('chart-suggestion-btn');
		actionBtn.textContent = shortcut.label;
		actionBtn.addEventListener('click', () => {
			container.remove();
			handleChartShortcut(shortcut);
		});
		actions.appendChild(actionBtn);
	});

	const skipBtn = document.createElement('button');
	skipBtn.type = 'button';
	skipBtn.classList.add('chart-suggestion-dismiss');
	skipBtn.textContent = '暂不生成';
	skipBtn.addEventListener('click', () => {
		container.remove();
	});
	actions.appendChild(skipBtn);

	container.appendChild(actions);
	messageList.appendChild(container);
	messageList.scrollTop = messageList.scrollHeight;
}

// --- 4. API Helpers ---
async function callProcessApi(payload, { timeoutMs = 30000 } = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		// 优先尝试相对路径（本地 dev / 生产带 redirects）
		let resp = await fetch('/api/process', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			signal: controller.signal
		});
		if (resp.status === 404) {
			// 在某些托管环境中，/api/* 重写可能未生效，回退到 Netlify 函数显式路径
			resp = await fetch('/.netlify/functions/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: controller.signal
			});
		}
		return resp;
	} finally {
		clearTimeout(timer);
	}
}

// --- 5. Samples & Export Helpers ---
async function loadSampleDataset(fileName) {
	try {
		const resp = await fetch(`/samples/${fileName}`);
		if (!resp.ok) throw new Error(`Failed to fetch ${fileName}`);
		const text = await resp.text();
		const sanitized = sanitizeCsvString(text);
		const headers = extractHeaders(sanitized);
		const rowCount = Math.max(sanitized.split('\n').length - 1, 0);
		const tableName = `样例-${fileName}`;
		workspace[tableName] = { originalData: sanitized, currentData: sanitized };
		messages = [];
		setActiveTable(tableName);
		addMessage('system', `${tableName} 已载入 · ${headers.length} 列 · ${rowCount} 行`);
		updateUploadStatus(`✅ ${tableName} · ${headers.length} 列 · ${rowCount} 行`, 'success');
		showChartPrompt('upload', tableName);
	} catch (e) {
		console.error('Load sample failed:', e);
		updateUploadStatus('样例数据载入失败，请稍后重试。', 'error');
	}
}

function exportChartImage(messageBubble) {
	try {
		const chartContainer = messageBubble.querySelector('.chart-container');
		if (!chartContainer) return;
		const inst = echarts.getInstanceByDom(chartContainer);
		if (!inst) return;
		const dataUrl = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: getExportBgColor() });
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `chart-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
		a.click();
	} catch (e) {
		console.error('Export image failed:', e);
		updateUploadStatus('图片导出失败，请稍后重试。', 'error');
	}
}

function getExportBgColor() {
	return isDarkMode ? '#0f172a' : '#ffffff';
}
