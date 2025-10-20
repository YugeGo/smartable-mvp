// src/main.js - V1.6.0 (Vite Migration)
import '../style.css';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

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
// Data tools elements
const dtToolbar = document.getElementById('data-tools');
const dtToggle = document.getElementById('dt-toggle');
const dtColumnSelect = document.getElementById('dt-column-select');
const dtRefreshColsBtn = document.getElementById('dt-refresh-cols');
const dtFilterValue = document.getElementById('dt-filter-value');
const dtFilterApply = document.getElementById('dt-filter-apply');
const dtSortAsc = document.getElementById('dt-sort-asc');
const dtSortDesc = document.getElementById('dt-sort-desc');
const dtTopKInput = document.getElementById('dt-topk-k');
const dtTopKApply = document.getElementById('dt-topk-apply');
const dtUndo = document.getElementById('dt-undo');
const dtRedo = document.getElementById('dt-redo');
const dtExportCsv = document.getElementById('dt-export-csv');
const dtReset = document.getElementById('dt-reset');
const dtHint = document.getElementById('dt-hint');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const chartShortcutsSection = document.getElementById('chart-shortcuts');
const chartShortcutList = document.getElementById('chart-shortcut-list');
const templateSelect = document.getElementById('template-select');
const introChips = document.querySelectorAll('#product-intro .intro-chip');
// Guide elements
const guideSection = document.getElementById('guide-section');
const guideOverlay = document.getElementById('guide-overlay');
const guideScenario = document.getElementById('guide-scenario');
const guideStartBtn = document.getElementById('guide-start-btn');
const guideCloseBtn = document.getElementById('guide-close');
const guidePrevBtn = document.getElementById('guide-prev');
const guideNextBtn = document.getElementById('guide-next');
const guideStepTitle = document.getElementById('guide-step-title');
const guideStepDesc = document.getElementById('guide-step-desc');
const guideProgress = document.getElementById('guide-progress');

const STORAGE_KEYS = {
	initialMessage: 'smartable:initial-message',
	bannerDismissed: 'smartable:banner-dismissed',
	session: 'smartable:session',
	darkMode: 'smartable:dark-mode',
	toolCollapsed: 'smartable:tool-collapsed',
	sectionCollapsed: 'smartable:section-collapsed'
};

// --- 2. State Management ---
let messages = [];
// The workspace holds all data sources. Each key is a table name.
// Each value is an object: { originalData: '...', currentData: '...' }
let workspace = {};
// The name of the table currently being viewed/edited.
let activeTableName = '';
let isDarkMode = false;
// 多步撤销/重做栈
const UNDO_LIMIT = 20;
const tableUndoStack = new Map(); // tableName -> string[]
const tableRedoStack = new Map(); // tableName -> string[]

// --- CSV 解析/序列化辅助（基于 Papa Parse） ---
function parseCsvToAoA(csvString) {
	if (!csvString || typeof csvString !== 'string' || csvString.trim() === '') {
		return [];
	}
	const res = Papa.parse(csvString, {
		delimiter: '', // 自动检测
		newline: '', // 自动检测
		skipEmptyLines: false
	});
	if (res.errors && res.errors.length > 0) {
		console.warn('CSV parse errors:', res.errors.slice(0, 3));
	}
	return Array.isArray(res.data) ? res.data : [];
}

