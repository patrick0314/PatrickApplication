/**
 * LifeHub Main Application Engine
 * Orchestrates modules, tab routing, modals, themes, and notifications
 */
const App = {
  activeTab: 'dashboard',

  // Extensible Module Registry - new features are plugged in right here!
  modules: [
    {
      id: 'dashboard',
      name: '總覽',
      icon: 'layout-dashboard',
      render: () => DashboardModule.render(),
      init: () => DashboardModule.init()
    },
    {
      id: 'tasks',
      name: '事項',
      icon: 'check-square',
      render: () => TasksModule.render(),
      badge: () => TasksModule.getPendingCount()
    },
    {
      id: 'settings',
      name: '設定',
      icon: 'settings',
      render: () => SettingsModule.render()
    }
  ],

  init() {
    // 1. Initialize storage and seed data
    StorageManager.init();

    // 2. Apply theme
    this.applyTheme();

    // 3. Register Service Worker for PWA
    this.registerServiceWorker();

    // 4. Listen for system theme change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const settings = StorageManager.get('settings', {});
      if (settings.theme === 'system') {
        this.applyTheme();
      }
    });

    // 5. Initial render
    this.render();

    // 6. Listen to storage changes
    window.addEventListener('lifehub:storage-updated', () => {
      this.updateBadges();
    });
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

    // Update meta theme-color for iOS/Android status bar
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
    
    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(10);

    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  render() {
    const container = document.getElementById('module-content');
    const currentModule = this.modules.find(m => m.id === this.activeTab) || this.modules[0];

    // Render module content
    if (container) {
      container.innerHTML = currentModule.render();
    }

    // Render Bottom Navigation Bar
    this.renderNav();

    // Re-initialize Lucide Icons
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
                ${badgeCount > 99 ? '99+' : badgeCount}
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

  // Toast Notification System
  showToast(message, type = 'info') {
    const toast = document.getElementById('global-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast) return;

    toastMessage.textContent = message;

    // Toast styles based on type
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

  // Modal Dialogs
  openNewTaskModal() {
    this.openTaskModal(null);
  },

  openTaskModal(task) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('task-form');

    title.textContent = task ? '編輯事項' : '新增事項';
    form.reset();

    // Populate fields if editing
    document.getElementById('task-id-input').value = task ? task.id : '';
    document.getElementById('task-title-input').value = task ? task.title : '';
    document.getElementById('task-category-input').value = task ? (task.category || '生活') : '生活';
    document.getElementById('task-priority-input').value = task ? (task.priority || 'medium') : 'medium';
    document.getElementById('task-date-input').value = task ? (task.dueDate || '') : '';
    document.getElementById('task-notes-input').value = task ? (task.notes || '') : '';

    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.querySelector('.modal-content').classList.remove('translate-y-full');
      modal.querySelector('.modal-overlay').classList.remove('opacity-0');
      document.getElementById('task-title-input').focus();
    }, 10);
  },

  closeModal() {
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    modal.querySelector('.modal-content').classList.add('translate-y-full');
    modal.querySelector('.modal-overlay').classList.add('opacity-0');

    setTimeout(() => {
      modal.classList.add('hidden');
    }, 250);
  },

  handleTaskFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('task-id-input').value;
    const title = document.getElementById('task-title-input').value.trim();
    if (!title) {
      App.showToast('請輸入事項名稱', 'error');
      return;
    }

    const taskData = {
      id: id || undefined,
      title: title,
      category: document.getElementById('task-category-input').value,
      priority: document.getElementById('task-priority-input').value,
      dueDate: document.getElementById('task-date-input').value,
      notes: document.getElementById('task-notes-input').value.trim()
    };

    TasksModule.saveTask(taskData);
  },

  setCategoryPreset(cat) {
    document.getElementById('task-category-input').value = cat;
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
