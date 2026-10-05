## ADDED Requirements

### Requirement: 安全的下載回應
服務 SHALL 將 Unicode 檔名編碼至 UTF-8 filename*，並保留 ASCII 備用檔名。

#### Scenario: WCF-01 中文檔名下載
- **GIVEN** 合法輸出檔使用中文名稱
- **WHEN** 客戶端下載該檔案
- **THEN** 回傳原始位元組及合法 Content-Disposition 標頭

#### Scenario: WCF-02 錯誤的下載編碼
- **GIVEN** 服務已啟動
- **WHEN** 路徑含不合法 percent encoding 或 URL
- **THEN** 回傳 400，且同一程序仍可回應健康檢查

### Requirement: 保留停止意圖
恢復程序 SHALL 保留暫停與取消要求，且不得為這些任務重新擷取內容。

#### Scenario: WCF-03 暫停或取消途中重啟
- **GIVEN** 已保存 pausing 或 cancelling 狀態
- **WHEN** 服務重啟
- **THEN** pausing 成為 paused；cancelling 只繼續清理，不進入下載佇列
- **AND** 清理失敗保留可重試的 cancelling 狀態

### Requirement: 持續拒絕無效 CSRF token
服務 MUST 拒絕未知、過期或已淘汰的 CSRF token，即使 cookie 相符也不能重新接受。

#### Scenario: WCF-04 重複傳送過期 token
- **GIVEN** token 已過期、被淘汰或來自先前程序
- **WHEN** 重複送出該 token
- **THEN** 每次均拒絕，直到客戶端取得新的 token

### Requirement: 正式部署使用安裝目錄
NAS 腳本 MUST 在啟用服務前將 Compose 來源切回正式安裝目錄。

#### Scenario: WCF-05 暫存清理後來源仍存在
- **GIVEN** 候選已在暫存目錄建置並複製至安裝目錄
- **WHEN** 執行正式 Compose 啟用
- **THEN** Compose 使用安裝目錄的設定，不依賴之後會清除的 staging