function unparseAoAToCsv(aoa) {
	if (!Array.isArray(aoa)) return '';
	try {
		return Papa.unparse(aoa, { newline: '\n' });
	} catch (e) {
		console.warn('CSV unparse failed, fallback to join:', e);
		return aoa.map(row => (Array.isArray(row) ? row.join(',') : String(row ?? ''))).join('\n');
	}
}

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
		const aoa = parseCsvToAoA(csvString);
		if (!aoa || aoa.length === 0 || !Array.isArray(aoa[0]) || aoa[0].length === 0) {
			containerElement.textContent = csvString || '';
			return;
		}
		const table = document.createElement('table');
		const thead = document.createElement('thead');
		const tbody = document.createElement('tbody');

		const headerRow = document.createElement('tr');
		aoa[0].forEach(headerText => {
			const th = document.createElement('th');
			th.textContent = String(headerText ?? '').trim();
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);

		for (let i = 1; i < aoa.length; i += 1) {
			const dataRow = document.createElement('tr');
			const cells = Array.isArray(aoa[i]) ? aoa[i] : [aoa[i]];
			cells.forEach(cellText => {
				const td = document.createElement('td');
				td.textContent = String(cellText ?? '').trim();
				dataRow.appendChild(td);
			});
			tbody.appendChild(dataRow);
		}

		table.appendChild(thead);
		table.appendChild(tbody);
		containerElement.appendChild(table);
	} catch (error) {
		console.error('Failed to render CSV:', error);
		containerElement.textContent = csvString || '';
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
		const aoa = parseCsvToAoA(csvString);
		const worksheet = XLSX.utils.aoa_to_sheet(aoa);
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
			try { showErrorSuggestions('timeout', userCommand); } catch (_) {}
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
		try { showErrorSuggestions('error', userCommand); } catch (_) {}
		updateUploadStatus('请求失败，请稍后再试。', 'error');
	} finally {
		setLoadingState(false);
		commandInput.focus();
	}
}

// 错误/超时后的可恢复建议
function showErrorSuggestions(reason, originalCommand) {
	if (!messageList) return;
	const container = document.createElement('div');
	container.classList.add('message', 'ai-message');
	const title = document.createElement('p');
	title.textContent = reason === 'timeout' ? '响应超时，试试这些方式更快得到结果：' : '请求出错了，可以尝试以下方式：';
	container.appendChild(title);
	const actions = document.createElement('div');
	actions.classList.add('action-buttons');

	const retry = document.createElement('button');
	retry.classList.add('action-btn');
	retry.textContent = '🔁 立即重试';
	retry.addEventListener('click', () => {
		commandInput.value = originalCommand || commandInput.value;
		handleSendMessage();
		container.remove();
	});
	actions.appendChild(retry);

	const topk = document.createElement('button');
	topk.classList.add('action-btn');
	topk.textContent = '📉 仅输出Top-10汇总';
	topk.addEventListener('click', () => {
		const cmd = (originalCommand || commandInput.value || '').trim();
		commandInput.value = `${cmd}\n请仅返回包含前10条的汇总表，不需要图表；严格保持列名一致，避免新增列。`;
		handleSendMessage();
		container.remove();
	});
	actions.appendChild(topk);

	const headerOnly = document.createElement('button');
	headerOnly.classList.add('action-btn');
	headerOnly.textContent = '🧾 仅表头+汇总';
	headerOnly.addEventListener('click', () => {
		const cmd = (originalCommand || commandInput.value || '').trim();
		commandInput.value = `${cmd}\n如果运算量较大，请仅返回表头行和小型汇总示例，避免完整数据。`;
		handleSendMessage();
		container.remove();
	});
	actions.appendChild(headerOnly);

	container.appendChild(actions);
	messageList.appendChild(container);
	messageList.scrollTop = messageList.scrollHeight;
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
		// 使用 Papa 解析为 AoA 并标准化为 CSV 字符串
		const aoa = parseCsvToAoA(rawCsvString);
		const finalCsvString = unparseAoAToCsv(aoa);

		if (!finalCsvString || finalCsvString.trim() === '') {
			throw new Error('Empty dataset after sanitizing');
		}

		const headers = extractHeaders(finalCsvString);
		if (headers.length === 0) {
			throw new Error('Missing header row');
		}

		const totalAoa = parseCsvToAoA(finalCsvString);
		const rowCount = Math.max(totalAoa.length - 1, 0);
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
	if (event.key === 'Escape' && guideOverlay && !guideOverlay.hidden) {
		closeGuide();
	}
	// 快捷键：撤销/重做（避免影响输入框的原生撤销）
	const target = event.target;
	const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
	const isTyping = tag === 'input' || tag === 'textarea' || (target && target.isContentEditable);
	if (!isTyping && (event.ctrlKey || event.metaKey)) {
		const key = String(event.key || '').toLowerCase();
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			undoLastChange();
			return;
		}
		if (key === 'y' || (key === 'z' && event.shiftKey)) {
			event.preventDefault();
			redoLastChange();
			return;
		}
	}
});

