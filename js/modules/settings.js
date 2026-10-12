/**
 * My App - Settings Module
 * Nickname management (no avatar), Theme selection, Mobile installation guide, Reset button
 */
const SettingsModule = {
  id: 'settings',
  name: '設定',
  icon: 'settings',

  render() {
    const settings = StorageManager.get('settings', { theme: 'system', userName: 'default' });
    const currentName = settings.userName || 'default';

    return `
      <div class="space-y-5 fade-in pb-20">
        <!-- Header -->
        <div class="pt-2">
          <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">系統設定</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">個人偏好設定與手機安裝</p>
        </div>

        <!-- Nickname Configuration Card (No Avatar) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="user" class="w-4 h-4 text-indigo-500"></i>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">自訂應用名稱 / 暱稱</h2>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              設定名稱 (預設為 default)
            </label>
            <div class="flex space-x-2">
              <input 
                type="text" 
                id="nickname-input" 
                value="${currentName}" 
                placeholder="輸入您的自訂名稱..."
                oninput="SettingsModule.saveUserName(true)"
                onblur="SettingsModule.saveUserName(true)"
                onkeydown="if(event.key==='Enter') { SettingsModule.saveUserName(false); this.blur(); }"
                class="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <button 
                onclick="SettingsModule.saveUserName(false)" 
                class="tap-scale px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 shrink-0"
              >
                儲存
              </button>
            </div>
          </div>
        </div>

        <!-- Appearance Section -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="moon" class="w-4 h-4 text-indigo-500"></i>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">外觀主題</h2>
          </div>

          <div class="grid grid-cols-3 gap-2 pt-1">
            <button onclick="SettingsModule.setTheme('system')" class="tap-scale flex flex-col items-center p-3 rounded-2xl border text-xs font-medium transition ${
              settings.theme === 'system' 
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }">
              <i data-lucide="smartphone" class="w-5 h-5 mb-1.5"></i>
              跟隨系統
            </button>
            <button onclick="SettingsModule.setTheme('light')" class="tap-scale flex flex-col items-center p-3 rounded-2xl border text-xs font-medium transition ${
              settings.theme === 'light' 
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }">
              <i data-lucide="sun" class="w-5 h-5 mb-1.5"></i>
              明亮模式
            </button>
            <button onclick="SettingsModule.setTheme('dark')" class="tap-scale flex flex-col items-center p-3 rounded-2xl border text-xs font-medium transition ${
              settings.theme === 'dark' 
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }">
              <i data-lucide="moon-star" class="w-5 h-5 mb-1.5"></i>
              深色模式
            </button>
          </div>
        </div>

        <!-- PWA Installation Guide -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="smartphone-nfc" class="w-4 h-4 text-violet-500"></i>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">手機主畫面安裝指引</h2>
          </div>

          <div class="space-y-3 text-xs">
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
                <span class="text-base">🍎</span>
                <span>iPhone (iOS Safari) 安裝方式：</span>
              </div>
              <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px] pl-6">
                1. 使用 Safari 開啟線上網址<br>
                2. 點擊瀏覽器底部正中間的「分享」按鈕（📤）<br>
                3. 滑動選單並點選「加入主畫面 (+ Add to Home Screen)」<br>
                4. 點擊右上角「新增」，桌面即可常駐 App 圖示！
              </p>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
                <span class="text-base">🤖</span>
                <span>Android (安卓 Chrome) 安裝方式：</span>
              </div>
              <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px] pl-6">
                1. 使用 Chrome 開啟線上網址<br>
                2. 點擊右上角「三個點選單 (⋮)」<br>
                3. 點選「安裝應用程式」或「加到主畫面」<br>
                4. 確認後即可在桌面全螢幕開啟！
              </p>
            </div>
          </div>
        </div>

        <!-- Reset Button Section at the Very Bottom -->
        <div class="pt-2">
          <button 
            onclick="SettingsModule.confirmReset()" 
            class="tap-scale w-full py-3.5 px-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center space-x-2 hover:bg-red-100/60 dark:hover:bg-red-950/50 transition shadow-sm"
          >
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
            <span>重置</span>
          </button>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2 leading-relaxed">
            重置將會清除本機所有相關檔案與自訂內容，回到最原始的狀態。
          </p>
        </div>
      </div>
    `;
  },

  saveUserName(silent = false) {
    const input = document.getElementById('nickname-input');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) {
      if (!silent) App.showToast('名稱不能為空', 'error');
      return;
    }
    const settings = StorageManager.get('settings', {});
    settings.userName = newName;
    StorageManager.set('settings', settings);
    App.updateHeader();
    if (!silent) App.showToast('名稱已更新！', 'success');
  },

  setTheme(theme) {
    const settings = StorageManager.get('settings', {});
    settings.theme = theme;
    StorageManager.set('settings', settings);
    App.applyTheme();
    App.render();
    App.showToast(`已切換主題：${theme === 'system' ? '跟隨系統' : theme === 'dark' ? '深色模式' : '明亮模式'}`, 'info');
  },

  confirmReset() {
    App.confirm({
      title: '確定要重置嗎？',
      message: '這將會刪除本機相關所有檔案與自訂設定，回到最原始的狀態！',
      confirmText: '確定重置',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: () => {
        StorageManager.clearAll();
        App.showToast('已重置為原始狀態', 'info');
        setTimeout(() => location.reload(), 400);
      }
    });
  }
};

window.SettingsModule = SettingsModule;
