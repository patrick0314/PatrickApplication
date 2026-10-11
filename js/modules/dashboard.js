/**
 * My App - Dashboard Module (Home Screen)
 * Clean Minimalist Home Screen with Feature List
 */
const DashboardModule = {
  id: 'dashboard',
  name: '首頁',
  icon: 'layout-grid',

  render() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const currentName = settings.userName || 'default';

    // Dynamic greeting based on time of day
    const hour = new Date().getHours();
    let greeting = '早安';
    if (hour >= 11 && hour < 14) greeting = '午安';
    else if (hour >= 14 && hour < 18) greeting = '下午好';
    else if (hour >= 18 && hour < 23) greeting = '晚上好';
    else if (hour >= 23 || hour < 5) greeting = '夜深了，注意休息';

    return `
      <div class="space-y-6 fade-in pb-16">
        <!-- Top Greeting (Big Title) -->
        <div class="pt-2">
          <h1 class="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            ${greeting}，${currentName} 👋
          </h1>
        </div>

        <!-- 功能列表 (Feature List Section) -->
        <div class="space-y-3 pt-1">
          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center space-x-2">
              <i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
              <h2 class="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">功能列表</h2>
            </div>
            <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              目前 1 個功能
            </span>
          </div>

          <!-- Feature Cards Container -->
          <div id="feature-list" class="space-y-3">
            <!-- Feature 1: 一夜狼人殺 (多人連線) -->
            <div 
              onclick="App.switchTab('werewolf')" 
              class="tap-scale group relative flex items-center justify-between p-4.5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <div class="flex items-center space-x-3.5">
                <div class="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-950 via-indigo-900 to-violet-900 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-900/30">
                  🐺
                </div>
                <div>
                  <div class="flex items-center space-x-2">
                    <h3 class="text-sm font-black text-slate-900 dark:text-white">一夜狼人殺</h3>
                    <span class="text-[9px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-900/30">
                      多人連線
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    跨手機即時房間連線 · 支援 3~10 人
                  </p>
                </div>
              </div>

              <div class="p-2 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-slate-700/50 transition">
                <i data-lucide="chevron-right" class="w-5 h-5"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {}
};

window.DashboardModule = DashboardModule;