initializeThemeControls();
initializeChartShortcuts();
initializeOnboarding();
initializeGuide();
initializeProductIntro();
initializeToolCollapse();
initializeSidebarSectionCollapse();

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

// --- Guide: 场景式引导 ---
const GUIDE_SCENARIOS = {
	'quick-start': {
		title: '一分钟上手',
		steps: [
			{
				title: '载入一份样例数据',
				desc: '点击任意“一键体验”按钮，马上获得一份示例数据，我们用它来快速演示。',
				target: '.onboarding-demos',
				action: null
			},
			{
				title: '查看数据预览',
				desc: '样例数据载入后，这里会展示表头与前几行。你可以选择列来进行筛选/排序/Top-K。',
				target: '#data-preview',
				action: null
			},
			{
				title: '一键生成图表',
				desc: '在“常用统计图”选择一种图表类型，我们会自动给出结果表与图表，且支持下载图片。',
				target: '#chart-shortcuts',
				action: () => {
					// 若有活动表，触发一个模板生成（例如趋势折线图）
					if (activeTableName && workspace[activeTableName]) {
						const shortcut = CHART_SHORTCUTS.find(s => s.id === 'line-trend');
						if (shortcut) handleChartShortcut(shortcut);
					}
				}
			},
			{
				title: '下载结果/图片',
				desc: '在 AI 返回的消息卡片底部可以下载表格Excel与图表图片，用于汇报与存档。',
				target: '#message-list',
				action: null
			}
		]
	}
};

let currentGuide = { key: '', stepIndex: 0 };

function initializeGuide() {
	if (!guideSection) return;
	if (guideStartBtn) guideStartBtn.addEventListener('click', startGuide);
	if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
	if (guidePrevBtn) guidePrevBtn.addEventListener('click', () => moveGuide(-1));
	if (guideNextBtn) guideNextBtn.addEventListener('click', () => moveGuide(1));
}

function startGuide() {
	const key = guideScenario?.value || 'quick-start';
	const scenario = GUIDE_SCENARIOS[key];
	if (!scenario) return;
	currentGuide = { key, stepIndex: 0 };
	openGuideOverlay();
	applyGuideStep();
}

let lastFocusedElement = null;
let guideTrapHandler = null;
function openGuideOverlay() {
	if (!guideOverlay) return;
	guideOverlay.hidden = false;
	guideOverlay.setAttribute('aria-hidden', 'false');
	// 保存并设置初始焦点
	lastFocusedElement = document.activeElement;
	const focusables = guideOverlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
	const focusList = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
	if (focusList.length) {
		try { focusList[0].focus(); } catch (_) {}
	}
	// 焦点陷阱与 Esc
	guideTrapHandler = (e) => {
		if (e.key === 'Tab') {
			const fsAll = Array.from(guideOverlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
			if (fsAll.length === 0) return;
			const first = fsAll[0];
			const last = fsAll[fsAll.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) { e.preventDefault(); last.focus(); }
			} else {
				if (document.activeElement === last) { e.preventDefault(); first.focus(); }
			}
		} else if (e.key === 'Escape') {
			closeGuide();
		}
	};
	document.addEventListener('keydown', guideTrapHandler);
}

function closeGuide() {
	if (!guideOverlay) return;
	removeGuideHighlight();
	guideOverlay.hidden = true;
	guideOverlay.setAttribute('aria-hidden', 'true');
	if (guideTrapHandler) {
		document.removeEventListener('keydown', guideTrapHandler);
		guideTrapHandler = null;
	}
	if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
		try { lastFocusedElement.focus(); } catch (_) {}
	}
}

