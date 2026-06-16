# AGENTS.md

本文件是 `C:\Users\danny\Desktop\jianmeiv2` 專案給 Codex / AI agent 的工作規範。修改本專案時，請以「保留既有團購流程、避免破壞列印、避免破壞 NAS 送印、逐步提升可維護性」為最高原則。

## 1. 專案定位

本專案是「健美滷味團購系統」，目前主要由一個 legacy 單檔前端與一個 NAS 列印中介服務組成。

主要使用情境包含：

- 訂購人瀏覽商品、加入購物車、填寫付款方式、送出訂單與查看歷史。
- 團購主建立團購單、代訂、管理訂購人、送單、收回、追加訂單。
- 店家後台管理 dashboard、訂單、商品、庫存、聯絡人、報表與配送路線。
- 店家列印出貨單、備料單、備貨清單與團購訂單表。
- NAS 中介服務接收前端產生的圖片，轉成 TSPL / USB 感熱印表機可列印的資料。

目前工作區實際檔案狀態：

- 已存在：`index.html` legacy 單檔前端。
- 已存在：`nas-print-service/` FastAPI + Pillow + TSPL 列印服務。
- 已存在：`README.md`，目前內容很少。
- 尚未存在：`frontend/` Vue 3 + Vite SPA。若未來建立，請依本文件第 7 節的遷移規範處理。

## 2. 目前檔案結構

```text
.
|-- AGENTS.md
|-- README.md
|-- index.html
`-- nas-print-service/
    |-- Dockerfile
    |-- README.md
    |-- docker-compose.yml
    |-- main.py
    `-- requirements.txt
```

重要檔案說明：

- `index.html`：目前的主系統。這是 legacy 單檔 HTML，包含 HTML、CSS、JavaScript、demo data、UI、訂購、後台、列印、NAS 送印與地圖邏輯。
- `nas-print-service/main.py`：FastAPI 列印中介服務。包含 `/ping`、`/health`、`/print`，以及舊版 `/api/*` 列印與預覽端點。
- `nas-print-service/Dockerfile`：Python 3.11 slim 映像，安裝 Noto CJK 字型、Pillow 所需依賴與 Python 套件。
- `nas-print-service/docker-compose.yml`：NAS 部署設定，會掛載 `/dev/usb/lp0` 並以 root / privileged 模式操作 USB 印表機。
- `nas-print-service/requirements.txt`：FastAPI、uvicorn、pydantic、Pillow 版本。
- `nas-print-service/README.md`：NAS 服務使用說明，但目前部分文字有亂碼或與現行 `/print` 圖片 payload 不完全一致，修改時要先對照 `main.py`。

## 3. 已觀察到的架構重點

`index.html` 中目前可辨識的主要區塊：

- 入口頁：`#entry`
- 店家後台：`#admin`
- 訂購人頁：`#orderer`
- 團購主頁：`#organizer`
- 後台導覽：`#adminNav`
- 商品列表：`#prodList`
- 地圖：`#mapCanvas`
- 列印預覽：`#printPreview`、`#ppvBody`
- 實際列印容器：`#printArea`
- NAS 設定卡：`#nasCard`

`index.html` 目前直接使用 CDN：

- `html2canvas`：將列印 HTML 轉成圖片，供 NAS 圖片送印使用。
- `Leaflet`：後台配送地圖與站點路線。
- Google Fonts：Noto Sans TC、Noto Serif TC、Cormorant Garamond、DM Mono、Bebas Neue。

`index.html` 目前包含大量 inline `onclick` 與 `window.*` 匯出。除非正在做遷移或重構，不要任意移除這些入口，因為它們很可能是既有 UI 行為的一部分。

目前已觀察到的 localStorage key：

- `jm_docSize`
- `jm_shipStyle`
- `jm_prepStyle`

若未來新增列印模式或 NAS 設定持久化，優先沿用或相容下列建議 key，不要任意新增多套名稱：

- `jm_printMode`
- `jm_nasConfig`

## 4. 一般工作原則

- 先讀現有程式碼，再修改。
- 修改範圍要小而準，不做無關重構。
- 優先維持既有操作流程、視覺密度與資料格式。
- 不要覆蓋使用者未要求修改的檔案。
- 不要使用 destructive git 指令，例如 `git reset --hard`、`git checkout -- <file>`。
- 若看到未追蹤或已修改檔案，先判斷是否與任務有關，不任意還原。
- 如果變更會影響列印、送印、訂單資料或 NAS 連線，要主動說明風險與測試結果。
- 涉及金流、個資、登入、公開部署、NAS 對外連線時，一律以安全為優先。

