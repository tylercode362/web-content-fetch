# Failed and cancelled job cleanup

## MODIFIED Requirements

### Requirement: Batch cleanup removes failed and cancelled jobs only

批次清理操作 MUST 只處理 `status === 'error'` 或 `status === 'cancelled'` 的工作，並同步刪除該工作已驗證的輸出、checkpoint、stage 與 job record。`complete` 及非 terminal 工作 MUST 保留。

#### Scenario: Clear failed and cancelled records

- **GIVEN** 佇列同時有失敗、完成、已取消與執行中的工作
- **WHEN** 使用者按下「清除失敗與取消紀錄」並確認
- **THEN** 失敗與已取消工作及其 job-scoped 檔案 MUST 被刪除
- **AND** 完成與執行中的工作 MUST 仍出現在列表

#### Scenario: Compatibility route is called

- **GIVEN** 舊版 client 呼叫 `POST /api/jobs/clear-terminal`
- **WHEN** 伺服器處理批次清理
- **THEN** 該 route MUST 使用與 `clear-failed` 相同的失敗與已取消工作範圍，不得刪除完成工作
