# AGENTS.md

本文件是本專案給 Codex / AI agent 的工作規範。所有修改都應以「維持既有功能、逐步提升可維護性、避免破壞列印與 NAS 流程」為原則。

## 1. 專案目的

本專案是「健美滷味團購系統」，目標是提供店家、團購主與訂購人使用的團購管理工具。

主要功能包含：

- 訂購人下單、購物車、付款方式與歷史訂單。
- 團購主開團、收單、代訂、送單給店家與 A4 訂單表。
- 店家後台管理訂單、商品、庫存、聯絡人、報表、地圖配送路線。
- 出貨單、備料單、備貨清單與 A4 訂單表列印。
- NAS 感熱印表機中介服務，將前端產生的圖片送到 USB 感熱印表機。

長期方向是從根目錄單檔 `index.html` 逐步遷移到 `frontend/` 的 Vue 3 + Vite SPA。遷移期間必須保留 legacy `index.html` 作為 fallback。

## 2. 主要檔案結構

```text
.
|-- AGENTS.md
|-- index.html
|-- frontend/
|   |-- package.json
|   |-- src/
|   |   |-- main.js
|   |   |-- App.vue
|   |   |-- router/
|   |   |-- views/
|   |   |-- components/
|   |   |-- stores/
|   |   |-- services/
|   |   |-- print/
|   |   |-- data/
|   |   `-- styles/
|   `-- scripts/
`-- nas-print-service/
    |-- main.py
    |-- Dockerfile
    |-- docker-compose.yml
    |-- requirements.txt
    `-- README.md
```

重要檔案說明：

- `index.html`：legacy 單檔前端，內含 HTML/CSS/JS、UI、訂購、管理、列印與地圖相關邏輯。除非使用者明確要求，不要修改。
- `frontend/`：Vue 3 + Vite SPA。新功能與遷移工作優先放在這裡。
- `frontend/src/router/`：Vue Router，使用 hash history，避免靜態部署時需要 server rewrite。
- `frontend/src/stores/`：Pinia stores，管理商品、訂單、團購、列印設定、主題、地圖等狀態。
- `frontend/src/print/legacyTemplates.js`：列印模板與 legacy HTML 字串產生邏輯。修改時要特別小心。
- `frontend/src/services/nasPrint.js`：NAS 連線、`/ping`、`/print` payload 與圖片送印流程。
- `frontend/src/services/localPrint.js`：本機列印，使用隱藏 `#printArea` 與 `window.print()`。
- `frontend/src/styles/legacy.css`：由舊版整理出的全域樣式與相容 class/id。
- `nas-print-service/main.py`：FastAPI + Pillow 列印中介服務，處理圖片轉 TSPL/USB 列印。
- `nas-print-service/Dockerfile`、`docker-compose.yml`、`requirements.txt`、`README.md`：NAS 部署、依賴與使用說明。

## 3. 修改 HTML / CSS / JS 的限制

### Legacy `index.html`

- 除非使用者明確要求，不要修改根目錄 `index.html`。
- 如果必須修改，保留單檔架構、UTF-8、繁體中文內容與既有互動方式。
- 不任意改名或移除既有 `id`、`class`、inline `onclick`、`window.*` 匯出、`localStorage` key。
- 不任意改動 `#printArea`、`@media print`、列印模板、尺寸換算、`html2canvas`、本機列印與 NAS 送印流程。

### Vue `frontend/`

- 優先使用 Vue component、Pinia store、service module，不再新增 inline `onclick`。
- 保留與 legacy 相容的重要 DOM 錨點，例如 `#printArea`、`#printPreview`、`#ppvBody`、`#ordersPanel`、`#prodList`、`#mapCanvas` 等。
- 使用 hash router，路由維持：
  - `#/`
  - `#/admin/:view?`
  - `#/orderer`
  - `#/organizer/:teamId?`
- 保留既有 localStorage key：
  - `jm_docSize`
  - `jm_shipStyle`
  - `jm_prepStyle`
  - `jm_printMode`
  - `jm_nasConfig`
- UI 改動要盡量維持舊版操作語意與視覺密度，不要把管理介面改成 landing page 或行銷頁。
- 不新增大型框架、CSS 系統或狀態管理工具，除非使用者明確要求且有充分理由。

### 列印相關

列印是高風險區，修改前要先確認影響範圍。以下項目不可隨意改：

- 出貨單、備料單、備貨清單、A4 訂單表模板。
- `frontend/src/print/legacyTemplates.js`
- `#printArea`
- `#printPreview`
- `#ppvBody`
- `@media print`
- `@page` 尺寸設定。
- mm / px 換算。
- `html2canvas` 圖片渲染。
- 本機列印與 NAS 列印共用的 HTML pages。

若修改列印模板，至少要跑 `npm.cmd run test:print`，並在回報中說明是否實測本機列印或 NAS 實機列印。

## 4. 不可破壞既有功能

任何修改都不得破壞下列功能：