### 階段性 Git Push

每次開發到一個可驗證、可回復的階段，都要協助使用者整理變更並 push 到 GitHub，避免重要進度只留在本機。

Git push 規則：

- 不要把未驗證的半成品直接 push。
- push 前先執行與變更範圍相符的測試或檢查；若無法測試，要在回報中明確說明原因。
- push 前先執行 `git status --short`，確認只包含本次任務相關變更。
- commit 前不要把使用者未要求、與任務無關的修改一起 staging。
- commit message 要簡短描述本階段成果，例如 `docs: update agent workflow`、`fix: keep print settings stable`。
- push 目標通常使用目前分支與 `origin`，除非使用者指定其他 remote 或 branch。
- push 完成後，回報 branch、commit 摘要、push 結果與剩餘未提交檔案。
- 若 push 失敗，回報錯誤原因，不要改用 destructive git 指令處理。

### 功能單位與回歸保護

每次修改網頁上的任何小功能，都要把它視為可能影響其他功能的變更來處理。不要只確認被修改的按鈕或畫面能用，也要確認相鄰流程、共用狀態、共用 DOM、共用列印模板與共用資料格式沒有被破壞。

前端改動必須遵守：

- 修改前先定位該功能依賴的資料來源、render function、事件 handler、DOM id/class、localStorage key 與 `window.*` 匯出。
- 不任意改變函式簽名、資料欄位名稱、狀態值、訂單物件結構、商品物件結構、列印 payload 或 NAS payload。
- 若抽出共用函式，要確認所有呼叫端的輸入、輸出與錯誤處理仍一致。
- 若修改 CSS，要確認不會影響其他畫面共用 class，特別是 `.btn`、`.card`、`.order`、`.li`、列印相關 class 與響應式版面。
- 若修改某一個管理分頁，要至少抽測同一資料來源會影響的其他分頁。例如訂單資料會同時影響 dashboard、訂單列表、報表、地圖、出貨單與備料單。
- 若修改商品、庫存或組合商品邏輯，要同步檢查訂購人頁、團購主代訂、快速新增訂單、出貨單、備料單與備貨清單。
- 若修改列印模式、文件尺寸或樣式選擇，要同步檢查本機列印、NAS 送印、列印預覽與 localStorage 相容性。
- 若無法完整手動測試所有相關流程，回報時要明確列出已測項目、未測項目與剩餘風險。

## 5. 編碼與文字注意事項

本專案部分檔案目前含有亂碼註解或歷史文字，尤其是 `AGENTS.md` 舊內容、`nas-print-service/README.md`、`nas-print-service/main.py` 註解與部分 `index.html` 文字。

處理規則：

- 新增或重寫文件時使用 UTF-8。
- 不要為了「順手整理」對整個 `index.html` 或 `main.py` 做大規模轉碼、格式化或文字替換。
- 若需要修正亂碼，請只修正使用者要求的區塊，並先確認該文字是否會顯示在 UI、列印成品或 API 回應中。
- 不要改動看似亂碼但可能與既有畫面、測試資料或列印版面相依的字串，除非已確認影響範圍。

## 6. Legacy `index.html` 修改規範

除非使用者明確要求，不要修改根目錄 `index.html`。

如果必須修改：

- 保留單檔架構，不拆檔，除非使用者明確要求遷移。
- 保留 `<meta charset="UTF-8">`。
- 保留繁體中文 UI 與既有互動語意。
- 不任意改名或移除既有 `id`、`class`、inline `onclick`、`window.*` 匯出。
- 不任意改動 demo data 結構，例如 `TEAMS`、`ORDERS`、`PRODUCTS`、`PREP_ORDERS` 等既有資料形狀。
- 不任意改動 `localStorage` key。
- 不任意改動 `#printArea`、`#printPreview`、`#ppvBody`、`@media print`、`@page`、mm / px 換算、`html2canvas` 渲染與 NAS 送印流程。
- 若新增 UI，要維持管理工具的密度與可掃描性，不要改成 landing page 或行銷頁。
- 若新增外部資源，避免硬編敏感資訊、私有 URL、token、NAS IP 或第三方服務密鑰。

高風險區塊：

