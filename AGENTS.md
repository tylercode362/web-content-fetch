# web-content-fetch 專案規範

## 功能責任

- 本專案負責下載任務頁面、Job Queue、同源 SSE 進度串流、Chrome Bridge client、章節編排與 EPUB／KEPUB 輸出。
- `chrome-bridge` 只負責透過真實 Chrome 取得受支援網站的章節清單、章節內容與圖片資產；不得把 Bridge 的工作狀態當成本專案的 queue truth。
- 小說整部輸出一個 EPUB；漫畫每章輸出一個獨立 EPUB，章內 next／下一頁合併為同一章的頁面序列。

## 安全與信任邊界

- 只使用 secure Chrome Bridge API；不得由本專案直接讀取 Chrome profile、cookie、session 或網站內容。
- Bridge URL 必須是明確設定的 `http`／`https` 端點；不接受任意 URL 作為內容下載來源。
- 6 碼 pairing code 是一次性、短期有效、限定本服務的綁定流程；交換後使用可撤銷的 service token，token 不寫入一般 log。
- 不提供、保留或透過環境變數啟用免六碼的開發 pairing shortcut；Local Bridge 與 NAS Bridge 都必須走 Extension 產生的一次性六碼。
- pairing code、service token、工作 session、輸出檔案與使用者輸入互相分離，不可互相替代。
- UI 與 API 必須使用 exact Origin／CSRF／session boundary；Loopback 不視為 authentication。
- URL、標題、章節文字、HTML、圖片 alt text 都是不可信輸入；輸出前必須 escape／sanitize，使用 restrictive CSP。
- 不繞過登入、付費限制、驗證碼、反爬措施或網站存取限制。

## Docker 與資源

- Compose 應用服務預設只綁定 `127.0.0.1`；LAN 存取必須經明確設定的 Gateway 路由。
- container 使用 non-root、`read_only`、`cap_drop: ALL`、`no-new-privileges`、`init`、PID／memory／tmpfs 上限與 healthcheck。
- 不掛載 Docker socket、Chrome profile、host credential、SSH key 或 GitHub auth。
- 只有明確的 state 與 output volume 可寫入；暫存內容放在受限的 `/tmp` 或 job workspace。
- named volume 初次掛載必須由 image 內預先建立並設定為 app 使用者可寫，避免非 root runtime 因權限錯誤遺失配對狀態或輸出檔案。
- 工作數量、章節數、頁面數、圖片大小、EPUB 大小、執行時間與重試次數都必須有上限；超限要明確失敗，不可靜默丟資料。
- 不使用 `latest` image tag；dependency 必須檢查 license、維護狀態與安全性。
- 參考 `opendata-research` 的交付基線：Docker／Compose 是權威執行環境；基底映像固定 digest；tools profile 執行時使用 `network_mode: none`；相依套件與外部工具版本、授權及來源記錄在 `docs/dependencies.md`。
- 任務依 RED → GREEN → REFACTOR → VERIFY 推進；未通過對應 gate 不得宣稱完成。部分、阻塞、逾時與恢復中的 job 必須保留可見狀態。

## 既有功能相容性

- 本專案的新增功能不得要求停用或破壞 `chrome-bridge` 既有 Threads、X、YouTube 功能。
- 所有 Bridge protocol 變更都必須 additive、具版本相容策略，並通過既有 Browser Read 回歸測試。
- 不得自動 reset、clean、stage、commit 或 push。

## 驗證

- 變更先寫入 `openspec/changes/`，再實作。
- 完成前執行 Compose config、formatter、lint、typecheck、測試、OpenSpec strict validation、dependency audit 與 secret/privacy scan。
- Docker build、healthcheck、Bridge binding、進度串流 reconnect 與 EPUB fixture 必須分開記錄證據。
- 測試使用 synthetic fixture；不得依賴個人登入、私人網站或真實 credential。
- 針對真實網站的瀏覽器驗證只使用使用者已登入的 Chrome Extension；不複製 profile、不擷取 cookie，且不得把 loopback callback 位址交給 Docker 外的 Bridge。
