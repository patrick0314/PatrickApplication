/**
 * Arthur's Legend (亞瑟傳奇 / 阿瓦隆 The Resistance: Avalon)
 * Full Standard Chinese Edition
 * 5 to 10 Players Support with Real-time MQTT Broker Sync
 * Features:
 *  - 5~10 Players Balance Matrix & Automatic Role Pool Setup
 *  - Roles: Merlin, Percival, Loyal Servant of Arthur, Assassin, Morgana, Mordred, Oberon, Minion
 *  - Full 5-Quest Board & 5-Rejection Vote Tracker
 *  - Secret Quest Action Cards with Shuffled Card Reveal Animation
 *  - Strict Timing & Private Inspection for Lady of the Lake (湖中女神：於第 2、3、4 輪任務結算後觸發)
 *  - Endgame Assassin Turnaround Flow
 *  - Real-time Floating Reaction Bar anchored to viewport
 */
const ArthurModule = {
  id: 'arthur',
  name: '亞瑟傳奇',
  icon: 'shield',

  // Network & Game State
  state: {
    client: null,
    connected: false,
    ping: 0,
    pingStart: 0,
    currentView: 'lobby', // 'lobby' | 'room' | 'game'
    roomId: '',
    myPlayerId: '',
    myPlayerName: '',
    isHost: false,
    players: [],
    messages: [],
    brokerIndex: 0,
    lastReactionTime: 0,
    // Role Configuration toggles in Waiting Room
    rolesConfig: {
      percival: true,
      morgana: true,
      mordred: false,
      oberon: false,
      ladyOfLake: true
    },
    // Active Game State
    gamePhase: 'lobby', // 'lobby' | 'room' | 'night' | 'team_selection' | 'team_voting' | 'quest_action' | 'quest_result' | 'lady_of_lake' | 'assassination' | 'game_over'
    gameData: null,
    nightAcknowledged: false,
    mySecretVote: null, // 'approve' | 'reject' for team vote
    mySecretQuestCard: null // 'success' | 'fail' for quest
  },

  _reactionTimer: null,
  _pingInterval: null,
  _visibilityBound: false,

  brokers: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ],

  // 5~10 Players Official Balance Configurations
  CONFIGS: {
    5: { good: 3, evil: 2, quests: [2, 3, 2, 3, 3], twoFailsOnR4: false },
    6: { good: 4, evil: 2, quests: [2, 3, 4, 3, 4], twoFailsOnR4: false },
    7: { good: 4, evil: 3, quests: [2, 3, 3, 4, 4], twoFailsOnR4: true },
    8: { good: 5, evil: 3, quests: [3, 4, 4, 5, 5], twoFailsOnR4: true },
    9: { good: 6, evil: 3, quests: [3, 4, 4, 5, 5], twoFailsOnR4: true },
    10: { good: 6, evil: 4, quests: [3, 4, 4, 5, 5], twoFailsOnR4: true }
  },

  ROLES: {
    merlin: {
      id: 'merlin',
      name: '梅林',
      team: 'good',
      teamName: '正義方',
      emoji: '🧙‍♂️',
      badgeColor: 'bg-blue-600 text-white',
      desc: '知曉所有邪惡方玩家（莫德雷德除外），但必須隱藏自己，若好人3勝後被刺客刺殺則失敗。'
    },
    percival: {
      id: 'percival',
      name: '派西維爾',
      team: 'good',
      teamName: '正義方',
      emoji: '🛡️',
      badgeColor: 'bg-indigo-600 text-white',
      desc: '能看到兩位散發靈光的人（梅林與莫甘娜），但分不清誰是誰，需辨別真梅林並代為掩護。'
    },
    servant: {
      id: 'servant',
      name: '亞瑟的忠臣',
      team: 'good',
      teamName: '正義方',
      emoji: '⚔️',
      badgeColor: 'bg-sky-600 text-white',
      desc: '正義陣營中堅力量，無特殊夜間資訊，依靠邏輯推導、發言分析與投票守護聖杯。'
    },
    assassin: {
      id: 'assassin',
      name: '刺客',
      team: 'evil',
      teamName: '邪惡方',
      emoji: '🗡️',
      badgeColor: 'bg-rose-600 text-white',
      desc: '若好人率先取得 3 次任務勝利，可指認一人刺殺，若命中梅林則邪惡方逆轉獲勝！'
    },
    morgana: {
      id: 'morgana',
      name: '莫甘娜',
      team: 'evil',
      teamName: '邪惡方',
      emoji: '🔮',
      badgeColor: 'bg-purple-600 text-white',
      desc: '邪惡方偽裝大師，在派西維爾眼中與梅林顯示完全相同的靈光，專門混淆視聽。'
    },
    mordred: {
      id: 'mordred',
      name: '莫德雷德',
      team: 'evil',
      teamName: '邪惡方',
      emoji: '👑',
      badgeColor: 'bg-red-700 text-white',
      desc: '邪惡陣營首領，梅林在夜間無法看見他的邪惡身分，是極度危險的隱形敵人。'
    },
    oberon: {
      id: 'oberon',
      name: '奧伯倫',
      team: 'evil',
      teamName: '邪惡方',
      emoji: '🎭',
      badgeColor: 'bg-amber-600 text-white',
      desc: '孤立的邪惡方（盲狼），看不到其他壞人，壞人們也看不到他，但梅林看得到他。'
    },
    minion: {
      id: 'minion',
      name: '莫德雷德爪牙',
      team: 'evil',
      teamName: '邪惡方',
      emoji: '🐺',
      badgeColor: 'bg-rose-700 text-white',
      desc: '邪惡陣營手下，夜間能與壞人同伴互認，負責在任務中暗中投出失敗卡。'
    }
  },

  init() {
    if (!this.state.myPlayerId) {
      let pid = sessionStorage.getItem('arthur_player_id');
      if (!pid) {
        pid = 'art_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('arthur_player_id', pid);
      }
      this.state.myPlayerId = pid;
    }

    if (!this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (this.state.currentView === 'room' || this.state.currentView === 'game') && this.state.roomId && this.state.client) {
          if (!this.state.isHost) {
            this.broadcast({ type: 'REQUEST_SYNC' });
          }
        }
      });
    }
  },

  getRoomTopic(roomId) {
    return `app/arthur/${roomId}`;
  },

  connectMqtt(roomId, callback) {
    if (this.state.client && this.state.client.connected) {
      this.state.client.end(true);
    }

    const brokerUrl = this.brokers[this.state.brokerIndex];
    const clientId = `art_client_${this.state.myPlayerId}_${Math.random().toString(16).substring(2, 8)}`;

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 7000,
        reconnectPeriod: 3000
      });

      this.state.client = client;
      const topic = this.getRoomTopic(roomId);

      client.on('connect', () => {
        this.state.connected = true;
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (!err) {
            this.startPingMeasurement();
            if (callback) callback(true);
          }
        });
      });

      client.on('message', (t, msg) => {
        try {
          const data = JSON.parse(msg.toString());
          this.handleIncomingMessage(data);
        } catch (e) {
          console.error('[Arthur MQTT Parse Error]', e);
        }
      });

      client.on('error', (err) => {
        console.warn('[Arthur MQTT Error]', err);
      });

      client.on('close', () => {
        this.state.connected = false;
      });

    } catch (err) {
      console.error('[Arthur MQTT Init Failed]', err);
      if (callback) callback(false);
    }
  },

  startPingMeasurement() {
    if (this._pingInterval) clearInterval(this._pingInterval);
    this._pingInterval = setInterval(() => {
      if (this.state.connected && this.state.roomId) {
        this.state.pingStart = Date.now();
        this.broadcast({
          type: 'PING',
          from: this.state.myPlayerId
        });
      }
    }, 15000);
  },

  broadcast(payload) {
    if (!this.state.client || !this.state.connected || !this.state.roomId) return;
    const topic = this.getRoomTopic(this.state.roomId);
    const msg = JSON.stringify({
      ...payload,
      senderId: this.state.myPlayerId,
      senderName: this.state.myPlayerName,
      timestamp: Date.now()
    });
    this.state.client.publish(topic, msg, { qos: 1 });
  },

  handleIncomingMessage(data) {
    if (!data || !data.type) return;

    // Handle Ping
    if (data.type === 'PING') {
      if (data.from === this.state.myPlayerId && this.state.pingStart) {
        this.state.ping = Date.now() - this.state.pingStart;
        const pingEl = document.getElementById('art-ping-val') || document.getElementById('art-room-ping-val');
        if (pingEl) pingEl.textContent = `${this.state.ping}ms`;
      }
      return;
    }

    // Floating reaction broadcast
    if (data.type === 'REACTION') {
      this.showFloatingReaction(data.emoji, data.fromName);
      return;
    }

    // Member joins room
    if (data.type === 'PLAYER_JOIN') {
      if (this.state.isHost) {
        const exists = this.state.players.find(p => p.id === data.player.id);
        if (!exists) {
          this.state.players.push(data.player);
          this.broadcastRoomSync();
          App.showToast(`${data.player.name} 加入了房間`, 'info');
        }
      }
      return;
    }

    // Host room sync
    if (data.type === 'ROOM_SYNC') {
      this.state.players = data.players || [];
      this.state.rolesConfig = data.rolesConfig || this.state.rolesConfig;
      
      const me = this.state.players.find(p => p.id === this.state.myPlayerId);
      if (me) {
        this.state.isHost = !!me.isHost;
      }
      if (this.state.currentView === 'room') {
        this.updateRoomUI();
      }
      return;
    }

    // Toggle Role Config
    if (data.type === 'CONFIG_UPDATE') {
      this.state.rolesConfig = data.rolesConfig;
      if (this.state.currentView === 'room') {
        this.updateRoomUI();
      }
      return;
    }

    // Game Start
    if (data.type === 'GAME_START') {
      this.state.gameData = data.gameData;
      this.state.players = data.players;
      this.state.gamePhase = 'night';
      this.state.currentView = 'game';
      this.state.nightAcknowledged = false;
      this.state.mySecretVote = null;
      this.state.mySecretQuestCard = null;

      // Extract my role from gameData
      const myCard = data.gameData.playerRoles[this.state.myPlayerId];
      if (myCard) {
        this.state.myRole = myCard.role;
        this.state.myTeam = myCard.team;
      }

      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      this.renderView();
      App.showToast('亞瑟傳奇遊戲開始！請查閱您的夜間密訊', 'success');
      return;
    }

    // Synchronize game state
    if (data.type === 'GAME_SYNC') {
      this.state.gameData = data.gameData;
      this.state.gamePhase = data.gameData.phase;
      if (this.state.currentView === 'game') {
        this.updateGameUI();
      }
      return;
    }

    // Night phase acknowledgment
    if (data.type === 'NIGHT_ACK') {
      if (this.state.isHost && this.state.gameData) {
        this.state.gameData.nightAcknowledged[data.playerId] = true;
        this.checkNightTransition();
      }
      return;
    }

    // Player voted for team
    if (data.type === 'PLAYER_VOTED_TEAM') {
      if (this.state.gameData) {
        this.state.gameData.votes[data.playerId] = data.voteChoice;
        if (this.state.isHost) {
          this.checkAllVotesReceived();
        } else {
          this.updateGameUI();
        }
      }
      return;
    }

    // Quest card submitted
    if (data.type === 'QUEST_CARD_SUBMITTED') {
      if (this.state.isHost && this.state.gameData) {
        if (!this.state.gameData.questMembersVoted.includes(data.playerId)) {
          this.state.gameData.questMembersVoted.push(data.playerId);
          this.state.gameData.questCards.push({ card: data.cardChoice });
        }
        this.checkAllQuestCardsReceived();
      }
      return;
    }

    // Lady inspection request (from non-host inspector to host)
    if (data.type === 'LADY_INSPECT_REQUEST') {
      if (this.state.isHost && this.state.gameData) {
        this.handleLadyInspectionRequest(data.targetPlayerId, data.inspectorId);
      }
      return;
    }

    // Lady of the Lake Private Inspection Result (only intended for current inspector)
    if (data.type === 'LADY_INSPECTION_RESULT') {
      if (data.inspectorId === this.state.myPlayerId) {
        this.showLadyInspectionModal(data.targetName, data.targetTeam);
      }
      return;
    }

    // Assassin action request (from non-host assassin to host)
    if (data.type === 'ASSASSINATE_ACTION') {
      if (this.state.isHost && this.state.gameData) {
        this.executeAssassination(data.targetPlayerId);
      }
      return;
    }

    // Back to room from game over
    if (data.type === 'BACK_TO_ROOM') {
      this.state.gameData = null;
      this.state.currentView = 'room';
      this.renderView();
      return;
    }

    // Player leaves
    if (data.type === 'PLAYER_LEAVE') {
      this.state.players = this.state.players.filter(p => p.id !== data.playerId);
      if (this.state.isHost) {
        this.broadcastRoomSync();
      }
      App.showToast(`${data.playerName} 離開了房間`, 'info');
      this.updateRoomUI();
      return;
    }

    // Host transfer
    if (data.type === 'HOST_TRANSFER') {
      if (data.newHostId === this.state.myPlayerId) {
        this.state.isHost = true;
        App.showToast('您已成為新房主！', 'info');
      }
      this.state.players.forEach(p => p.isHost = (p.id === data.newHostId));
      this.updateRoomUI();
      return;
    }
  },

  broadcastRoomSync() {
    this.broadcast({
      type: 'ROOM_SYNC',
      players: this.state.players,
      rolesConfig: this.state.rolesConfig
    });
  },

  // Reaction interaction
  sendReaction(emoji) {
    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const cooldownMs = 10000;

    if (elapsed < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
      App.showToast(`表情冷卻中，請等待 ${remainingSec} 秒 ⏳`, 'info');
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
      const hint = document.getElementById('art-reaction-hint-text');
      const btns = document.querySelectorAll('.art-reaction-btn');

      if (remainingSec <= 0) {
        if (this._reactionTimer) {
          clearInterval(this._reactionTimer);
          this._reactionTimer = null;
        }
        if (hint) {
          hint.textContent = '點擊即時發送圓桌表情';
          hint.className = 'text-[10px] text-slate-400';
        }
        btns.forEach(b => {
          b.classList.remove('opacity-40', 'cursor-not-allowed');
          b.classList.add('hover:scale-125');
        });
      } else {
        if (hint) {
          hint.textContent = `⏳ 冷卻中 (${remainingSec} 秒)`;
          hint.className = 'text-[10px] font-bold text-amber-500 animate-pulse';
        }
        btns.forEach(b => {
          b.classList.add('opacity-40', 'cursor-not-allowed');
          b.classList.remove('hover:scale-125');
        });
      }
    };

    updateCooldownUI();
    this._reactionTimer = setInterval(updateCooldownUI, 500);
  },

  showFloatingReaction(emoji, fromName) {
    let container = document.getElementById('global-floating-reactions');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-floating-reactions';
      container.className = 'pointer-events-none fixed inset-x-0 bottom-0 top-0 max-w-md mx-auto z-50 overflow-hidden';
      document.body.appendChild(container);
    }

    const existingCount = container.children.length;
    const bottomPx = 80 + ((existingCount % 5) * 44);
    const offset = Math.floor(Math.random() * 24) - 12;

    const el = document.createElement('div');
    el.className = 'absolute right-6 flex items-center space-x-2 px-3.5 py-2 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-bold shadow-2xl border border-white/20 animate-bounce pointer-events-none z-50 transition-all duration-300';
    el.style.bottom = `${bottomPx}px`;
    el.style.transform = `translateX(${offset}px)`;
    el.innerHTML = `<span class="text-2xl">${emoji}</span><span class="text-xs font-bold opacity-90">${fromName}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = `translateX(${offset}px) translateY(-12px)`;
      setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 2200);
  },

  // Lobby actions
  createRoom() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const name = settings.userName || 'default';
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();

    this.state.roomId = roomId;
    this.state.myPlayerName = name;
    this.state.isHost = true;
    this.state.players = [{
      id: this.state.myPlayerId,
      name: name,
      isHost: true,
      isReady: true
    }];

    this.connectMqtt(roomId, (ok) => {
      if (ok) {
        this.state.currentView = 'room';
        this.renderView();
        App.showToast(`已建立亞瑟傳奇房間 #${roomId}`, 'success');
      } else {
        App.showToast('連線伺服器失敗，請重試', 'error');
      }
    });
  },

  joinRoom(inputRoomId) {
    const code = (inputRoomId || document.getElementById('art-join-room-input')?.value || document.getElementById('art-join-code-input')?.value || '').trim();
    if (!code || code.length !== 4) {
      App.showToast('請輸入 4 位數房間代號', 'warning');
      return;
    }

    const settings = StorageManager.get('settings', { userName: 'default' });
    const name = settings.userName || 'default';

    this.state.roomId = code;
    this.state.myPlayerName = name;
    this.state.isHost = false;

    this.connectMqtt(code, (ok) => {
      if (ok) {
        this.state.currentView = 'room';
        this.broadcast({
          type: 'PLAYER_JOIN',
          player: {
            id: this.state.myPlayerId,
            name: name,
            isHost: false,
            isReady: true
          }
        });
        this.renderView();
        App.showToast(`正在進入房間 #${code}...`, 'info');
      } else {
        App.showToast('連線伺服器失敗，請重試', 'error');
      }
    });
  },

  leaveRoom() {
    App.confirm({
      title: '確定要退出房間嗎？',
      confirmText: '退出房間',
      cancelText: '取消',
      onConfirm: () => {
        if (this.state.roomId) {
          this.broadcast({
            type: 'PLAYER_LEAVE',
            playerId: this.state.myPlayerId,
            playerName: this.state.myPlayerName
          });
        }
        if (this.state.client) {
          this.state.client.end(true);
        }
        this.state.currentView = 'lobby';
        this.state.roomId = '';
        this.state.gameData = null;
        this.state.players = [];
        this.renderView();
      }
    });
  },

  copyRoomCode() {
    if (!this.state.roomId) return;
    navigator.clipboard.writeText(this.state.roomId).then(() => {
      App.showToast(`房間代號 #${this.state.roomId} 已複製！`, 'success');
    }).catch(() => {
      App.showToast(`房間代號為: ${this.state.roomId}`, 'info');
    });
  },

  promptChangeName() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const currentName = settings.userName || 'default';
    App.prompt({
      title: '修改騎士暱稱',
      defaultValue: currentName,
      placeholder: '請輸入暱稱...',
      confirmText: '儲存',
      cancelText: '取消',
      onConfirm: (newName) => {
        if (!newName) {
          App.showToast('名稱不能為空', 'error');
          return;
        }
        settings.userName = newName;
        StorageManager.set('settings', settings);
        this.state.myPlayerName = newName;
        App.updateHeader();
        this.renderView();
        App.showToast(`騎士暱稱已更新為：${newName}`, 'success');
      }
    });
  },

  // Toggle roles in room
  toggleRoleConfig(roleKey) {
    if (!this.state.isHost) return;
    this.state.rolesConfig[roleKey] = !this.state.rolesConfig[roleKey];
    this.broadcast({
      type: 'CONFIG_UPDATE',
      rolesConfig: this.state.rolesConfig
    });
    this.updateRoomUI();
  },

  // Shuffle players in room
  randomShufflePlayers() {
    if (!this.state.isHost) return;
    // Shuffle array order for seats
    const arr = [...this.state.players];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.state.players = arr;
    this.broadcastRoomSync();
    this.updateRoomUI();
    App.showToast('已隨機調整圓桌座位順序！', 'success');
    if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
  },

  // Host starts game
  hostStartGame() {
    if (!this.state.isHost) return;
    const count = this.state.players.length;
    if (count < 5 || count > 10) {
      App.showToast('亞瑟傳奇需 5 ~ 10 人才能開局！', 'warning');
      return;
    }

    const cfg = this.CONFIGS[count];
    const rolesConfig = this.state.rolesConfig;

    // Check Good Roles: Merlin (always) + Percival (optional) + Servants
    const goodRoles = ['merlin'];
    if (rolesConfig.percival) goodRoles.push('percival');
    while (goodRoles.length < cfg.good) {
      goodRoles.push('servant');
    }

    // Check Evil Roles: Assassin (always) + Morgana (optional) + Mordred (optional) + Oberon (optional) + Minions
    const evilRoles = ['assassin'];
    if (rolesConfig.morgana && evilRoles.length < cfg.evil) evilRoles.push('morgana');
    if (rolesConfig.mordred && evilRoles.length < cfg.evil) evilRoles.push('mordred');
    if (rolesConfig.oberon && evilRoles.length < cfg.evil) evilRoles.push('oberon');
    while (evilRoles.length < cfg.evil) {
      evilRoles.push('minion');
    }

    // Shuffle all roles
    const allRoles = [...goodRoles, ...evilRoles];
    for (let i = allRoles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allRoles[i], allRoles[j]] = [allRoles[j], allRoles[i]];
    }

    // Assign roles to players
    const playerRoles = {};
    this.state.players.forEach((p, idx) => {
      const roleId = allRoles[idx];
      const roleDef = this.ROLES[roleId];
      playerRoles[p.id] = {
        role: roleId,
        team: roleDef.team
      };
    });

    // Determine initial leader (random or player 0)
    const initialLeaderIdx = Math.floor(Math.random() * count);

    // Lady of the Lake initial holder: seated immediately to the right of the first leader (i.e. (leaderIdx - 1 + count) % count)
    const initialLadyHolderIdx = (initialLeaderIdx - 1 + count) % count;
    const initialLadyHolderId = this.state.players[initialLadyHolderIdx].id;

    const gameData = {
      phase: 'night',
      round: 1, // 1 to 5
      leaderIndex: initialLeaderIdx,
      rejectCount: 0, // 0 to 5
      questResults: [null, null, null, null, null], // 'success' | 'fail' | null
      questFails: [0, 0, 0, 0, 0],
      selectedTeam: [],
      votes: {}, // { [playerId]: 'approve' | 'reject' }
      voteRevealed: false,
      questCards: [], // secret cards
      questMembersVoted: [],
      questCardsRevealed: false,
      playerRoles: playerRoles,
      nightAcknowledged: {},
      ladyState: {
        enabled: !!rolesConfig.ladyOfLake,
        holderId: initialLadyHolderId,
        history: [], // { round, inspectorName, targetName, targetTeam }
        checkedPlayerIds: [initialLadyHolderId] // initial holder cannot inspect themselves or be inspected
      },
      assassinTargetId: null,
      winner: null,
      winReason: '',
      logs: [
        {
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          text: `遊戲開局！場上共 ${count} 位圓桌騎士，首任隊長為【${this.state.players[initialLeaderIdx].name}】。`
        }
      ]
    };

    if (rolesConfig.ladyOfLake) {
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `🌊 湖中女神初始持有者為【${this.state.players[initialLadyHolderIdx].name}】（將於第 2、3、4 輪任務完成後發動神聖查驗）。`
      });
    }

    this.broadcast({
      type: 'GAME_START',
      gameData: gameData,
      players: this.state.players
    });
  },

  // Night acknowledgment
  acknowledgeNight() {
    this.state.nightAcknowledged = true;
    if (this.state.isHost) {
      this.state.gameData.nightAcknowledged[this.state.myPlayerId] = true;
      this.checkNightTransition();
    } else {
      this.broadcast({
        type: 'NIGHT_ACK',
        playerId: this.state.myPlayerId
      });
    }
    this.updateGameUI();
  },

  checkNightTransition() {
    if (!this.state.isHost || !this.state.gameData) return;
    const acks = Object.keys(this.state.gameData.nightAcknowledged).length;
    if (acks >= this.state.players.length) {
      this.state.gameData.phase = 'team_selection';
      this.state.gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `全體騎士已確認身分！第 1 輪任務開始，請隊長【${this.state.players[this.state.gameData.leaderIndex].name}】挑選隊員出征。`
      });
      this.broadcastGameSync();
    }
  },

  broadcastGameSync() {
    this.broadcast({
      type: 'GAME_SYNC',
      gameData: this.state.gameData
    });
    this.updateGameUI();
  },

  // Leader toggles team member selection
  toggleSelectTeamMember(playerId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'team_selection') return;
    const currentLeader = this.state.players[gameData.leaderIndex];
    if (currentLeader.id !== this.state.myPlayerId) {
      App.showToast('只有當前隊長可以指派隊伍！', 'warning');
      return;
    }

    const cfg = this.CONFIGS[this.state.players.length];
    const requiredCount = cfg.quests[gameData.round - 1];

    const idx = gameData.selectedTeam.indexOf(playerId);
    if (idx >= 0) {
      gameData.selectedTeam.splice(idx, 1);
    } else {
      if (gameData.selectedTeam.length >= requiredCount) {
        App.showToast(`本輪任務僅需 ${requiredCount} 位隊員！`, 'warning');
        return;
      }
      gameData.selectedTeam.push(playerId);
    }

    this.broadcastGameSync();
  },

  // Leader proposes team
  proposeTeam() {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'team_selection') return;
    const currentLeader = this.state.players[gameData.leaderIndex];
    if (currentLeader.id !== this.state.myPlayerId) return;

    const cfg = this.CONFIGS[this.state.players.length];
    const requiredCount = cfg.quests[gameData.round - 1];

    if (gameData.selectedTeam.length !== requiredCount) {
      App.showToast(`請選擇完整的 ${requiredCount} 位隊員！`, 'warning');
      return;
    }

    const memberNames = gameData.selectedTeam.map(id => {
      const p = this.state.players.find(x => x.id === id);
      return p ? p.name : id;
    }).join('、');

    gameData.phase = 'team_voting';
    gameData.votes = {};
    gameData.voteRevealed = false;
    this.state.mySecretVote = null;

    gameData.logs.unshift({
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      text: `隊長【${currentLeader.name}】提議出征隊伍：【${memberNames}】，全體進入公開表決階段！`
    });

    this.broadcastGameSync();
  },

  // Public team voting
  castTeamVote(voteChoice) { // 'approve' | 'reject'
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'team_voting') return;

    this.state.mySecretVote = voteChoice;
    gameData.votes[this.state.myPlayerId] = voteChoice;

    if ('vibrate' in navigator) navigator.vibrate(40);
    App.showToast(`您已投票：${voteChoice === 'approve' ? '贊成出征 🛡️' : '反對出征 ⚔️'}`, 'info');

    // Broadcast vote update
    this.broadcast({
      type: 'PLAYER_VOTED_TEAM',
      playerId: this.state.myPlayerId,
      voteChoice: voteChoice
    });

    if (this.state.isHost) {
      this.checkAllVotesReceived();
    }
    this.updateGameUI();
  },

  checkAllVotesReceived() {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'team_voting') return;

    const votedCount = Object.keys(gameData.votes).length;
    if (votedCount >= this.state.players.length) {
      // Reveal all votes!
      gameData.voteRevealed = true;
      let approveCount = 0;
      let rejectCount = 0;

      Object.values(gameData.votes).forEach(v => {
        if (v === 'approve') approveCount++;
        else rejectCount++;
      });

      const passed = approveCount > rejectCount;
      if (passed) {
        gameData.rejectCount = 0;
        gameData.logs.unshift({
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          text: `🗳️ 投票通過（贊成 ${approveCount} 票 vs 反對 ${rejectCount} 票）！出征隊伍正式啟程前往聖杯任務！`
        });
        // Proceed to quest action after brief inspection
        setTimeout(() => {
          if (this.state.gameData) {
            this.state.gameData.phase = 'quest_action';
            this.state.gameData.questCards = [];
            this.state.gameData.questMembersVoted = [];
            this.state.gameData.questCardsRevealed = false;
            this.state.mySecretQuestCard = null;
            this.broadcastGameSync();
          }
        }, 2200);
      } else {
        gameData.rejectCount++;
        gameData.logs.unshift({
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          text: `🗳️ 投票否決（贊成 ${approveCount} 票 vs 反對 ${rejectCount} 票）！當前累計否決 ${gameData.rejectCount} / 5 次。`
        });

        if (gameData.rejectCount >= 5) {
          // Evil wins immediately!
          gameData.winner = 'evil';
          gameData.winReason = '🚨 隊伍提名連續 5 次被否決流局！圓桌內部陷入分崩離析，莫德雷德邪惡方直接獲勝！';
          gameData.phase = 'game_over';
        } else {
          // Advance leader clockwise
          gameData.leaderIndex = (gameData.leaderIndex + 1) % this.state.players.length;
          setTimeout(() => {
            if (this.state.gameData && this.state.gameData.phase === 'team_voting') {
              this.state.gameData.phase = 'team_selection';
              this.state.gameData.selectedTeam = [];
              this.state.gameData.votes = {};
              this.state.gameData.voteRevealed = false;
              this.broadcastGameSync();
            }
          }, 2400);
        }
      }
      this.broadcastGameSync();
    }
  },

  // Team member submits secret quest card
  submitQuestCard(cardChoice) { // 'success' | 'fail'
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'quest_action') return;
    if (!gameData.selectedTeam.includes(this.state.myPlayerId)) {
      App.showToast('您未在本次出征隊伍中！', 'warning');
      return;
    }

    const myRole = gameData.playerRoles[this.state.myPlayerId];
    if (myRole.team === 'good' && cardChoice === 'fail') {
      App.showToast('正義方身分堅定忠誠，只能投出「任務成功」！', 'warning');
      return;
    }

    this.state.mySecretQuestCard = cardChoice;

    if ('vibrate' in navigator) navigator.vibrate([60, 40]);
    App.showToast(`您已暗中投出：${cardChoice === 'success' ? '任務成功 🛡️' : '任務失敗 💀'}`, 'success');

    if (this.state.isHost) {
      if (!gameData.questMembersVoted.includes(this.state.myPlayerId)) {
        gameData.questMembersVoted.push(this.state.myPlayerId);
        gameData.questCards.push({ card: cardChoice });
      }
      this.checkAllQuestCardsReceived();
    } else {
      this.broadcast({
        type: 'QUEST_CARD_SUBMITTED',
        playerId: this.state.myPlayerId,
        cardChoice: cardChoice
      });
    }
    this.updateGameUI();
  },

  checkAllQuestCardsReceived() {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'quest_action') return;

    if (gameData.questCards.length >= gameData.selectedTeam.length) {
      // Secretly shuffle cards so no one can trace order!
      const cards = [...gameData.questCards];
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      gameData.questCards = cards;
      gameData.questCardsRevealed = true;
      gameData.phase = 'quest_result';

      const cfg = this.CONFIGS[this.state.players.length];
      const twoFailsRequired = (gameData.round === 4 && cfg.twoFailsOnR4);
      const failsCount = cards.filter(c => c.card === 'fail').length;

      const isFail = twoFailsRequired ? (failsCount >= 2) : (failsCount >= 1);
      const resultStatus = isFail ? 'fail' : 'success';

      gameData.questResults[gameData.round - 1] = resultStatus;
      gameData.questFails[gameData.round - 1] = failsCount;

      let logMsg = `第 ${gameData.round} 輪任務結果揭曉：`;
      if (failsCount === 0) {
        logMsg += `全員皆投出成功！任務大獲全勝 🏆`;
      } else {
        logMsg += `出現 ${failsCount} 張失敗卡！`;
        if (twoFailsRequired && !isFail) {
          logMsg += `（本輪需 2 張失敗才算失敗，任務依然成功！🛡️）`;
        } else {
          logMsg += `聖杯任務遭到破壞，任務失敗 💀！`;
        }
      }
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: logMsg
      });

      this.broadcastGameSync();
    }
  },

  // Host advances to next phase from quest result
  proceedFromQuestResult() {
    if (!this.state.isHost) return;
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'quest_result') return;

    const goodWins = gameData.questResults.filter(r => r === 'success').length;
    const evilWins = gameData.questResults.filter(r => r === 'fail').length;

    // Check if Evil won directly (3 fails)
    if (evilWins >= 3) {
      gameData.winner = 'evil';
      gameData.winReason = '💀 邪惡方成功破壞了 3 次聖杯任務！莫德雷德統治了卡美洛，邪惡方獲勝！';
      gameData.phase = 'game_over';
      this.broadcastGameSync();
      return;
    }

    // Check if Good won 3 quests (Triggers Assassination!)
    if (goodWins >= 3) {
      gameData.phase = 'assassination';
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `⚔️ 正義方已成功守護 3 次聖杯！遊戲進入最後的【刺殺梅林】逆轉環節！`
      });
      this.broadcastGameSync();
      return;
    }

    // Check Lady of the Lake Timing:
    // MUST trigger at the end of Round 2, Round 3, and Round 4 (if enabled and game not yet ended)
    const curRound = gameData.round;
    const shouldTriggerLady = (gameData.ladyState.enabled && (curRound === 2 || curRound === 3 || curRound === 4));

    if (shouldTriggerLady) {
      gameData.phase = 'lady_of_lake';
      const holder = this.state.players.find(p => p.id === gameData.ladyState.holderId);
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `🌊 第 ${curRound} 輪任務結算完成！觸發【湖中女神】查驗時機！由持有者【${holder ? holder.name : '未知'}】發動陣營秘密查驗。`
      });
      this.broadcastGameSync();
      return;
    }

    // Normal advance to next round
    this.advanceToNextRound();
  },

  advanceToNextRound() {
    const gameData = this.state.gameData;
    gameData.round++;
    gameData.leaderIndex = (gameData.leaderIndex + 1) % this.state.players.length;
    gameData.selectedTeam = [];
    gameData.votes = {};
    gameData.voteRevealed = false;
    gameData.questCards = [];
    gameData.questMembersVoted = [];
    gameData.questCardsRevealed = false;
    gameData.phase = 'team_selection';

    const nextLeader = this.state.players[gameData.leaderIndex];
    gameData.logs.unshift({
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      text: `進入第 ${gameData.round} 輪任務！隊長輪替至【${nextLeader.name}】。`
    });

    this.broadcastGameSync();
  },

  // Lady of the Lake Inspection Action
  inspectPlayerWithLady(targetPlayerId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'lady_of_lake') return;
    if (this.state.myPlayerId !== gameData.ladyState.holderId) {
      App.showToast('只有當前湖中女神持有者可以使用查驗能力！', 'warning');
      return;
    }

    const target = this.state.players.find(p => p.id === targetPlayerId);
    if (!target) return;

    if (this.state.isHost) {
      this.handleLadyInspectionRequest(targetPlayerId, this.state.myPlayerId);
      const targetCard = gameData.playerRoles[targetPlayerId];
      if (targetCard) {
        this.showLadyInspectionModal(target.name, targetCard.team);
      }
    } else {
      this.broadcast({
        type: 'LADY_INSPECT_REQUEST',
        targetPlayerId: targetPlayerId,
        inspectorId: this.state.myPlayerId
      });
    }
  },

  handleLadyInspectionRequest(targetPlayerId, inspectorId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'lady_of_lake') return;
    const target = this.state.players.find(p => p.id === targetPlayerId);
    const inspector = this.state.players.find(p => p.id === inspectorId);
    if (!target || !inspector) return;
    const targetCard = gameData.playerRoles[targetPlayerId];
    if (!targetCard) return;

    const targetTeam = targetCard.team;

    // Send private result back to inspector if inspector is not host
    if (inspectorId !== this.state.myPlayerId) {
      this.broadcast({
        type: 'LADY_INSPECTION_RESULT',
        inspectorId: inspectorId,
        targetName: target.name,
        targetTeam: targetTeam
      });
    }

    // Update Lady state on host
    gameData.ladyState.history.push({
      round: gameData.round,
      inspectorName: inspector.name,
      targetName: target.name,
      targetTeam: targetTeam
    });
    gameData.ladyState.checkedPlayerIds.push(targetPlayerId);
    gameData.ladyState.holderId = targetPlayerId;

    gameData.logs.unshift({
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      text: `🌊 【${inspector.name}】使用湖中女神查驗了【${target.name}】的身分！（女神標記已移交給 ${target.name}）`
    });

    setTimeout(() => {
      this.advanceToNextRound();
    }, 1500);
  },

  showLadyInspectionModal(targetName, targetTeam) {
    const isGood = (targetTeam === 'good');
    const modalHtml = `
      <div id="art-lady-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
        <div class="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-cyan-500/50 p-6 text-center shadow-2xl space-y-4">
          <div class="h-16 w-16 mx-auto rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-3xl shadow-lg border border-cyan-400/40">
            🌊
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">湖中女神秘密查驗結果</span>
            <h3 class="text-xl font-black text-white mt-1">【${targetName}】真實陣營</h3>
          </div>
          <div class="p-4 rounded-2xl ${isGood ? 'bg-blue-950/80 border-2 border-blue-500 text-blue-300' : 'bg-rose-950/80 border-2 border-rose-500 text-rose-300'}">
            <div class="text-3xl">${isGood ? '🔵' : '🔴'}</div>
            <div class="text-lg font-black mt-1">${isGood ? '正義方 (亞瑟陣營)' : '邪惡方 (莫德雷德陣營)'}</div>
            <p class="text-[11px] text-slate-300 mt-1">此結果僅您一人可見。您可以在接下來的圓桌發言中陳述實情或混淆視聽！</p>
          </div>
          <button 
            onclick="document.getElementById('art-lady-modal')?.remove()"
            class="tap-scale w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md"
          >
            我已知曉查驗結果，關閉視窗
          </button>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
    if ('vibrate' in navigator) navigator.vibrate([150, 100, 150]);
  },

  // Assassin targets a player
  assassinatePlayer(targetPlayerId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'assassination') return;

    const myCard = gameData.playerRoles[this.state.myPlayerId];
    if (myCard.role !== 'assassin') {
      App.showToast('只有刺客本人能執行最終刺殺！', 'warning');
      return;
    }

    const target = this.state.players.find(p => p.id === targetPlayerId);
    if (!target) return;

    App.confirm({
      title: `確定要指認刺殺【${target.name}】嗎？`,
      confirmText: '揮出致命一擊！',
      cancelText: '再想一下',
      onConfirm: () => {
        if (this.state.isHost) {
          this.executeAssassination(targetPlayerId);
        } else {
          this.broadcast({
            type: 'ASSASSINATE_ACTION',
            targetPlayerId: targetPlayerId
          });
        }
      }
    });
  },

  executeAssassination(targetPlayerId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.phase !== 'assassination') return;
    const target = this.state.players.find(p => p.id === targetPlayerId);
    if (!target) return;
    const targetCard = gameData.playerRoles[targetPlayerId];
    const isMerlin = (targetCard.role === 'merlin');

    gameData.assassinTargetId = targetPlayerId;
    gameData.assassinTargetName = target.name;
    gameData.phase = 'game_over';

    if (isMerlin) {
      gameData.winner = 'evil';
      gameData.winReason = `🗡️ 刺客成功精準刺殺梅林【${target.name}】！莫德雷德邪惡方完成逆轉勝！🎉`;
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `🗡️ 刺客成功識破並刺殺了梅林【${target.name}】！邪惡方逆轉勝！`
      });
    } else {
      gameData.winner = 'good';
      gameData.winReason = `🛡️ 刺客刺殺失敗！【${target.name}】不是梅林！亞瑟王的正義榮耀長存，正義方獲勝！🏆`;
      gameData.logs.unshift({
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        text: `🛡️ 刺客刺殺了【${target.name}】（不是梅林）！正義方取得最終勝利！`
      });
    }

    this.broadcastGameSync();
  },

  // Host resets or plays again
  hostPlayAgain() {
    if (!this.state.isHost) return;
    this.hostStartGame();
  },

  hostBackToRoom() {
    if (!this.state.isHost) return;
    this.state.gameData = null;
    this.state.currentView = 'room';
    this.broadcast({
      type: 'BACK_TO_ROOM'
    });
    this.renderView();
  },

  render() {
    this.init();
    if (this.state.currentView === 'game' && this.state.roomId) {
      return this.renderGameView();
    }
    if (this.state.currentView === 'room' && this.state.roomId) {
      return this.renderRoomView();
    }
    return this.renderLobbyView();
  },

  renderView() {
    App.render();
  },

  updateGameUI() {
    const container = document.getElementById('module-content');
    if (container && this.state.currentView === 'game') {
      container.innerHTML = this.renderGameView();
      if (window.lucide) lucide.createIcons();
    }
  },

  updateRoomUI() {
    const container = document.getElementById('module-content');
    if (container && this.state.currentView === 'room') {
      container.innerHTML = this.renderRoomView();
      if (window.lucide) lucide.createIcons();
    }
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
        </div>

        <!-- Arthur Hero Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-amber-950/40 border border-amber-800/40">
          <div class="relative z-10">
            <div class="flex items-center space-x-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span class="text-xl">👑</span>
              <span>The Resistance: Avalon · 亞瑟傳奇</span>
            </div>

            <h1 class="text-2xl font-black tracking-tight text-white">亞瑟傳奇</h1>
          </div>

          <div class="absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-amber-600/20 blur-2xl"></div>
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
          <button onclick="ArthurModule.promptChangeName()" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 tap-scale">
            更換暱稱
          </button>
        </div>

        <!-- Room Action Cards -->
        <div class="grid grid-cols-1 gap-3.5">
          <!-- Create Room -->
          <button onclick="ArthurModule.createRoom()" class="tap-scale flex items-center justify-between p-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 text-left">
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
                id="art-join-room-input" 
                maxlength="6"
                placeholder="請輸入 4 位數房間代號 (如 8F2A)"
                value="${this.state.roomId || ''}"
                class="flex-1 uppercase tracking-widest font-black px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
              />
              <button 
                onclick="ArthurModule.joinRoom(document.getElementById('art-join-room-input').value)" 
                class="tap-scale px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md shrink-0"
              >
                加入
              </button>
            </div>
          </div>
        </div>

        <!-- Arthur Quick Rules Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="book-open" class="w-4 h-4 text-indigo-500"></i>
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">遊戲規則速覽</h3>
          </div>
          <div class="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>• <b>陣營勝負</b>：<span class="font-bold text-blue-600 dark:text-blue-400">🔵 正義方</span> 需完成 3 次聖杯任務且梅林未被刺殺；<span class="font-bold text-rose-600 dark:text-rose-400">🔴 邪惡方</span> 需造成 3 次任務失敗、連續 5 次組隊流局，或刺客成功刺殺梅林。</p>
            <p>• <b>組隊表決</b>：隊長依輪次需求人數指派隊員，全體公開表決（贊成/反對），贊成過半方可出征；若被否決則由下一位隊長重選，連續否決 5 次邪惡方直接獲勝。</p>
            <p>• <b>執行任務</b>：出征隊員秘密出牌（好人只能投成功，壞人可投成功或失敗），洗牌後揭曉；出現 1 張失敗卡即任務失敗（7人以上第 4 輪需 2 張失敗卡）。</p>
            <p>• <b>湖中女神</b>：於<b>第 2、3、4 輪任務完成後</b>發動，持有者秘密查驗一名未曾受驗玩家的真實陣營，隨後將女神移交給該受驗者。</p>
          </div>
        </div>
      </div>
    `;
  },

  // View 2: Room Waiting View
  renderRoomView() {
    const isHost = this.state.isHost;
    const count = this.state.players.length;
    const canStart = (count >= 5 && count <= 10);
    const cfg = this.CONFIGS[count] || { good: '?', evil: '?', quests: [] };
    const rConfig = this.state.rolesConfig;

    return `
      <div class="space-y-4 fade-in pb-20" id="art-room-view-container">
        <!-- Room Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="ArthurModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出房間</span>
          </button>

          <!-- Ping & Status -->
          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span id="art-room-ping-val">${this.state.ping ? this.state.ping + 'ms' : '連線正常'}</span>
          </div>
        </div>

        <!-- Room Identity Banner -->
        <div class="rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-5 text-white border border-amber-900/60 shadow-xl flex items-center justify-between">
          <div>
            <p class="text-[10px] uppercase font-bold text-amber-300 tracking-wider">房間代碼 (點擊可複製)</p>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-3xl font-black tracking-widest text-amber-400 cursor-pointer" onclick="ArthurModule.copyRoomCode()">#${this.state.roomId}</span>
              <button onclick="ArthurModule.copyRoomCode()" class="tap-scale p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200" title="複製房間代碼">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="text-right">
            <span class="text-xs font-bold text-amber-200 bg-white/10 px-3 py-1.5 rounded-full inline-block">
              ${isHost ? '👑 您是房主' : '👤 房間成員'}
            </span>
          </div>
        </div>

        <!-- Room Status & Balance Indicator -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-xl">🏰</span>
              <div>
                <h3 class="text-xs font-black text-slate-900 dark:text-white">圓桌大廳騎士集結 (${count}/10 人)</h3>
                <p class="text-[10px] text-slate-400">遊戲需 5 ~ 10 人即可開局</p>
              </div>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${canStart ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
              ${canStart ? `配比：${cfg.good}好 / ${cfg.evil}壞` : '人數未達標 (需 5~10 人)'}
            </span>
          </div>

          <!-- Roster Grid -->
          <div class="grid grid-cols-2 gap-2">
            ${this.state.players.map((p, idx) => `
              <div class="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <div class="flex items-center space-x-2 truncate">
                  <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    ${idx + 1}
                  </span>
                  <span class="text-xs font-bold text-slate-800 dark:text-white truncate">
                    ${p.name} ${p.id === this.state.myPlayerId ? '<strong class="text-indigo-500">(我)</strong>' : ''}
                  </span>
                </div>
                ${p.isHost ? '<span class="text-[10px] text-amber-500 font-bold shrink-0">👑 房主</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Role Pool Config Card (Host Configurable) -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <i data-lucide="sliders" class="w-4 h-4 text-indigo-500"></i>
              <span>角色與配件開關設定</span>
            </span>
            <span class="text-[10px] text-slate-400">${isHost ? '房主可點擊開關' : '房主同步設定'}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <!-- Percival -->
            <button 
              ${isHost ? 'onclick="ArthurModule.toggleRoleConfig(\'percival\')"' : 'disabled'}
              class="tap-scale p-3 rounded-2xl border text-left flex items-center justify-between ${
                rConfig.percival 
                  ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200' 
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }"
            >
              <div>
                <div class="font-black flex items-center space-x-1"><span>🛡️</span><span>派西維爾</span></div>
                <div class="text-[9px] opacity-70">好人，看梅林與莫甘娜</div>
              </div>
              <span class="text-xs font-bold">${rConfig.percival ? '✓' : '✗'}</span>
            </button>

            <!-- Morgana -->
            <button 
              ${isHost ? 'onclick="ArthurModule.toggleRoleConfig(\'morgana\')"' : 'disabled'}
              class="tap-scale p-3 rounded-2xl border text-left flex items-center justify-between ${
                rConfig.morgana 
                  ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200' 
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }"
            >
              <div>
                <div class="font-black flex items-center space-x-1"><span>🔮</span><span>莫甘娜</span></div>
                <div class="text-[9px] opacity-70">壞人，偽裝成梅林</div>
              </div>
              <span class="text-xs font-bold">${rConfig.morgana ? '✓' : '✗'}</span>
            </button>

            <!-- Mordred -->
            <button 
              ${isHost ? 'onclick="ArthurModule.toggleRoleConfig(\'mordred\')"' : 'disabled'}
              class="tap-scale p-3 rounded-2xl border text-left flex items-center justify-between ${
                rConfig.mordred 
                  ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200' 
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }"
            >
              <div>
                <div class="font-black flex items-center space-x-1"><span>👑</span><span>莫德雷德</span></div>
                <div class="text-[9px] opacity-70">邪惡首領，梅林看不到</div>
              </div>
              <span class="text-xs font-bold">${rConfig.mordred ? '✓' : '✗'}</span>
            </button>

            <!-- Oberon -->
            <button 
              ${isHost ? 'onclick="ArthurModule.toggleRoleConfig(\'oberon\')"' : 'disabled'}
              class="tap-scale p-3 rounded-2xl border text-left flex items-center justify-between ${
                rConfig.oberon 
                  ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200' 
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }"
            >
              <div>
                <div class="font-black flex items-center space-x-1"><span>🎭</span><span>奧伯倫</span></div>
                <div class="text-[9px] opacity-70">盲狼，與隊友互不相識</div>
              </div>
              <span class="text-xs font-bold">${rConfig.oberon ? '✓' : '✗'}</span>
            </button>

            <!-- Lady of the Lake (Highlighting usage timing) -->
            <button 
              ${isHost ? 'onclick="ArthurModule.toggleRoleConfig(\'ladyOfLake\')"' : 'disabled'}
              class="col-span-2 tap-scale p-3 rounded-2xl border text-left flex items-center justify-between ${
                rConfig.ladyOfLake 
                  ? 'bg-cyan-50/60 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200' 
                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }"
            >
              <div>
                <div class="font-black flex items-center space-x-1">
                  <span>🌊</span><span>湖中女神配件 (神聖查驗)</span>
                </div>
                <div class="text-[10px] text-cyan-700 dark:text-cyan-300 font-bold mt-0.5">
                  ★ 啟用時機：於第 2、3、4 輪任務結算完成後發動秘密陣營查驗
                </div>
              </div>
              <span class="text-xs font-bold">${rConfig.ladyOfLake ? '✓ 啟用中' : '✗ 關閉'}</span>
            </button>
          </div>
        </div>

        <!-- Quick Reactions Bar in Room -->
        ${this.renderReactionsBar()}

        <!-- Host Action Buttons -->
        <div class="pt-2 space-y-2.5">
          ${isHost ? `
            <button 
              onclick="ArthurModule.randomShufflePlayers()" 
              class="tap-scale w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 shadow-sm transition"
            >
              <i data-lucide="shuffle" class="w-4 h-4 text-amber-500"></i>
              <span>隨機重整圓桌座位 (調整順位)</span>
            </button>

            <button 
              onclick="ArthurModule.hostStartGame()" 
              ${!canStart ? 'disabled' : ''}
              class="tap-scale w-full py-4 rounded-2xl ${
                canStart 
                  ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-amber-600/30' 
                  : 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-bold text-sm cursor-not-allowed opacity-60'
              } flex items-center justify-center space-x-2 transition"
            >
              <i data-lucide="play" class="w-5 h-5"></i>
              <span>開始亞瑟傳奇對局</span>
            </button>

            <p class="text-[11px] text-center ${canStart ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
              ${canStart ? '✨ 人數達標，隨時可展開聖杯之爭！' : '⚠️ 人數不足 5 人，等待其他玩家加入'}
            </p>
          ` : `
            <div class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <p class="text-xs font-bold text-slate-700 dark:text-slate-300">等待房主開始對局...</p>
              <p class="text-[10px] ${canStart ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                ${canStart ? '✨ 人員已齊全，等待房主發號施令' : '尚未就緒：人數需 5~10 人'}
              </p>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // View 3: Game Screen
  renderGameView() {
    const gameData = this.state.gameData;
    if (!gameData) return this.renderRoomView();

    const phase = gameData.phase;
    const count = this.state.players.length;
    const cfg = this.CONFIGS[count] || { quests: [2, 3, 2, 3, 3] };
    const currentLeader = this.state.players[gameData.leaderIndex];
    const isLeader = (currentLeader.id === this.state.myPlayerId);
    const myRoleCard = gameData.playerRoles[this.state.myPlayerId] || { role: 'servant', team: 'good' };
    const roleDef = this.ROLES[myRoleCard.role] || this.ROLES.servant;

    return `
      <div class="relative space-y-3.5 fade-in pb-20" id="art-game-container">
        <!-- Top Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="ArthurModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出房間</span>
          </button>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span>房間 #${this.state.roomId}</span>
            <span>·</span>
            <span>第 ${gameData.round} / 5 輪</span>
          </div>

          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span id="art-ping-val">${this.state.ping ? this.state.ping + 'ms' : '連線正常'}</span>
          </div>
        </div>

        <!-- 1. Quest Board & Rejection Tracker (5 Quests & 5 Rejections) -->
        ${this.renderQuestBoard(gameData, cfg)}

        <!-- 2. Main Phase Specific View -->
        ${this.renderPhaseContent(gameData, phase, isLeader, myRoleCard, roleDef)}

        <!-- 3. Reactions Bar -->
        ${this.renderReactionsBar()}

        <!-- 4. Real-time Game Log -->
        ${this.renderGameLogs(gameData)}
      </div>
    `;
  },

  // Quest Board: 5 Quests + 5 Failures indicator
  renderQuestBoard(gameData, cfg) {
    const curRound = gameData.round;
    const quests = cfg.quests || [2, 3, 2, 3, 3];
    const twoFailsOnR4 = cfg.twoFailsOnR4;
    const ladyHolder = this.state.players.find(p => p.id === gameData.ladyState?.holderId);

    return `
      <div class="rounded-3xl bg-slate-900 text-white p-4 shadow-xl border border-slate-800 space-y-3">
        <!-- Top: 5 Quests Circles -->
        <div class="flex items-center justify-between px-1">
          <span class="text-[10px] font-bold uppercase text-amber-400 flex items-center space-x-1">
            <span>🏆</span><span>聖杯任務進度 (5 戰 3 勝)</span>
          </span>
          ${gameData.ladyState?.enabled ? `
            <span class="text-[10px] text-cyan-300 font-bold flex items-center space-x-1">
              <span>🌊 女神持有者:</span>
              <strong class="text-white">${ladyHolder ? ladyHolder.name : '無'}</strong>
            </span>
          ` : ''}
        </div>

        <div class="grid grid-cols-5 gap-1.5 sm:gap-2">
          ${quests.map((reqCount, idx) => {
            const rNum = idx + 1;
            const res = gameData.questResults[idx];
            const isCurrent = (rNum === curRound && !gameData.winner);
            const isSpecialR4 = (rNum === 4 && twoFailsOnR4);

            let circleClass = 'bg-slate-800/80 border-slate-700 text-slate-400';
            let iconText = `${reqCount}人`;

            if (res === 'success') {
              circleClass = 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30';
              iconText = '🛡️';
            } else if (res === 'fail') {
              circleClass = 'bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-600/30';
              iconText = '💀';
            } else if (isCurrent) {
              circleClass = 'bg-amber-600/30 border-2 border-amber-400 text-amber-300 ring-2 ring-amber-400/30 animate-pulse';
            }

            return `
              <div class="flex flex-col items-center space-y-1">
                <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex flex-col items-center justify-center font-black text-xs border ${circleClass} transition-all">
                  <span>${iconText}</span>
                  ${isSpecialR4 ? '<span class="text-[8px] text-amber-300 font-bold leading-none">需2敗</span>' : ''}
                </div>
                <span class="text-[10px] font-bold ${isCurrent ? 'text-amber-400' : 'text-slate-400'}">
                  第${rNum}輪
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom: Consecutive Rejections Tracker (1 ~ 5) -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] text-slate-400">組隊否決流局標記:</span>
            <div class="flex items-center space-x-1">
              ${[1, 2, 3, 4, 5].map(step => {
                const isRejected = (gameData.rejectCount >= step);
                const isDanger = (step === 5);
                return `
                  <div class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                    isRejected 
                      ? (isDanger ? 'bg-red-600 text-white' : 'bg-amber-500 text-white') 
                      : 'bg-slate-800 text-slate-500'
                  }">
                    ${step}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <span class="text-[10px] ${gameData.rejectCount >= 4 ? 'text-rose-400 font-black animate-pulse' : 'text-slate-400'}">
            ${gameData.rejectCount >= 4 ? '⚠️ 再次否決邪惡方直勝！' : `累計否決 ${gameData.rejectCount}/5`}
          </span>
        </div>
      </div>
    `;
  },

  // Main Phase Content Dispatcher
  renderPhaseContent(gameData, phase, isLeader, myRoleCard, roleDef) {
    if (phase === 'night') {
      return this.renderNightPhase(gameData, myRoleCard, roleDef);
    }
    if (phase === 'team_selection') {
      return this.renderTeamSelectionPhase(gameData, isLeader);
    }
    if (phase === 'team_voting') {
      return this.renderTeamVotingPhase(gameData);
    }
    if (phase === 'quest_action') {
      return this.renderQuestActionPhase(gameData, myRoleCard);
    }
    if (phase === 'quest_result') {
      return this.renderQuestResultPhase(gameData);
    }
    if (phase === 'lady_of_lake') {
      return this.renderLadyOfLakePhase(gameData);
    }
    if (phase === 'assassination') {
      return this.renderAssassinationPhase(gameData, myRoleCard);
    }
    if (phase === 'game_over') {
      return this.renderGameOverPhase(gameData);
    }
    return '';
  },

  // 1. Night Phase
  renderNightPhase(gameData, myRoleCard, roleDef) {
    const isGood = (myRoleCard.team === 'good');
    const myRoleId = myRoleCard.role;
    const isAck = this.state.nightAcknowledged;

    // Determine what information this player sees
    let intelList = [];
    const allRoles = gameData.playerRoles;

    if (myRoleId === 'merlin') {
      // Merlin sees evil players (except Mordred)
      this.state.players.forEach(p => {
        const card = allRoles[p.id];
        if (card && card.team === 'evil' && card.role !== 'mordred') {
          intelList.push({ name: p.name, tag: '🔴 邪惡同夥 (刺客/莫甘娜/奧伯倫/爪牙)' });
        }
      });
    } else if (myRoleId === 'percival') {
      // Percival sees Merlin & Morgana (indistinguishable)
      this.state.players.forEach(p => {
        const card = allRoles[p.id];
        if (card && (card.role === 'merlin' || card.role === 'morgana')) {
          intelList.push({ name: p.name, tag: '✨ 散發靈光（梅林 或 莫甘娜）' });
        }
      });
    } else if (myRoleCard.team === 'evil' && myRoleId !== 'oberon') {
      // Evils see each other (except Oberon)
      this.state.players.forEach(p => {
        if (p.id !== this.state.myPlayerId) {
          const card = allRoles[p.id];
          if (card && card.team === 'evil' && card.role !== 'oberon') {
            intelList.push({ name: p.name, tag: '🔴 邪惡盟友' });
          }
        }
      });
    }

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <!-- Identity Card -->
        <div class="text-center space-y-2">
          <span class="text-xs font-bold text-slate-400">第一階段：夜間身分確認</span>
          <div class="p-4 rounded-3xl ${isGood ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-500' : 'bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500'} space-y-1">
            <div class="text-4xl">${roleDef.emoji}</div>
            <h3 class="text-lg font-black ${isGood ? 'text-blue-900 dark:text-blue-200' : 'text-rose-900 dark:text-rose-200'}">
              您的身分：${roleDef.name}
            </h3>
            <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${roleDef.badgeColor}">
              ${roleDef.teamName}
            </span>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 pt-1 leading-relaxed px-2">
              ${roleDef.desc}
            </p>
          </div>
        </div>

        <!-- Night Intel List -->
        <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2 border border-slate-200/60 dark:border-slate-800">
          <div class="text-xs font-bold text-slate-700 dark:text-slate-300">🌙 夜間密訊視野：</div>
          ${intelList.length === 0 ? `
            <p class="text-xs text-slate-400 italic py-2 text-center">黑夜無光，您未看見任何特殊盟友標記。</p>
          ` : `
            <div class="space-y-1.5">
              ${intelList.map(item => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs text-xs">
                  <span class="font-bold text-slate-800 dark:text-white">${item.name}</span>
                  <span class="text-[10px] font-bold text-amber-500">${item.tag}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Acknowledge Button -->
        <button 
          onclick="ArthurModule.acknowledgeNight()"
          ${isAck ? 'disabled' : ''}
          class="tap-scale w-full py-3.5 rounded-2xl ${
            isAck 
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black shadow-md shadow-indigo-600/20'
          } font-bold text-xs flex items-center justify-center space-x-1.5"
        >
          <i data-lucide="${isAck ? 'check' : 'eye'}" class="w-4 h-4"></i>
          <span>${isAck ? '已確認記住，等待其他騎士...' : '我已記住我的身分與視野'}</span>
        </button>
      </div>
    `;
  },

  // 2. Team Selection Phase
  renderTeamSelectionPhase(gameData, isLeader) {
    const count = this.state.players.length;
    const cfg = this.CONFIGS[count];
    const requiredCount = cfg.quests[gameData.round - 1];
    const selectedCount = gameData.selectedTeam.length;
    const currentLeader = this.state.players[gameData.leaderIndex];

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <!-- Banner -->
        <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center space-x-2">
            <span class="text-xl">👑</span>
            <div>
              <h3 class="text-xs font-black text-slate-900 dark:text-white">隊長指定出征名單</h3>
              <p class="text-[10px] text-slate-400">當前隊長：【${currentLeader.name}】</p>
            </div>
          </div>
          <span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full">
            需挑選 ${requiredCount} 人 (已選 ${selectedCount})
          </span>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          ${isLeader ? '👑 您是本輪隊長！請點選下方玩家頭像指派 ${requiredCount} 位隊員出征：' : `等待隊長【${currentLeader.name}】挑選 ${requiredCount} 位隊員提議出征...`}
        </p>

        <!-- Player Selection Cards -->
        <div class="grid grid-cols-2 gap-2">
          ${this.state.players.map(p => {
            const isSelected = gameData.selectedTeam.includes(p.id);
            const isPLeader = (p.id === currentLeader.id);

            return `
              <div 
                ${isLeader ? `onclick="ArthurModule.toggleSelectTeamMember('${p.id}')"` : ''}
                class="tap-scale p-3 rounded-2xl border transition-all ${
                  isLeader ? 'cursor-pointer' : ''
                } ${
                  isSelected 
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500 shadow-md shadow-amber-500/10' 
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                } flex items-center justify-between"
              >
                <div class="flex items-center space-x-2 truncate">
                  <span class="text-lg">${isSelected ? '🛡️' : '👤'}</span>
                  <div class="truncate">
                    <div class="text-xs font-bold text-slate-800 dark:text-white truncate">
                      ${p.name}
                    </div>
                    ${isPLeader ? '<div class="text-[9px] text-amber-500 font-bold">👑 當前隊長</div>' : ''}
                  </div>
                </div>
                ${isSelected ? '<span class="text-xs text-amber-600 font-black">✓ 入選</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${isLeader ? `
          <button 
            onclick="ArthurModule.proposeTeam()" 
            ${selectedCount !== requiredCount ? 'disabled' : ''}
            class="tap-scale w-full py-3.5 rounded-2xl ${
              selectedCount === requiredCount 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black shadow-lg shadow-amber-600/25' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            } text-xs flex items-center justify-center space-x-2"
          >
            <i data-lucide="send" class="w-4 h-4"></i>
            <span>正式提議此名單，發起全場公開表決</span>
          </button>
        ` : ''}
      </div>
    `;
  },

  // 3. Team Voting Phase
  renderTeamVotingPhase(gameData) {
    const hasVoted = (this.state.mySecretVote !== null);
    const votesCount = Object.keys(gameData.votes).length;
    const isRevealed = gameData.voteRevealed;
    const proposedMembers = gameData.selectedTeam.map(id => {
      const p = this.state.players.find(x => x.id === id);
      return p ? p.name : id;
    });

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div class="text-center space-y-1">
          <span class="text-[10px] font-bold uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
            第二階段：全場公開表決
          </span>
          <h3 class="text-base font-black text-slate-900 dark:text-white">
            是否贊成此隊伍出征？
          </h3>
          <p class="text-xs text-amber-600 dark:text-amber-400 font-bold">
            提議名單：【${proposedMembers.join('、')}】
          </p>
        </div>

        <!-- Vote Action Buttons (If not yet revealed) -->
        ${!isRevealed ? `
          <div class="grid grid-cols-2 gap-3 pt-1">
            <button 
              onclick="ArthurModule.castTeamVote('approve')"
              class="tap-scale py-4 rounded-2xl ${
                this.state.mySecretVote === 'approve' 
                  ? 'bg-blue-600 text-white ring-4 ring-blue-300 dark:ring-blue-800' 
                  : 'bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-500 text-blue-700 dark:text-blue-300'
              } font-black text-sm flex flex-col items-center justify-center space-y-1 shadow-sm"
            >
              <span class="text-2xl">🛡️</span>
              <span>贊成出征</span>
            </button>

            <button 
              onclick="ArthurModule.castTeamVote('reject')"
              class="tap-scale py-4 rounded-2xl ${
                this.state.mySecretVote === 'reject' 
                  ? 'bg-rose-600 text-white ring-4 ring-rose-300 dark:ring-rose-800' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 text-rose-700 dark:text-rose-300'
              } font-black text-sm flex flex-col items-center justify-center space-y-1 shadow-sm"
            >
              <span class="text-2xl">⚔️</span>
              <span>反對出征</span>
            </button>
          </div>
          <p class="text-center text-[10px] text-slate-400">
            ${hasVoted ? '✓ 您已完成表決！等待全場所有人出票後同時開票...' : '請按下您的表決選項（全員到齊後同時開票）'}
          </p>
        ` : ''}

        <!-- Live Voting Roster Status -->
        <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2 border border-slate-200/60 dark:border-slate-800">
          <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>表決進度 (${votesCount} / ${this.state.players.length})</span>
            ${isRevealed ? '<span class="text-emerald-500">開票揭曉！</span>' : '<span class="text-amber-500">秘密投票中...</span>'}
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            ${this.state.players.map(p => {
              const vote = gameData.votes[p.id];
              const pVoted = (vote !== undefined);

              return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 text-xs shadow-xs">
                  <span class="font-bold text-slate-800 dark:text-white truncate">${p.name}</span>
                  ${isRevealed ? `
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${
                      vote === 'approve' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                    }">
                      ${vote === 'approve' ? '贊成 🛡️' : '反對 ⚔️'}
                    </span>
                  ` : `
                    <span class="text-[10px] ${pVoted ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                      ${pVoted ? '✓ 已投' : '思考中...'}
                    </span>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // 4. Quest Action Phase (Secret Cards Submission)
  renderQuestActionPhase(gameData, myRoleCard) {
    const isMember = gameData.selectedTeam.includes(this.state.myPlayerId);
    const hasVoted = (this.state.mySecretQuestCard !== null);
    const isGood = (myRoleCard.team === 'good');
    const votedCount = gameData.questMembersVoted.length;
    const totalMembers = gameData.selectedTeam.length;

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div class="text-center space-y-1">
          <span class="text-[10px] font-bold uppercase text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
            第三階段：執行聖杯任務
          </span>
          <h3 class="text-base font-black text-slate-900 dark:text-white">
            隊伍出征！暗抽任務結果
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            已提交任務卡：${votedCount} / ${totalMembers} 人
          </p>
        </div>

        ${isMember ? `
          <div class="p-4 rounded-3xl bg-slate-900 text-white space-y-3">
            <div class="text-xs font-bold text-center text-amber-300">
              🗡️ 您是出征隊員！請暗中投出您的任務卡：
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button 
                onclick="ArthurModule.submitQuestCard('success')"
                class="tap-scale py-4 rounded-2xl ${
                  this.state.mySecretQuestCard === 'success' 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-300' 
                    : 'bg-blue-950 border-2 border-blue-500 text-blue-200'
                } font-black text-sm flex flex-col items-center justify-center space-y-1 shadow-sm"
              >
                <span class="text-2xl">🛡️</span>
                <span>任務成功</span>
              </button>

              <button 
                onclick="ArthurModule.submitQuestCard('fail')"
                ${isGood ? 'disabled' : ''}
                class="tap-scale py-4 rounded-2xl ${
                  isGood 
                    ? 'bg-slate-800 border-2 border-slate-700 text-slate-500 opacity-40 cursor-not-allowed' 
                    : (this.state.mySecretQuestCard === 'fail' 
                        ? 'bg-rose-600 text-white ring-4 ring-rose-300' 
                        : 'bg-rose-950 border-2 border-rose-500 text-rose-200')
                } font-black text-sm flex flex-col items-center justify-center space-y-1 shadow-sm"
              >
                <span class="text-2xl">💀</span>
                <span>任務失敗</span>
                ${isGood ? '<span class="text-[8px] text-slate-400">好人不可投失敗</span>' : ''}
              </button>
            </div>
            <p class="text-[10px] text-slate-400 text-center leading-relaxed">
              ${hasVoted ? '✓ 您已完成秘密提交！卡片將與其他人打散混淆後揭示。' : '卡片結果絕不會透露是由誰投出，請放心依身分策略抉擇。'}
            </p>
          </div>
        ` : `
          <div class="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center space-y-2">
            <div class="text-3xl animate-bounce">⏳</div>
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">出征隊伍正在秘密執行任務...</h4>
            <p class="text-[11px] text-slate-400">全體隊員提交後將立即洗牌並公開開票！</p>
          </div>
        `}
      </div>
    `;
  },

  // 5. Quest Result Phase (Shuffled Cards Reveal)
  renderQuestResultPhase(gameData) {
    const isHost = this.state.isHost;
    const cards = gameData.questCards || [];
    const count = this.state.players.length;
    const cfg = this.CONFIGS[count];
    const twoFailsOnR4 = (gameData.round === 4 && cfg.twoFailsOnR4);
    const failsCount = gameData.questFails[gameData.round - 1] || 0;
    const isFail = (gameData.questResults[gameData.round - 1] === 'fail');

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div class="text-center space-y-1">
          <span class="text-[10px] font-bold uppercase ${isFail ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/60' : 'text-blue-500 bg-blue-50 dark:bg-blue-950/60'} px-2.5 py-0.5 rounded-full">
            第 ${gameData.round} 輪任務結算
          </span>
          <h3 class="text-xl font-black text-slate-900 dark:text-white">
            ${isFail ? '💀 聖杯任務遭受破壞（任務失敗）！' : '🛡️ 聖杯任務大獲全勝（任務成功）！'}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            ${twoFailsOnR4 ? '⚠️ 本輪需 2 張失敗才算失敗！' : '只要有 1 張失敗卡即宣告失敗'}
          </p>
        </div>

        <!-- Shuffled Face-up Cards -->
        <div class="p-4 rounded-3xl bg-slate-900 text-white space-y-2 text-center">
          <span class="text-[10px] text-slate-400 font-bold uppercase">打散洗牌後揭示的任務卡</span>
          <div class="flex items-center justify-center space-x-2 pt-2">
            ${cards.map(c => `
              <div class="w-12 h-16 rounded-2xl flex flex-col items-center justify-center text-sm font-black border-2 ${
                c.card === 'success' 
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30' 
                  : 'bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-600/30'
              }">
                <span class="text-lg">${c.card === 'success' ? '🛡️' : '💀'}</span>
                <span class="text-[9px] mt-0.5">${c.card === 'success' ? '成功' : '失敗'}</span>
              </div>
            `).join('')}
          </div>
          <div class="text-xs text-slate-300 font-bold pt-1">
            統計：${cards.length - failsCount} 張成功，${failsCount} 張失敗
          </div>
        </div>

        ${isHost ? `
          <button 
            onclick="ArthurModule.proceedFromQuestResult()"
            class="tap-scale w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs shadow-md shadow-indigo-600/20"
          >
            確認結算，推進至下一階段
          </button>
        ` : `
          <p class="text-center text-xs text-slate-400">等待房主確認並推進對局...</p>
        `}
      </div>
    `;
  },

  // 6. Lady of the Lake Phase (Special Timing)
  renderLadyOfLakePhase(gameData) {
    const ladyHolder = this.state.players.find(p => p.id === gameData.ladyState?.holderId);
    const isHolder = (this.state.myPlayerId === gameData.ladyState?.holderId);
    const checkedIds = gameData.ladyState?.checkedPlayerIds || [];

    // Eligible targets: not current holder and not previously checked/held
    const eligibleTargets = this.state.players.filter(p => !checkedIds.includes(p.id) && p.id !== gameData.ladyState?.holderId);

    return `
      <div class="rounded-3xl bg-cyan-950 text-white p-5 border-2 border-cyan-500 shadow-xl space-y-4">
        <!-- Banner -->
        <div class="text-center space-y-1">
          <div class="text-3xl animate-bounce">🌊</div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-900/60 px-3 py-0.5 rounded-full border border-cyan-400/30">
            聖湖顯靈 · 湖中女神神聖查驗時機
          </span>
          <h3 class="text-lg font-black text-white">
            當前女神持有者：【${ladyHolder ? ladyHolder.name : '未知'}】
          </h3>
          <p class="text-xs text-cyan-200 leading-relaxed px-2">
            於第 2、3、4 輪任務完成後發動！持有者可秘密查驗一名未曾受驗玩家的真實陣營，隨後將女神移交給該受驗者。
          </p>
        </div>

        ${isHolder ? `
          <div class="p-3.5 rounded-2xl bg-cyan-900/40 border border-cyan-400/40 space-y-2">
            <span class="text-xs font-bold text-cyan-200">🌊 請選擇一名對象發動查驗（僅您可見真實結果）：</span>
            <div class="grid grid-cols-2 gap-2 pt-1">
              ${eligibleTargets.length === 0 ? `
                <p class="text-xs text-slate-400 col-span-2 text-center py-2">無可查驗對象</p>
              ` : eligibleTargets.map(t => `
                <button 
                  onclick="ArthurModule.inspectPlayerWithLady('${t.id}')"
                  class="tap-scale p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-cyan-400/50 text-left text-xs font-bold flex items-center justify-between"
                >
                  <span class="truncate">${t.name}</span>
                  <span class="text-cyan-400 text-sm">🔍</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="p-4 rounded-2xl bg-cyan-900/30 text-center space-y-1">
            <p class="text-xs font-bold text-cyan-200">等待【${ladyHolder ? ladyHolder.name : '持有者'}】完成秘密查驗...</p>
            <p class="text-[10px] text-cyan-300/80">查驗完成後女神將轉移，並繼續下一輪聖杯任務。</p>
          </div>
        `}
      </div>
    `;
  },

  // 7. Assassination Phase (Endgame Merlin Assassination)
  renderAssassinationPhase(gameData, myRoleCard) {
    const isAssassin = (myRoleCard.role === 'assassin');
    const evilPlayerIds = Object.keys(gameData.playerRoles).filter(id => gameData.playerRoles[id].team === 'evil');
    // Eligible assassination targets: non-evil players
    const targets = this.state.players.filter(p => !evilPlayerIds.includes(p.id));

    return `
      <div class="rounded-3xl bg-rose-950 text-white p-5 border-2 border-rose-600 shadow-2xl space-y-4">
        <div class="text-center space-y-1">
          <div class="text-3xl animate-pulse">🗡️</div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-900/60 px-3 py-0.5 rounded-full border border-rose-500/30">
            最後逆轉 · 刺殺梅林環節
          </span>
          <h3 class="text-xl font-black text-white">
            邪惡方刺客進行終局絕殺！
          </h3>
          <p class="text-xs text-rose-200 leading-relaxed px-2">
            正義方已成功守護 3 次任務！刺客若能在最後一擊中指認並刺殺真正的【梅林】，邪惡方將完成絕地逆轉勝！
          </p>
        </div>

        ${isAssassin ? `
          <div class="p-3.5 rounded-2xl bg-black/40 border border-rose-500/40 space-y-2">
            <span class="text-xs font-bold text-rose-300">🗡️ 刺客請指定一人刺殺（命中梅林則勝）：</span>
            <div class="grid grid-cols-2 gap-2 pt-1">
              ${targets.map(t => `
                <button 
                  onclick="ArthurModule.assassinatePlayer('${t.id}')"
                  class="tap-scale p-3 rounded-2xl bg-rose-900/80 hover:bg-rose-800 border border-rose-500 text-left text-xs font-bold text-white flex items-center justify-between shadow-sm"
                >
                  <span class="truncate">${t.name}</span>
                  <span>🗡️</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="p-4 rounded-2xl bg-black/40 text-center space-y-1">
            <p class="text-xs font-bold text-rose-300">邪惡方同夥正私下密謀指認梅林...</p>
            <p class="text-[10px] text-rose-400">刺客揮刀後將立即揭曉最終勝負！</p>
          </div>
        `}
      </div>
    `;
  },

  // 8. Game Over Phase (Full Identity Reveal & Review)
  renderGameOverPhase(gameData) {
    const isHost = this.state.isHost;
    const isGoodWin = (gameData.winner === 'good');

    return `
      <div class="rounded-3xl p-6 border shadow-2xl text-center space-y-4 fade-in ${
        isGoodWin 
          ? 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white border-blue-500/60 shadow-blue-950/50' 
          : 'bg-gradient-to-br from-rose-950 via-slate-900 to-red-950 text-white border-rose-500/60 shadow-rose-950/50'
      }">
        <div class="text-4xl animate-bounce">${isGoodWin ? '🏆' : '💀'}</div>
        <div>
          <h2 class="text-2xl font-black text-white">
            ${isGoodWin ? '🔵 正義方獲得最終勝利！' : '🔴 邪惡方獲得最終勝利！'}
          </h2>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed px-4">
            ${gameData.winReason}
          </p>
        </div>

        <!-- Full Players Identity Table -->
        <div class="rounded-2xl bg-black/40 p-3.5 space-y-2 border border-white/10 text-left">
          <span class="text-xs font-bold text-amber-300">📜 全體圓桌騎士身分大公開：</span>
          <div class="grid grid-cols-2 gap-2 text-xs">
            ${this.state.players.map(p => {
              const card = gameData.playerRoles[p.id];
              const rDef = card ? this.ROLES[card.role] : this.ROLES.servant;
              const isPGood = (card?.team === 'good');

              return `
                <div class="p-2.5 rounded-xl bg-white/10 flex items-center justify-between border border-white/10">
                  <div class="truncate">
                    <div class="font-bold text-white truncate">${p.name}</div>
                    <div class="text-[10px] ${isPGood ? 'text-blue-300' : 'text-rose-300'} font-bold">
                      ${rDef.name} (${rDef.teamName})
                    </div>
                  </div>
                  <span class="text-lg">${rDef.emoji}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Host Actions -->
        <div class="pt-2 flex items-center justify-center space-x-2.5">
          ${isHost ? `
            <button 
              onclick="ArthurModule.hostPlayAgain()" 
              class="tap-scale px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center space-x-1.5"
            >
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
              <span>再來一局 (重新發牌)</span>
            </button>
            <button 
              onclick="ArthurModule.hostBackToRoom()" 
              class="tap-scale px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center space-x-1"
            >
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>返回等待室</span>
            </button>
          ` : `
            <div class="text-xs text-slate-400">
              等待房主開啟新對局或返回房間...
            </div>
            <button 
              onclick="ArthurModule.hostBackToRoom()" 
              class="tap-scale px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20"
            >
              返回等待室
            </button>
          `}
        </div>
      </div>
    `;
  },

  // Reaction bar element
  renderReactionsBar() {
    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const isCoolingDown = elapsed < 10000;
    const remainingSec = isCoolingDown ? Math.ceil((10000 - elapsed) / 1000) : 0;

    if (isCoolingDown && !this._reactionTimer) {
      setTimeout(() => this.startReactionCooldown(), 0);
    }

    return `
      <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">圓桌互動表情</span>
          <span id="art-reaction-hint-text" class="text-[10px] ${isCoolingDown ? 'font-bold text-amber-500 animate-pulse' : 'text-slate-400'}">
            ${isCoolingDown ? `⏳ 冷卻中 (${remainingSec} 秒)` : '點擊即時廣播全體騎士'}
          </span>
        </div>
        <div class="flex items-center justify-around py-0.5">
          <button onclick="ArthurModule.sendReaction('👑')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="王冠">👑</button>
          <button onclick="ArthurModule.sendReaction('🛡️')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="盾牌">🛡️</button>
          <button onclick="ArthurModule.sendReaction('🗡️')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="利刃">🗡️</button>
          <button onclick="ArthurModule.sendReaction('🌊')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="女神">🌊</button>
          <button onclick="ArthurModule.sendReaction('❓')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="質疑">❓</button>
          <button onclick="ArthurModule.sendReaction('❗')" class="art-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="警告">❗</button>
        </div>
      </div>
    `;
  },

  // Game Log accordion
  renderGameLogs(gameData) {
    return `
      <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3.5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
            <i data-lucide="scroll" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>圓桌征戰動態歷程</span>
          </h4>
          <span class="text-[10px] text-slate-400">${gameData.logs?.length || 0} 則動態</span>
        </div>
        <div class="max-h-36 overflow-y-auto space-y-1.5 text-[11px] pr-1">
          ${(gameData.logs || []).map(log => `
            <div class="flex items-start space-x-2 py-0.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0">
              <span class="text-[10px] text-slate-400 shrink-0 mt-0.5">${log.time}</span>
              <span class="text-slate-700 dark:text-slate-300 leading-tight">${log.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

window.ArthurModule = ArthurModule;
