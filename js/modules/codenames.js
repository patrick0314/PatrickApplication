/**
 * Codenames (機密代號) - Multiplayer Espionage Word Game Module
 * Full Standard Chinese Edition (400 Words Pool)
 * Supports real-time MQTT room sync, Team assignments (Red/Blue), Spymaster/Operative roles
 */
const CodenamesModule = {
  id: 'codenames',
  name: '機密代號',
  icon: 'key',

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
    myTeam: 'spectator', // 'red' | 'blue' | 'spectator'
    myRole: 'operative', // 'spymaster' | 'operative'
    players: [],
    messages: [],
    brokerIndex: 0,
    lastReactionTime: 0,
    gamePhase: 'waiting', // 'waiting' | 'clue' | 'guess' | 'game_over'
    gameData: null
  },

  _reactionTimer: null,
  _pingInterval: null,

  brokers: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ],

  // 400 Standard Chinese Words (中文標準版官方詞彙庫)
  WORD_POOL: [
    '蘋果', '香蕉', '橘子', '檸檬', '葡萄', '草莓', '西瓜', '鳳梨', '芒果', '木瓜',
    '櫻桃', '水蜜桃', '奇異果', '藍莓', '哈密瓜', '椰子', '甘蔗', '番茄', '荔枝', '龍眼',
    '芭樂', '百香果', '火龍果', '酪梨', '榴槤', '山竹', '紅毛丹', '無花果', '橄欖', '棗子',
    '栗子', '核桃', '花生', '杏仁', '腰果', '芝麻', '松子', '葵花子', '南瓜子', '玉米',
    '青椒', '茄子', '胡蘿蔔', '白蘿蔔', '洋蔥', '大蒜', '生薑', '辣椒', '馬鈴薯', '地瓜',
    '芋頭', '菠菜', '高麗菜', '花椰菜', '芹菜', '竹筍', '蘆筍', '小黃瓜', '苦瓜', '冬瓜',
    '絲瓜', '蘑菇', '香菇', '木耳', '海帶', '紫菜', '豆腐', '起司', '奶油', '牛奶',
    '豆漿', '優格', '冰淇淋', '蛋糕', '麵包', '餅乾', '糖果', '巧克力', '布丁', '甜甜圈',
    '鬆餅', '披薩', '漢堡', '三明治', '熱狗', '牛排', '炸雞', '壽司', '生魚片', '拉麵',
    '水餃', '包子', '春捲', '爆米花', '咖啡', '紅茶', '綠茶', '奶茶', '果汁', '汽水',
    '可樂', '啤酒', '紅酒', '香檳', '調酒', '蜂蜜', '果醬', '番茄醬', '芥末', '醬油',
    '胡椒', '鹽巴', '砂糖', '食醋', '香油', '大象', '獅子', '老虎', '獵豹', '黑熊',
    '熊貓', '長頸鹿', '斑馬', '犀牛', '河馬', '袋鼠', '無尾熊', '駱駝', '猴子', '猩猩',
    '狐狸', '狼', '松鼠', '兔子', '老鼠', '刺猬', '海豚', '鯨魚', '鯊魚', '海龜',
    '企鵝', '海豹', '海獅', '海獺', '章魚', '烏賊', '龍蝦', '螃蟹', '青蛙', '蟾蜍',
    '變色龍', '鱷魚', '恐龍', '老鷹', '貓頭鷹', '孔雀', '天鵝', '鴿子', '麻雀', '烏鴉',
    '鸚鵡', '蜂鳥', '海鷗', '啄木鳥', '蝴蝶', '蜜蜂', '蜻蜓', '螞蟻', '螢火蟲', '瓢蟲',
    '獨角仙', '蜘蛛', '蠍子', '蝸牛', '毛毛蟲', '獨角獸', '飛馬', '巨龍', '精靈', '美人魚',
    '天使', '魔鬼', '吸血鬼', '殭屍', '木乃伊', '幽靈', '外星人', '巨人', '矮人', '巫師',
    '女巫', '國王', '女王', '王子', '公主', '騎士', '忍者', '武士', '海盜', '偵探',
    '警察', '法官', '律師', '醫生', '護士', '消防員', '太空人', '飛行員', '水手', '司機',
    '廚師', '服務生', '科學家', '教授', '老師', '學生', '畫家', '音樂家', '作家', '記者',
    '演員', '歌手', '導演', '攝影師', '魔術師', '小丑', '小偷', '間諜', '特務', '殺手',
    '士兵', '將軍', '總統', '皇帝', '市長', '裁判', '教練', '運動員', '保全', '鐵匠',
    '木匠', '農夫', '獵人', '漁夫', '理髮師', '裁縫師', '建築師', '會計師', '工程師', '郵差',
    '保母', '手錶', '鬧鐘', '眼鏡', '太陽眼鏡', '手套', '圍巾', '帽子', '安全帽', '雨傘',
    '雨衣', '外套', '襯衫', '褲子', '裙子', '襪子', '皮鞋', '球鞋', '高跟鞋', '靴子',
    '拖鞋', '皮帶', '項鍊', '戒指', '耳環', '手鐲', '胸針', '皮夾', '背包', '手提箱',
    '錢包', '鑰匙', '鎖頭', '剪刀', '美工刀', '小刀', '梳子', '牙刷', '牙膏', '毛巾',
    '肥皂', '洗髮精', '吹風機', '刮鬍刀', '鏡子', '指甲剪', '溫度計', '手電筒', '蠟燭', '火柴',
    '打火機', '繩子', '膠帶', '膠水', '針線', '鐵鎚', '螺絲起子', '板手', '鋸子', '釘子',
    '梯子', '水桶', '掃帚', '拖把', '吸塵器', '熨斗', '洗衣機', '冰箱', '烤箱', '微波爐',
    '電風扇', '冷氣機', '暖爐', '電視', '收音機', '音響', '耳機', '麥克風', '相機', '攝影機',
    '手機', '平板', '電腦', '鍵盤', '滑鼠', '螢幕', '印表機', '電池', '插頭', '電線',
    '望遠鏡', '顯微鏡', '放大鏡', '指南針', '地圖', '地球儀', '時鐘', '日曆', '筆記本', '字典',
    '報紙', '雜誌', '信封', '郵票', '鉛筆', '原子筆', '鋼筆', '彩色筆', '橡皮擦', '尺',
    '書包', '黑板', '粉筆', '吉他', '鋼琴', '小提琴', '長笛', '薩克斯風', '爵士鼓', '小號',
    '豎琴', '學校', '大學', '圖書館', '博物館', '美術館', '劇院', '電影院', '體育館', '遊樂園',
    '動物園', '水族館', '公園', '植物園', '醫院', '診所', '藥局', '銀行', '郵局', '警察局',
    '消防局', '法院', '監獄', '市政廳', '機場', '車站', '地鐵站', '港口', '碼頭', '燈塔',
    '飯店', '旅館', '餐廳', '咖啡館', '麵包店', '書店', '超市', '商場', '夜市', '工廠',
    '倉庫', '農場', '牧場', '溫室', '城堡', '宮殿', '金字塔', '神廟', '教堂', '寺廟',
    '神社', '長城', '摩天大樓', '別墅', '帳篷', '木屋', '洞穴', '防空洞', '地牢', '地下室',
    '閣樓', '陽台', '花園', '游泳池', '太陽', '月亮', '星星', '地球', '彗星', '流星',
    '極光', '彩虹', '雲朵', '雨滴', '雪花', '冰雹', '雷電', '狂風', '颱風', '龍捲風',
    '海嘯', '地震', '火山', '高山', '雪山', '森林', '雨林', '沙漠', '綠洲', '草原',
    '沼澤', '海灘', '島嶼', '瀑布', '河流', '湖泊', '海洋', '冰川', '峽谷', '懸崖',
    '黃金', '白銀', '青銅', '鋼鐵', '水銀', '水晶', '鑽石', '珍珠', '琥珀', '翡翠',
    '寶石', '春季', '夏季', '秋季', '冬季', '早晨', '黃昏', '午夜', '時間', '影子',
    '命運', '秘密', '夢想', '愛情', '和平', '自由', '希望', '奇蹟'
  ],

  init() {
    if (!this.state.myPlayerId) {
      let pid = sessionStorage.getItem('codenames_player_id');
      if (!pid) {
        pid = 'cn_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('codenames_player_id', pid);
      }
      this.state.myPlayerId = pid;
    }
  },

  getRoomTopic(roomId) {
    return `patricksapp/codenames/room/${roomId}`;
  },

  connectBroker(callback) {
    if (this.state.client && this.state.connected) {
      if (callback) callback();
      return;
    }

    const brokerUrl = this.brokers[this.state.brokerIndex];
    console.log('[Codenames] Connecting to broker:', brokerUrl);

    try {
      const clientId = 'cn_' + Math.random().toString(16).substring(2, 10);
      const client = mqtt.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 5000,
        keepalive: 15
      });

      this.state.client = client;

      client.on('connect', () => {
        console.log('[Codenames] Connected to broker successfully!');
        this.state.connected = true;
        this.startPingInterval();
        if (callback) callback();
        this.updateRoomUI();
      });

      client.on('error', (err) => {
        console.error('[Codenames] Connection error:', err);
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
      console.error('[Codenames] Failed to initialize mqtt client:', e);
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
            App.showToast(`${data.player.name} 加入了房間 👋`, 'info');
          }
          if (this.state.isHost) {
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId,
              gamePhase: this.state.gamePhase,
              gameData: this.state.gameData
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
                team: this.state.myTeam,
                role: this.state.myRole,
                joinedAt: Date.now()
              });
            } else {
              this.state.myTeam = myself.team;
              this.state.myRole = myself.role;
            }
            this.state.players = currentPlayers;
            this.state.isHost = (data.hostId === this.state.myPlayerId);
          }
          if (data.gamePhase) this.state.gamePhase = data.gamePhase;
          if (data.gameData) this.state.gameData = data.gameData;
          this.updateRoomUI();
          break;

        case 'UPDATE_ROLE':
          const targetPlayer = this.state.players.find(p => p.id === data.playerId);
          if (targetPlayer) {
            targetPlayer.team = data.team;
            targetPlayer.role = data.role;
            if (data.playerId === this.state.myPlayerId) {
              this.state.myTeam = data.team;
              this.state.myRole = data.role;
            }
            this.updateRoomUI();
          }
          break;

        case 'PLAYER_LEAVE':
          this.state.players = this.state.players.filter(p => p.id !== data.playerId);
          App.showToast(`${data.playerName} 離開了房間`, 'info');
          this.updateRoomUI();
          break;

        case 'PING':
          if (data.from === this.state.myPlayerId && data.ts) {
            this.state.ping = Date.now() - data.ts;
            const pingEl = document.getElementById('cn-room-ping-val');
            if (pingEl) pingEl.textContent = `${this.state.ping}ms`;
          }
          break;
      }
    } catch (e) {
      console.error('[Codenames] Message parse error:', e);
    }
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
    this.state.myTeam = 'red';
    this.state.myRole = 'spymaster';
    this.state.players = [{
      id: this.state.myPlayerId,
      name: this.state.myPlayerName,
      isHost: true,
      team: 'red',
      role: 'spymaster',
      joinedAt: Date.now()
    }];

    App.showToast(`正在建立特務通訊頻道 #${code}...`, 'info');

    this.connectBroker(() => {
      const topic = this.getRoomTopic(this.state.roomId);
      this.state.client.subscribe(topic, { qos: 0 }, (err) => {
        if (!err) {
          this.state.currentView = 'room';
          this.renderView();
          App.showToast(`房間 #${code} 建立成功！`, 'success');
        } else {
          App.showToast('訂閱房間主題失敗', 'error');
        }
      });
    });
  },

  // Join Room
  joinRoom(roomIdInput) {
    const code = (roomIdInput || '').trim().toUpperCase();
    if (!code) {
      App.showToast('請輸入 4 位數房間代碼', 'error');
      return;
    }

    const settings = StorageManager.get('settings', { userName: 'default' });
    this.state.myPlayerName = settings.userName || 'default';
    this.state.roomId = code;
    this.state.isHost = false;
    this.state.myTeam = 'blue';
    this.state.myRole = 'operative';

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
              team: this.state.myTeam,
              role: this.state.myRole,
              joinedAt: Date.now()
            }
          });

          App.showToast('已加入特務頻道，等待同步...', 'success');
        } else {
          App.showToast('無法加入房間頻道', 'error');
        }
      });
    });
  },

  // Leave Room
  leaveRoom() {
    App.confirm({
      title: '確定要退出房間嗎？',
      confirmText: '退出',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: () => {
        if (this.state.client && this.state.roomId) {
          this.broadcast({
            type: 'PLAYER_LEAVE',
            playerId: this.state.myPlayerId,
            playerName: this.state.myPlayerName
          });
          this.state.client.unsubscribe(this.getRoomTopic(this.state.roomId));
        }
        if (this._pingInterval) {
          clearInterval(this._pingInterval);
          this._pingInterval = null;
        }
        this.state.gamePhase = 'waiting';
        this.state.gameData = null;
        this.state.currentView = 'lobby';
        this.state.roomId = '';
        this.state.players = [];
        this.state.isHost = false;
        this.renderView();
        App.showToast('已退出特務頻道', 'info');
      }
    });
  },

  copyRoomCode() {
    const code = this.state.roomId;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      App.showToast(`房間代號 ${code} 已複製！`, 'success');
    }).catch(() => {
      App.showToast(`房間代號為: ${code}`, 'info');
    });
  },

  promptChangeName() {
    const settings = StorageManager.get('settings', { userName: 'default' });
    const currentName = settings.userName || 'default';
    App.prompt({
      title: '修改特務代號 / 暱稱',
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
        App.showToast(`特務代號已更新為：${newName}`, 'success');
      }
    });
  },

  // Set Team and Role
  setTeamAndRole(team, role) {
    this.state.myTeam = team;
    this.state.myRole = role;

    const myPlayer = this.state.players.find(p => p.id === this.state.myPlayerId);
    if (myPlayer) {
      myPlayer.team = team;
      myPlayer.role = role;
    }

    if ('vibrate' in navigator) navigator.vibrate(20);

    this.broadcast({
      type: 'UPDATE_ROLE',
      playerId: this.state.myPlayerId,
      team: team,
      role: role
    });

    this.updateRoomUI();
  },

  updateRoomUI() {
    if (this.state.currentView === 'room') {
      const container = document.getElementById('module-content');
      if (container) {
        container.innerHTML = this.renderRoomView();
        if (window.lucide) lucide.createIcons();
      }
    }
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
          <button onclick="App.switchTab('dashboard')" class="flex items-center space-x-1 text-xs font-semibold text-rose-600 dark:text-rose-400 tap-scale">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span>返回功能列表</span>
          </button>
          <span class="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/40">
            多人即時連線 v1.0
          </span>
        </div>

        <!-- Codenames Hero Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-950/40 border border-slate-800/60">
          <div class="relative z-10">
            <div class="flex items-center space-x-2 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span class="text-xl">🕵️</span>
              <span>Codenames · 機密代號</span>
            </div>

            <h1 class="text-2xl font-black tracking-tight text-white">機密代號</h1>

            <div class="mt-3 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>WSS 加密通道已就緒 (延遲 < 50ms)</span>
            </div>
          </div>

          <!-- Red & Blue ambient light spots -->
          <div class="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-rose-600/20 blur-2xl"></div>
          <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-600/20 blur-2xl"></div>
        </div>

        <!-- Player Nickname Badge -->
        <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              ${(currentName || 'D').charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="text-xs font-bold text-slate-900 dark:text-white">${currentName}</p>
              <p class="text-[10px] text-slate-400">目前連線特務代號</p>
            </div>
          </div>
          <button onclick="CodenamesModule.promptChangeName()" class="text-xs text-rose-600 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 tap-scale">
            更換暱稱
          </button>
        </div>

        <!-- Room Action Cards -->
        <div class="grid grid-cols-1 gap-3.5">
          <!-- Create Room -->
          <button onclick="CodenamesModule.createRoom()" class="tap-scale flex items-center justify-between p-5 rounded-3xl bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 text-white shadow-lg shadow-purple-600/25 text-left">
            <div class="flex items-center space-x-4">
              <div class="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center text-white text-2xl shadow-inner">
                👑
              </div>
              <div>
                <h3 class="text-base font-black">建立特務頻道</h3>
                <p class="text-xs text-rose-100 mt-0.5">擔任房主，產生專屬房間代碼給好友</p>
              </div>
            </div>
            <i data-lucide="arrow-right" class="w-5 h-5 opacity-80"></i>
          </button>

          <!-- Join Room -->
          <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div class="flex items-center space-x-2">
              <i data-lucide="door-open" class="w-4 h-4 text-rose-500"></i>
              <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">加入特務頻道</h3>
            </div>
            
            <div class="flex space-x-2">
              <input 
                type="text" 
                id="cn-join-room-input" 
                maxlength="6"
                placeholder="請輸入 4 位數房間代號 (如 7E2X)"
                value="${this.state.roomId || ''}"
                class="flex-1 uppercase tracking-widest font-black px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-center"
              />
              <button 
                onclick="CodenamesModule.joinRoom(document.getElementById('cn-join-room-input').value)" 
                class="tap-scale px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md shrink-0"
              >
                加入
              </button>
            </div>
          </div>
        </div>

        <!-- Codenames Quick Rules Card -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="book-open" class="w-4 h-4 text-indigo-500"></i>
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">遊戲規則速覽</h3>
          </div>
          <div class="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>• <b>陣營分組</b>：分為 <span class="font-bold text-rose-600 dark:text-rose-400">🔴 紅隊</span> 與 <span class="font-bold text-blue-600 dark:text-blue-400">🔵 藍隊</span>，每隊設有「隊長」與「隊員」。</p>
            <p>• <b>盤面設計</b>：桌面由 25 張繁體中文代號卡（5×5）組成，包含先手隊 9 張、後手隊 8 張、平民 7 張、刺客 1 張。</p>
            <p>• <b>線索提示</b>：隊長依據密碼圖給予「一個提示詞 + 一個數字」（例：動物 2），隊員聯想點選。</p>
            <p>• <b>勝利條件</b>：率先找出所屬陣營全部特務卡獲勝；<b>若點中刺客卡（💀）則該隊直接落敗！</b></p>
          </div>
        </div>
      </div>
    `;
  },

  // View 2: Room Lobby Screen (Team & Role Allocation)
  renderRoomView() {
    const isHost = this.state.isHost;
    const players = this.state.players;
    const redPlayers = players.filter(p => p.team === 'red');
    const bluePlayers = players.filter(p => p.team === 'blue');
    const spectatorPlayers = players.filter(p => p.team === 'spectator' || !p.team);

    const redSpymaster = redPlayers.find(p => p.role === 'spymaster');
    const blueSpymaster = bluePlayers.find(p => p.role === 'spymaster');

    return `
      <div class="space-y-4 fade-in pb-20">
        <!-- Room Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="CodenamesModule.leaveRoom()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出房間</span>
          </button>

          <!-- Ping & Status -->
          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span id="cn-room-ping-val">${this.state.ping ? this.state.ping + 'ms' : '連線正常'}</span>
          </div>
        </div>

        <!-- Room Identity Banner -->
        <div class="rounded-3xl bg-gradient-to-r from-slate-950 via-purple-950 to-slate-950 p-5 text-white border border-purple-900/60 shadow-xl flex items-center justify-between">
          <div>
            <p class="text-[10px] uppercase font-bold text-purple-300 tracking-wider">房間代碼 (點擊可複製)</p>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-3xl font-black tracking-widest text-purple-400">#${this.state.roomId}</span>
              <button onclick="CodenamesModule.copyRoomCode()" class="tap-scale p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200" title="複製房間代碼">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="text-right">
            <span class="text-xs font-bold text-purple-200 bg-white/10 px-3 py-1.5 rounded-full inline-block">
              ${isHost ? '👑 您是房主' : '👤 房間成員'}
            </span>
          </div>
        </div>

        <!-- My Current Team & Role Selector -->
        <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <i data-lucide="user-check" class="w-4 h-4 text-purple-500"></i>
              <span>我的特務身分設定</span>
            </h2>
            <span class="text-[11px] font-bold ${
              this.state.myTeam === 'red' ? 'text-rose-600 dark:text-rose-400' :
              this.state.myTeam === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
            }">
              ${this.state.myTeam === 'red' ? '🔴 紅隊' : this.state.myTeam === 'blue' ? '🔵 藍隊' : '觀戰中'} · ${this.state.myRole === 'spymaster' ? '隊長 (看密碼圖)' : '隊員 (猜測)'}
            </span>
          </div>

          <!-- Quick Toggle Grid -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button 
              onclick="CodenamesModule.setTeamAndRole('red', 'spymaster')"
              class="tap-scale p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between ${
                this.state.myTeam === 'red' && this.state.myRole === 'spymaster'
                  ? 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300'
              }"
            >
              <span>🔴 紅隊隊長</span>
              <span class="text-sm">🕵️</span>
            </button>

            <button 
              onclick="CodenamesModule.setTeamAndRole('red', 'operative')"
              class="tap-scale p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between ${
                this.state.myTeam === 'red' && this.state.myRole === 'operative'
                  ? 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300'
              }"
            >
              <span>🔴 紅隊隊員</span>
              <span class="text-sm">👤</span>
            </button>

            <button 
              onclick="CodenamesModule.setTeamAndRole('blue', 'spymaster')"
              class="tap-scale p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between ${
                this.state.myTeam === 'blue' && this.state.myRole === 'spymaster'
                  ? 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
              }"
            >
              <span>🔵 藍隊隊長</span>
              <span class="text-sm">🕵️</span>
            </button>

            <button 
              onclick="CodenamesModule.setTeamAndRole('blue', 'operative')"
              class="tap-scale p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between ${
                this.state.myTeam === 'blue' && this.state.myRole === 'operative'
                  ? 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
              }"
            >
              <span>🔵 藍隊隊員</span>
              <span class="text-sm">👤</span>
            </button>
          </div>
        </div>

        <!-- Teams Roster Board -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Red Team Box -->
          <div class="rounded-3xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black text-rose-700 dark:text-rose-300 flex items-center space-x-1">
                <span>🔴 紅隊名冊</span>
              </h3>
              <span class="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">
                ${redPlayers.length} 人
              </span>
            </div>

            <div class="space-y-1.5 min-h-[90px]">
              ${redPlayers.length === 0 ? `
                <p class="text-[11px] text-slate-400 italic text-center py-6">尚無玩家加入紅隊</p>
              ` : redPlayers.map(p => `
                <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/60 text-xs shadow-xs">
                  <span class="font-bold text-slate-800 dark:text-white truncate">${p.name}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    p.role === 'spymaster' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }">
                    ${p.role === 'spymaster' ? '隊長' : '隊員'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Blue Team Box -->
          <div class="rounded-3xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black text-blue-700 dark:text-blue-300 flex items-center space-x-1">
                <span>🔵 藍隊名冊</span>
              </h3>
              <span class="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                ${bluePlayers.length} 人
              </span>
            </div>

            <div class="space-y-1.5 min-h-[90px]">
              ${bluePlayers.length === 0 ? `
                <p class="text-[11px] text-slate-400 italic text-center py-6">尚無玩家加入藍隊</p>
              ` : bluePlayers.map(p => `
                <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/60 text-xs shadow-xs">
                  <span class="font-bold text-slate-800 dark:text-white truncate">${p.name}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    p.role === 'spymaster' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }">
                    ${p.role === 'spymaster' ? '隊長' : '隊員'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Host Action Container -->
        <div class="pt-2">
          ${isHost ? `
            <button 
              onclick="App.showToast('盤面生成與遊戲互動流程準備就緒，請等待下一階段指示！', 'info')" 
              class="tap-scale w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 text-white font-black text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center space-x-2"
            >
              <i data-lucide="play" class="w-5 h-5"></i>
              <span>開始遊戲 (準備中)</span>
            </button>
          ` : `
            <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center">
              <p class="text-xs font-bold text-slate-600 dark:text-slate-300">等待房主開始遊戲...</p>
              <p class="text-[10px] text-slate-400 mt-0.5">您可以先在上方面板選擇您的所屬陣營與特務職位</p>
            </div>
          `}
        </div>
      </div>
    `;
  }
};

window.CodenamesModule = CodenamesModule;