- 訂購人下單、購物車、付款方式、送出成功彈窗。
- 團購主開團、收單、代訂、送單、收回、追加訂單。
- 店家後台 dashboard、訂單列表、訂單編輯、狀態切換、批次操作。
- 商品管理、組合商品、庫存、安全庫存。
- 出貨單、備料單、備貨清單、A4 訂單表預覽與列印。
- 列印樣式選擇、樣式預覽、legacy style key 相容。
- 設定頁、本機/NAS 列印模式、文件尺寸設定。
- 地圖配送路線、起點設定、站點排序、Google Maps 導航連結。
- 常用聯絡人、報表、主題切換。
- NAS 連線設定與送印 payload。

如果某個改動需要暫時犧牲功能，必須先向使用者說明原因、風險與替代方案。

## 5. API 呼叫規則

NAS API 不可任意變更。

前端測試 NAS 連線使用：

```http
GET /ping
```

NAS 送印使用：

```http
POST /print
```

`POST /print` payload 必須維持：

```js
{
  kind,
  queue,
  widthMm,
  heightMm,
  format: 'image',
  images,
  ts
}
```

後端既有端點包含：

- `GET /ping`
- `GET /health`
- `POST /print`
- 舊版 `/api/*` 列印與預覽端點

規則：

- 前端不可直接存取 USB 印表機。
- 不硬編新的 NAS IP、密鑰、token 或外部服務 URL。
- NAS host、port、path、queue 必須走設定或環境變數。
- 不把 NAS 列印服務直接公開到網際網路。
- 若未來部署公開服務，外部使用者只應連雲端前端與資料庫，店內列印應由店內環境觸發或由 connector 拉取 queue。

## 6. 資料庫、登入與部署方向

目前前端仍以本機 demo data / store 為主。若未來開放外部使用者，建議路線如下：

- 前端：Cloudflare Pages 或 Vercel。
- 資料庫：Supabase PostgreSQL。
- 登入：Supabase Auth，優先支援 Email、Google、Facebook；LINE 可評估 OAuth/OIDC 串接。
- NAS 列印：維持店內區網，不直接對外開 port。

新增雲端資料庫或登入時要注意：

- 不在前端硬編 service role key、secret、OAuth secret。
- 資料表要先定義使用者、角色、店家、團購、訂單、商品、聯絡人、列印任務。
- 權限必須區分店家、團購主、訂購人。
- OAuth callback URL 要使用正式 HTTPS 網域。
- 不要把測試用 ngrok URL 寫死到程式碼。

## 7. 測試方式

### 文件修改

只修改文件時：

- 檢查 Markdown 結構完整。
- 不執行會改寫程式碼的 formatter 或 codegen。
- 確認沒有誤改其他檔案。

### Vue 前端

在 `frontend/` 執行：

```powershell
npm.cmd run build
npm.cmd run test:print
```

建議手動或瀏覽器驗證：

- `#/`
- `#/orderer`
- `#/organizer`
- `#/admin/dashboard`
- `#/admin/orders`
- `#/admin/products`
- `#/admin/ship`
- `#/admin/prep`
- `#/admin/prepboard`
- `#/admin/inventory`
- `#/admin/contacts`
- `#/admin/reports`
- `#/admin/settings`
- `#/admin/map`

主要流程至少抽測：

- 訂購人加商品、開購物車、送出成功。
- 團購主開新團、代訂、送單狀態。
- 店家訂單展開、個別訂購人編輯、整張團購單編輯。
- 商品新增/編輯、組合商品切換。
- 設定頁文件尺寸與 legacy localStorage key。
- 地圖篩選、起點設定、站點顯示。
- 出貨單、備料單、備貨清單、A4 訂單表預覽。

### 本機列印

本機列印應確認：

- `#printArea` 存在。
- `printHtmlPages()` 會寫入 `#printArea`。
- `@page` 尺寸與使用者設定一致。
- 實際列印若未測，回報時要明確說明。

### NAS 後端

在 `nas-print-service/` 可用以下方式啟動：

```powershell
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

或：

```powershell
docker compose up -d
```

至少檢查：

- `GET /ping`
- `GET /health`

若修改送印流程，需測試 `POST /print`，或明確回報未實測硬體與原因。

## 8. 修改完成後回報內容

每次完成修改後，回報應包含：

- 變更摘要。
- 修改檔案清單。
- 測試項目與結果。
- 未測試項目與原因。
- 是否修改 `index.html`。
- 是否修改 `nas-print-service/`。
- 可能風險、相容性注意事項或需要使用者手動驗證的地方。

若有執行 `git status --short`，請回報重點結果。

## 9. 工作原則

- 先讀現有程式碼，再修改。
- 優先延續既有架構與命名。
- 修改範圍要小而準，不做無關重構。
- 不覆蓋使用者未要求修改的檔案。
- 不使用 destructive git 指令。
- 遇到未追蹤或已修改檔案時，先判斷是否與任務相關，不任意還原。
- 對高風險修改要主動說明風險與測試結果。
- 任何涉及金流、個資、登入、公開部署、NAS 對外連線的改動，都要以安全為優先。
