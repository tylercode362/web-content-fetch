# 下載與恢復修正驗證

基底：d4013bb404b54b6374004a6ead6360689907dffe。
2026-10-05 00:27–00:30 UTC，Linux 雲端、Node v24.19.0。

## 已修改

- WCF-01：單檔下載使用 ASCII fallback 與 UTF-8 filename*，保留原有路徑限制。
- WCF-02：錯誤 percent encoding 回 400；最外層 request handler 接住非同步拒絕。
- WCF-03：重啟保留暫停與取消意圖，取消中任務只重試清理，不重新擷取。
- WCF-04：過期、淘汰與前次程序的 CSRF token 持續拒絕，使用既有 UI renew 重新取得。
- 額外修正：正式啟用前將 Compose 路徑從暫存目錄切回安裝目錄，避免成功後清理 staging 時留下指向暫存來源的部署設定。只修改腳本，未執行 NAS 部署。

## 實際測試

- 指令：node --test test/review-http-recovery.integration.test.js test/csrf.test.js test/restart-policy.test.js test/origin-boundary.test.js
- 修正後 10 通過、0 失敗、0 略過，exit 0。
- 原始 server／orchestrator／CSRF 搭配新增測試：6 項中 2 通過、4 失敗，exit 1；分別重現中文下載、錯誤解碼、重啟取消，以及到期 token 再次接受。
- HTTP 測試啟動真實 server.js 子程序與 loopback HTTP，驗證中文／日文／ASCII 檔名、回應位元組、非法編碼後程序仍回應，以及取消中輸出檔確實清除。
- 為隔離外部依賴，測試 preload 替換 Bridge transport、EPUB writer 與 ZIP constructor；此結果不包含真實 Bridge、密碼學、EPUB／ZIP 產製或映像建置。任何 Bridge constructor 使用會直接使 fixture 失敗。
- 擴大測試最初 25 項中 24 通過、1 失敗。進一步核對發現既有 NAS 腳本的正式啟用仍指向 staging，不能只調整 regex 忽略。已補回安裝目錄路徑切換，並保留現有 --remove-orphans 參數的精確測試；最新 26 項全部通過。這是靜態腳本回歸，不是 NAS 執行證據。
- server.js 與 job-orchestrator.js 通過 node --check。

## 未驗範圍

Docker／Compose、正式 Node 版本、完整依賴測試、formatter／lint／typecheck、OpenSpec strict、dependency audit、完整秘密與隱私掃描、實際 Chrome 與 Gateway 整合尚未完成。這是工作分支修正候選，不是可部署或整體驗收完成的宣告。
