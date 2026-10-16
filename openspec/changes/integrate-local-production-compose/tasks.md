## 自動化驗收
- [x] 核對現行 main、工作目錄、Compose 來源與 image。
- [x] 建立最小 production overlay、無秘密範例與載入說明。
- [x] 比對整合前後有效設定，驗證環境檔優先序與隔離。
- [x] 本次變更通過 OpenSpec strict validation。
- [x] 掃描前一版七個交付檔，未發現私鑰與常見 token 格式。
- [ ] 完整測試、dependency audit 與必要剩餘 gate 全數通過。
- [ ] 父工作審查實際 diff。
- [x] 隔離至非 main worktree，依精確雜湊核對後還原原 main 的本工作殘留；保留本機環境檔。
- [ ] Draft PR 通過完整驗證與父工作全文審查；本次不合併 main。

## 驗證紀錄與限制
focused 部署測試 2 項通過；OpenSpec 1.8.0 strict 通過。完整測試未執行，已產生 HEAD 受控快照但未安裝依賴。

前一版有效設定紀錄：WCF 與 Bridge 完整 config 相等；Gateway、controller、Codex service 及 network／volume 定義相等。controller 比對基準以 inspect 的精確 image SHA 補足缺失 override，未恢復舊根目錄檔。環境檔三項驗證通過：僅明確 .env 時不讀 .env.local；明確 .local 覆寫基本值；既有 shell 值優先。

完整驗證期間量測到主機可用記憶體約 1 GiB／16 GiB，依共用規範停止新增 Git 與重型工作。npm audit 尚未執行；focused 測試不能代替完整驗收。原始 log 與環境檔只留本機，不提交。

## 本次不執行
- Runtime 切換、部署與容器重建。
- 刪除仍被 runtime labels 引用的 override。
- 合併 main。

## 父工作 review 修正驗證
- [x] 補局部規範並保留既有 writer 與授權邊界。
- [x] 驗證本 repo 的明確服務清單、有效 config 與必要負向情境。
- [x] 對照固定來源 SHA 與設定 hash，記錄允許差異；推送結果由 Draft PR HEAD 讀回紀錄確認。

### 本輪實測紀錄
本輪服務清單只有 web-content-fetch，完整有效 model 與前一版基準相等。本輪只改局部規範／OpenSpec 文件與前一版檔數標示，不冒稱重跑完整產品測試。
來源基準 HEAD：da08c51971bc583ab05ae49e393eb7a087861bc3；production overlay LF-normalized SHA-256：326CFBDDC6B778C9B0C4474DDD16207A3328A655C23D1425CE5A65D601E1C87A。Node v24.19.0、Compose 5.3.1；三 repo 的 OpenSpec 1.14.1 strict 通過。
本機 config 比對紀錄 SHA-256：6256E8E8ADEE56B9EABAFBA2E3826B969DD800D1C3248EBE96E70B3547C17B8A。原始 config／log 不進 Git；完整測試、audit 與父工作最終審查仍未完成，維持 Draft。
