## ADDED Requirements

### Requirement: 同一邏輯請求只啟動一次
系統 MUST 以服務、瀏覽器、requestId 與 payload 身分區分操作，並保留 job 級取消鎖。

#### Scenario: 建立回應遺失
- **GIVEN** 原操作尚在執行或已完成
- **WHEN** 同一身分重送建立請求
- **THEN** SHALL 回傳原狀態與可用結果，不再啟動瀏覽器操作。

#### Scenario: 不同內容或服務
- **WHEN** 相同 requestId 搭配不同內容，或另一服務查詢
- **THEN** SHALL 拒絕衝突或返回 unknown，不揭露其他服務結果。

### Requirement: 有界且可跨 HTTP 連線恢復
系統 SHALL 以短請求建立及查詢長操作，且不放寬驗證與 session 期限。

#### Scenario: 中斷與取消
- **WHEN** HTTP 斷線、session 重新握手或使用者要求取消
- **THEN** SHALL 保留同一操作身分；取消僅在原執行與清理結束後成為終止狀態。

#### Scenario: 過期或 Bridge 重啟
- **WHEN** 結果已過期、操作不存在或 server instance 改變
- **THEN** MUST 停止自動執行，WCF 保留 checkpoint 與可見診斷，不以新 key 重新下載。

### Requirement: WCF 重啟不遺失待確認操作
WCF MUST 在傳送前持久保存操作身分，完成 checkpoint 前保留該身分。

#### Scenario: 結果尚未寫入 checkpoint
- **WHEN** WCF 重新啟動或恢復工作
- **THEN** SHALL 先接回原操作結果；舊操作未終止且 payload 不同時不得啟動另一個操作。

### Requirement: 漫畫資產階段保留已完成章節證據
WCF SHALL 在開始圖片資產讀取前持久保存已完成的漫畫章節結果，恢復時只重用相同章節的有效證據。

#### Scenario: 第一張資產失敗後恢復
- **GIVEN** 完整章節圖片清單已保存，且章節 URL 與工作相符
- **WHEN** 資產讀取失敗後恢復
- **THEN** SHALL 重用已保存的章節結果，不重新執行整話內容讀取；缺失或無效證據不得當作成功。

### Requirement: 取消保留遠端操作的終止邊界
WCF MUST 對仍有未確認終止 contentOperation 的工作（包含 running 中止本機等待、paused、queued 及 cancelling 重試），使用既有獨立取消 session，並確認 Bridge 回報終止後才移除本機 checkpoint、輸出及標記 cancelled。

#### Scenario: 暫停後遠端仍執行
- **GIVEN** WCF 已暫停或重新排隊，但持久操作身分尚未確認終止
- **WHEN** 使用者取消工作
- **THEN** SHALL 以既有 operationKey 取消遠端操作，等待原操作終止及清理，再移除本機資料。

#### Scenario: 遠端結果無法確認
- **WHEN** 綁定不可用、查詢失敗、結果不明或取消等候超時
- **THEN** MUST 保留操作身分及本機資料，維持可見的 cancelling 狀態與診斷，不宣稱已取消完成。

#### Scenario: 取消早於延遲建立
- **GIVEN** 已保存的原 create 尚未抵達 Bridge，先到的 cancel 沒有找到活動工作
- **WHEN** 對原身分的查詢稍後顯示 running
- **THEN** SHALL 在同一有界預算內重送原 operationKey 的取消，直到 get 證明該原操作終止；不得重新建立操作。

#### Scenario: 衝突結果不證明原持鎖操作已停止
- **WHEN** 新 request 的 error 結果是 content_operation_conflict，而另一個操作可能仍持有同一 operationKey
- **THEN** MUST 保留 cancelling 與本機資料，不將此 request 的 terminal error 當成持鎖操作的終止回條。

#### Scenario: 恢復時才查得前一步的衝突結果
- **WHEN** 下一個不同步驟查詢前一步，取得 conflict 或 payload conflict 的終止結果
- **THEN** MUST 保存前一步的操作身分與衝突碼並停止，不得清除身分或建立下一個操作。
