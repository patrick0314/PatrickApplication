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
    brokerIndex: 0,
    lastReactionTime: 0,
    selectedRoles: {
      werewolf: 2,
      minion: 0,
      mason: 0,
      seer: 1,
      robber: 1,
      troublemaker: 1,
      drunk: 0,
      insomniac: 0,
      hunter: 0,
      villager: 1
    },
    isCustomRoles: false,
    gamePhase: 'lobby', // 'lobby' | 'deal' | 'night' | 'day' | 'voting' | 'result'
    gameData: null
  },

  _reactionTimer: null,
  _gameInterval: null,

  brokers: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ],

  // 9 Core Roles Definition
  ROLES: {
    werewolf: {
      id: 'werewolf',
      name: '狼人',
      team: 'werewolf',
      teamName: '狼人陣營',
      icon: '🐺',
      image: 'icons/roles/werewolf.svg',
      minCount: 1, // 狼人下限為 1
      maxCount: 2,
      order: 1,
      desc: '夜間互相確認同伴；若為孤狼可看 1 張中央底牌。'
    },
    minion: {
      id: 'minion',
      name: '爪牙',
      team: 'werewolf',
      teamName: '狼人陣營',
      icon: '🦊', // 狐狸造型
      image: 'icons/roles/minion.svg',
      minCount: 0,
      maxCount: 1,
      order: 2,
      desc: '夜間睜眼看誰是狼人；狼人不知爪牙，狼全在底牌時爪牙不死即勝。'
    },
    mason: {
      id: 'mason',
      name: '守夜人',
      team: 'villager',
      teamName: '村民陣營',
      icon: '👮', // 警察造型
      image: 'icons/roles/mason.svg',
      minCount: 0,
      maxCount: 2,
      order: 3,
      desc: '夜間睜眼尋找另一名守夜人，藉此確認同伴是好人身份。'
    },
    seer: {
      id: 'seer',
      name: '預言家',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🔮',
      image: 'icons/roles/seer.svg',
      minCount: 0,
      maxCount: 1,
      order: 4,
      desc: '夜間可查驗 1 位其他玩家的手牌，或查驗中央 2 張底牌。'
    },
    robber: {
      id: 'robber',
      name: '強盜',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🥷', // 忍者造型
      image: 'icons/roles/robber.svg',
      minCount: 0,
      maxCount: 1,
      order: 5,
      desc: '夜間可與 1 位其他玩家交換手牌，並查看自己獲得的新身份。'
    },
    troublemaker: {
      id: 'troublemaker',
      name: '搗蛋鬼',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🎭',
      image: 'icons/roles/troublemaker.svg',
      minCount: 0,
      maxCount: 1,
      order: 6,
      desc: '夜間可交換任意 2 位其他玩家的手牌（自己不能看牌內容）。'
    },
    drunk: {
      id: 'drunk',
      name: '酒鬼',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🍺',
      image: 'icons/roles/drunk.svg',
      minCount: 0,
      maxCount: 1,
      order: 7,
      desc: '夜間必須將自己的身份牌與中央 1 張底牌盲換（不能看新牌）。'
    },
    insomniac: {
      id: 'insomniac',
      name: '失眠者',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🦉',
      image: 'icons/roles/insomniac.svg',
      minCount: 0,
      maxCount: 1,
      order: 8,
      desc: '在天亮前最後醒來，查看自己最後的身份牌，確認是否被換過。'
    },
    hunter: {
      id: 'hunter',
      name: '獵人',
      team: 'villager',
      teamName: '村民陣營',
      icon: '🏹',
      image: 'icons/roles/hunter.svg',
      maxCount: 1,
      order: 99,
      desc: '若在白天投票中被處決，其投票的目標也同時一同被處決。'
    },
    villager: {
      id: 'villager',
      name: '村民',
      team: 'villager',
      teamName: '村民陣營',
      icon: '👨‍🌾',
      image: 'icons/roles/villager.svg',
      maxCount: 3,
      order: 99,
      desc: '無夜晚技能，整晚閉眼睡覺，憑藉白天發言與邏輯找出狼人。'
    }
  },

  // Calculate recommended balanced roles based on player count N (Requires N + 3 cards)
  getRecommendedRoles(playerCount) {
    const N = Math.max(1, playerCount || 1);
    const config = {
      werewolf: 0,
      minion: 0,
      mason: 0,
      seer: 0,
      robber: 0,
      troublemaker: 0,
      drunk: 0,
      insomniac: 0,
      hunter: 0,
      villager: 0
    };

    if (N === 1) {
      // 4 cards (Single Player Test Mode)
      config.werewolf = 1;
      config.seer = 1;
      config.robber = 1;
      config.villager = 1;
    } else if (N === 2) {
      // 5 cards (Two Players Test Mode)
      config.werewolf = 1;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.villager = 1;
    } else if (N === 3) {
      // 6 cards (Classic Standard 3-player ONUW)
      config.werewolf = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.villager = 1;
    } else if (N === 4) {
      // 7 cards
      config.werewolf = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.insomniac = 1;
    } else if (N === 5) {
      // 8 cards
      config.werewolf = 2;
      config.minion = 1;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.insomniac = 1;
    } else if (N === 6) {
      // 9 cards
      config.werewolf = 2;
      config.minion = 1;
      config.mason = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
    } else if (N === 7) {
      // 10 cards
      config.werewolf = 2;
      config.minion = 1;
      config.mason = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.hunter = 1;
    } else if (N === 8) {
      // 11 cards
      config.werewolf = 2;
      config.minion = 1;
      config.mason = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.insomniac = 1;
      config.hunter = 1;
    } else if (N === 9) {
      // 12 cards
      config.werewolf = 2;
      config.minion = 1;
      config.mason = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.insomniac = 1;
      config.hunter = 1;
      config.villager = 1;
    } else {
      // >= 10 players
      config.werewolf = 2;
      config.minion = 1;
      config.mason = 2;
      config.seer = 1;
      config.robber = 1;
      config.troublemaker = 1;
      config.drunk = 1;
      config.insomniac = 1;
      config.hunter = 1;
      config.villager = Math.min(3, Math.max(1, N + 3 - 11));
    }

    return config;
  },

  getSelectedRoleTotalCount() {
    return Object.values(this.state.selectedRoles || {}).reduce((sum, count) => sum + (count || 0), 0);
  },

  adjustRoleCount(roleId, delta) {
    if (!this.state.isHost) return;
    const roleDef = this.ROLES[roleId];
    if (!roleDef) return;

    const minCount = roleDef.minCount || 0;
    const currentCount = this.state.selectedRoles[roleId] !== undefined ? this.state.selectedRoles[roleId] : minCount;
    const newCount = Math.max(minCount, Math.min(roleDef.maxCount, currentCount + delta));
    if (newCount === currentCount) return;

    this.state.selectedRoles[roleId] = newCount;
    this.state.isCustomRoles = true; // Mark as custom modified

    if ('vibrate' in navigator) navigator.vibrate(20);

    this.broadcast({
      type: 'SYNC_ROLES',
      selectedRoles: this.state.selectedRoles,
      isCustomRoles: true
    });

    this.updateRoomUI();
  },

  applyRecommendedRoles() {
    if (!this.state.isHost) return;
    const count = this.state.players.length || 1;
    this.state.selectedRoles = this.getRecommendedRoles(count);
    this.state.isCustomRoles = false;

    if ('vibrate' in navigator) navigator.vibrate(30);

    App.showToast(`已套用 ${count} 人局推薦平衡配置！`, 'success');

    this.broadcast({
      type: 'SYNC_ROLES',
      selectedRoles: this.state.selectedRoles,
      isCustomRoles: false
    });

    this.updateRoomUI();
  },

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

    if (!this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.state.currentView === 'room' && this.state.roomId && this.state.client) {
          if (!this.state.isHost) {
            this.broadcast({ type: 'REQUEST_SYNC' });
          }
        }
      });
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
        keepalive: 15
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
    this.state.isCustomRoles = false;
    this.state.selectedRoles = this.getRecommendedRoles(1);
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
            hostId: this.state.myPlayerId,
            selectedRoles: this.state.selectedRoles,
            isCustomRoles: this.state.isCustomRoles
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
      if (this._reactionTimer) {
        clearInterval(this._reactionTimer);
        this._reactionTimer = null;
      }
      this.clearGameTimer();
      this.state.gamePhase = 'lobby';
      this.state.gameData = null;
      this.state.lastReactionTime = 0;
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
            if (!this.state.isCustomRoles) {
              this.state.selectedRoles = this.getRecommendedRoles(this.state.players.length);
            }
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId,
              selectedRoles: this.state.selectedRoles,
              isCustomRoles: this.state.isCustomRoles
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
              myself.isReady = this.state.isReady;
            }
            this.state.players = currentPlayers;
            this.state.isHost = (data.hostId === this.state.myPlayerId);
            if (data.selectedRoles) {
              this.state.selectedRoles = data.selectedRoles;
            }
            if (data.isCustomRoles !== undefined) {
              this.state.isCustomRoles = data.isCustomRoles;
            }
            this.updateRoomUI();
          }
          break;

        case 'SYNC_ROLES':
          if (data.selectedRoles) {
            this.state.selectedRoles = data.selectedRoles;
            if (data.isCustomRoles !== undefined) {
              this.state.isCustomRoles = data.isCustomRoles;
            }
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
            const wasHost = leftPlayer.isHost;
            this.state.players = this.state.players.filter(p => p.id !== data.playerId);
            this.addSystemMessage(`${leftPlayer.name} 離開了房間`);
            if (wasHost && this.state.players.length > 0) {
              this.state.players[0].isHost = true;
              if (this.state.players[0].id === this.state.myPlayerId) {
                this.state.isHost = true;
                App.showToast('原房主已離開，您已成為新房主 👑', 'info');
                if (!this.state.isCustomRoles) {
                  this.state.selectedRoles = this.getRecommendedRoles(this.state.players.length);
                }
                this.broadcast({
                  type: 'SYNC_STATE',
                  players: this.state.players,
                  hostId: this.state.myPlayerId,
                  selectedRoles: this.state.selectedRoles,
                  isCustomRoles: this.state.isCustomRoles
                });
              }
            } else if (this.state.isHost) {
              if (!this.state.isCustomRoles) {
                this.state.selectedRoles = this.getRecommendedRoles(this.state.players.length);
              }
              this.broadcast({
                type: 'SYNC_STATE',
                players: this.state.players,
                hostId: this.state.myPlayerId,
                selectedRoles: this.state.selectedRoles,
                isCustomRoles: this.state.isCustomRoles
              });
            }
            this.updateRoomUI();
          }
          break;

        case 'REQUEST_SYNC':
          if (this.state.isHost) {
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId,
              selectedRoles: this.state.selectedRoles,
              isCustomRoles: this.state.isCustomRoles
            });
          }
          break;

        case 'REACTION':
          // 避免發送者自身收到 MQTT 廣播重複彈出（發送者點擊當下已在本地即時顯示）
          if (data.fromId === this.state.myPlayerId) return;

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

        case 'GAME_STARTED':
          if (!this.state.isHost) {
            this.state.gamePhase = 'deal';
            this.state.gameData = {
              initialCards: data.initialCards,
              currentCards: { ...data.initialCards },
              nightOrder: data.nightOrder,
              myInitialRole: data.initialCards[this.state.myPlayerId],
              myCurrentRole: data.initialCards[this.state.myPlayerId],
              confirmedCount: 0,
              totalCount: data.totalPlayers || this.state.players.length || 1,
              cardFlipped: false,
              hasConfirmedCard: false
            };
            this.startDealingPhase();
          }
          break;

        case 'PLAYER_CONFIRMED_CARD':
          if (this.state.isHost) {
            this.handlePlayerConfirmedCard(data.playerId);
          }
          break;

        case 'SYNC_CONFIRMED_COUNT':
          if (!this.state.isHost && this.state.gameData) {
            this.state.gameData.confirmedCount = data.confirmedCount;
            this.state.gameData.totalCount = data.totalCount;
            this.updateDealPhaseUI(data.confirmedCount, data.totalCount);
          }
          break;

        case 'NIGHT_STEP':
          if (!this.state.isHost) {
            this.handleNightStep(data);
          }
          break;

        case 'NIGHT_ACTION':
          if (this.state.isHost) {
            this.processNightAction(data);
          }
          break;

        case 'DAY_STARTED':
          if (!this.state.isHost) {
            this.handleDayStarted(data);
          }
          break;

        case 'VOTING_STARTED':
          if (!this.state.isHost) {
            this.handleVotingStarted(data);
          }
          break;

        case 'VOTE_CAST':
          if (this.state.isHost) {
            this.handleVoteCast(data);
          }
          break;

        case 'GAME_OVER':
          if (!this.state.isHost) {
            this.handleGameOver(data);
          }
          break;

        case 'RESET_GAME':
          this.handleResetGame();
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
    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const cooldownMs = 10000;

    if (elapsed < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
      App.showToast(`表情冷卻中，請等待 ${remainingSec} 秒 ⏳`, 'info');
      if ('vibrate' in navigator) navigator.vibrate(40);
      return;
    }

    this.state.lastReactionTime = now;
    this.startReactionCooldown();

    if ('vibrate' in navigator) navigator.vibrate(25);

    this.broadcast({
      type: 'REACTION',
      fromName: this.state.myPlayerName,
      emoji: emoji
    });

    this.state.messages.push({
      id: 'msg_' + Date.now() + Math.random(),
      from: '我',
      emoji: emoji,
      isReaction: true,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    this.showFloatingReaction(emoji, '我');
  },

  startReactionCooldown() {
    if (this._reactionTimer) {
      clearInterval(this._reactionTimer);
      this._reactionTimer = null;
    }

    const updateCooldownUI = () => {
      const now = Date.now();
      const elapsed = now - (this.state.lastReactionTime || 0);
      const remainingSec = Math.ceil((10000 - elapsed) / 1000);
      const hint = document.getElementById('reaction-hint-text');
      const container = document.getElementById('reaction-buttons-container');

      if (remainingSec <= 0) {
        if (this._reactionTimer) {
          clearInterval(this._reactionTimer);
          this._reactionTimer = null;
        }
        if (hint) {
          hint.textContent = '點擊即時廣播全體手機';
          hint.className = 'text-[10px] text-slate-400';
        }
        if (container) {
          const btns = container.querySelectorAll('.reaction-btn');
          btns.forEach(b => {
            b.classList.remove('opacity-40', 'cursor-not-allowed');
            b.classList.add('hover:scale-125');
          });
        }
      } else {
        if (hint) {
          hint.textContent = `⏳ 冷卻中 (${remainingSec} 秒)`;
          hint.className = 'text-[10px] font-bold text-amber-500 animate-pulse';
        }
        if (container) {
          const btns = container.querySelectorAll('.reaction-btn');
          btns.forEach(b => {
            b.classList.add('opacity-40', 'cursor-not-allowed');
            b.classList.remove('hover:scale-125');
          });
        }
      }
    };

    updateCooldownUI();
    this._reactionTimer = setInterval(updateCooldownUI, 500);
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

    const offset = Math.floor(Math.random() * 40) - 20;
    const el = document.createElement('div');
    el.className = 'absolute right-6 bottom-24 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl border border-white/20 animate-bounce pointer-events-none z-50 transition-all';
    el.style.transform = `translateX(${offset}px)`;
    el.innerHTML = `<span class="text-xl">${emoji}</span><span class="text-[11px] opacity-90">${fromName}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
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
      if (this.state.gamePhase && this.state.gamePhase !== 'lobby') {
        return this.renderGameView();
      }
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

  // View 2: Room Screen (Removed online count from room code card, accurate roster count)
  renderRoomView() {
    const isMeReady = this.state.isReady;
    const isHost = this.state.isHost;
    const playerCount = this.state.players.length || 1;
    const targetCards = playerCount + 3;
    const selectedCount = this.getSelectedRoleTotalCount();
    const canStartGame = (selectedCount === targetCards);
    const allReady = this.state.players.length >= 1 && this.state.players.every(p => p.isReady);
    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const isCoolingDown = elapsed < 10000;
    const remainingSec = isCoolingDown ? Math.ceil((10000 - elapsed) / 1000) : 0;

    if (isCoolingDown && !this._reactionTimer) {
      setTimeout(() => this.startReactionCooldown(), 0);
    }

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

        <!-- Room Identity Banner (Removed 'x人在線', only keeps host/member identity) -->
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
            <span id="room-identity-badge" class="text-xs font-bold text-indigo-200 bg-white/10 px-3 py-1.5 rounded-full inline-block">
              ${this.state.isHost ? '👑 您是房主' : '👤 房間成員'}
            </span>
          </div>
        </div>

        <!-- Player Roster (Accurate dynamic count in title) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
              <span>房間玩家列表 (<span id="room-player-count">${this.state.players.length}</span>)</span>
            </h2>
            <span id="room-status-summary" class="text-[10px] font-bold ${allReady ? 'text-emerald-500' : 'text-slate-400'}">
              ${allReady ? '🎉 全員就緒！' : '等待準備中...'}
            </span>
          </div>

          <div class="space-y-2" id="players-list-container">
            ${this.renderPlayerCards()}
          </div>
        </div>

        <!-- Role Pool Configuration Section -->
        <div id="role-pool-container" class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          ${this.renderRolePoolSection()}
        </div>

        <!-- Host Broadcast Control Area (Dynamically synced) -->
        <div id="room-host-control-area">
          ${this.renderHostControls()}
        </div>

        <!-- Interactive & Ready Section (Natural Layout - No Overlap!) -->
        <div class="space-y-3 pt-1">
          <!-- Quick Emoji Reactions Bar -->
          <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3.5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
            <div class="flex items-center justify-between px-1">
              <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">快捷表情互動</span>
              <span id="reaction-hint-text" class="text-[10px] ${isCoolingDown ? 'font-bold text-amber-500 animate-pulse' : 'text-slate-400'}">
                ${isCoolingDown ? `⏳ 冷卻中 (${remainingSec} 秒)` : '點擊即時廣播全體手機'}
              </span>
            </div>
            <div id="reaction-buttons-container" class="flex items-center justify-around py-1">
              <button onclick="WerewolfModule.sendReaction('🐺')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="狼嚎">🐺</button>
              <button onclick="WerewolfModule.sendReaction('👀')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="懷疑">👀</button>
              <button onclick="WerewolfModule.sendReaction('🔥')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="開戰">🔥</button>
              <button onclick="WerewolfModule.sendReaction('👍')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="讚">👍</button>
              <button onclick="WerewolfModule.sendReaction('❓')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="疑惑">❓</button>
              <button onclick="WerewolfModule.sendReaction('💀')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="出局">💀</button>
            </div>
          </div>

          <!-- Primary Actions (Host Start Game + Ready Button) -->
          <div class="space-y-2.5" id="room-primary-actions-container">
            ${this.renderPrimaryActionBtns()}
          </div>
        </div>
      </div>
    `;
  },

  renderPrimaryActionBtns() {
    const isMeReady = this.state.isReady;
    const isHost = this.state.isHost;
    const playerCount = this.state.players.length || 1;
    const targetCards = playerCount + 3;
    const selectedCount = this.getSelectedRoleTotalCount();
    const isCardCountValid = (selectedCount === targetCards);
    const readyCount = this.state.players.filter(p => p.isReady).length;
    const allPlayersReady = this.state.players.length > 0 && (readyCount === this.state.players.length);
    const canStartGame = isCardCountValid && allPlayersReady;

    return `
      ${isHost ? `
        <button 
          onclick="WerewolfModule.hostStartGame()"
          ${!canStartGame ? 'disabled' : ''}
          class="tap-scale w-full py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all ${
            canStartGame 
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-indigo-600/30' 
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 opacity-70 cursor-not-allowed'
          }"
        >
          <i data-lucide="play" class="w-5 h-5"></i>
          <span>🚀 開始遊戲 (發牌)</span>
          ${!isCardCountValid 
            ? `<span class="text-[10px] font-normal opacity-85">(需選 ${targetCards} 張，目前 ${selectedCount} 張)</span>` 
            : (!allPlayersReady 
                ? `<span class="text-[10px] font-normal opacity-85">(⏳ 等待全員就緒 ${readyCount}/${playerCount})</span>` 
                : '')}
        </button>
      ` : ''}

      <button 
        id="room-ready-btn"
        onclick="WerewolfModule.toggleReady()" 
        class="tap-scale w-full ${isHost ? 'py-3 text-xs' : 'py-4 text-sm'} rounded-2xl font-black shadow-xl flex items-center justify-center space-x-2 transition-all ${
          isMeReady 
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30' 
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
        }"
      >
        <i data-lucide="${isMeReady ? 'check-circle-2' : 'zap'}" class="${isHost ? 'w-4 h-4' : 'w-5 h-5'}"></i>
        <span>${isMeReady ? '已就緒 (點擊取消)' : '立即準備 (點擊就緒)'}</span>
      </button>
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

  renderRolePoolSection() {
    const playerCount = this.state.players.length || 1;
    const targetCards = playerCount + 3;
    const totalSelected = this.getSelectedRoleTotalCount();
    const isMatched = totalSelected === targetCards;
    const isHost = this.state.isHost;

    let statusBadge = '';
    if (isMatched) {
      statusBadge = `
        <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
          <i data-lucide="check-circle" class="w-3 h-3"></i>
          <span>${totalSelected} / ${targetCards} 張 (吻合)</span>
        </span>
      `;
    } else if (totalSelected < targetCards) {
      statusBadge = `
        <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
          <i data-lucide="alert-circle" class="w-3 h-3"></i>
          <span>尚缺 ${targetCards - totalSelected} 張 (${totalSelected}/${targetCards})</span>
        </span>
      `;
    } else {
      statusBadge = `
        <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
          <i data-lucide="alert-triangle" class="w-3 h-3"></i>
          <span>超出 ${totalSelected - targetCards} 張 (${totalSelected}/${targetCards})</span>
        </span>
      `;
    }

    return `
      <!-- Role Pool Section Header -->
      <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center space-x-1.5">
          <img src="icons/roles/card_icon.svg" class="w-5 h-5 object-contain shrink-0" alt="卡牌">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            角色池配置
          </h2>
        </div>
        <div>${statusBadge}</div>
      </div>

      <!-- Explanatory & Adapt Action Bar -->
      <div class="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
        <span class="text-slate-600 dark:text-slate-300">
          玩家 <strong>${playerCount}</strong> 人 ＋ <strong>3</strong> 底牌 ＝ 需選 <strong class="text-indigo-600 dark:text-indigo-400 font-bold">${targetCards}</strong> 張
        </span>
        ${isHost ? `
          <button onclick="WerewolfModule.applyRecommendedRoles()" class="tap-scale px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1 shadow-sm">
            <i data-lucide="sparkles" class="w-3 h-3"></i>
            <span>一鍵適配人數</span>
          </button>
        ` : `
          <span class="text-[10px] text-slate-400">房主可調整</span>
        `}
      </div>

      <!-- Role Items List -->
      <div class="space-y-2 pt-1">
        ${Object.values(this.ROLES).map(role => {
          const count = (this.state.selectedRoles && this.state.selectedRoles[role.id]) || 0;
          const isSelected = count > 0;
          const isWolfTeam = role.team === 'werewolf';

          return `
            <div class="p-2.5 rounded-2xl transition-all border ${
              isSelected 
                ? (isWolfTeam 
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 shadow-sm' 
                    : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40 shadow-sm')
                : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60'
            }">
              <div class="flex items-center justify-between">
                <!-- Left: Icon, Name & Team Badge -->
                <div class="flex items-center space-x-2.5">
                  <img src="${role.image}" alt="${role.name}" class="w-10 h-10 rounded-xl object-contain shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                  <div>
                    <div class="flex items-center space-x-1.5">
                      <span class="text-xs font-bold text-slate-900 dark:text-white">${role.name}</span>
                      <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isWolfTeam 
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400' 
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                      }">
                        ${role.teamName}
                      </span>
                      <span class="text-[9px] text-slate-400">${role.minCount > 0 ? `下限 ${role.minCount} / 上限 ${role.maxCount}` : `上限 ${role.maxCount}`}</span>
                    </div>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">${role.desc}</p>
                  </div>
                </div>

                <!-- Right: Controls (if host) or Count display (if member) -->
                <div class="shrink-0 ml-2">
                  ${isHost ? `
                    <div class="flex items-center space-x-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm">
                      <button 
                        onclick="WerewolfModule.adjustRoleCount('${role.id}', -1)"
                        class="tap-scale h-7 w-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none"
                        ${count <= (role.minCount || 0) ? 'disabled' : ''}
                      >
                        <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                      </button>
                      <span class="w-6 text-center text-xs font-black text-slate-900 dark:text-white">${count}</span>
                      <button 
                        onclick="WerewolfModule.adjustRoleCount('${role.id}', 1)"
                        class="tap-scale h-7 w-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none"
                        ${count >= role.maxCount ? 'disabled' : ''}
                      >
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  ` : `
                    <span class="inline-block px-2.5 py-1 rounded-xl text-xs font-black ${
                      count > 0 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    }">
                      x ${count}
                    </span>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderHostControls() {
    if (!this.state.isHost) return '';
    return `
      <div class="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between fade-in">
        <div class="flex items-center space-x-2">
          <i data-lucide="radio" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200">房主控制台</span>
        </div>
        <button onclick="WerewolfModule.sendBroadcastTest()" class="tap-scale px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm">
          發起全體連線震動測試
        </button>
      </div>
    `;
  },

  // Synchronize entire room interface
  updateRoomUI() {
    if (this.state.currentView !== 'room') return;
    if (this.state.gamePhase && this.state.gamePhase !== 'lobby') {
      this.renderView();
      return;
    }

    // 1. Update player list cards
    const container = document.getElementById('players-list-container');
    if (container) {
      container.innerHTML = this.renderPlayerCards();
    }

    // 2. Update ready button text, icon, and colors
    this.updateReadyButtonUI();

    // 3. Update player count accurately in player roster header: 房間玩家列表 (X)
    const countEl = document.getElementById('room-player-count');
    if (countEl) {
      countEl.textContent = this.state.players.length;
    }

    // 4. Update all ready status summary
    const summaryEl = document.getElementById('room-status-summary');
    if (summaryEl) {
      const allReady = this.state.players.length >= 1 && this.state.players.every(p => p.isReady);
      summaryEl.textContent = allReady ? '🎉 全員就緒！' : '等待準備中...';
      summaryEl.className = `text-[10px] font-bold ${allReady ? 'text-emerald-500' : 'text-slate-400'}`;
    }

    // 5. Update host identity badge
    const badgeEl = document.getElementById('room-identity-badge');
    if (badgeEl) {
      badgeEl.textContent = this.state.isHost ? '👑 您是房主' : '👤 房間成員';
    }

    // 6. Update role pool container
    const rolePoolEl = document.getElementById('role-pool-container');
    if (rolePoolEl) {
      rolePoolEl.innerHTML = this.renderRolePoolSection();
    }

    // 7. Update host controls area (e.g. connection test button)
    const hostControlEl = document.getElementById('room-host-control-area');
    if (hostControlEl) {
      hostControlEl.innerHTML = this.renderHostControls();
    }

    // 8. Update primary action buttons (start game & ready) to reflect card count
    const actionsEl = document.getElementById('room-primary-actions-container');
    if (actionsEl) {
      actionsEl.innerHTML = this.renderPrimaryActionBtns();
    }

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // GAME LOOP & STATE MACHINE METHODS
  // ==========================================

  clearGameTimer() {
    if (this._gameInterval) {
      clearInterval(this._gameInterval);
      this._gameInterval = null;
    }
  },

  getPlayerName(id) {
    if (id === 'NO_WEREWOLF') return '場上沒有狼人 🕊️';
    if (id === this.state.myPlayerId) return `${this.state.myPlayerName} (我)`;
    const p = this.state.players.find(x => x.id === id);
    return p ? p.name : '未知玩家';
  },

  getRoleDef(roleId) {
    return this.ROLES[roleId] || { id: roleId, name: roleId || '未知', icon: '❓', image: 'icons/roles/card_icon.svg', team: 'villager', teamName: '村民陣營', desc: '' };
  },

  // 1. Host Starts the Game
  hostStartGame() {
    if (!this.state.isHost) {
      App.showToast('只有房主可以開始遊戲！', 'warning');
      return;
    }

    const playerCount = this.state.players.length;
    if (playerCount < 1) {
      App.showToast('房間內尚無玩家！', 'warning');
      return;
    }

    const targetCards = playerCount + 3;
    const currentCardsCount = this.getSelectedRoleTotalCount();
    if (currentCardsCount !== targetCards) {
      App.showToast(`卡牌總數目前為 ${currentCardsCount} 張，需為 ${targetCards} 張（${playerCount} 人 ＋ 3 底牌）！`, 'warning');
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      return;
    }

    // 檢查是否全員（包含房主自己）皆已準備就緒
    const unreadyPlayers = this.state.players.filter(p => !p.isReady);
    if (unreadyPlayers.length > 0) {
      const names = unreadyPlayers.map(p => p.id === this.state.myPlayerId ? '您自己(房主)' : p.name).join('、');
      App.showToast(`尚有玩家尚未準備就緒：${names}`, 'warning');
      if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
      return;
    }

    // Build and shuffle deck
    const deck = [];
    Object.entries(this.state.selectedRoles).forEach(([roleId, count]) => {
      for (let i = 0; i < count; i++) {
        deck.push(roleId);
      }
    });

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const initialCards = {};
    const currentCards = {};
    this.state.players.forEach((p, idx) => {
      initialCards[p.id] = deck[idx];
      currentCards[p.id] = deck[idx];
    });

    const centerCards = deck.slice(playerCount, playerCount + 3);
    const initialCenterCards = [...centerCards];

    // 僅呼叫當前場上（玩家手中）有的角色輪次，不呼叫底牌角色
    const playerRolesOnField = new Set(Object.values(initialCards));
    const ORDERED_NIGHT_ROLES = ['werewolf', 'minion', 'mason', 'seer', 'robber', 'troublemaker', 'drunk', 'insomniac'];
    const nightOrder = ORDERED_NIGHT_ROLES.filter(r => playerRolesOnField.has(r));

    this.state.gameData = {
      initialCards: initialCards,
      currentCards: currentCards,
      centerCards: centerCards,
      initialCenterCards: initialCenterCards,
      nightOrder: nightOrder,
      currentNightIndex: -1,
      currentNightRole: null,
      nightLogs: [],
      votes: {},
      myInitialRole: initialCards[this.state.myPlayerId],
      myCurrentRole: initialCards[this.state.myPlayerId],
      cardFlipped: false,
      hasConfirmedCard: false,
      confirmedPlayers: {},
      confirmedCount: 0,
      totalCount: playerCount
    };

    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    this.broadcast({
      type: 'GAME_STARTED',
      initialCards: initialCards,
      nightOrder: nightOrder,
      totalPlayers: playerCount
    });

    this.startDealingPhase();
  },

  // 2. Dealing Phase (不限時，自行確認後翻面蓋牌)
  startDealingPhase() {
    this.clearGameTimer();
    this.state.gamePhase = 'deal';
    if (!this.state.gameData) this.state.gameData = {};
    this.state.gameData.phase = 'deal';
    this.state.gameData.cardFlipped = false;
    this.state.gameData.hasConfirmedCard = false;
    this.state.gameData.confirmedCount = this.state.gameData.confirmedCount || 0;
    this.state.gameData.totalCount = this.state.players.length || 1;

    if ('vibrate' in navigator) navigator.vibrate(50);
    this.renderView();
  },

  toggleFlipCard() {
    if (!this.state.gameData) return;
    const isCurrentlyFlipped = !!this.state.gameData.cardFlipped;

    if (isCurrentlyFlipped) {
      // 點擊翻面蓋牌並確認
      this.confirmAndHideCard();
    } else {
      // 點擊翻開查看
      this.state.gameData.cardFlipped = true;
      const cardEl = document.getElementById('identity-flip-card');
      if (cardEl) {
        cardEl.classList.add('card-flipped');
      }
      this.updateDealPhaseButton();
    }
  },

  confirmAndHideCard() {
    if (!this.state.gameData) return;
    this.state.gameData.cardFlipped = false;
    this.state.gameData.hasConfirmedCard = true;

    const cardEl = document.getElementById('identity-flip-card');
    if (cardEl) {
      cardEl.classList.remove('card-flipped');
    }
    this.updateDealPhaseButton();

    this.broadcast({
      type: 'PLAYER_CONFIRMED_CARD',
      playerId: this.state.myPlayerId
    });

    if (this.state.isHost) {
      this.handlePlayerConfirmedCard(this.state.myPlayerId);
    }

    App.showToast('已確認身份並翻面蓋牌 🔒 等待其他玩家...', 'info');
  },

  handlePlayerConfirmedCard(playerId) {
    if (!this.state.isHost || !this.state.gameData) return;
    if (!this.state.gameData.confirmedPlayers) {
      this.state.gameData.confirmedPlayers = {};
    }
    this.state.gameData.confirmedPlayers[playerId] = true;

    const confirmedCount = Object.keys(this.state.gameData.confirmedPlayers).length;
    const totalCount = this.state.players.length;

    this.state.gameData.confirmedCount = confirmedCount;
    this.state.gameData.totalCount = totalCount;

    this.broadcast({
      type: 'SYNC_CONFIRMED_COUNT',
      confirmedCount: confirmedCount,
      totalCount: totalCount
    });

    this.updateDealPhaseUI(confirmedCount, totalCount);

    if (confirmedCount >= totalCount) {
      App.showToast('所有玩家已確認身份！即將進入夜晚行動 🌙', 'success');
      setTimeout(() => {
        if (this.state.gamePhase === 'deal') {
          this.startNightPhase();
        }
      }, 1200);
    }
  },

  updateDealPhaseUI(confirmedCount, totalCount) {
    const badgeEl = document.getElementById('deal-confirmed-badge');
    if (badgeEl) {
      badgeEl.textContent = `已蓋牌 ${confirmedCount} / ${totalCount} 人`;
    }
    const descEl = document.getElementById('deal-confirmed-desc');
    if (descEl) {
      descEl.textContent = confirmedCount >= totalCount 
        ? '全員已蓋牌！即將進入夜晚行動...' 
        : `等待其他玩家確認 (${confirmedCount}/${totalCount})`;
    }
    this.updateDealPhaseButton();
  },

  updateDealPhaseButton() {
    const btn = document.getElementById('deal-confirm-action-btn');
    if (!btn || !this.state.gameData) return;

    const isFlipped = this.state.gameData.cardFlipped;
    const hasConfirmed = this.state.gameData.hasConfirmedCard;

    if (isFlipped) {
      btn.className = "tap-scale w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-1.5";
      btn.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4"></i><span>我已確認身份 (翻面蓋牌)</span>`;
    } else if (hasConfirmed) {
      btn.className = "tap-scale w-full py-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center space-x-1.5";
      btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>已確認並蓋牌 (點擊卡牌可再次查看)</span>`;
    } else {
      btn.className = "tap-scale w-full py-3.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center space-x-1.5";
      btn.innerHTML = `<i data-lucide="eye" class="w-4 h-4 text-slate-500"></i><span>點擊卡牌翻面查看身份</span>`;
    }
    if (window.lucide) lucide.createIcons();
  },

  lockCardView() {
    this.confirmAndHideCard();
  },

  // 3. Night Phase Sequence (僅呼叫場上角色，每輪 12s，無震動與聲音)
  startNightPhase() {
    if (!this.state.isHost) return;
    this.clearGameTimer();
    const nightOrder = this.state.gameData?.nightOrder || [];
    if (nightOrder.length === 0) {
      this.startDayPhase();
      return;
    }
    this.state.gameData.currentNightIndex = 0;
    this.runNightStep(0);
  },

  runNightStep(stepIndex) {
    if (!this.state.isHost) return;
    this.clearGameTimer();

    const nightOrder = this.state.gameData.nightOrder || [];
    if (stepIndex >= nightOrder.length) {
      this.startDayPhase();
      return;
    }

    const roleId = nightOrder[stepIndex];
    this.state.gameData.currentNightIndex = stepIndex;
    this.state.gameData.currentNightRole = roleId;

    const payload = {
      type: 'NIGHT_STEP',
      roleId: roleId,
      stepIndex: stepIndex,
      totalSteps: nightOrder.length,
      duration: 12
    };

    if (roleId === 'werewolf') {
      payload.werewolfIds = Object.entries(this.state.gameData.initialCards)
        .filter(([_, r]) => r === 'werewolf')
        .map(([id]) => id);
      if (payload.werewolfIds.length === 1) {
        payload.centerCards = this.state.gameData.centerCards;
      }
    } else if (roleId === 'minion') {
      payload.werewolfIds = Object.entries(this.state.gameData.initialCards)
        .filter(([_, r]) => r === 'werewolf')
        .map(([id]) => id);
    } else if (roleId === 'mason') {
      payload.masonIds = Object.entries(this.state.gameData.initialCards)
        .filter(([_, r]) => r === 'mason')
        .map(([id]) => id);
    } else if (roleId === 'seer') {
      payload.centerCards = this.state.gameData.centerCards;
      payload.playerCards = { ...this.state.gameData.currentCards };
    } else if (roleId === 'robber') {
      payload.playerCards = { ...this.state.gameData.currentCards };
    } else if (roleId === 'drunk') {
      payload.centerCards = this.state.gameData.centerCards;
    } else if (roleId === 'insomniac') {
      const insomniacEntry = Object.entries(this.state.gameData.initialCards).find(([_, r]) => r === 'insomniac');
      if (insomniacEntry) {
        payload.insomniacFinalRole = this.state.gameData.currentCards[insomniacEntry[0]];
      }
    }

    if (roleId === 'werewolf') {
      const wolves = Object.entries(this.state.gameData.initialCards)
        .filter(([_, r]) => r === 'werewolf')
        .map(([id]) => this.getPlayerName(id));
      if (wolves.length > 0) {
        this.state.gameData.nightLogs.push(`🐺 狼人們（${wolves.join('、')}）睜眼確認了同伴`);
      } else {
        this.state.gameData.nightLogs.push(`🐺 狼人閉眼（所有狼人牌皆在底牌）`);
      }
    } else if (roleId === 'minion') {
      this.state.gameData.nightLogs.push(`🦊 爪牙睜眼確認了狼人同伴名單`);
    } else if (roleId === 'mason') {
      this.state.gameData.nightLogs.push(`👮 守夜人們睜眼確認了同伴`);
    }

    this.broadcast(payload);
    this.handleNightStep(payload);

    this._gameInterval = setInterval(() => {
      if (!this.state.gameData) {
        this.clearGameTimer();
        return;
      }
      this.state.gameData.timerSeconds--;
      const timerEl = document.getElementById('game-phase-timer');
      if (timerEl) {
        timerEl.textContent = `${this.state.gameData.timerSeconds}s`;
      }

      if (this.state.gameData.timerSeconds <= 0) {
        this.clearGameTimer();
        if (this.state.isHost) {
          this.runNightStep(stepIndex + 1);
        }
      }
    }, 1000);
  },

  handleNightStep(data) {
    this.clearGameTimer();
    this.state.gamePhase = 'night';
    if (!this.state.gameData) this.state.gameData = {};
    this.state.gameData.phase = 'night';
    this.state.gameData.currentNightRole = data.roleId;
    this.state.gameData.currentNightIndex = data.stepIndex;
    this.state.gameData.totalNightSteps = data.totalSteps;
    this.state.gameData.timerSeconds = data.duration || 12;
    this.state.gameData.hasActedThisNight = false;
    this.state.gameData.actionResult = null;
    this.state.gameData.stepHelperData = data;
    this.state.gameData.troubleTargets = [];
    this.state.gameData.seerCenterTargets = [];

    const isMeActive = (this.state.gameData.myInitialRole === data.roleId);
    // 夜間階段保持靜音與無震動，避免身旁玩家察覺

    this.renderView();

    if (!this.state.isHost) {
      this._gameInterval = setInterval(() => {
        if (!this.state.gameData) {
          this.clearGameTimer();
          return;
        }
        this.state.gameData.timerSeconds--;
        const timerEl = document.getElementById('game-phase-timer');
        if (timerEl) {
          timerEl.textContent = `${this.state.gameData.timerSeconds}s`;
        }
        if (this.state.gameData.timerSeconds <= 0) {
          this.clearGameTimer();
        }
      }, 1000);
    }
  },

  executeNightAction(actionType, params = {}) {
    if (!this.state.gameData) return;
    this.state.gameData.hasActedThisNight = true;

    const roleId = this.state.gameData.currentNightRole;
    const payload = {
      type: 'NIGHT_ACTION',
      roleId: roleId,
      actionType: actionType,
      actorId: this.state.myPlayerId,
      params: params
    };

    this.broadcast(payload);
    if (this.state.isHost) {
      this.processNightAction(payload);
    }

    // 夜間行動保持無震動
    this.renderView();
  },

  processNightAction(payload) {
    if (!this.state.isHost || !this.state.gameData) return;
    const { roleId, actionType, actorId, params } = payload;
    const actorName = this.getPlayerName(actorId);

    if (roleId === 'seer') {
      if (actionType === 'PEEK_PLAYER') {
        const targetId = params.targetId;
        const targetName = this.getPlayerName(targetId);
        this.state.gameData.nightLogs.push(`🔮 預言家（${actorName}）查驗了玩家 ${targetName} 的手牌`);
      } else if (actionType === 'PEEK_CENTER') {
        const { idx1, idx2 } = params;
        const cLabels = ['A', 'B', 'C'];
        this.state.gameData.nightLogs.push(`🔮 預言家（${actorName}）查驗了中央底牌 ${cLabels[idx1]} 與 ${cLabels[idx2]}`);
      }
    } else if (roleId === 'werewolf' && actionType === 'LONE_WOLF_PEEK') {
      const { idx } = params;
      const cLabels = ['A', 'B', 'C'];
      this.state.gameData.nightLogs.push(`🐺 孤狼（${actorName}）查驗了中央底牌 ${cLabels[idx]}`);
    } else if (roleId === 'robber' && actionType === 'SWAP') {
      const targetId = params.targetId;
      const targetName = this.getPlayerName(targetId);
      const myRole = this.state.gameData.currentCards[actorId];
      const targetRole = this.state.gameData.currentCards[targetId];

      this.state.gameData.currentCards[actorId] = targetRole;
      this.state.gameData.currentCards[targetId] = myRole;

      const newRoleDef = this.ROLES[targetRole];
      this.state.gameData.nightLogs.push(`🥷 強盜（${actorName}）搶奪了 ${targetName} 的手牌，成為了 ${newRoleDef ? newRoleDef.name : targetRole}`);
    } else if (roleId === 'troublemaker' && actionType === 'SWAP') {
      const { t1, t2 } = params;
      const name1 = this.getPlayerName(t1);
      const name2 = this.getPlayerName(t2);
      const role1 = this.state.gameData.currentCards[t1];
      const role2 = this.state.gameData.currentCards[t2];

      this.state.gameData.currentCards[t1] = role2;
      this.state.gameData.currentCards[t2] = role1;

      this.state.gameData.nightLogs.push(`🎭 搗蛋鬼（${actorName}）交換了 ${name1} 與 ${name2} 的手牌`);
    } else if (roleId === 'drunk' && actionType === 'SWAP') {
      const { centerIdx } = params;
      const cLabels = ['A', 'B', 'C'];
      const myRole = this.state.gameData.currentCards[actorId];
      const centerRole = this.state.gameData.centerCards[centerIdx];

      this.state.gameData.currentCards[actorId] = centerRole;
      this.state.gameData.centerCards[centerIdx] = myRole;

      this.state.gameData.nightLogs.push(`🍺 酒鬼（${actorName}）盲換了中央底牌 ${cLabels[centerIdx]}`);
    } else if (roleId === 'insomniac') {
      const finalRole = this.state.gameData.currentCards[actorId];
      const finalRoleDef = this.ROLES[finalRole];
      this.state.gameData.nightLogs.push(`🦉 失眠者（${actorName}）查看自己最終身份為 ${finalRoleDef ? finalRoleDef.name : finalRole}`);
    }
  },

  // Action Helpers for Active Roles
  loneWolfPeekCenter(idx) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    const helperData = this.state.gameData.stepHelperData || {};
    const role = (helperData.centerCards && helperData.centerCards[idx]) || 'villager';
    this.state.gameData.actionResult = { type: 'lone_wolf', idx, role };
    this.executeNightAction('LONE_WOLF_PEEK', { idx });
  },

  seerPeekPlayer(targetId) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    const helperData = this.state.gameData.stepHelperData || {};
    const role = (helperData.playerCards && helperData.playerCards[targetId]) || 'villager';
    this.state.gameData.actionResult = { type: 'seer_player', targetName: this.getPlayerName(targetId), role };
    this.executeNightAction('PEEK_PLAYER', { targetId });
  },

  toggleSeerCenterTarget(idx) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    let list = this.state.gameData.seerCenterTargets || [];
    if (list.includes(idx)) {
      list = list.filter(i => i !== idx);
    } else {
      if (list.length < 2) list.push(idx);
      else list = [list[1], idx];
    }
    this.state.gameData.seerCenterTargets = list;
    this.renderView();
  },

  seerConfirmCenterPeek() {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    const list = this.state.gameData.seerCenterTargets || [];
    if (list.length !== 2) return;
    const helperData = this.state.gameData.stepHelperData || {};
    const [idx1, idx2] = list;
    const r1 = (helperData.centerCards && helperData.centerCards[idx1]) || 'villager';
    const r2 = (helperData.centerCards && helperData.centerCards[idx2]) || 'villager';
    this.state.gameData.actionResult = { type: 'seer_center', idx1, idx2, role1: r1, role2: r2 };
    this.executeNightAction('PEEK_CENTER', { idx1, idx2 });
  },

  robberSwap(targetId) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    const helperData = this.state.gameData.stepHelperData || {};
    const newRole = (helperData.playerCards && helperData.playerCards[targetId]) || 'villager';
    this.state.gameData.myCurrentRole = newRole;
    this.state.gameData.actionResult = { type: 'robber', targetName: this.getPlayerName(targetId), newRole };
    this.executeNightAction('SWAP', { targetId });
  },

  toggleTroublemakerTarget(targetId) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    let list = this.state.gameData.troubleTargets || [];
    if (list.includes(targetId)) {
      list = list.filter(id => id !== targetId);
    } else {
      if (list.length < 2) list.push(targetId);
      else list = [list[1], targetId];
    }
    this.state.gameData.troubleTargets = list;
    this.renderView();
  },

  troublemakerConfirmSwap() {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    const list = this.state.gameData.troubleTargets || [];
    if (list.length !== 2) return;
    const [t1, t2] = list;
    this.state.gameData.actionResult = { type: 'troublemaker', name1: this.getPlayerName(t1), name2: this.getPlayerName(t2) };
    this.executeNightAction('SWAP', { t1, t2 });
  },

  drunkSwap(centerIdx) {
    if (!this.state.gameData || this.state.gameData.hasActedThisNight) return;
    this.state.gameData.actionResult = { type: 'drunk', centerIdx };
    this.executeNightAction('SWAP', { centerIdx });
  },

  // 4. Day Phase (白日討論時間為 人數 + 3 分鐘)
  startDayPhase() {
    if (!this.state.isHost) return;
    this.clearGameTimer();
    const playerCount = this.state.players.length || 1;
    const duration = (playerCount + 3) * 60; // 人數 + 3 分鐘

    this.broadcast({
      type: 'DAY_STARTED',
      duration: duration
    });

    this.handleDayStarted({ duration: duration });
  },

  handleDayStarted(data) {
    this.clearGameTimer();
    this.state.gamePhase = 'day';
    if (!this.state.gameData) this.state.gameData = {};
    this.state.gameData.phase = 'day';
    const defaultDuration = ((this.state.players.length || 1) + 3) * 60;
    this.state.gameData.timerSeconds = data.duration || defaultDuration;

    if ('vibrate' in navigator) navigator.vibrate([150, 100, 150]);
    this.renderView();

    this._gameInterval = setInterval(() => {
      if (!this.state.gameData) {
        this.clearGameTimer();
        return;
      }
      this.state.gameData.timerSeconds--;
      const timerEl = document.getElementById('game-phase-timer');
      if (timerEl) {
        const m = Math.floor(this.state.gameData.timerSeconds / 60);
        const s = this.state.gameData.timerSeconds % 60;
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      if (this.state.gameData.timerSeconds <= 0) {
        this.clearGameTimer();
        if (this.state.isHost) {
          this.startVotingPhase();
        }
      }
    }, 1000);
  },

  hostSkipDayDiscussion() {
    if (!this.state.isHost) return;
    if (confirm('確定要提早結束白日討論，直接進入投票處決階段嗎？')) {
      this.startVotingPhase();
    }
  },

  // 5. Voting Phase
  startVotingPhase() {
    if (!this.state.isHost) return;
    this.clearGameTimer();
    const duration = 15;

    this.state.gameData.votes = {};

    this.broadcast({
      type: 'VOTING_STARTED',
      duration: duration
    });

    this.handleVotingStarted({ duration: duration });
  },

  handleVotingStarted(data) {
    this.clearGameTimer();
    this.state.gamePhase = 'voting';
    if (!this.state.gameData) this.state.gameData = {};
    this.state.gameData.phase = 'voting';
    this.state.gameData.timerSeconds = data.duration || 15;
    this.state.gameData.selectedVoteTarget = null;
    this.state.gameData.myVote = null;
    this.state.gameData.hasVoted = false;

    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    this.renderView();

    this._gameInterval = setInterval(() => {
      if (!this.state.gameData) {
        this.clearGameTimer();
        return;
      }
      this.state.gameData.timerSeconds--;
      const timerEl = document.getElementById('game-phase-timer');
      if (timerEl) {
        timerEl.textContent = `${this.state.gameData.timerSeconds}s`;
      }

      if (this.state.gameData.timerSeconds <= 0) {
        this.clearGameTimer();
        if (this.state.isHost) {
          this.tallyVotesAndSettle();
        }
      }
    }, 1000);
  },

  selectVoteTarget(targetId) {
    if (!this.state.gameData || this.state.gameData.hasVoted) return;
    this.state.gameData.selectedVoteTarget = targetId;
    if ('vibrate' in navigator) navigator.vibrate(20);
    this.renderView();
  },

  submitVote(targetPlayerId) {
    if (!this.state.gameData || this.state.gameData.hasVoted) return;
    this.state.gameData.myVote = targetPlayerId;
    this.state.gameData.hasVoted = true;

    const payload = {
      type: 'VOTE_CAST',
      voterId: this.state.myPlayerId,
      targetId: targetPlayerId
    };

    this.broadcast(payload);

    if (this.state.isHost) {
      this.handleVoteCast(payload);
    }

    if ('vibrate' in navigator) navigator.vibrate(30);
    App.showToast(`已投票給 ${this.getPlayerName(targetPlayerId)}！`, 'success');
    this.renderView();
  },

  handleVoteCast(data) {
    if (!this.state.isHost || !this.state.gameData) return;
    if (!this.state.gameData.votes) this.state.gameData.votes = {};
    this.state.gameData.votes[data.voterId] = data.targetId;

    const totalVoted = Object.keys(this.state.gameData.votes).length;
    if (totalVoted >= this.state.players.length) {
      this.clearGameTimer();
      this.tallyVotesAndSettle();
    }
  },

  tallyVotesAndSettle() {
    if (!this.state.isHost || !this.state.gameData) return;
    this.clearGameTimer();

    const votes = this.state.gameData.votes || {};
    const voteCounts = { 'NO_WEREWOLF': 0 };
    this.state.players.forEach(p => { voteCounts[p.id] = 0; });

    Object.values(votes).forEach(targetId => {
      if (voteCounts[targetId] !== undefined) {
        voteCounts[targetId]++;
      }
    });

    const noWolfVotes = voteCounts['NO_WEREWOLF'] || 0;
    const playerVoteCounts = {};
    this.state.players.forEach(p => { playerVoteCounts[p.id] = voteCounts[p.id] || 0; });
    const maxPlayerVotes = Math.max(0, ...Object.values(playerVoteCounts));
    let executedPlayers = [];

    // 若「沒有狼人」得票數達到 2 票且大於等於玩家最高票，則裁定無人處決
    if (noWolfVotes >= 2 && noWolfVotes >= maxPlayerVotes) {
      executedPlayers = [];
      this.state.gameData.nightLogs.push(`🕊️ 投票裁定：多數玩家（${noWolfVotes} 票）認為「場上沒有狼人」，無人被處決`);
    } else if (maxPlayerVotes >= 2) {
      executedPlayers = this.state.players
        .filter(p => voteCounts[p.id] === maxPlayerVotes)
        .map(p => p.id);

      const hunterVictims = [];
      executedPlayers.forEach(pId => {
        if (this.state.gameData.currentCards[pId] === 'hunter') {
          const huntedTarget = votes[pId];
          if (huntedTarget && huntedTarget !== 'NO_WEREWOLF' && !executedPlayers.includes(huntedTarget)) {
            hunterVictims.push(huntedTarget);
            const hName = this.getPlayerName(pId);
            const tName = this.getPlayerName(huntedTarget);
            this.state.gameData.nightLogs.push(`🏹 獵人（${hName}）被處決，發動技能帶走了 ${tName}！`);
          }
        }
      });
      executedPlayers = [...executedPlayers, ...hunterVictims];
    }

    let winningTeam = 'villager';
    let winReason = '';

    const anyWolfExecuted = executedPlayers.some(pId => this.state.gameData.currentCards[pId] === 'werewolf');
    const liveWolvesExist = Object.values(this.state.gameData.currentCards).some(r => r === 'werewolf');

    if (anyWolfExecuted) {
      winningTeam = 'villager';
      winReason = '處決名單中包含狼人！村民陣營獲勝 🎉';
    } else {
      if (executedPlayers.length > 0) {
        winningTeam = 'werewolf';
        winReason = '處決的皆為好人，狼人成功隱匿獲勝 🐺';
      } else {
        if (liveWolvesExist) {
          winningTeam = 'werewolf';
          winReason = (noWolfVotes >= 2 && noWolfVotes >= maxPlayerVotes)
            ? `投票裁定「場上沒有狼人」（${noWolfVotes} 票），但場上實際有狼人存活！狼人獲勝 🐺`
            : '平安夜無人傷亡，但場上有狼人存活！狼人獲勝 🐺';
        } else {
          winningTeam = 'villager';
          winReason = (noWolfVotes >= 2 && noWolfVotes >= maxPlayerVotes)
            ? `全員成功識破「場上沒有狼人」（${noWolfVotes} 票，狼全在底牌）！好人獲勝 🎉`
            : '平安夜無人傷亡，且場上無狼人（狼全在底牌）！好人成功識破獲勝 🎉';
        }
      }
    }

    const payload = {
      type: 'GAME_OVER',
      initialCards: this.state.gameData.initialCards,
      finalCards: this.state.gameData.currentCards,
      centerCards: this.state.gameData.centerCards,
      initialCenterCards: this.state.gameData.initialCenterCards,
      votes: votes,
      voteCounts: voteCounts,
      executedPlayers: executedPlayers,
      winningTeam: winningTeam,
      winReason: winReason,
      nightLogs: this.state.gameData.nightLogs
    };

    this.broadcast(payload);
    this.handleGameOver(payload);
  },

  handleGameOver(data) {
    this.clearGameTimer();
    this.state.gamePhase = 'result';
    this.state.gameData = {
      ...this.state.gameData,
      ...data,
      phase: 'result'
    };

    if ('vibrate' in navigator) {
      if (data.winningTeam === 'villager') {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } else {
        navigator.vibrate([300, 100, 300]);
      }
    }

    this.renderView();
  },

  hostRestartGame() {
    if (!this.state.isHost) return;
    this.broadcast({ type: 'RESET_GAME' });
    this.handleResetGame();
  },

  handleResetGame() {
    this.clearGameTimer();
    this.state.gamePhase = 'lobby';
    this.state.gameData = null;
    this.state.isReady = false;
    this.state.players.forEach(p => p.isReady = false);
    App.showToast('已重置回到房間大廳！', 'info');
    this.renderView();
  },

  // ==========================================
  // GAME PHASES RENDERERS
  // ==========================================

  renderGameView() {
    const phase = this.state.gamePhase;
    if (phase === 'deal') return this.renderDealPhase();
    if (phase === 'night') return this.renderNightPhase();
    if (phase === 'day') return this.renderDayPhase();
    if (phase === 'voting') return this.renderVotingPhase();
    if (phase === 'result') return this.renderResultPhase();
    return this.renderRoomView();
  },

  // View: Dealing Phase (不限時確認，翻面蓋牌)
  renderDealPhase() {
    const roleId = this.state.gameData?.myInitialRole;
    const roleDef = this.getRoleDef(roleId);
    const isFlipped = this.state.gameData?.cardFlipped || false;
    const hasConfirmed = this.state.gameData?.hasConfirmedCard || false;
    const confirmedCount = this.state.gameData?.confirmedCount || (hasConfirmed ? 1 : 0);
    const totalCount = this.state.gameData?.totalCount || this.state.players.length || 1;

    return `
      <div class="relative space-y-4 fade-in pb-16">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Top Header & Confirmed Progress Badge -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="WerewolfModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出</span>
          </button>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-xs font-black text-indigo-600 dark:text-indigo-400">
            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
            <span id="deal-confirmed-badge">已蓋牌 ${confirmedCount} / ${totalCount} 人</span>
          </div>
        </div>

        <!-- Hero Header -->
        <div class="text-center space-y-1">
          <span class="inline-block text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
            第一階段：確認身份
          </span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white">點擊卡牌翻面查看</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">不限時確認，看完請翻回背面蓋牌，待全員蓋牌後自動進入夜晚！</p>
        </div>

        <!-- 3D Flip Card Container -->
        <div class="flex flex-col items-center justify-center py-2">
          <div 
            id="identity-flip-card"
            onclick="WerewolfModule.toggleFlipCard()"
            class="w-64 h-96 perspective-1000 cursor-pointer tap-scale transition-transform select-none ${isFlipped ? 'card-flipped' : ''}"
          >
            <div class="card-flip-inner relative w-full h-full duration-500 rounded-3xl shadow-2xl">
              <!-- Card Front: Face Down (Card Back Design) -->
              <div class="backface-hidden absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-2 border-amber-400/50 p-6 flex flex-col items-center justify-between text-white shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between w-full opacity-60 text-xs font-mono">
                  <span>ONUW</span>
                  <span>#${this.state.roomId}</span>
                </div>

                <div class="text-center space-y-2">
                  <img src="icons/roles/card_back.svg" alt="牌背" class="w-28 h-36 mx-auto object-contain drop-shadow-2xl">
                  <p class="text-sm font-bold tracking-wider text-indigo-200">點擊卡牌翻開查看</p>
                  <p class="text-[11px] text-slate-400 leading-tight">確認身份後請翻回背面蓋牌<br/>待全員蓋牌後自動進入夜晚</p>
                </div>

                <div class="w-full text-center">
                  <span class="inline-block text-[10px] bg-white/10 px-3 py-1 rounded-full text-indigo-300">
                    點擊翻面 🔄
                  </span>
                </div>
              </div>

              <!-- Card Back: Face Up (Revealed Role) -->
              <div class="backface-hidden rotate-y-180 absolute inset-0 w-full h-full rounded-3xl ${
                roleDef.team === 'werewolf' 
                  ? 'bg-gradient-to-br from-slate-900 via-rose-950 to-slate-950 border-2 border-rose-500/60 text-rose-100 shadow-rose-950/50' 
                  : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border-2 border-indigo-500/60 text-indigo-100 shadow-indigo-950/50'
              } p-6 flex flex-col items-center justify-between shadow-2xl">
                <div class="flex items-center justify-between w-full">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    roleDef.team === 'werewolf' ? 'bg-rose-500/30 text-rose-300' : 'bg-indigo-500/30 text-indigo-300'
                  }">
                    ${roleDef.teamName}
                  </span>
                  <span class="text-xs font-mono text-slate-400">#${this.state.roomId}</span>
                </div>

                <div class="text-center space-y-2">
                  <img src="${roleDef.image}" alt="${roleDef.name}" class="w-24 h-24 mx-auto object-contain drop-shadow-2xl">
                  <h3 class="text-2xl font-black text-white">${roleDef.name}</h3>
                  <p class="text-xs leading-relaxed ${roleDef.team === 'werewolf' ? 'text-rose-200/90' : 'text-indigo-200/90'} max-w-[210px] mx-auto">
                    ${roleDef.desc}
                  </p>
                </div>

                <div class="w-full text-center">
                  <span class="text-[10px] text-slate-400">點擊任意處翻回背面隱藏並確認</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Button & Status -->
        <div>
          <button 
            id="deal-confirm-action-btn"
            onclick="WerewolfModule.toggleFlipCard()" 
            class="tap-scale w-full py-3.5 rounded-2xl ${
              isFlipped 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30' 
                : (hasConfirmed 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm')
            } font-bold text-xs flex items-center justify-center space-x-1.5"
          >
            <i data-lucide="${isFlipped ? 'eye-off' : (hasConfirmed ? 'check-circle' : 'eye')}" class="w-4 h-4"></i>
            <span>${
              isFlipped 
                ? '我已確認身份 (翻面蓋牌)' 
                : (hasConfirmed 
                    ? '已確認並蓋牌 (點擊卡牌可再次查看)' 
                    : '點擊卡牌翻面查看身份')
            }</span>
          </button>
          <p id="deal-confirmed-desc" class="text-[11px] text-slate-400 text-center mt-2">
            ${confirmedCount >= totalCount ? '全員已蓋牌！即將進入夜晚行動...' : `等待其他玩家確認 (${confirmedCount}/${totalCount})`}
          </p>
        </div>
      </div>
    `;
  },

  // View: Night Phase
  renderNightPhase() {
    const currentRole = this.state.gameData?.currentNightRole;
    const roleDef = this.getRoleDef(currentRole);
    const stepIdx = (this.state.gameData?.currentNightIndex || 0) + 1;
    const totalSteps = this.state.gameData?.totalNightSteps || (this.state.gameData?.nightOrder?.length || 1);
    const timerVal = this.state.gameData?.timerSeconds ?? 12;

    const myInitialRole = this.state.gameData?.myInitialRole;
    const isMeActive = (myInitialRole === currentRole);
    const helperData = this.state.gameData?.stepHelperData || {};
    const hasActed = this.state.gameData?.hasActedThisNight || false;
    const actionResult = this.state.gameData?.actionResult;

    return `
      <div class="relative space-y-4 fade-in pb-16">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🌙</span>
            <div>
              <h2 class="text-xs font-black text-slate-900 dark:text-white">第二階段：夜間行動</h2>
              <p class="text-[10px] text-slate-400">輪次 ${stepIdx} / ${totalSteps}</p>
            </div>
          </div>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full ${
            isMeActive 
              ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 animate-pulse' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          } text-xs font-black">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span id="game-phase-timer">${timerVal}s</span>
          </div>
        </div>

        ${isMeActive ? `
          <!-- ACTIVE PLAYER VIEW -->
          <div class="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white border-2 border-indigo-500/80 shadow-2xl shadow-indigo-950/60 space-y-4">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px] border border-amber-500/40">
                🌟 輪到你的回合醒來！
              </span>
              <img src="${roleDef.image}" alt="${roleDef.name}" class="w-9 h-9 object-contain">
            </div>

            <div>
              <h3 class="text-xl font-black">${roleDef.name} 請行動</h3>
              <p class="text-xs text-indigo-200 mt-1">${roleDef.desc}</p>
            </div>

            <!-- Role Specific Action Component -->
            <div class="bg-black/40 rounded-2xl p-4 border border-white/10 space-y-3">
              ${this.renderActiveRoleActionContent(currentRole, helperData, hasActed, actionResult)}
            </div>

            ${hasActed ? `
              <div class="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center space-x-1.5">
                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                <span>行動已完成，請靜候夜晚結束...</span>
              </div>
            ` : ''}
          </div>
        ` : `
          <!-- SLEEPING PLAYERS VIEW (DARK AMBIENT) -->
          <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white border border-slate-800 shadow-2xl flex flex-col items-center justify-center text-center py-12 space-y-4">
            <div class="w-24 h-24 rounded-full bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-5xl shadow-2xl night-glow">
              😴
            </div>

            <div class="space-y-1">
              <h3 class="text-lg font-black tracking-wide text-slate-100">所有玩家請閉上雙眼</h3>
              <p class="text-xs text-indigo-300">目前輪次：<span class="inline-flex items-center space-x-1.5 text-amber-400 font-bold"><img src="${roleDef.image}" class="w-5 h-5 object-contain" alt="${roleDef.name}"><span>${roleDef.name}</span></span> 正在行動中</p>
            </div>

            <div class="p-3 rounded-2xl bg-white/5 border border-white/10 max-w-xs text-[11px] text-slate-400 leading-relaxed">
              請保持絕對安靜，不要發出聲響、移動身體或晃動手機，等待所有人行動完成。
            </div>
          </div>
        `}
      </div>
    `;
  },

  renderActiveRoleActionContent(roleId, helperData, hasActed, actionResult) {
    const cLabels = ['底牌 A', '底牌 B', '底牌 C'];

    if (roleId === 'werewolf') {
      const wolfIds = helperData.werewolfIds || [];
      const otherWolves = wolfIds.filter(id => id !== this.state.myPlayerId);

      if (otherWolves.length > 0) {
        return `
          <p class="text-xs font-bold text-slate-200">🐺 你的同伴狼人為：</p>
          <div class="flex flex-wrap gap-2 pt-1">
            ${otherWolves.map(id => `
              <span class="px-3 py-1.5 rounded-xl bg-rose-500/30 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center space-x-1">
                <span>🐺</span>
                <span>${this.getPlayerName(id)}</span>
              </span>
            `).join('')}
          </div>
          <p class="text-[11px] text-slate-400 mt-2">天亮後請互相掩護，誤導村民！</p>
        `;
      } else {
        // Solitary Wolf
        return `
          <div class="space-y-2">
            <p class="text-xs font-bold text-rose-300">你是場上唯一的孤狼！可查驗 1 張中央底牌：</p>
            <div class="grid grid-cols-3 gap-2 pt-1">
              ${[0, 1, 2].map(idx => {
                const isChosen = actionResult && actionResult.type === 'lone_wolf' && actionResult.idx === idx;
                const rDef = isChosen ? this.getRoleDef(actionResult.role) : null;
                return `
                  <button 
                    onclick="WerewolfModule.loneWolfPeekCenter(${idx})"
                    ${hasActed ? 'disabled' : ''}
                    class="tap-scale p-3 rounded-2xl border text-center transition-all ${
                      isChosen 
                        ? 'bg-rose-950/90 border-rose-500 text-rose-100 shadow-md' 
                        : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }"
                  >
                    <div class="mb-1 flex items-center justify-center">${isChosen ? `<img src="${rDef.image}" class="w-7 h-7 object-contain" alt="${rDef.name}">` : `<img src="icons/roles/card_back.svg" class="w-7 h-7 object-contain" alt="底牌">`}</div>
                    <div class="text-[11px] font-bold">${isChosen ? rDef.name : cLabels[idx]}</div>
                  </button>
                `;
              }).join('')}
            </div>
            ${actionResult && actionResult.type === 'lone_wolf' ? `
              <div class="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-[11px] text-rose-200">
                查驗結果：${cLabels[actionResult.idx]} 為 <strong>${this.getRoleDef(actionResult.role).name}</strong>！
              </div>
            ` : ''}
          </div>
        `;
      }
    } else if (roleId === 'minion') {
      const wolfIds = helperData.werewolfIds || [];
      return `
        <div class="space-y-2">
          <p class="text-xs font-bold text-slate-200">🦊 爪牙請看：場上的狼人玩家為：</p>
          ${wolfIds.length > 0 ? `
            <div class="flex flex-wrap gap-2 pt-1">
              ${wolfIds.map(id => `
                <span class="px-3 py-1.5 rounded-xl bg-rose-500/30 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center space-x-1">
                  <span>🐺</span>
                  <span>${this.getPlayerName(id)}</span>
                </span>
              `).join('')}
            </div>
            <p class="text-[11px] text-slate-400">狼人不知道你是誰，請在白天保護狼人並混淆好人視聽！</p>
          ` : `
            <p class="text-xs text-amber-300 font-bold">場上沒有任何狼人！（所有狼人都在中央底牌）</p>
            <p class="text-[11px] text-slate-400">只要白天無人被處決，或你存活下來，狼人陣營即獲勝！</p>
          `}
        </div>
      `;
    } else if (roleId === 'mason') {
      const masonIds = helperData.masonIds || [];
      const otherMasons = masonIds.filter(id => id !== this.state.myPlayerId);
      return `
        <div class="space-y-2">
          <p class="text-xs font-bold text-slate-200">👮 守夜人同伴：</p>
          ${otherMasons.length > 0 ? `
            <div class="flex flex-wrap gap-2 pt-1">
              ${otherMasons.map(id => `
                <span class="px-3 py-1.5 rounded-xl bg-indigo-500/30 border border-indigo-500/50 text-indigo-200 font-bold text-xs">
                  👮 ${this.getPlayerName(id)}
                </span>
              `).join('')}
            </div>
            <p class="text-[11px] text-slate-400">對方是鐵好人同伴，白天可以互信配合！</p>
          ` : `
            <p class="text-xs text-slate-300">沒有其他守夜人（另一張牌在中央底牌中）。</p>
          `}
        </div>
      `;
    } else if (roleId === 'seer') {
      if (hasActed && actionResult) {
        if (actionResult.type === 'seer_player') {
          const rDef = this.getRoleDef(actionResult.role);
          return `
            <div class="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-1">
              <span class="text-[10px] uppercase font-bold text-indigo-300">查驗玩家結果</span>
              <p class="text-xs font-bold text-white">
                玩家 <strong>${actionResult.targetName}</strong> 的手牌為：<br/>
                <span class="inline-flex items-center space-x-1.5 text-amber-400 mt-1 font-bold text-base"><img src="${rDef.image}" class="w-6 h-6 object-contain" alt="${rDef.name}"><span>${rDef.name}</span></span>
                <span class="text-[11px] text-indigo-200">(${rDef.teamName})</span>
              </p>
            </div>
          `;
        } else if (actionResult.type === 'seer_center') {
          const r1 = this.getRoleDef(actionResult.role1);
          const r2 = this.getRoleDef(actionResult.role2);
          return `
            <div class="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-2">
              <span class="text-[10px] uppercase font-bold text-indigo-300">查驗底牌結果</span>
              <div class="grid grid-cols-2 gap-2 text-xs font-bold">
                <div class="p-2 rounded-xl bg-black/40 text-center">
                  <img src="${r1.image}" class="w-8 h-8 object-contain mx-auto mb-1" alt="${r1.name}">
                  <div class="text-slate-300">${cLabels[actionResult.idx1]}</div>
                  <div class="text-white">${r1.name}</div>
                </div>
                <div class="p-2 rounded-xl bg-black/40 text-center">
                  <img src="${r2.image}" class="w-8 h-8 object-contain mx-auto mb-1" alt="${r2.name}">
                  <div class="text-slate-300">${cLabels[actionResult.idx2]}</div>
                  <div class="text-white">${r2.name}</div>
                </div>
              </div>
            </div>
          `;
        }
      }

      const otherPlayers = this.state.players.filter(p => p.id !== this.state.myPlayerId);
      const seerCenterTargets = this.state.gameData?.seerCenterTargets || [];

      return `
        <div class="space-y-3">
          <div>
            <p class="text-xs font-bold text-indigo-200">方式一：查驗 1 位玩家手牌</p>
            <div class="grid grid-cols-2 gap-2 pt-1">
              ${otherPlayers.length > 0 ? otherPlayers.map(p => `
                <button 
                  onclick="WerewolfModule.seerPeekPlayer('${p.id}')"
                  class="tap-scale p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 text-left flex items-center space-x-1.5"
                >
                  <span>👤</span>
                  <span class="truncate">${p.name}</span>
                </button>
              `).join('') : `<div class="text-[11px] text-slate-500 col-span-2">尚無其他玩家</div>`}
            </div>
          </div>

          <div class="pt-2 border-t border-white/10">
            <p class="text-xs font-bold text-indigo-200">方式二：查驗中央 2 張底牌</p>
            <div class="grid grid-cols-3 gap-2 pt-1">
              ${[0, 1, 2].map(idx => {
                const isSelected = seerCenterTargets.includes(idx);
                return `
                  <button 
                    onclick="WerewolfModule.toggleSeerCenterTarget(${idx})"
                    class="tap-scale p-2.5 rounded-xl border text-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-400 text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }"
                  >
                    <div class="text-xs font-bold">${cLabels[idx]}</div>
                    <div class="text-[10px] text-slate-400">${isSelected ? '✓ 已選' : '點選'}</div>
                  </button>
                `;
              }).join('')}
            </div>
            ${seerCenterTargets.length === 2 ? `
              <button 
                onclick="WerewolfModule.seerConfirmCenterPeek()"
                class="tap-scale w-full mt-2 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md"
              >
                確認查驗這 2 張底牌
              </button>
            ` : ''}
          </div>
        </div>
      `;
    } else if (roleId === 'robber') {
      if (hasActed && actionResult) {
        const newDef = this.getRoleDef(actionResult.newRole);
        return `
          <div class="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-2 text-center">
            <span class="text-[10px] uppercase font-bold text-indigo-300">搶奪交換成功</span>
            <p class="text-xs text-slate-200">你已搶奪了 <strong>${actionResult.targetName}</strong> 的手牌！</p>
            <div class="p-3 rounded-xl bg-black/40 inline-block px-6">
              <img src="${newDef.image}" class="w-12 h-12 object-contain mx-auto mb-1" alt="${newDef.name}">
              <div class="text-base font-black text-white mt-1">${newDef.name}</div>
              <div class="text-[10px] text-indigo-300 font-bold">${newDef.teamName}</div>
            </div>
            <p class="text-[11px] text-amber-300 font-bold">你現在屬於此新陣營，白天請依照新身份獲勝！</p>
          </div>
        `;
      }

      const otherPlayers = this.state.players.filter(p => p.id !== this.state.myPlayerId);
      return `
        <div class="space-y-2">
          <p class="text-xs font-bold text-indigo-200">選擇 1 位玩家交換手牌（並查看新身份）：</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            ${otherPlayers.length > 0 ? otherPlayers.map(p => `
              <button 
                onclick="WerewolfModule.robberSwap('${p.id}')"
                class="tap-scale p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 text-left flex items-center space-x-1.5"
              >
                <span>🥷</span>
                <span class="truncate">${p.name}</span>
              </button>
            `).join('') : `<div class="text-[11px] text-slate-500 col-span-2">尚無其他玩家可交換</div>`}
          </div>
        </div>
      `;
    } else if (roleId === 'troublemaker') {
      if (hasActed && actionResult) {
        return `
          <div class="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-1 text-center">
            <span class="text-[10px] uppercase font-bold text-indigo-300">交換成功</span>
            <p class="text-xs font-bold text-white">
              已成功交換 <strong>${actionResult.name1}</strong> 與 <strong>${actionResult.name2}</strong> 的手牌！
            </p>
            <p class="text-[10px] text-slate-400 mt-1">（你不會得知他們各自的新牌內容）</p>
          </div>
        `;
      }

      const otherPlayers = this.state.players.filter(p => p.id !== this.state.myPlayerId);
      const troubleTargets = this.state.gameData?.troubleTargets || [];

      return `
        <div class="space-y-2">
          <p class="text-xs font-bold text-indigo-200">選擇任意 2 位其他玩家交換手牌（自己不看內容）：</p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            ${otherPlayers.length >= 2 ? otherPlayers.map(p => {
              const isSelected = troubleTargets.includes(p.id);
              return `
                <button 
                  onclick="WerewolfModule.toggleTroublemakerTarget('${p.id}')"
                  class="tap-scale p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-400 text-white' 
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }"
                >
                  <span class="truncate">${p.name}</span>
                  <span class="text-[10px] block opacity-70">${isSelected ? '✓ 已選' : '點選'}</span>
                </button>
              `;
            }).join('') : `<div class="text-[11px] text-slate-500 col-span-2">需至少 2 位其他玩家</div>`}
          </div>

          ${troubleTargets.length === 2 ? `
            <button 
              onclick="WerewolfModule.troublemakerConfirmSwap()"
              class="tap-scale w-full mt-2 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md"
            >
              確認交換這 2 位玩家手牌
            </button>
          ` : `
            <p class="text-[10px] text-slate-400 text-center">已選擇 ${troubleTargets.length} / 2 位玩家</p>
          `}
        </div>
      `;
    } else if (roleId === 'drunk') {
      if (hasActed && actionResult) {
        return `
          <div class="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-1 text-center">
            <span class="text-[10px] uppercase font-bold text-indigo-300">盲換完成</span>
            <p class="text-xs font-bold text-white">
              🍺 你已將自己的手牌與 <strong>${cLabels[actionResult.centerIdx]}</strong> 盲換！
            </p>
            <p class="text-[11px] text-amber-300 mt-1">你現在完全不知道自己是誰，白天請多方觀察推理！</p>
          </div>
        `;
      }

      return `
        <div class="space-y-2">
          <p class="text-xs font-bold text-indigo-200">酒醉恍惚！請選擇中央 1 張底牌盲換（不能看內容）：</p>
          <div class="grid grid-cols-3 gap-2 pt-1">
            ${[0, 1, 2].map(idx => `
              <button 
                onclick="WerewolfModule.drunkSwap(${idx})"
                class="tap-scale p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-center text-slate-200"
              >
                <img src="icons/roles/card_back.svg" class="w-8 h-8 object-contain mx-auto mb-1" alt="底牌">
                <div class="text-xs font-bold">${cLabels[idx]}</div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else if (roleId === 'insomniac') {
      const finalRole = helperData.insomniacFinalRole || this.state.gameData?.myCurrentRole || 'insomniac';
      const finalDef = this.getRoleDef(finalRole);
      const wasSwapped = (finalRole !== 'insomniac');

      return `
        <div class="p-3.5 rounded-2xl bg-indigo-950/80 border border-indigo-500 space-y-2 text-center">
          <span class="text-[10px] uppercase font-bold text-indigo-300">天亮前最後確認</span>
          <p class="text-xs text-slate-200">你醒來查看自己目前的最終手牌：</p>
          <div class="p-3 rounded-2xl bg-black/40 inline-block px-8">
            <img src="${finalDef.image}" class="w-14 h-14 object-contain mx-auto mb-1" alt="${finalDef.name}">
            <div class="text-lg font-black text-white mt-1">${finalDef.name}</div>
            <div class="text-[10px] text-indigo-300 font-bold">${finalDef.teamName}</div>
          </div>
          ${wasSwapped ? `
            <p class="text-xs text-amber-300 font-bold">⚠️ 你的手牌已被強盜或搗蛋鬼調換過！</p>
          ` : `
            <p class="text-xs text-emerald-400 font-bold">✓ 你的手牌依然是失眠者，整晚未被更換。</p>
          `}
        </div>
      `;
    }

    return `<div class="text-xs text-slate-400">閉眼睡覺中...</div>`;
  },

  // View: Day Discussion Phase
  renderDayPhase() {
    const timerSec = this.state.gameData?.timerSeconds ?? 180;
    const m = Math.floor(timerSec / 60);
    const s = timerSec % 60;
    const timerStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const isHost = this.state.isHost;

    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const isCoolingDown = elapsed < 10000;
    const remainingSec = isCoolingDown ? Math.ceil((10000 - elapsed) / 1000) : 0;

    return `
      <div class="relative space-y-4 fade-in pb-20">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Header -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="WerewolfModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出</span>
          </button>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-xs font-black text-amber-600 dark:text-amber-400">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span id="game-phase-timer">${timerStr}</span>
          </div>
        </div>

        <!-- Sunrise Hero Banner -->
        <div class="rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white shadow-xl shadow-amber-500/20 space-y-1">
          <div class="flex items-center space-x-2 text-amber-100 text-[10px] font-bold uppercase tracking-wider">
            <span>☀️</span>
            <span>第三階段：白日自由辯論</span>
          </div>
          <h2 class="text-2xl font-black text-white">天亮了！全體睜眼！</h2>
          <p class="text-xs text-amber-100 leading-relaxed">
            自由發言與邏輯推理，找出誰在夜裡調換了卡牌，並揪出潛伏的狼人！
          </p>
        </div>

        <!-- Living Players Grid -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
              <span>場上存活玩家 (${this.state.players.length})</span>
            </span>
            <span class="text-[10px] font-bold text-emerald-500">全部在場</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            ${this.state.players.map(p => `
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center space-x-2.5">
                <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  ${p.name.charAt(0).toUpperCase()}
                </div>
                <div class="truncate">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${p.name}</div>
                  <div class="text-[10px] text-slate-400">${p.id === this.state.myPlayerId ? '你本人' : '辯論發言中'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Deduction Tips -->
        <div class="rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
          <p class="text-xs font-bold text-indigo-700 dark:text-indigo-300">💡 辯論提示與技巧：</p>
          <ul class="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
            <li>• 預言家可主動跳出告知查驗結果，建立邏輯基石。</li>
            <li>• 強盜與搗蛋鬼可選擇何時誠實說出調換對象。</li>
            <li>• 狼人可偽裝成好人製造混亂，留意發言是否有時間矛盾！</li>
          </ul>
        </div>

        <!-- Quick Reactions in Discussion -->
        <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">發言表情互動</span>
            <span class="text-[10px] text-slate-400">點擊傳送</span>
          </div>
          <div class="flex items-center justify-around py-0.5">
            <button onclick="WerewolfModule.sendReaction('🐺')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">🐺</button>
            <button onclick="WerewolfModule.sendReaction('👀')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">👀</button>
            <button onclick="WerewolfModule.sendReaction('🔥')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">🔥</button>
            <button onclick="WerewolfModule.sendReaction('👍')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">👍</button>
            <button onclick="WerewolfModule.sendReaction('❓')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">❓</button>
            <button onclick="WerewolfModule.sendReaction('💀')" class="reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'}">💀</button>
          </div>
        </div>

        <!-- Host Skip to Vote Button -->
        ${isHost ? `
          <div>
            <button 
              onclick="WerewolfModule.hostSkipDayDiscussion()" 
              class="tap-scale w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm shadow-xl shadow-red-600/25 flex items-center justify-center space-x-2"
            >
              <i data-lucide="vote" class="w-5 h-5"></i>
              <span>⚡ 提早結束討論，直接進入投票</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  // View: Voting Phase
  renderVotingPhase() {
    const timerSec = this.state.gameData?.timerSeconds ?? 15;
    const hasVoted = this.state.gameData?.hasVoted || false;
    const selectedTarget = this.state.gameData?.selectedVoteTarget;
    const myVote = this.state.gameData?.myVote;

    return `
      <div class="relative space-y-4 fade-in pb-16">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Top Header & Timer -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🗳️</span>
            <div>
              <h2 class="text-xs font-black text-slate-900 dark:text-white">第四階段：投票處決</h2>
              <p class="text-[10px] text-slate-400">投出你認為最可疑的狼人</p>
            </div>
          </div>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs font-black text-red-600 dark:text-red-400 animate-pulse">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span id="game-phase-timer">${timerSec}s</span>
          </div>
        </div>

        <!-- Voting Prompt Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">請點擊下方對象投出選票：</p>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- No Werewolf Option (場上沒有狼人) -->
            <button 
              onclick="WerewolfModule.selectVoteTarget('NO_WEREWOLF')"
              ${hasVoted ? 'disabled' : ''}
              class="tap-scale col-span-2 p-3.5 rounded-2xl border text-left transition-all ${
                myVote === 'NO_WEREWOLF' 
                  ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30' 
                  : (selectedTarget === 'NO_WEREWOLF' 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' 
                      : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-slate-800 dark:text-slate-200')
              }"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-9 h-9 rounded-xl ${selectedTarget === 'NO_WEREWOLF' || myVote === 'NO_WEREWOLF' ? 'bg-white/20' : 'bg-emerald-500 text-white'} flex items-center justify-center font-black text-base shrink-0">
                    🕊️
                  </div>
                  <div>
                    <div class="text-xs font-black">場上沒有狼人 (平安夜)</div>
                    <div class="text-[10px] ${selectedTarget === 'NO_WEREWOLF' || myVote === 'NO_WEREWOLF' ? 'text-white/80' : 'text-slate-400'}">若認為狼全在中央底牌、場上無狼需處決，請投此項</div>
                  </div>
                </div>
                ${myVote === 'NO_WEREWOLF' ? `
                  <div class="text-[10px] font-bold text-rose-200">✓ 已投此項</div>
                ` : ''}
              </div>
            </button>
            ${this.state.players.map(p => {
              const isSelected = selectedTarget === p.id;
              const isMe = p.id === this.state.myPlayerId;
              const isMyVoteTarget = myVote === p.id;

              return `
                <button 
                  onclick="WerewolfModule.selectVoteTarget('${p.id}')"
                  ${hasVoted ? 'disabled' : ''}
                  class="tap-scale p-3.5 rounded-2xl border text-left transition-all ${
                    isMyVoteTarget 
                      ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30' 
                      : (isSelected 
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' 
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200')
                  }"
                >
                  <div class="flex items-center space-x-2.5">
                    <div class="w-9 h-9 rounded-xl ${isSelected || isMyVoteTarget ? 'bg-white/20' : 'bg-indigo-600 text-white'} flex items-center justify-center font-black text-xs shrink-0">
                      ${p.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="truncate">
                      <div class="text-xs font-black truncate">${p.name}</div>
                      <div class="text-[10px] opacity-70">${isMe ? '(你自己)' : '玩家'}</div>
                    </div>
                  </div>
                  ${isMyVoteTarget ? `
                    <div class="text-[10px] font-bold text-rose-200 mt-2">✓ 已投此人</div>
                  ` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Action Button -->
        <div>
          ${hasVoted ? `
            <div class="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-xl flex items-center justify-center space-x-2">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              <span>已投票給 ${this.getPlayerName(myVote)}！等待開票...</span>
            </div>
          ` : `
            <button 
              onclick="WerewolfModule.submitVote(WerewolfModule.state.gameData.selectedVoteTarget)"
              ${!selectedTarget ? 'disabled' : ''}
              class="tap-scale w-full py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all ${
                selectedTarget 
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-red-600/30' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }"
            >
              <i data-lucide="check" class="w-5 h-5"></i>
              <span>${selectedTarget ? `確認投票給 ${this.getPlayerName(selectedTarget)}` : '請先選取一位投票對象'}</span>
            </button>
          `}
        </div>
      </div>
    `;
  },

  // View: Settlement & Timeline Replay Phase
  renderResultPhase() {
    const data = this.state.gameData || {};
    const winningTeam = data.winningTeam || 'villager';
    const isVillagerWin = winningTeam === 'villager';
    const winReason = data.winReason || '';
    const executedPlayers = data.executedPlayers || [];
    const voteCounts = data.voteCounts || {};
    const votes = data.votes || {};
    const initialCards = data.initialCards || {};
    const finalCards = data.finalCards || {};
    const centerCards = data.centerCards || [];
    const initialCenterCards = data.initialCenterCards || [];
    const nightLogs = data.nightLogs || [];
    const isHost = this.state.isHost;
    const cLabels = ['底牌 A', '底牌 B', '底牌 C'];

    return `
      <div class="relative space-y-4 fade-in pb-20">
        <!-- Floating Reactions Container -->
        <div id="floating-reactions" class="pointer-events-none fixed inset-0 z-50"></div>

        <!-- Header -->
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
            <i data-lucide="trophy" class="w-4 h-4 text-amber-500"></i>
            <span>遊戲結算與復盤</span>
          </span>
          <button onclick="WerewolfModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-700 tap-scale">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span>退出</span>
          </button>
        </div>

        <!-- Victory Hero Banner -->
        <div class="rounded-3xl p-6 text-white shadow-2xl space-y-2 ${
          isVillagerWin 
            ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 shadow-emerald-700/30' 
            : 'bg-gradient-to-br from-rose-700 via-red-800 to-slate-900 shadow-rose-800/30'
        }">
          <div class="flex items-center space-x-2 text-white/80 text-[10px] font-bold uppercase tracking-wider">
            <span>${isVillagerWin ? '🎉 VICTORY' : '🐺 WEREWOLF WIN'}</span>
          </div>
          <h1 class="text-2xl font-black">${isVillagerWin ? '村民陣營獲勝！🎉' : '狼人陣營獲勝！🐺'}</h1>
          <p class="text-xs text-white/90 leading-relaxed font-semibold">${winReason}</p>
        </div>

        <!-- Executed Players Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex items-center space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>💀</span>
            <span>處決名單：</span>
          </div>

          ${executedPlayers.length > 0 ? `
            <div class="space-y-2">
              ${executedPlayers.map(pId => {
                const finalRole = finalCards[pId];
                const rDef = this.getRoleDef(finalRole);
                return `
                  <div class="flex items-center justify-between p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                    <div class="flex items-center space-x-2.5">
                      <img src="${rDef.image}" class="w-10 h-10 rounded-xl object-contain shrink-0 bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm" alt="${rDef.name}">
                      <div>
                        <div class="text-xs font-bold text-slate-900 dark:text-white">${this.getPlayerName(pId)}</div>
                        <div class="text-[10px] text-rose-600 dark:text-rose-400 font-bold">${rDef.name} (${rDef.teamName})</div>
                      </div>
                    </div>
                    <span class="text-xs font-black text-rose-500 bg-rose-100 dark:bg-rose-900/50 px-2.5 py-1 rounded-xl">處決 💀</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : (voteCounts['NO_WEREWOLF'] >= 2 ? `
            <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-center">
              <span class="text-lg">🕊️</span>
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">平安夜：投票裁定「場上沒有狼人」！</p>
              <p class="text-[10px] text-slate-400">「場上沒有狼人」獲得 ${voteCounts['NO_WEREWOLF']} 票，無人被處決</p>
            </div>
          ` : `
            <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-center">
              <span class="text-lg">🕊️</span>
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">平安夜：無人被處決！</p>
              <p class="text-[10px] text-slate-400">所有人得票數皆未達 2 票處決門檻</p>
            </div>
          `)}
        </div>

        <!-- Players Identity Reveal -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <h3 class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center space-x-1">
            <i data-lucide="eye" class="w-4 h-4 text-indigo-500"></i>
            <span>全員手牌真相揭曉</span>
          </h3>

          <div class="space-y-2">
            ${voteCounts['NO_WEREWOLF'] ? `
              <div class="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="text-base">🕊️</span>
                  <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300">場上沒有狼人</span>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  得 ${voteCounts['NO_WEREWOLF']} 票
                </span>
              </div>
            ` : ''}
            ${this.state.players.map(p => {
              const initRole = initialCards[p.id];
              const finalRole = finalCards[p.id];
              const initDef = this.getRoleDef(initRole);
              const finalDef = this.getRoleDef(finalRole);
              const wasSwapped = initRole !== finalRole;
              const vCount = voteCounts[p.id] || 0;
              const votedTarget = votes[p.id];

              return `
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <div class="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                        ${p.name.charAt(0).toUpperCase()}
                      </div>
                      <span class="text-xs font-bold text-slate-900 dark:text-white">${p.name}</span>
                    </div>

                    <div class="flex items-center space-x-1.5">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        得 ${vCount} 票
                      </span>
                      ${wasSwapped ? `
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                          🔄 被換過
                        </span>
                      ` : ''}
                    </div>
                  </div>

                  <div class="flex items-center justify-between text-xs bg-white dark:bg-slate-800/60 p-2 rounded-xl">
                    <div class="flex items-center space-x-1">
                      <span class="text-slate-400 text-[10px]">原發：</span>
                      <span class="inline-flex items-center space-x-1"><img src="${initDef.image}" class="w-4 h-4 object-contain inline-block" alt="${initDef.name}"><span>${initDef.name}</span></span>
                    </div>
                    <span class="text-slate-400 font-bold">➔</span>
                    <div class="flex items-center space-x-1 font-bold ${finalDef.team === 'werewolf' ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}">
                      <span class="text-slate-400 text-[10px] font-normal">最終：</span>
                      <span class="inline-flex items-center space-x-1"><img src="${finalDef.image}" class="w-4 h-4 object-contain inline-block" alt="${finalDef.name}"><span>${finalDef.name}</span></span>
                    </div>
                  </div>

                  ${votedTarget ? `
                    <p class="text-[10px] text-slate-400 px-1">投給了：<strong>${this.getPlayerName(votedTarget)}</strong></p>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Central Cards Reveal -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
          <h3 class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">中央 3 張底牌：</h3>
          <div class="grid grid-cols-3 gap-2 pt-1">
            ${centerCards.map((cRole, idx) => {
              const cDef = this.getRoleDef(cRole);
              const initCRole = initialCenterCards[idx];
              const wasSwapped = initCRole && initCRole !== cRole;
              return `
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-center space-y-1">
                  <div class="text-[10px] font-mono text-slate-400">${cLabels[idx]}</div>
                  <img src="${cDef.image}" class="w-10 h-10 object-contain mx-auto mb-1 bg-white dark:bg-slate-800 rounded-xl p-0.5 shadow-sm border border-slate-200 dark:border-slate-700" alt="${cDef.name}">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${cDef.name}</div>
                  ${wasSwapped ? `<span class="text-[9px] text-amber-500 font-bold">已換過</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Night Action Timeline (復盤時間軸) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <h3 class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center space-x-1">
            <i data-lucide="history" class="w-4 h-4 text-indigo-500"></i>
            <span>夜間換牌行動時間軸 (復盤)</span>
          </h3>

          ${nightLogs.length > 0 ? `
            <div class="space-y-2 pt-1">
              ${nightLogs.map((log, idx) => `
                <div class="flex items-start space-x-2 text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 leading-snug">
                  <span class="text-slate-400 font-mono text-[10px] shrink-0 mt-0.5">#${idx + 1}</span>
                  <span class="text-slate-700 dark:text-slate-300 font-medium">${log}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-slate-400 py-2 text-center">本局夜晚無角色進行調換行動</p>
          `}
        </div>

        <!-- Host Restart Button -->
        <div>
          ${isHost ? `
            <button 
              onclick="WerewolfModule.hostRestartGame()" 
              class="tap-scale w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center space-x-2"
            >
              <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
              <span>🔄 再來一局 (返回房間大廳)</span>
            </button>
          ` : `
            <div class="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold text-center">
              等待房主發起再來一局...
            </div>
          `}
        </div>
      </div>
    `;
  }
};

window.WerewolfModule = WerewolfModule;

