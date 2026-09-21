# 驗證需求

## ADDED Requirements

### Requirement: 固定驗證目標

系統 SHALL 支援以 OVERLORD 小說網址與阿邦漫畫網址建立可恢復的 DownloadJob。

#### Scenario: 建立兩個固定目標

- **Given** 已配對且 callback URL 可由 Bridge 到達
- **When** 使用 OVERLORD 與阿邦網址各建立一個工作
- **Then** 兩個工作都保存 kind、固定 binding、browser UUID、service UUID 與 FQDN

### Requirement: OVERLORD 文字與圖片輸出

OVERLORD 工作 MUST 在真實內容與圖片證據完整時產生一個原始 EPUB 與一個 KEPUB EPUB；正文圖片 MUST 使用 EPUB 內部路徑，且每個 `<img>` MUST inline 寫入數字 `width` 與 `height`。

#### Scenario: 驗證 OVERLORD EPUB

- **Given** `https://tw.linovelib.com/novel/2014.html` 的章節清單與章節內容可取得
- **When** 工作完成並通過 `kepubify`
- **Then** 輸出包含章節文字、可驗證的正文圖片 entry、Kobo viewport，以及每張圖片的 inline width／height

### Requirement: 阿邦漫畫逐章輸出

阿邦工作 MUST 將每個章節輸出為獨立的原始 EPUB 與 KEPUB EPUB；章節中的 next／下一頁 MUST 合併成同一章的有序圖片序列。

#### Scenario: 驗證阿邦章節 EPUB

- **Given** `https://www.8comic.com/html/26490.html` 的章節清單可取得，且真實 Chrome 可用同源 fetch 讀取同站 `/view/26490.html?ch=<卷>` 的官方閱讀器回應，必要時由 Chrome Network debugger fallback 保存該回應
- **When** 每個章節及其下一頁圖片完成下載
- **Then** 每章各有一組輸出，XHTML 頁面順序與圖片順序一致，且每個 `<img>` 都有 inline width／height

### Requirement: 廣告與假 lazy-load 圖片排除

系統 MUST 排除廣告與蓋板節點，不得把 placeholder、廣告 iframe 或只有 lazy-load 欄位名稱的節點當成正文或圖片資產。

### Requirement: 背景分頁內容擷取

內容工作 MUST 在背景請求分頁執行 DOM 讀取、有限捲動、lazy-load 觸發、圖片 decode 與 allowlisted asset capture，不得因一般內容擷取搶走使用者目前的瀏覽器焦點。只有站點規則明確要求前景互動時才可暫時啟用，並 MUST 在工作完成或失敗後恢復原本分頁。

#### Scenario: 內容工作不干擾使用者分頁

- **Given** 使用者正在 Chrome 的其他分頁瀏覽，且 queue 啟動 OVERLORD 或阿邦工作
- **When** Bridge 開啟請求分頁並執行等待、捲動與圖片讀取
- **Then** 請求分頁保持背景，使用者目前分頁不被切換；工作仍可取得正文與具自然尺寸的圖片，或回傳明確缺圖診斷

#### Scenario: 廣告與 placeholder 不得進入輸出

- **Given** 回傳內容含有廣告標記、蓋板 iframe、`data-src` placeholder 與真正正文圖片
- **When** Bridge extraction 與 EPUB writer 完成清理
- **Then** 只有真正正文與可驗證 bytes 的圖片進入輸出；若沒有可驗證正文圖片則以明確 diagnostic 失敗

### Requirement: 非目標小說清理

系統 MUST 支援只刪除終止狀態的非 OVERLORD 小說工作、其輸出與 checkpoint；漫畫、OVERLORD 與執行中的工作 MUST 保留。

#### Scenario: 清理其他小說

- **Given** queue 同時含 OVERLORD、其他小說與阿邦漫畫
- **When** 使用終止工作刪除操作清理其他小說
- **Then** 僅其他小說記錄與 job-scoped files 被移除，OVERLORD 與阿邦工作仍可查詢與恢復

#### Scenario: 不得刪除執行中的工作

- **Given** 目標工作狀態為 queued、running 或 paused
- **When** 呼叫終止工作刪除操作
- **Then** API 拒絕操作並保留工作與 checkpoint
