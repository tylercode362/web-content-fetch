## Why

治理文件將短期 CSRF token 誤稱為登入 session，並將容器內 binding 誤寫為 host loopback；需要對齊 LAN 自用 POC 的現況。

## What Changes

- 釐清 UI 不另設登入，異動仍檢查 exact Origin 與有效 CSRF token。
- 釐清 Compose 無 host port，Gateway 經既有 Docker 網路轉送。
- 範圍僅限文件；不新增帳密、不改 runtime、Bridge 協定或憑證隔離，無相容性與隱私行為變更。
- 回復方式為還原本次文件差異；若需改 runtime 或 live 設定，停止並交回父任務。

## Capabilities

### New Capabilities
- `lan-poc-boundaries`: LAN UI 與容器網路邊界的文件契約。

### Modified Capabilities

## Impact

僅更新 AGENTS.md 與 openspec/config.yaml；queue 與 EPUB 仍由 WCF 負責。
