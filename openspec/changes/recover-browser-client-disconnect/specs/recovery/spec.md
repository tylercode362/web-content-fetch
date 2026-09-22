# Bridge 斷線恢復

## ADDED Requirements

### Requirement: recoverable browser disconnect

系統 SHALL 將暫時性的 Chrome Bridge 瀏覽器斷線視為可重試錯誤；重試耗盡後 MUST 保留有效 checkpoint 與 staging，並提供恢復工作的方法。

#### Scenario: retry after browser reconnect

GIVEN content.fetch 收到 `browser_client_disconnected`
WHEN Extension 以相同 browser UUID 重新連線
THEN web-content-fetch SHALL 在有限次數內重試該操作，並繼續使用原本的 binding，不要求新的六碼。

#### Scenario: resume after retry exhaustion

GIVEN 工作因 `browser_client_disconnected` 或其他明確暫時性 Bridge 診斷而進入 paused
WHEN 使用者執行 resume
THEN 工作 SHALL 從最後一個有效章節 checkpoint 繼續，未完成章節可以重新取得，且不可刪除其他工作檔案。

#### Scenario: non-retryable content failure

GIVEN 工作因缺圖、內容不足、廣告／驗證失敗或不支援來源而失敗
WHEN 使用者查看工作
THEN 工作 SHALL 保持 error，不得被當成 Bridge 斷線而自動恢復或略過驗證。
