# Design: 保留沒有 DOM 尺寸的小說圖片資產

Chrome Bridge 的內容頁圖片 evidence 將 `width`／`height` 視為 optional metadata。若兩者都是有效正整數，沿用現有上限；若同源文件擷取沒有提供尺寸，仍保留已驗證的 URL、來源頁與 alt，不因缺少展示 metadata 丟棄圖片。

WCF `registerNovelImagesCallback` 只在尺寸欄位存在時驗證其範圍。下載 callback 仍必須取得圖片 bytes、MIME 與 digest；`epub-writer` 的 `sharp` 解碼會以 bytes 決定實際尺寸、方向與 Kobo 限制，故輸出的 XHTML 不會使用缺少的 DOM 尺寸。

這個邊界同時修正 NAS Chrome container 使用的同源續頁流程與本機流程，並保留既有完整 DOM 擷取路徑的尺寸驗證。
