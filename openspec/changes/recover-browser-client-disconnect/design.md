# 設計

`DownloadOrchestrator.callWithRetry` 將 `browser_client_disconnected`、
`browser_client_offline`、Bridge transport、命令逾時與瀏覽器導覽逾時視為暫時錯誤，
沿用既有的有限次數重試。每次 content.fetch 是可重新執行的獨立操作；工作仍透過
固定 binding 呼叫同一個 Bridge，不改變 service 或 browser 身分。

BridgeClient 的 HTTP 層會將非取消性的 Node fetch 網路例外（例如 Bridge 容器停止時
原生拋出的 `TypeError: fetch failed`）正規化為 `bridge_transport_failed`，讓它沿用
同一組有限重試與恢復診斷；AbortError 必須原樣保留，避免把使用者的暫停或取消誤判成
傳輸故障。

若重試耗盡，`run` 不刪除 job checkpoint／staging，而是保存目前進度、診斷碼並轉成
`paused`。漫畫會從最後一個完整章節 checkpoint 繼續；若斷線發生在章節中間，該章
會重新取得，避免把不完整圖片序列視為可用 checkpoint。小說同樣只跳過已驗證完成的章節。

`resume` 只對明確的可恢復診斷開放；完成或取消的工作仍不可恢復，非暫時性內容／圖片
錯誤也不會被誤轉成可恢復工作。UI 顯示恢復按鈕，但不會自動改變 binding 或重新配對。
