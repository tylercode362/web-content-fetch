# 小說正文插圖內嵌

## Why

目前小說 EPUB 只保留文字，會移除正文中的 `img`。需要用較知名、確實有插圖的日本輕小說驗證「文字與圖片同時存在」的完整流程。

## Scope

- Bridge 對 Linovelib 章節回傳已載入的正文圖片證據。
- WCF 以站點圖片 allowlist 逐張向 Bridge 取回圖片 bytes。
- EPUB writer 以 Kobo 尺寸上限最佳化圖片、加入 inline 寬高，並將外部圖片 URL 改為 EPUB 內部路徑。
- 每次小說 EPUB 成功寫入後仍自動產生 Kepub。

## Non-goals

- 不執行頁面提供的 `eval`／`new Function`。
- 不提供任意圖片代理，不放寬既有漫畫安全邊界。
- 不改動 Threads、X、YouTube 或既有 Browser Read 流程。
