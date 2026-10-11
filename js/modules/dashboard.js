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
    const installedModules = StorageManager.get('installed_modules', []);

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
              目前 ${installedModules.length} 個功能
            </span>
          </div>

          <!-- Feature Container -->
          <div id="feature-list" class="space-y-2.5">
            ${installedModules.length === 0 ? `
              <div class="py-16 text-center text-slate-400 dark:text-slate-600 text-xs">
                <i data-lucide="layers" class="w-8 h-8 mx-auto mb-2 opacity-30"></i>
                目前尚無功能，準備從零打造
              </div>
            ` : installedModules.map(mod => `
              <!-- Dynamic features will be plugged in here -->
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  init() {}
};

window.DashboardModule = DashboardModule;
