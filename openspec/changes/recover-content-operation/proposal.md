# WCF 長操作恢復

## Why
同步 content.fetch 超過 HTTP headers timeout 後，舊瀏覽器操作仍執行；WCF 重送同 job key 時收到 conflict，無法取回原結果。

## What Changes
- WCF 以持久保存的 requestId、serverInstanceId 與本機 payload digest 追蹤每個邏輯步驟，短請求輪詢結果，保留 job 級 operationKey 供取消。
- 同邏輯請求重送返回原狀態／結果，不重複執行；內容不同則拒絕。
- 結果過期、Bridge instance 改變或舊操作未確認終止時停止自動重跑，保留 checkpoint。

## Impact
只改 WCF／Bridge Server 與合成測試；舊同步 API 保留。無新權限、TLS 或驗證放寬，不改站點 Flow 或 Extension。記憶體結果有數量、大小、期限上限；不記錄內容、網址、憑證或結果 bytes。回復舊程式須先停妥活動操作，不能當成安全恢復。部署、重啟、commit／push 未授權。單一 writer 使用本次隔離 worktree。
