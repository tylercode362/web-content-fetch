# Bridge 長操作恢復候選

WCF 0.8.1 需要支援 `content.operation.create`／`content.operation.get` 的 Bridge Server 3.6.0。舊 Bridge 回 action_unsupported 時會暫停並顯示 content_operations_unsupported，不回退同步下載。Bridge 候選另含 Extension 3.3.1 的共用圖片 decode 等候修正；既有配對不變。

每個邏輯步驟在送出前，先將 requestId、serverInstanceId、payload digest 與狀態保存在既有 job snapshot 的 contentOperation。job.id 仍作取消用 operationKey。HTTP 最長 15 秒，每 2 秒查詢；總等候預算為 2 小時加 5 分鐘。傳輸結果不明只重送相同操作身分；已確認終止的可恢復錯誤，才允許下一次有界嘗試。

完成結果的操作身分保留到下一個不同步驟，讓 WCF 在寫 checkpoint 前重啟時仍可取回原結果。不同步驟若遇到未終止的 pending 操作，會先暫停；unknown／expired／Bridge instance 改變也停止自動重跑，不改動配對或清除 checkpoint。這些診斷不能靠反覆按恢復或更換 key 排除，需由操作者確認原操作／結果。

取消／暫停仍由獨立 BridgeClient 傳送 content.cancel，避免被原 Noise session 的序列請求阻擋。取消在獨立的 15 秒預算內重查原 requestId，並重送同一 operationKey 的取消，以涵蓋 cancel 早於延遲 create 抵達的競態。只有原操作的終止與清理已確認，才刪除 checkpoint／輸出並標記 cancelled；衝突請求的終止錯誤、未知或缺少 release 回條均不能證明原持有者已清理。無法確認時保留 cancelling、操作身分與診斷。WCF 保持自身 queue truth，不把 Bridge 狀態當成整筆下載已完成。

本次合成驗證使用 Node.js 與模擬 Extension，不啟動 Chromium，也不讀取 Chrome profile、cookie 或正式資料。跨儲存庫 HTTP／Noise 測試入口為 `test/fixtures/bridge-operation-roundtrip.cjs`，需將 BRIDGE_SOURCE 指向隔離 Bridge worktree，並提供該專案鎖檔依賴與 TS_NODE_PROJECT。正式網站驗收使用本機真正 Chrome 的既有 Extension；尚未部署與完成該驗收。
