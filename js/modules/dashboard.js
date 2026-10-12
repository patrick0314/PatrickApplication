/**
 * My App - Dashboard Module (Home Screen)
 * Clean Minimalist Home Screen with Favorites & Feature List
 * Aligns Favorites and Feature List display identically
 * Long-press on Feature List to add; long-press on Favorites to remove
 */
const DashboardModule = {
  id: 'dashboard',
  name: '首頁',
  icon: 'layout-grid',

  // Available features registry
  features: [
    {
      id: 'werewolf',
      name: '一夜狼人殺',
      category: '多人連線',
      emoji: '🐺',
      desc: '跨手機即時房間連線 · 支援 3~10 人',
      gradient: 'from-indigo-950 via-indigo-900 to-violet-900',
      shadow: 'shadow-indigo-900/30',
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30',
      action: () => App.switchTab('werewolf')
    },
    {
      id: 'codenames',
      name: '機密代號',
      category: '多人連線',
      emoji: '🕵️',
      desc: '紅藍陣營特務對決 · 支援 2~8+ 人',
      gradient: 'from-slate-900 via-rose-950 to-blue-950',
      shadow: 'shadow-blue-950/30',
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30',
      action: () => App.switchTab('codenames')
    }
  ],

  // Long-press detection state
  _pressTimer: null,
  _isLongPressTriggered: false,
  _startX: 0,
  _startY: 0,
  _activeCardId: null,

  getFavorites() {
    return StorageManager.get('favorites', []);
  },

  addToFavorite(featureId) {
    let favs = this.getFavorites();
    if (!favs.includes(featureId)) {
      favs.push(featureId);
      StorageManager.set('favorites', favs);
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([40, 30, 40]);
    }

    const feat = this.features.find(f => f.id === featureId);
    const featName = feat ? feat.name : '功能';
    App.showToast(`已將「${featName}」加入我的最愛 ⭐`, 'success');

    App.render();
  },

  removeFromFavorite(featureId) {
    let favs = this.getFavorites();
    favs = favs.filter(id => id !== featureId);
    StorageManager.set('favorites', favs);

    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }

    const feat = this.features.find(f => f.id === featureId);
    const featName = feat ? feat.name : '功能';
    App.showToast(`已將「${featName}」從我的最愛移除`, 'info');

    App.render();
  },

  openFeature(featureId) {
    const feat = this.features.find(f => f.id === featureId);
    if (feat && feat.action) {
      feat.action();
    } else {
      App.switchTab(featureId);
    }
  },

  handlePointerDown(e, featureId, source) {
    // Only primary touch or left mouse button
    if (e.button !== undefined && e.button !== 0) return;

    this._isLongPressTriggered = false;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._activeCardId = `${source}-${featureId}`;

    if (this._pressTimer) clearTimeout(this._pressTimer);

    const el = document.getElementById(`feature-card-${source}-${featureId}`);
    if (el) {
      el.classList.add('scale-[0.98]', 'opacity-90');
    }

    this._pressTimer = setTimeout(() => {
      this._isLongPressTriggered = true;
      this.cancelPressVisuals();
      if (source === 'favorite') {
        this.removeFromFavorite(featureId);
      } else {
        this.addToFavorite(featureId);
      }
    }, 500);
  },

  handlePointerMove(e) {
    if (!this._pressTimer) return;
    const dx = Math.abs(e.clientX - this._startX);
    const dy = Math.abs(e.clientY - this._startY);
    // If finger moves more than 10px (e.g. scroll gesture), cancel long-press
    if (dx > 10 || dy > 10) {
      this.cancelPress();
    }
  },

  handlePointerUp(e, featureId) {
    this.cancelPress();
  },

  handlePointerCancel() {
    this.cancelPress();
  },

  handleClick(e, featureId) {
    if (this._isLongPressTriggered) {
      // Suppress normal click navigation after a successful long-press
      e.preventDefault();
      e.stopPropagation();
      this._isLongPressTriggered = false;
      return;
    }
    this.openFeature(featureId);
  },

  cancelPressVisuals() {
    if (this._activeCardId) {
      const el = document.getElementById(`feature-card-${this._activeCardId}`);
      if (el) {
        el.classList.remove('scale-[0.98]', 'opacity-90');
      }
    }
  },

  cancelPress() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
    this.cancelPressVisuals();
    this._activeCardId = null;
  },

  renderFeatureCard(feat, source) {
    return `
      <div 
        id="feature-card-${source}-${feat.id}"
        onpointerdown="DashboardModule.handlePointerDown(event, '${feat.id}', '${source}')"
        onpointermove="DashboardModule.handlePointerMove(event)"
        onpointerup="DashboardModule.handlePointerUp(event, '${feat.id}')"
        onpointercancel="DashboardModule.handlePointerCancel()"
        onclick="DashboardModule.handleClick(event, '${feat.id}')"
        oncontextmenu="event.preventDefault(); return false;"
        class="tap-scale group relative flex items-center justify-between p-4.5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
      >
        <div class="flex items-center space-x-3.5">
          <div class="h-12 w-12 rounded-2xl bg-gradient-to-tr ${feat.gradient} text-white flex items-center justify-center text-2xl shadow-md ${feat.shadow}">
            ${feat.emoji}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h3 class="text-sm font-black text-slate-900 dark:text-white">${feat.name}</h3>
              <span class="text-[9px] ${feat.badgeClass} font-bold px-1.5 py-0.5 rounded-full">
                ${feat.category}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ${feat.desc}
            </p>
          </div>
        </div>

        <div class="p-2 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-slate-700/50 transition">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </div>
      </div>
    `;
  },

  render() {
    const favorites = this.getFavorites();
    const favoriteFeatures = this.features.filter(f => favorites.includes(f.id));

    return `
      <div class="space-y-6 fade-in pb-16">
        <!-- 1. 我的最愛 (Favorites Section) -->
        <div class="pt-2 space-y-3">
          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center space-x-2">
              <i data-lucide="star" class="w-4 h-4 text-amber-500"></i>
              <h2 class="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">我的最愛</h2>
            </div>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              長按卡片取消最愛
            </span>
          </div>

          ${favoriteFeatures.length === 0 ? `
            <!-- Empty Favorites State -->
            <div class="p-4.5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center space-x-3.5 text-left">
              <div class="h-12 w-12 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                ⭐
              </div>
              <div class="flex-1">
                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">尚未加入我的最愛</p>
                <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                  長按下方「功能列表」卡片即可新增，長按最愛卡片即可取消。
                </p>
              </div>
            </div>
          ` : `
            <!-- Favorites Cards Container (Exactly aligned with Feature List) -->
            <div class="space-y-3">
              ${favoriteFeatures.map(feat => this.renderFeatureCard(feat, 'favorite')).join('')}
            </div>
          `}
        </div>

        <!-- 2. 功能列表 (Feature List Section) -->
        <div class="space-y-3 pt-1">
          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center space-x-2">
              <i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
              <h2 class="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">功能列表</h2>
            </div>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              長按卡片加入我的最愛
            </span>
          </div>

          <!-- Feature Cards Container -->
          <div id="feature-list" class="space-y-3">
            ${this.features.map(feat => this.renderFeatureCard(feat, 'list')).join('')}
          </div>
        </div>
      </div>
    `;
  },

  init() {}
};

window.DashboardModule = DashboardModule;
