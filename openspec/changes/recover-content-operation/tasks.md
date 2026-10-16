# 工作項目

- [x] 保留既有漫畫功能、持久操作身分與 reader checkpoint；新增 API 不回退至舊版同步下載。
- [x] running、paused、queued 與 cancelling 重試共用取消終止確認；遠端尚未確認清理時保留本機檔案。
- [x] cancel 早於延遲 create 抵達時，在同一個 15 秒預算內重查並重送相同 operationKey 的取消，不建立替代操作。
- [x] conflict／payload conflict 不作為原持有者已清理的證明；恢復時才取得衝突結果也保留身分，create 衝突持久暫停。
- [x] 新增恢復衝突回歸先 RED 再 GREEN；完整 Docker Node suite 118 pass、0 fail、2 個既有 PowerShell skip。
- [x] 兩份跨 repo fixture 的七項 HTTP／Noise 檢核通過，使用真實 Bridge registry、ContentFetchService、SecureBrowserService；Extension 與資料為 synthetic fixture。
- [x] 乾淨重裝後完整回歸通過，含實際 EPUB／KEPUB 輸出；未使用 EPUB stub 取代此完整 suite。
- [x] 兩 repo Compose config 與 OpenSpec 全量 strict 檢查通過；WCF 正式依賴稽核為零弱點。
- [ ] 完成 headless 原生鍵鼠／觸控的取消與恢復流程；本輪未執行，不以 HTTP 或單元結果代替 UI 驗收。
- [ ] 完成必要安全與品質門檻後才整合 main；Bridge 開發依賴稽核仍有未修補弱點。

package.json 未設定 formatter、lint 或 JavaScript typecheck 指令，本輪不將語法檢查當成這些檢查通過。真實 Chrome／網站下載、部署與服務重啟未執行。原持有者或 release 回條無法確認時，保留待確認狀態；目前沒有自動解除該狀態的協定能力。
