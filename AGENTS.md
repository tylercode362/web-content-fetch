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
- 保留無關工作與資料；Git 操作核對 repository、branch、完整 SHA 與當次有效範圍，不以文件推定發布或部署權限。

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

## 共通工程與驗收

- 開始工作時重新核對本 repo、完整來源 SHA、適用的 AGENTS.md、openspec/config.yaml 與 active change；專案特例保留在本檔，OpenSpec 設定引用此段，避免重複維護。
- 程式採簡單、範圍明確且容易維護的實作，沿用既有命名、格式與責任邊界；不為假設需求加入抽象層、平行權威模型或新架構。依已核准 OpenSpec 記錄需求來源、變更範圍、不變事項及驗收條件，交付前核對實際差異。
- 雲端負責實作、審查與 headless 產品／易用性驗收。使用者本機的 Codex 執行角色為 GPT-5.6 Luna Max，工作限於當次指定的 Git 同步、Docker 建置／更新、必要設定及 Gateway／啟動檢查；不重複雲端產品驗收，不新增主機開發執行環境。
- UI 主要功能保持可見、易找且操作層級淺；有檔案操作時置於頂部工具列，與側邊工具分開；選取物件的主要操作放第一層。避免深層巢狀選單及長頁面捲動，僅收合次要選項；使用者主動開啟的面板不得無預警消失。減少完成任務的步驟，但不自行訂通用點擊次數上限；既有核准設計及專案明定限制仍適用。
- UI 驗收使用瀏覽器原生鍵盤、滑鼠及原生模擬觸控，涵蓋桌面與平板、完整任務流程、中斷／取消／返回／重試與恢復。記錄操作步驟數、入口可發現性、可理解的錯誤及恢復方式；專案要求的手寫筆與其他輸入另行覆蓋。
- 直接呼叫 app 方法、派送程式事件、單元測試、HTTP health 或畫面截圖不能單獨證明使用者完成流程。原生模擬觸控不等於實體裝置、GPU 或效能驗證；未覆蓋項目明列限制。
- OpenSpec、Stylelint 與相關開發依賴每次更新前核對實際版本、官方新版及安全公告，適用時升級並重新驗證；維持專案來源審查與版本鎖定。正式 NAS 映像不包含 OpenSpec、Stylelint 或其開發工具依賴；開發／測試與執行期分層。
- 交付記錄 repository、branch、完整 commit SHA、差異範圍、工具版本、驗證環境、精確指令及結果；區分已修改、已測試、已提交、已推送、已部署。Git／部署只依當次有效範圍執行，文件與歷史測試不構成新的操作權限，也不證明目前部署狀態。

- 本專案最終部署目標為 NAS；本機服務不必全部常駐。一般 LAN POC 沿用既有 Local Gateway，不新增 UI 登入、service key 或 HTTPS；exact Origin／server-issued CSRF、Chrome Bridge 既有加密驗證及一次性六碼配對維持不變。
- UI 驗收涵蓋配對入口、建立工作、進度、取消／重試、SSE reconnect、輸出下載與可理解的失敗狀態；雲端使用 synthetic fixture，真實網站 Chrome smoke 另列指定範圍與未驗限制。
