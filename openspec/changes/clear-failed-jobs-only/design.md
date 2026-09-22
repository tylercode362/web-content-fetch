# Design: Clear failed and cancelled jobs only

UI 批次按鈕改為「清除失敗與取消紀錄」，呼叫 `POST /api/jobs/clear-failed`。伺服器保留 `POST /api/jobs/clear-terminal` 作為相容 route，但兩者都只選取 `job.status === 'error'` 或 `job.status === 'cancelled'`，逐一使用既有已驗證的刪除流程。

`complete`、`queued`、`running`、`paused` 與其他狀態不會被批次清理。單筆 `delete` endpoint 的明確操作不變，因此使用者仍可個別刪除成功的 job。

本變更不會刪除 named volume、其他 job 的檔案或執行中的工作；輸出、checkpoint 與 stage 的清理仍由既有 job-scoped deletion 驗證負責。
