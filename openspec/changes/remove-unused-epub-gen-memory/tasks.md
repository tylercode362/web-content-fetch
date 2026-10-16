# 工作項目

- [x] 核對 main 基準、既有 dirty、writer、AGENTS 與專案 OpenSpec 規範，建立專用 worktree。
- [x] 靜態確認 `epub-gen-memory` 只出現在 manifest、lock 與依賴文件，產品及正式測試無載入。
- [x] 先記錄範圍、相容性、回復方式與負向要求。
- [x] 2026-10-16 前次環境診斷：確認既有 Docker CLI／context，當時兩個本機 engine pipe 不存在，該診斷階段未啟動 daemon 或服務；這是歷史狀態，其後已依使用者授權啟動 Docker Desktop。
- [x] 以Dockerfile同一官方固定digest工具容器執行npm uninstall --package-lock-only --ignore-scripts --offline --no-audit --no-fund；Node22.22.1／npm10.9.4，exit0。
- [x] 靜態核對移除35個專屬套件、無新增；保留63個完整lock record、77條非根套件依賴邊均不變，缺失必要邊為0；77條不包含根 manifest 的依賴宣告。
- [x] 更新docs/dependencies.md，產品／測試無修改或刪除；未產生node_modules。
- [ ] 使用既有 Docker 跑 EPUB／KEPUB 固定斷言與完整 `npm test`。
- [ ] 完成 Compose config、formatter、lint、typecheck、OpenSpec strict、dependency audit、secret/privacy scan，以及專案要求的 Docker build／healthcheck／Bridge binding／SSE reconnect／EPUB fixture 證據；未執行不得勾選。
- [x] OpenSpec準備分支已提交推送並核對遠端SHA（首版b40b57e）；環境狀態以正常後續提交保留。
- [x] root review 已完成候選 SHA `153bd1f314ebd757352ba32e1efb2546a4b976b1` 的依賴／lock 來源差異審查：移除集合僅含未使用套件及專屬閉包，共享套件未誤刪；63個保留 record 與77條非根套件依賴邊未變。此項為來源審查，不代表測試或正式驗收通過。
- [ ] 依使用者 2026-10-16 指示，清理完成後集中執行前列驗證；驗證門檻不變。正式驗收完成前不合併 main。
