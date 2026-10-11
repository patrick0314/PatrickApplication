# My App - 個人隨身工作站

專為個人打造的**漸進式模組化行動應用（PWA）**。使用者可自由自訂應用名稱，無須註冊登入、啟動飛快、支援離線運作，資料 100% 儲存在手機本機。

---

## 🌐 線上正式站點 (隨時隨地手機可用)

🔗 **正式網址：** [https://patrick0314.github.io/PatrickApplication/](https://patrick0314.github.io/PatrickApplication/)

- 任何外網、手機 4G/5G 皆可直接開啟。
- 手機瀏覽器開啟後，點選 **「加入主畫面 (Add to Home Screen)」** 即可作為原生 App 離線使用。

---

## 🌟 核心特色

1. **自訂專屬名稱 (Customizable Identity)**：
   - 預設名稱為 `default`，使用者可隨時在「設定」頁面自訂個人名稱。
   - 頂部導航標題與首頁問候將即時連動顯示自訂名稱。
2. **從零打造純淨畫布 (Clean Modular Canvas)**：
   - 移除所有預設範例，維持簡潔純粹的模組化插槽。
   - 隨時可在對話中提出需求，逐步掛載專屬功能模組！
3. **跨平台原生體驗 (iOS & Android)**：
   - 支援加入手機主畫面，全螢幕沉浸體驗，無瀏覽器網址列干擾。
   - 針對 iPhone 動態島/瀏海及底部手勢條進行安全區域適配。
   - 支援跟隨系統、深色模式與明亮模式切換。

---

## 📁 專案架構

```
PatrickApplication/
├── index.html              # PWA 主頁面架構與動態標題
├── manifest.json           # Web App Manifest 配置檔 (My App)
├── sw.js                   # Service Worker 離線快取引擎 (v4)
├── serve.py                # 智慧本地伺服器（自動取得區網 IP）
├── css/
│   └── styles.css          # 行動端樣式、iOS 安全區與平滑動畫
├── js/
│   ├── app.js              # 核心路由器、動態頂部標題與狀態管理
│   ├── storage.js          # 本地儲存引擎 (預設 default)
│   └── modules/
│       ├── dashboard.js    # 模組1：首頁（個人問候、功能模組中心）
│       └── settings.js     # 模組2：設定（自訂名稱、主題切換、安裝教學）
└── icons/                  # 專屬 "M" 標誌圖示 (192x192, 512x512, apple-touch-icon)
```
