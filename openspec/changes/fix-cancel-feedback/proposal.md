## Why
取消 API 可能回傳 cancelling；UI 卻立即宣稱工作與檔案清理已完成。

## What Changes
- 依 payload.job.status 區分取消中、已取消與未確認狀態。
- 不改取消 API、清理流程、登入或 Bridge 憑證。

## Capabilities
### New Capabilities
- `cancel-feedback`: 取消狀態提示。
### Modified Capabilities

## Impact
只修 UI 訊息與 synthetic 測試，queue truth 仍由 WCF 負責；回復可還原本切片，若需改 API 則停止。