function moveGuide(direction) {
	const scenario = GUIDE_SCENARIOS[currentGuide.key];
	if (!scenario) return;
	const max = scenario.steps.length - 1;
	let idx = currentGuide.stepIndex + direction;
	idx = Math.max(0, Math.min(max, idx));
	currentGuide.stepIndex = idx;
	applyGuideStep();
}

function applyGuideStep() {
	const scenario = GUIDE_SCENARIOS[currentGuide.key];
	if (!scenario) return;
	const step = scenario.steps[currentGuide.stepIndex];
	if (!step) return;

	if (guideStepTitle) guideStepTitle.textContent = step.title || '';
	if (guideStepDesc) guideStepDesc.textContent = step.desc || '';
	if (guideProgress) guideProgress.textContent = `${currentGuide.stepIndex + 1} / ${scenario.steps.length}`;

	// 高亮目标
	removeGuideHighlight();
	if (step.target) highlightTarget(step.target);

	// 执行动作（如触发模板）
	if (typeof step.action === 'function') {
		try { step.action(); } catch (e) { console.warn('Guide action failed:', e); }
	}

	// 按钮状态
	if (guidePrevBtn) guidePrevBtn.disabled = currentGuide.stepIndex === 0;
	if (guideNextBtn) guideNextBtn.textContent = currentGuide.stepIndex === scenario.steps.length - 1 ? '完成' : '下一步';
	if (guideNextBtn && currentGuide.stepIndex === scenario.steps.length - 1) {
		guideNextBtn.onclick = () => closeGuide();
	} else if (guideNextBtn) {
		guideNextBtn.onclick = () => moveGuide(1);
	}
}

function highlightTarget(selector) {
	const el = document.querySelector(selector);
	if (!el) return;
	try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
	el.classList.add('pulse-highlight');
}

function removeGuideHighlight() {
	document.querySelectorAll('.pulse-highlight').forEach(el => el.classList.remove('pulse-highlight'));
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

	// 使用 Papa 解析并标准化
	const aoa = Papa.parse(rawInput, { delimiter: '', newline: '', skipEmptyLines: true }).data;
	const sanitized = unparseAoAToCsv(aoa);
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

	const aoaFull = parseCsvToAoA(sanitized);
	const rowCount = Math.max(aoaFull.length - 1, 0);
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

	const aoa = parseCsvToAoA(csvString);
	if (!aoa || aoa.length === 0) return [];
	const headers = Array.isArray(aoa[0]) ? aoa[0] : [];
	return headers.map(h => String(h ?? '').trim()).filter(h => h.length > 0);
}

function sanitizeCsvString(rawCsvString) {
	if (!rawCsvString || typeof rawCsvString !== 'string') {
		return '';
	}
	// 仅规范换行并去除首尾空行，避免破坏引号/制表符
	const normalized = rawCsvString.replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	while (lines.length && lines[0].trim() === '') lines.shift();
	while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
	return lines.join('\n');
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
	const aoa = parseCsvToAoA(csvString);
	const rowCount = Math.max(aoa.length - 1, 0);
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
	const aoa = parseCsvToAoA(fullCsv);
	const previewRowLimit = 120;
	let truncated = false;
	let previewCsv = fullCsv;
	if (Array.isArray(aoa) && aoa.length > 1 && aoa.length - 1 > previewRowLimit) {
		const limited = [aoa[0], ...aoa.slice(1, previewRowLimit + 1)];
		previewCsv = unparseAoAToCsv(limited);
		truncated = true;
	}

	dataPreviewSection.classList.remove('empty');
	dataPreviewTitle.textContent = `当前数据源 · ${activeTableName}`;
	renderCsvAsTable(previewCsv, dataPreviewTable);

	// 更新工具条列选择
	populateDataToolsColumns(extractHeaders(fullCsv));

	// 情景式提示检测（当前列）
	refreshDataHint();

	if (dataPreviewFootnote) {
		if (truncated) {
			const totalRows = Math.max(aoa.length - 1, 0);
			dataPreviewFootnote.textContent = `仅展示前 ${previewRowLimit} 行（共 ${totalRows} 行）`;
		} else {
			dataPreviewFootnote.textContent = '';
		}
	}
}

