# 設計

## 工作流

```text
web-content-fetch UI
  -> queued DownloadJob（固定 binding／FQDN serial）
  -> chrome-bridge content.fetch：chapter list
  -> 每章 content.fetch：正文或漫畫頁面與 next／下一頁
  -> chrome-bridge content.fetch：allowlisted asset bytes
  -> job checkpoint
  -> EPUB writer：sanitize、排除廣告、Kobo 尺寸最佳化
  -> 原始 EPUB + kepubify 產生的 .kepub.epub
```

OVERLORD 的所有章節合併到一個小說 EPUB；8Comic 阿邦的每一卷各自產生一個漫畫 EPUB，卷內所有 next／下一頁以閱讀順序寫成同一卷的 XHTML image sequence。

Linovel 章節清單可能把 `/vol_<id>.html` 卷目錄與實際章節混在一起。Chrome Bridge 會在同一個背景分頁展開卷目錄後回傳實際章節；web-content-fetch 不把卷目錄當成正文，並在恢復時淘汰含有舊卷目錄連結的 manifest、保留已驗證的章節 checkpoint。

## 廣告與 lazy-load

- Bridge 在真實 Chrome 中等待頁面、捲動或執行既有站點規則所需的載入步驟，再從 DOM 與瀏覽器操作結果取得正文／圖片證據。
- 內容工作預設使用背景請求分頁；DOM 讀取、有限捲動、合成滑鼠／指標事件、`img.decode()` 與 debugger-backed asset capture 不得搶走使用者目前的瀏覽器焦點。只有個別站點明確宣告需要前景互動時才可 opt-in，且完成後必須恢復原本分頁。
- `src`、`data-src`、`srcset`、IntersectionObserver lazy-load 尚未完成時，不得把 placeholder 當成真實圖片；必須等待可用 URL 或以明確的 missing-asset diagnostic 失敗。
- 若正文已含真實 `<img>` 標記但第一次回傳尚無圖片證據，web-content-fetch 必須在同一章重新讀取數次，讓瀏覽器 lazy-load 有機會完成；重試耗盡才可回報缺圖。
- Linovel 的無 `href`「下一章」控制元件只表示目前章節的邊界；只有明確的同章下一頁鏈結才合併進目前章節，避免把下一個 manifest 章節重複寫入 EPUB。
- 蓋板、iframe 廣告、廣告節點、banner／popup／sponsor 等標記在 Bridge extraction 與 EPUB writer 兩端都排除；不能因 `data-ad` 屬性名稱本身誤刪一般正文節點。
- 不使用任意 request proxy；圖片 bytes 仍由 Chrome Bridge 的 allowlisted asset operation 取得，必要時由 Bridge 使用已驗證的圖片 URL 與章節 Referer 執行受限制 fallback。
- 8Comic 作品頁的卷別由 `cview(...)` inline handler 解析成同站 `/view/<作品>.html?ch=<卷>`。若瀏覽器沒有 `CKVP` 而被 `nview.js` 導回作品頁，Bridge 優先在真實 Chrome 分頁以同源 fetch 讀取原始 `/view` HTML，Network debugger 作為 fallback，解析官方圖片初始化資料，再以同源／allowlist 方式取得圖片 bytes；官方回應、編碼或圖片 bytes 無法驗證時才 fail-closed，不追蹤第三方廣告、不把作品封面當正文。

## EPUB 輸出契約

- 每一張輸出的圖片都必須是 Kobo 上限內的 JPEG，並在 XHTML `<img>` 上 inline 寫入數字 `width` 與 `height`。
- 小說正文內的圖片維持文字閱讀順序，外部 URL 改成 EPUB 內部圖片路徑。
- 漫畫每頁一個 XHTML image entry，保持頁面順序；每章產出 `.epub` 與 `.kepub.epub`。
- 工作完成前先寫入 job-scoped stage，再以安全檔名發佈；失敗、取消或刪除不得留下該工作的 checkpoint／stage。

## 失敗與恢復

- 以工作 ID、章節 index、圖片 index 保存 checkpoint；重啟後從最後一個可驗證 checkpoint 繼續。
- 章節清單重新整理後，小說 checkpoint 必須以保存的 `baseUrl` 對照目前章節網址；網址不一致時只淘汰該章 checkpoint，保留其他已驗證章節，避免把舊索引內容誤當成新章節。
- OVERLORD 或阿邦只要發生內容不足、圖片證據不足、callback 失敗或頁面導覽失敗，就保留可診斷狀態，不把部分輸出標成 complete。
- 非 OVERLORD 小說只可透過終止工作的刪除操作移除，且刪除範圍限於該工作記錄、輸出與暫存檔。
