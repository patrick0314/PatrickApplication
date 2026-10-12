/**
 * My App Storage Layer
 * Manages local persistence and user preferences
 */
const StorageManager = {
  PREFIX: 'myapp:',

  // Cookie helpers to ensure settings persist even across mobile PWA background task purges
  getCookie(name) {
    try {
      const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
      return match ? decodeURIComponent(match[3]) : null;
    } catch (e) {
      return null;
    }
  },

  setCookie(name, value, days = 3650) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    } catch (e) {}
  },

  get(key, defaultValue = null) {
    try {
      let data = localStorage.getItem(this.PREFIX + key);
      // Fallback to cookie if localStorage had a glitch or was purged on mobile
      if (data === null && key === 'settings') {
        const cookieData = this.getCookie('myapp_settings');
        if (cookieData) {
          data = cookieData;
          try { localStorage.setItem(this.PREFIX + key, data); } catch (e) {}
        }
      }
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`[StorageManager] Failed to read ${key}:`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      const str = JSON.stringify(value);
      localStorage.setItem(this.PREFIX + key, str);
      if (key === 'settings') {
        this.setCookie('myapp_settings', str);
      }
      window.dispatchEvent(new CustomEvent('myapp:storage-updated', { detail: { key, value } }));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
    if (key === 'settings') {
      this.setCookie('myapp_settings', '', -1);
    }
    window.dispatchEvent(new CustomEvent('myapp:storage-updated', { detail: { key, value: null } }));
  },

  init() {
    // Request persistent storage if supported (prevents Android OS from evicting PWA data)
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    let settings = this.get('settings');
    if (!settings) {
      settings = {
        theme: 'system',
        userName: 'default',
        createdAt: new Date().toISOString()
      };
      this.set('settings', settings);
    } else {
      // Ensure required properties exist without overwriting user's chosen userName
      let modified = false;
      if (!settings.userName) {
        settings.userName = 'default';
        modified = true;
      }
      if (!settings.theme) {
        settings.theme = 'system';
        modified = true;
      }
      if (modified) {
        this.set('settings', settings);
      }
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
    this.setCookie('myapp_settings', '', -1);
    this.init();
    window.dispatchEvent(new CustomEvent('myapp:data-cleared'));
  }
};

window.StorageManager = StorageManager;
