const mobileShellHTML = `
  <!-- 纯聊天外壳：沿用现有 DOM，去除桌面侧栏结构 -->
  <header id="mobile-topbar" class="mobile-topbar" aria-label="移动端导航">
    <button type="button" id="mobile-menu-toggle" class="mobile-icon-btn" aria-label="打开侧边栏" title="侧边栏">➜</button>
    <div class="mobile-brand"><span class="brand-name">新对话</span><div class="brand-sub">内容由 AI 生成</div></div>
    <div class="mobile-actions">
      <button id="mobile-more-btn" class="mobile-icon-btn" type="button" aria-label="更多">⋯</button>
    </div>
  </header>

  <!-- 移动端抽屉侧边栏（占屏幕三分之一） -->
  <aside id="sidebar" aria-label="侧边栏" hidden>
    <div class="sidebar-header">
      <button id="sidebar-close" class="mobile-icon-btn" type="button" aria-label="收起">←</button>
      <div class="brand"><h1>智表</h1></div>
    </div>
    <div class="sidebar-scroll">
      <section class="sidebar-section"><header class="sidebar-section-header"><h2>快捷</h2></header>
        <div class="section-body">
          <p class="intro-note">这里以后可以放常用入口与设置</p>
        </div>
      </section>
    </div>
  </aside>

  <!-- 移动端抽屉遮罩（点击可关闭） -->
  <div id="mobile-backdrop" class="mobile-backdrop" hidden aria-hidden="true"></div>

  <main id="main-content">
    <div id="chat-container">
      <div id="top-loading-bar" aria-hidden="true"></div>
      <div id="message-list"></div>
      <!-- 底部横向滑动快捷按钮 -->
      <div id="mobile-quick-chips" class="mobile-quick-chips" aria-label="快捷功能" role="list">
        <!-- 运行时填充：趋势图 / Top-10 / 清洗空值 / 示例数据 -->
      </div>
      <div id="upload-status" aria-live="polite" role="status"></div>
      <div id="input-area">
        <button id="mobile-plus-btn" class="input-btn" aria-label="更多操作" title="更多">＋</button>
        <div id="mobile-quick-actions" class="mobile-quick-actions" hidden aria-hidden="true" role="menu">
          <button type="button" class="mobile-qa-item" data-act="upload" role="menuitem">📎 上传文件</button>
          <button type="button" class="mobile-qa-item" data-act="paste" role="menuitem">📋 粘贴数据</button>
          <button type="button" class="mobile-qa-item" data-act="new" role="menuitem">🔄 新会话</button>
        </div>
        <input type="file" id="file-upload-input" style="display: none;" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        <textarea id="command-input" placeholder="请输入指令..."></textarea>
        <button id="send-btn" class="input-btn">➢</button>
      </div>
    </div>
  </main>
`;

export function injectMobileUI() {
    // 清空 body 并注入移动端 UI
    document.body.innerHTML = mobileShellHTML;
}
