# Design: Clean book titles and Kobo-safe filenames

`cleanBookTitle` 位於 `epub-writer.js`，作為輸出層的最後防線。它使用 NFKC 正規化，移除 HTML／URL／domain，截斷常見網站或平台尾綴，清除控制字元與標點符號，只保留 Unicode 文字、數字、空白與連字號，再限制顯示標題長度。

`slugify` 先套用 `cleanBookTitle`，再將分隔字元轉為連字號並限制檔名 stem 長度；EPUB 與 KEPUB 共用同一個 stem，因此兩個檔案一定保持短且一致。EPUB metadata、小說章節標題、漫畫書名與逐章輸出標題也使用清理後值。

`DownloadOrchestrator` 在保存 manifest title、job title、小說 checkpoint 章節標題及漫畫 output group label 前套用相同規則，使 UI 與輸出 metadata 不再顯示來源網站尾綴。既有已發布檔案不自動改名，避免破壞既有下載連結與恢復 checkpoint；新產生或重建的輸出使用新規則。

清理是 fail-safe 的顯示／檔名正規化，不是內容過濾；小說正文與圖片資產仍由既有 sanitizer、廣告排除與 evidence 驗證流程處理。
