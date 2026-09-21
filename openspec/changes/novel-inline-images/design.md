# Design

Bridge 的 `linovelib-content` 規則宣告 `#acontent img` 與 `tw.linovelib.com`、`linovelib.com`、`readpai.com` 圖片網域 allowlist。Extension 只回傳在真實分頁中已載入且有正 natural dimensions 的圖片證據；asset request 仍必須由同一個來源分頁提出，並由背景層驗證來源分頁、allowlist、MIME、大小與 SHA-256。

WCF 逐章取得圖片 bytes，writer 以既有 Kobo 最大尺寸規則最佳化，將正文中的外部 `img` 改寫為 EPUB 內部圖片路徑，並輸出 inline `width`／`height`。若正文宣告圖片但沒有對應已驗證 asset，工作失敗，不產生文字-only 的假成功檔案。

小說與漫畫的輸出共用廣告排除邊界：Bridge 先依 DOM 的廣告標記、廣告來源網址與蓋板狀態排除候選；WCF writer 再依 HTML 屬性、圖片來源、alt 與檔名做第二層清理。這兩層都只套用於 content.fetch，不改動 Threads、X、YouTube 或 Browser Read。
