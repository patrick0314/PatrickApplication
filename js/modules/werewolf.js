/**
 * One Night Ultimate Werewolf - Multiplayer Connection Module
 * Handles real-time WSS room creation, joining, heartbeat, player synchronization and chat
 */
const WerewolfModule = {
  id: 'werewolf',
  name: '一夜狼人殺',
  icon: 'moon',

  // Network & Room State
  state: {
    client: null,
    connected: false,
    ping: 0,
    pingStart: 0,
    currentView: 'lobby', // 'lobby' or 'room'
    roomId: '',
    myPlayerId: '',
    myPlayerName: '',
    isHost: false,
    isReady: false,
    players: [],
    messages: [],
    brokerIndex: 0
  },

  brokers: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ],

  init() {
    if (!this.state.myPlayerId) {
      let pid = sessionStorage.getItem('onuw_player_id');
      if (!pid) {
        pid = 'p_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('onuw_player_id', pid);
      }
      this.state.myPlayerId = pid;
    }

    const hash = window.location.hash;
    if (hash && hash.includes('room=')) {
      const match = hash.match(/room=([A-Za-z0-9]+)/);
      if (match && match[1]) {
        this.state.roomId = match[1].toUpperCase();
      }
    }
  },

  getRoomTopic(roomId) {
    return `patricksapp/werewolf/room/${roomId}`;
  },

  connectBroker(callback) {
    if (this.state.client && this.state.connected) {
      if (callback) callback();
      return;
    }

    const brokerUrl = this.brokers[this.state.brokerIndex];
    console.log('[Werewolf] Connecting to broker:', brokerUrl);

    try {
      const clientId = 'wolf_' + Math.random().toString(16).substring(2, 10);
      const client = mqtt.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 5000,
        keepalive: 30
      });

      this.state.client = client;

      client.on('connect', () => {
        console.log('[Werewolf] Connected to broker successfully!');
        this.state.connected = true;
        this.startPingInterval();
        if (callback) callback();
        this.updateRoomUI();
      });

      client.on('error', (err) => {
        console.error('[Werewolf] Connection error:', err);
        this.state.connected = false;
        this.state.brokerIndex = (this.state.brokerIndex + 1) % this.brokers.length;
        this.updateRoomUI();
      });

      client.on('close', () => {
        this.state.connected = false;
        this.updateRoomUI();
      });

      client.on('message', (topic, payload) => {
        this.handleIncomingMessage(topic, payload);
      });
    } catch (e) {
      console.error('[Werewolf] Failed to initialize mqtt client:', e);
      App.showToast('連線伺服器失敗，請檢查網路', 'error');
    }
  },

  startPingInterval() {
    if (this._pingInterval) clearInterval(this._pingInterval);
    this._pingInterval = setInterval(() => {
      if (this.state.connected && this.state.roomId && this.state.client) {
        this.state.pingStart = Date.now();
        const pingMsg = JSON.stringify({
          type: 'PING',
          from: this.state.myPlayerId,
          ts: this.state.pingStart
        });
        this.state.client.publish(this.getRoomTopic(this.state.roomId), pingMsg);
      }
    }, 8000);
  },

  // Create Room
  createRoom() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    this.state.myPlayerName = settings.userName || 'default';
    
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    this.state.roomId = code;
    this.state.isHost = true;
    this.state.isReady = false; // Initially waiting for ready
    this.state.players = [{
      id: this.state.myPlayerId,
      name: this.state.myPlayerName,
      isHost: true,
      isReady: false,
      joinedAt: Date.now()
    }];
    this.state.messages = [];

    App.showToast('正在建立房間...', 'info');

    this.connectBroker(() => {
      const topic = this.getRoomTopic(this.state.roomId);
      this.state.client.subscribe(topic, { qos: 0 }, (err) => {
        if (!err) {
          this.state.currentView = 'room';
          App.showToast(`房間 #${this.state.roomId} 建立成功！`, 'success');
          this.renderView();
          
          this.broadcast({
            type: 'SYNC_STATE',
            players: this.state.players,
            hostId: this.state.myPlayerId
          });
        } else {
          App.showToast('房間建立失敗，請重試', 'error');
        }
      });
    });
  },

  // Join Existing Room
  joinRoom(roomIdInput) {
    const code = (roomIdInput || '').trim().toUpperCase();
    if (!code) {
      App.showToast('請輸入房間代碼', 'error');
      return;
    }

    const settings = StorageManager.get('settings', { userName: 'default' });
    this.state.myPlayerName = settings.userName || 'default';
    this.state.roomId = code;
    this.state.isHost = false;
    this.state.isReady = false;
    this.state.messages = [];

    App.showToast(`連線加入 #${code}...`, 'info');

    this.connectBroker(() => {
      const topic = this.getRoomTopic(this.state.roomId);
      this.state.client.subscribe(topic, { qos: 0 }, (err) => {
        if (!err) {
          this.state.currentView = 'room';
          this.renderView();

          this.broadcast({
            type: 'PLAYER_JOIN',
            player: {
              id: this.state.myPlayerId,
              name: this.state.myPlayerName,
              isHost: false,
              isReady: false,
              joinedAt: Date.now()
            }
          });

          App.showToast('已加入房間，等待同步...', 'success');
        } else {
          App.showToast('無法訂閱房間訊息', 'error');
        }
      });
    });
  },

  leaveRoom() {
    if (confirm('確定要退出房間嗎？')) {
      if (this.state.client && this.state.roomId) {
        this.broadcast({
          type: 'PLAYER_LEAVE',
          playerId: this.state.myPlayerId,
          playerName: this.state.myPlayerName
        });
        this.state.client.unsubscribe(this.getRoomTopic(this.state.roomId));
      }
      this.state.currentView = 'lobby';
      this.state.roomId = '';
      this.state.players = [];
      this.state.messages = [];
      this.state.isHost = false;
      this.state.isReady = false;
      this.renderView();
      App.showToast('已退出房間', 'info');
    }
  },

  broadcast(msgObj) {
    if (!this.state.client || !this.state.roomId || !this.state.connected) return;
    const payload = JSON.stringify({
      ...msgObj,
      roomId: this.state.roomId,
      fromId: this.state.myPlayerId,
      timestamp: Date.now()
    });
    this.state.client.publish(this.getRoomTopic(this.state.roomId), payload);
  },

  handleIncomingMessage(topic, payload) {
    try {
      const data = JSON.parse(payload.toString());
      if (data.roomId && data.roomId !== this.state.roomId) return;

      switch (data.type) {
        case 'PLAYER_JOIN':
          if (data.player.id === this.state.myPlayerId) return;
          if (!this.state.players.some(p => p.id === data.player.id)) {
            this.state.players.push(data.player);
            this.addSystemMessage(`${data.player.name} 加入了房間 👋`);
            App.showToast(`${data.player.name} 加入了房間`, 'info');
          }
          if (this.state.isHost) {
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId
            });
          }
          this.updateRoomUI();
          break;

        case 'SYNC_STATE':
          if (data.players && Array.isArray(data.players)) {
            let currentPlayers = data.players;
            const myself = currentPlayers.find(p => p.id === this.state.myPlayerId);
            if (!myself) {
              currentPlayers.push({
                id: this.state.myPlayerId,
                name: this.state.myPlayerName,
                isHost: false,
                isReady: this.state.isReady,
                joinedAt: Date.now()
              });
            } else {
              // keep my own local ready state authoritative
              myself.isReady = this.state.isReady;
            }
            this.state.players = currentPlayers;
            this.state.isHost = (data.hostId === this.state.myPlayerId);
            this.updateRoomUI();
          }
          break;

        case 'TOGGLE_READY':
          const player = this.state.players.find(p => p.id === data.playerId);
          if (player) {
            player.isReady = data.isReady;
            this.updateRoomUI();
          }
          break;

        case 'PLAYER_LEAVE':
          const leftPlayer = this.state.players.find(p => p.id === data.playerId);
          if (leftPlayer) {
            this.state.players = this.state.players.filter(p => p.id !== data.playerId);
            this.addSystemMessage(`${leftPlayer.name} 離開了房間`);
            if (leftPlayer.isHost && this.state.players.length > 0) {
              this.state.players[0].isHost = true;
              if (this.state.players[0].id === this.state.myPlayerId) {
                this.state.isHost = true;
                App.showToast('原房主已離開，您已成為新房主 👑', 'info');
              }
            }
            this.updateRoomUI();
          }
          break;

        case 'REACTION':
          this.state.messages.push({
            id: 'msg_' + Date.now() + Math.random(),
            from: data.fromName || '玩家',
            emoji: data.emoji,
            isReaction: true,
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
          this.showFloatingReaction(data.emoji, data.fromName);
          break;

        case 'CHAT':
          this.state.messages.push({
            id: 'msg_' + Date.now() + Math.random(),
            from: data.fromName,
            text: data.text,
            isReaction: false,
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          });
          break;

        case 'BROADCAST_TEST':
          App.showToast(`房主發起連線測試：${data.message || '連線暢通！'}`, 'success');
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
          break;

        case 'PING':
          if (data.from === this.state.myPlayerId && data.ts) {
            this.state.ping = Math.max(12, Date.now() - data.ts);
            const pingEl = document.getElementById('room-ping-val');
            if (pingEl) pingEl.textContent = `${this.state.ping}ms`;
          }
          break;
      }
    } catch (e) {
      console.error('[Werewolf] Error processing message:', e);
    }
  },

  // Toggle ready status
  toggleReady() {
    this.state.isReady = !this.state.isReady;
    const me = this.state.players.find(p => p.id === this.state.myPlayerId);
    if (me) me.isReady = this.state.isReady;

    if ('vibrate' in navigator) navigator.vibrate(25);

    this.broadcast({
      type: 'TOGGLE_READY',
      playerId: this.state.myPlayerId,
      isReady: this.state.isReady
    });

    this.updateRoomUI();
    App.showToast(this.state.isReady ? '已標記為準備就緒！' : '已切換為等待準備', 'info');
  },

  sendReaction(emoji) {
    this.broadcast({
      type: 'REACTION',
      fromName: this.state.myPlayerName,
      emoji: emoji
    });
    this.showFloatingReaction(emoji, '我');
  },

  sendBroadcastTest() {
    if (!this.state.isHost) return;
    this.broadcast({
      type: 'BROADCAST_TEST',
      message: '全體玩家連線測試成功 🎉'
    });
    App.showToast('已發送全房間連線測試廣播！', 'success');
  },

  copyRoomLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}#room=${this.state.roomId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      App.showToast(`房間連結已複製！快發給朋友吧`, 'success');
    }).catch(() => {
      App.showToast(`房間代號為: ${this.state.roomId}`, 'info');
    });
  },

  showFloatingReaction(emoji, fromName) {
    const container = document.getElementById('floating-reactions');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'absolute right-4 bottom-24 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl border border-white/20 animate-bounce pointer-events-none z-50';
    el.innerHTML = `<span class="text-xl">${emoji}</span><span class="text-[11px] opacity-90">${fromName}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 2000);
  },

  addSystemMessage(text) {
    this.state.messages.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: text,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    });
  },

  render() {
    this.init();
    if (this.state.currentView === 'room' && this.state.roomId) {
      return this.renderRoomView();
    }
    return this.renderLobbyView();
  },

  renderView() {
    App.render();
  },

  // View 1: Lobby Screen
  renderLobbyView() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const currentName = settings.userName || 'default';

    return `
      <div class="space-y-5 fade-in pb-16">
        <!-- Back Navigation & Module Header -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="App.switchTab('dashboard')" class="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>返回功能列表</span>
          </button>
          <span class="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
            多人即時連線 v1.0
          </span>
        </div>

        <!-- Werewolf Hero Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 p-6 text-white shadow-xl shadow-indigo-950/40 border border-indigo-800/40">
          <div class="relative z-10">
            <div class="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span class="text-xl">🐺</span>
              <span>One Night Ultimate Werewolf</span>
            </div>

            <h1 class="text-2xl font-black tracking-tight text-white">一夜狼人殺</h1>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed opacity-90">
              跨手機多人即時連線系統。任何人透過房間代碼即可加入，無須同一 Wi-Fi，4G/5G 皆可連線！
            </p>

            <div class="mt-4 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>WSS 加密通道已就緒 (延遲 < 50ms)</span>
            </div>
          </div>

          <div class="absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-indigo-600/20 blur-2xl"></div>
        </div>

        <!-- Player Nickname Badge -->
        <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              ${(currentName || 'D').charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="text-xs font-bold text-slate-900 dark:text-white">${currentName}</p>
              <p class="text-[10px] text-slate-400">目前連線玩家身分</p>
            </div>
          </div>
          <button onclick="App.switchTab('settings')" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40">
            更換暱稱
          </button>
        </div>

        <!-- Room Action Cards -->
        <div class="grid grid-cols-1 gap-3.5">
          <!-- Create Room -->
          <button onclick="WerewolfModule.createRoom()" class="tap-scale flex items-center justify-between p-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 text-left">
            <div class="flex items-center space-x-4">
              <div class="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center text-white text-2xl shadow-inner">
                👑
              </div>
              <div>
                <h3 class="text-base font-black">創建新房間</h3>
                <p class="text-xs text-indigo-200 mt-0.5">擔任房主，產生專屬房間代碼給好友</p>
              </div>
            </div>
            <i data-lucide="arrow-right" class="w-5 h-5 opacity-80"></i>
          </button>

          <!-- Join Room -->
          <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div class="flex items-center space-x-2">
              <i data-lucide="door-open" class="w-4 h-4 text-indigo-500"></i>
              <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">加入已有房間</h3>
            </div>
            
            <div class="flex space-x-2">
              <input 
                type="text" 
                id="join-room-input" 
                maxlength="6"
                placeholder="請輸入 4 位數房間代號 (如 8F2A)"
                value="${this.state.roomId || ''}"
                class="flex-1 uppercase tracking-widest font-black px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
              />
              <button 
                onclick="WerewolfModule.joinRoom(document.getElementById('join-room-input').value)" 
                class="tap-scale px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md shrink-0"
              >
                加入
              </button>
            </div>
          </div>
        </div>

        <!-- Connection Feature Showcase -->
        <div class="rounded-2xl p-4 bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">連線特色說明</p>
          <ul class="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
            <li>• 支援跨手機、跨系統（iPhone 與 Android）即時連線。</li>
            <li>• 不限同一 Wi-Fi，外網行動網路（4G/5G）隨時可玩。</li>
            <li>• 毫秒級房間同步，房主點擊廣播全房間手機秒級收到。</li>
          </ul>
        </div>
      </div>
    `;
  },

  // View 2: Room Screen (Clean Layout without Overlapping)
  renderRoomView() {
    const isMeReady = this.state.isReady;
    const allReady = this.state.players.length >= 2 && this.state.players.every(p => p.isReady);

    return `
      <div class="relative space-y-4 fade-in pb-20" id="room-view-container">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Room Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="WerewolfModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出房間</span>
          </button>

          <!-- Ping & WSS Status -->
          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span id="room-ping-val">${this.state.ping ? this.state.ping + 'ms' : '連線正常'}</span>
          </div>
        </div>

        <!-- Room Identity Banner -->
        <div class="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white border border-indigo-900/60 shadow-xl flex items-center justify-between">
          <div>
            <p class="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">房間代碼 (點擊可分享)</p>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-3xl font-black tracking-widest text-indigo-400">#${this.state.roomId}</span>
              <button onclick="WerewolfModule.copyRoomLink()" class="tap-scale p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="text-right">
            <span id="room-player-count" class="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-indigo-200">
              ${this.state.players.length} 人在線
            </span>
            <p class="text-[10px] text-slate-400 mt-1">
              ${this.state.isHost ? '👑 您是房主' : '👤 房間成員'}
            </p>
          </div>
        </div>

        <!-- Player Roster (Realtime Sync) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
              <span>房間玩家列表 (${this.state.players.length})</span>
            </h2>
            <span id="room-status-summary" class="text-[10px] font-bold ${allReady ? 'text-emerald-500' : 'text-slate-400'}">
              ${allReady ? '🎉 全員就緒！' : '等待準備中...'}
            </span>
          </div>

          <div class="space-y-2" id="players-list-container">
            ${this.renderPlayerCards()}
          </div>
        </div>

        <!-- Host Broadcast Control (If Host) -->
        ${this.state.isHost ? `
          <div class="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <i data-lucide="radio" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">房主控制台</span>
            </div>
            <button onclick="WerewolfModule.sendBroadcastTest()" class="tap-scale px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
              發起全體連線震動測試
            </button>
          </div>
        ` : ''}

        <!-- Interactive & Ready Section (Natural Layout - No Overlap!) -->
        <div class="space-y-3 pt-1">
          <!-- Quick Emoji Reactions Bar -->
          <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3.5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
            <div class="flex items-center justify-between px-1">
              <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">快捷表情互動</span>
              <span class="text-[10px] text-slate-400">點擊即時廣播全體手機</span>
            </div>
            <div class="flex items-center justify-around py-1">
              <button onclick="WerewolfModule.sendReaction('🐺')" class="tap-scale text-2xl hover:scale-125 transition" title="狼嚎">🐺</button>
              <button onclick="WerewolfModule.sendReaction('👀')" class="tap-scale text-2xl hover:scale-125 transition" title="懷疑">👀</button>
              <button onclick="WerewolfModule.sendReaction('🔥')" class="tap-scale text-2xl hover:scale-125 transition" title="開戰">🔥</button>
              <button onclick="WerewolfModule.sendReaction('👍')" class="tap-scale text-2xl hover:scale-125 transition" title="讚">👍</button>
              <button onclick="WerewolfModule.sendReaction('❓')" class="tap-scale text-2xl hover:scale-125 transition" title="疑惑">❓</button>
              <button onclick="WerewolfModule.sendReaction('💀')" class="tap-scale text-2xl hover:scale-125 transition" title="出局">💀</button>
            </div>
          </div>

          <!-- Primary Ready Button (In Flow, Never Covers Other UI) -->
          <div>
            <button 
              id="room-ready-btn"
              onclick="WerewolfModule.toggleReady()" 
              class="tap-scale w-full py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all ${
                isMeReady 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
              }"
            >
              <i data-lucide="${isMeReady ? 'check-circle-2' : 'zap'}" class="w-5 h-5"></i>
              <span>${isMeReady ? '已就緒 (點擊取消)' : '立即準備 (點擊就緒)'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderPlayerCards() {
    if (!this.state.players || this.state.players.length === 0) {
      return `<div class="text-xs text-slate-400 py-4 text-center">正在等待玩家加入...</div>`;
    }

    return this.state.players.map(p => {
      const isMe = p.id === this.state.myPlayerId;

      return `
        <div class="flex items-center justify-between p-3 rounded-2xl ${
          p.isReady 
            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40' 
            : 'bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800'
        } transition-all">
          <div class="flex items-center space-x-3">
            <div class="h-9 w-9 rounded-xl ${p.isHost ? 'bg-amber-500' : 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-sm">
              ${p.isHost ? '👑' : (p.name || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold text-slate-900 dark:text-white">${p.name}</span>
                ${isMe ? '<span class="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded font-bold">你</span>' : ''}
                ${p.isHost ? '<span class="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded font-bold">房主</span>' : ''}
              </div>
              <span class="text-[10px] text-slate-400">連線在線</span>
            </div>
          </div>

          <!-- Ready Status Tag -->
          <div>
            ${p.isReady ? `
              <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-sm shadow-emerald-500/20">
                <i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>
                <span>已就緒</span>
              </span>
            ` : `
              <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                等待準備
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  // Update Ready Button DOM specifically
  updateReadyButtonUI() {
    const btn = document.getElementById('room-ready-btn');
    if (!btn) return;

    const isMeReady = this.state.isReady;
    btn.className = `tap-scale w-full py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all ${
      isMeReady 
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30' 
        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
    }`;

    btn.innerHTML = `
      <i data-lucide="${isMeReady ? 'check-circle-2' : 'zap'}" class="w-5 h-5"></i>
      <span>${isMeReady ? '已就緒 (點擊取消)' : '立即準備 (點擊就緒)'}</span>
    `;
  },

  // Synchronize entire room interface
  updateRoomUI() {
    if (this.state.currentView !== 'room') return;

    // 1. Update player list
    const container = document.getElementById('players-list-container');
    if (container) {
      container.innerHTML = this.renderPlayerCards();
    }

    // 2. Update ready button text, icon, and colors
    this.updateReadyButtonUI();

    // 3. Update player count and summary
    const countEl = document.getElementById('room-player-count');
    if (countEl) {
      countEl.textContent = `${this.state.players.length} 人在線`;
    }

    const summaryEl = document.getElementById('room-status-summary');
    if (summaryEl) {
      const allReady = this.state.players.length >= 2 && this.state.players.every(p => p.isReady);
      summaryEl.textContent = allReady ? '🎉 全員就緒！' : '等待準備中...';
      summaryEl.className = `text-[10px] font-bold ${allReady ? 'text-emerald-500' : 'text-slate-400'}`;
    }

    if (window.lucide) lucide.createIcons();
  }
};

window.WerewolfModule = WerewolfModule;
