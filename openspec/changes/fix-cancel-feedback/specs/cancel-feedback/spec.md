## ADDED Requirements

### Requirement: 取消提示依 API job 狀態
UI SHALL 只在回傳 job.status:cancelled 時宣稱取消與檔案清理完成。

#### Scenario: 取消尚在處理
- **GIVEN** 使用者確認取消
- **WHEN** API 回傳 job.status:cancelling
- **THEN** UI SHALL 顯示取消與清理仍在等待，且重新整理工作

#### Scenario: 取消已完成或未確認
- **GIVEN** 使用者確認取消
- **WHEN** API 回傳 cancelled 或其他狀態
- **THEN** UI SHALL 分別顯示已完成或未確認，不誤報清理完成
