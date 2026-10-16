## ADDED Requirements

### Requirement: 執行個體變更後可安全取消指定工作
WCF SHALL 僅在已驗證的新 Bridge 執行個體確認同一綁定瀏覽器在線、指定工作無活動操作且驗證期間執行個體穩定時，完成舊工作的取消清理，並保留原操作身分及復原證據。

#### Scenario: 新 Bridge 已接回原瀏覽器
- **GIVEN** 舊操作回報 content_operation_server_changed 且固定指紋與綁定身分可核對
- **WHEN** 新執行個體確認原瀏覽器在線及指定 operationKey 無活動操作
- **THEN** WCF MUST 僅清除指定工作的檔案並標記 cancelled，不重建下載操作，也不要求其他工作停止。

#### Scenario: 停止證據不足
- **GIVEN** 缺少固定指紋、綁定不符、瀏覽器離線、指定操作仍活動或執行個體再次變更
- **WHEN** 使用者取消工作
- **THEN** WCF MUST 保留取消中狀態與所有檔案，不清除其他工作資料。

#### Scenario: 原執行個體的未知操作
- **GIVEN** Bridge 未明確回報執行個體變更
- **WHEN** 操作回報 unknown、expired 或 conflict
- **THEN** WCF MUST 保留既有終止確認規則，不以本復原分支清除檔案。
