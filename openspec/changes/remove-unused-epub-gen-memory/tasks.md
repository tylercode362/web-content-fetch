# 工作項目

- [x] 核對 main 基準、既有 dirty、writer、AGENTS 與專案 OpenSpec 規範，建立專用 worktree。
- [x] 靜態確認 `epub-gen-memory` 只出現在 manifest、lock 與依賴文件，產品及正式測試無載入。
- [x] 先記錄範圍、相容性、回復方式與負向要求。
- [x] 確認既有 Docker CLI／context；兩個本機 engine pipe 不存在，未啟動 daemon 或服務。
- [ ] 使用既有核准的官方 npm 工具移除依賴並重新產生 npm lock；目前 npm CLI 未找到、Docker engine 不可用。
- [ ] 驗證共享依賴保留、未移除套件版本／integrity 不變，沒有 package manager 遷移或 lifecycle 執行。
- [ ] 依實際 npm 結果更新 `docs/dependencies.md`，確認沒有 runtime 修改及測試刪除。
- [ ] 使用既有 Docker 跑 EPUB／KEPUB 固定斷言與完整 `npm test`。
- [ ] 完成 Compose config、formatter、lint、typecheck、OpenSpec strict、dependency audit、secret/privacy scan，以及專案要求的 Docker build／healthcheck／Bridge binding／SSE reconnect／EPUB fixture 證據；未執行不得勾選。
- [ ] 工作分支提交、推送與遠端 SHA 核對，交 root review；不自行合併 main。
