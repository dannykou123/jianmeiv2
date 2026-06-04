# AGENTS.md

本文件是本專案給 Codex / AI agent 的工作規範。執行任何修改前，請先閱讀本文件，並以「保留既有流程、最小必要變更、明確回報結果」為原則。

## 1. 專案目的

本專案是「健美滷味」團購系統，主要用途包含：

- 提供單頁式前端介面，支援團購訂單、購物車、後台管理、主題切換、地圖與列印設定。
- 產生出貨單、備料單、A4 訂單表等列印內容，並支援本機瀏覽器列印。
- 透過 NAS 上的列印中介服務，將前端單據轉成圖片後送往感熱印表機，避免中文列印亂碼。

## 2. 主要檔案結構

```text
.
|-- index.html
`-- nas-print-service/
    |-- main.py
    |-- Dockerfile
    |-- docker-compose.yml
    |-- requirements.txt
    `-- README.md
```

- `index.html`：單檔前端，內含 HTML、CSS、JavaScript、UI、訂購、管理、列印、樣式選擇、NAS 連線設定與地圖相關邏輯。
- `nas-print-service/main.py`：FastAPI + Pillow 列印中介服務，接收前端圖片 payload，儲存列印圖片，轉成 TSPL/USB 列印資料並送往印表機。
- `nas-print-service/Dockerfile`：列印服務容器設定，包含 Python、Pillow 相關依賴與 Noto CJK 字型。
- `nas-print-service/docker-compose.yml`：NAS / Linux 部署設定，包含服務 port、USB 裝置掛載與環境變數。
- `nas-print-service/requirements.txt`：Python 套件版本。
- `nas-print-service/README.md`：列印服務啟動、部署與 API 說明。

## 3. 修改 HTML / CSS / JS 的限制

- `index.html` 目前是單檔式前端。除非使用者明確要求拆檔，否則不要任意拆分成多個 HTML、CSS 或 JS 檔。
- 保留 UTF-8 編碼與繁體中文內容。修改中文文字時，避免使用會造成亂碼的工具或終端輸出判讀方式。
- 不要任意改名或移除既有的 `id`、`class`、inline `onclick`、全域函式、`window.*` 匯出與 `localStorage` key，因為它們可能被畫面、設定、列印流程或使用者資料依賴。
- 修改 CSS 時，需確認桌面與行動版響應式版面仍可用，且文字、按鈕、卡片、彈窗與列印預覽不互相重疊。
- 修改列印相關區塊時，需特別保護：
  - `@media print`
  - `#printArea`
  - 出貨單、備料單、A4 訂單表版型
  - 單據尺寸 `DOC_W` / `DOC_H`
  - mm 與 px 換算
  - `html2canvas`
  - 本機列印與 NAS 列印分流
- 修改 JS 狀態或資料結構時，需確認訂購流程、購物車、後台資料、樣式選擇與本機儲存設定仍相容。
- 若新增外部 CDN、API、套件或瀏覽器權限，必須先確認必要性，並在回報中說明原因。

## 4. 不可破壞既有功能

任何修改都不得破壞下列既有功能：

- 訂購人點餐、數量調整、購物車、付款選項與送出流程。
- 後台管理、訂單列表、團購資料、商品資料與統計顯示。
- 出貨單、備料單、A4 訂單表、單張訂單、全部訂單與整團列印。
- 列印樣式選擇、列印預覽、續頁、多頁列印與尺寸設定。
- 本機列印模式與 NAS 感熱印表機模式。
- NAS 連線設定、測試連線、圖片轉換與送印流程。
- 主題切換、字級或畫面設定、地圖相關功能。

若修改可能影響上述任一功能，需先縮小變更範圍；完成後必須在回報中列出已驗證項目與未驗證風險。

## 5. API 呼叫規則

- 前端測試 NAS 連線時使用 `GET /ping`。
- 前端送往 NAS 感熱印表機時使用 `POST /print`。
- `POST /print` payload 需維持下列形狀，除非使用者明確要求同步修改前後端協定：

```json
{
  "kind": "ship | prep | order",
  "queue": "thermal-70x100",
  "widthMm": 70,
  "heightMm": 100,
  "format": "image",
  "images": ["data:image/png;base64,..."],
  "ts": 1710000000000
}
```

- 後端現有主要端點包含：
  - `GET /ping`
  - `GET /health`
  - `POST /print`
  - `POST /api/print-label`
  - `POST /api/preview-image`
  - `POST /api/preview-all`
  - `POST /api/print-stock`
  - `POST /api/preview-stock`
  - `POST /api/preview-stock-all`
- 前端不可直接存取 USB 印表機，必須透過 NAS / 後端中介服務。
- 不要硬編新的 NAS IP、密鑰、帳號、token 或外部服務位址。需要設定時，應沿用既有設定欄位或環境變數。
- 若調整 API request / response，必須同步更新前端呼叫、後端 schema、錯誤處理與測試方式。

## 6. 測試方式

依修改範圍選擇最小但足夠的測試：

- 文件或純說明修改：
  - 檢查 Markdown 結構與內容是否完整。
  - 確認沒有修改不相關檔案。
- 前端修改：
  - 直接開啟 `index.html`，確認主要畫面可載入。
  - 檢查瀏覽器 console 是否有錯誤。
  - 測試訂購、購物車、後台、樣式選擇、列印預覽與設定頁關鍵流程。
  - 若修改列印版型，至少測試本機列印預覽；若涉及 NAS，需測試 NAS 送印或回報未實測硬體。
- 後端修改：
  - 進入 `nas-print-service/`。
  - 安裝依賴：`pip install -r requirements.txt`。
  - 本機啟動：`uvicorn main:app --host 0.0.0.0 --port 8000`。
  - 或使用 Docker：`docker compose up -d`。
  - 至少檢查 `GET /ping` 與 `GET /health`。
  - 修改列印流程時，測試 `POST /print`，或清楚說明沒有實體印表機可驗證。

不得執行會改寫專案檔案的 formatter、codegen 或批次腳本，除非使用者明確要求。

## 7. 修改完成後要回報哪些內容

完成修改後，回報需包含：

- 變更摘要：簡短說明做了什麼。
- 修改檔案清單：列出實際新增或修改的檔案。
- 測試項目與結果：列出已執行的檢查或測試。
- 未測試項目與原因：例如沒有啟動後端、沒有實體印表機、沒有瀏覽器驗證。
- 風險與注意事項：列出可能需要使用者手動確認的相容性、硬體、部署或資料風險。

若只完成部分工作，必須明確說明尚未完成的項目與原因，不可假裝已完成。
