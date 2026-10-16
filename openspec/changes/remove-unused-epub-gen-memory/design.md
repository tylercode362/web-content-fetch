# 依賴清理設計

## 行為與信任邊界

既有 `epub-writer.js` 的小說／漫畫輸出、`jszip` ZIP 組裝、`sanitize-html` 清理、`sharp` 圖片處理，以及固定 kepubify binary 均維持不變。套件名稱只用於套件管理，不成為外部輸入或新執行入口。

## 變更方式

1. 以既有核准工具及官方 npm CLI 執行 `npm uninstall epub-gen-memory --package-lock-only --ignore-scripts --no-audit --no-fund`，不執行依賴 lifecycle。
2. 比較前後 root dependencies、lock packages 與各套件的依賴解析。只允許移除目標及其專屬閉包；共享套件、未移除套件版本／來源／integrity 及既有 optional 平台依賴均保留。
3. 依實際結果刪除 `docs/dependencies.md` 的保留依賴列，不修改 runtime、UI、容器邊界或其他依賴政策。
4. 使用既有 Docker 的隔離候選環境重裝依賴，跑 EPUB／KEPUB 固定斷言、完整正式測試及專案要求的品質檢查。不得操作既有服務或真實 state／output。

## 驗證與失敗處理

Docker 必須使用既有固定 image／Dockerfile 邊界，不掛載 Docker socket 或認證。不能以目前宿主機套件、跳過 KEPUB、偽造 audit 結果或刪減測試取代驗證。Docker engine 不可用時，不自行啟動可能連帶恢復應用的服務；保留準備成果並列出未驗項。

初次準備時兩個本機Docker engine pipe不存在；之後使用者授權啟動Docker Desktop，engine已可用，Client／Server為29.7.2。本次只讀確認WCF Dockerfile固定的官方 `node:22.22.1-bookworm-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d` 不在本機，對應 `node:22.22.1*` tag亦無結果。未pull替代image、未執行npm工具容器；manifest／lock仍未變更。既有宿主runtime仍無npm CLI，不手寫lock或換pnpm格式。產品回歸、build、healthcheck及部署皆未執行。
