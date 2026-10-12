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
    gameData: null,
    previewAsOperative: false,
    clueInputWord: '',
    clueInputCount: 1
  },

  _reactionTimer: null,
  _pingInterval: null,
  _visibilityBound: false,

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
          if (data.currentView) this.state.currentView = data.currentView;
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
          const leftPlayer = this.state.players.find(p => p.id === data.playerId);
          const wasHost = leftPlayer ? leftPlayer.isHost : false;
          this.state.players = this.state.players.filter(p => p.id !== data.playerId);
          App.showToast(`${data.playerName || '玩家'} 離開了房間`, 'info');

          if (wasHost && this.state.players.length > 0) {
            this.state.players[0].isHost = true;
            if (this.state.players[0].id === this.state.myPlayerId) {
              this.state.isHost = true;
              App.showToast('原房主已離開，您已成為新房主 👑', 'info');
              this.broadcast({
                type: 'SYNC_STATE',
                players: this.state.players,
                hostId: this.state.myPlayerId,
                currentView: this.state.currentView,
                gamePhase: this.state.gamePhase,
                gameData: this.state.gameData
              });
            }
          } else if (this.state.isHost) {
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId,
              currentView: this.state.currentView,
              gamePhase: this.state.gamePhase,
              gameData: this.state.gameData
            });
          }
          this.updateRoomUI();
          break;

        case 'REQUEST_SYNC':
          if (this.state.isHost) {
            this.broadcast({
              type: 'SYNC_STATE',
              players: this.state.players,
              hostId: this.state.myPlayerId,
              currentView: this.state.currentView,
              gamePhase: this.state.gamePhase,
              gameData: this.state.gameData
            });
          }
          break;

        case 'GAME_START':
          this.state.currentView = 'game';
          this.state.gamePhase = data.gameData.turnPhase || 'clue';
          this.state.gameData = data.gameData;
          if (data.players) this.state.players = data.players;
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
          App.showToast(`機密代號已啟動！由 ${data.gameData.startingTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊'} 先手`, 'info');
          this.renderView();
          break;

        case 'CLUE_SUBMITTED':
          if (this.state.gameData) {
            this.state.gameData.currentClue = data.clue;
            this.state.gameData.turnPhase = 'guess';
            this.state.gameData.remainingGuesses = data.remainingGuesses;
            if (data.logs) this.state.gameData.logs = data.logs;
            if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
            App.showToast(`${data.team === 'red' ? '🔴 紅隊' : '🔵 藍隊'} 隊長提供線索：【${data.clue.word}】（${data.clue.count} 張）`, 'info');
            this.updateRoomUI();
          }
          break;

        case 'CARD_GUESSED':
          if (this.state.gameData) {
            this.state.gameData = data.gameData;
            if ('vibrate' in navigator) navigator.vibrate(50);
            if (data.toastMessage) {
              App.showToast(data.toastMessage, data.toastType || 'info');
            }
            this.updateRoomUI();
          }
          break;

        case 'TURN_ENDED':
          if (this.state.gameData) {
            this.state.gameData = data.gameData;
            if ('vibrate' in navigator) navigator.vibrate(40);
            App.showToast(`已換隊！輪到 ${data.gameData.currentTurnTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊'} 回合`, 'info');
            this.updateRoomUI();
          }
          break;

        case 'RESET_GAME':
          this.state.currentView = 'game';
          this.state.gameData = data.gameData;
          if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
          App.showToast('房主重新開了新的一局！🎲', 'success');
          this.renderView();
          break;

        case 'BACK_TO_ROOM':
          this.state.currentView = 'room';
          this.state.gamePhase = 'waiting';
          this.state.gameData = null;
          App.showToast('已返回房間等待室', 'info');
          this.renderView();
          break;

        case 'REACTION':
          if (data.fromId === this.state.myPlayerId) return;
          this.showFloatingReaction(data.emoji, data.fromName);
          break;

        case 'PING':
          if (data.from === this.state.myPlayerId && data.ts) {
            this.state.ping = Date.now() - data.ts;
            const pingEl = document.getElementById('cn-room-ping-val') || document.getElementById('cn-game-ping-val');
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

  // 隨機分隊 (房主專屬：分配兩隊隊長與隊員)
  randomAssignTeams() {
    if (!this.state.isHost) {
      App.showToast('只有房主可以進行隨機分隊', 'warning');
      return;
    }
    const players = [...this.state.players];
    if (players.length < 2) {
      App.showToast('房間人數不足，至少需 2 人才能進行分隊', 'warning');
      return;
    }

    // Fisher-Yates shuffle 洗牌
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    // 隊長有且只有一人，其餘平均分配到兩隊隊員
    // 第 1 位玩家：紅隊隊長
    players[0].team = 'red';
    players[0].role = 'spymaster';

    // 第 2 位玩家：藍隊隊長
    players[1].team = 'blue';
    players[1].role = 'spymaster';

    // 第 3 位以後玩家：平均分配至紅隊隊員與藍隊隊員
    for (let i = 2; i < players.length; i++) {
      players[i].team = (i % 2 === 0) ? 'red' : 'blue';
      players[i].role = 'operative';
    }

    this.state.players = players;
    const me = players.find(p => p.id === this.state.myPlayerId);
    if (me) {
      this.state.myTeam = me.team;
      this.state.myRole = me.role;
    }

    if ('vibrate' in navigator) navigator.vibrate([30, 40, 30]);

    this.broadcast({
      type: 'SYNC_STATE',
      players: this.state.players,
      hostId: this.state.myPlayerId,
      gamePhase: this.state.gamePhase,
      gameData: this.state.gameData
    });

    this.updateRoomUI();
    App.showToast('🎲 已完成隨機分隊！', 'success');
  },

  // 檢查是否滿足開始遊戲條件 (四人以上且每個隊伍各身分皆有人選)
  getGameStartStatus() {
    const players = this.state.players;
    const playerCount = players.length;
    const hasRedSpymaster = players.some(p => p.team === 'red' && p.role === 'spymaster');
    const hasRedOperative = players.some(p => p.team === 'red' && p.role === 'operative');
    const hasBlueSpymaster = players.some(p => p.team === 'blue' && p.role === 'spymaster');
    const hasBlueOperative = players.some(p => p.team === 'blue' && p.role === 'operative');

    const missing = [];
    if (playerCount < 4) {
      missing.push(`房間人數需滿 4 人 (目前 ${playerCount}/4 人)`);
    }

    const missingRoles = [];
    if (!hasRedSpymaster) missingRoles.push('紅隊隊長');
    if (!hasRedOperative) missingRoles.push('紅隊隊員');
    if (!hasBlueSpymaster) missingRoles.push('藍隊隊長');
    if (!hasBlueOperative) missingRoles.push('藍隊隊員');

    if (missingRoles.length > 0) {
      missing.push(`缺少：${missingRoles.join('、')}`);
    }

    const canStart = playerCount >= 4 && hasRedSpymaster && hasRedOperative && hasBlueSpymaster && hasBlueOperative;

    return {
      canStart,
      playerCount,
      hasRedSpymaster,
      hasRedOperative,
      hasBlueSpymaster,
      hasBlueOperative,
      missing,
      hintText: missing.join('，')
    };
  },

  hostStartGame() {
    if (!this.state.isHost) {
      App.showToast('只有房主可以開始遊戲！', 'warning');
      return;
    }
    const status = this.getGameStartStatus();
    if (!status.canStart) {
      App.showToast(`無法開始遊戲：${status.hintText}`, 'warning');
      if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
      return;
    }

    // 1. 從 400 個標準官方中文詞彙庫中隨機抽選 25 張
    const shuffledWords = [...this.WORD_POOL];
    for (let i = shuffledWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
    }
    const selectedWords = shuffledWords.slice(0, 25);

    // 2. 隨機決定先手隊伍 (先手隊需猜 9 張，後手隊需猜 8 張)
    const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
    const secondTeam = (startingTeam === 'red' ? 'blue' : 'red');

    // 3. 卡牌分配：先手 9 張、後手 8 張、平民 7 張、刺客 1 張 (合計 25 張)
    const cardTypes = [
      ...Array(9).fill(startingTeam),
      ...Array(8).fill(secondTeam),
      ...Array(7).fill('neutral'),
      'assassin'
    ];
    for (let i = cardTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardTypes[i], cardTypes[j]] = [cardTypes[j], cardTypes[i]];
    }

    // 4. 組裝 25 張特務代號卡
    const cards = selectedWords.map((word, idx) => ({
      id: idx,
      word: word,
      type: cardTypes[idx], // 'red' | 'blue' | 'neutral' | 'assassin'
      revealed: false,
      revealedBy: null,
      revealedTeam: null
    }));

    const gameData = {
      cards: cards,
      startingTeam: startingTeam,
      currentTurnTeam: startingTeam,
      turnPhase: 'clue', // 'clue' | 'guess' | 'game_over'
      redRemaining: (startingTeam === 'red' ? 9 : 8),
      blueRemaining: (startingTeam === 'blue' ? 9 : 8),
      currentClue: null,
      remainingGuesses: 0,
      turnNumber: 1,
      winner: null,
      winReason: '',
      logs: [
        {
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          text: `遊戲開局！由 ${startingTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊'} 先手（需找出 9 張特務牌）。`
        }
      ]
    };

    this.state.currentView = 'game';
    this.state.gamePhase = 'clue';
    this.state.gameData = gameData;
    this.state.clueInputWord = '';
    this.state.clueInputCount = 1;
    this.state.previewAsOperative = false;

    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    this.broadcast({
      type: 'GAME_START',
      gameData: this.state.gameData,
      players: this.state.players
    });

    this.renderView();
    App.showToast(`遊戲開始！由 ${startingTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊'} 先手開局`, 'success');
  },

  submitClue() {
    const gameData = this.state.gameData;
    if (!gameData || gameData.turnPhase !== 'clue') return;
    if (gameData.currentTurnTeam !== this.state.myTeam || this.state.myRole !== 'spymaster') {
      App.showToast('現在不是您的給予線索回合', 'warning');
      return;
    }

    const wordInput = document.getElementById('cn-clue-word-input');
    const countInput = document.getElementById('cn-clue-count-input');

    const clueWord = (wordInput ? wordInput.value : this.state.clueInputWord || '').trim();
    const clueCount = parseInt(countInput ? countInput.value : this.state.clueInputCount || 1, 10);

    if (!clueWord) {
      App.showToast('請輸入提示詞！', 'warning');
      if (wordInput) wordInput.focus();
      return;
    }

    if (/\s/.test(clueWord)) {
      App.showToast('提示詞必須為單一詞彙，不可包含空格！', 'warning');
      return;
    }

    // 檢查提示詞是否為場上未翻開的牌面詞
    const unrevealedBoardWords = gameData.cards.filter(c => !c.revealed).map(c => c.word);
    if (unrevealedBoardWords.some(w => w === clueWord)) {
      App.showToast(`提示詞不可直接使用場上未翻開的代號「${clueWord}」！`, 'warning');
      return;
    }

    if (isNaN(clueCount) || clueCount < 1 || clueCount > 9) {
      App.showToast('關聯數量請設定為 1 到 9 張！', 'warning');
      return;
    }

    const teamLabel = (this.state.myTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊');
    gameData.currentClue = {
      word: clueWord,
      count: clueCount,
      givenBy: this.state.myPlayerName
    };
    gameData.turnPhase = 'guess';
    gameData.remainingGuesses = clueCount + 1;

    gameData.logs.unshift({
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      text: `${teamLabel} 隊長 ${this.state.myPlayerName} 提供線索：【${clueWord}】（${clueCount} 張）`
    });

    if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);

    this.broadcast({
      type: 'CLUE_SUBMITTED',
      team: this.state.myTeam,
      clue: gameData.currentClue,
      remainingGuesses: gameData.remainingGuesses,
      logs: gameData.logs
    });

    this.updateRoomUI();
    App.showToast(`已發送線索【${clueWord}】！隊員可開始猜測`, 'success');
  },

  guessCard(cardId) {
    const gameData = this.state.gameData;
    if (!gameData || gameData.turnPhase !== 'guess') return;
    if (gameData.currentTurnTeam !== this.state.myTeam || this.state.myRole !== 'operative') {
      App.showToast('只有當前行動隊伍的隊員可以點擊猜測！', 'warning');
      return;
    }

    const card = gameData.cards.find(c => c.id === cardId);
    if (!card || card.revealed) return;

    App.confirm({
      title: `確定要猜測「${card.word}」嗎？`,
      confirmText: '確定猜測',
      cancelText: '再想想',
      onConfirm: () => {
        card.revealed = true;
        card.revealedBy = this.state.myPlayerName;
        card.revealedTeam = this.state.myTeam;

        const myTeamLabel = (this.state.myTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊');
        const opponentTeam = (this.state.myTeam === 'red' ? 'blue' : 'red');
        const opponentTeamLabel = (opponentTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊');

        let toastMsg = '';
        let toastType = 'info';

        if (card.type === 'assassin') {
          // 誤觸刺客，當場落敗！
          gameData.winner = opponentTeam;
          gameData.winReason = `${myTeamLabel} 誤觸刺客（💀）！${opponentTeamLabel} 獲得勝利！`;
          gameData.turnPhase = 'game_over';

          gameData.logs.unshift({
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            text: `💀 致命失誤！${this.state.myPlayerName} 點中了刺客【${card.word}】，遊戲結束，${opponentTeamLabel} 獲勝！`
          });

          toastMsg = `💀 翻出刺客【${card.word}】！${opponentTeamLabel} 獲勝！`;
          toastType = 'error';
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
        } else if (card.type === this.state.myTeam) {
          // 答對本隊特務
          if (this.state.myTeam === 'red') gameData.redRemaining--;
          else gameData.blueRemaining--;

          gameData.logs.unshift({
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            text: `🎯 答對！${this.state.myPlayerName} 翻出本隊特務【${card.word}】！`
          });

          // 檢查是否獲勝
          if (gameData.redRemaining === 0) {
            gameData.winner = 'red';
            gameData.winReason = '🔴 紅隊率先找出所有特務牌，贏得勝利！🎉';
            gameData.turnPhase = 'game_over';
            toastMsg = '🎉 紅隊已找齊所有特務，獲得勝利！';
            toastType = 'success';
          } else if (gameData.blueRemaining === 0) {
            gameData.winner = 'blue';
            gameData.winReason = '🔵 藍隊率先找出所有特務牌，贏得勝利！🎉';
            gameData.turnPhase = 'game_over';
            toastMsg = '🎉 藍隊已找齊所有特務，獲得勝利！';
            toastType = 'success';
          } else {
            // 猜測成功且尚未結束，剩餘猜測次數 -1
            gameData.remainingGuesses--;
            if (gameData.remainingGuesses <= 0) {
              gameData.logs.unshift({
                time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                text: `${myTeamLabel} 本回合猜測次數已用盡，換隊！`
              });
              this.switchTurn(gameData);
              toastMsg = `🎯 答對【${card.word}】！次數已用盡，換隊。`;
            } else {
              toastMsg = `🎯 答對【${card.word}】！本回合還可猜測 ${gameData.remainingGuesses} 次。`;
              toastType = 'success';
            }
          }
          if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);
        } else if (card.type === opponentTeam) {
          // 猜到對方特務，對方得 1 分且立即換隊
          if (opponentTeam === 'red') gameData.redRemaining--;
          else gameData.blueRemaining--;

          gameData.logs.unshift({
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            text: `⚠️ 失誤！${this.state.myPlayerName} 翻出了對手【${card.word}】，${opponentTeamLabel} 得 1 分！回合結束。`
          });

          // 檢查對方是否剛好湊齊獲勝
          if (gameData.redRemaining === 0) {
            gameData.winner = 'red';
            gameData.winReason = '🔴 紅隊所有特務已現身，紅隊獲勝！🎉';
            gameData.turnPhase = 'game_over';
            toastMsg = '🔴 紅隊特務全員現身，紅隊獲勝！';
          } else if (gameData.blueRemaining === 0) {
            gameData.winner = 'blue';
            gameData.winReason = '🔵 藍隊所有特務已現身，藍隊獲勝！🎉';
            gameData.turnPhase = 'game_over';
            toastMsg = '🔵 藍隊特務全員現身，藍隊獲勝！';
          } else {
            this.switchTurn(gameData);
            toastMsg = `⚠️ 翻出對手特務【${card.word}】，回合結束！`;
            toastType = 'warning';
          }
          if ('vibrate' in navigator) navigator.vibrate([150, 80]);
        } else {
          // 中立平民，立即換隊
          gameData.logs.unshift({
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            text: `⚪ 翻出中立平民【${card.word}】！回合結束。`
          });
          this.switchTurn(gameData);
          toastMsg = `⚪ 翻出平民【${card.word}】，換隊！`;
          toastType = 'info';
          if ('vibrate' in navigator) navigator.vibrate([80]);
        }

        this.broadcast({
          type: 'CARD_GUESSED',
          gameData: gameData,
          cardId: cardId,
          toastMessage: toastMsg,
          toastType: toastType
        });

        this.updateRoomUI();
        App.showToast(toastMsg, toastType);
      }
    });
  },

  endTurn() {
    const gameData = this.state.gameData;
    if (!gameData || gameData.turnPhase !== 'guess') return;
    if (gameData.currentTurnTeam !== this.state.myTeam || this.state.myRole !== 'operative') {
      App.showToast('現在不是您的猜測回合', 'warning');
      return;
    }

    App.confirm({
      title: '確定要結束本輪猜測嗎？',
      confirmText: '結束猜測',
      cancelText: '繼續猜測',
      onConfirm: () => {
        const teamLabel = (this.state.myTeam === 'red' ? '🔴 紅隊' : '🔵 藍隊');
        gameData.logs.unshift({
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          text: `${teamLabel} 隊員 ${this.state.myPlayerName} 結束本輪猜測，換隊。`
        });

        this.switchTurn(gameData);

        if ('vibrate' in navigator) navigator.vibrate(30);

        this.broadcast({
          type: 'TURN_ENDED',
          gameData: gameData
        });

        this.updateRoomUI();
        App.showToast('已結束本輪猜測，換隊！', 'info');
      }
    });
  },

  switchTurn(gameData) {
    gameData.currentTurnTeam = (gameData.currentTurnTeam === 'red' ? 'blue' : 'red');
    gameData.turnPhase = 'clue';
    gameData.currentClue = null;
    gameData.remainingGuesses = 0;
    gameData.turnNumber = (gameData.turnNumber || 1) + 1;
  },

  setClueCount(delta) {
    const input = document.getElementById('cn-clue-count-input');
    if (!input) return;
    let current = parseInt(input.value || '1', 10);
    if (isNaN(current)) current = 1;
    const next = Math.max(1, Math.min(9, current + delta));
    input.value = next;
    this.state.clueInputCount = next;
  },

  hostPlayAgain() {
    if (!this.state.isHost) {
      App.showToast('只有房主可以重新開始遊戲！', 'warning');
      return;
    }
    this.hostStartGame();
  },

  hostBackToRoom() {
    App.confirm({
      title: '確定要結束對局並返回房間等待室嗎？',
      confirmText: '返回等待室',
      cancelText: '取消',
      onConfirm: () => {
        this.state.currentView = 'room';
        this.state.gamePhase = 'waiting';
        this.state.gameData = null;
        this.broadcast({
          type: 'BACK_TO_ROOM'
        });
        this.renderView();
        App.showToast('已返回房間等待室', 'info');
      }
    });
  },

  leaveGame() {
    App.confirm({
      title: '確定要退出當前房間嗎？',
      confirmText: '退出房間',
      cancelText: '取消',
      isDestructive: true,
      onConfirm: () => {
        this.leaveRoom();
      }
    });
  },

  toggleSpymasterPreview() {
    this.state.previewAsOperative = !this.state.previewAsOperative;
    this.updateRoomUI();
    App.showToast(this.state.previewAsOperative ? '已切換為「隊員視角預覽」👀' : '已切換為「隊長密碼圖視角」🕵️', 'info');
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
      fromId: this.state.myPlayerId,
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
      const hint = document.getElementById('cn-reaction-hint-text');
      const btns = document.querySelectorAll('.cn-reaction-btn');

      if (remainingSec <= 0) {
        if (this._reactionTimer) {
          clearInterval(this._reactionTimer);
          this._reactionTimer = null;
        }
        if (hint) {
          hint.textContent = '點擊即時廣播全體特務';
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
    // Calculate vertical position at screen bottom (just above bottom nav bar)
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

  updateRoomUI() {
    const container = document.getElementById('module-content');
    if (!container) return;

    if (this.state.currentView === 'game') {
      container.innerHTML = this.renderGameView();
      if (window.lucide) lucide.createIcons();
      return;
    }
    if (this.state.currentView === 'room') {
      container.innerHTML = this.renderRoomView();
      if (window.lucide) lucide.createIcons();
    }
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

        <!-- Codenames Hero Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-950/40 border border-slate-800/60">
          <div class="relative z-10">
            <div class="flex items-center space-x-2 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span class="text-xl">🕵️</span>
              <span>Codenames · 機密代號</span>
            </div>

            <h1 class="text-2xl font-black tracking-tight text-white">機密代號</h1>
          </div>

          <!-- Red & Blue ambient light spots -->
          <div class="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-rose-600/20 blur-2xl"></div>
          <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-600/20 blur-2xl"></div>
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
          <button onclick="CodenamesModule.promptChangeName()" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 tap-scale">
            更換暱稱
          </button>
        </div>

        <!-- Room Action Cards -->
        <div class="grid grid-cols-1 gap-3.5">
          <!-- Create Room -->
          <button onclick="CodenamesModule.createRoom()" class="tap-scale flex items-center justify-between p-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 text-left">
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
                id="cn-join-room-input" 
                maxlength="6"
                placeholder="請輸入 4 位數房間代號 (如 8F2A)"
                value="${this.state.roomId || ''}"
                class="flex-1 uppercase tracking-widest font-black px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
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

    const status = this.getGameStartStatus();
    const canStart = status.canStart;

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

        <!-- Quick Reactions Bar -->
        ${this.renderReactionsBar()}

        <!-- Host Action Container -->
        <div class="pt-2 space-y-2.5">
          ${isHost ? `
            <!-- 隨機分隊按鈕 (房主專屬) -->
            <button 
              onclick="CodenamesModule.randomAssignTeams()" 
              class="tap-scale w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 shadow-sm transition"
            >
              <i data-lucide="shuffle" class="w-4 h-4 text-indigo-500"></i>
              <span>隨機分隊</span>
            </button>

            <!-- 開始遊戲按鈕 -->
            <button 
              onclick="CodenamesModule.hostStartGame()" 
              ${!canStart ? 'disabled' : ''}
              class="tap-scale w-full py-4 rounded-2xl ${
                canStart 
                  ? 'bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 text-white font-black text-sm shadow-xl shadow-purple-600/30' 
                  : 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-bold text-sm cursor-not-allowed opacity-60'
              } flex items-center justify-center space-x-2 transition"
            >
              <i data-lucide="play" class="w-5 h-5"></i>
              <span>開始遊戲</span>
            </button>

            <!-- 狀態提示小字 -->
            <p class="text-[11px] text-center ${canStart ? 'text-emerald-500 font-bold' : 'text-slate-400 dark:text-slate-500'}">
              ${canStart ? '✨ 人數與身分已全員齊全，隨時可開局！' : `⚠️ ${status.hintText}`}
            </p>
          ` : `
            <div class="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center space-y-1">
              <p class="text-xs font-bold text-slate-700 dark:text-slate-300">等待房主開始遊戲...</p>
              <p class="text-[10px] ${canStart ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                ${canStart ? '✨ 人員已齊全，等待房主開局' : `尚未就緒：${status.hintText}`}
              </p>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // View 3: Game Screen (機密代號對局主畫面)
  renderGameView() {
    const gameData = this.state.gameData;
    if (!gameData) {
      return this.renderRoomView();
    }

    const myTeam = this.state.myTeam;
    const myRole = this.state.myRole;
    const isGameOver = (gameData.turnPhase === 'game_over');
    const isRedTurn = (gameData.currentTurnTeam === 'red');
    const isBlueTurn = (gameData.currentTurnTeam === 'blue');

    const redPlayers = this.state.players.filter(p => p.team === 'red');
    const bluePlayers = this.state.players.filter(p => p.team === 'blue');
    const redSpymaster = redPlayers.find(p => p.role === 'spymaster');
    const blueSpymaster = bluePlayers.find(p => p.role === 'spymaster');
    const redOperatives = redPlayers.filter(p => p.role === 'operative');
    const blueOperatives = bluePlayers.filter(p => p.role === 'operative');

    return `
      <div class="relative space-y-3.5 fade-in pb-16" id="cn-game-container">
        <!-- Top Header Bar -->
        <div class="flex items-center justify-between pt-1">
          <button onclick="CodenamesModule.leaveGame()" class="flex items-center space-x-1 text-xs font-bold text-red-500 hover:text-red-600 tap-scale">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            <span>退出房間</span>
          </button>

          <div class="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span>房間 #${this.state.roomId}</span>
            <span>·</span>
            <span>第 ${gameData.turnNumber || 1} 回合</span>
          </div>

          <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span id="cn-game-ping-val">${this.state.ping ? this.state.ping + 'ms' : '連線正常'}</span>
          </div>
        </div>

        <!-- Game Over Banner (若勝負已分) -->
        ${isGameOver ? this.renderGameOverBanner(gameData) : ''}

        <!-- Dual Team Scoreboard (雙方陣營計分板) -->
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Red Team Box -->
          <div class="rounded-2xl p-2.5 border transition-all ${
            isRedTurn && !isGameOver
              ? 'bg-rose-500/10 border-rose-500 shadow-md shadow-rose-500/20 ring-2 ring-rose-500/30' 
              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-80'
          }">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                <span>🔴 紅隊</span>
                ${isRedTurn && !isGameOver ? '<span class="text-[9px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full animate-pulse">行動中</span>' : ''}
              </span>
              <span class="text-xs font-bold text-rose-700 dark:text-rose-300">
                剩餘 <strong class="text-lg font-black">${gameData.redRemaining}</strong> 張
              </span>
            </div>
            <div class="mt-1 flex items-center space-x-1 text-[9px] text-slate-500 dark:text-slate-400 truncate">
              <span class="font-bold text-rose-600">隊長:</span>
              <span class="truncate">${redSpymaster ? redSpymaster.name : '無'}</span>
              <span class="opacity-40">|</span>
              <span class="font-bold">隊員:</span>
              <span class="truncate">${redOperatives.map(p => p.name).join('、') || '無'}</span>
            </div>
          </div>

          <!-- Blue Team Box -->
          <div class="rounded-2xl p-2.5 border transition-all ${
            isBlueTurn && !isGameOver
              ? 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30' 
              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-80'
          }">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center space-x-1">
                <span>🔵 藍隊</span>
                ${isBlueTurn && !isGameOver ? '<span class="text-[9px] bg-blue-500 text-white font-bold px-1.5 py-0.2 rounded-full animate-pulse">行動中</span>' : ''}
              </span>
              <span class="text-xs font-bold text-blue-700 dark:text-blue-300">
                剩餘 <strong class="text-lg font-black">${gameData.blueRemaining}</strong> 張
              </span>
            </div>
            <div class="mt-1 flex items-center space-x-1 text-[9px] text-slate-500 dark:text-slate-400 truncate">
              <span class="font-bold text-blue-600">隊長:</span>
              <span class="truncate">${blueSpymaster ? blueSpymaster.name : '無'}</span>
              <span class="opacity-40">|</span>
              <span class="font-bold">隊員:</span>
              <span class="truncate">${blueOperatives.map(p => p.name).join('、') || '無'}</span>
            </div>
          </div>
        </div>

        <!-- Current Turn & Clue Status Banner (回合狀態與線索提示) -->
        ${!isGameOver ? `
          <div class="rounded-2xl p-3 border shadow-xs ${
            isRedTurn 
              ? 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/40 text-rose-950 dark:text-rose-100'
              : 'bg-blue-50/80 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/40 text-blue-950 dark:text-blue-100'
          }">
            ${gameData.turnPhase === 'clue' ? `
              <div class="flex items-center space-x-2">
                <span class="text-base">⏳</span>
                <div>
                  <p class="text-xs font-black">
                    ${isRedTurn ? '🔴 紅隊' : '🔵 藍隊'} 隊長提供線索中
                  </p>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400">
                    ${(myRole === 'spymaster' && ((isRedTurn && myTeam === 'red') || (isBlueTurn && myTeam === 'blue')))
                      ? '👉 您是隊長！請檢視密碼圖，並在下方輸入提示詞與關聯張數。'
                      : '隊長正在思考關聯詞，請稍候...'}
                  </p>
                </div>
              </div>
            ` : `
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs font-black uppercase text-slate-400">當前線索</span>
                    <span class="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                      【 ${gameData.currentClue?.word || ''} 】
                    </span>
                    <span class="text-xs font-bold">
                      ${gameData.currentClue?.count || 1} 張
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    本回合剩餘猜測：<strong class="text-indigo-600 dark:text-indigo-400 font-bold">${gameData.remainingGuesses}</strong> 次
                  </p>
                </div>
                <div>
                  ${(myRole === 'operative' && ((isRedTurn && myTeam === 'red') || (isBlueTurn && myTeam === 'blue'))) ? `
                    <button onclick="CodenamesModule.endTurn()" class="tap-scale px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs">
                      結束猜測
                    </button>
                  ` : ''}
                </div>
              </div>
            `}
          </div>
        ` : ''}

        <!-- My Identity & Spymaster Preview Toggle Bar -->
        <div class="flex items-center justify-between px-1 text-[11px]">
          <div class="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300">
            <span>您的身分：</span>
            <strong class="${myTeam === 'red' ? 'text-rose-600' : myTeam === 'blue' ? 'text-blue-600' : 'text-slate-400'}">
              ${myTeam === 'red' ? '🔴 紅隊' : myTeam === 'blue' ? '🔵 藍隊' : '觀戰'} · ${myRole === 'spymaster' ? '🕵️ 隊長' : '👤 隊員'}
            </strong>
          </div>

          ${myRole === 'spymaster' ? `
            <button onclick="CodenamesModule.toggleSpymasterPreview()" class="tap-scale flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              <i data-lucide="${this.state.previewAsOperative ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i>
              <span>${this.state.previewAsOperative ? '切回密碼圖' : '預覽隊員視角'}</span>
            </button>
          ` : ''}
        </div>

        <!-- 5x5 Card Grid (25 Cards) -->
        ${this.renderCardGrid(gameData)}

        <!-- Spymaster Clue Input Card (when clue phase) -->
        ${this.renderClueInputForm(gameData)}

        <!-- Operative Guess Action hint (when guess phase) -->
        ${this.renderOperativeActions(gameData)}

        <!-- Reactions & Logs -->
        ${this.renderReactionsAndLogs(gameData)}
      </div>
    `;
  },

  renderGameOverBanner(gameData) {
    if (gameData.turnPhase !== 'game_over') return '';
    const isHost = this.state.isHost;
    const isRedWin = (gameData.winner === 'red');

    return `
      <div class="rounded-3xl p-5 border shadow-xl text-center space-y-3.5 fade-in ${
        isRedWin 
          ? 'bg-gradient-to-br from-rose-950 via-slate-900 to-rose-950 text-white border-rose-600/60 shadow-rose-950/50' 
          : 'bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 text-white border-blue-600/60 shadow-blue-950/50'
      }">
        <div class="text-4xl animate-bounce">🏆</div>
        <div>
          <h2 class="text-xl font-black text-white">
            ${isRedWin ? '🔴 紅隊獲得最終勝利！' : '🔵 藍隊獲得最終勝利！'}
          </h2>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed px-4">
            ${gameData.winReason}
          </p>
        </div>

        <div class="pt-2 flex items-center justify-center space-x-2.5">
          ${isHost ? `
            <button 
              onclick="CodenamesModule.hostPlayAgain()" 
              class="tap-scale px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center space-x-1.5"
            >
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
              <span>再來一局 (重新發牌)</span>
            </button>
            <button 
              onclick="CodenamesModule.hostBackToRoom()" 
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
              onclick="CodenamesModule.hostBackToRoom()" 
              class="tap-scale px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20"
            >
              返回等待室
            </button>
          `}
        </div>
      </div>
    `;
  },

  renderCardGrid(gameData) {
    const myTeam = this.state.myTeam;
    const myRole = this.state.myRole;
    const isGameOver = (gameData.turnPhase === 'game_over');
    const isSpymasterMode = (myRole === 'spymaster' && !this.state.previewAsOperative) || isGameOver;
    const canIGuess = (!isGameOver && gameData.turnPhase === 'guess' && gameData.currentTurnTeam === myTeam && myRole === 'operative');

    return `
      <div class="grid grid-cols-5 gap-1.5 sm:gap-2 select-none" id="cn-card-grid">
        ${gameData.cards.map((card) => {
          const isRevealed = card.revealed;
          
          let cardStyle = '';
          let badgeText = '';
          let badgeClass = '';
          let textStyle = '';
          let onClickAttr = '';

          if (isRevealed) {
            // 已翻開
            if (card.type === 'red') {
              cardStyle = 'bg-gradient-to-br from-rose-500 to-rose-700 text-white border-2 border-rose-600 shadow-sm';
              badgeText = '🔴 特務';
              badgeClass = 'bg-white/20 text-white';
              textStyle = 'text-white line-through opacity-90';
            } else if (card.type === 'blue') {
              cardStyle = 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-2 border-blue-600 shadow-sm';
              badgeText = '🔵 特務';
              badgeClass = 'bg-white/20 text-white';
              textStyle = 'text-white line-through opacity-90';
            } else if (card.type === 'neutral') {
              cardStyle = 'bg-amber-100/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 border-2 border-amber-200 dark:border-slate-600';
              badgeText = '平民';
              badgeClass = 'bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300';
              textStyle = 'text-slate-500 dark:text-slate-400 line-through opacity-70';
            } else if (card.type === 'assassin') {
              cardStyle = 'bg-slate-950 text-red-400 border-2 border-red-600 shadow-md shadow-red-950/40 ring-1 ring-red-500';
              badgeText = '💀 刺客';
              badgeClass = 'bg-red-500 text-white font-black';
              textStyle = 'text-red-400 font-black';
            }
          } else {
            // 未翻開
            if (isSpymasterMode) {
              // 隊長視角 (或遊戲結束全貌)
              if (card.type === 'red') {
                cardStyle = 'bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-700/80 text-rose-900 dark:text-rose-200 shadow-xs';
                badgeText = '🔴';
                badgeClass = 'text-rose-600 dark:text-rose-400 font-black';
                textStyle = 'text-rose-900 dark:text-rose-100 font-black';
              } else if (card.type === 'blue') {
                cardStyle = 'bg-blue-50/90 dark:bg-blue-950/40 border-2 border-blue-400 dark:border-blue-700/80 text-blue-900 dark:text-blue-200 shadow-xs';
                badgeText = '🔵';
                badgeClass = 'text-blue-600 dark:text-blue-400 font-black';
                textStyle = 'text-blue-900 dark:text-blue-100 font-black';
              } else if (card.type === 'neutral') {
                cardStyle = 'bg-amber-50/50 dark:bg-slate-800/60 border-2 border-amber-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300';
                badgeText = '⚪';
                badgeClass = 'text-slate-400 font-bold';
                textStyle = 'text-slate-700 dark:text-slate-300 font-bold';
              } else if (card.type === 'assassin') {
                cardStyle = 'bg-slate-900 border-2 border-red-500 text-white shadow-sm ring-1 ring-red-500/40';
                badgeText = '💀';
                badgeClass = 'text-red-400 font-black';
                textStyle = 'text-red-400 font-black';
              }
            } else {
              // 隊員視角 (未翻開)
              cardStyle = 'bg-white dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs';
              textStyle = 'text-slate-900 dark:text-white font-black';
              if (canIGuess) {
                cardStyle += ' tap-scale cursor-pointer hover:border-indigo-500 hover:shadow-md active:scale-95';
                onClickAttr = `onclick="CodenamesModule.guessCard(${card.id})"`;
              }
            }
          }

          return `
            <div 
              ${onClickAttr}
              class="relative flex flex-col items-center justify-center p-1.5 rounded-2xl h-[62px] sm:h-20 transition-all ${cardStyle}"
            >
              <!-- 頂部身分標記 -->
              ${badgeText ? `
                <div class="absolute top-1 right-1 text-[9px] px-1 py-0.2 rounded-md ${badgeClass}">
                  ${badgeText}
                </div>
              ` : ''}

              <!-- 翻開者小標籤 -->
              ${isRevealed && card.revealedBy ? `
                <div class="absolute bottom-1 left-1 right-1 text-[8px] text-center truncate opacity-75">
                  ${card.revealedBy}
                </div>
              ` : ''}

              <!-- 代號文字 -->
              <span class="text-xs sm:text-sm tracking-wide text-center truncate max-w-full px-0.5 ${textStyle}">
                ${card.word}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderClueInputForm(gameData) {
    const isMyTurn = (gameData.currentTurnTeam === this.state.myTeam && this.state.myRole === 'spymaster');
    if (!isMyTurn || gameData.turnPhase !== 'clue') return '';

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/10 space-y-3.5 fade-in">
        <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center space-x-2">
            <span class="text-base">🕵️</span>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white">隊長發布線索</h3>
          </div>
          <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
            輪到您給提示
          </span>
        </div>

        <div class="space-y-2.5">
          <!-- Clue Word Input -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">提示詞 (單一詞彙，不可包含空格或場上未翻開的詞)</label>
            <input 
              type="text" 
              id="cn-clue-word-input" 
              maxlength="10"
              placeholder="請輸入提示詞 (例如：水果、武器、交通工具)..."
              class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <!-- Clue Count Picker -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">關聯卡牌數量 (1 ~ 9)</label>
            <div class="flex items-center space-x-2">
              <button 
                type="button" 
                onclick="CodenamesModule.setClueCount(-1)" 
                class="tap-scale h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-base flex items-center justify-center shadow-xs"
              >
                -
              </button>
              <input 
                type="number" 
                id="cn-clue-count-input" 
                min="1" 
                max="9" 
                value="1" 
                class="flex-1 h-10 text-center font-black text-base rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button 
                type="button" 
                onclick="CodenamesModule.setClueCount(1)" 
                class="tap-scale h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-base flex items-center justify-center shadow-xs"
              >
                +
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <button 
            type="button" 
            onclick="CodenamesModule.submitClue()" 
            class="tap-scale w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center space-x-1.5"
          >
            <i data-lucide="send" class="w-4 h-4"></i>
            <span>正式發布線索給隊員</span>
          </button>
        </div>
      </div>
    `;
  },

  renderOperativeActions(gameData) {
    const isMyTurn = (gameData.currentTurnTeam === this.state.myTeam && this.state.myRole === 'operative');
    if (!isMyTurn || gameData.turnPhase !== 'guess') return '';

    return `
      <div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between fade-in">
        <div class="flex items-center space-x-2">
          <i data-lucide="alert-circle" class="w-4 h-4 text-amber-500 shrink-0"></i>
          <span class="text-xs font-bold text-amber-800 dark:text-amber-300">
            點擊上方卡牌猜測，若不想冒險可隨時結束
          </span>
        </div>
        <button 
          onclick="CodenamesModule.endTurn()" 
          class="tap-scale px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shrink-0"
        >
          結束猜測
        </button>
      </div>
    `;
  },

  renderReactionsBar() {
    const now = Date.now();
    const elapsed = now - (this.state.lastReactionTime || 0);
    const isCoolingDown = elapsed < 10000;
    const remainingSec = isCoolingDown ? Math.ceil((10000 - elapsed) / 1000) : 0;

    if (isCoolingDown && !this._reactionTimer) {
      setTimeout(() => this.startReactionCooldown(), 0);
    }

    return `
      <!-- Quick Reactions Bar -->
      <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">特務快捷表情互動</span>
          <span id="cn-reaction-hint-text" class="text-[10px] ${isCoolingDown ? 'font-bold text-amber-500 animate-pulse' : 'text-slate-400'}">
            ${isCoolingDown ? `⏳ 冷卻中 (${remainingSec} 秒)` : '點擊即時廣播全體特務'}
          </span>
        </div>
        <div class="flex items-center justify-around py-0.5">
          <button onclick="CodenamesModule.sendReaction('🕵️')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="特務">🕵️</button>
          <button onclick="CodenamesModule.sendReaction('🤫')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="保密">🤫</button>
          <button onclick="CodenamesModule.sendReaction('💡')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="靈感">💡</button>
          <button onclick="CodenamesModule.sendReaction('❓')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="疑問">❓</button>
          <button onclick="CodenamesModule.sendReaction('🎯')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="命中">🎯</button>
          <button onclick="CodenamesModule.sendReaction('💀')" class="cn-reaction-btn tap-scale text-2xl ${isCoolingDown ? 'opacity-40 cursor-not-allowed' : 'hover:scale-125'} transition" title="刺客">💀</button>
        </div>
      </div>
    `;
  },

  renderReactionsAndLogs(gameData) {
    return `
      ${this.renderReactionsBar()}

      <!-- Game Logs Accordion -->
      <div class="rounded-2xl bg-white dark:bg-slate-800/90 p-3.5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
            <i data-lucide="scroll" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>對局行動歷程記錄</span>
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

window.CodenamesModule = CodenamesModule;
