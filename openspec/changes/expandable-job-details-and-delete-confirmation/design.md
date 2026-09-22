# Design: Expandable job details and verified deletion feedback

## UI

`ui.js` 以原生 `<details data-job-id>` 包住每個 job 卡片，`<summary>` 顯示標題、網址與狀態；詳細內容包含進度、binding、錯誤、下載連結與操作按鈕。原生元件提供鍵盤與瀏覽器內建的開合語意。

每次 SSE 或 REST snapshot 重繪前，UI 收集目前開啟的 job id；重繪後只恢復仍存在的 job。刪除請求進行中以 job id 記錄 pending action，按鈕停用並顯示刪除中，避免重複請求。

## Delete contract

`DownloadOrchestrator.delete` 使用同一份受驗證的檔名集合處理 `job.outputs` 與 `job.outputGroups[*].files`，並刪除 checkpoint 與 stage。所有 `rm(..., force: true)` 完成後，逐一確認受管理路徑回傳 `ENOENT`；若任一檔案仍存在或路徑不安全，回傳 `job_delete_incomplete` 或路徑錯誤，且不移除 job map 中的記錄。

伺服器只有在刪除與驗證成功後才呼叫 `removeJob` 並發布 SSE snapshot，API 回傳 `{ deleted: true, jobId, removedOutputs }`。失敗回傳既有錯誤格式與 HTTP 422，讓 UI 保留該 job 並顯示診斷。

## Compatibility and safety

- 只處理指定 job 的 job-scoped 檔案，不執行全域清理，不刪除 named volume。
- `outputGroups` 與舊版扁平 `outputs` 合併去重；所有路徑仍必須位於 output root 且為 basename。
- 既有 `pause`、`resume`、`cancel`、SSE reconnect 與下載連結契約維持不變。
