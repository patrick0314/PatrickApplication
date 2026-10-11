/**
 * Patrick's App Storage Layer
 * Manages local persistence, clean seed data, JSON export & import
 */
const StorageManager = {
  PREFIX: 'patrickapp:',

  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(this.PREFIX + key);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`[StorageManager] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('patrickapp:storage-updated', { detail: { key, value } }));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
    window.dispatchEvent(new CustomEvent('patrickapp:storage-updated', { detail: { key, value: null } }));
  },

  init() {
    // 1. Settings default
    if (!this.get('settings')) {
      this.set('settings', {
        theme: 'system',
        userName: 'Patrick',
        createdAt: new Date().toISOString()
      });
    }

    // 2. Installed modules list (Empty clean canvas ready for user's customized features)
    if (!this.get('installed_modules')) {
      this.set('installed_modules', []);
    }
  },

  exportBackup() {
    const backup = {
      app: "Patrick's App",
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
    a.download = `patricks-app-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

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

  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(this.PREFIX) || key.startsWith('lifehub:'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.init();
    window.dispatchEvent(new CustomEvent('patrickapp:data-cleared'));
  }
};

window.StorageManager = StorageManager;
