# 多入口（MPA）结构说明

本仓库采用“同仓库，双入口 + 共享核心”的结构：

- apps/desktop：桌面端入口（现有 `index.html` 即桌面）
- apps/mobile：移动端入口（`/m/*` 路由）
- apps/shared：共享的 UI 初始化/壳层辅助
- packages/core（未来）: 共享业务逻辑模块（CSV、API、workspace、charts 等）

## 本地预览

- `npm run dev` 后，直接访问：
  - http://localhost:5173/  -> 桌面入口
  - http://localhost:5173/apps/mobile/index.html -> 移动入口（预览阶段）

## 生产部署

Netlify 重写：
- /api/* -> 函数
- /m/*   -> /mobile/index.html（移动端 SPA）
- /*     -> /index.html（桌面端 SPA）

构建后，Vite 会输出 desktop 与 mobile 两个入口到 `dist/`，Netlify 使用重写规则进行路由。
