/**
 * Patrick's App - Dashboard Module (Home Screen)
 * Modern Modular Dashboard - Clean canvas ready for custom modules
 */
const DashboardModule = {
  id: 'dashboard',
  name: '首頁',
  icon: 'layout-grid',

  render() {
    const settings = StorageManager.get('settings', { userName: 'Default Name' });
    const currentName = settings.userName || 'Default Name';
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
        <!-- Top Greeting Header (Clean, No Avatar) -->
        <div class="pt-2">
          <p class="text-[11px] font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">${dateStr}</p>
          <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
            ${greeting}，${currentName} 👋
          </h1>
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
              這是一個完全由您掌控的個人 App。目前環境已全數清理完畢，您可以隨時告訴我您想實現的第一個自訂功能！
            </p>

            <div class="mt-5 flex items-center space-x-3 text-[11px]">
              <div class="flex items-center space-x-1.5 text-indigo-200">
                <i data-lucide="sparkles" class="w-4 h-4 text-amber-300"></i>
                <span>模組化架構就緒</span>
              </div>
              <div class="flex items-center space-x-1.5 text-indigo-200">
                <i data-lucide="smartphone" class="w-4 h-4 text-emerald-300"></i>
                <span>已適配手機操作</span>
              </div>
            </div>
          </div>

          <!-- Decorative Ambient Shapes -->
          <div class="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl"></div>
          <div class="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-400/20 blur-xl"></div>
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

          <!-- Slot Placeholder Card -->
          <div class="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-3 bg-white/50 dark:bg-slate-900/40">
            <div class="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <i data-lucide="plus" class="w-6 h-6 stroke-[2.5]"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">從零開始打造您的第一個功能</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
                請隨時在對話中告訴我您想做的功能，每個功能都會直接變成此處的獨立卡片與專屬分頁！
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
