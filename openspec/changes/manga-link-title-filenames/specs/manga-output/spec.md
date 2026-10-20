## ADDED Requirements

### Requirement: 漫畫檔名依來源連結名稱產生

WCF MUST 使用簡化後並轉為臺灣繁體字形的書名及章節連結標題產生新漫畫 EPUB／KEPUB 檔名與 metadata；SHALL 保留來源卷／話單位與數字。

#### Scenario: 混合話數與單行本

- **GIVEN** 第 23 個目錄連結名稱為單行本第 01 卷
- **WHEN** 產生漫畫輸出
- **THEN** 檔名 SHALL 包含單行本第 01 卷的安全名稱，且不得以第 23 話或 chapter-0023 代替
- **AND** EPUB／KEPUB SHALL 使用同一 stem

#### Scenario: 名稱含不安全文字

- **GIVEN** 連結標題含 HTML、控制字元、路徑分隔或網站尾綴
- **WHEN** 產生輸出
- **THEN** WCF MUST 清理檔名並 escape XML，保留可辨識的卷／話名稱且不得跳出輸出目錄

#### Scenario: 標題缺少

- **GIVEN** 無有效來源標題
- **WHEN** 產生輸出
- **THEN** WCF SHALL 使用有界的既有章節序號 fallback，且不得臆測卷／話單位

### Requirement: 同名與既有輸出安全

WCF MUST 保留已發布檔案、checkpoint 與下載連結；同一工作或不同工作的相同新檔名 SHALL 加入一致的數字尾碼。

#### Scenario: 同一工作內名稱相同

- **GIVEN** 同一工作已有一組同名章節輸出且已記錄於 outputGroups
- **WHEN** 發布下一章同名 EPUB／KEPUB
- **THEN** WCF MUST 保留前章內容並使用下一個可用尾碼

#### Scenario: 舊工作恢復

- **GIVEN** 舊 checkpoint 記錄 chapter-0001 檔名
- **WHEN** 服務載入並恢復
- **THEN** WCF MUST 沿用原有檔案與連結，不自動重新命名
