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

  state: {
    currentView: 'list', // 'list' | 'detail' | 'create'
    selectedScriptId: null,
    searchQuery: '',
    filterGenre: 'all',
    filterType: 'all',
    filterPlayers: 'all',
    sortBy: 'rating', // 'rating' | 'newest' | 'players'
    scripts: [],
    lightboxImage: null,
    revealedSpoilers: new Set(),
    tempReviewPhotos: [],
    tempScriptCover: null,
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
    this.syncWithSupabase();
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

  // Get Default Seed / Demo Scripts
  getDefaultScripts() {
    return [
      {
        id: 'script-1',
        title: '年輪',
        cover: this.createSvgCover('年輪', '經典本格 · 推理天花板', ['#0f172a', '#1e293b', '#0284c7'], '🌲'),
        playerCount: 5,
        characterSetup: '3男 2女（可反串）',
        duration: '4.5 ~ 5.5 小時',
        genre: '本格',
        type: '硬核',
        needsDm: true,
        difficulty: '★★★★★',
        rating: 4.9,
        playedDate: '2024-02-18',
        summary: '幾百年前的大火，荒廢已久的袁家大宅。五名各懷心事的男女因一封神祕邀請函聚首。大雪封山，五芒星陣中出現了離奇的焦黑屍體...時間與空間交錯，究竟誰是縱火者？誰又是受害者？',
        ownerReview: {
          character: '常思平',
          rating: 5.0,
          content: '毫無疑問的硬核本格天花板！時間線密不透風，每一條線索都能完美閉環。核心詭計揭開的那一刻全身起雞皮疙瘩，非常考驗盤邏輯的耐心與大局觀。',
          caution: '極度不建議新手直接開局，適合熱愛盤時間線與硬核還原的重度推理玩家。'
        },
        reviews: [
          {
            id: 'rev-101',
            userName: '阿倫',
            playedDate: '2024-02-18',
            character: '江成',
            rating: 5,
            content: '盤到半夜兩點腦袋快燒乾，但真的是神作！DM 的扶車時機抓得很好，最後復盤大家拍手叫好！',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-02-19T10:30:00Z'
          },
          {
            id: 'rev-102',
            userName: '欣怡',
            playedDate: '2024-02-18',
            character: '姚月華',
            rating: 4.8,
            content: '故事真相揭曉時真的太震撼了，人物之間的宿命感讓人唏噓，雖然是硬核本但也帶有一絲哀傷。',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-02-19T14:10:00Z'
          }
        ]
      },
      {
        id: 'script-2',
        title: '告別詩',
        cover: this.createSvgCover('告別詩', '青春遺憾 · 情感天花板', ['#4c0519', '#881337', '#e11d48'], '🌸'),
        playerCount: 6,
        characterSetup: '3男 3女（不建議反串）',
        duration: '4.5 ~ 5 小時',
        genre: '新本格',
        type: '情感',
        needsDm: true,
        difficulty: '★★★☆☆',
        rating: 4.8,
        playedDate: '2024-03-08',
        summary: '十七歲那年的盛夏，教室天花板旋轉的風扇，操場邊的落櫻，以及沒能說出口的告白。多年後重逢在致遠中學校園，那些斑駁的青春記憶，伴隨著一首寫滿遺憾的告別詩重新翻開...',
        ownerReview: {
          character: '陸澤遠',
          rating: 4.8,
          content: '哭得不能自已！角色之間的羈絆描寫極為細膩，沒有刻意的狗血煽情，全都是青春裡最純粹、最真實的遺憾與溫暖。整車朋友哭掉兩包衛生紙。',
          caution: '請找能沉浸、願意認真讀本的角色扮演型玩家，吃親情或青春校園線的必玩。'
        },
        reviews: [
          {
            id: 'rev-201',
            userName: '小安',
            playedDate: '2024-03-08',
            character: '蘇晴晴',
            rating: 5,
            content: '哭到妝全花掉了... 陸澤遠那段獨白直接擊中淚點。如果時間能倒流，我們是不是就不會走散了？',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-03-09T09:20:00Z'
          },
          {
            id: 'rev-202',
            userName: 'Kev',
            playedDate: '2024-03-08',
            character: '余樂天',
            rating: 4.5,
            content: '歡樂前半段，後半段大反轉刀到不行。情感鋪陳非常自然，非常推薦給想要沉浸情感的玩家！',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-03-09T18:00:00Z'
          }
        ]
      },
      {
        id: 'script-3',
        title: '木夕僧之戲',
        cover: this.createSvgCover('木夕僧之戲', '日式民俗 · 暴風雪山莊', ['#1e1b4b', '#312e81', '#4338ca'], '🏮'),
        playerCount: 6,
        characterSetup: '4男 2女',
        duration: '4 ~ 4.5 小時',
        genre: '變格',
        type: '還原',
        needsDm: true,
        difficulty: '★★★★☆',
        rating: 4.6,
        playedDate: '2024-01-20',
        summary: '深山古寺木夕寺，每逢祭典之夜必有僧人戴著般若面具現身。暴風雪之夜，六位香客受困於寺院深處，恐怖的民俗傳說化為現實，寺內的鐘聲每響一聲，便有一人離奇殞命...',
        ownerReview: {
          character: '藤原一郎',
          rating: 4.6,
          content: '氣氛營造非常優秀！日式和風怪談的氛圍感十足，核詭設計精巧，變格世界觀下的邏輯自洽度相當高。',
          caution: '稍微有一點微微恐與驚悚民俗氛圍，膽小玩家不用太擔心，主要是氛圍感而非實體搜證驚嚇。'
        },
        reviews: [
          {
            id: 'rev-301',
            userName: '威廉',
            playedDate: '2024-01-20',
            character: '空海',
            rating: 4.5,
            content: '日式氛圍滿分！推理環節比想像中嚴密，最後的還原反轉相當出人意料。',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-01-21T11:00:00Z'
          }
        ]
      },
      {
        id: 'script-4',
        title: '青樓',
        cover: this.createSvgCover('青樓', '古風陣營 · 爆笑撕逼機制', ['#450a0a', '#7f1d1d', '#b91c1c'], '🪭'),
        playerCount: 7,
        characterSetup: '4男 3女（歡樂反串佳）',
        duration: '4 ~ 4.5 小時',
        genre: '本格',
        type: '歡樂',
        needsDm: true,
        difficulty: '★★☆☆☆',
        rating: 4.5,
        playedDate: '2024-04-12',
        summary: '長安城第一花樓「春風閣」，一年一度的花魁大賽今夜舉行！各路達官顯貴、紈絝子弟、神秘豪客紛紛捧場。拍賣喊價、偷雞摸狗、暗通款曲，究竟誰能拔得頭籌？今夜注定笑鬧不斷！',
        ownerReview: {
          character: '司徒少爺',
          rating: 4.5,
          content: '全場從頭笑到尾！機制環節非常歡樂，私聊勾心鬥角和拍賣撕逼讓人欲罷不能，完全不需要動腦，下班放鬆首選！',
          caution: '極度適合熟人開車、放得開互相吐槽的朋友。兇案只是點綴，勝負全看誰會嘴與機制博弈。'
        },
        reviews: [
          {
            id: 'rev-401',
            userName: '小夏',
            playedDate: '2024-04-12',
            character: '玉嬌娘',
            rating: 5,
            content: '反串演少爺笑翻全場！道具跟拍賣機制太有趣了，大家為了搶花魁根本不顧兄弟情義哈哈！',
            photos: [],
            isSpoiler: false,
            createdAt: '2024-04-13T02:15:00Z'
          }
        ]
      }
    ];
  },

  // Load from local storage or initialize with defaults
  loadScripts() {
    const saved = StorageManager.get(this.STORAGE_KEY, null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      this.state.scripts = saved;
    } else {
      this.state.scripts = this.getDefaultScripts();
      this.saveScripts();
    }
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

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase error (${res.status}): ${errText}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  },

  mapRowToScript(row, reviews = []) {
    return {
      id: row.id,
      title: row.title,
      cover: row.cover,
      playerCount: row.player_count,
      characterSetup: row.character_setup || '',
      duration: row.duration || '4 小時',
      genre: row.genre,
      type: row.type,
      needsDm: !!row.needs_dm,
      difficulty: row.difficulty || '★★★☆☆',
      rating: parseFloat(row.rating) || 4.5,
      playedDate: row.played_date || '',
      summary: row.summary || '',
      ownerReview: row.owner_review || null,
      createdAt: row.created_at,
      reviews: reviews
    };
  },

  mapScriptToRow(script) {
    const playedDate = (script.playedDate && script.playedDate.length === 10) 
      ? script.playedDate 
      : new Date().toISOString().split('T')[0];

    return {
      id: script.id,
      title: script.title,
      cover: script.cover || null,
      player_count: parseInt(script.playerCount, 10) || 6,
      character_setup: script.characterSetup || '',
      duration: script.duration || '4 小時',
      genre: script.genre || '本格',
      type: script.type || '硬核',
      needs_dm: !!script.needsDm,
      difficulty: script.difficulty || '★★★☆☆',
      rating: parseFloat(script.rating) || 4.5,
      played_date: playedDate,
      summary: script.summary || '',
      owner_review: script.ownerReview || null
    };
  },

  mapRowToReview(row) {
    let photos = [];
    if (Array.isArray(row.photos)) {
      photos = row.photos;
    } else if (typeof row.photos === 'string') {
      try { photos = JSON.parse(row.photos); } catch(e) { photos = []; }
    }

    return {
      id: row.id,
      userName: row.user_name || '遊玩玩家',
      playedDate: row.played_date || '',
      character: row.character || '',
      rating: parseFloat(row.rating) || 5.0,
      content: row.content || '',
      photos: photos,
      isSpoiler: !!row.is_spoiler,
      createdAt: row.created_at
    };
  },

  mapReviewToRow(review, scriptId) {
    const playedDate = (review.playedDate && review.playedDate.length === 10) 
      ? review.playedDate 
      : new Date().toISOString().split('T')[0];

    return {
      id: review.id,
      script_id: scriptId,
      user_name: review.userName || '遊玩玩家',
      played_date: playedDate,
      character: review.character || '',
      rating: parseFloat(review.rating) || 5.0,
      content: review.content || '',
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

      // 2. If remote database is completely empty (first run), auto-seed default scripts!
      if (!remoteScripts || remoteScripts.length === 0) {
        console.log('[LARP Sync] Supabase database is empty. Auto-seeding defaults...');
        await this.seedSupabaseDefaults();
        const [seededScripts, seededReviews] = await Promise.all([
          this.supabaseRequest('/scripts?select=*&order=created_at.desc'),
          this.supabaseRequest('/reviews?select=*&order=created_at.desc')
        ]);
        this.processRemoteData(seededScripts, seededReviews);
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

    const assembledScripts = (remoteScripts || []).map(row => {
      const revs = reviewsByScriptId[row.id] || [];
      return this.mapRowToScript(row, revs);
    });

    this.state.scripts = assembledScripts;
    this.saveScripts();
  },

  async seedSupabaseDefaults() {
    const defaults = this.getDefaultScripts();
    const scriptRows = defaults.map(s => this.mapScriptToRow(s));

    // Batch insert scripts
    await this.supabaseRequest('/scripts', {
      method: 'POST',
      body: JSON.stringify(scriptRows)
    });

    // Batch insert default reviews
    const reviewRows = [];
    defaults.forEach(s => {
      if (s.reviews && s.reviews.length > 0) {
        s.reviews.forEach(r => {
          reviewRows.push(this.mapReviewToRow(r, s.id));
        });
      }
    });

    if (reviewRows.length > 0) {
      await this.supabaseRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewRows)
      });
    }
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
  switchView(view, scriptId = null) {
    this.state.currentView = view;
    if (scriptId) this.state.selectedScriptId = scriptId;
    this.state.showAddReviewModal = false;
    this.state.tempReviewPhotos = [];
    this.state.tempScriptCover = null;
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

          <!-- Type Filters (類型) -->
          <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">類型:</span>
            ${['all', '硬核', '情感', '還原', '歡樂', '陣營', '恐怖', '機制'].map(t => `
              <button 
                onclick="LarpModule.setFilterType('${t}')"
                class="tap-scale shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                  this.state.filterType === t 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800'
                }"
              >
                ${t === 'all' ? '全部類型' : t}
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
                <option value="players" ${this.state.sortBy === 'players' ? 'selected' : ''}>人數多寡</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Script Cards List -->
        <div class="space-y-3 pt-1">
          ${filteredScripts.length === 0 ? `
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

    return `
      <div 
        onclick="LarpModule.switchView('detail', '${script.id}')"
        class="tap-scale group relative flex space-x-3.5 p-3.5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <!-- Poster Thumbnail -->
        <div class="w-20 h-28 rounded-2xl overflow-hidden shrink-0 shadow-md border border-slate-200/50 dark:border-slate-700/50 relative bg-slate-900">
          <img src="${script.cover}" alt="${script.title}" class="w-full h-full object-cover">
          <div class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-black text-amber-400 flex items-center space-x-0.5">
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
              <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                ${script.playerCount} 人
              </span>
            </div>

            <!-- Tags -->
            <div class="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
              <span class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 text-[10px] font-bold">
                ${script.genre}
              </span>
              <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40 text-[10px] font-bold">
                ${script.type}
              </span>
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
            <span>遊玩時長: ${script.duration || '約 4 小時'}</span>
            <span class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
              <i data-lucide="message-circle" class="w-3 h-3"></i>
              <span>${reviewsCount} 則心得</span>
            </span>
          </div>
        </div>
      </div>
    `;
  },

  // View 2: Script Details View
  renderDetailView() {
    const script = this.state.scripts.find(s => s.id === this.state.selectedScriptId);
    if (!script) {
      return `
        <div class="text-center py-12 space-y-3">
          <p class="text-xs text-slate-400">找不到此劇本資料</p>
          <button onclick="LarpModule.switchView('list')" class="text-xs font-bold text-emerald-500 underline">返回列表</button>
        </div>
      `;
    }

    const avgRating = this.calcAverageRating(script);
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
                onclick="LarpModule.deleteScript('${script.id}')" 
                class="tap-scale p-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/40" 
                title="管理員：刪除此劇本"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}

            <button onclick="LarpModule.shareScript('${script.id}')" class="tap-scale p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title="複製劇本資訊">
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
              class="w-28 h-40 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-slate-200/60 dark:border-slate-700/60 cursor-pointer relative group"
            >
              <img src="${script.cover}" alt="${script.title}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <i data-lucide="zoom-in" class="w-6 h-6 text-white"></i>
              </div>
            </div>

            <!-- Core Specs -->
            <div class="flex-1 space-y-2 min-w-0">
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white leading-tight">${script.title}</h2>
                <div class="flex items-center space-x-1 text-amber-500 font-black text-sm mt-0.5">
                  <span>★</span>
                  <span>${avgRating}</span>
                  <span class="text-[10px] text-slate-400 font-normal">(${reviews.length + 1} 則評價)</span>
                </div>
              </div>

              <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">配置:</span>
                  <span class="font-bold">${script.playerCount} 人 (${script.characterSetup || '男女不限'})</span>
                </div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">流派:</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">${script.genre} · ${script.type}</span>
                </div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">時長:</span>
                  <span>${script.duration || '約 4 小時'}</span>
                </div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-slate-400 text-[10px] font-bold">主持:</span>
                  <span>${script.needsDm ? '🎙️ 需專業 DM 帶本' : '無需 DM (自動帶本)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Synopsis Card (故事背景) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
            <i data-lucide="file-text" class="w-4 h-4 text-emerald-500"></i>
            <span>故事背景大綱</span>
          </h3>
          <p class="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
            ${script.summary}
          </p>
        </div>

        <!-- Owner's Perspective & Review (版主特評與排雷) -->
        ${script.ownerReview ? `
          <div class="rounded-3xl bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/10 p-4 border border-amber-200/80 dark:border-amber-900/40 shadow-sm space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1.5">
                <span class="text-base">👑</span>
                <span class="text-xs font-black text-amber-900 dark:text-amber-200">版主深度評語</span>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                角色：${script.ownerReview.character} · 給分 ${script.ownerReview.rating}★
              </span>
            </div>

            <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              ${script.ownerReview.content}
            </p>

            ${script.ownerReview.caution ? `
              <div class="p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-start space-x-1.5">
                <span class="shrink-0">⚠️</span>
                <span><strong>體驗建議：</strong>${script.ownerReview.caution}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

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
    const starString = '★'.repeat(Math.round(rev.rating)) + '☆'.repeat(5 - Math.round(rev.rating));

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

          <div class="flex items-center space-x-1.5">
            <!-- Stars -->
            <div class="text-xs text-amber-500 font-black tracking-tight" title="${rev.rating} 顆星">
              ${starString}
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
  renderAddReviewModal(script) {
    const settings = StorageManager.get('settings', { userName: '遊玩玩家' });
    const defaultName = settings.userName || '遊玩玩家';
    const todayStr = new Date().toISOString().split('T')[0];

    return `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar space-y-4">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 class="text-sm font-black text-slate-900 dark:text-white">新增遊玩心得</h3>
              <p class="text-[10px] text-slate-400">劇本：《${script.title}》</p>
            </div>
            <button onclick="LarpModule.closeAddReviewModal()" class="p-1 rounded-full text-slate-400 hover:text-slate-600 tap-scale">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Form Fields -->
          <div class="space-y-3.5">
            <!-- User Name & Play Date -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">您的暱稱</label>
                <input 
                  type="text" 
                  id="rev-input-name" 
                  value="${defaultName}"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">遊玩日期</label>
                <input 
                  type="date" 
                  id="rev-input-date" 
                  value="${todayStr}"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
              </div>
            </div>

            <!-- Character Played & Star Rating -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">飾演角色 (選填)</label>
                <input 
                  type="text" 
                  id="rev-input-character" 
                  placeholder="例如：陸澤遠"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">評分打星 (1~5)</label>
                <div class="flex items-center space-x-1 py-1.5">
                  ${[1, 2, 3, 4, 5].map(star => `
                    <button 
                      type="button"
                      onclick="LarpModule.setTempReviewRating(${star})"
                      id="star-btn-${star}"
                      class="text-xl tap-scale transition ${star <= (this._tempRating || 5) ? 'text-amber-400 scale-110' : 'text-slate-300 dark:text-slate-600'}"
                    >
                      ★
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Review Text Area -->
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">心得評語 (100% 自由發揮)</label>
              <textarea 
                id="rev-input-content" 
                rows="3" 
                placeholder="分享你的推理過程、角色情感或現場打卡體驗..."
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              ></textarea>
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
              <input type="checkbox" id="rev-input-spoiler" class="w-4 h-4 accent-emerald-600 rounded">
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
                    accept="image/*" 
                    class="hidden" 
                    onchange="LarpModule.handleReviewPhotoSelect(this)"
                  >
                </label>

                <!-- Thumbnails of Selected Photos -->
                ${this.state.tempReviewPhotos.map((imgUrl, idx) => `
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
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
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

              ${this.state.tempScriptCover ? `
                <div class="relative w-20 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
                  <img src="${this.state.tempScriptCover}" alt="封面預覽" class="w-full h-full object-cover">
                  <button 
                    onclick="LarpModule.clearTempCover()"
                    class="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white shadow-sm tap-scale"
                  >
                    <i data-lucide="x" class="w-3 h-3"></i>
                  </button>
                </div>
              ` : `
                <div class="text-[11px] text-slate-400 leading-relaxed">
                  可上傳官方海報或手機拍下的劇本書封，系統將在前端自動壓縮成 1000px 輕量 WebP。
                </div>
              `}
            </div>
          </div>

          <!-- Genre, Type & Player Count -->
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">流派</label>
              <select id="new-script-genre" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="本格">本格</option>
                <option value="變格">變格</option>
                <option value="新本格">新本格</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">類型</label>
              <select id="new-script-type" class="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none">
                <option value="硬核">硬核</option>
                <option value="情感">情感</option>
                <option value="還原">還原</option>
                <option value="歡樂">歡樂</option>
                <option value="陣營">陣營</option>
                <option value="恐怖">恐怖</option>
                <option value="機制">機制</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">總人數</label>
              <input 
                type="number" 
                id="new-script-players" 
                min="1" 
                max="20" 
                value="6"
                class="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
              >
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

          <!-- Summary Synopsis -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">故事背景簡介</label>
            <textarea 
              id="new-script-summary" 
              rows="3" 
              placeholder="簡述劇本的世界觀、主要案件背景..."
              class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
            ></textarea>
          </div>

          <!-- Owner's Personal Review -->
          <div class="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 space-y-2.5">
            <div class="flex items-center space-x-1 text-xs font-bold text-amber-900 dark:text-amber-200">
              <span>👑</span>
              <span>版主個人心得評語 (選填)</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <input 
                type="text" 
                id="new-script-owner-char" 
                placeholder="我的飾演角色 (如: 李逍遙)"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
              >
              <input 
                type="number" 
                id="new-script-owner-rating" 
                step="0.1" 
                min="1" 
                max="5" 
                value="4.5" 
                placeholder="個人評分 1~5"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
              >
            </div>

            <textarea 
              id="new-script-owner-content" 
              rows="2" 
              placeholder="版主個人深度體驗、推薦亮點或避雷建議..."
              class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
            ></textarea>
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
    this.state.filterType = type;
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
    this.state.filterType = 'all';
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
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchGenre = s.genre.toLowerCase().includes(q);
          const matchType = s.type.toLowerCase().includes(q);
          const matchSummary = (s.summary || '').toLowerCase().includes(q);
          if (!matchTitle && !matchGenre && !matchType && !matchSummary) return false;
        }

        // Genre filter
        if (this.state.filterGenre !== 'all' && s.genre !== this.state.filterGenre) {
          return false;
        }

        // Type filter
        if (this.state.filterType !== 'all' && s.type !== this.state.filterType) {
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
          return this.calcAverageRating(b) - this.calcAverageRating(a);
        }
        if (this.state.sortBy === 'newest') {
          return new Date(b.playedDate || 0) - new Date(a.playedDate || 0);
        }
        if (this.state.sortBy === 'players') {
          return a.playerCount - b.playerCount;
        }
        return 0;
      });
  },

  calcAverageRating(script) {
    const reviews = script.reviews || [];
    const ownerRating = script.ownerReview?.rating || script.rating || 5;
    if (reviews.length === 0) return Number(ownerRating.toFixed(1));

    const total = reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), ownerRating);
    return Number((total / (reviews.length + 1)).toFixed(1));
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

  openAddReviewModal() {
    this.state.showAddReviewModal = true;
    this.state.tempReviewPhotos = [];
    this._tempRating = 5;
    this.renderView();
  },

  closeAddReviewModal() {
    this.state.showAddReviewModal = false;
    this.state.tempReviewPhotos = [];
    this.renderView();
  },

  setTempReviewRating(val) {
    this._tempRating = val;
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`star-btn-${i}`);
      if (el) {
        if (i <= val) {
          el.className = 'text-xl tap-scale transition text-amber-400 scale-110';
        } else {
          el.className = 'text-xl tap-scale transition text-slate-300 dark:text-slate-600';
        }
      }
    }
  },

  async handleReviewPhotoSelect(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      App.showToast('正在優化壓縮照片...', 'info');
      const compressedDataUrl = await this.compressImage(file, 900, 0.75);
      this.state.tempReviewPhotos.push(compressedDataUrl);
      this.renderView();
      App.showToast('照片壓縮已就緒！', 'success');
    } catch (err) {
      App.showToast(err.message || '照片上傳失敗', 'error');
    }
  },

  removeTempPhoto(idx) {
    this.state.tempReviewPhotos.splice(idx, 1);
    this.renderView();
  },

  submitReview(scriptId) {
    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) return;

    const name = (document.getElementById('rev-input-name')?.value || '').trim() || '遊玩玩家';
    const date = document.getElementById('rev-input-date')?.value || new Date().toISOString().split('T')[0];
    const character = (document.getElementById('rev-input-character')?.value || '').trim();
    const content = (document.getElementById('rev-input-content')?.value || '').trim();
    const isSpoiler = document.getElementById('rev-input-spoiler')?.checked || false;
    const rating = this._tempRating || 5;

    if (!content) {
      App.showToast('請填寫心得感想', 'warning');
      return;
    }

    if (!script.reviews) script.reviews = [];
    const newReview = {
      id: 'rev-' + Date.now(),
      userName: name,
      playedDate: date,
      character: character,
      rating: rating,
      content: content,
      photos: [...this.state.tempReviewPhotos],
      isSpoiler: isSpoiler,
      createdAt: new Date().toISOString()
    };

    script.reviews.unshift(newReview);
    this.saveScripts();

    this.closeAddReviewModal();
    App.showToast('🎉 心得評價發布成功！', 'success');
    if ('vibrate' in navigator) navigator.vibrate(30);

    // Sync to Supabase in background
    this.supabaseRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify(this.mapReviewToRow(newReview, scriptId))
    }).then(() => {
      this.state.syncStatus = 'synced';
    }).catch(err => {
      console.warn('[LARP Sync] Failed to sync review to Supabase:', err);
    });
  },

  async handleScriptCoverSelect(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      App.showToast('正在壓縮海報封面...', 'info');
      const compressed = await this.compressImage(file, 800, 0.8);
      this.state.tempScriptCover = compressed;
      this.renderView();
      App.showToast('封面已就緒！', 'success');
    } catch (err) {
      App.showToast(err.message || '封面讀取失敗', 'error');
    }
  },

  clearTempCover() {
    this.state.tempScriptCover = null;
    this.renderView();
  },

  submitCreateScript() {
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
    const type = document.getElementById('new-script-type')?.value || '硬核';
    const players = parseInt(document.getElementById('new-script-players')?.value, 10) || 6;
    const setup = (document.getElementById('new-script-setup')?.value || '').trim() || `${Math.ceil(players/2)}男${Math.floor(players/2)}女`;
    const duration = (document.getElementById('new-script-duration')?.value || '').trim() || '4 小時';
    const needsDm = document.getElementById('new-script-dm')?.value === 'true';
    const summary = (document.getElementById('new-script-summary')?.value || '').trim() || '暫無劇本簡介。';

    const ownerChar = (document.getElementById('new-script-owner-char')?.value || '').trim();
    const ownerRating = parseFloat(document.getElementById('new-script-owner-rating')?.value) || 4.5;
    const ownerContent = (document.getElementById('new-script-owner-content')?.value || '').trim();

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
      needsDm,
      rating: ownerRating,
      playedDate: new Date().toISOString().split('T')[0],
      summary,
      ownerReview: ownerContent ? {
        character: ownerChar || '版主',
        rating: ownerRating,
        content: ownerContent,
        caution: ''
      } : null,
      reviews: []
    };

    this.state.scripts.unshift(newScript);
    this.saveScripts();

    this.state.tempScriptCover = null;
    this.switchView('detail', newScript.id);
    App.showToast(`已成功建立劇本《${title}》！`, 'success');

    // Sync to Supabase in background
    this.supabaseRequest('/scripts', {
      method: 'POST',
      body: JSON.stringify(this.mapScriptToRow(newScript))
    }).then(() => {
      this.state.syncStatus = 'synced';
    }).catch(err => {
      console.warn('[LARP Sync] Failed to sync new script to Supabase:', err);
    });
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
      onConfirm: () => {
        script.reviews = script.reviews.filter(r => r.id !== reviewId);
        this.saveScripts();
        this.renderView();
        App.showToast('已成功移除心得紀錄', 'success');
        if ('vibrate' in navigator) navigator.vibrate(30);

        // Delete from Supabase
        this.supabaseRequest(`/reviews?id=eq.${encodeURIComponent(reviewId)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.warn('[LARP Sync] Failed to delete review from Supabase:', err);
        });
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
      message: '刪除後此劇本及其所有心得評價將一併移除，無法復原。',
      confirmText: '確定刪除',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: () => {
        this.state.scripts = this.state.scripts.filter(s => s.id !== scriptId);
        this.saveScripts();
        this.switchView('list');
        App.showToast(`已刪除劇本《${script.title}》`, 'success');

        // Delete from Supabase (cascades to reviews automatically)
        this.supabaseRequest(`/scripts?id=eq.${encodeURIComponent(scriptId)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.warn('[LARP Sync] Failed to delete script from Supabase:', err);
        });
      }
    });
  },

  shareScript(scriptId) {
    const script = this.state.scripts.find(s => s.id === scriptId);
    if (!script) return;
    const text = `【劇本殺推薦】《${script.title}》\n人數：${script.playerCount}人 (${script.characterSetup})\n類型：${script.genre} · ${script.type}\n評分：${this.calcAverageRating(script)} ★\n簡介：${script.summary.slice(0, 60)}...`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        App.showToast('已複製劇本簡介至剪貼簿！', 'success');
      }).catch(() => {
        App.showToast('複製失敗', 'error');
      });
    } else {
      App.showToast('您的瀏覽器不支援自動複製', 'warning');
    }
  },

  resetToDemoData() {
    App.confirm({
      title: '確定要重置劇本資料嗎？',
      message: '這將會還原為預設的經典劇本與示範評價，您自訂的新增項目將會被重置。',
      confirmText: '確定還原',
      cancelText: '取消',
      onConfirm: async () => {
        this.state.scripts = this.getDefaultScripts();
        this.saveScripts();
        this.state.selectedScriptId = null;
        this.state.currentView = 'list';
        this.renderView();
        App.showToast('已還原為預設示範劇本資料', 'success');

        if (this.isAdmin()) {
          try {
            await this.supabaseRequest('/scripts?id=neq.placeholder', {
              method: 'DELETE'
            });
            await this.seedSupabaseDefaults();
            App.showToast('雲端資料庫已同步還原', 'info');
          } catch (e) {
            console.warn('[Supabase] Reset remote error:', e);
          }
        }
      }
    });
  }
};
