## RED

- [x] 建立續頁圖片缺少 DOM 尺寸、但正文 HTML 含有同一圖片的回歸 fixture。

## GREEN

- [x] 保留 Bridge 已驗證但無尺寸的小說圖片 evidence。
- [x] 讓 WCF callback 接受 optional 尺寸，並以 bytes 產生 EPUB。

## VERIFY

- [x] 通過 Chrome Bridge content fetch／Extension extractor 回歸測試。
- [ ] 通過 WCF EPUB、job orchestrator 與全套 Node 測試（目前有既有的部署腳本正則測試失敗，與本變更無關）。
- [ ] 驗證 Compose config 與部署檔未引入新的外部資產入口。
