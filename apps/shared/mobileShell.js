import initCore from './reuseCore.js';

export default function init() {
  const { bindCore, api, csv } = initCore();

  // Minimal bindings for mobile chat
  const sendBtn = document.getElementById('send-btn');
  const commandInput = document.getElementById('command-input');
  const fileUploadInput = document.getElementById('file-upload-input');
  const mobilePlusBtn = document.getElementById('mobile-plus-btn');
  const mobileQuickActions = document.getElementById('mobile-quick-actions');

  // Reuse existing app's main handlers if present
  if (bindCore && typeof bindCore.bindMobileUI === 'function') {
    bindCore.bindMobileUI();
  }

  if (mobilePlusBtn && mobileQuickActions) {
    mobilePlusBtn.addEventListener('click', () => {
      const isHidden = mobileQuickActions.hasAttribute('hidden');
      if (isHidden) {
        mobileQuickActions.removeAttribute('hidden');
        mobileQuickActions.setAttribute('aria-hidden', 'false');
      } else {
        mobileQuickActions.setAttribute('hidden', '');
        mobileQuickActions.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (sendBtn && commandInput) {
    sendBtn.addEventListener('click', () => {
      commandInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
  }
}
