/**
 * LifeHub - Tasks Module
 * Full mobile task management with filtering, categorization, priority, and search
 */
const TasksModule = {
  id: 'tasks',
  name: '事項',
  icon: 'check-square',

  state: {
    statusFilter: 'all', // 'all', 'pending', 'completed'
    categoryFilter: 'all',
    searchQuery: '',
    editingTaskId: null
  },

  getPendingCount() {
    const tasks = StorageManager.get('tasks', []);
    return tasks.filter(t => !t.completed).length;
  },

  render() {
    const tasks = StorageManager.get('tasks', []);
    const categories = ['all', ...new Set(tasks.map(t => t.category || '生活'))];

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
      // Status filter
      if (this.state.statusFilter === 'pending' && task.completed) return false;
      if (this.state.statusFilter === 'completed' && !task.completed) return false;

      // Category filter
      if (this.state.categoryFilter !== 'all' && task.category !== this.state.categoryFilter) return false;

      // Search query
      if (this.state.searchQuery.trim() !== '') {
        const query = this.state.searchQuery.toLowerCase();
        const matchTitle = (task.title || '').toLowerCase().includes(query);
        const matchNotes = (task.notes || '').toLowerCase().includes(query);
        const matchCategory = (task.category || '').toLowerCase().includes(query);
        if (!matchTitle && !matchNotes && !matchCategory) return false;
      }

      return true;
    });

    return `
      <div class="space-y-4 fade-in pb-20">
        <!-- Header & Action -->
        <div class="flex items-center justify-between pt-2">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">待辦事項</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              共 ${tasks.length} 項 · 剩餘 ${this.getPendingCount()} 項未完成
            </p>
          </div>
          <button onclick="App.openNewTaskModal()" class="tap-scale flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-md shadow-indigo-600/25">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>新增</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-3 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="搜尋事項或備註..." 
            value="${this.state.searchQuery}"
            oninput="TasksModule.handleSearch(this.value)"
            class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition"
          />
          ${this.state.searchQuery ? `
            <button onclick="TasksModule.handleSearch('')" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          ` : ''}
        </div>

        <!-- Status Filter Tabs -->
        <div class="flex p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
          <button onclick="TasksModule.setStatusFilter('all')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            this.state.statusFilter === 'all' 
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400'
          }">
            全部 (${tasks.length})
          </button>
          <button onclick="TasksModule.setStatusFilter('pending')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            this.state.statusFilter === 'pending' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-600 dark:text-slate-400'
          }">
            進行中 (${tasks.filter(t => !t.completed).length})
          </button>
          <button onclick="TasksModule.setStatusFilter('completed')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            this.state.statusFilter === 'completed' 
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
              : 'text-slate-600 dark:text-slate-400'
          }">
            已完成 (${tasks.filter(t => t.completed).length})
          </button>
        </div>

        <!-- Category Pills (Horizontal scrollable) -->
        <div class="flex space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          ${categories.map(cat => `
            <button onclick="TasksModule.setCategoryFilter('${cat}')" class="tap-scale shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              this.state.categoryFilter === cat
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }">
              ${cat === 'all' ? '全部分類' : cat}
            </button>
          `).join('')}
        </div>

        <!-- Task List -->
        <div class="space-y-2.5">
          ${filteredTasks.length === 0 ? `
            <div class="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              <i data-lucide="clipboard-list" class="w-10 h-10 mx-auto mb-2.5 text-slate-300 dark:text-slate-600"></i>
              目前沒有符合條件的事項
              <div class="mt-3">
                <button onclick="App.openNewTaskModal()" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  立即新增一筆
                </button>
              </div>
            </div>
          ` : filteredTasks.map(task => {
            const isHigh = task.priority === 'high';
            const isMedium = task.priority === 'medium';
            const priorityBadge = isHigh 
              ? '<span class="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded">高優先</span>' 
              : isMedium 
              ? '<span class="text-[10px] font-semibold text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded">中優先</span>' 
              : '';

            return `
              <div class="tap-scale group relative flex items-start justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 shadow-sm transition-all">
                <div class="flex items-start space-x-3 flex-1 min-w-0">
                  <button onclick="TasksModule.toggleTask('${task.id}')" class="mt-0.5 h-5 w-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    task.completed 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                  }">
                    ${task.completed ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                  </button>

                  <div class="flex-1 min-w-0" onclick="TasksModule.openEditModal('${task.id}')">
                    <p class="text-xs font-semibold text-slate-900 dark:text-white leading-snug break-words ${
                      task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                    }">
                      ${task.title}
                    </p>

                    ${task.notes ? `
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        ${task.notes}
                      </p>
                    ` : ''}

                    <div class="flex items-center space-x-2 mt-2">
                      <span class="text-[10px] bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                        ${task.category || '生活'}
                      </span>
                      ${priorityBadge}
                      ${task.dueDate ? `
                        <span class="text-[10px] text-slate-400 flex items-center">
                          <i data-lucide="calendar" class="w-3 h-3 mr-1"></i>
                          ${task.dueDate}
                        </span>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <!-- Right Action Buttons -->
                <div class="flex items-center space-x-1 pl-2 shrink-0">
                  <button onclick="TasksModule.openEditModal('${task.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button onclick="TasksModule.deleteTask('${task.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  setStatusFilter(status) {
    this.state.statusFilter = status;
    App.render();
  },

  setCategoryFilter(category) {
    this.state.categoryFilter = category;
    App.render();
  },

  handleSearch(query) {
    this.state.searchQuery = query;
    App.render();
  },

  toggleTask(id) {
    const tasks = StorageManager.get('tasks', []);
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      StorageManager.set('tasks', tasks);
      
      // Haptic feedback if available on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(25);
      }

      if (task.completed) {
        App.showToast('已完成事項 🎉', 'success');
      }
      App.render();
    }
  },

  deleteTask(id) {
    if (confirm('確定要刪除此事項嗎？')) {
      let tasks = StorageManager.get('tasks', []);
      tasks = tasks.filter(t => t.id !== id);
      StorageManager.set('tasks', tasks);
      App.showToast('事項已刪除', 'info');
      App.render();
    }
  },

  openEditModal(id) {
    const tasks = StorageManager.get('tasks', []);
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    this.state.editingTaskId = id;
    App.openTaskModal(task);
  },

  saveTask(taskData) {
    const tasks = StorageManager.get('tasks', []);
    if (taskData.id) {
      // Edit existing
      const index = tasks.findIndex(t => t.id === taskData.id);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...taskData, updatedAt: new Date().toISOString() };
        App.showToast('事項已更新', 'success');
      }
    } else {
      // Add new
      const newTask = {
        id: 'task-' + Date.now(),
        title: taskData.title,
        category: taskData.category || '生活',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || '',
        notes: taskData.notes || '',
        completed: false,
        createdAt: new Date().toISOString()
      };
      tasks.unshift(newTask);
      App.showToast('新增事項成功！', 'success');
    }
    StorageManager.set('tasks', tasks);
    App.closeModal();
    App.render();
  }
};

window.TasksModule = TasksModule;
