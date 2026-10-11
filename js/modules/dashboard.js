/**
 * LifeHub - Dashboard Module
 * Shows daily greeting, task summary, quick actions, and expansion showcase
 */
const DashboardModule = {
  id: 'dashboard',
  name: '總覽',
  icon: 'layout-dashboard',

  render() {
    const settings = StorageManager.get('settings', { userName: 'Patrick' });
    const tasks = StorageManager.get('tasks', []);
    
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.completed).length;
    const pendingCount = totalCount - completedCount;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Greeting based on time
    const hour = new Date().getHours();
    let greeting = '早安';
    if (hour >= 11 && hour < 14) greeting = '午安';
    else if (hour >= 14 && hour < 18) greeting = '下午好';
    else if (hour >= 18 && hour < 23) greeting = '晚上好';
    else if (hour >= 23 || hour < 5) greeting = '夜深了，注意休息';

    // Localized date
    const dateOptions = { month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = new Date().toLocaleDateString('zh-TW', dateOptions);

    // Filter top 3 pending tasks
    const topPendingTasks = tasks.filter(t => !t.completed).slice(0, 3);

    return `
      <div class="space-y-5 fade-in pb-8">
        <!-- Top Greeting Header -->
        <div class="flex items-center justify-between pt-2">
          <div>
            <p class="text-xs font-medium tracking-wide text-indigo-600 dark:text-indigo-400 uppercase">${dateStr}</p>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              ${greeting}，${settings.userName || 'Patrick'} 👋
            </h1>
          </div>
          <div class="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 font-bold text-sm">
            ${(settings.userName || 'P').charAt(0).toUpperCase()}
          </div>
        </div>

        <!-- Daily Overview Card -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-5 text-white shadow-xl shadow-indigo-600/20">
          <div class="relative z-10">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-indigo-200">今日完成度</span>
              <span class="text-xs bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full font-medium">
                ${completedCount} / ${totalCount} 項
              </span>
            </div>
            
            <div class="mt-3 flex items-baseline space-x-2">
              <span class="text-4xl font-black">${progressPercent}%</span>
              <span class="text-xs text-indigo-200">
                ${pendingCount === 0 && totalCount > 0 ? '🎉 今日事項全數完成！' : `還有 ${pendingCount} 項待辦事項`}
              </span>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/20">
              <div class="h-full bg-white transition-all duration-500 ease-out rounded-full" style="width: ${progressPercent}%"></div>
            </div>
          </div>

          <!-- Subtle Background Decoration -->
          <div class="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
          <div class="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-indigo-400/20 blur-lg"></div>
        </div>

        <!-- Quick Action Shortcuts -->
        <div class="grid grid-cols-3 gap-3">
          <button onclick="App.openNewTaskModal()" class="tap-scale flex flex-col items-center justify-center rounded-xl bg-white dark:bg-slate-800/80 p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
            <div class="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5">
              <i data-lucide="plus" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-medium">新增事項</span>
          </button>

          <button onclick="StorageManager.exportBackup(); App.showToast('備份已下載', 'success');" class="tap-scale flex flex-col items-center justify-center rounded-xl bg-white dark:bg-slate-800/80 p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
            <div class="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
              <i data-lucide="download" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-medium">匯出備份</span>
          </button>

          <button onclick="App.switchTab('settings')" class="tap-scale flex flex-col items-center justify-center rounded-xl bg-white dark:bg-slate-800/80 p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
            <div class="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
              <i data-lucide="sliders-horizontal" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-medium">系統設定</span>
          </button>
        </div>

        <!-- Priority Tasks Section -->
        <div class="rounded-2xl bg-white dark:bg-slate-800/80 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
              <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
              <h2 class="font-bold text-sm text-slate-900 dark:text-white">待辦焦點</h2>
            </div>
            <button onclick="App.switchTab('tasks')" class="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center">
              查看全部 <i data-lucide="chevron-right" class="w-3.5 h-3.5 ml-0.5"></i>
            </button>
          </div>

          ${topPendingTasks.length === 0 ? `
            <div class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
              <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80"></i>
              太棒了！目前沒有未完成的焦點事項
            </div>
          ` : `
            <div class="space-y-2.5">
              ${topPendingTasks.map(task => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <button onclick="TasksModule.toggleTask('${task.id}')" class="h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center tap-scale">
                      ${task.completed ? '<i data-lucide="check" class="w-3.5 h-3.5 text-indigo-600"></i>' : ''}
                    </button>
                    <span class="text-xs font-medium text-slate-800 dark:text-slate-200 truncate ${task.completed ? 'line-through text-slate-400' : ''}">
                      ${task.title}
                    </span>
                  </div>
                  <span class="ml-2 text-[10px] px-2 py-0.5 rounded font-medium ${
                    task.priority === 'high' ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' :
                    task.priority === 'medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }">
                    ${task.category || '生活'}
                  </span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Modular App Expansion Banner -->
        <div class="rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
          <div class="flex items-start space-x-3">
            <div class="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="blocks" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white">專屬個人的模組化架構</h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                本 App 採用獨立分頁模組設計。後續您只要在對話中告訴我任何新功能需求，我們就能為您直接掛載新的專屬功能模組！
              </p>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <span class="inline-flex items-center text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  💰 個人記帳
                </span>
                <span class="inline-flex items-center text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  🎯 習慣打卡
                </span>
                <span class="inline-flex items-center text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  📝 隨手筆記
                </span>
                <span class="inline-flex items-center text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  ⏱️ 專注番茄鐘
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    // any module-specific listeners if needed
  }
};

window.DashboardModule = DashboardModule;
