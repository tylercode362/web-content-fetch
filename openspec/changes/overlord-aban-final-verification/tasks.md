# Tasks

## RED — 驗收範圍與契約

- [x] 將 OVERLORD 小說與阿邦漫畫網址固定寫入本次 OpenSpec change。
- [x] 定義小說單一 EPUB、漫畫逐章 EPUB、next／下一頁合併與 Kobo inline width／height 驗收條件。
- [x] 定義廣告、蓋板、lazy-load placeholder 與缺圖的 fail-closed 行為。

## GREEN — 佇列與清理

- [x] 支援終止狀態工作刪除，並同步刪除該工作的輸出與 checkpoint。
- [x] UI 顯示終止工作刪除操作，且不提供刪除執行中工作。
- [x] 新增終止工作刪除的單元測試。
- [x] 內容工作改用背景請求分頁，並把前景互動列為站點規則的明確 opt-in。

## VERIFY — 最終檔案

- [ ] 以已配對 Chrome Extension 執行 OVERLORD 真實網站驗證。
- [ ] 驗證 OVERLORD 原始 EPUB 與 `.kepub.epub` 的文字、正文圖片、圖片 entry、viewport 與 inline width／height。
- [ ] 以已配對 Chrome Extension 執行阿邦真實網站驗證。
- [ ] 驗證阿邦每章原始 EPUB 與 `.kepub.epub`、next／下一頁順序、廣告排除與 inline width／height。
- [ ] 執行 WCF、Chrome Bridge 回歸測試、Compose health、OpenSpec strict validation 與安全／秘密掃描。
