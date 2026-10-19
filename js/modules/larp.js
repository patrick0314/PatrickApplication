/**
 * My App - LARP Module (劇本殺探案紀錄與社群評價)
 * Supports multi-dimensional filtering, instant search, detailed view with lightbox,
 * owner perspective review, and community/friends review wall with client-side photo compression.
 */
const LarpModule = {
  id: 'larp',
  name: '劇本殺紀錄',
  icon: 'book-open',

  STORAGE_KEY: 'larp_scripts_v1',
  ADMIN_KEY: 'larp_is_admin',
  ADMIN_PASS_KEY: 'larp_admin_passcode',

  // Supabase Cloud Database Configuration
  SUPABASE_CONFIG: {
    url: 'https://ywzjqvgrxdmguasoxwud.supabase.co',
    key: 'sb_publishable_NROjEKjPXTWEJlTdhS82uA_yBYaIQeg'
  },

  // Permission checks (特定權限驗證)
  isAdmin() {
    return StorageManager.get(this.ADMIN_KEY, false) === true;
  },

  getAdminPasscode() {
    return StorageManager.get(this.ADMIN_PASS_KEY, '1314');
  },

  setAdminStatus(status) {
    StorageManager.set(this.ADMIN_KEY, !!status);
  },

  async verifyAdminOrPrompt(onSuccess) {
    if (this.isAdmin()) {
      if (onSuccess) onSuccess();
      return true;
    }

    const input = await App.prompt({
      title: '🔒 管理員權限驗證',
      placeholder: '請輸入管理員解鎖金鑰',
      confirmText: '解鎖驗證',
      cancelText: '取消'
    });

    if (!input) return false;

    if (input.trim() === this.getAdminPasscode()) {
      this.setAdminStatus(true);
      App.showToast('👑 管理員權限已解鎖！', 'success');
      this.renderView();
      if (onSuccess) onSuccess();
      return true;
    } else {
      App.showToast('密碼錯誤，權限不足', 'error');
      return false;
    }
  },

  toggleAdminLock() {
    if (this.isAdmin()) {
      App.confirm({
        title: '👑 管理員權限設定',
        message: '您可以選擇鎖定權限切換回訪客模式，或自訂變更管理密碼。',
        confirmText: '鎖定權限',
        cancelText: '修改密碼',
        isDestructive: false,
        onConfirm: () => {
          this.setAdminStatus(false);
          this.renderView();
          App.showToast('已鎖定管理權限', 'info');
        },
        onCancel: async () => {
          const newPass = await App.prompt({
            title: '🔑 設定新的管理密碼',
            placeholder: '請輸入至少 4 碼新密碼',
            confirmText: '儲存密碼',
            cancelText: '取消'
          });
          if (newPass && newPass.trim().length >= 4) {
            StorageManager.set(this.ADMIN_PASS_KEY, newPass.trim());
            App.showToast('✅ 管理密碼已成功更新！', 'success');
          } else if (newPass) {
            App.showToast('密碼長度至少需 4 碼', 'warning');
          }
        }
      });
    } else {
      this.verifyAdminOrPrompt();
    }
  },

  handleClickCreateScript() {
    if (this.isAdmin()) {
      this.switchView('create');
    } else {
      this.verifyAdminOrPrompt(() => {
        this.switchView('create');
      });
    }
  },

  editScript(scriptId) {
    if (this.isAdmin()) {
      this.switchView('edit', scriptId);
    } else {
      this.verifyAdminOrPrompt(() => {
        this.switchView('edit', scriptId);
      });
    }
  },

  AVAILABLE_TYPES: ['硬核', '情感', '還原', '歡樂', '陣營', '恐怖', '機制', '微恐', '立意', '沉浸'],
  DEMO_SCRIPT_IDS: ['script-1', 'script-2', 'script-3', 'script-4', 'larp-001', 'larp-002', 'larp-003', 'larp-004'],

  state: {
    currentView: 'list', // 'list' | 'detail' | 'create'
    selectedScriptId: null,
    searchQuery: '',
    filterStatus: 'all', // 'all' | 'played' | 'unplayed'
    filterGenre: 'all',
    filterTypes: [], // multi-select filter array (empty = all)
    filterPlayers: 'all',
    sortBy: 'rating', // 'rating' | 'newest' | 'players'
    scripts: [],
    lightboxImage: null,
    revealedSpoilers: new Set(),
    tempReviewPhotos: [],
    tempScriptCover: null,
    tempCharacters: [],
    tempScriptTypes: ['硬核'], // multi-select types when creating script
    showAddReviewModal: false,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error'
    lastSyncedAt: null
  },

  _initialized: false,

  // Initialize module
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.loadScripts();
    this.checkUrlRoute();
    this.syncWithSupabase();
  },

  checkUrlRoute() {
    try {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash) {
        const [pathPart, queryPart] = hash.split('?');
        const segments = pathPart.split('/').filter(Boolean);
        if (segments[0] === 'larp' && segments[1]) {
          this.state.currentView = 'detail';
          this.state.selectedScriptId = decodeURIComponent(segments[1]);
          return;
        }
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const qScript = params.get('script') || params.get('id');
          if (qScript) {
            this.state.currentView = 'detail';
            this.state.selectedScriptId = qScript;
            return;
          }
        }
      }
      const searchParams = new URLSearchParams(window.location.search);
      const searchScript = searchParams.get('script') || searchParams.get('id');
      if (searchScript) {
        this.state.currentView = 'detail';
        this.state.selectedScriptId = searchScript;
      }
    } catch (e) {
      console.warn('[LARP Route] Error checking route:', e);
    }
  },

  // Helper to get script styles as array
  getScriptTypes(scriptOrRow) {
    if (Array.isArray(scriptOrRow?.types) && scriptOrRow.types.length > 0) {
      return scriptOrRow.types;
    }
    const raw = scriptOrRow?.type;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(s => String(s).trim()).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const parts = raw.split(/[,、/，\s·]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    return ['硬核'];
  },

  // Helper to check if a script has been played (has at least 1 review/rating)
  isPlayed(script) {
    return Array.isArray(script?.reviews) && script.reviews.length > 0;
  },

  // Helper to get the actual latest played date from reviews
  getLatestPlayedDate(script) {
    if (!script) return null;
    const reviewDates = (script.reviews || [])
      .map(r => r.playedDate)
      .filter(d => d && typeof d === 'string' && d.length === 10)
      .sort()
      .reverse();
    if (reviewDates.length > 0) {
      return reviewDates[0];
    }
    if (this.isPlayed(script) && script.playedDate && typeof script.playedDate === 'string' && script.playedDate.length === 10) {
      return script.playedDate;
    }
    return null;
  },

  // Helper to generate SVG placeholder poster covers
  createSvgCover(title, subtitle, bgGradient, icon) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bgGradient[0]}" />
            <stop offset="50%" stop-color="${bgGradient[1]}" />
            <stop offset="100%" stop-color="${bgGradient[2]}" />
          </linearGradient>
        </defs>
        <rect width="400" height="560" fill="url(#grad)" rx="24"/>
        <circle cx="200" cy="220" r="100" fill="white" opacity="0.08" />
        <text x="200" y="240" font-size="72" text-anchor="middle" dominant-baseline="central">${icon}</text>
        <text x="200" y="380" font-family="-apple-system, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="4">${title}</text>
        <text x="200" y="420" font-family="-apple-system, sans-serif" font-weight="600" font-size="16" fill="rgba(255,255,255,0.75)" text-anchor="middle" letter-spacing="2">${subtitle}</text>
        <rect x="150" y="445" width="100" height="2" fill="rgba(255,255,255,0.3)" rx="1"/>
      </svg>
    `;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  },

  // Get Default Seed / Demo Scripts (Empty: No built-in or demo scripts)
  getDefaultScripts() {
    return [];
  },

  // Load from local storage or initialize with defaults
  loadScripts() {
    const saved = StorageManager.get(this.STORAGE_KEY, []);
    if (saved && Array.isArray(saved)) {
      // Strictly filter out any legacy built-in/demo script IDs & normalize multi-dimension ratings
      this.state.scripts = saved
        .filter(s => s && s.id && !this.DEMO_SCRIPT_IDS.includes(s.id))
        .map(s => {
          if (Array.isArray(s.reviews)) {
            s.reviews.forEach(r => {
              const base = Number(r.ratingOverall !== undefined ? r.ratingOverall : (r.rating || 5));
              if (r.ratingOverall === undefined) r.ratingOverall = base;
              if (r.ratingLogic === undefined) r.ratingLogic = base;
              if (r.ratingStory === undefined) r.ratingStory = base;
              r.rating = r.ratingOverall;
            });
          }
          return s;
        });
    } else {
      this.state.scripts = [];
    }
    this.saveScripts();
  },

  // Save to local storage
  saveScripts() {
    StorageManager.set(this.STORAGE_KEY, this.state.scripts);
  },

  // Supabase REST Helper (Native fetch, zero dependencies)
  async supabaseRequest(path, options = {}) {
    const url = `${this.SUPABASE_CONFIG.url}/rest/v1${path}`;
    const headers = {
      'apikey': this.SUPABASE_CONFIG.key,
      'Authorization': `Bearer ${this.SUPABASE_CONFIG.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Supabase error (${res.status}): ${text}`);
    }

    if (!text || !text.trim() || res.status === 204) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  },

  mapRowToScript(row, reviews = []) {
    const types = this.getScriptTypes(row);
    const cover = (row.cover && row.cover.trim().length > 0)
      ? row.cover
      : this.createSvgCover(row.title || '劇本', `${row.genre || '本格'} · ${types.join(' · ')}`, ['#1e293b', '#334155', '#0f172a'], '🎭');

    let characters = [];
    if (Array.isArray(row.characters)) {
      characters = row.characters;
    } else if (row.owner_review && Array.isArray(row.owner_review.characters)) {
      characters = row.owner_review.characters;
    } else if (Array.isArray(row.owner_review)) {
      characters = row.owner_review;
    }

    return {
      id: row.id,
      title: row.title,
      cover: cover,
      playerCount: row.player_count,
      characterSetup: row.character_setup || '',
      duration: row.duration || '4 小時',
      genre: row.genre,
      type: types.join(' · '),
      types: types,
      needsDm: !!row.needs_dm,
      difficulty: row.difficulty || '★★★☆☆',
      rating: parseFloat(row.rating) || 0,
      playedDate: row.played_date || '',
      summary: row.summary || '',
      characters: characters,
      createdAt: row.created_at,
      reviews: reviews
    };
  },

  mapScriptToRow(script) {
    const latestDate = this.getLatestPlayedDate(script);
    const playedDate = latestDate || (script.playedDate && script.playedDate.length === 10 ? script.playedDate : null);

    const avg = this.calcAverageRating(script);
    const numericRating = avg === '?' ? 0 : (parseFloat(avg) || 0);
    const types = this.getScriptTypes(script);

    return {
      id: script.id,
      title: script.title,
      cover: script.cover || null,
      player_count: parseInt(script.playerCount, 10) || 6,
      character_setup: script.characterSetup || '',
      duration: script.duration || '4 小時',
      genre: script.genre || '本格',
      type: types.join('、'),
      needs_dm: !!script.needsDm,
      difficulty: script.difficulty || '★★★☆☆',
      rating: numericRating,
      played_date: playedDate,
      summary: script.summary || '',
      owner_review: (script.characters && script.characters.length > 0)
        ? { characters: script.characters }
        : null
    };
  },

  mapRowToReview(row) {
    let photos = [];
    if (Array.isArray(row.photos)) {
      photos = row.photos;
    } else if (typeof row.photos === 'string') {
      try { photos = JSON.parse(row.photos); } catch(e) { photos = []; }
    }

    let content = row.content || '';
    let ratingLogic = null;
    let ratingStory = null;
    let ratingOverall = null;

    // Check for encoded ratings in content comment: <!--ratings:{"logic":4.8,"story":4.9,"overall":5.0}-->
    const ratingMatch = content.match(/^<!--ratings:(\{.*?\})-->\s*/);
    if (ratingMatch) {
      try {
        const parsed = JSON.parse(ratingMatch[1]);
        if (parsed.logic !== undefined) ratingLogic = parseFloat(parsed.logic);
        if (parsed.story !== undefined) ratingStory = parseFloat(parsed.story);
        if (parsed.overall !== undefined) ratingOverall = parseFloat(parsed.overall);
        content = content.slice(ratingMatch[0].length);
      } catch (e) {
        console.warn('[Review Rating Parse Error]', e);
      }
    }

    const fallbackRating = parseFloat(row.rating) || 5.0;
    if (ratingLogic === null || isNaN(ratingLogic)) ratingLogic = fallbackRating;
    if (ratingStory === null || isNaN(ratingStory)) ratingStory = fallbackRating;
    if (ratingOverall === null || isNaN(ratingOverall)) ratingOverall = fallbackRating;

    return {
      id: row.id,
      userName: row.user_name || '遊玩玩家',
      playedDate: row.played_date || '',
      character: row.character || '',
      rating: ratingOverall,
      ratingOverall: ratingOverall,
      ratingLogic: ratingLogic,
      ratingStory: ratingStory,
      content: content,
      photos: photos,
      isSpoiler: !!row.is_spoiler,
      createdAt: row.created_at
    };
  },

  mapReviewToRow(review, scriptId) {
    const playedDate = (review.playedDate && review.playedDate.length === 10) 
      ? review.playedDate 
      : new Date().toISOString().split('T')[0];

    const ratingOverall = Number(review.ratingOverall !== undefined ? review.ratingOverall : (review.rating || 5)).toFixed(1);
    const ratingLogic = Number(review.ratingLogic !== undefined ? review.ratingLogic : ratingOverall).toFixed(1);
    const ratingStory = Number(review.ratingStory !== undefined ? review.ratingStory : ratingOverall).toFixed(1);

    const ratingsHeader = `<!--ratings:{"logic":${ratingLogic},"story":${ratingStory},"overall":${ratingOverall}}-->`;
    const finalContent = `${ratingsHeader}\n${review.content || ''}`;

    return {
      id: review.id,
      script_id: scriptId,
      user_name: review.userName || '遊玩玩家',
      played_date: playedDate,
      character: review.character || '',
      rating: parseFloat(ratingOverall),
      content: finalContent,
      photos: Array.isArray(review.photos) ? review.photos : [],
      is_spoiler: !!review.isSpoiler
    };
  },

  async syncWithSupabase(isManual = false) {
    if (this.state.syncStatus === 'syncing') return;
    this.state.syncStatus = 'syncing';
    this.renderView();

    try {
      // 1. Fetch remote scripts & reviews in parallel
      const [remoteScripts, remoteReviews] = await Promise.all([
        this.supabaseRequest('/scripts?select=*&order=created_at.desc'),
        this.supabaseRequest('/reviews?select=*&order=created_at.desc')
      ]);

      // 2. Process remote scripts & reviews directly (no demo scripts seeded)
      if (!remoteScripts || remoteScripts.length === 0) {
        this.state.scripts = [];
        this.saveScripts();
      } else {
        this.processRemoteData(remoteScripts, remoteReviews);
      }

      this.state.syncStatus = 'synced';
      this.state.lastSyncedAt = new Date();
      this.renderView();

      if (isManual) {
        App.showToast('✅ 雲端資料同步完成！', 'success');
      }
    } catch (err) {
      console.warn('[LARP Sync] Supabase sync error:', err);
      this.state.syncStatus = 'error';
      this.renderView();
      if (isManual) {
        App.showToast('雲端同步失敗，已切換為本機離線模式', 'error');
      }
    }
  },

  processRemoteData(remoteScripts, remoteReviews) {
    const reviewsByScriptId = {};
    (remoteReviews || []).forEach(row => {
      const sid = row.script_id;
      if (!reviewsByScriptId[sid]) reviewsByScriptId[sid] = [];
      reviewsByScriptId[sid].push(this.mapRowToReview(row));
    });

    const assembledScripts = (remoteScripts || [])
      .filter(row => row && row.id && !this.DEMO_SCRIPT_IDS.includes(row.id))
      .map(row => {
        const revs = reviewsByScriptId[row.id] || [];
        return this.mapRowToScript(row, revs);
      });

    this.state.scripts = assembledScripts;
    this.saveScripts();
  },

  async seedSupabaseDefaults() {
    return;
  },

  // Client-side image compression using HTML5 Canvas (Crucial for mobile and storage!)
  compressImage(file, maxDimension = 1000, quality = 0.78) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('請選取有效的圖片檔案'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Scale down proportionally
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export as webp or jpeg
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('圖片讀取失敗'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('檔案解析失敗'));
      reader.readAsDataURL(file);
    });
  },

  // Navigation
  switchView(view, scriptId = null, updateHistory = true) {
    this.state.currentView = view;
    if (scriptId) this.state.selectedScriptId = scriptId;
    this.state.showAddReviewModal = false;
    this.state.tempReviewPhotos = [];
    this.state.tempScriptCover = null;
    this._reviewDraft = null;
    if (view === 'create') {
      this.initTempCharacters(6);
      this.state.tempScriptTypes = ['硬核'];
      this.state.tempScriptCover = null;
    } else if (view === 'edit') {
      const targetId = scriptId || this.state.selectedScriptId;
      const script = this.state.scripts.find(s => s.id === targetId);
      if (script) {
        this.state.tempScriptCover = script.cover || null;
        this.state.tempScriptTypes = [...this.getScriptTypes(script)];
        if (Array.isArray(script.characters) && script.characters.length > 0) {
          this.state.tempCharacters = script.characters.map(c => ({
            name: c.name || '',
            desc: c.desc || ''
          }));
        } else {
          this.initTempCharacters(script.playerCount || 6);
        }
      }
    }

    if (updateHistory) {
      if (view === 'detail' && this.state.selectedScriptId) {
        const targetHash = `#larp/${encodeURIComponent(this.state.selectedScriptId)}`;
        if (window.location.hash !== targetHash) {
          history.pushState({ tab: 'larp', view: 'detail', scriptId: this.state.selectedScriptId }, '', targetHash);
        }
      } else if (view === 'list') {
        if (window.location.hash !== '#larp') {
          history.pushState({ tab: 'larp', view: 'list' }, '', '#larp');
        }
      }
    }

    document.querySelector('.bottom-nav')?.classList.remove('translate-y-full', 'pointer-events-none');
    this.renderView();
  },

  // Renders the module container
  render() {
    this.init();
    return `
      <div id="larp-module-container" class="fade-in pb-20">
        ${this.renderCurrentView()}
      </div>
      <!-- Lightbox Modal -->
      ${this.renderLightbox()}
    `;
  },

  // Update dynamic content
  renderView() {
    const container = document.getElementById('module-content');
    if (container && App.activeTab === 'larp') {
      container.innerHTML = this.render();
      if (window.lucide) lucide.createIcons();
    }
  },

  renderCurrentView() {
    if (this.state.currentView === 'detail') {
      return this.renderDetailView();
    }
    if (this.state.currentView === 'create') {
      return this.renderCreateScriptView();
    }
    if (this.state.currentView === 'edit') {
      return this.renderEditScriptView();
    }
    return this.renderListView();
  },

  // View 1: Scripts List View
  renderListView() {
    const filteredScripts = this.getFilteredScripts();
    const totalCount = this.state.scripts.length;
    const totalReviews = this.state.scripts.reduce((acc, s) => acc + (s.reviews?.length || 0), 0);

    return `
      <div class="space-y-4">
        <!-- Top Navigation & Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="App.switchTab('dashboard')" class="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>返回功能列表</span>
          </button>

          <div class="flex items-center space-x-1.5">
            <!-- Cloud Sync Status Button -->
            <button 
              onclick="LarpModule.syncWithSupabase(true)" 
              class="tap-scale px-2 py-1 rounded-xl text-[10px] font-bold flex items-center space-x-1 transition ${
                this.state.syncStatus === 'syncing' 
                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' 
                  : this.state.syncStatus === 'error'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40'
              }"
              title="點擊同步雲端資料庫"
            >
              <i data-lucide="${this.state.syncStatus === 'syncing' ? 'refresh-cw' : (this.state.syncStatus === 'error' ? 'cloud-off' : 'cloud')}" class="w-3 h-3 ${this.state.syncStatus === 'syncing' ? 'animate-spin text-blue-500' : ''}"></i>
              <span>${this.state.syncStatus === 'syncing' ? '同步中' : (this.state.syncStatus === 'error' ? '離線' : '雲端連線')}</span>
            </button>

            <!-- Admin Permission Status Button -->
            <button 
              onclick="LarpModule.toggleAdminLock()" 
              class="tap-scale px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center space-x-1 transition ${
                this.isAdmin() 
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-900/40' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }"
              title="${this.isAdmin() ? '已具備管理員權限 (點擊可鎖定)' : '點擊解鎖管理員權限'}"
            >
              <i data-lucide="${this.isAdmin() ? 'crown' : 'lock'}" class="w-3 h-3 ${this.isAdmin() ? 'text-amber-500' : ''}"></i>
              <span>${this.isAdmin() ? '版主已解鎖' : '管理權限'}</span>
            </button>

            <!-- Create Script Button (Protected by permission) -->
            <button 
              onclick="LarpModule.handleClickCreateScript()" 
              class="tap-scale px-3 py-1.5 rounded-full ${
                this.isAdmin()
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/50 dark:border-slate-700/50'
              } font-bold text-xs flex items-center space-x-1"
            >
              <i data-lucide="${this.isAdmin() ? 'plus' : 'lock'}" class="w-3.5 h-3.5 stroke-[2.5]"></i>
              <span>新增劇本</span>
            </button>
          </div>
        </div>

        <!-- Hero Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 p-5 text-white shadow-xl shadow-emerald-950/30 border border-emerald-800/40">
          <div class="relative z-10 space-y-1">
            <div class="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span class="text-xl">📜</span>
              <span>LARP Records · 劇本殺探案紀錄</span>
            </div>

            <div class="pt-2 flex items-center space-x-4 text-[11px] font-bold text-emerald-300/90">
              <span class="flex items-center space-x-1">
                <i data-lucide="book-marked" class="w-3.5 h-3.5"></i>
                <span>已收錄 ${totalCount} 本劇本</span>
              </span>
              <span>·</span>
              <span class="flex items-center space-x-1">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                <span>${totalReviews} 則好友心得</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="搜尋劇本名稱、流派、標籤..."
            value="${this.state.searchQuery}"
            oninput="LarpModule.handleSearch(this.value)"
            class="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
          ${this.state.searchQuery ? `
            <button onclick="LarpModule.clearSearch()" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 tap-scale">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          ` : ''}
        </div>

        <!-- Filter Pills Bar (Scrollable horizontally) -->
        <div class="space-y-2">
          <!-- Genre Filters (流派) -->
          <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">流派:</span>
            ${['all', '本格', '變格', '新本格'].map(g => `
              <button 
                onclick="LarpModule.setFilterGenre('${g}')"
                class="tap-scale shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                  this.state.filterGenre === g 
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800'
                }"
              >
                ${g === 'all' ? '全部流派' : g}
              </button>
            `).join('')}
          </div>

          <!-- Type / Style Multi-Select Filters (風格標籤 - 可複選) -->
          <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">風格:</span>
            <button 
              onclick="LarpModule.toggleFilterType('all')"
              class="tap-scale shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                (!this.state.filterTypes || this.state.filterTypes.length === 0)
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800'
              }"
            >
              全部風格
            </button>
            ${this.AVAILABLE_TYPES.map(t => {
              const isActive = Array.isArray(this.state.filterTypes) && this.state.filterTypes.includes(t);
              return `
                <button 
                  onclick="LarpModule.toggleFilterType('${t}')"
                  class="tap-scale shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center space-x-1 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800'
                  }"
                >
                  ${isActive ? '<span class="text-[9px]">✓</span>' : ''}
                  <span>${t}</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Play Status Filters (遊玩狀態) -->
          <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">狀態:</span>
            ${[
              { id: 'all', label: '全部狀態' },
              { id: 'played', label: '已遊玩' },
              { id: 'unplayed', label: '未遊玩' }
            ].map(st => `
              <button 
                onclick="LarpModule.setFilterStatus('${st.id}')"
                class="tap-scale shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                  this.state.filterStatus === st.id 
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800'
                }"
              >
                ${st.label}
              </button>
            `).join('')}
          </div>

          <!-- Player Count & Sort Controls -->
          <div class="flex items-center justify-between pt-1">
            <!-- Player Count Filter -->
            <select 
              onchange="LarpModule.setFilterPlayers(this.value)" 
              class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all" ${this.state.filterPlayers === 'all' ? 'selected' : ''}>人數：全部</option>
              <option value="1-4" ${this.state.filterPlayers === '1-4' ? 'selected' : ''}>1 ~ 4 人</option>
              <option value="5-6" ${this.state.filterPlayers === '5-6' ? 'selected' : ''}>5 ~ 6 人</option>
              <option value="7-8" ${this.state.filterPlayers === '7-8' ? 'selected' : ''}>7 ~ 8 人</option>
              <option value="9+" ${this.state.filterPlayers === '9+' ? 'selected' : ''}>9 人以上</option>
            </select>

            <!-- Sort By Selector -->
            <div class="flex items-center space-x-1.5">
              <i data-lucide="arrow-down-up" class="w-3.5 h-3.5 text-slate-400"></i>
              <select 
                onchange="LarpModule.setSortBy(this.value)"
                class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="rating" ${this.state.sortBy === 'rating' ? 'selected' : ''}>評分最高</option>
                <option value="newest" ${this.state.sortBy === 'newest' ? 'selected' : ''}>最新遊玩</option>
                <option value="created" ${this.state.sortBy === 'created' ? 'selected' : ''}>最新上架</option>
                <option value="players" ${this.state.sortBy === 'players' ? 'selected' : ''}>人數多寡</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Script Cards List -->
        <div class="space-y-3 pt-1">
          ${this.state.scripts.length === 0 ? `
            <div class="text-center py-16 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 space-y-3 px-6 shadow-sm">
              <span class="text-5xl">🎭</span>
              <h4 class="text-sm font-black text-slate-800 dark:text-white">目前尚無任何劇本</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                資料庫乾淨純淨，點擊下方「新增劇本」即可發布您的第一本劇本！
              </p>
              <button 
                onclick="LarpModule.handleClickCreateScript()" 
                class="tap-scale inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
              >
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>立即建立新劇本</span>
              </button>
            </div>
          ` : filteredScripts.length === 0 ? `
            <div class="text-center py-12 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 space-y-3">
              <span class="text-4xl">🔍</span>
              <p class="text-xs font-bold text-slate-600 dark:text-slate-300">查無符合條件的劇本</p>
              <button onclick="LarpModule.resetFilters()" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 underline">
                清除所有篩選條件
              </button>
            </div>
          ` : filteredScripts.map(s => this.renderScriptCard(s)).join('')}
        </div>
      </div>
    `;
  },

  // Single Script Card in List
  renderScriptCard(script) {
    const avgRating = this.calcAverageRating(script);
    const reviewsCount = script.reviews?.length || 0;
    const played = this.isPlayed(script);
    const latestPlayedDate = this.getLatestPlayedDate(script);

    return `
      <div 
        onclick="LarpModule.switchView('detail', '${script.id}')"
        class="tap-scale group relative flex space-x-3.5 p-3.5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <!-- Poster Thumbnail -->
        <div class="w-20 h-28 rounded-2xl overflow-hidden shrink-0 shadow-md border border-slate-200/50 dark:border-slate-700/50 relative bg-slate-900">
          <img src="${script.cover}" alt="${script.title}" class="w-full h-full object-cover">
          ${played ? `
            <!-- Top-left diagonal corner ribbon: 已玩過 (Matching Screenshot 1) -->
            <div class="absolute top-0 left-0 w-14 h-14 overflow-hidden pointer-events-none z-10 rounded-tl-2xl">
              <div class="absolute top-[8px] left-[-24px] w-[72px] -rotate-45 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[9px] text-center py-0.5 shadow-md tracking-wider">
                已玩過
              </div>
            </div>
          ` : ''}
          <div class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-black text-amber-400 flex items-center space-x-0.5 z-10">
            <span>★</span>
            <span>${avgRating}</span>
          </div>
        </div>

        <!-- Info Column -->
        <div class="flex-1 flex flex-col justify-between py-0.5 min-w-0">
          <div>
            <!-- Title & Player Count -->
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-slate-900 dark:text-white truncate">${script.title}</h3>
              <div class="flex items-center space-x-1.5 shrink-0">
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  ${script.playerCount} 人
                </span>
                ${this.isAdmin() ? `
                  <button 
                    onclick="event.stopPropagation(); LarpModule.editScript('${script.id}')"
                    class="tap-scale p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                    title="管理員：編輯此劇本"
                  >
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                  </button>
                  <button 
                    onclick="event.stopPropagation(); LarpModule.deleteScript('${script.id}')"
                    class="tap-scale p-1 -mr-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    title="管理員：刪除此劇本"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Tags -->
            <div class="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
              ${played ? `
                <span class="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 text-[10px] font-black">
                  已遊玩
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                  未遊玩
                </span>
              `}
              <span class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 text-[10px] font-bold">
                ${script.genre}
              </span>
              ${this.getScriptTypes(script).map(t => `
                <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40 text-[10px] font-bold">
                  ${t}
                </span>
              `).join('')}
              ${script.needsDm ? `
                <span class="px-1.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                  需DM
                </span>
              ` : ''}
            </div>

            <!-- Synopsis Preview -->
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
              ${script.summary}
            </p>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
            <span>時長: ${script.duration || '約 4 小時'}</span>
            <div class="flex items-center space-x-2 shrink-0">
              ${latestPlayedDate ? `
                <span class="flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-bold" title="最新遊玩日期">
                  <i data-lucide="calendar" class="w-3 h-3"></i>
                  <span>${latestPlayedDate.replace(/-/g, '/')}</span>
                </span>
              ` : ''}
              <span class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <i data-lucide="message-circle" class="w-3 h-3"></i>
                <span>${reviewsCount} 則心得</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // View 2: Script Details View
  renderDetailView() {
    const script = this.state.scripts.find(s => s.id === this.state.selectedScriptId);
    if (!script) {
      if (this.state.syncStatus === 'syncing' || !this.state.lastSyncedAt) {
        return `
          <div class="space-y-4 pb-20">
            <!-- Top Navigation -->
            <div class="flex items-center justify-between pt-1">
              <button onclick="LarpModule.switchView('list')" class="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 tap-scale">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
                <span>返回劇本列表</span>
              </button>
            </div>
            <div class="text-center py-20 space-y-4 rounded-3xl bg-white dark:bg-slate-800/90 p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 animate-spin">
                <i data-lucide="loader-2" class="w-8 h-8"></i>
              </div>
              <div class="space-y-1">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-100">正在載入劇本資訊...</p>
                <p class="text-xs text-slate-400 dark:text-slate-500">正在與雲端同步最新劇本內容與心得評價，請稍候</p>
              </div>
            </div>
          </div>
        `;
      }
      return `
        <div class="text-center py-16 space-y-3">
          <p class="text-sm text-slate-400">找不到此劇本資料，可能已被移除</p>
          <button onclick="LarpModule.switchView('list')" class="text-xs font-bold text-emerald-500 underline">返回列表</button>
        </div>
      `;
    }

    const avgRatings = this.calcAverageRatings(script);
    const avgRating = avgRatings.overall;
    const reviews = script.reviews || [];

    return `
      <div class="space-y-4 pb-32">
        <!-- Top Navigation -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="LarpModule.switchView('list')" class="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>返回劇本列表</span>
          </button>

          <div class="flex items-center space-x-1.5">
            <button 
              onclick="LarpModule.syncWithSupabase(true)" 
              class="tap-scale p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" 
              title="重新整理雲端資料"
            >
              <i data-lucide="refresh-cw" class="w-4 h-4 ${this.state.syncStatus === 'syncing' ? 'animate-spin text-emerald-500' : ''}"></i>
            </button>

            ${this.isAdmin() ? `
              <button 
                onclick="LarpModule.editScript('${script.id}')" 
                class="tap-scale p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40" 
                title="管理員：編輯此劇本"
              >
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>

              <button 
                onclick="LarpModule.deleteScript('${script.id}')" 
                class="tap-scale p-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/40" 
                title="管理員：刪除此劇本"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}

            <button onclick="LarpModule.shareScript('${script.id}')" class="tap-scale p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title="複製此劇本專屬頁面連結">
              <i data-lucide="share-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Poster & Title Hero Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex space-x-4">
            <!-- Cover Poster (Clickable Lightbox) -->
            <div 
              onclick="LarpModule.openLightbox('${script.cover}', '${script.title}')"
              class="w-28 h-40 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-slate-200/60 dark:border-slate-700/60 cursor-pointer relative group bg-slate-900"
            >
              <img src="${script.cover}" alt="${script.title}" class="w-full h-full object-cover">
              ${this.isPlayed(script) ? `
                <div class="absolute top-0 left-0 w-16 h-16 overflow-hidden pointer-events-none z-10 rounded-tl-2xl">
                  <div class="absolute top-[9px] left-[-26px] w-[80px] -rotate-45 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[9px] text-center py-0.5 shadow-md tracking-wider">
                    已玩過
                  </div>
                </div>
              ` : ''}
              <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <i data-lucide="zoom-in" class="w-6 h-6 text-white"></i>
              </div>
            </div>

            <!-- Core Specs -->
            <div class="flex-1 space-y-2 min-w-0">
              <div>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-black text-slate-900 dark:text-white leading-tight truncate">${script.title}</h2>
                  ${this.isAdmin() ? `
                    <button 
                      onclick="LarpModule.editScript('${script.id}')" 
                      class="tap-scale shrink-0 p-1 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition" 
                      title="管理員：編輯劇本內容"
                    >
                      <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                  ` : ''}
                </div>
                <div class="space-y-1 mt-1">
                  <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    ${this.isPlayed(script) ? `
                      <span class="px-2 py-0.5 rounded-md bg-amber-500 text-white font-black text-[10px] shadow-sm shadow-amber-500/20">
                        已遊玩
                      </span>
                    ` : `
                      <span class="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                        未遊玩
                      </span>
                    `}
                    <div class="flex items-center space-x-1 text-amber-500 font-black text-sm">
                      <span>★</span>
                      <span>${avgRatings.overall}</span>
                      <span class="text-[10px] text-slate-400 font-normal">(${reviews.length > 0 ? `${reviews.length} 則評價` : '尚未有評價'})</span>
                    </div>
                  </div>
                  ${reviews.length > 0 ? `
                    <div class="flex items-center space-x-1.5 pt-0.5 text-[10px] font-bold">
                      <span class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/30">
                        🧩 邏輯 ${avgRatings.logic}
                      </span>
                      <span class="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/30">
                        🎭 沉浸 ${avgRatings.story}
                      </span>
                      <span class="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30">
                        ⭐ 總和 ${avgRatings.overall}
                      </span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">配置:</span>
                  <span class="font-bold">${script.playerCount} 人 (${script.characterSetup || '男女不限'})</span>
                </div>
                <div class="flex items-center space-x-1.5 flex-wrap gap-1">
                  <span class="text-slate-400 text-[10px] font-bold">流派:</span>
                  <span class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-200/50 dark:border-emerald-900/40">
                    ${script.genre}
                  </span>
                  ${this.getScriptTypes(script).map(t => `
                    <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] border border-indigo-200/50 dark:border-indigo-900/40">
                      ${t}
                    </span>
                  `).join('')}
                </div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">時長:</span>
                  <span>${script.duration || '約 4 小時'}</span>
                </div>
                ${this.getLatestPlayedDate(script) ? `
                  <div class="flex items-center space-x-1.5">
                    <span class="text-slate-400 text-[10px] font-bold">遊玩:</span>
                    <span class="font-bold text-amber-600 dark:text-amber-400">${this.getLatestPlayedDate(script).replace(/-/g, '/')}</span>
                  </div>
                ` : ''}
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">主持:</span>
                  <span>${script.needsDm ? '🎙️ 需專業 DM 帶本' : '無需 DM (自動帶本)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 官方劇本介紹 (居中書寫, matching Screenshot 2) -->
        <div class="rounded-3xl bg-slate-800/90 dark:bg-slate-800/90 p-6 border border-slate-700/60 shadow-lg text-center space-y-3">
          <h3 class="text-base font-black text-amber-400 tracking-wider">
            官方劇本介紹
          </h3>
          <p class="text-xs sm:text-sm text-slate-200 leading-loose whitespace-pre-line tracking-wide">
            ${script.summary || '暫無劇本介紹'}
          </p>
        </div>

        <!-- 角色簡介 (Grid Cards, matching Screenshot 2) -->
        <div class="rounded-3xl bg-slate-800/90 dark:bg-slate-800/90 p-6 border border-slate-700/60 shadow-lg space-y-4">
          <h3 class="text-base font-black text-amber-400 text-center tracking-wider">
            角色簡介
          </h3>
          ${script.characters && script.characters.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              ${script.characters.map(char => `
                <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-700/50 text-center flex flex-col justify-center items-center space-y-1.5 shadow-sm">
                  <h4 class="text-sm font-bold text-white tracking-wide">${this.escapeHtml(char.name || '未知角色')}</h4>
                  ${char.desc ? `<p class="text-xs text-slate-300 leading-relaxed">${this.escapeHtml(char.desc)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-center text-xs text-slate-400 py-3">尚未設定角色簡介</p>
          `}
        </div>

        <!-- Community / Friends Reviews Section (好友心得牆) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center space-x-1.5">
              <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                好友遊玩心得牆 (${reviews.length})
              </h3>
            </div>
          </div>

          <!-- Reviews List -->
          <div class="space-y-3">
            ${reviews.length === 0 ? `
              <div class="text-center py-6 text-xs text-slate-400">
                <p>目前尚無好友留言，成為第一個留下遊玩心得的人吧！</p>
              </div>
            ` : reviews.map(rev => this.renderReviewItem(rev)).join('')}
          </div>
        </div>

        <!-- Floating Action Button for Adding Review -->
        <div class="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 z-20 pointer-events-none">
          <button 
            onclick="LarpModule.openAddReviewModal()"
            class="pointer-events-auto tap-scale w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition"
          >
            <i data-lucide="message-square-plus" class="w-4 h-4"></i>
            <span>我也玩過！新增心得與照片</span>
          </button>
        </div>

        <!-- Add Review Modal/Sheet -->
        ${this.state.showAddReviewModal ? this.renderAddReviewModal(script) : ''}
      </div>
    `;
  },

  // Single Review Item in Community Wall
  renderReviewItem(rev) {
    const isSpoilerRevealed = this.state.revealedSpoilers.has(rev.id);
    const overallRating = rev.ratingOverall !== undefined ? rev.ratingOverall : (rev.rating !== undefined ? rev.rating : 5);
    const logicRating = rev.ratingLogic !== undefined ? rev.ratingLogic : overallRating;
    const storyRating = rev.ratingStory !== undefined ? rev.ratingStory : overallRating;

    const starString = this.renderStars(overallRating);
    const overallNum = Number(overallRating).toFixed(1);
    const logicNum = Number(logicRating).toFixed(1);
    const storyNum = Number(storyRating).toFixed(1);

    return `
      <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
        <!-- Reviewer Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              ${(rev.userName || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold text-slate-900 dark:text-white">${rev.userName}</span>
                ${rev.character ? `
                  <span class="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-medium">
                    飾演 ${rev.character}
                  </span>
                ` : ''}
              </div>
              <span class="text-[10px] text-slate-400">${rev.playedDate || '近期遊玩'}</span>
            </div>
          </div>

          <div class="flex items-center space-x-1.5 shrink-0">
            <!-- Stars & Score -->
            <div class="text-right">
              <div class="flex items-center justify-end space-x-1 text-xs text-amber-500 font-black tracking-tight" title="總和體驗：${overallNum} 顆星">
                <span>${starString}</span>
                <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">(${overallNum})</span>
              </div>
              <div class="flex items-center justify-end space-x-1 text-[9px] font-bold mt-0.5">
                <span class="text-blue-600 dark:text-blue-400">🧩 ${logicNum}</span>
                <span class="text-slate-300 dark:text-slate-700">·</span>
                <span class="text-purple-600 dark:text-purple-400">🎭 ${storyNum}</span>
                <span class="text-slate-300 dark:text-slate-700">·</span>
                <span class="text-amber-600 dark:text-amber-400">⭐ ${overallNum}</span>
              </div>
            </div>

            <!-- Admin Delete Review Button (Visible ONLY to Admins) -->
            ${this.isAdmin() ? `
              <button 
                onclick="event.stopPropagation(); LarpModule.deleteReview('${rev.id}')"
                class="tap-scale p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                title="管理員：移除此心得"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Review Content (with Spoiler Shield) -->
        ${rev.isSpoiler && !isSpoilerRevealed ? `
          <div 
            onclick="LarpModule.revealSpoiler('${rev.id}')"
            class="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 cursor-pointer text-center space-y-1 transition hover:bg-amber-100/60"
          >
            <div class="flex items-center justify-center space-x-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              <i data-lucide="eye-off" class="w-3.5 h-3.5"></i>
              <span>內容包含劇透暴雷</span>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400">點擊此處展開查看好友真實心得</p>
          </div>
        ` : `
          <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            ${rev.content}
          </p>
        `}

        <!-- Photos Grid (if any) -->
        ${rev.photos && rev.photos.length > 0 ? `
          <div class="flex items-center space-x-2 pt-1 overflow-x-auto no-scrollbar">
            ${rev.photos.map((photoUrl, idx) => `
              <div 
                onclick="LarpModule.openLightbox('${photoUrl}', '${rev.userName} 的遊玩照片')"
                class="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition shadow-sm"
              >
                <img src="${photoUrl}" alt="心得打卡照片" class="w-full h-full object-cover">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  // Modal: Add Friend's Review (心得評價填寫表單)
  // Modal: Add Friend's Review (心得評價填寫表單)
  renderAddReviewModal(script) {
    const settings = StorageManager.get('settings', { userName: '遊玩玩家' });
    const defaultName = settings.userName || '遊玩玩家';
    const todayStr = new Date().toISOString().split('T')[0];
    const draft = this._reviewDraft;

    const initialOverall = this._tempRatings?.overall !== undefined 
      ? this._tempRatings.overall 
      : (draft?.ratingOverall !== undefined ? draft.ratingOverall : (draft?.rating !== undefined ? draft.rating : 5.0));
    const initialLogic = this._tempRatings?.logic !== undefined 
      ? this._tempRatings.logic 
      : (draft?.ratingLogic !== undefined ? draft.ratingLogic : initialOverall);
    const initialStory = this._tempRatings?.story !== undefined 
      ? this._tempRatings.story 
      : (draft?.ratingStory !== undefined ? draft.ratingStory : initialOverall);

    this._tempRatings = {
      logic: Number(initialLogic),
      story: Number(initialStory),
      overall: Number(initialOverall)
    };

    return `
      <div 
        id="larp-add-review-modal"
        class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
        onclick="if(event.target === this) LarpModule.closeAddReviewModal()"
      >
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xl max-h-[88vh] flex flex-col space-y-3.5">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <h3 class="text-sm font-black text-slate-900 dark:text-white">新增遊玩心得</h3>
              <p class="text-[10px] text-slate-400">劇本：《${script.title}》</p>
            </div>
            <button type="button" onclick="LarpModule.closeAddReviewModal()" class="p-1 rounded-full text-slate-400 hover:text-slate-600 tap-scale">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Scrollable Form Fields Body -->
          <div class="flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-0.5">
            <!-- User Name & Play Date -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">您的暱稱</label>
                <input 
                  type="text" 
                  id="rev-input-name" 
                  value="${this._reviewDraft?.name !== undefined ? this._reviewDraft.name : defaultName}"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">遊玩日期</label>
                <input 
                  type="date" 
                  id="rev-input-date" 
                  value="${this._reviewDraft?.date !== undefined ? this._reviewDraft.date : todayStr}"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
              </div>
            </div>

            <!-- Character Played -->
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">飾演角色 (選填)</label>
              <input 
                type="text" 
                id="rev-input-character" 
                value="${this._reviewDraft?.character !== undefined ? this._reviewDraft.character : ''}"
                placeholder="例如：姜宇桓"
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
              ${script.characters && script.characters.length > 0 ? `
                <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-2">
                  <span class="text-[10px] font-bold text-slate-400 shrink-0">快捷選取:</span>
                  ${script.characters.map(c => `
                    <button 
                      type="button" 
                      onclick="document.getElementById('rev-input-character').value = '${this.escapeHtml(c.name)}'" 
                      class="tap-scale px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40 text-[10px] font-bold shrink-0"
                    >
                      ${this.escapeHtml(c.name)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <!-- Three-Dimensional Rating Controls (0.0 ~ 5.0, step 0.1) -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5">
              <div class="flex items-center justify-between pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <div>
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">多面向心得評分 (0.0 ~ 5.0 ★ · 0.1 級距)</span>
                  <span class="text-[9px] text-slate-400">分別針對邏輯、沉浸與總和體驗打分</span>
                </div>
                <!-- Quick Sync Button: 一鍵同步三項 -->
                <div class="flex items-center space-x-1 text-[9px] font-bold text-slate-400">
                  <span class="shrink-0">同步:</span>
                  <button type="button" onclick="LarpModule.syncAllTempRatings(4.0)" class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 hover:text-amber-500 tap-scale border border-slate-200 dark:border-slate-600">4.0</button>
                  <button type="button" onclick="LarpModule.syncAllTempRatings(4.5)" class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 hover:text-amber-500 tap-scale border border-slate-200 dark:border-slate-600">4.5</button>
                  <button type="button" onclick="LarpModule.syncAllTempRatings(4.8)" class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 hover:text-amber-500 tap-scale border border-slate-200 dark:border-slate-600">4.8</button>
                  <button type="button" onclick="LarpModule.syncAllTempRatings(5.0)" class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 hover:text-amber-500 tap-scale border border-slate-200 dark:border-slate-600">5.0</button>
                </div>
              </div>

              <!-- 1. 邏輯推理 -->
              ${this.renderRatingSliderRow('logic', '🧩', '邏輯推理', '案件邏輯、手法詭計', this._tempRatings.logic, 'accent-blue-500', 'bg-blue-600')}

              <!-- 2. 劇情沉浸 -->
              ${this.renderRatingSliderRow('story', '🎭', '劇情沉浸', '人設情感、故事氛圍', this._tempRatings.story, 'accent-purple-500', 'bg-purple-600')}

              <!-- 3. 總和體驗 -->
              ${this.renderRatingSliderRow('overall', '⭐', '總和體驗', '節奏爽度、綜合推薦', this._tempRatings.overall, 'accent-amber-500', 'bg-amber-500')}
            </div>

            <!-- Review Text Area -->
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">心得評語 (100% 自由發揮)</label>
              <textarea 
                id="rev-input-content" 
                rows="3" 
                placeholder="分享你的推理過程、角色情感或現場打卡體驗..."
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >${this._reviewDraft?.content !== undefined ? this._reviewDraft.content : ''}</textarea>
            </div>

            <!-- Is Spoiler Switch -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div class="flex items-center space-x-1.5">
                <i data-lucide="shield-alert" class="w-4 h-4 text-amber-500"></i>
                <div>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200">內容是否包含劇透？</span>
                  <p class="text-[9px] text-slate-400">勾選後將主動為心得加上防雷遮罩</p>
                </div>
              </div>
              <input type="checkbox" id="rev-input-spoiler" ${this._reviewDraft?.isSpoiler ? 'checked' : ''} class="w-4 h-4 accent-emerald-600 rounded">
            </div>

            <!-- Client-side Photo Upload with Compression -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">現場打卡照片 (支援相機/相簿)</label>
                <span class="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">自動壓縮 WebP</span>
              </div>

              <!-- Upload Button & Preview List -->
              <div class="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                <!-- Add Photo Trigger -->
                <label class="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 flex flex-col items-center justify-center text-slate-400 cursor-pointer shrink-0 tap-scale bg-slate-50/50 dark:bg-slate-800/50">
                  <i data-lucide="camera" class="w-5 h-5"></i>
                  <span class="text-[8px] font-bold mt-0.5">加照片</span>
                  <input 
                    type="file" 
                    id="rev-photo-input"
                    accept="image/*" 
                    class="hidden" 
                    onchange="LarpModule.handleReviewPhotoSelect(this)"
                  >
                </label>

                <!-- Thumbnails of Selected Photos (Updated directly without form re-rendering) -->
                <div id="review-photos-preview-list" class="flex items-center space-x-2">
                  ${this.renderReviewPhotoThumbnails()}
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Button Fixed at bottom of modal (Safe from bottom nav & gestures) -->
          <div class="pt-2 pb-6 sm:pb-0 shrink-0 border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button"
              onclick="LarpModule.submitReview('${script.id}')"
              class="tap-scale w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-1.5 transition"
            >
              <i data-lucide="send" class="w-4 h-4"></i>
              <span>發布遊玩心得</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // View 3: Create New Script View (版主建立劇本)
  renderCreateScriptView() {
    const charsCount = this.state.tempCharacters ? this.state.tempCharacters.length : 6;

    return `
      <div class="space-y-4">
        <!-- Top Navigation -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="LarpModule.switchView('list')" class="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>取消返回</span>
          </button>
          <span class="text-xs font-black text-slate-800 dark:text-white">新增探案劇本</span>
        </div>

        <!-- Form Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <!-- Title -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">劇本名稱 *</label>
            <input 
              type="text" 
              id="new-script-title" 
              placeholder="例如：死者在幻夜中醒來"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
          </div>

          <!-- Cover Image Upload -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">劇本海報封面 (選填)</label>
              <span class="text-[9px] text-slate-400">若無上傳將自動生成質感封面</span>
            </div>

            <div class="flex items-center space-x-3">
              <label class="w-20 h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center text-slate-400 cursor-pointer shrink-0 tap-scale bg-slate-50/50 dark:bg-slate-800/50">
                <i data-lucide="image-plus" class="w-6 h-6"></i>
                <span class="text-[9px] font-bold mt-1">選取封面</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  class="hidden" 
                  onchange="LarpModule.handleScriptCoverSelect(this)"
                >
              </label>

              <div id="script-cover-preview-box" class="flex-1">
                ${this.state.tempScriptCover ? `
                  <div class="relative w-20 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
                    <img src="${this.state.tempScriptCover}" alt="封面預覽" class="w-full h-full object-cover">
                    <button 
                      type="button" 
                      onclick="LarpModule.clearTempCover()"
                      class="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white shadow-sm tap-scale"
                    >
                      <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                  </div>
                ` : `
                  <div class="text-[11px] text-slate-400 leading-relaxed">
                    可上傳官方海報或手機拍下的劇本書封，系統將在前端自動壓縮成 800px 輕量 WebP。
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Genre & Player Count -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">流派</label>
              <select id="new-script-genre" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="本格">本格</option>
                <option value="變格">變格</option>
                <option value="新本格">新本格</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">總人數</label>
              <input 
                type="number" 
                id="new-script-players" 
                min="1" 
                max="20" 
                value="${charsCount}"
                oninput="LarpModule.handlePlayerCountChange(this.value)"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
              >
            </div>
          </div>

          <!-- Style / Types Multi-Select (風格標籤 - 可複選) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                劇本風格 (可複選) *
              </label>
              <span id="script-types-count-badge" class="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                已選 ${(this.state.tempScriptTypes || []).length} 個風格
              </span>
            </div>
            <div id="create-script-types-container" class="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
              ${this.renderTypeCheckChips()}
            </div>
          </div>

          <!-- Details: Character Setup, Duration, DM -->
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">角色男女配比</label>
              <input 
                type="text" 
                id="new-script-setup" 
                placeholder="3男3女" 
                value="3男3女"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
              >
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">遊玩時長</label>
              <input 
                type="text" 
                id="new-script-duration" 
                placeholder="4 小時" 
                value="4 ~ 4.5 小時"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
              >
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">主持需求</label>
              <select id="new-script-dm" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="true">需主持人</option>
                <option value="false">免主持人</option>
              </select>
            </div>
          </div>

          <!-- 官方劇本介紹 (居中書寫, matching Screenshot 2) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                官方劇本介紹 (居中書寫) *
              </label>
              <span class="text-[9px] text-slate-400">文字居中顯示</span>
            </div>
            <textarea 
              id="new-script-summary" 
              rows="4" 
              placeholder="3 份案宗，3 起懸案，開啟塵封 10 年的血色回憶&#10;詭異的傳說，神秘的後山，莫名的證言&#10;原本寧靜的山村，究竟隱藏著什麼秘密？"
              class="w-full px-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed tracking-wide"
            ></textarea>
          </div>

          <!-- 角色介紹 (根據人數動態新增, matching Screenshot 2) -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <div>
                <label id="create-script-chars-title" class="block text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                  角色介紹 (${charsCount} 位角色)
                </label>
                <p class="text-[10px] text-slate-400">可依人數動態調整，並填入姓名與身分簡介</p>
              </div>
              <button 
                type="button" 
                onclick="LarpModule.addTempCharacterSlot()"
                class="tap-scale px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 text-[11px] font-bold flex items-center space-x-1"
              >
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>新增角色</span>
              </button>
            </div>

            <div id="create-script-characters-list" class="space-y-2.5">
              ${this.renderTempCharactersList()}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2">
            <button 
              type="button"
              onclick="LarpModule.submitCreateScript()" 
              class="tap-scale w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition"
            >
              <i data-lucide="check" class="w-5 h-5"></i>
              <span>儲存並發布劇本</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // View 4: Edit Script View (Admin only)
  renderEditScriptView() {
    const script = this.state.scripts.find(s => s.id === this.state.selectedScriptId);
    if (!script) {
      return `
        <div class="text-center py-12 space-y-3">
          <p class="text-xs text-slate-400">找不到此劇本資料</p>
          <button onclick="LarpModule.switchView('list')" class="text-xs font-bold text-emerald-500 underline">返回列表</button>
        </div>
      `;
    }

    if (!this.isAdmin()) {
      return `
        <div class="text-center py-12 space-y-3">
          <p class="text-xs text-rose-500 font-bold">權限不足：僅限管理員編輯劇本</p>
          <button onclick="LarpModule.verifyAdminOrPrompt(() => LarpModule.renderView())" class="text-xs font-bold text-indigo-500 underline">點擊輸入管理金鑰</button>
        </div>
      `;
    }

    const charsCount = this.state.tempCharacters ? this.state.tempCharacters.length : (script.playerCount || 6);

    return `
      <div class="space-y-4 pb-28">
        <!-- Top Navigation -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="LarpModule.switchView('detail', '${script.id}')" class="flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>返回劇本詳情</span>
          </button>
          <span class="text-xs font-black text-slate-700 dark:text-slate-300">
            編輯劇本內容
          </span>
        </div>

        <!-- Form Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <!-- Title -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">劇本名稱 *</label>
            <input 
              type="text" 
              id="edit-script-title" 
              value="${this.escapeHtml(script.title)}"
              placeholder="例如：死者在幻夜中醒來"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
          </div>

          <!-- Cover Image Upload -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">劇本海報封面</label>
              <span class="text-[9px] text-slate-400">可更換海報或保留原圖</span>
            </div>

            <div class="flex items-center space-x-3">
              <label class="w-20 h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 flex flex-col items-center justify-center text-slate-400 cursor-pointer shrink-0 tap-scale bg-slate-50/50 dark:bg-slate-800/50">
                <i data-lucide="image-plus" class="w-6 h-6"></i>
                <span class="text-[9px] font-bold mt-1">更換封面</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  class="hidden" 
                  onchange="LarpModule.handleScriptCoverSelect(this)"
                >
              </label>

              <div id="script-cover-preview-box" class="flex-1">
                ${this.state.tempScriptCover ? `
                  <div class="relative w-20 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
                    <img src="${this.state.tempScriptCover}" alt="封面預覽" class="w-full h-full object-cover">
                    <button 
                      type="button" 
                      onclick="LarpModule.clearTempCover()" 
                      class="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white shadow-sm tap-scale"
                    >
                      <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                  </div>
                ` : `
                  <div class="text-[11px] text-slate-400 leading-relaxed">
                    若移除封面，系統將自動生成高質感幾何向量預設封面。
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Genre & Player Count -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">流派</label>
              <select id="edit-script-genre" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="本格" ${script.genre === '本格' ? 'selected' : ''}>本格</option>
                <option value="變格" ${script.genre === '變格' ? 'selected' : ''}>變格</option>
                <option value="新本格" ${script.genre === '新本格' ? 'selected' : ''}>新本格</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">總人數</label>
              <input 
                type="number" 
                id="edit-script-players" 
                min="1" 
                max="20" 
                value="${script.playerCount || charsCount}"
                oninput="LarpModule.handlePlayerCountChange(this.value)"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
              >
            </div>
          </div>

          <!-- Style / Types Multi-Select (風格標籤 - 可複選) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                劇本風格 (可複選) *
              </label>
              <span id="script-types-count-badge" class="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                已選 ${(this.state.tempScriptTypes || []).length} 個風格
              </span>
            </div>
            <div id="create-script-types-container" class="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
              ${this.renderTypeCheckChips()}
            </div>
          </div>

          <!-- Details: Character Setup, Duration, DM -->
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">角色男女配比</label>
              <input 
                type="text" 
                id="edit-script-setup" 
                placeholder="3男3女" 
                value="${this.escapeHtml(script.characterSetup || '')}"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
              >
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">遊玩時長</label>
              <input 
                type="text" 
                id="edit-script-duration" 
                placeholder="4 小時" 
                value="${this.escapeHtml(script.duration || '')}"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
              >
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">主持需求</label>
              <select id="edit-script-dm" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="true" ${script.needsDm ? 'selected' : ''}>需主持人</option>
                <option value="false" ${!script.needsDm ? 'selected' : ''}>免主持人</option>
              </select>
            </div>
          </div>

          <!-- 官方劇本介紹 (居中書寫) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                官方劇本介紹 (居中書寫) *
              </label>
              <span class="text-[9px] text-slate-400">文字居中顯示</span>
            </div>
            <textarea 
              id="edit-script-summary" 
              rows="5" 
              placeholder="填寫劇本官方故事大綱與背景介紹..."
              class="w-full px-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed tracking-wide"
            >${this.escapeHtml(script.summary || '')}</textarea>
          </div>

          <!-- 角色介紹 (動態新增與編輯) -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <div>
                <label id="create-script-chars-title" class="block text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                  角色介紹 (${charsCount} 位角色)
                </label>
                <p class="text-[10px] text-slate-400">可自由增刪角色或修改角色簡介</p>
              </div>
              <button 
                type="button" 
                onclick="LarpModule.addTempCharacterSlot()"
                class="tap-scale px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 text-[11px] font-bold flex items-center space-x-1"
              >
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>新增角色</span>
              </button>
            </div>

            <div id="create-script-characters-list" class="space-y-2.5">
              ${this.renderTempCharactersList()}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2 flex items-center space-x-2">
            <button 
              type="button"
              onclick="LarpModule.switchView('detail', '${script.id}')"
              class="tap-scale w-1/3 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs text-center"
            >
              取消
            </button>
            <button 
              type="button"
              onclick="LarpModule.submitEditScript('${script.id}')" 
              class="tap-scale flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center space-x-2 transition"
            >
              <i data-lucide="check" class="w-5 h-5"></i>
              <span>儲存修改</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // Lightbox Modal for Photo Zooming
  renderLightbox() {
    if (!this.state.lightboxImage) return '';
    return `
      <div 
        onclick="LarpModule.closeLightbox()"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in backdrop-blur-md cursor-pointer"
      >
        <div class="relative max-w-sm max-h-[85vh] flex flex-col items-center">
          <img 
            src="${this.state.lightboxImage.url}" 
            alt="放大照片" 
            class="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
          >
          <p class="text-xs text-white/80 font-bold mt-3 text-center">${this.state.lightboxImage.caption || ''}</p>
          <p class="text-[10px] text-white/50 mt-1">點擊任意處關閉</p>
        </div>
      </div>
    `;
  },

  // Logic & Event Handlers
  handleSearch(val) {
    this.state.searchQuery = val;
    this.renderView();
  },

  clearSearch() {
    this.state.searchQuery = '';
    this.renderView();
  },

  setFilterGenre(genre) {
    this.state.filterGenre = genre;
    this.renderView();
  },

  setFilterType(type) {
    this.toggleFilterType(type);
  },

  toggleFilterType(type) {
    if (type === 'all') {
      this.state.filterTypes = [];
      this.renderView();
      return;
    }
    if (!Array.isArray(this.state.filterTypes)) {
      this.state.filterTypes = [];
    }
    const idx = this.state.filterTypes.indexOf(type);
    if (idx >= 0) {
      this.state.filterTypes.splice(idx, 1);
    } else {
      this.state.filterTypes.push(type);
    }
    this.renderView();
  },

  setFilterStatus(status) {
    this.state.filterStatus = status;
    this.renderView();
  },

  setFilterPlayers(val) {
    this.state.filterPlayers = val;
    this.renderView();
  },

  setSortBy(val) {
    this.state.sortBy = val;
    this.renderView();
  },

  resetFilters() {
    this.state.searchQuery = '';
    this.state.filterGenre = 'all';
    this.state.filterTypes = [];
    this.state.filterStatus = 'all';
    this.state.filterPlayers = 'all';
    this.state.sortBy = 'rating';
    this.renderView();
  },

  getFilteredScripts() {
    return this.state.scripts
      .filter(s => {
        // Search query
        if (this.state.searchQuery) {
          const q = this.state.searchQuery.toLowerCase();
          const matchTitle = (s.title || '').toLowerCase().includes(q);
          const matchGenre = (s.genre || '').toLowerCase().includes(q);
          const matchType = (s.type || '').toLowerCase().includes(q) || this.getScriptTypes(s).some(t => t.toLowerCase().includes(q));
          const matchSummary = (s.summary || '').toLowerCase().includes(q);
          if (!matchTitle && !matchGenre && !matchType && !matchSummary) return false;
        }

        // Genre filter
        if (this.state.filterGenre !== 'all' && s.genre !== this.state.filterGenre) {
          return false;
        }

        // Style / Types filter (matches if script has ANY of the selected filter types)
        if (Array.isArray(this.state.filterTypes) && this.state.filterTypes.length > 0) {
          const scriptTypes = this.getScriptTypes(s);
          const hasMatch = this.state.filterTypes.some(ft => scriptTypes.includes(ft));
          if (!hasMatch) return false;
        }

        // Play status filter
        if (this.state.filterStatus === 'played' && !this.isPlayed(s)) {
          return false;
        }
        if (this.state.filterStatus === 'unplayed' && this.isPlayed(s)) {
          return false;
        }

        // Players filter
        if (this.state.filterPlayers !== 'all') {
          const p = s.playerCount;
          if (this.state.filterPlayers === '1-4' && p > 4) return false;
          if (this.state.filterPlayers === '5-6' && (p < 5 || p > 6)) return false;
          if (this.state.filterPlayers === '7-8' && (p < 7 || p > 8)) return false;
          if (this.state.filterPlayers === '9+' && p < 9) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (this.state.sortBy === 'rating') {
          const rA = this.calcAverageRating(a);
          const rB = this.calcAverageRating(b);
          const numA = rA === '?' ? -1 : Number(rA);
          const numB = rB === '?' ? -1 : Number(rB);
          return numB - numA;
        }
        if (this.state.sortBy === 'newest') {
          const dateA = this.getLatestPlayedDate(a);
          const dateB = this.getLatestPlayedDate(b);

          // Both have played dates: sort by newest played date descending
          if (dateA && dateB) {
            const timeDiff = new Date(dateB).getTime() - new Date(dateA).getTime();
            if (timeDiff !== 0) return timeDiff;
          }

          // A has played date, B does not: played scripts come first
          if (dateA && !dateB) return -1;
          // B has played date, A does not: played scripts come first
          if (!dateA && dateB) return 1;

          // Neither has played date (unplayed): sort by script creation time descending
          const timeA = new Date(a.createdAt || 0).getTime() || parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
          const timeB = new Date(b.createdAt || 0).getTime() || parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
          return timeB - timeA;
        }
        if (this.state.sortBy === 'created') {
          const timeA = new Date(a.createdAt || 0).getTime() || parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
          const timeB = new Date(b.createdAt || 0).getTime() || parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
          return timeB - timeA;
        }
        if (this.state.sortBy === 'players') {
          return a.playerCount - b.playerCount;
        }
        return 0;
      });
  },

  calcAverageRatings(script) {
    const reviews = script?.reviews || [];
    if (reviews.length === 0) return { overall: '?', logic: '?', story: '?' };

    const sumOverall = reviews.reduce((sum, r) => sum + (Number(r.ratingOverall !== undefined ? r.ratingOverall : r.rating) || 0), 0);
    const sumLogic = reviews.reduce((sum, r) => sum + (Number(r.ratingLogic !== undefined ? r.ratingLogic : (r.ratingOverall !== undefined ? r.ratingOverall : r.rating)) || 0), 0);
    const sumStory = reviews.reduce((sum, r) => sum + (Number(r.ratingStory !== undefined ? r.ratingStory : (r.ratingOverall !== undefined ? r.ratingOverall : r.rating)) || 0), 0);
    const count = reviews.length;

    return {
      overall: Number((sumOverall / count).toFixed(1)),
      logic: Number((sumLogic / count).toFixed(1)),
      story: Number((sumStory / count).toFixed(1))
    };
  },

  calcAverageRating(script) {
    return this.calcAverageRatings(script).overall;
  },

  revealSpoiler(reviewId) {
    this.state.revealedSpoilers.add(reviewId);
    this.renderView();
  },

  openLightbox(url, caption) {
    this.state.lightboxImage = { url, caption };
    this.renderView();
  },

  closeLightbox() {
    this.state.lightboxImage = null;
    this.renderView();
  },

  renderStars(rating) {
    const val = Number(rating) || 0;
    const full = Math.floor(val);
    const hasHalf = (val % 1) >= 0.3 && (val % 1) < 0.8;
    const roundUp = (val % 1) >= 0.8;
    const effectiveFull = full + (roundUp ? 1 : 0);
    const empty = Math.max(0, 5 - effectiveFull - (hasHalf ? 1 : 0));
    return '★'.repeat(effectiveFull) + (hasHalf ? '½' : '') + '☆'.repeat(empty);
  },

  renderRatingSliderRow(key, emoji, label, desc, val, accentClass, badgeBg) {
    const num = Number(val !== undefined ? val : 5).toFixed(1);
    return `
      <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 shadow-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5">
            <span class="text-sm">${emoji}</span>
            <span class="text-xs font-black text-slate-800 dark:text-slate-100">${label}</span>
            <span class="text-[9px] text-slate-400 hidden sm:inline">(${desc})</span>
          </div>
          <div class="flex items-center space-x-1.5">
            <span id="review-stars-${key}" class="text-xs text-amber-500 font-bold tracking-tight">
              ${this.renderStars(num)}
            </span>
            <span id="review-badge-${key}" class="px-2 py-0.5 rounded-md ${badgeBg} text-white font-black text-xs shadow-xs">
              ${num} ★
            </span>
          </div>
        </div>

        <div class="flex items-center space-x-2 pt-0.5">
          <button 
            type="button" 
            onclick="LarpModule.adjustTempRating('${key}', -0.1)"
            class="tap-scale px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs border border-slate-200 dark:border-slate-700"
            title="-0.1 分"
          >
            -0.1
          </button>

          <input 
            type="range" 
            id="rev-slider-${key}"
            min="0" 
            max="5" 
            step="0.1" 
            value="${num}"
            oninput="LarpModule.setTempReviewRating('${key}', this.value)"
            class="flex-1 ${accentClass} cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
          >

          <button 
            type="button" 
            onclick="LarpModule.adjustTempRating('${key}', 0.1)"
            class="tap-scale px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs border border-slate-200 dark:border-slate-700"
            title="+0.1 分"
          >
            +0.1
          </button>
        </div>
      </div>
    `;
  },

  openAddReviewModal() {
    this.state.showAddReviewModal = true;
    this.state.tempReviewPhotos = [];
    const draft = this._reviewDraft;
    const initialOverall = draft?.ratingOverall !== undefined 
      ? draft.ratingOverall 
      : (draft?.rating !== undefined ? draft.rating : 5.0);
    const initialLogic = draft?.ratingLogic !== undefined 
      ? draft.ratingLogic 
      : initialOverall;
    const initialStory = draft?.ratingStory !== undefined 
      ? draft.ratingStory 
      : initialOverall;

    this._tempRatings = {
      logic: Number(initialLogic),
      story: Number(initialStory),
      overall: Number(initialOverall)
    };
    document.querySelector('.bottom-nav')?.classList.add('translate-y-full', 'pointer-events-none');
    this.renderView();
  },

  closeAddReviewModal() {
    this.state.showAddReviewModal = false;
    this.state.tempReviewPhotos = [];
    this._reviewDraft = null;
    this._tempRatings = null;
    document.querySelector('.bottom-nav')?.classList.remove('translate-y-full', 'pointer-events-none');
    this.renderView();
  },

  setTempReviewRating(dimension, val) {
    if (!this._tempRatings) {
      this._tempRatings = { logic: 5.0, story: 5.0, overall: 5.0 };
    }
    const num = Math.max(0, Math.min(5, Math.round(Number(val) * 10) / 10));
    this._tempRatings[dimension] = num;
    if (this._reviewDraft) {
      if (dimension === 'logic') this._reviewDraft.ratingLogic = num;
      if (dimension === 'story') this._reviewDraft.ratingStory = num;
      if (dimension === 'overall') {
        this._reviewDraft.ratingOverall = num;
        this._reviewDraft.rating = num;
      }
    }

    const slider = document.getElementById(`rev-slider-${dimension}`);
    if (slider) slider.value = num;

    const badge = document.getElementById(`review-badge-${dimension}`);
    if (badge) badge.textContent = `${num.toFixed(1)} ★`;

    const stars = document.getElementById(`review-stars-${dimension}`);
    if (stars) stars.textContent = this.renderStars(num);
  },

  adjustTempRating(dimension, delta) {
    if (!this._tempRatings) {
      this._tempRatings = { logic: 5.0, story: 5.0, overall: 5.0 };
    }
    const current = Number(this._tempRatings[dimension] !== undefined ? this._tempRatings[dimension] : 5.0);
    this.setTempReviewRating(dimension, current + delta);
  },

  syncAllTempRatings(val) {
    const num = Math.max(0, Math.min(5, Math.round(Number(val) * 10) / 10));
    ['logic', 'story', 'overall'].forEach(dim => {
      this.setTempReviewRating(dim, num);
    });
  },

  renderReviewPhotoThumbnails() {
    return this.state.tempReviewPhotos.map((imgUrl, idx) => `
      <div class="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm group">
        <img src="${imgUrl}" alt="照片預覽" class="w-full h-full object-cover">
        <button 
          type="button"
          onclick="LarpModule.removeTempPhoto(${idx})"
          class="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white shadow-sm tap-scale"
        >
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>
    `).join('');
  },

  updateReviewPhotosPreview() {
    const list = document.getElementById('review-photos-preview-list');
    if (list) {
      list.innerHTML = this.renderReviewPhotoThumbnails();
      if (window.lucide) lucide.createIcons();
    }
  },

  async handleReviewPhotoSelect(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      App.showToast('正在優化壓縮照片...', 'info');
      const compressedDataUrl = await this.compressImage(file, 900, 0.75);
      this.state.tempReviewPhotos.push(compressedDataUrl);
      this.updateReviewPhotosPreview();
      input.value = '';
      App.showToast('照片已加入！', 'success');
    } catch (err) {
      App.showToast(err.message || '照片上傳失敗', 'error');
    }
  },

  removeTempPhoto(idx) {
    this.state.tempReviewPhotos.splice(idx, 1);
    this.updateReviewPhotosPreview();
  },

  async submitReview(scriptId) {
    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) return;

    const name = (document.getElementById('rev-input-name')?.value || '').trim() || '遊玩玩家';
    const date = document.getElementById('rev-input-date')?.value || new Date().toISOString().split('T')[0];
    const character = (document.getElementById('rev-input-character')?.value || '').trim();
    const content = (document.getElementById('rev-input-content')?.value || '').trim();
    const isSpoiler = document.getElementById('rev-input-spoiler')?.checked || false;

    const ratingLogic = Math.max(0, Math.min(5, Math.round(Number(this._tempRatings?.logic !== undefined ? this._tempRatings.logic : 5) * 10) / 10));
    const ratingStory = Math.max(0, Math.min(5, Math.round(Number(this._tempRatings?.story !== undefined ? this._tempRatings.story : 5) * 10) / 10));
    const ratingOverall = Math.max(0, Math.min(5, Math.round(Number(this._tempRatings?.overall !== undefined ? this._tempRatings.overall : 5) * 10) / 10));

    if (!content) {
      App.showToast('請填寫心得感想', 'warning');
      return;
    }

    const newReview = {
      id: 'rev-' + Date.now(),
      userName: name,
      playedDate: date,
      character: character,
      rating: ratingOverall,
      ratingOverall: ratingOverall,
      ratingLogic: ratingLogic,
      ratingStory: ratingStory,
      content: content,
      photos: [...this.state.tempReviewPhotos],
      isSpoiler: isSpoiler,
      createdAt: new Date().toISOString()
    };

    try {
      this.closeAddReviewModal();
      await App.showProgressBar({
        title: '正在發布遊玩心得...',
        subtitle: `正在將您在《${script.title}》的心得與照片同步至雲端`,
        durationMs: 5000,
        task: async () => {
          await this.supabaseRequest('/reviews', {
            method: 'POST',
            body: JSON.stringify(this.mapReviewToRow(newReview, scriptId))
          });
        }
      });

      if (!script.reviews) script.reviews = [];
      script.reviews.unshift(newReview);
      this.saveScripts();
      this.state.syncStatus = 'synced';
      this.renderView();
      App.showToast('🎉 心得已成功同步至雲端！', 'success');
      if ('vibrate' in navigator) navigator.vibrate(30);
    } catch (err) {
      console.error('[LARP Sync] Failed to sync review to Supabase:', err);
      this._reviewDraft = {
        name,
        date,
        character,
        content,
        isSpoiler,
        ratingLogic,
        ratingStory,
        ratingOverall
      };
      this.openAddReviewModal();
      App.showToast('發布失敗：' + (err.message || '雲端連線異常，請稍後再試'), 'error');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  initTempCharacters(count = 6) {
    const arr = [];
    const n = Math.max(1, Math.min(20, parseInt(count, 10) || 6));
    for (let i = 0; i < n; i++) {
      arr.push({ name: '', desc: '' });
    }
    this.state.tempCharacters = arr;
  },

  handlePlayerCountChange(val) {
    const count = Math.max(1, Math.min(20, parseInt(val, 10) || 1));
    if (!this.state.tempCharacters) this.state.tempCharacters = [];
    const current = this.state.tempCharacters;

    if (current.length < count) {
      for (let i = current.length; i < count; i++) {
        current.push({ name: '', desc: '' });
      }
    } else if (current.length > count) {
      current.splice(count);
    }
    this.state.tempCharacters = current;
    this.renderTempCharactersDOM();
  },

  addTempCharacterSlot() {
    if (!this.state.tempCharacters) this.state.tempCharacters = [];
    this.state.tempCharacters.push({ name: '', desc: '' });
    const count = this.state.tempCharacters.length;
    const playersInput = document.getElementById('new-script-players') || document.getElementById('edit-script-players');
    if (playersInput) playersInput.value = count;
    this.renderTempCharactersDOM();
  },

  removeTempCharacterSlot(idx) {
    if (!this.state.tempCharacters || this.state.tempCharacters.length <= 1) {
      App.showToast('至少保留一個角色欄位', 'info');
      return;
    }
    this.state.tempCharacters.splice(idx, 1);
    const count = this.state.tempCharacters.length;
    const playersInput = document.getElementById('new-script-players') || document.getElementById('edit-script-players');
    if (playersInput) playersInput.value = count;
    this.renderTempCharactersDOM();
  },

  updateTempCharacter(idx, field, val) {
    if (this.state.tempCharacters && this.state.tempCharacters[idx]) {
      this.state.tempCharacters[idx][field] = val;
    }
  },

  renderTempCharactersList() {
    const chars = this.state.tempCharacters || [];
    return chars.map((c, idx) => `
      <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-amber-500 uppercase tracking-wider">角色 ${idx + 1}</span>
          <button 
            type="button" 
            onclick="LarpModule.removeTempCharacterSlot(${idx})"
            class="text-slate-400 hover:text-red-500 tap-scale p-1 rounded-lg"
            title="移除此角色"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="sm:col-span-1">
            <input 
              type="text" 
              placeholder="角色姓名 (例: 姜宇桓)"
              value="${this.escapeHtml(c.name || '')}"
              oninput="LarpModule.updateTempCharacter(${idx}, 'name', this.value)"
              class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
            >
          </div>
          <div class="sm:col-span-2">
            <input 
              type="text" 
              placeholder="角色簡介/特點 (例: 香山市重案調查組探長)"
              value="${this.escapeHtml(c.desc || '')}"
              oninput="LarpModule.updateTempCharacter(${idx}, 'desc', this.value)"
              class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
            >
          </div>
        </div>
      </div>
    `).join('');
  },

  renderTempCharactersDOM() {
    const container = document.getElementById('create-script-characters-list');
    if (container) {
      container.innerHTML = this.renderTempCharactersList();
      if (window.lucide) lucide.createIcons();
    }
    const titleEl = document.getElementById('create-script-chars-title');
    if (titleEl && this.state.tempCharacters) {
      titleEl.textContent = `角色介紹 (${this.state.tempCharacters.length} 位角色)`;
    }
  },

  updateCoverPreviewDOM() {
    const box = document.getElementById('script-cover-preview-box');
    if (!box) return;
    if (this.state.tempScriptCover) {
      box.innerHTML = `
        <div class="relative w-20 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
          <img src="${this.state.tempScriptCover}" alt="封面預覽" class="w-full h-full object-cover">
          <button 
            type="button" 
            onclick="LarpModule.clearTempCover()"
            class="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white shadow-sm tap-scale"
          >
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>
      `;
    } else {
      box.innerHTML = `
        <div class="text-[11px] text-slate-400 leading-relaxed">
          可上傳官方海報或手機拍下的劇本書封，系統將在前端自動壓縮成 800px 輕量 WebP。
        </div>
      `;
    }
    if (window.lucide) lucide.createIcons();
  },

  async handleScriptCoverSelect(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      App.showToast('正在壓縮海報封面...', 'info');
      const compressed = await this.compressImage(file, 800, 0.8);
      this.state.tempScriptCover = compressed;
      this.updateCoverPreviewDOM();
      App.showToast('封面已就緒！', 'success');
    } catch (err) {
      App.showToast(err.message || '封面讀取失敗', 'error');
    }
  },

  clearTempCover() {
    this.state.tempScriptCover = null;
    this.updateCoverPreviewDOM();
  },

  renderTypeCheckChips() {
    const selected = Array.isArray(this.state.tempScriptTypes) ? this.state.tempScriptTypes : ['硬核'];
    return this.AVAILABLE_TYPES.map(t => {
      const isChecked = selected.includes(t);
      return `
        <button 
          type="button"
          onclick="LarpModule.toggleTempType('${t}')"
          class="tap-scale px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            isChecked 
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
          }"
        >
          <span>${isChecked ? '✓' : '+'}</span>
          <span>${t}</span>
        </button>
      `;
    }).join('');
  },

  toggleTempType(t) {
    if (!Array.isArray(this.state.tempScriptTypes)) {
      this.state.tempScriptTypes = [];
    }
    const idx = this.state.tempScriptTypes.indexOf(t);
    if (idx >= 0) {
      if (this.state.tempScriptTypes.length > 1) {
        this.state.tempScriptTypes.splice(idx, 1);
      } else {
        App.showToast('至少需選取一種風格標籤', 'warning');
        return;
      }
    } else {
      this.state.tempScriptTypes.push(t);
    }
    this.updateTypesChipsDOM();
  },

  updateTypesChipsDOM() {
    const container = document.getElementById('create-script-types-container');
    if (container) {
      container.innerHTML = this.renderTypeCheckChips();
    }
    const badge = document.getElementById('script-types-count-badge');
    if (badge) {
      const count = (this.state.tempScriptTypes || []).length;
      badge.textContent = `已選 ${count} 個風格`;
    }
  },

  async submitCreateScript() {
    if (!this.isAdmin()) {
      App.showToast('權限不足，僅限管理員新增劇本', 'error');
      return;
    }

    const title = (document.getElementById('new-script-title')?.value || '').trim();
    if (!title) {
      App.showToast('請填寫劇本名稱', 'warning');
      return;
    }

    const genre = document.getElementById('new-script-genre')?.value || '本格';
    const selectedTypes = (Array.isArray(this.state.tempScriptTypes) && this.state.tempScriptTypes.length > 0)
      ? [...this.state.tempScriptTypes]
      : ['硬核'];
    const type = selectedTypes.join(' · ');
    const players = parseInt(document.getElementById('new-script-players')?.value, 10) || 6;
    const setup = (document.getElementById('new-script-setup')?.value || '').trim() || `${Math.ceil(players/2)}男${Math.floor(players/2)}女`;
    const duration = (document.getElementById('new-script-duration')?.value || '').trim() || '4 小時';
    const needsDm = document.getElementById('new-script-dm')?.value === 'true';
    const summary = (document.getElementById('new-script-summary')?.value || '').trim() || '暫無劇本介紹。';

    // Collect characters
    const characters = (this.state.tempCharacters || [])
      .map(c => ({ name: (c.name || '').trim(), desc: (c.desc || '').trim() }))
      .filter(c => c.name || c.desc);

    // Generate cover if not uploaded
    const cover = this.state.tempScriptCover || this.createSvgCover(title, `${genre} · ${type}`, ['#1e1b4b', '#312e81', '#047857'], '🎭');

    const newScript = {
      id: 'script-' + Date.now(),
      title,
      cover,
      playerCount: players,
      characterSetup: setup,
      duration,
      genre,
      type,
      types: selectedTypes,
      needsDm,
      rating: 0,
      playedDate: '',
      summary,
      characters: characters,
      reviews: []
    };

    try {
      await App.showProgressBar({
        title: '正在建立劇本...',
        subtitle: `正在將劇本《${title}》上傳並同步至雲端資料庫`,
        durationMs: 5000,
        task: async () => {
          await this.supabaseRequest('/scripts', {
            method: 'POST',
            body: JSON.stringify(this.mapScriptToRow(newScript))
          });
        }
      });

      this.state.scripts.unshift(newScript);
      this.saveScripts();
      this.state.tempScriptCover = null;
      this.state.tempCharacters = [];
      this.state.tempScriptTypes = ['硬核'];
      this.state.syncStatus = 'synced';
      this.switchView('detail', newScript.id);
      App.showToast(`✅ 已成功建立劇本《${title}》！`, 'success');
      if ('vibrate' in navigator) navigator.vibrate(30);
    } catch (err) {
      console.warn('[LARP Sync] Failed to sync new script to Supabase:', err);
      App.showToast(`建立失敗：${err.message || '雲端連線異常，請稍後再試'}`, 'error');
    }
  },

  async submitEditScript(scriptId) {
    if (!this.isAdmin()) {
      App.showToast('權限不足，僅限管理員編輯劇本', 'error');
      return;
    }

    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) {
      App.showToast('找不到此劇本資料', 'error');
      return;
    }

    const title = (document.getElementById('edit-script-title')?.value || '').trim();
    if (!title) {
      App.showToast('請填寫劇本名稱', 'warning');
      return;
    }

    const genre = document.getElementById('edit-script-genre')?.value || '本格';
    const selectedTypes = (Array.isArray(this.state.tempScriptTypes) && this.state.tempScriptTypes.length > 0)
      ? [...this.state.tempScriptTypes]
      : ['硬核'];
    const type = selectedTypes.join(' · ');
    const players = parseInt(document.getElementById('edit-script-players')?.value, 10) || 6;
    const setup = (document.getElementById('edit-script-setup')?.value || '').trim() || `${Math.ceil(players/2)}男${Math.floor(players/2)}女`;
    const duration = (document.getElementById('edit-script-duration')?.value || '').trim() || '4 小時';
    const needsDm = document.getElementById('edit-script-dm')?.value === 'true';
    const summary = (document.getElementById('edit-script-summary')?.value || '').trim() || '暫無劇本介紹。';

    // Collect characters
    const characters = (this.state.tempCharacters || [])
      .map(c => ({ name: (c.name || '').trim(), desc: (c.desc || '').trim() }))
      .filter(c => c.name || c.desc);

    // Cover: use temp cover if user picked/cleared one, else existing cover, else fallback SVG
    const cover = (this.state.tempScriptCover !== undefined && this.state.tempScriptCover !== null)
      ? this.state.tempScriptCover
      : (script.cover || this.createSvgCover(title, `${genre} · ${type}`, ['#1e1b4b', '#312e81', '#047857'], '🎭'));

    const updatedRow = {
      title,
      cover,
      player_count: players,
      character_setup: setup,
      duration,
      genre,
      type: selectedTypes.join('、'),
      needs_dm: needsDm,
      summary,
      owner_review: (characters && characters.length > 0) ? { characters } : null
    };

    try {
      await App.showProgressBar({
        title: '正在更新劇本...',
        subtitle: `正在將劇本《${title}》修改內容同步至雲端資料庫`,
        durationMs: 5000,
        task: async () => {
          await this.supabaseRequest(`/scripts?id=eq.${encodeURIComponent(script.id)}`, {
            method: 'PATCH',
            body: JSON.stringify(updatedRow)
          });
        }
      });

      // Update in-memory script object (All existing reviews are 100% kept intact!)
      script.title = title;
      script.cover = cover;
      script.playerCount = players;
      script.characterSetup = setup;
      script.duration = duration;
      script.genre = genre;
      script.type = type;
      script.types = selectedTypes;
      script.needsDm = needsDm;
      script.summary = summary;
      script.characters = characters;

      this.saveScripts();
      this.state.tempScriptCover = null;
      this.state.tempCharacters = [];
      this.state.tempScriptTypes = ['硬核'];
      this.state.syncStatus = 'synced';
      this.switchView('detail', script.id);
      App.showToast(`✅ 已成功更新劇本《${title}》！`, 'success');
      if ('vibrate' in navigator) navigator.vibrate(30);
    } catch (err) {
      console.warn('[LARP Sync] Failed to update script in Supabase:', err);
      App.showToast(`更新失敗：${err.message || '雲端連線異常，請稍後再試'}`, 'error');
    }
  },

  deleteReview(reviewId) {
    if (!this.isAdmin()) {
      App.showToast('權限不足，僅限管理員移除心得', 'error');
      return;
    }

    const script = this.state.scripts.find(s => s.id === this.state.selectedScriptId);
    if (!script || !script.reviews) return;

    const targetReview = script.reviews.find(r => r.id === reviewId);
    const reviewerName = targetReview ? targetReview.userName : '此玩家';

    App.confirm({
      title: '確定要移除這筆心得嗎？',
      message: `即將刪除「${reviewerName}」的遊玩評價紀錄，此動作無法復原。`,
      confirmText: '確定移除',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await App.showProgressBar({
            title: '正在移除心得紀錄...',
            subtitle: `正在從雲端資料庫永久移除「${reviewerName}」的評價`,
            durationMs: 5000,
            task: async () => {
              await this.supabaseRequest(`/reviews?id=eq.${encodeURIComponent(reviewId)}`, {
                method: 'DELETE'
              });
            }
          });

          script.reviews = script.reviews.filter(r => r.id !== reviewId);
          this.saveScripts();
          this.renderView();
          App.showToast('✅ 已成功移除心得紀錄！', 'success');
          if ('vibrate' in navigator) navigator.vibrate(30);
        } catch (err) {
          console.error('[LARP Delete] Error deleting review:', err);
          App.showToast('移除失敗：' + (err.message || '雲端連線異常，請稍後再試'), 'error');
        }
      }
    });
  },

  deleteScript(scriptId) {
    if (!this.isAdmin()) {
      App.showToast('權限不足，僅限管理員刪除劇本', 'error');
      return;
    }

    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) return;

    App.confirm({
      title: `確定要刪除劇本《${script.title}》嗎？`,
      message: '刪除後此劇本及其所有心得評價將自雲端資料庫一併永久移除。',
      confirmText: '確定刪除',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await App.showProgressBar({
            title: '正在刪除劇本...',
            subtitle: `正在從雲端資料庫永久刪除《${script.title}》及所有評價`,
            durationMs: 5000,
            task: async () => {
              await this.supabaseRequest(`/scripts?id=eq.${encodeURIComponent(scriptId)}`, {
                method: 'DELETE'
              });
            }
          });

          this.state.scripts = this.state.scripts.filter(s => s.id !== scriptId);
          this.saveScripts();
          this.switchView('list');
          App.showToast(`✅ 已成功刪除劇本《${script.title}》！`, 'success');
          if ('vibrate' in navigator) navigator.vibrate(30);
        } catch (err) {
          console.error('[LARP Delete] Error deleting script:', err);
          App.showToast('刪除失敗：' + (err.message || '雲端連線異常，請稍後再試'), 'error');
        }
      }
    });
  },

  copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => this.fallbackCopyToClipboard(text));
    }
    return Promise.resolve(this.fallbackCopyToClipboard(text));
  },

  fallbackCopyToClipboard(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return !!successful;
    } catch (e) {
      console.warn('[Clipboard] Fallback copy failed:', e);
      return false;
    }
  },

  shareScript(scriptId) {
    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) return;

    // Generate absolute direct URL to this script detail
    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const shareUrl = `${baseUrl}#larp/${encodeURIComponent(script.id)}`;

    this.copyToClipboard(shareUrl).then((success) => {
      if (success) {
        App.showToast(`🔗 已複製《${script.title}》劇本專屬頁面連結！`, 'success');
        if ('vibrate' in navigator) navigator.vibrate(20);
      } else {
        window.prompt('請複製此劇本專屬頁面連結：', shareUrl);
      }
    });
  },

  resetToDemoData() {
    App.confirm({
      title: '確定要重新整理劇本資料嗎？',
      message: '這將會自雲端資料庫重新抓取您已建立的所有真實劇本。',
      confirmText: '確定重新整理',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          await this.syncWithSupabase(true);
        } catch (e) {
          App.showToast('整理失敗：' + (e.message || '雲端連線異常'), 'error');
        }
      }
    });
  }
};
