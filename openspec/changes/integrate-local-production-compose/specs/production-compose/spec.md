## ADDED Requirements
### Requirement: 明確且隔離的正式設定
production Compose SHALL 使用主機自己的環境檔，保留 shell 優先權，且不得將環境檔整份注入應用程式。

#### Scenario: 正式主機有本機覆寫
- **GIVEN** 主機提供 .env 與自己的 .env.local
- **WHEN** 操作者依序明確指定兩份 --env-file
- **THEN** .env.local 覆寫 .env，既有 shell 值仍優先，其他主機的檔案不參與。

#### Scenario: 必要設定缺失
- **GIVEN** production image 或必要主機路徑沒有設定
- **WHEN** 執行 Compose config
- **THEN** 指令失敗，不啟動或重建服務，也不讀取認證內容。

### Requirement: 現行設定等價
整合後的有效 Compose 設定 MUST 保留現行 image、network、volume、port 與 auth 語意。

#### Scenario: 僅準備設定整合
- **GIVEN** 現行容器仍引用舊 override
- **WHEN** 新設定通過比對
- **THEN** 保留舊檔與容器，只將差異交付審查。