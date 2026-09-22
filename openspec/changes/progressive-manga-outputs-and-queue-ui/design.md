# 設計

## 漫畫輸出生命週期

每個漫畫章節／卷完成圖片取得與 EPUB writer 驗證後，編排器立即將該章的原始 EPUB 與 KEPUB 從 job stage 發布到 output root，並以 `outputGroups` 保存章節索引、標題與檔案名稱。`publicJob` 即時回傳目前已發布的群組，所以 SSE 更新後不必等待整部作品完成。

章節 checkpoint 改保存已發布檔案名稱。恢復時先驗證該章所有檔案仍存在，存在就跳過重新下載；缺檔才回到該章重新處理。工作完成後只清除 checkpoint 與暫存，不刪除已發布輸出。

取消工作仍是破壞性操作：刪除 checkpoint、job stage 與該工作已發布的輸出。非取消的錯誤保留已完成章節與 checkpoint，讓使用者可恢復或稍後清除。

## Component flow and boundaries

`ui.js → Web Content Fetch API／同源 SSE → DownloadOrchestrator → secure chrome-bridge content.fetch → 章節／next evidence → Web Content Fetch asset stage → EPUB writer → output root`。Web Content Fetch 擁有 queue、job truth、checkpoint、輸出與清理；Chrome Bridge 只擁有真實 Chrome tab 生命週期、網站規則與圖片 evidence。Bridge protocol 維持既有 additive `content.fetch` contract，不升級既有 Threads／X／YouTube contract；不支援的網站仍由既有 `unsupported_url`／generic 行為處理。

Pairing service credential、browser session、job callback token、asset bytes 與輸出檔案分離保存。UI 只顯示 binding 識別資訊，不顯示 credential、配對碼或原始頁面內容。漫畫章節由清單中的單一章節 URL 定義；該 URL 的 next／下一頁導覽與 lazy-load 圖片仍由 Bridge 在真實 Chrome 中取得，overlay／廣告節點不進入 evidence；若圖片 evidence 或 bytes 不完整則該章 fail-closed，不發布半成品。

所有章節、頁面、圖片、EPUB、ZIP 與重試仍受既有 bounded budgets 限制；發布與 checkpoint 使用 job／章節索引冪等更新，重試不重複加入 output group。SSE reconnect 重新讀取 persisted `/api/state` snapshot，不依賴遺失的記憶體事件。

## 全部下載

`GET /api/jobs/{id}/download-all` 只讀取該 job 已驗證且已發布的 EPUB／KEPUB，使用 JSZip 的 node stream 產生同源 ZIP；不把 ZIP 當成 job output，避免清理時留下衍生檔案。不存在可下載檔案時回傳 404。

## 工作紀錄清理

`POST /api/jobs/clear-terminal` 只處理 `complete`、`error`、`cancelled` 工作，逐一呼叫既有安全刪除流程，連同 job 記錄、輸出、checkpoint 與 stage 一起移除。執行中、排隊中、暫停中工作不受影響。

## Failure modes and rejected alternatives

- 檔案缺失、路徑穿越、非 EPUB／KEPUB 或超過單檔上限時，下載回應 fail-closed。
- ZIP 只包含該 job 的已驗證輸出；不接受任意檔名或任意 output path。
- 取消會刪除該 job 已發布檔案；可恢復錯誤保留 checkpoint 與已完成章節。
- 不採用前端一次觸發多個下載，因瀏覽器會阻擋多檔案下載且無法表示章節群組；改用同源串流 ZIP。
- 不把逐章 EPUB 搬到 Chrome Bridge；這會重複輸出責任並破壞既有 Bridge 服務邊界。

## UI

保留既有同源 SSE、CSRF、配對與工作操作 API，將內嵌單行 UI 拆成 `ui.css`／`ui.js`：

- 顯示 Bridge 連線、佇列統計與清理已結束紀錄入口。
- 每個 job 顯示作品名稱、來源網址、狀態徽章、可讀進度、binding 與錯誤診斷。
- 漫畫輸出依章節／卷分組，提供單章 EPUB／KEPUB 與「下載全部」ZIP。
- 保留暫停、恢復、取消並刪除，以及可恢復 Bridge 錯誤的恢復按鈕。
- 所有外部文字以 textContent 顯示；來源網址只接受 http／https；不把 token、配對碼或 credential 寫入 log。
