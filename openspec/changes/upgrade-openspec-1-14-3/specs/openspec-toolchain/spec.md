## ADDED Requirements

### Requirement: 固定工具版本並隔離正式執行期

專案的 OpenSpec 開發入口 SHALL 使用精確版本 1.14.3，且不得將 OpenSpec 或其工具專屬依賴加入 NAS 正式執行期。

#### Scenario: 執行開發工具
- **GIVEN** 已從官方 npm 安裝專案宣告的工具
- **WHEN** 查詢 OpenSpec 版本並執行 strict validation
- **THEN** CLI 回報 1.14.3，驗證結果明確保留且未通過項目不得標為完成

#### Scenario: 防止版本退回或工具流入正式映像
- **GIVEN** 工具版本宣告被改回舊版或加入正式依賴
- **WHEN** 執行版本及隔離測試
- **THEN** 測試 SHALL 失敗，不得將靜態檢查當作實際映像驗證

