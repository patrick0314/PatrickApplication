# My App - 手機桌遊工具站 PWA

**My App** 是一個以手機使用情境為核心設計的漸進式網頁應用（Progressive Web App, PWA）。本專案提供免登入、免安裝原生 App、可加入手機主畫面的多人桌遊輔助平台，目前內建「一夜狼人殺」、「機密代號」與「亞瑟傳奇 / 阿瓦隆」三個多人即時連線模組。

本專案採純前端架構，適合部署於 GitHub Pages 等靜態網站平台。個人偏好與收藏資料儲存在使用者裝置本機，多人同步則透過 MQTT over WebSocket 公開通訊服務完成。

---

## 🌐 線上正式站點

🔗 **正式網址：** [https://patrick0314.github.io/PatrickApplication/](https://patrick0314.github.io/PatrickApplication/)

- 支援手機瀏覽器直接開啟，包含 iOS Safari 與 Android Chrome。
- 支援外網、4G / 5G、Wi-Fi 環境使用。
- 可透過瀏覽器選單執行 **「加入主畫面（Add to Home Screen）」**，以近似原生 App 的全螢幕方式啟動。
- App Shell 支援離線快取；多人即時連線功能仍需網路連線。

---

## ✨ 專案特色

- **手機優先設計**：針對直式手機版面、觸控操作、底部導覽列與 iOS 安全區進行最佳化。
- **PWA 可安裝**：具備 Web App Manifest、Service Worker 與手機主畫面安裝能力。
- **免註冊登入**：使用者不需要建立帳號即可建立房間、加入房間與遊玩。
- **多人即時同步**：透過 MQTT over WSS 實現跨裝置、跨系統的房間同步。
- **本機偏好儲存**：暱稱、主題、我的最愛等資料保存在本機 localStorage / Cookie。
- **深色模式支援**：可選擇跟隨系統、明亮模式或深色模式。
- **桌遊主持輔助**：將角色發牌、行動流程、投票、任務結算等主持流程數位化。
- **手機互動回饋**：支援 Toast 提示、Confirm / Prompt 彈窗、震動回饋與浮動表情。

---

## 📱 安裝與使用方式

### iPhone / iPad（Safari）

1. 使用 Safari 開啟正式網址。
2. 點擊底部的「分享」按鈕。
3. 選擇「加入主畫面」。
4. 點擊「新增」。
5. 從桌面圖示啟動即可使用。

### Android（Chrome）

1. 使用 Chrome 開啟正式網址。
2. 點擊右上角選單。
3. 選擇「安裝應用程式」或「加到主畫面」。
4. 確認後即可從桌面圖示啟動。

---

## 🎮 已啟用功能總覽

目前內建三個多人桌遊模組，皆支援手機房間、即時同步、玩家狀態更新、浮動表情與基本對局流程輔助。

| 模組 | 功能概述 |
| --- | --- |
| 🐺 一夜狼人殺 | 支援建立 / 加入房間、玩家準備、角色池設定、自動發牌、夜晚行動流程、白天討論、投票與結果結算。 |
| 🕵️ 機密代號 | 支援紅藍分隊、隊長 / 隊員身份、中文詞卡盤面、隊長給線索、隊員猜牌、回合切換與勝負判定。 |
| 👑 亞瑟傳奇 / 阿瓦隆 | 支援 5 至 10 人房間、角色配置、夜間資訊、隊長組隊、公開表決、任務卡提交、湖中女神與刺殺梅林流程。 |

詳細遊戲規則與策略請玩家自行參考各桌遊原始規則或於實際遊玩中熟悉。

---

## 🧭 首頁與個人化功能

- **首頁功能列表**：顯示目前支援的桌遊模組，點擊卡片即可進入。
- **我的最愛**：可將常用模組加入收藏，方便快速啟動。
- **使用者名稱**：可自訂暱稱，並作為多人房間中的玩家名稱。
- **主題設定**：支援跟隨系統、明亮模式與深色模式。
- **資料重置**：可一鍵清除本機設定、收藏與相關使用者資料。

---

## 🧩 技術架構

### 前端技術

- HTML
- CSS
- JavaScript
- Tailwind CSS CDN
- Lucide Icons CDN
- MQTT.js

### PWA 技術

- Web App Manifest
- Service Worker
- Cache Storage
- Add to Home Screen
- Standalone Display Mode

### 即時通訊

多人模組主要使用 MQTT over WebSocket Secure（WSS）進行即時同步。

目前使用的公開 Broker 包含：

- `wss://broker.emqx.io:8084/mqtt`
- `wss://broker.hivemq.com:8884/mqtt`

### 本機儲存

- 使用 `localStorage` 保存設定與收藏。
- 使用 Cookie 備份重要設定，降低手機系統清除 PWA 儲存後造成設定遺失的機率。
- 使用 `sessionStorage` 保存各遊戲模組的臨時玩家 ID。

---

## 📁 資料結構介紹

本專案採用純前端靜態網站結構，核心可分為 **PWA 入口與設定**、**樣式資源**、**JavaScript 核心與遊戲模組**、**圖示素材**、**開發輔助工具** 幾個部分。

### 結構總覽

| 分類 | 位置 | 說明 |
| --- | --- | --- |
| PWA 入口與設定 | `index.html`、`manifest.json`、`sw.js` | App Shell、安裝資訊、離線快取與主要資源載入。 |
| 樣式資源 | `css/styles.css` | 手機版版面、深色模式、動畫與觸控體驗。 |
| JavaScript 核心 | `js/app.js`、`js/storage.js` | App 初始化、模組切換、全域 UI、主題與本機儲存。 |
| 多人遊戲模組 | `js/modules/` | 首頁、設定、一夜狼人殺、機密代號、亞瑟傳奇等功能模組。 |
| 第三方通訊函式庫 | `js/vendor/mqtt.min.js` | MQTT over WebSocket 即時通訊支援。 |
| 圖示素材 | `icons/` | PWA icon 與一夜狼人殺角色圖示。 |
| 開發輔助工具 | `serve.py`、`generate_icons.py` | 本機測試伺服器與 App icon 產生工具。 |

<details>
<summary><strong>專案樹狀結構</strong></summary>

```text
PatrickApplication/
├── index.html
├── manifest.json
├── sw.js
├── serve.py
├── generate_icons.py
├── README.md
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── vendor/
│   │   └── mqtt.min.js
│   └── modules/
│       ├── dashboard.js
│       ├── settings.js
│       ├── werewolf.js
│       ├── codenames.js
│       └── arthur.js
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── apple-touch-icon.png
    └── roles/
        ├── card_back.svg
        ├── card_icon.svg
        ├── werewolf.svg
        ├── minion.svg
        ├── mason.svg
        ├── seer.svg
        ├── robber.svg
        ├── troublemaker.svg
        ├── drunk.svg
        ├── insomniac.svg
        ├── hunter.svg
        └── villager.svg
```

</details>

<details>
<summary><strong>PWA 入口與根目錄檔案</strong></summary>

### `index.html`

PWA 主頁面與 App Shell 結構，負責載入手機版 viewport、PWA meta tags、Manifest、App icons、全域 Toast / 浮動表情容器、頂部標題列、動態模組內容容器、底部導航列，以及所有 CSS / JavaScript 資源。

### `manifest.json`

Web App Manifest 設定檔，負責定義 App 名稱、描述、啟動路徑、作用範圍、顯示模式、主題色、背景色、手機方向與 App icons，讓網站可被加入手機主畫面。

### `sw.js`

Service Worker 檔案，負責安裝時快取 App Shell 與主要靜態資源、啟用時清除舊版 Cache，並攔截 GET request 以提供基本離線開啟能力。

### `README.md`

專案說明文件，包含功能介紹、安裝方式、技術架構、資料結構、開發方式與版權提醒。

</details>

<details>
<summary><strong>樣式與前端介面資源</strong></summary>

### `css/styles.css`

全域手機版樣式檔，負責 CSS 變數、safe-area 設定、基礎字體與背景、深色模式、觸控回饋、無捲軸顯示、玻璃質感導覽列、Modal 動畫、卡牌 3D 翻轉動畫與一夜狼人殺夜晚氛圍效果。

</details>

<details>
<summary><strong>JavaScript 核心與本機儲存</strong></summary>

### `js/app.js`

App 主控制器，負責初始化應用、套用主題、更新頁首使用者名稱與日期時間、註冊 Service Worker、管理目前模組、渲染底部導航列，並提供全域 Toast、Confirm、Prompt 等共用 UI 功能。

### `js/storage.js`

本機儲存管理層，統一管理 `myapp:` prefix 的 localStorage key，負責設定讀寫、Cookie 備份、預設資料初始化、我的最愛資料、重置本機資料，以及透過 CustomEvent 通知其他模組資料更新。

</details>

<details>
<summary><strong>第三方函式庫與即時通訊</strong></summary>

### `js/vendor/mqtt.min.js`

MQTT.js 瀏覽器版本，是多人房間即時通訊核心。遊戲模組透過它建立 WSS MQTT 連線、訂閱房間 topic，並發布玩家狀態、遊戲狀態、投票、表情等同步訊息。

</details>

<details>
<summary><strong>功能模組</strong></summary>

### `js/modules/dashboard.js`

首頁模組，負責功能列表、我的最愛、長按加入 / 移除收藏，以及進入各桌遊模組的導航操作。

### `js/modules/settings.js`

設定模組，負責使用者名稱、主題模式、手機加入主畫面教學，以及一鍵重置本機資料。

### `js/modules/werewolf.js`

一夜狼人殺模組，負責房間連線、玩家同步、角色池設定、自動發牌、夜晚行動、白天討論、投票結算、身份公開、表情互動與連線狀態顯示。

### `js/modules/codenames.js`

機密代號模組，負責房間連線、紅藍分隊、隊長 / 隊員身份、詞卡盤面、線索提交、猜牌流程、回合切換、遊戲紀錄與勝負顯示。

### `js/modules/arthur.js`

亞瑟傳奇 / 阿瓦隆模組，負責房間連線、座位同步、角色配置、夜間資訊、隊長組隊、公開表決、任務卡提交、湖中女神、刺殺梅林與遊戲結束公開身份。

</details>

<details>
<summary><strong>圖示與素材</strong></summary>

### App icons

- `icons/icon-192.png`：PWA 192×192 圖示。
- `icons/icon-512.png`：PWA 512×512 圖示。
- `icons/apple-touch-icon.png`：iOS 加入主畫面圖示。

### `icons/roles/`

一夜狼人殺角色與卡牌圖示資料夾，包含卡背、通用卡牌圖示，以及狼人、爪牙、守夜人、預言家、強盜、搗蛋鬼、酒鬼、失眠者、獵人、村民等角色圖示。

</details>

<details>
<summary><strong>開發輔助工具</strong></summary>

### `serve.py`

本機開發與手機測試用 HTTP 伺服器。預設啟動於 `8080` port，會自動偵測區網 IP、顯示電腦與手機可連線網址，並設定 no-cache、CORS 與 Manifest MIME type，方便手機測試 PWA。

### `generate_icons.py`

App icon 產生工具，使用 Python 與 Pillow 產出 `icon-192.png`、`icon-512.png` 與 `apple-touch-icon.png`，圖示設計為漸層底色搭配白色 `M` 字樣。

</details>

---

## 🚀 本機開發與測試

### 使用 Python 本機伺服器

本專案提供 `serve.py`，可快速在區網中測試手機版 PWA。

```bash
python serve.py
```

啟動後終端機會顯示：

- 電腦瀏覽器訪問網址。
- 手機同 Wi-Fi 訪問網址。
- iOS / Android 加入主畫面操作提示。

### 使用其他靜態伺服器

本專案為純前端靜態網站，也可使用任意靜態伺服器啟動，例如：

```bash
python -m http.server 8080
```

或部署至：

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- 任意支援靜態檔案託管的平台

---

## ⚠️ 注意事項

- 多人即時連線依賴外部公開 MQTT Broker，穩定性可能受第三方服務狀態影響。
- 本專案無帳號登入與身份驗證機制，知道房間代碼者理論上即可加入對應房間。
- 請勿在公開場合分享仍在使用中的房間代碼。
- PWA App Shell 可離線開啟，但多人房間、同步、投票與表情廣播等功能需要網路連線。
- 使用者資料主要儲存在本機裝置；更換瀏覽器、清除瀏覽器資料或更換手機後，資料不會自動同步。
- iOS / Android 對 PWA 儲存與背景執行限制不同，實際體驗可能依裝置與系統版本略有差異。

---

## 📄 版權與授權提醒

本專案為個人用途與學習用途開發之手機網頁版桌遊工具站。請使用者注意下列事項：

- 專案中提及的桌遊名稱、規則概念、角色名稱或遊戲機制，可能分別屬於其原始出版商、設計者或權利人所有。
- 本專案並非相關桌遊之官方授權產品，也不代表與任何桌遊出版商、品牌或權利人存在合作、代理或背書關係。
- 若要進行公開商業使用、再發行、上架或大規模營利部署，請自行確認相關桌遊規則、名稱、圖像、商標與素材的授權狀態。
- 專案內第三方函式庫與外部 CDN 服務應依其各自授權條款使用。
- 若本專案內容涉及任何權利疑慮，建議先行移除或替換相關名稱、素材與規則描述，並洽詢專業法律意見。
