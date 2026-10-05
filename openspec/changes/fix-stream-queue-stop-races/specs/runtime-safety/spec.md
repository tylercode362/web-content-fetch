## ADDED Requirements

### Requirement: 串流失敗不終止服務
服務 MUST 隔離下載來源錯誤並停止已中斷的傳輸。

#### Scenario: WCF50-01 檔案在 stat 後讀取失敗
- GIVEN 下載已取得檔案資訊
- WHEN 開啟或讀取時發生 ENOENT／EIO
- THEN 傳輸失敗，但同一服務程序仍回應健康檢查

### Requirement: 佇列容量以提交時狀態為準
服務 MUST 在建立工作前同步確認剩餘容量。

#### Scenario: WCF50-02 並行提交最後一個名額
- GIVEN 只剩一個名額且兩個 request body 同時進行
- WHEN 兩個 body 完成
- THEN 只接受一個工作，另一個回 queue_full

### Requirement: 發布期間保留停止意圖
工作 MUST 在非同步發布及清理後重新核對取消／暫停要求。

#### Scenario: WCF50-03 小說發布期間取消
- GIVEN 小說正在發布輸出
- WHEN 使用者要求取消
- THEN 不回報 complete，且已發布輸出列入取消清理

### Requirement: 進度訂閱背壓有界
同源 SSE SHALL 最多保留 32 個連線；慢速連線寫入背壓期間只保留最新完整快照，不逐事件無限排隊。15 秒沒有 drain 時關閉該連線，其他訂閱不受影響；重連取得目前 job snapshot。額滿回 503 及 Retry-After，不靜默接收額外訂閱。

#### Scenario: WCF50-04 慢速讀取不累積所有歷史快照
- **GIVEN** SSE 寫入回報背壓且陸續有 1000 個完整狀態快照
- **WHEN** socket 可再次寫入
- **THEN** 只送最新快照；逾時或連線錯誤清理 listener 與訂閱，不使服務程序退出。

#### Scenario: WCF50-03B 漫畫最終清理期間停止
- **GIVEN** 漫畫章節已發布且正在執行最終清理
- **WHEN** 使用者要求取消或暫停
- **THEN** 清理完成後仍轉為 cancelled 或 paused，不回報 complete；取消時清理該工作所屬輸出。

### Requirement: 部分發布仍保留輸出歸屬
每次輸出檔案成功更名後，工作 MUST 立即登錄該檔案。後續檔案發布失敗不得遺失已發布檔案的歸屬，既有取消／刪除流程仍能清理工作所屬檔案；章節完成仍以既有 checkpoint 為準。

#### Scenario: WCF50-05 第二個檔案發布失敗
- **GIVEN** 同一工作有兩個待發布檔案
- **WHEN** 第一個更名成功、第二個更名發生 EIO
- **THEN** 工作保留第一個檔案的輸出登錄，明確取消／刪除可移除它；第二個暫存檔案不因發布失敗而誤刪。
