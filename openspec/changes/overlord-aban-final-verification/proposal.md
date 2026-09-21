# OVERLORD 小說與阿邦漫畫最終驗證

## Why

這次驗證需要固定使用一部含正文插圖的日本作品與一部漫畫，確認真實 Chrome Bridge 的章節清單、分頁／下一頁處理、廣告排除、圖片資產取得、Kobo 圖片尺寸與 EPUB／KEPUB 輸出都能在同一個 web-content-fetch 工作流程完成。

## Verification targets

- 小說：`https://tw.linovelib.com/novel/2014.html`（OVERLORD／不死者之王）。整部小說為一個工作，最終保留一組原始 EPUB 與 Kobo KEPUB EPUB。
- 漫畫：`https://www.8comic.com/html/26490.html`（阿邦／勇者阿邦與獄炎魔王）。整部作品為一個工作，每卷各自保留一組原始 EPUB 與 Kobo KEPUB EPUB。

## Scope

- 將上述兩個網址作為本次真實 Chrome 驗證與最終輸出檔案的固定目標。
- 小說驗證文字、正文圖片、圖片 allowlist、圖片最佳化與 XHTML inline `width`／`height`。
- 漫畫驗證章節清單、下一頁合併、廣告／蓋板排除、頁面順序與每章獨立輸出。
- 移除佇列中非 OVERLORD 的小說工作及其已產生輸出；保留漫畫與 OVERLORD 工作。

## Non-goals

- 不加入新的來源網站或第三方漫畫下載器。
- 不繞過登入、付費限制、驗證碼、反爬措施或網站存取限制。
- 不改動 Chrome Bridge 的 Threads、X、YouTube 既有功能。

## Compatibility impact

這是 web-content-fetch 的驗收與輸出範圍收斂；Bridge protocol 維持 additive，既有 Browser Read 與站點規則不變。終止工作刪除只接受已完成、失敗或已取消的工作，不會刪除執行中的工作或其他工作的輸出。

## Privacy and rollback

驗證只透過已配對的 Chrome Extension 取得內容，不讀取或複製 Chrome profile、cookie 或登入資料。若任一真實網站無法連線、章節清單為空、正文／圖片證據不足或資產下載失敗，工作必須保留明確失敗狀態，不產出假成功檔案；可保留 OVERLORD／阿邦的 checkpoint 後重新恢復。

## Stop conditions

- Bridge callback、binding 或 Origin／CSRF 驗證失敗。
- 章節清單、下一頁結果、正文內容或圖片證據不足。
- 廣告排除後沒有可用內容，或任一圖片缺少可驗證 bytes／尺寸。
- 輸出無法通過 EPUB fixture、Kobo inline dimensions、KEPUB 轉換或完整性檢查。
