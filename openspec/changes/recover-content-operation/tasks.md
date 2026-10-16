# Tasks

- [ ] RED：新增長操作、建立回應遺失、重送、取消、斷線、過期、instance fence 與身分隔離合成測試。
- [ ] GREEN：實作 additive create／get、結果上限與 WCF 持久恢復，不改既有安全邊界。
- [ ] REFACTOR：檢查取消與 checkpoint 邊界，核對版本、文件及既有契約。
- [ ] 自動化驗收：執行容器測試、typecheck、Compose config、OpenSpec strict、依賴與隱私掃描；逐項保留實際結果。
- [ ] 回報程式差異、通過與未驗項目；不宣稱已部署或正式下載完成。

## 2026-10-16 main-first 保存

- [x] 依使用者明確授權，保存既有 13 檔至 `512248c553dea58af484695f1977da28db965016`，正常整合 main 基底 `ae8da8ba280ae1a315f3be87259d8032b5bab530`；保留主目錄 dirty 及新版 AGENTS，不納入其他未合併功能分支。
- [x] 13 項純 Node 合成測試、6 個語法檢查、版本一致性、基本秘密模式掃描與 diff whitespace 檢查通過；沒有新增相依。
- [ ] 完整 Linux/npm、漫畫 checkpoint runtime、跨 Bridge HTTP/Noise、OpenSpec strict 與正式網站驗收尚未執行，不以前述保存視為通過。
- [x] paused/queued 或待重試 cancelling 工作仍有未確認終止的 contentOperation 時，使用獨立 BridgeClient 取消，最多等候 15 秒並核對操作身分及終止結果，再清理本機資料。未知、過期、缺少綁定、身分不符與逾時均保留 cancelling／checkpoint 並顯示診斷。
- [x] 固定回歸先 RED：11 項中 8 fail／3 pass；實作後補齊 retry、expired、deadline 邊界，相關五檔最終 54／54 pass。
- [x] 使用既有 WCF 依賴映像 `sha256:dc8698e22abcb701708e4b97ea1d57a170753e39c9b69a90d08a87e6de828aeb`，非 root、無網路／正式 volume／認證／socket、來源唯讀，完整合成 suite 115 項：113 pass、0 fail、2 PowerShell skip。兩個 JS 語法與已知變更的基本秘密模式掃描通過。
- [ ] 此取消候選尚待審查；沒有變更 Noise／binding 權限、安裝新相依、執行跨 Bridge 真實流程、部署或重啟。OpenSpec strict、完整 typecheck 與真實 Chrome 驗收未執行；原始 log 僅留診斷目錄。
