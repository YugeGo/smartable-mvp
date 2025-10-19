<div align="center">

# 智表 Smartable

对话式表格助手 · 用自然语言完成清洗、统计、出图与导出

[ 在线体验 ](https://smartable-mvp.netlify.app/) · [Issues](https://github.com/YugeGo/smartable-mvp/issues)

</div>

## 它能帮你什么？

不懂 Excel 公式，也能把数据清洗、统计、出图、导出一气呵成：

- 清洗：删空值、按列去重、筛选、排序、Top-K
- 统计：按维度聚合、同比/环比、Top 榜、派生列
- 可视化：折线/柱状/饼/堆叠/散点/雷达（模板一键生成）
- 导出：表格导出 CSV/Excel、图表一键下载 PNG

适合运营、市场、客服、财务等需要快速整表与汇报的人。

---

## 主要特性（当前版本）

- 一次上传/粘贴即可开始对话，连续多轮保持上下文
- 常用图表模板与快捷按钮，生成后可直接下载图片
- 数据工具（基础）：按列筛选/排序/Top-K、结果撤销、导出预览 CSV、重置到原始数据
- 情景式提示：发现空值/重复时给出一键清理建议
- 使用指南：场景化引导步骤，带高亮定位与动作触发
- 侧栏最小化：产品介绍、使用指南、常用统计图支持折叠并记忆状态
- 深/浅色主题切换，图表自动适配主题与配色
- API 504 超时与 CSV 行数上限（200 行）双保险，避免长时卡顿

---

## 界面预览

- 单列对话区：AI 回复表格与图表，可悬浮显示“下载 Excel / 下载图片”
- 侧栏：数据预览 + 工具、产品介绍与一键场景芯片、使用指南、常用统计图模板
- 引导覆盖层：步骤标题/说明、进度、上一/下一步、目标区域脉冲高亮

---

## 技术栈

- 前端：原生 HTML/CSS/JS（ES Modules），Vite 构建，ECharts，SheetJS（xlsx）
- 后端：Netlify Functions（Node.js + openai SDK 指向 DeepSeek API）
- 部署：Netlify（SPA 重写与 Functions 路由）、GitHub CI

目录结构（节选）：

```
smartable-mvp/
├─ index.html
├─ style.css
├─ src/
│  └─ main.js
├─ api/
│  └─ process.js           # Netlify Function（生成 CSV + 图表）
├─ public/
│  └─ _redirects           # SPA & Functions 路由
├─ netlify.toml
├─ vite.config.js
├─ package.json
└─ README.md
```

---

## 快速开始（本地）

前置：Node.js 18+（建议 20/22）。

1) 安装依赖

```bash
npm install
```

2) 配置环境变量（用于后端函数调用 DeepSeek）

- 在 Netlify 或本地环境设置 `DEEPSEEK_API_KEY`。

3) 启动开发服务器

```bash
npm run dev
```

默认使用 Vite 本地预览；前端会将 API 请求发往 `/api/process`，若本地代理未命中会自动回退到 `/.netlify/functions/process`。

4) 构建生产包

```bash
npm run build
```

---

## 部署（Netlify）

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `api`
- 环境变量：`DEEPSEEK_API_KEY`
- 确保 `public/_redirects` 或 `netlify.toml` 中已配置：
    - SPA 路由（将任意路径重写到 `/index.html`）
    - API 路由（`/api/*` → `/.netlify/functions/:splat`）

---

## API 契约（后端函数）

POST `/api/process`（或 `/.netlify/functions/process`）

请求体：

```json
{
    "command": "按地区统计销售额并画饼图",
    "activeTableName": "样例-sales_weekly.csv",
    "workspace": {
        "样例-sales_weekly.csv": {
            "currentData": "header,...",
            "originalData": "header,..."
        }
    }
}
```

响应体（JSON）：

```json
{
    "result": "CSV 字符串（至少含表头）",
    "chart": { "echartsOption": "..." } | null,
    "targetTable": "写入的表名（默认 activeName）"
}
```

后端限制：
- 服务端超时保护（28s），超时返回 504
- 返回 CSV 行数硬上限 200（不含表头）

---

## 隐私与安全

- 你的数据仅在浏览器内存与本地存储中持久化会话，前端不会主动上报至第三方；
- 当你发起分析请求时，当前工作区快照会随同指令发送至后端函数，再由后端调用 DeepSeek API 完成处理；
- 请勿上传含有敏感个人信息或受监管数据；生产落地请审视合规要求并替换为企业私有化模型或网关。

---

## 许可证

本仓库以 MIT 许可证开源，详见 `LICENSE`（如缺失可按 MIT 使用并保留版权声明）。

---

## 致谢

感谢 ECharts 与 SheetJS 项目的卓越工作，也感谢社区提供的使用反馈与建议。

最后更新：2025-10-19