# 驗證紀錄

2026-10-17，WCF 0.8.5，本機 main 的修正來源，Docker Desktop 為執行期驗證環境。

- RED：新增測試重現 recovery-required 未停止輪詢、未確認釋放缺少保存診斷與同 instance 續跑未先確認停止。
- GREEN：最終完整容器測試 168 項，其中 166 通過、2 略過、0 失敗。新增終止後讀頁重試先有兩項 RED；修正後驗證三次上限、執行中不建立新請求，以及真正 job 檢查點與輸出不被刪除。針對性三項工作暫停測試亦再通過。UI 診斷沿用 textContent，JS 語法檢查通過；未以單元測試宣稱所有原生 UI 流程完成。
- `content-operation-client.js`、`job-orchestrator.js`、`ui.js` 的 `node --check` 通過；本專案未另定 formatter、lint 或型別檢查指令，未新增主機工具。
- OpenSpec：既有隔離工具以 `validate handle-content-cleanup-recovery --strict` 通過。
- runtime 映像依既有 lockfile 建置，建置 audit 為 0 個漏洞；實際內容驗證 42 個執行期套件，無開發工具或套件管理器。
- Compose 解析並比對，只有映像 ID 改變；non-root、read_only、cap_drop、no-new-privileges、記憶體與 PID 上限及 state/output 掛載保留。
- 實際 Bridge binding 已驗證，Extension 3.4.1 在線並支援清理回條。透過原任務頁「從失敗處繼續」恢復第 11 話，頁面顯示下載進度及前十話的二十個輸出。

初次部署映像 ID 為 `sha256:b9619c7b8f616c09a458fc8561fe7177e920da2f2dc8e55fc98bf44370bf77ce`；加入有界讀頁重試後，最終映像為 `sha256:30a284c131ebab8d05728138a66f39fa378bc5435a5510f3e8ad080988a7345c`，容器 healthy，正式內容檢查再次通過。實際部署的三個修改 JS 與本機來源 SHA-256 一致。原生操作後頁面已驗證恢復狀態；重新載入後回到持久化工作快照。

自然斷線驗證：13:33:15 UTC，Windows 的 Docker API 與 HTTP 轉送同時無回應，容器內 WCF／Bridge 健康端點仍成功。WCF 持久化狀態轉為 paused／content_operation_release_unconfirmed，保留圖片 16／55、二十個既有輸出與原操作身分。當時清理確認及完整章節續跑受主機轉送故障阻擋；後續證據如下。

13:39:50 UTC 轉送自行恢復，沒有重啟 Docker／WSL。原頁面重連後顯示已暫停與可理解的恢復診斷；原生點擊「恢復」後，Bridge 在同一 instance 確認舊範圍清理並先終止舊請求，再接受新批次。原工作回到 running，圖片檢查點與二十個既有輸出保留。

第 11 話完成後，實際 EPUB／KEPUB 各有 55 張非空圖片與 55 個 spine 項目，ZIP CRC 通過；檔案分別為 21,452,268／21,458,697 bytes。前十話各自的 EPUB 與 KEPUB 仍在，總輸出增加為二十二個，工作仍 running 並進入下一章流程。此為指定故障邊界的真站 smoke，不代表整部四十八話或全部原生 UI 情境完成。

第 12 話曾以舊版一般錯誤碼結束，原始子類無法回溯。補足 Bridge 安全錯誤分類，並為已確認終止的三種頁序／缺圖失敗加入最多三次重試，全部完整性檢查保留。使用者同意暫停後，確認 cancelled 回條與五個槽空閒，才更新最終 WCF；其餘服務未重啟。從 32／43 張檢查點恢復後，第 12 話 EPUB／KEPUB 各含 43 張非空圖片及 43 個 spine 項目，ZIP CRC 通過；檔案為 15,654,170／15,659,159 bytes。總輸出增為二十四個，第 13 話開始讀頁，未宣稱整部完成。

原始 log 與畫面存於 Chrome Bridge 的忽略目錄 `.local/logs/`，未放入產品或版本控制。正式認證、原始內容與圖片不寫入規格文件。
