/**
 * Patrick's App - Settings & Data Management Module
 * Theme settings, JSON Backup/Restore, Mobile installation guide
 */
const SettingsModule = {
  id: 'settings',
  name: '設定',
  icon: 'settings',

  render() {
    const settings = StorageManager.get('settings', { theme: 'system', userName: 'Patrick' });

    return `
      <div class="space-y-5 fade-in pb-16">
        <!-- Header -->
        <div class="pt-2">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">系統設定</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">個人偏好設定、離線備份與手機安裝</p>
        </div>

        <!-- User Profile Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-600/30">
              ${(settings.userName || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-white">${settings.userName || 'Patrick'}</h2>
              <p class="text-xs text-slate-400">專屬個人工作站使用者</p>
            </div>
          </div>
          <button onclick="SettingsModule.editUserName()" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-3 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
            修改暱稱
          </button>
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

        <!-- Data Backup & Restore -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="hard-drive" class="w-4 h-4 text-emerald-500"></i>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">資料安全與離線備份</h2>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            所有資料均保存在您手機的本機空間，具備最高隱私性。未來新增功能後的數據皆可隨時在此下載完整備份。
          </p>

          <div class="space-y-2 pt-1">
            <button onclick="StorageManager.exportBackup(); App.showToast('備份檔案已下載！', 'success');" class="tap-scale w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div class="flex items-center space-x-2.5">
                <i data-lucide="download" class="w-4 h-4 text-emerald-500"></i>
                <span>匯出 JSON 備份檔到手機</span>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
            </button>

            <label class="tap-scale w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <div class="flex items-center space-x-2.5">
                <i data-lucide="upload" class="w-4 h-4 text-indigo-500"></i>
                <span>匯入 JSON 備份還原資料</span>
              </div>
              <input type="file" accept=".json" onchange="SettingsModule.handleImport(event)" class="hidden" />
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
            </label>

            <button onclick="SettingsModule.confirmClearData()" class="tap-scale w-full flex items-center justify-between p-3.5 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100/50">
              <div class="flex items-center space-x-2.5">
                <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                <span>重置所有本機資料</span>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-red-400"></i>
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
                4. 點擊右上角「新增」，桌面即可常駐 Patrick's App 圖示！
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

        <!-- About & Architecture Note -->
        <div class="p-4 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-center space-y-1">
          <p class="text-xs font-bold text-indigo-900 dark:text-indigo-200">Patrick's App v1.0.0</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            專屬個人的模組化微應用中心 · 準備從零擴充自訂模組
          </p>
        </div>
      </div>
    `;
  },

  setTheme(theme) {
    const settings = StorageManager.get('settings', {});
    settings.theme = theme;
    StorageManager.set('settings', settings);
    App.applyTheme();
    App.render();
    App.showToast(`已切換主題：${theme === 'system' ? '跟隨系統' : theme === 'dark' ? '深色模式' : '明亮模式'}`, 'info');
  },

  editUserName() {
    const settings = StorageManager.get('settings', {});
    const newName = prompt('請輸入您的暱稱：', settings.userName || 'Patrick');
    if (newName && newName.trim()) {
      settings.userName = newName.trim();
      StorageManager.set('settings', settings);
      App.showToast('暱稱已更新！', 'success');
      App.render();
    }
  },

  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = StorageManager.importBackup(e.target.result);
      if (result.success) {
        App.showToast(`成功還原 ${result.count} 項資料！`, 'success');
        setTimeout(() => location.reload(), 600);
      } else {
        alert('匯入失敗：' + result.error);
      }
    };
    reader.readAsText(file);
  },

  confirmClearData() {
    if (confirm('確定要清除所有本機資料並重置為預設狀態嗎？')) {
      StorageManager.clearAll();
      App.showToast('已重置所有本機資料', 'info');
      setTimeout(() => location.reload(), 500);
    }
  }
};

window.SettingsModule = SettingsModule;
