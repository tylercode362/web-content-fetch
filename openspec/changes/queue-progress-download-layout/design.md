# 設計

## 進度模型

`ui.js` 以 `progress.chapterTotal`、`progress.total`、`job.chapterCount` 的優先順序取得總章節數；已完成章節數使用 `progress.completed`。圖片下載階段的 `chapter` 與 `image` 只作為目前處理細節，不取代固定的章節進度。章節總數尚未取得時顯示 `-`，不得以圖片數假裝章節數。

進度條使用已完成章節／總章節比例。小說與漫畫共用相同顯示契約，完成、錯誤、暫停與恢復狀態仍由既有 job 狀態驅動。

漫畫在取得圖片時另外顯示目前章節下載進度，使用 `progress.image`／`progress.imageTotal` 計算第二條進度條；圖片完成後進入 EPUB 編排時顯示「圖片完成，正在產生檔案」，不提前增加已完成章節數。

Bridge callback 的 `assets_verified`／`asset_verified` 是單次 asset 或批次的觀測進度，不得覆蓋 WCF 的 job `progress.completed`／`progress.total`。WCF 將它保存為獨立的 `bridgeProgress`；批次進度顯示為目前章節的基準圖片數加上 callback 已完成數，Bridge 呼叫結束後清除該暫存觀測值。

## 版面

`.job-grid` 改為單欄流程，順序固定為進度、下載輸出、工作操作。`.outputs` 使用完整卡片寬度並位於進度下方，不使用右側欄分割線。章節輸出仍可在 job 的原生 `<details>` 內展開，連結文字保持可換行與同源下載行為。

## 相容性

只修改前端渲染與 stylesheet，不改變 API payload、輸出檔案、Bridge binding、SSE、CSRF 或既有 Threads／X／YouTube 功能。既有舊 job 若沒有 `chapterCount`，仍以持久化 progress 欄位顯示可取得的章節進度。
