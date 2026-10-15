/**
 * My App Main Controller
 * Modular Registry, Navigation, Theme, and Notification Management
 */
const App = {
  activeTab: 'dashboard',

  // Primary Bottom Nav Tab IDs
  navTabs: ['dashboard', 'settings'],

  modules: [
    {
      id: 'dashboard',
      name: '首頁',
      icon: 'layout-grid',
      render: () => DashboardModule.render(),
      init: () => DashboardModule.init()
    },
    {
      id: 'werewolf',
      name: '一夜狼人殺',
      icon: 'moon',
      render: () => WerewolfModule.render(),
      init: () => WerewolfModule.init()
    },
    {
      id: 'codenames',
      name: '機密代號',
      icon: 'key',
      render: () => CodenamesModule.render(),
      init: () => CodenamesModule.init()
    },
    {
      id: 'arthur',
      name: '亞瑟傳奇',
      icon: 'shield',
      render: () => ArthurModule.render(),
      init: () => ArthurModule.init()
    },
    {
      id: 'larp',
      name: '劇本殺紀錄',
      icon: 'book-open',
      render: () => LarpModule.render(),
      init: () => LarpModule.init()
    },
    {
      id: 'settings',
      name: '設定',
      icon: 'settings',
      render: () => SettingsModule.render()
    }
  ],

  init() {
    StorageManager.init();
    this.applyTheme();
    this.updateHeader();
    this.registerServiceWorker();

    setInterval(() => this.updateHeader(), 30000);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const settings = StorageManager.get('settings', {});
      if (settings.theme === 'system') {
        this.applyTheme();
      }
    });

    this.render();

    window.addEventListener('myapp:storage-updated', () => {
      this.updateHeader();
      this.updateBadges();
    });

    window.addEventListener('myapp:data-cleared', () => {
      this.updateHeader();
      this.render();
    });
  },

  updateHeader() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const userName = settings.userName || 'default';
    
    const titleEl = document.getElementById('app-header-title');
    if (titleEl) {
      titleEl.textContent = `${userName}'s App`;
    }

    const dateEl = document.getElementById('app-header-date');
    if (dateEl) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      dateEl.textContent = `${year}年${month}月${day}日 ${hours}:${minutes}`;
    }
  },

  applyTheme() {
    const settings = StorageManager.get('settings', { theme: 'system' });
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0b0f19' : '#ffffff');
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
      });
    }
  },

  switchTab(tabId) {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    
    if ('vibrate' in navigator) navigator.vibrate(10);

    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  render() {
    const container = document.getElementById('module-content');
    const currentModule = this.modules.find(m => m.id === this.activeTab) || this.modules[0];

    if (container) {
      container.innerHTML = currentModule.render();
    }

    this.updateHeader();
    this.renderNav();

    if (window.lucide) {
      lucide.createIcons();
    }
  },

  renderNav() {
    const navContainer = document.getElementById('bottom-nav-items');
    if (!navContainer) return;

    // Maintain only the primary tabs: '首頁' and '設定'
    const displayedModules = this.modules.filter(m => this.navTabs.includes(m.id));

    navContainer.innerHTML = displayedModules.map(mod => {
      const isActive = mod.id === this.activeTab || (mod.id === 'dashboard' && (this.activeTab === 'werewolf' || this.activeTab === 'codenames'));
      const badgeCount = mod.badge ? mod.badge() : 0;

      return `
        <button 
          onclick="App.switchTab('${mod.id}')"
          class="relative flex flex-col items-center justify-center flex-1 py-1 tap-scale transition-colors ${
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }"
        >
          <div class="relative">
            <i data-lucide="${mod.icon}" class="w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}"></i>
            ${badgeCount > 0 ? `
              <span class="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-[10px] text-white flex items-center justify-center font-bold">
                ${badgeCount}
              </span>
            ` : ''}
          </div>
          <span class="text-[11px] mt-1">${mod.name}</span>
        </button>
      `;
    }).join('');
  },

  updateBadges() {
    this.renderNav();
    if (window.lucide) lucide.createIcons();
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('global-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast) return;

    toastMessage.textContent = message;

    if (type === 'success') {
      toastIcon.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>';
    } else if (type === 'error') {
      toastIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 text-red-400"></i>';
    } else {
      toastIcon.innerHTML = '<i data-lucide="info" class="w-4 h-4 text-indigo-400"></i>';
    }

    if (window.lucide) lucide.createIcons();

    toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-4');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2400);
  },

  confirm(options) {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { title: options } : (options || {});
      const title = opts.title || '確定嗎？';
      const message = opts.message || '';
      const confirmText = opts.confirmText || '確定';
      const cancelText = opts.cancelText || '取消';
      const isDestructive = opts.isDestructive !== undefined ? opts.isDestructive : true;

      const existing = document.getElementById('global-confirm-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'global-confirm-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm fade-in';
      modal.innerHTML = `
        <div class="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center space-y-4">
          <div class="space-y-1.5 pt-1">
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-snug">${title}</h3>
            ${message ? `<p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${message}</p>` : ''}
          </div>
          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <button id="modal-cancel-btn" class="tap-scale w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              ${cancelText}
            </button>
            <button id="modal-confirm-btn" class="tap-scale w-full py-2.5 rounded-2xl ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
            } font-bold text-xs transition">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => {
          if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 150);
      };

      modal.querySelector('#modal-cancel-btn').onclick = () => {
        cleanup();
        if (opts.onCancel) opts.onCancel();
        resolve(false);
      };

      modal.querySelector('#modal-confirm-btn').onclick = () => {
        cleanup();
        if (opts.onConfirm) opts.onConfirm();
        resolve(true);
      };

      modal.onclick = (e) => {
        if (e.target === modal) {
          cleanup();
          if (opts.onCancel) opts.onCancel();
          resolve(false);
        }
      };
    });
  },

  prompt(options) {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { title: options } : (options || {});
      const title = opts.title || '請輸入內容';
      const defaultValue = opts.defaultValue || '';
      const placeholder = opts.placeholder || '';
      const confirmText = opts.confirmText || '確定';
      const cancelText = opts.cancelText || '取消';

      const existing = document.getElementById('global-prompt-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'global-prompt-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm fade-in';
      modal.innerHTML = `
        <div class="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-800 p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center space-y-4">
          <div class="space-y-1.5 pt-1">
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-snug">${title}</h3>
          </div>
          <div>
            <input 
              type="text" 
              id="prompt-input" 
              value="${defaultValue}" 
              placeholder="${placeholder}"
              class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-center font-bold"
            />
          </div>
          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <button id="prompt-cancel-btn" class="tap-scale w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              ${cancelText}
            </button>
            <button id="prompt-confirm-btn" class="tap-scale w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 font-bold text-xs transition">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#prompt-input');
      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => {
          if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 150);
      };

      const handleConfirm = () => {
        const val = input ? input.value.trim() : '';
        cleanup();
        if (opts.onConfirm) opts.onConfirm(val);
        resolve(val);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') handleConfirm();
      };

      modal.querySelector('#prompt-cancel-btn').onclick = () => {
        cleanup();
        if (opts.onCancel) opts.onCancel();
        resolve(null);
      };

      modal.querySelector('#prompt-confirm-btn').onclick = handleConfirm;

      modal.onclick = (e) => {
        if (e.target === modal) {
          cleanup();
          if (opts.onCancel) opts.onCancel();
          resolve(null);
        }
      };
    });
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
