# WCF 共用儲存庫前置檢查

在 WCF NAS 部署入口加入遇到驗證失敗即停止的前置檢查。執行本機 Compose 驗證、建立封存檔、上傳、暫存或切換服務前，先核對 NAS updater 儲存區保存的 GitHub.com SSH 主機金鑰 pin，再驗證 WCF 指定儲存庫的唯讀 deploy key 存取能力。GitHub.com 的主機金鑰 pin、部署主機連線 NAS 的 SSH 主機身分，以及儲存庫金鑰授權，是三個獨立的驗證對象。缺少共用模組、必要 pin 或金鑰時停止；本次變更不安裝或啟用 updater 輪詢。

## 範圍（Scope）

- 將 WCF 部署腳本接上已安裝的 Local Gateway 共用儲存庫設定模組。
- 主機金鑰檢查只傳入函式支援的參數；儲存庫檢查固定使用 `web-content-fetch` 與 `tylercode362/web-content-fetch`。
- 說明並列的專案目錄、updater 儲存區，以及擁有者確認等必要條件。
- 加入僅使用合成資料與模擬傳輸的自動化測試，涵蓋實際部署入口的參數繫結。

## 非目標（Non-goals）

- 本次候選準備與測試不執行 NAS 部署、SSH 連線、金鑰產生、GitHub 註冊、updater 啟用或輪詢。
- 不修改應用程式行為、既有儲存庫憑證或其他專案。

## 隱私影響與相容性影響

只可顯示公開的主機金鑰指紋與公開部署金鑰的註冊狀態。私密金鑰、NAS 密碼及應用程式機密不得外洩。既有 `-ConfirmDeploy` 閘門維持必要；新增檢查會在部署副作用發生前阻擋未符合條件的操作。

WCF 仍負責 DownloadJob、工作佇列、進度狀態與 EPUB 輸出；Chrome Bridge 仍負責瀏覽器分頁操作及受支援網站的內容擷取。本次不變更兩者的責任邊界、Bridge protocol 或既有 Browser Read 功能。

## 回復方式與停止條件

回復 WCF 部署腳本與相關文件變更即可回復此候選的程式碼。若缺少共用模組、未經擁有者確認而缺少 GitHub.com 主機金鑰 pin、pin 不符，或無法驗證指定儲存庫的讀取權限，應立即停止。不得因已有 deploy key 就略過主機身分驗證，也不得自動啟用輪詢。
