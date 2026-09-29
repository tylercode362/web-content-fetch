# Proposal: 保留沒有 DOM 尺寸的小說圖片資產

## Why

Linovel 的續頁文件由 Chrome Bridge 以同源文件方式擷取。這條路徑能驗證圖片網址並寫入正文 HTML，但不一定能在未載入圖片的解析文件中取得 `naturalWidth`／`naturalHeight`。WCF 目前把這類圖片從證據清單移除，最後 EPUB 組裝時會留下正文 `<img>` 卻沒有對應資產，造成 `novel_image_asset_missing`。

## Scope

- Bridge 保留已驗證的 HTTPS 圖片網址，即使 DOM 沒有尺寸 metadata。
- WCF 的小說圖片 callback 接受缺少尺寸的證據。
- EPUB writer 仍以實際圖片 bytes 解碼、最佳化並產生最終寬高；不使用虛構尺寸。
- 圖片網址、來源頁、allowlist、bytes、digest 與大小限制維持不變。

## Non-goals

- 不放寬圖片來源網域或資產讀取權限。
- 不繞過 Chrome Extension／Bridge 的圖片驗證。
- 不改變漫畫輸出或既有圖片尺寸限制。