- 列印樣式與列印模板。
- `renderToImage()`、`sendToNas()`、`testNasConn()`、`nasBaseUrl()`。
- `printMode` 與本機 / NAS 切換。
- 訂單新增、代訂、送單、收回、追加訂單。
- 商品新增 / 編輯 / 組合商品。
- 庫存與安全庫存。
- 地圖站點、起點與 Google Maps 導航連結。

## 7. 未來 `frontend/` 遷移規範

目前 `frontend/` 尚未存在。若使用者要求新增或繼續 Vue 遷移，請優先建立在 `frontend/`，並保留根目錄 `index.html` 作為 fallback。

建議目標結構：

```text
frontend/
|-- package.json
|-- src/
|   |-- main.js
|   |-- App.vue
|   |-- router/
|   |-- views/
|   |-- components/
|   |-- stores/
|   |-- services/
|   |-- print/
|   |-- data/
|   `-- styles/
`-- scripts/
```

Vue 遷移原則：

- 使用 Vue 3 + Vite + Pinia + Vue Router。
- 使用 hash history，避免靜態部署時需要 server rewrite。
- 優先使用 component、Pinia store、service module，不再新增 inline `onclick`。
- 保留與 legacy 相容的重要 DOM 錨點，例如 `#printArea`、`#printPreview`、`#ppvBody`、`#ordersPanel`、`#prodList`、`#mapCanvas`。
- 路由建議維持：
  - `#/`
  - `#/admin/:view?`
  - `#/orderer`
  - `#/organizer/:teamId?`
- 保留或遷移相容 localStorage key：
  - `jm_docSize`
  - `jm_shipStyle`
  - `jm_prepStyle`
  - `jm_printMode`
  - `jm_nasConfig`
- 不新增大型 CSS 框架、狀態管理工具或 UI 系統，除非使用者明確要求且有充分理由。

## 8. 列印相關規範

列印是本專案最高風險區之一。修改前要先確認影響範圍。

不可隨意改動：

- 出貨單模板。
- 備料單模板。
- 備貨清單模板。
- A4 訂單表模板。
- `#printArea`。
- `#printPreview`。
- `#ppvBody`。
- `@media print`。
- `@page` 尺寸設定。
- mm / px / DPI 換算。
- `html2canvas` 圖片渲染流程。
- 本機列印與 NAS 列印共用的 HTML pages。

若修改列印模板或樣式：

- 先確認本機列印流程仍會將內容寫入 `#printArea`。
- 確認 `@page` 尺寸會跟使用者設定同步。
- 確認 NAS 模式仍能使用 `html2canvas` 產出 PNG data URL。
- 若 `frontend/` 已存在且有測試腳本，至少執行：

```powershell
npm.cmd run build
npm.cmd run test:print
```

- 若目前仍只有 `index.html`，需至少以瀏覽器手動檢查列印預覽與本機列印對話框；若無法實測硬體或瀏覽器，回報時要明確說明。

## 9. NAS API 與列印中介服務

NAS API 不可任意變更。

前端測試 NAS 連線使用：

```http
GET /ping
```

NAS 圖片送印使用：

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

`nas-print-service/main.py` 目前支援：

- `GET /ping`
- `GET /health`
- `POST /print`
- `POST /api/print-label`
- `POST /api/preview-image`
- `POST /api/preview-all`
- `POST /api/print-stock`
- `POST /api/preview-stock`
- `POST /api/preview-stock-all`

NAS 服務規則：

- 前端不可直接存取 USB 印表機。
- 不硬編新的 NAS IP、密鑰、token 或外部服務 URL。
- NAS host、port、path、queue 必須走 UI 設定或環境變數。
- 不把 NAS 列印服務直接公開到網際網路。
- 如果未來部署公開服務，外部使用者只應連雲端前端與資料庫；店內列印應由店內環境觸發，或由店內 connector 拉取 queue。
- `/print` 必須驗證 `kind`、`queue`、`widthMm`、`heightMm`、`format`、`images`。
- `images` 應維持 PNG data URL；不要改成任意遠端 URL，以免引入 SSRF 或內網探測風險。
- `MAX_PRINT_UPLOAD_BYTES` 是重要保護，不要移除。

NAS 服務啟動方式：

