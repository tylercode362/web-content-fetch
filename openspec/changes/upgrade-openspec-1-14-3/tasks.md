## 1. 工具升級

- [x] 1.1 讀取 exact main、AGENTS.md 與 OpenSpec 設定，記錄授權與範圍。
- [x] 1.2 已用原版來源確認版本／隔離測試 RED，最小升版後 GREEN；Bridge RED 為隔離原版 manifest／lock 的重現驗證。
- [x] 1.3 已以真實 OpenSpec 1.14.3 執行 strict validation，結果見下方。
- [x] 1.4 已核對官方來源、版本、MIT 授權、57 個工具閉包套件授權檔、相依樹與 audit，檢查產品依賴不變；主責 review 仍待完成。

## 2. 自動化驗收與未驗項目

- [ ] 2.1 Docker／Compose 建置、實際映像內容及 runtime smoke：本環境沒有 Docker，未驗。
- [ ] 2.2 完整產品 formatter、lint、typecheck、回歸與 UI 流程：本次僅執行工具維護的可行測試；未執行項目不視為通過。
- [ ] 2.3 交付 review、遠端工作分支 SHA 核對；main 合併與部署由主責依有效授權另外處理。


## 2026-10-17 已觀察結果

node --test test/openspec-version.test.js：1/1 通過。openspec validate --all --strict --json：44/44 通過。Dockerfile 僅 tools 階段版本變更；來源靜態隔離測試通過，非映像實測。

Host：Node 24.19.0、npm 11.9.0。獨立 OpenSpec 1.14.3 閉包 audit 0；沒有 Docker，未建置／重啟／部署任何服務。安裝期間保留既有 npm http-proxy 設定警告，不修改網路設定。原始輸出留在驗證環境，不提交 Git。
