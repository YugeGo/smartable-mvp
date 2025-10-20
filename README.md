<div align="center">

# 智表 · Smartable

对话式表格助手｜通过自然语言完成清洗、统计、作图与导出

[ 在线体验 ](https://smartable-mvp.netlify.app/) · [问题反馈](https://github.com/YugeGo/smartable-mvp/issues)

</div>

## 能解决什么场景？

| 角色 | 典型诉求 | 智表能做什么 |
| --- | --- | --- |
| 运营/市场 | 多渠道日报、Top-K 榜单 | 自动聚合并输出图表与 CSV |
| 客服/支持 | 聊天/工单分类、关键词统计 | 清洗文本、统计频次、生成可视化 |
| 财务/行政 | 费用分摊、排课编排 | 解析多表 Excel、补全空值、导出汇总 |

无需记公式，上传（或粘贴）数据后直接描述需求即可，AI 会返回结构化表格与图表，并可导出 PNG / CSV / Excel。

---

## 最新亮点

- **一键汇总多工作表**：上传含多个 sheet 的 Excel 时，自动合并为带 `sheet_name` 列的汇总表（同时保留原始 sheet），移动端默认使用汇总数据，避免遗漏。
- **对话式连续分析**：多轮对话保持上下文，可在同一数据源上迭代指令、生成更多报表。
- **快捷图表模板**：折线/柱状/堆叠/散点/雷达等模板一键填充，生成后可直接下载图片。
- **数据工具条**：按列筛选/排序/Top-K、撤销与重做、导出预览 CSV、重置回原始数据。
- **情景式提示**：发现空值、重复列或大表时自动弹出“清理/采样”建议。
- **多端体验优化**：移动端输入区适配软键盘、底部 safe-area；桌面侧栏可折叠并记住状态；深浅色主题随时切换。

---

## 快速开始

> 需要 Node.js ≥ 18（推荐 20 / 22）。

```bash
npm install          # 安装依赖
export DEEPSEEK_API_KEY="your-key"   # 或通过 .env / Netlify 环境变量配置
npm run dev          # 启动开发服务器（Vite）

# 构建生产包
npm run build
```

开发服务器默认将 API 请求代理到 `/api/process`；若本地无函数代理，则回退至 `/.netlify/functions/process`。

---

## 部署说明（Netlify）

- **Build command**：`npm run build`
- **Publish directory**：`dist`
- **Functions directory**：`api`
- **环境变量**：`DEEPSEEK_API_KEY`
- **路由重写**：确保 `public/_redirects` 或 `netlify.toml` 中包含
    - `/*    /index.html   200`
    - `/api/*    /.netlify/functions/:splat   200`

部署完成后即可通过 Netlify Functions 调用 DeepSeek 模型生成表格和图表。

---

## 技术栈概览

- 前端：原生 HTML / CSS / JS (ES Modules)、Vite、ECharts、SheetJS (xlsx)
- 后端：Netlify Functions（Node.js + openai SDK 指向 DeepSeek）
- 部署：Netlify + GitHub

```
smartable-mvp/
├─ index.html
├─ style.css
├─ src/
│  └─ main.js              # 前端交互逻辑（含多表汇总、移动端适配）
├─ api/
│  └─ process.js           # Netlify Function（调用 DeepSeek 返回 CSV + 图表）
├─ packages/
│  └─ core/csv.js          # CSV 解析与序列化工具
├─ public/_redirects
├─ netlify.toml
└─ README.md
```

---

## API 概要

POST `/api/process`

```json
{
    "command": "按学院统计考场并生成柱状图",
    "activeTableName": "排考 · 全部工作表",
    "workspace": {
        "排考 · 全部工作表": {
            "currentData": "header,...",
            "originalData": "header,..."
        }
    }
}
```

响应：

```json
{
    "result": "CSV 字符串（带表头）",
    "chart": { "title": "...", "series": [...] } | null,
    "targetTable": "写入数据源的名称"
}
```

> 服务器端设有 28s 超时保护，并对 CSV 返回行数做 200 行上限裁剪，以保证响应稳定。

---

## 隐私与使用建议

- 数据仅保留在浏览器内存与 LocalStorage 中，除非你发起分析请求，否则不会发送至后端。
- 后端函数会把当前工作区快照转发至 DeepSeek API，请勿上传敏感、受监管或涉隐私的数据。
- 若需生产级落地，请结合企业级网关或自建模型，并补强审计与权限控制。

---

## 许可证

MIT License（详见 `LICENSE`）。在保留版权声明的前提下可自由使用与改造。

---

## 致谢

感谢 ECharts、SheetJS 以及 Netlify 社区的优秀开源生态，也感谢所有体验者的反馈，让智表持续进化。

最后更新：2025-10-20