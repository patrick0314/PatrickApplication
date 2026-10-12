/**
 * My App - Dashboard Module (Home Screen)
 * Clean Minimalist Home Screen with Favorites & Feature List
 * Supports long-press on feature cards to add/remove from favorites
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
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30',
      action: () => App.switchTab('werewolf')
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

  toggleFavorite(featureId) {
    let favs = this.getFavorites();
    const index = favs.indexOf(featureId);
    let isAdded = false;

    if (index >= 0) {
      favs.splice(index, 1);
      isAdded = false;
    } else {
      favs.push(featureId);
      isAdded = true;
    }

    StorageManager.set('favorites', favs);

    if ('vibrate' in navigator) {
      navigator.vibrate(isAdded ? [40, 30, 40] : 30);
    }

    const feat = this.features.find(f => f.id === featureId);
    const featName = feat ? feat.name : '功能';

    if (isAdded) {
      App.showToast(`已將「${featName}」加入我的最愛 ⭐`, 'success');
    } else {
      App.showToast(`已將「${featName}」從我的最愛移除`, 'info');
    }

    // Refresh view
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

  handlePointerDown(e, featureId) {
    // Only primary touch or left mouse button
    if (e.button !== undefined && e.button !== 0) return;

    this._isLongPressTriggered = false;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._activeCardId = featureId;

    if (this._pressTimer) clearTimeout(this._pressTimer);

    // Subtle press-down visual feedback
    const el = document.getElementById(`feature-card-${featureId}`);
    if (el) {
      el.classList.add('scale-[0.98]', 'opacity-90');
    }

    this._pressTimer = setTimeout(() => {
      this._isLongPressTriggered = true;
      this.cancelPressVisuals();
      this.toggleFavorite(featureId);
    }, 520);
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

  render() {
    const favorites = this.getFavorites();
    const favoriteFeatures = this.features.filter(f => favorites.includes(f.id));

    return `
      <div class="space-y-6 fade-in pb-16">
        <!-- 1. 我的最愛 (Favorites Section - Replaces former greeting) -->
        <div class="pt-2 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-500"></i>
              </div>
              <h2 class="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">我的最愛</h2>
            </div>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              ${favoriteFeatures.length > 0 ? `${favoriteFeatures.length} 個快捷項目` : '長按下方卡片新增'}
            </span>
          </div>

          ${favoriteFeatures.length === 0 ? `
            <!-- Empty Favorites State -->
            <div class="p-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center space-x-3.5 text-left">
              <div class="h-10 w-10 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center text-xl shrink-0 shadow-sm">
                ⭐
              </div>
              <div class="flex-1">
                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">尚未加入我的最愛</p>
                <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                  長按下方「功能列表」卡片，即可將常用功能加入此處快捷點擊！
                </p>
              </div>
            </div>
          ` : `
            <!-- Favorites Cards Grid -->
            <div class="grid grid-cols-1 gap-2.5">
              ${favoriteFeatures.map(feat => `
                <div 
                  onclick="DashboardModule.openFeature('${feat.id}')"
                  class="tap-scale group relative flex items-center justify-between p-3.5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-transparent dark:from-amber-500/15 dark:via-indigo-950/25 dark:to-transparent border border-amber-300/40 dark:border-amber-500/30 bg-white dark:bg-slate-800/90 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div class="flex items-center space-x-3">
                    <div class="h-11 w-11 rounded-2xl bg-gradient-to-tr ${feat.gradient} text-white flex items-center justify-center text-xl shadow-md ${feat.shadow}">
                      ${feat.emoji}
                    </div>
                    <div>
                      <div class="flex items-center space-x-1.5">
                        <h3 class="text-xs font-black text-slate-900 dark:text-white">${feat.name}</h3>
                        <span class="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40 flex items-center space-x-0.5">
                          <i data-lucide="zap" class="w-2.5 h-2.5"></i>
                          <span>快捷</span>
                        </span>
                      </div>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        ${feat.desc}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center space-x-1">
                    <button 
                      onclick="event.stopPropagation(); DashboardModule.toggleFavorite('${feat.id}')" 
                      class="tap-scale p-2 rounded-xl text-amber-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition" 
                      title="取消最愛"
                    >
                      <i data-lucide="star" class="w-4 h-4 fill-amber-400 text-amber-500"></i>
                    </button>
                    <div class="p-1 text-slate-400 group-hover:text-indigo-600 transition">
                      <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </div>
                  </div>
                </div>
              `).join('')}
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
            <span class="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1">
              <i data-lucide="sparkles" class="w-3 h-3 text-indigo-500"></i>
              <span>長按卡片加入我的最愛</span>
            </span>
          </div>

          <!-- Feature Cards Container -->
          <div id="feature-list" class="space-y-3">
            ${this.features.map(feat => {
              const isFav = favorites.includes(feat.id);
              return `
                <div 
                  id="feature-card-${feat.id}"
                  onpointerdown="DashboardModule.handlePointerDown(event, '${feat.id}')"
                  onpointermove="DashboardModule.handlePointerMove(event)"
                  onpointerup="DashboardModule.handlePointerUp(event, '${feat.id}')"
                  onpointercancel="DashboardModule.handlePointerCancel()"
                  onclick="DashboardModule.handleClick(event, '${feat.id}')"
                  oncontextmenu="event.preventDefault(); return false;"
                  class="tap-scale group relative flex items-center justify-between p-4.5 rounded-3xl bg-white dark:bg-slate-800/90 border ${
                    isFav 
                      ? 'border-amber-400/50 dark:border-amber-500/40 ring-1 ring-amber-400/20 shadow-amber-500/5' 
                      : 'border-slate-100 dark:border-slate-800'
                  } shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
                >
                  <div class="flex items-center space-x-3.5">
                    <div class="relative">
                      <div class="h-12 w-12 rounded-2xl bg-gradient-to-tr ${feat.gradient} text-white flex items-center justify-center text-2xl shadow-md ${feat.shadow}">
                        ${feat.emoji}
                      </div>
                      ${isFav ? `
                        <div class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center text-[10px] shadow-sm border-2 border-white dark:border-slate-800 font-bold" title="已加入我的最愛">
                          ★
                        </div>
                      ` : ''}
                    </div>
                    <div>
                      <div class="flex items-center space-x-2">
                        <h3 class="text-sm font-black text-slate-900 dark:text-white">${feat.name}</h3>
                        <span class="text-[9px] ${feat.badgeClass} font-bold px-1.5 py-0.5 rounded-full">
                          ${feat.category}
                        </span>
                        ${isFav ? `
                          <span class="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40">
                            已收藏
                          </span>
                        ` : ''}
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        ${feat.desc}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center space-x-1">
                    <div class="p-2 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-slate-700/50 transition">
                      <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  init() {}
};

window.DashboardModule = DashboardModule;
