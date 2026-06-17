# jianmeiv2

## Playwright 自動化瀏覽器測試

本專案使用 Playwright 做正式的前端操作與截圖驗證。測試目標目前是 standalone HTML：

```text
健美滷味_團購系統_優化版_修正版.html
```

第一次使用請先安裝 npm 依賴與 Chromium：

```powershell
npm.cmd install
npm.cmd run test:ui:install
```

日常回歸測試：

```powershell
npm.cmd run test:ui
```

打開瀏覽器看自動操作過程：

```powershell
npm.cmd run test:ui:headed
```

目前涵蓋的訂購人流程：

- 桌機寬度：進入訂購人頁面、確認商品卡最多兩欄、產生截圖。
- 手機寬度：確認商品卡一欄、底部送出列可見、產生截圖。
- 操作流程：填寫訂購人、加入商品、開啟「最後確認你的訂單」、送出並看到成功畫面。

測試截圖、trace、video 會輸出到 `test-results/`，此資料夾不納入 Git。
