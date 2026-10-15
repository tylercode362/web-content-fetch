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
- 未執行 headless UI 實際操作、平板、完整／連續操作或真實網站下載驗收；留待主代理協調資源後驗證，不能以單元測試替代。
- 未變更 Bridge／Extension，未重啟使用者服務，未部署，未合併 main。

原始執行輸出保留於雲端工作區，不提交 Git。
