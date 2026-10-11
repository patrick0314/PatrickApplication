# My App - 個人隨身工作站

專為個人打造的**漸進式模組化行動應用（PWA）**。使用者可自由自訂應用名稱，無須註冊登入、啟動飛快、支援離線運作，資料 100% 儲存在手機本機。

---

## 🌐 線上正式站點 (隨時隨地手機可用)

🔗 **正式網址：** [https://patrick0314.github.io/PatrickApplication/](https://patrick0314.github.io/PatrickApplication/)

- 任何外網、手機 4G/5G 皆可直接開啟。
- 手機瀏覽器開啟後，點選 **「加入主畫面 (Add to Home Screen)」** 即可作為原生 App 離線使用。

---

## 🌟 已啟用功能清單

### 1. 🐺 一夜狼人殺（多人即時連線系統）
- **全球即時連線**：基於 WSS (WebSocket Secure) 公開通訊架構，支援跨手機、跨系統（iOS & Android）在外網（4G/5G）即時連線。
- **房間機制**：
  - **創建新房間**：自動產生 4 碼專屬房間號，創建者自動成為房主（👑）。
  - **加入房間**：輸入 4 碼房間代號即可即時進入房間。
  - **一鍵分享**：支援一鍵複製專屬房間連結。
- **玩家狀態同步**：
  - 即時玩家名單與在線狀態。
  - 「立即準備 / 取消準備」按鈕，全體玩家即時同步變更。
  - 即時表情符號互動（🐺、👀、🔥、👍、❓、💀）全房間浮動廣播。
  - 房主廣播測試功能，全體手機同步收到震動與彈窗通知。
  - 毫秒級延遲 Ping 即時顯示。

---

## 📁 專案架構

```
PatrickApplication/
├── index.html              # PWA 主頁面架構與動態標題
├── manifest.json           # Web App Manifest 配置檔 (My App)
├── sw.js                   # Service Worker 離線快取引擎 (v7)
├── serve.py                # 智慧本地伺服器（自動取得區網 IP）
├── css/
│   └── styles.css          # 行動端樣式、iOS 安全區與平滑動畫
├── js/
│   ├── vendor/
│   │   └── mqtt.min.js     # WSS 即時多人通訊核心引擎
│   ├── app.js              # 核心路由器、動態頂部標題與狀態管理
│   ├── storage.js          # 本地儲存引擎 (支援一鍵重置)
│   └── modules/
│       ├── dashboard.js    # 模組1：首頁功能列表 (呈現一夜狼人殺卡片)
│       ├── werewolf.js     # 模組2：一夜狼人殺多人連線模組
│       └── settings.js     # 模組3：設定 (自訂名稱、主題切換、一鍵重置、安裝教學)
└── icons/                  # 專屬 "M" 標誌圖示 (192x192, 512x512, apple-touch-icon)
```
