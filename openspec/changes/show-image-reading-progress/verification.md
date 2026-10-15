# 驗證結果（2026-10-15）

## 候選與契約

- 遠端基底：`b71742cbba7b499ceb472d5e3a3cd171bb5f1701`，來源分支 `work/manhuagui-tw-20261015`。
- 雲端來源 checkout 的 commit 為重建歷史，已核對完整 tree `86e6c6d43a5ab6ac2f6b78e632ec43939e52068d` 與遠端基底完全一致。發布以遠端基底為 parent。
- 已重新讀取遠端 Bridge 同名分支 `bridge-server/content-fetch.ts`：live flow 的 readChapterPage complete callback 明確送出 `pages: Number(progress.iteration)`。reader 結果另有 completed 為圖片數的路徑，故不能猜測。

## 已通過

- 新增回歸先 RED，再 GREEN：6 項。
- 圖片讀取、job view、progress stream、cancel feedback 合計 22／22 通過。
- `node --check`：ui.js、server.js、新增測試通過。
- `git diff --check` 通過。
- 既有可用 OpenSpec CLI 執行本 change strict validation 通過；未安裝或升級工具。
- production dependency audit：0 vulnerabilities，未變更 dependency／lockfile。
- 針對本次差異進行 secret/privacy 人工檢查：無 token、cookie、配對碼、原始內容或私人資料；新增測試全為合成資料。

## 完整測試與限制

- 初次完整測試：72 通過、10 失敗、2 略過，其中一項因 HOME 位於唯讀目錄而無法建立暫存檔。
- 僅將測試 HOME 指向可寫的雲端暫存目錄後：73 通過、9 失敗、2 略過。
- 完全相同環境下重跑未修改基底：67 通過、9 失敗、2 略過。9 項失敗名稱與候選相同；候選多出本次 6 項通過測試。
- 6 項 EPUB writer 直接報 `kepubify_failed_ENOENT`（缺少 `/usr/local/bin/kepubify`）；另 3 項續傳測試回傳 error 而非 complete，已重現為基底既有失敗，未單憑推測將原因歸給 kepubify。
- HTTP 整合測試依既有環境條件略過 2 項，未冒稱通過。
- 此工作區未提供 Docker／Compose；未執行 Compose config、Docker build／healthcheck。package.json 未定義 formatter、lint 或 typecheck 指令；語法檢查不等同這些 gate。
- 完整產品流程與真實網站下載仍未驗；最小顯示 fixture 的後續實際操作結果見下節，不能以此替代完整流程。
- 未變更 Bridge／Extension，未重啟使用者服務，未部署，未合併 main。

原始執行輸出保留於雲端工作區，不提交 Git。

## 最小 headless fixture 嘗試（後續）

已準備使用候選原始 HTML／CSS／JS 的 synthetic HTTP／SSE fixture，計畫以桌機鍵鼠及平板 touch 展開卡片，檢查頁數、缺 pages、圖片驗證與 writing_epub 切換。獨立 Chromium 保留 sandbox 啟動時，在 process_singleton Unix socket 回報 `Operation not permitted`；同命令經正常 require_escalated 審核執行後仍有相同錯誤。兩次皆在頁面開啟前停止，未執行任何 UI 操作，不能記為通過。未停用 sandbox、未以其他瀏覽器取代。原始輸出保留雲端、不提交 Git。


## 最小 headless fixture 後續通過

只讀對照同雲端既有成功啟動規格後，確認前兩次使用的是完整系統 Chrome，與既有官方獨立 headless-shell 不同。依主代理核准，使用已存在的獨立 headless-shell、相同執行權限、保留 sandbox、獨立可寫 profile／TMPDIR；未下載工具、未改安全設定。

- 測試候選產品為 `3eefcd89dead20033c3d99d57af80d62e556d53a`；後續提交僅文件。使用原始 server renderHtml 產出的頁面，以及原始 ui.js／ui.css；synthetic HTTP／SSE 提供資料，未呼叫產品函式直接觸發操作。
- 桌機 1280×900：真實滑鼠展開卡片、Tab 鍵、重複收合與 Enter 重開。平板 820×1180：真實模擬 touch 展開、收合、重開。
- 各 5 個畫面檢查，共 10 個通過：已讀取 6 頁、缺 pages 顯示讀取中、pages 2／images 10 顯示 2 頁、assets_verified 顯示圖片 4／10、writing_epub 顯示產生檔案。
- SSE 更新維持卡片展開；總章節保持 1／4。未知頁數比例維持 0%，圖片驗證為 40%；無 JavaScript pageerror、無水平溢位。
- 已檢視桌機讀取與平板缺頁數截圖，文字可讀。截圖與 trace 原始檔留在雲端，不提交 Git。
- 瀏覽器正常關閉後已釋放資源。此結果僅證實本次標籤與相關卡片互動，不代表真實網站、完整下載、1000 頁或所有產品功能已驗收。
