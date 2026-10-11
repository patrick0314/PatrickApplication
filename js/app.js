/**
 * My App Main Controller
 * Modular Registry, Navigation, Theme, and Notification Management
 */
const App = {
  activeTab: 'dashboard',

  modules: [
    {
      id: 'dashboard',
      name: '首頁',
      icon: 'layout-grid',
      render: () => DashboardModule.render(),
      init: () => DashboardModule.init()
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
  },

  updateHeader() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const titleEl = document.getElementById('app-header-title');
    if (titleEl) {
      titleEl.textContent = settings.userName || 'default';
    }

    const dateEl = document.getElementById('app-header-date');
    if (dateEl) {
      const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
      dateEl.textContent = new Date().toLocaleDateString('zh-TW', dateOptions);
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

    navContainer.innerHTML = this.modules.map(mod => {
      const isActive = mod.id === this.activeTab;
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
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
