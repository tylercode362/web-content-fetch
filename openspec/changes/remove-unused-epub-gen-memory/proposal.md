# 移除未使用的 epub-gen-memory

## 本次要求與驗證安排

本變更源自使用者於 2026-10-16 要求清理 D:\projects 各專案已確認不必要的追蹤內容與依賴；本次明確範圍為移除未使用的 epub-gen-memory。使用者另要求先完成清理，再集中執行產品與正式容器驗證；這是執行順序調整，沒有降低品質門檻。未執行的測試、掃描與正式驗收保持待辦，不得視為通過，也不據此合併 main。

## 範圍

目前只有 `package.json`、`package-lock.json` 與 `docs/dependencies.md` 提到 `epub-gen-memory`；產品與正式測試沒有載入它。實際 EPUB writer 直接使用 `jszip`、`sanitize-html` 與 `sharp`。本次以官方 npm 工具移除這個直接依賴及其專屬間接依賴，保留其他直接依賴仍需使用的套件、版本與 integrity，並更新依賴用途文件。

## 非目標

- 不更換 EPUB writer、不調整 EPUB／KEPUB 輸出、不刪除必要測試或 fixture。
- 不變更 Bridge protocol、配對、queue、state、下載輸出或部署設定。
- 不新增套件管理器、不改用 pnpm lock、不在本機安裝新的非 Docker 環境。
- 不部署、不啟動或重啟既有應用服務，也不合併 main。

## 隱私與相容性

只處理公開套件依賴；驗證使用既有 synthetic fixture，不讀取真實使用者資料或認證。移除未載入的套件不應改變 API、章節順序、清理規則、圖片尺寸、EPUB 或 KEPUB 結果。

## 回復與停止條件

工作以 `3a3e4a0029ad24bd89ea8e44ae474f0a7e612094` 為基準，在獨立分支進行。若 npm 重新選取無關套件版本、移除共享依賴、回歸失敗或環境拒絕，保留差異及實際證據，停止受影響步驟，不放寬安全條件。回復使用正常後續提交恢復 manifest、lock 與文件，不改寫歷史。
