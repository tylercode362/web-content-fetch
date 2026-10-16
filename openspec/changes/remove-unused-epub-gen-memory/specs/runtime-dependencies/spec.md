## ADDED Requirements

### Requirement: 只安裝產品實際使用的 EPUB runtime 依賴

Runtime manifest 與 npm lock SHALL 不再包含未載入的 `epub-gen-memory` 及其專屬間接依賴，並 MUST 保留實際 writer 仍需使用的共享依賴。

#### Scenario: 官方套件工具移除未使用依賴

- **Given** 產品與正式測試沒有載入 `epub-gen-memory`，且既有 npm lock 已固定版本與 integrity
- **When** 使用官方 npm 工具移除依賴並重新產生 lock
- **Then** root dependencies 不再包含該套件，共享套件仍可由其他直接依賴解析，未移除套件的固定版本與 integrity 不變

#### Scenario: 共享依賴不能因清理而遺失

- **Given** `jszip`、`sanitize-html`、`sharp` 或其他保留依賴仍需某個間接套件
- **When** 比較移除前後的依賴閉包
- **Then** 該共享套件 MUST 保留，且不能用刪減測試或更換 lock 格式掩蓋遺失

#### Scenario: EPUB 與 KEPUB 行為維持相容

- **Given** 正式 synthetic 小說與漫畫 fixture
- **When** 使用移除依賴後的隔離 Docker 候選執行既有正式測試
- **Then** EPUB／KEPUB、清理、圖片尺寸與閱讀順序的固定斷言通過，且不使用真實網站、下載資料或認證

#### Scenario: 工具或隔離環境不可用時不得宣稱驗收

- **Given** 官方 npm CLI 或 Docker engine 不可用，或平台拒絕執行
- **When** 準備依賴清理
- **Then** 保留工作分支及實際未驗項，不自行安裝新非 Docker 環境、不啟動既有服務、不手工偽造套件工具產生的 lock，也不宣稱依賴已移除或回歸通過
