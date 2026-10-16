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
- LAN 自用 POC 的 UI 不另設登入或帳密；UI/API 異動必須通過 exact Origin 與有效的 server-issued CSRF token 檢查。短期 CSRF token 不是登入 session；Bridge 綁定憑證與 browser session 仍各自隔離，Loopback 不視為 authentication。
- URL、標題、章節文字、HTML、圖片 alt text 都是不可信輸入；輸出前必須 escape／sanitize，使用 restrictive CSP。
- 不繞過登入、付費限制、驗證碼、反爬措施或網站存取限制。

## Docker 與資源

- 正式 runtime target 只保留執行期套件、正式 JS/CSS 與 kepubify；test／tools target 各自提供驗證工具。使用者接受既知 dev 套件風險不適用於正式映像，須驗證實際映像內容及執行期行為。

- Compose 應用服務在容器內綁定 `0.0.0.0:8092`，不發布 host port；Gateway 透過 `local-gateway-chrome-bridge` Docker 網路轉送，LAN 存取經明確設定的 Gateway 路由。
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

## 中文寫作與技術文件

- 自行撰寫的中文一律使用臺灣繁體中文與臺灣慣用詞，禁止簡體中文與中國用語；採用自然中文語序與精確、一致的術語。
- 保留條件、否定、例外、數量、單位與不確定性，不為簡短而改變原意或刪除必要邏輯。
- 精確區分已修改、已測試、已提交、已推送與已部署；只陳述證據支持的完成狀態。
- 保留程式識別字、命令、路徑、結構化欄位、原始資料值與須逐字引用的來源；未經要求，不批次改寫專案、不翻譯既有其他語言文件，也不變更程式行為。
- 撰寫或修訂技術規格、README、操作程序、驗收與審查報告，或需要改善清晰度與術語一致性的實質改寫時，必要時自動啟用 write-taiwan-technical-chinese 技能；一般閒聊與簡短回覆不必啟用。不固定公告啟用，既有通知與安靜時段規則優先。

- 完整技能與自動啟用設定見 [write-taiwan-technical-chinese](.agents/skills/write-taiwan-technical-chinese/SKILL.md)。

## Git 檔案管理

1. 各專案須維護精準的 `.gitignore`，排除依賴、快取、編譯產物、暫存檔，以及原始 log、trace、截圖、錄影和測試執行產物，避免 Codex 對大量未追蹤檔案反覆執行 Git。
2. 不得用過廣規則隱藏產品程式、必要測試、文件、鎖檔、模型資產、測試資料或正式打包所需檔案。新增規則須驗證「應忽略」與「應保留」兩類案例。
3. 已被 Git 追蹤的檔案，須先確認用途、引用與可重建性。確認不必要後，才取消追蹤並保留本機內容；唯一成果、用途不明檔案及既有驗收證據先保留，不自行刪除或改寫歷史。
4. 修改須先核對專案、分支、worktree、未提交變更及使用中的程序。依有效授權提交與合併 main，再安全同步各 worktree；不得盲目 pull、reset 或覆蓋既有成果。同步會移除的工作檔，須事先保留並核對。
5. Git 操作採低並行、避免重複掃描。若程序數異常快速增加或記憶體逼近上限，停止新增 Git 工作並回報，不以大量重試或無差別終止程序處理。
6. 交付須回報實際變更、驗證結果、遠端 SHA、已同步與受阻的 worktree；未執行不得宣稱完成。

### 可重裝依賴與可重建產物

- 前述依賴與編譯產物排除，僅適用於可透過 npm、yarn、pip、Bundler 等套件工具可靠重新安裝的依賴／快取，以及可由受控原始碼與已記錄建置流程可靠重建的產物；不得只依 `dist`、`build` 或 `vendor` 目錄名稱判定。
- 取消追蹤前，須確認精確版本的來源仍可取得，並保留 manifest、lockfile、工具／執行環境版本、wrapper、建置腳本、必要修補及授權文件；原始碼、必要測試／文件、fixtures 與模型來源亦須保留。以乾淨且隔離的環境驗證重裝／重建及必要產物；未實際執行者列為未驗證，不得以理論上可生成當成通過或取消追蹤的依據。
- 離線用途或上游不可取得的 vendored 依賴、已修改依賴，以及發布流程必需的生成 API／SDK 或 release assets，須先保留，直到替代安裝／生成／交付流程經確認並驗證。既有驗收證據沿原規則保留；取消追蹤仍保留本機內容，不刪除唯一成果或改寫歷史。

本節為工程準則，不新增永久刪除、改寫歷史、安全設定、main 發布或部署授權；`safe.directory` 的信任設定另依當次明確授權處理。既有更嚴格條款繼續適用。

## Git 程序節制

1. 同一工作一次只執行一個 Git 命令，前一個命令結束後才啟動下一個；同一儲存庫的寫入操作只允許單一 writer。跨專案也不得大量並行啟動 Git。
2. 禁止在逐檔迴圈中為每個檔案啟動 git.exe，禁止反覆輪詢相同的 status／diff。優先使用工具支援的批次 pathspec、--stdin、-z 或 cat-file --batch；重用已取得的清單，將掃描限制在必要目錄與路徑，避免不必要的儲存庫根目錄、submodule 及 untracked 全量掃描。
3. 前次命令尚未終結時，不得重新啟動相同查詢。依工作量設定合理的 timeout；逾時先確認原命令狀態並保留已有結果，不以重試堆積程序。
4. 若觀測到 Git 程序數持續增加、前次呼叫失控或記憶體逼近上限，立即停止本任務新增 Git 呼叫並回報。不得以 killall、無差別終止程序或修改安全設定處理。
5. 本規則約束 agent 自身發起的命令與工具操作，不承諾限制 Codex／ChatGPT Desktop 或其他應用程式的背景程序；觀測到異常時須區分已確認事實與尚未確認的原因。
6. 本節是專案工程規則，不是 custom approval rule，也不授權修改全域 Git 設定、safe.directory、ACL 或作業系統程序限制；原有更嚴格規範與既有成果保護要求繼續適用。