```powershell
cd nas-print-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

或：

```powershell
cd nas-print-service
docker compose up -d
```

至少檢查：

- `GET /ping`
- `GET /health`

若修改送印流程，需測試 `POST /print`，或明確回報未實測硬體與原因。

## 10. 不可破壞的既有功能

任何修改都不得破壞下列流程：

- 訂購人下單、購物車、付款方式、送出成功提示。
- 團購主開團、代訂、送單、收回、追加訂單。
- 店家 dashboard、訂單列表、訂單編輯、狀態切換、批次操作。
- 商品管理、組合商品、庫存、安全庫存。
- 出貨單、備料單、備貨清單、A4 訂單表預覽與列印。
- 列印樣式選擇、樣式預覽、legacy style key 相容。
- 設定頁、本機 / NAS 列印模式、文件尺寸設定。
- 地圖配送路線、起點設定、站點排序、Google Maps 導航連結。
- 常用聯絡人、報表、主題切換。
- NAS 連線設定與送印 payload。

如果某個改動需要暫時犧牲功能，必須先向使用者說明原因、風險與替代方案。

## 11. 資料庫、登入與部署方向

目前前端仍以本機 demo data / 單檔狀態為主。若未來開放外部使用者，建議方向如下：

- 前端：Cloudflare Pages、Vercel 或 Netlify。
- 資料庫：Supabase PostgreSQL。
- 登入：Supabase Auth，優先支援 Email、Google、Facebook；LINE 可評估 OAuth / OIDC 串接。
- NAS 列印：維持店內區網，不直接對外開 port。

新增雲端資料庫或登入時要注意：

- 不在前端硬編 service role key、secret、OAuth secret。
- 資料表要先定義使用者、角色、店家、團購、訂單、商品、聯絡人、列印任務。
- 權限必須區分店家、團購主、訂購人。
- OAuth callback URL 要使用正式 HTTPS 網域。
- 不要把測試用 ngrok URL 寫死到程式碼。

## 12. 測試與驗證

只修改文件時：

- 檢查 Markdown 結構完整。
- 不執行會改寫程式碼的 formatter 或 codegen。
- 確認沒有誤改其他檔案。

修改 `index.html` 時，依影響範圍抽測：

- 入口頁三種角色是否能進入。
- 訂購人商品選擇、購物車、送出訂單。
- 團購主新增團購、代訂、送單狀態。
- 店家訂單展開、個別訂購人編輯、整張團購單編輯。
- 商品新增 / 編輯、組合商品切換。
- 設定頁文件尺寸、本機 / NAS 列印模式。
- 地圖篩選、起點設定、站點顯示。
- 出貨單、備料單、備貨清單、A4 訂單表預覽。

修改 NAS 服務時：

- 檢查 Python 語法。
- 啟動服務。
- 測試 `GET /ping`。
- 測試 `GET /health`。
- 若涉及送印，測試 `POST /print` 或明確說明未測原因。

建議指令：

```powershell
python -m py_compile nas-print-service\main.py
```

如環境可用：

```powershell
cd nas-print-service
uvicorn main:app --host 127.0.0.1 --port 8000
```

## 13. 修改完成後回報格式

完成修改後，回報應包含：

- 變更摘要。
- 修改檔案清單。
- 測試項目與結果。
- 未測試項目與原因。
- 是否修改 `index.html`。
- 是否修改 `nas-print-service/`。
- 可能風險、相容性注意事項或需要使用者手動驗證的地方。
- 若有執行 `git status --short`，回報重點結果。

回報範例：

```text
變更摘要：
- 重寫 AGENTS.md，補上目前資料夾盤點、legacy index.html 規範、NAS API 規範與測試方式。

修改檔案：
- AGENTS.md

測試：
- 已檢查 Markdown 結構。
- 已執行 git status --short。

未測試：
- 未啟動前端或 NAS，因本次只修改文件。

影響：
- 未修改 index.html。
- 未修改 nas-print-service/。
```

## 14. 給未來代理人的快速判斷

如果任務是文件更新：

- 通常只改 `AGENTS.md`、`README.md` 或 `nas-print-service/README.md`。
- 不要觸碰 `index.html` 或 `main.py`。

如果任務是 UI 或功能修正：

- 目前優先讀 `index.html`。
- 先定位對應畫面、狀態資料、render function、事件 handler，再修改。
- 修改後做手動流程驗證。

如果任務是列印：

- 先定位本機列印與 NAS 列印是否共用同一段 HTML。
- 優先保持 HTML 尺寸、CSS、mm 單位與 `html2canvas` 行為穩定。
- 回報中一定要說明本機列印與 NAS 是否實測。

如果任務是 NAS：

- 先讀 `nas-print-service/main.py`。
- 保持 `/print` 圖片 payload 相容。
- 不要讓服務直接暴露到公網。
- 回報中一定要說明 `/ping`、`/health`、`/print` 測試情況。
