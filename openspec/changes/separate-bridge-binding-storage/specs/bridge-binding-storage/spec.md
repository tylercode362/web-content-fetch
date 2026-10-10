## ADDED Requirements

### Requirement: independent current binding storage

WCF SHALL 將指定 config directory 的 config.json 與 stateDir 的 jobs／checkpoints 分離，並保留目前單一綁定身分與現有認證協定。

#### Scenario: explicit directory
- **GIVEN** 指定獨立 config directory 與有效 current binding
- **WHEN** 啟動並儲存設定
- **THEN** 設定 SHALL 只寫入指定目錄，jobs 仍屬原 stateDir。

#### Scenario: existing valid default
- **GIVEN** 未指定新 directory
- **WHEN** 讀取目前有效設定
- **THEN** WCF SHALL 維持既有 stateDir 路徑。

### Requirement: preserve binding fails closed

WCF MUST 在保留配對模式遇到缺檔、毀損、非 current binding、讀取錯誤或不安全檔案型態時停止，且不得建立空設定或重新配對。

#### Scenario: missing or malformed binding
- **GIVEN** 已啟用保留配對且目標缺失或格式損壞
- **WHEN** 初始化設定
- **THEN** 啟動 MUST 失敗且不寫入來源或目標。

#### Scenario: conflicting copy
- **GIVEN** 來源與目標都是 current binding 但內容不同
- **WHEN** 執行唯讀複本檢查
- **THEN** 檢查 MUST 失敗且不輸出 credential 或覆寫檔案。

#### Scenario: identical current copy
- **GIVEN** 來源與目標逐位元組一致且為 current binding
- **WHEN** 執行唯讀複本檢查
- **THEN** 檢查 SHALL 回報成功但不建立新認證或改寫設定。
