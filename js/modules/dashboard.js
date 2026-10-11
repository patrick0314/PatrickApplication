/**
 * Patrick's App - Dashboard Module (Home Screen)
 * Modern Modular Dashboard - Clean canvas ready for building from scratch
 */
const DashboardModule = {
  id: 'dashboard',
  name: '首頁',
  icon: 'layout-grid',

  render() {
    const settings = StorageManager.get('settings', { userName: 'Patrick' });
    const installedModules = StorageManager.get('installed_modules', []);

    // Greeting based on current time
    const hour = new Date().getHours();
    let greeting = '早安';
    if (hour >= 11 && hour < 14) greeting = '午安';
    else if (hour >= 14 && hour < 18) greeting = '下午好';
    else if (hour >= 18 && hour < 23) greeting = '晚上好';
    else if (hour >= 23 || hour < 5) greeting = '夜深了，注意休息';

    // Localized date
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = new Date().toLocaleDateString('zh-TW', dateOptions);

    return `
      <div class="space-y-5 fade-in pb-16">
        <!-- Top Greeting Header -->
        <div class="flex items-center justify-between pt-2">
          <div>
            <p class="text-[11px] font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">${dateStr}</p>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              ${greeting}，${settings.userName || 'Patrick'} 👋
            </h1>
          </div>
          <div class="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 font-black text-base">
            ${(settings.userName || 'P').charAt(0).toUpperCase()}
          </div>
        </div>

        <!-- Hero Canvas Banner Card -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-800 via-indigo-700 to-slate-900 p-6 text-white shadow-xl shadow-indigo-700/25">
          <div class="relative z-10">
            <div class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-indigo-100 mb-3 border border-white/10">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>純淨畫布 · 就緒完畢</span>
            </div>

            <h2 class="text-xl font-black tracking-tight leading-snug">
              專屬個人的掌上應用中心
            </h2>
            <p class="text-xs text-indigo-200 mt-2 leading-relaxed opacity-90">
              所有預設示範功能已全數移除。現在這是一個完全空白且結構完備的起點，您可以隨時告訴我您想實現的第一個自訂功能！
            </p>

            <div class="mt-5 flex items-center space-x-3 text-[11px]">
              <div class="flex items-center space-x-1.5 text-indigo-200">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
                <span>100% 離線私密</span>
              </div>
              <div class="flex items-center space-x-1.5 text-indigo-200">
                <i data-lucide="wifi-off" class="w-4 h-4 text-indigo-300"></i>
                <span>無網亦可開啟</span>
              </div>
            </div>
          </div>

          <!-- Decorative Ambient Shapes -->
          <div class="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl"></div>
          <div class="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-400/20 blur-xl"></div>
        </div>

        <!-- Quick System Tools -->
        <div class="grid grid-cols-2 gap-3">
          <button onclick="StorageManager.exportBackup(); App.showToast('備份已下載到手機', 'success');" class="tap-scale flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm text-left">
            <div class="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <i data-lucide="download" class="w-5 h-5"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-slate-900 dark:text-white">資料備份</p>
              <p class="text-[10px] text-slate-400">匯出 JSON 檔</p>
            </div>
          </button>

          <button onclick="App.switchTab('settings')" class="tap-scale flex items-center space-x-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm text-left">
            <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <i data-lucide="settings" class="w-5 h-5"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-slate-900 dark:text-white">偏好設定</p>
              <p class="text-[10px] text-slate-400">主題與手機安裝</p>
            </div>
          </button>
        </div>

        <!-- Modular App Expansion Area -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">功能模組專區</h2>
            </div>
            <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              目前 ${installedModules.length} 個模組
            </span>
          </div>

          <!-- Slot Placeholder / Inspiration Card -->
          <div class="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-3 bg-white/50 dark:bg-slate-900/40">
            <div class="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <i data-lucide="plus" class="w-6 h-6 stroke-[2.5]"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">從零開始打造您的專屬功能</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
                請隨時在對話中告訴我您想做的第一個功能。每個功能都會直接變成此處的獨立卡片與專屬分頁！
              </p>
            </div>

            <!-- Inspiration Tags -->
            <div class="pt-2 flex flex-wrap justify-center gap-2">
              <span class="inline-flex items-center text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                🎮 多人連線小遊戲
              </span>
              <span class="inline-flex items-center text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl">
                💰 個人收支記帳
              </span>
              <span class="inline-flex items-center text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl">
                🎯 每日打卡習慣
              </span>
              <span class="inline-flex items-center text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl">
                📝 隨手靈感速記
              </span>
              <span class="inline-flex items-center text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl">
                ⏱️ 專注計時番茄鐘
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {}
};

window.DashboardModule = DashboardModule;
