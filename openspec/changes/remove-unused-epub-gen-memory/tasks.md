# 工作項目

- [x] 核對 main 基準、既有 dirty、writer、AGENTS 與專案 OpenSpec 規範，建立專用 worktree。
- [x] 靜態確認 `epub-gen-memory` 只出現在 manifest、lock 與依賴文件，產品及正式測試無載入。
- [x] 先記錄範圍、相容性、回復方式與負向要求。
- [x] 確認既有 Docker CLI／context；兩個本機 engine pipe 不存在，未啟動 daemon 或服務。
- [x] 以Dockerfile同一官方固定digest工具容器執行npm uninstall --package-lock-only --ignore-scripts --offline --no-audit --no-fund；Node22.22.1／npm10.9.4，exit0。
- [x] 靜態核對移除35個專屬套件、無新增；保留63個完整lock record、77條依賴邊均不變，缺失必要邊為0。
- [x] 更新docs/dependencies.md，產品／測試無修改或刪除；未產生node_modules。
- [ ] 使用既有 Docker 跑 EPUB／KEPUB 固定斷言與完整 `npm test`。
- [ ] 完成 Compose config、formatter、lint、typecheck、OpenSpec strict、dependency audit、secret/privacy scan，以及專案要求的 Docker build／healthcheck／Bridge binding／SSE reconnect／EPUB fixture 證據；未執行不得勾選。
- [x] OpenSpec準備分支已提交推送並核對遠端SHA（首版b40b57e）；環境狀態以正常後續提交保留。
- [ ] root review依賴／lock來源差異；正式驗收未完成，不合併main。
