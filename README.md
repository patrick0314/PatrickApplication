# Patrick's App - 個人隨身工作站

專為 Patrick 量身打造的**漸進式模組化個人行動應用（PWA）**。無須註冊登入、啟動飛快、支援離線運作，資料 100% 儲存在手機本機，並具備完整 JSON 匯出備份與還原機制。

---

## 🌐 線上正式站點 (隨時隨地手機可用)

🔗 **正式網址：** [https://patrick0314.github.io/PatrickApplication/](https://patrick0314.github.io/PatrickApplication/)

- 任何外網、手機 4G/5G 皆可直接開啟。
- 手機瀏覽器開啟後，點選 **「加入主畫面 (Add to Home Screen)」** 即可作為原生 App 離線使用。

---

## 🌟 核心設計理念

1. **從零開始客製化 (Built from Scratch)**：
   - 預設示範功能已全數移除，提供純淨且穩固的現代模組化架構。
   - 您只要在對話中提出需求，即可一步一步為您掛載專屬的功能模組！
2. **跨平台原生體驗 (iOS & Android)**：
   - 支援加入手機主畫面，全螢幕沉浸體驗，無瀏覽器網址列干擾。
   - 針對 iPhone 動態島/瀏海及底部手勢條進行安全區域適配。
   - 科技靛藍質感色系，支援深色與明亮模式切換。
3. **完全離線與極致隱私 (Offline-First)**：
   - 搭載 Service Worker 離線快取，無網路時仍能正常啟動。
   - 資料保存在手機本機 LocalStorage，不經過任何第三方雲端伺服器。
   - 內建一鍵「匯出 JSON 備份」與「匯入還原」。

---

## 📁 專案架構

```
PatrickApplication/
├── index.html              # PWA 主頁面架構與行動適配
├── manifest.json           # Web App Manifest 配置檔
├── sw.js                   # Service Worker 離線快取引擎
├── serve.py                # 智慧本地伺服器（自動取得區網 IP）
├── css/
│   └── styles.css          # 行動端專用樣式、iOS 安全區與動畫
├── js/
│   ├── app.js              # 核心路由器、模組註冊中心與狀態管理
│   ├── storage.js          # 本地儲存引擎、JSON 匯出/匯入備份
│   └── modules/
│       ├── dashboard.js    # 模組1：首頁（個人問候、系統捷徑、功能模組中心）
│       └── settings.js     # 模組2：設定（外觀主題切換、JSON 備份還原、安裝教學）
└── icons/                  # 專屬科技靛藍 "P" 圖示 (192x192, 512x512, apple-touch-icon)
```
