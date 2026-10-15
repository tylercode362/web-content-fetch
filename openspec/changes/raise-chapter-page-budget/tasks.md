## Implementation
- [x] 核對 WCF 主動傳送 MAX_PAGES，Bridge 仍採站點上限與 request 上限的最小值。
- [x] 將 WCF 請求上限改為 1000，3 項測試確認小說／漫畫實際請求及其他上限不變。
- [x] 新增測試 RED→GREEN 3／3、OpenSpec strict 與語法檢查通過；完整測試已執行，限制詳見 verification.md。
- [ ] 跨 repo 1000 頁端到端與 headless UI 驗收，由主代理協調；未執行不宣稱通過。
- [ ] 主代理 review 後合併 main；不更新 live 服務。
