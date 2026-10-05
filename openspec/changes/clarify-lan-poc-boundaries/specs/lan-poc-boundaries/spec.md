## ADDED Requirements

### Requirement: LAN 自用 POC 邊界
文件 SHALL 說明 UI 不另設登入，UI/API 異動需要 exact Origin 與有效的 server-issued CSRF token；Bridge 綁定憑證與 browser session MUST 保持隔離。

#### Scenario: 不合法 token
- **GIVEN** LAN 自用 UI 沒有額外登入
- **WHEN** 異動請求提供失效或未登記的 CSRF token
- **THEN** WCF SHALL 拒絕請求

### Requirement: Compose Gateway 路由
文件 SHALL 說明 WCF 在容器內綁定 0.0.0.0:8092，不發布 host port，Gateway 經 local-gateway-chrome-bridge 網路轉送。

#### Scenario: LAN 存取
- **GIVEN** 既有 Compose 設定
- **WHEN** 使用者從 LAN 存取 WCF
- **THEN** SHALL 使用明確設定的 Gateway 路由
