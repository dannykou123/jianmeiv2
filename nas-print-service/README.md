# 健美滷味 NAS 列印微服務

接收前端傳來的 JSON 訂單資料，轉成 TSPL 指令送到 TSC 標籤機印出 75×100mm 出貨單。

---

## 標籤版面

```
┌─────────────────────────────┐  75mm
│ XX公司                       │  ← 公司名（大字）
│ 配送：2026-03-13             │  ← 配送日
├─────────────────────────────┤
│ 王小明　業務部        1/1    │  ← 姓名 部門 / 頁碼
│ 滷蛋          豆干           │  ← 品項（2 欄）
│ x2  $40       x1  $30      │
│                              │
│                   合計 $70  │  ← 右對齊合計
│ 備註：不要辣                  │
│──────────────────────────── │
│ #20260313-001           1/1 │  ← 訂單號 / 頁碼
└─────────────────────────────┘
                                 100mm
```

超過 10 項會自動分頁，合計與備註只印在最後一頁。

---

## 快速啟動（Docker，推薦部署在 NAS 上）

```bash
# 1. 在 NAS 上 clone 或上傳此資料夾
# 2. 修改 docker-compose.yml 中的 PRINTER_HOST
# 3. 啟動服務
docker compose up -d

# 查看 log
docker compose logs -f
```

服務啟動後監聽 `http://<NAS-IP>:8000`。

---

## 不用 Docker，直接用 Python 執行

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 設定

在 `main.py` 頂部或透過環境變數設定：

| 變數               | 說明                        | 預設值          |
|--------------------|-----------------------------|-----------------|
| `PRINTER_HOST`     | 印表機 IP 位址              | `192.168.1.100` |
| `PRINTER_PORT`     | TCP RAW port                | `9100`          |
| `PRINTER_ENCODING` | 字元編碼（`big5`/`utf-8`）  | `big5`          |

> **中文字型提示**：服務預設使用 TSC 機型內建的 `TSS24.BF2`（正體中文 24pt）和 `TSS16.BF2`（16pt）。
> 若印出亂碼，請確認你的機型支援的字型名稱，並修改 `main.py` 中的 `FONT_LARGE` / `FONT_MEDIUM` 常數。
> 常見替代：`TSSB24.BF2`（粗體）、`TST24.BF2`（簡體）。

---

## API 端點

### `POST /api/print-label`
列印一張出貨單。

**Request Body：**
```json
{
  "orderNo":    "20260313-001",
  "date":       "2026-03-13",
  "company":    "XX公司",
  "department": "業務部",
  "name":       "王小明",
  "items": [
    { "name": "滷蛋", "qty": 2, "price": 20 },
    { "name": "豆干", "qty": 1, "price": 30 }
  ],
  "remark": "不要辣",
  "total": 70
}
```

**Response（成功）：**
```json
{ "ok": true, "message": "已列印：王小明（20260313-001）" }
```

---

### `POST /api/preview-tspl`
回傳 TSPL 字串（不實際列印），用於除錯。

---

### `GET /health`
健康檢查。

```json
{ "status": "ok", "printer": "192.168.1.100:9100" }
```

---

## 前端對應設定

在 `index_NAS.html` 中找到：
```js
const NAS_PRINT_API_URL = 'http://your-nas-ip:port/api/print-label';
```
改成實際的 NAS IP 和 port，例如：
```js
const NAS_PRINT_API_URL = 'http://192.168.1.50:8000/api/print-label';
```
