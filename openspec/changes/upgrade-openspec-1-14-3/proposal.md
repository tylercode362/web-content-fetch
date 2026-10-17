## Why

使用者於 2026-10-17 13:06 UTC 要求「全部你直接幫我升級」，將各專案的 OpenSpec 工具統一至官方 1.14.3。此版修正 glob／symlink 邊界及驗證掛起，並移除涉及 GHSA-vfj7-8cjw-p6xm 的 braces 依賴。

## What Changes

- 只更新既有 Dockerfile tools 階段的 OpenSpec 精確版本，補版本與正式階段隔離測試及相依工具文件。
- KEEP：產品功能、UI、API、認證、資料、正式執行期與部署設定。
- ADAPT：既有開發工具入口與版本檢查。
- DEFER：正式映像實測與部署；本次環境沒有 Docker。
- REMOVE：無；不刪除歷史證據或批次重產 AI 技能。

## Capabilities

### New Capabilities
- openspec-toolchain: 固定工具版本並維持正式執行期隔離。

### Modified Capabilities

無。

## Impact

僅影響開發驗證工具，無產品相容性或私人資料傳送變更。來源為官方 npm 與 GitHub release；不新增執行期套件。回復方式為還原本次工具版本及必要鎖檔。遇到來源、完整性、授權或平台權限拒絕即停止受影響操作。

