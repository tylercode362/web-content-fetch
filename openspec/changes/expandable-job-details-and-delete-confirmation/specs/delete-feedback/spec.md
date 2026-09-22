# Delete feedback and expandable details

## ADDED Requirements

### Requirement: Job details are expandable and collapsible

工作佇列 MUST 以每個 job 一個原生 `<details>`／`<summary>` 顯示，summary MUST 保留作品標題、來源網址與狀態；展開後 MUST 顯示進度、識別資訊、錯誤診斷、下載連結與可用操作。

#### Scenario: User opens and closes a job

- **GIVEN** 佇列中存在一個 job
- **WHEN** 使用者開啟或關閉該 job 的 summary
- **THEN** 詳情內容 MUST 隨之顯示或隱藏，且不應觸發新的下載工作

#### Scenario: SSE refresh preserves details state

- **GIVEN** 使用者已展開一個 job
- **WHEN** SSE 傳來進度更新並重繪佇列
- **THEN** 該仍存在的 job MUST 維持展開

### Requirement: Delete removes and verifies all job-scoped files

刪除已結束 job MUST 清理 checkpoint、stage、`outputs` 以及 `outputGroups[*].files` 指向的檔案；清理後 MUST 驗證每個受管理檔案不存在，且不得刪除其他 job 的檔案。

#### Scenario: Delete succeeds

- **GIVEN** job 已是 terminal 狀態且其 EPUB／KEPUB 檔案已列在 `outputs` 或 `outputGroups`
- **WHEN** 使用者確認刪除
- **THEN** API MUST 回傳 `deleted: true`，job 記錄 MUST 移除，所有指定檔案與 job 暫存 MUST 不存在，UI MUST 立即移除該 job 卡片

#### Scenario: Delete verification fails

- **GIVEN** 刪除後仍有受管理檔案存在，或檔案路徑不安全
- **WHEN** 使用者確認刪除
- **THEN** API MUST 回傳失敗診斷，job 記錄 MUST 保留，UI MUST 保留該卡片並顯示錯誤，不得假裝刪除成功

### Requirement: Delete requests are single-flight in the UI

刪除請求進行中，UI MUST 停用該 job 的操作按鈕並顯示進行中狀態；請求完成後 MUST 以 API 結果與最新 snapshot 校正畫面。

#### Scenario: User clicks delete twice

- **GIVEN** 使用者已確認刪除且第一個請求尚未完成
- **WHEN** 使用者再次點擊同一 job 的操作按鈕
- **THEN** UI MUST 忽略第二次操作，並維持刪除中的狀態