function initializeToolCollapse() {
	if (!dtToolbar) return;
	const collapsed = localStorage.getItem(STORAGE_KEYS.toolCollapsed) === 'true';
	dtToolbar.classList.toggle('collapsed', collapsed);
	if (dtToggle) {
		dtToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
		dtToggle.addEventListener('click', () => {
			const nowCollapsed = !dtToolbar.classList.contains('collapsed') ? true : false;
			dtToolbar.classList.toggle('collapsed', nowCollapsed);
			dtToggle.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
			localStorage.setItem(STORAGE_KEYS.toolCollapsed, String(nowCollapsed));
		});
	}
}

// 侧栏区块折叠：产品介绍、使用指南、常用统计图
function initializeSidebarSectionCollapse() {
	const toggles = document.querySelectorAll('.section-toggle');
	if (!toggles || toggles.length === 0) return;

	// 恢复状态
	toggles.forEach(btn => {
		const targetId = btn.getAttribute('data-target');
		if (!targetId) return;
		const section = document.getElementById(targetId);
		if (!section) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEYS.sectionCollapsed);
			const map = raw ? JSON.parse(raw) : {};
			const collapsed = !!map[targetId];
			section.classList.toggle('collapsed', collapsed);
			btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
			btn.setAttribute('aria-controls', `${targetId}-body`);
		} catch (e) {
			// ignore
		}
		// 确保 section-body 有唯一 id 便于无障碍
		const body = section.querySelector('.section-body');
		if (body && !body.id) {
			body.id = `${targetId}-body`;
		}
	});

	// 绑定点击
	toggles.forEach(btn => {
		btn.addEventListener('click', () => {
			const targetId = btn.getAttribute('data-target');
			if (!targetId) return;
			const section = document.getElementById(targetId);
			if (!section) return;
			const willCollapse = !section.classList.contains('collapsed');
			section.classList.toggle('collapsed', willCollapse);
			btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
			// 持久化
			try {
				const raw = localStorage.getItem(STORAGE_KEYS.sectionCollapsed);
				const map = raw ? JSON.parse(raw) : {};
				map[targetId] = willCollapse;
				localStorage.setItem(STORAGE_KEYS.sectionCollapsed, JSON.stringify(map));
			} catch (e) { /* noop */ }
		});
	});
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
	// 清空该表的历史（新活跃表）
	tableUndoStack.set(tableName, []);
	tableRedoStack.set(tableName, []);
	updateUndoRedoButtons();
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
			const aoa = parseCsvToAoA(tableData);
			const rowCount = Math.max(aoa.length - 1, 0);
			updateUploadStatus(`✅ 会话已恢复: ${activeTableName} · ${headers.length} 列 · ${rowCount} 行`, 'success');
		} else {
			updateUploadStatus('✅ 会话已恢复，请在上方选择或上传数据源。', 'success');
		}

		renderDataSourceList();
		syncChartShortcutButtons();
	// 初始化历史
	Object.keys(workspace).forEach(name => { tableUndoStack.set(name, []); tableRedoStack.set(name, []); });
	updateUndoRedoButtons();

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

