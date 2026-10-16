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
