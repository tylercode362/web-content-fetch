- [x] 1. 加入 click listener 回歸測試，先確認 RED。

RED：cancelling 與 complete 均誤顯示取消完成，2 項失敗、1 項通過，exit 1。
- [x] 2. 最小修正取消提示，執行 UI 測試、取消流程回歸與全量 OpenSpec strict。

GREEN：cancel-feedback、job-view、job-orchestrator 合計 33/33，exit 0；全量 OpenSpec strict 31/31，exit 0。既有 image 93b8dc11a41f、5b22436776c8，network none、唯讀來源。首次複製來源到非 root image 因權限失敗，exit 1、未執行測試；改用 NODE_PATH=/app/node_modules 與唯讀來源後通過，未變更 image 權限。

## 2026-10-10 雲端 headless 補充驗證

- [x] 對 main `d69b9ffec959a66d6a9d621f75cbe444ad067927` 的未修改 UI 與原生 server，使用 Google Chrome for Testing headless 154.0.8037.92、啟用 sandbox，完成桌面 1440×900、平板橫向 1024×768、平板直向 768×1024 的實際滑鼠／模擬觸控流程，共 15 個檢核通過、零 pageerror。
- [x] 每個 viewport 以合成暫停工作及可丟棄輸出，依序拒絕取消確認、核對檔案保留，再接受取消、核對所屬檔案清理與 persisted cancelled；重新整理後刪除取消紀錄，另一個已完成工作及輸出持續保留。三個 viewport 均無水平溢位。
- [ ] 平板直向易用性仍有限制：只有兩個合成工作時，工作佇列已接近首屏底端，展開後取消按鈕約在頁面 y1650；尚未解決長距離捲動，不宣稱完整易用性通過。
- [ ] 本次未以真實 Bridge／Extension 或執行中的外部網站工作驗證整條流程；`cancelling` 與未確認回應分支仍由原回歸測試涵蓋，不宣稱本次 headless 已逐一操作這些分支。

9 張截圖與三份 trace 保留於 Git 外。本次取消提示候選已是 main 祖先；原生測試環境、完整測試結果及未驗 gates 見 [串流與佇列補充紀錄](../fix-stream-queue-stop-races/tasks.md)。
