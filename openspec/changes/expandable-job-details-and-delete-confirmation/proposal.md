# Proposal: Expandable job details and verified deletion feedback

目前工作卡片雖然已經顯示進度與下載連結，但細節區域沒有原生的展開／收合控制；刪除工作後，UI 也要等下一次狀態刷新才反映，且刪除流程未統一涵蓋 `outputs` 與 `outputGroups`。

本變更讓每個 job 使用可存取的原生 `<details>`／`<summary>`，在 SSE 重繪時保留使用者的展開狀態；刪除操作在伺服器完成並驗證檔案移除後才回報成功，前端同步顯示刪除中、立即移除已確認刪除的卡片，失敗時保留工作並顯示可診斷錯誤。

## Scope

- 可展開／收合的 job 詳情與 SSE 重繪後狀態保留。
- 刪除已結束 job 時，同時清理 checkpoint、stage、`outputs` 與 `outputGroups`。
- 刪除後驗證受管理檔案不存在；驗證失敗不得移除 job 記錄。
- 刪除 API 回傳明確的 `deleted`、`jobId` 與清理數量，UI 顯示成功或錯誤結果。

不改變 Chrome Bridge protocol、既有佇列排程、小說／漫畫輸出格式或 Threads／X／YouTube 功能。