function initializeProductIntro() {
	if (!introChips || introChips.length === 0) return;
	introChips.forEach(btn => {
		btn.addEventListener('click', async () => {
			const sample = btn.getAttribute('data-sample');
			const templateId = btn.getAttribute('data-template');
			try {
				if (sample) {
					await loadSampleDataset(sample);
				}
				const shortcut = CHART_SHORTCUTS.find(s => s.id === templateId);
				if (shortcut) {
					if (!activeTableName || !workspace[activeTableName]) return;
					handleChartShortcut(shortcut);
				}
			} catch (e) {
				console.warn('intro chip failed:', e);
			}
		});
	});
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

	// 模板选择
	if (templateSelect) {
		templateSelect.addEventListener('change', () => {
			const id = templateSelect.value;
			if (!id) return;
			const shortcut = CHART_SHORTCUTS.find(s => s.id === id);
			if (!shortcut) return;
			if (!activeTableName || !workspace[activeTableName]) {
				updateUploadStatus('请先上传或粘贴一份数据，再使用模板。', 'error');
				templateSelect.value = '';
				return;
			}
			const command = typeof shortcut.prompt === 'function' ? shortcut.prompt(activeTableName) : shortcut.prompt;
			commandInput.value = command;
			handleSendMessage();
			// 发送后重置选择，便于连续操作
			templateSelect.value = '';
		});
	}
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

	if (templateSelect) {
		templateSelect.disabled = shouldDisable;
		templateSelect.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
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
		const aoa = Papa.parse(text, { delimiter: '', newline: '', skipEmptyLines: true }).data;
		const sanitized = unparseAoAToCsv(aoa);
		const headers = extractHeaders(sanitized);
		const totalAoa = parseCsvToAoA(sanitized);
		const rowCount = Math.max(totalAoa.length - 1, 0);
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

// --- 6. Data Tools ---
function populateDataToolsColumns(headers) {
	if (!dtToolbar || !dtColumnSelect) return;
	dtColumnSelect.innerHTML = '';
	headers.forEach((h, idx) => {
		const opt = document.createElement('option');
		opt.value = String(idx);
		opt.textContent = h;
		dtColumnSelect.appendChild(opt);
	});
}

function getActiveCsvRows() {
	const csv = workspace[activeTableName]?.currentData || '';
	const aoa = parseCsvToAoA(csv);
	if (!aoa || aoa.length === 0) return { headers: [], rows: [] };
	const headers = Array.isArray(aoa[0]) ? aoa[0].map(s => String(s ?? '').trim()) : [];
	const rows = aoa.slice(1).map(r => (Array.isArray(r) ? r.map(s => String(s ?? '').trim()) : [String(r ?? '').trim()]));
	return { headers, rows };
}

function writeActiveCsv(headers, rows) {
	const aoa = [headers, ...rows];
	const csv = unparseAoAToCsv(aoa);
	// push to undo stack and clear redo
	const undo = tableUndoStack.get(activeTableName) || [];
	const prev = workspace[activeTableName].currentData;
	if (prev && typeof prev === 'string') {
		undo.push(prev);
		if (undo.length > UNDO_LIMIT) undo.shift();
		tableUndoStack.set(activeTableName, undo);
	}
	tableRedoStack.set(activeTableName, []);

	workspace[activeTableName].currentData = csv;
	renderActiveTablePreview();
	saveSession();
	updateUndoRedoButtons();
}

function isNumericColumn(rows, colIndex) {
	let numeric = 0, total = 0;
	rows.forEach(r => {
		const v = r[colIndex];
		if (v !== undefined && v !== '') {
			total++;
			if (!Number.isNaN(Number(v))) numeric++;
		}
	});
	return total > 0 && numeric / total > 0.6;
}

function applyFilterContains() {
	const { headers, rows } = getActiveCsvRows();
	if (headers.length === 0) return;
	const idx = Number(dtColumnSelect?.value || 0);
	const keyword = (dtFilterValue?.value || '').trim();
	if (!keyword) return;
	const filtered = rows.filter(r => (r[idx] || '').includes(keyword));
	writeActiveCsv(headers, filtered);
}

function applySortAscDesc(direction) {
	const { headers, rows } = getActiveCsvRows();
	if (headers.length === 0) return;
	const idx = Number(dtColumnSelect?.value || 0);
	const numeric = isNumericColumn(rows, idx);
	const sorted = [...rows].sort((a, b) => {
		const av = a[idx] || '';
		const bv = b[idx] || '';
		if (numeric) {
			const na = Number(av), nb = Number(bv);
			return direction === 'asc' ? na - nb : nb - na;
		}
		return direction === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
	});
	writeActiveCsv(headers, sorted);
}

function applyTopK() {
	const { headers, rows } = getActiveCsvRows();
	if (headers.length === 0) return;
	const idx = Number(dtColumnSelect?.value || 0);
	const k = Math.max(Number(dtTopKInput?.value || 10), 1);
	const numeric = isNumericColumn(rows, idx);
	const sorted = [...rows].sort((a, b) => {
		const av = a[idx] || '';
		const bv = b[idx] || '';
		if (numeric) return Number(bv) - Number(av);
		return String(bv).localeCompare(String(av));
	});
	writeActiveCsv(headers, sorted.slice(0, k));
}

function undoLastChange() {
	const undo = tableUndoStack.get(activeTableName) || [];
	if (undo.length === 0) return;
	const current = workspace[activeTableName].currentData;
	const prev = undo.pop();
	tableUndoStack.set(activeTableName, undo);
	const redo = tableRedoStack.get(activeTableName) || [];
	if (current && typeof current === 'string') {
		redo.push(current);
		if (redo.length > UNDO_LIMIT) redo.shift();
		tableRedoStack.set(activeTableName, redo);
	}
	workspace[activeTableName].currentData = prev;
	renderActiveTablePreview();
	saveSession();
	updateUndoRedoButtons();
}

function redoLastChange() {
	const redo = tableRedoStack.get(activeTableName) || [];
	if (redo.length === 0) return;
	const current = workspace[activeTableName].currentData;
	const next = redo.pop();
	tableRedoStack.set(activeTableName, redo);
	const undo = tableUndoStack.get(activeTableName) || [];
	if (current && typeof current === 'string') {
		undo.push(current);
		if (undo.length > UNDO_LIMIT) undo.shift();
		tableUndoStack.set(activeTableName, undo);
	}
	workspace[activeTableName].currentData = next;
	renderActiveTablePreview();
	saveSession();
	updateUndoRedoButtons();
}

// 删除当前列为空的行（空字符串或仅空白）
function dropEmptyInCurrentColumn() {
	const { headers, rows } = getActiveCsvRows();
	if (headers.length === 0) return;
	const idx = Number(dtColumnSelect?.value || 0);
	const filtered = rows.filter(r => (r[idx] ?? '').trim() !== '');
	writeActiveCsv(headers, filtered);
}

// 按当前列去重，保留首条
function dedupByCurrentColumn() {
	const { headers, rows } = getActiveCsvRows();
	if (headers.length === 0) return;
	const idx = Number(dtColumnSelect?.value || 0);
	const seen = new Set();
	const result = [];
	for (const row of rows) {
		const key = row[idx] ?? '';
		if (!seen.has(key)) {
			seen.add(key);
			result.push(row);
		}
	}
	writeActiveCsv(headers, result);
}

// 检测当前列的空值与重复，显示提示
function refreshDataHint() {
	if (!dtHint) return;
	if (!activeTableName || !workspace[activeTableName]) { dtHint.classList.remove('active'); dtHint.innerHTML=''; return; }
	const { headers, rows } = getActiveCsvRows();
	if (!headers.length) { dtHint.classList.remove('active'); dtHint.innerHTML=''; return; }
	const idx = Number(dtColumnSelect?.value || 0);
	const colName = headers[idx] || `第${idx+1}列`;

	let emptyCount = 0;
	const seen = new Set();
	let dupCount = 0;
	rows.forEach(r => {
		const v = (r[idx] ?? '').trim();
		if (v === '') emptyCount++;
		if (seen.has(v)) dupCount++; else seen.add(v);
	});

	if (emptyCount === 0 && dupCount === 0) {
		dtHint.classList.remove('active');
		dtHint.innerHTML = '';
		return;
	}

	const icon = '<span class="hint-icon" aria-hidden="true">💡</span>';
	const parts = [];
	if (emptyCount > 0) parts.push(`${colName} 存在 ${emptyCount} 个空值`);
	if (dupCount > 0) parts.push(`${colName} 发现 ${dupCount} 个重复`);

	dtHint.innerHTML = `${icon}<span class="hint-text">${parts.join('，')}，需要清理吗？</span>
		<span class="hint-actions">
		  ${emptyCount>0?'<button type="button" class="hint-btn" id="hint-drop-empty">删除空值</button>':''}
		  ${dupCount>0?'<button type="button" class="hint-btn" id="hint-dedup">按列去重</button>':''}
		  <button type="button" class="hint-btn" id="hint-dismiss">忽略</button>
		</span>`;
	dtHint.classList.add('active');

	const dropBtn = document.getElementById('hint-drop-empty');
	if (dropBtn) dropBtn.addEventListener('click', () => { dropEmptyInCurrentColumn(); dtHint.classList.remove('active'); });
	const dedupBtn = document.getElementById('hint-dedup');
	if (dedupBtn) dedupBtn.addEventListener('click', () => { dedupByCurrentColumn(); dtHint.classList.remove('active'); });
	const dismissBtn = document.getElementById('hint-dismiss');
	if (dismissBtn) dismissBtn.addEventListener('click', () => { dtHint.classList.remove('active'); });
}

// 导出当前预览为CSV
function exportCurrentPreviewCsv() {
	if (!activeTableName || !workspace[activeTableName]) return;
	const csv = workspace[activeTableName].currentData || '';
	if (!csv.trim()) return;
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
	a.href = url;
	a.download = `${activeTableName.replace(/\.[^/.]+$/, '')}-预览-${ts}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

// 重置为原始数据
function resetToOriginal() {
	if (!activeTableName || !workspace[activeTableName]) return;
	const original = workspace[activeTableName].originalData || '';
	if (!original) return;
	const aoa = parseCsvToAoA(original);
	const headers = Array.isArray(aoa[0]) ? aoa[0].map(s => String(s ?? '').trim()) : [];
	const rows = aoa.slice(1).map(r => (Array.isArray(r) ? r.map(s => String(s ?? '').trim()) : [String(r ?? '').trim()]));
	writeActiveCsv(headers, rows);
	// 清空历史，避免再撤销回到变更前
	tableUndoStack.set(activeTableName, []);
	tableRedoStack.set(activeTableName, []);
	updateUploadStatus('已重置为原始数据。', 'success');
	updateUndoRedoButtons();
}


// Hook toolbar buttons
if (dtFilterApply) dtFilterApply.addEventListener('click', applyFilterContains);
if (dtSortAsc) dtSortAsc.addEventListener('click', () => applySortAscDesc('asc'));
if (dtSortDesc) dtSortDesc.addEventListener('click', () => applySortAscDesc('desc'));
if (dtTopKApply) dtTopKApply.addEventListener('click', applyTopK);
if (dtUndo) dtUndo.addEventListener('click', undoLastChange);
if (dtRedo) dtRedo.addEventListener('click', redoLastChange);
if (dtRefreshColsBtn) dtRefreshColsBtn.addEventListener('click', () => {
	const csv = workspace[activeTableName]?.currentData || '';
	populateDataToolsColumns(extractHeaders(csv));
	refreshDataHint();
});
if (dtExportCsv) dtExportCsv.addEventListener('click', exportCurrentPreviewCsv);
if (dtReset) dtReset.addEventListener('click', resetToOriginal);

// 列选择变化时刷新提示
if (dtColumnSelect) dtColumnSelect.addEventListener('change', refreshDataHint);

// 根据撤销/重做栈状态更新工具栏按钮可用性
function updateUndoRedoButtons() {
	if (!activeTableName) {
		if (dtUndo) dtUndo.disabled = true;
		if (dtRedo) dtRedo.disabled = true;
		return;
	}
	const undo = tableUndoStack.get(activeTableName) || [];
	const redo = tableRedoStack.get(activeTableName) || [];
	if (dtUndo) dtUndo.disabled = undo.length === 0;
	if (dtRedo) dtRedo.disabled = redo.length === 0;
}

// 初始化一次按钮状态
updateUndoRedoButtons();
