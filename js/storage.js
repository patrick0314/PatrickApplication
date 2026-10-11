/**
 * LifeHub Storage Layer
 * Manages local persistence, default seed data, JSON export & import
 */
const StorageManager = {
  PREFIX: 'lifehub:',

  // Get item parsed from JSON
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(this.PREFIX + key);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`[StorageManager] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },

  // Set item as JSON
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('lifehub:storage-updated', { detail: { key, value } }));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write ${key}:`, e);
      return false;
    }
  },

  // Remove item
  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
    window.dispatchEvent(new CustomEvent('lifehub:storage-updated', { detail: { key, value: null } }));
  },

  // Initialize seed data on first run
  init() {
    // 1. Settings default
    if (!this.get('settings')) {
      this.set('settings', {
        theme: 'system',
        userName: 'Patrick',
        createdAt: new Date().toISOString()
      });
    }

    // 2. Tasks seed default
    if (!this.get('tasks')) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      this.set('tasks', [
        {
          id: 'task-1',
          title: '在手機瀏覽器點擊「加到主畫面」安裝 App',
          category: '生活',
          priority: 'high',
          dueDate: todayStr,
          completed: false,
          notes: 'iOS Safari 點分享 -> 加入主畫面；Android Chrome 點選單 -> 安裝應用程式。',
          createdAt: new Date().toISOString()
        },
        {
          id: 'task-2',
          title: '體驗新增、勾選與篩選待辦事項',
          category: '功能測試',
          priority: 'medium',
          dueDate: todayStr,
          completed: false,
          notes: '點擊右下角 + 號即可新增任務，支援優先級與分類標籤。',
          createdAt: new Date().toISOString()
        },
        {
          id: 'task-3',
          title: '向 AI 提出你想要的第一個擴充模組',
          category: '開發計畫',
          priority: 'high',
          dueDate: tomorrowStr,
          completed: false,
          notes: '例如：個人記帳、習慣追蹤、每日靈感速記、或是特定的專屬計算器！',
          createdAt: new Date().toISOString()
        }
      ]);
    }
  },

  // Export all application data as JSON file
  exportBackup() {
    const backup = {
      app: 'LifeHub',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.PREFIX)) {
        const cleanKey = key.replace(this.PREFIX, '');
        backup.data[cleanKey] = this.get(cleanKey);
      }
    }

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `lifehub-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Import JSON backup and restore
  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.data) {
        throw new Error('無效的備份檔案格式');
      }

      Object.entries(parsed.data).forEach(([key, value]) => {
        this.set(key, value);
      });

      return { success: true, count: Object.keys(parsed.data).length };
    } catch (e) {
      console.error('[StorageManager] Import failed:', e);
      return { success: false, error: e.message };
    }
  },

  // Clear all data
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.init(); // re-seed defaults
    window.dispatchEvent(new CustomEvent('lifehub:data-cleared'));
  }
};

window.StorageManager = StorageManager;
