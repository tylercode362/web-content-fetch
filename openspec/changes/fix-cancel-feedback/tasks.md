- [x] 1. 加入 click listener 回歸測試，先確認 RED。

RED：cancelling 與 complete 均誤顯示取消完成，2 項失敗、1 項通過，exit 1。
- [x] 2. 最小修正取消提示，執行 UI 測試、取消流程回歸與全量 OpenSpec strict。

GREEN：cancel-feedback、job-view、job-orchestrator 合計 33/33，exit 0；全量 OpenSpec strict 31/31，exit 0。既有 image 93b8dc11a41f、5b22436776c8，network none、唯讀來源。首次複製來源到非 root image 因權限失敗，exit 1、未執行測試；改用 NODE_PATH=/app/node_modules 與唯讀來源後通過，未變更 image 權限。
