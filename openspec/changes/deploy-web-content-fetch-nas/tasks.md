# Tasks

- [x] 新增 NAS Compose overlay
- [x] 新增 WCF NAS 部署腳本與遠端 helper
- [x] 支援首次部署明確初始化遠端 `.env`，並保留既有 NAS `.env`
- [x] 驗證 Compose 設定與 shell syntax
- [x] 將 Gateway callback 正規化為 WCF Docker 網路位址，限制 Gateway origin
- [x] 保留既有 host-gateway callback allowlist，避免重啟載入舊設定失敗
- [x] 執行 callback URL 自動化測試與部署設定回歸
- [ ] 執行容器健康檢查（需完成 NAS 部署後驗證）
