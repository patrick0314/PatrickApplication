/**
 * Patrick's App Storage Layer
 * Manages local persistence and user settings
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
    let settings = this.get('settings');
    if (!settings) {
      settings = {
        theme: 'system',
        userName: 'Default Name',
        createdAt: new Date().toISOString()
      };
      this.set('settings', settings);
    } else if (!settings.userName || settings.userName === 'Patrick') {
      // Migrate initial test name to Default Name
      settings.userName = 'Default Name';
      this.set('settings', settings);
    }

    if (!this.get('installed_modules')) {
      this.set('installed_modules', []);
    }
  }
};

window.StorageManager = StorageManager;
