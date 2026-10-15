## 資料流與信任邊界

Bridge 的 `readChapterPage` flow 完成事件已送出 `pages: Number(progress.iteration)`；直接 reader 結果則同時有頁數與圖片數，`completed` 可代表圖片數。WCF 原 callback 僅保留 phase、completed、total，導致 pages 在持久化 snapshot 前遺失。

本次只在既有 callback 保留 `chapter_images_read` 的非負整數 pages，再由原有 job snapshot／SSE 路徑傳給 UI。UI 不新增連線或事件記憶體，reconnect 仍使用既有 snapshot。所有文字仍經現有 textContent 路徑顯示，未新增 HTML 插入或憑證用途。

## 呈現與相容性

running 工作在 fetching_chapters、resuming、retrying 階段收到 chapter_images_read 時顯示「已讀取 N 頁」；無合法 pages 時顯示「讀取中」。不使用 total 計算頁數百分比，目前章節比例維持 0，不宣稱未知總數已完成。章節完成比例不變，writing_epub、圖片驗證與終止狀態沿用既有顯示。

## 不變事項及排除方案

不改 Bridge 協定版本、API 路由、授權、重試、冪等性、資源上限、lazy-load、next navigation、overlay 處理或缺圖失敗策略。舊 Bridge 事件可以不帶 pages，安全退回讀取中。排除以 completed 猜測頁數或以 total 當實際總頁數，因兩者都可能誤導使用者。
