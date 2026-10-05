## Context
取消執行中的 job 先回傳 cancelling，清理完成後才成為 cancelled。

## Goals / Non-Goals
訊息與 persisted job 狀態一致，不新增 UI 狀態機或改取消行為。

## Decisions
取消 handler 只在 payload.job.status 為 cancelled 時顯示完成；cancelling 顯示等待清理，其餘狀態顯示未確認，仍以 refresh 與 SSE 更新 job。

## Risks / Trade-offs
以 VM 執行實際 click listener，模擬 API 回傳；涵蓋 cancelling、cancelled 與非取消狀態，避免僅檢查字串。
