/**
 * My App Storage Layer
 * Manages local persistence and user preferences
 */
const StorageManager = {
  PREFIX: 'myapp:',

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
      window.dispatchEvent(new CustomEvent('myapp:storage-updated', { detail: { key, value } }));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
    window.dispatchEvent(new CustomEvent('myapp:storage-updated', { detail: { key, value: null } }));
  },

  init() {
    let settings = this.get('settings');
    if (!settings) {
      settings = {
        theme: 'system',
        userName: 'default',
        createdAt: new Date().toISOString()
      };
      this.set('settings', settings);
    } else if (!settings.userName || settings.userName === 'Default Name' || settings.userName === 'Patrick') {
      settings.userName = 'default';
      this.set('settings', settings);
    }

    if (!this.get('installed_modules')) {
      this.set('installed_modules', []);
    }
  },

  // Clear all local application storage and restore to original default
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(this.PREFIX) || key.startsWith('patrickapp:') || key.startsWith('lifehub:'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.init();
    window.dispatchEvent(new CustomEvent('myapp:data-cleared'));
  }
};

window.StorageManager = StorageManager;
