# Proposal: Deploy Web Content Fetch with the NAS Bridge stack

提供 WCF 專用的 NAS 部署腳本與 Compose overlay，讓 WCF、Chrome Bridge 與
Local Gateway 在同一台 NAS 上透過固定 Docker network 通訊。

## 目標

- WCF 使用 http://nas-bridge:8788 呼叫 NAS Bridge。
- Bridge callback 使用 Docker network 內的 `http://web-content-fetch:8092/api/bridge/callback`。
- 接受設定過的 Gateway callback 路徑，並正規化為 Docker network 內部位址。
- 保留 named volume、既有 NAS `.env` 與既有輸出；首次部署可由明確的
  `-InitializeRemoteConfig` 傳送被忽略的本機 `.env`，不把它放入封裝。
  不上傳 exports 或 secrets。
- 部署後驗證 WCF 本機 healthz 與 Gateway 代理 healthz。
