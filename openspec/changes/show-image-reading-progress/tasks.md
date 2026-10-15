## 1. Contract and implementation
- [x] 核對 Bridge 各來源的 completed、total 與 pages 語意，以及 WCF callback 的欄位保留方式。
- [x] 確認必要 callback 頁數保留範圍後實作；維持非本次範圍不變。
- [x] 實作 UI 讀取頁數顯示與舊事件相容性。

## 2. Verification and delivery
- [x] 針對性 RED／GREEN、22 項相關回歸與程式語法檢查通過。
- [ ] 完整測試全數通過：目前 73 通過、9 失敗、2 略過；缺少 kepubify，HTTP 整合案例依原測試條件略過。
- [x] OpenSpec strict、production dependency audit 及本次差異 secret/privacy 檢查通過。
- [ ] Compose、formatter、lint、typecheck gate：工具或專案指令未提供，詳見 verification.md。
- [ ] 獨立 headless 實際操作驗收（由主代理協調，不以單元測試代替）。
- [ ] 發布非 main 工作分支，核對遠端 SHA；不提交原始 log、trace 或截圖。
