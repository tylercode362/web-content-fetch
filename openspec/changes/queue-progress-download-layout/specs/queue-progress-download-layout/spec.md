# Queue progress and download layout

## Requirement: job uses a single vertical content flow

工作佇列的每個 job MUST 以單欄垂直流程顯示進度、可下載檔案與工作操作。

### Scenario: download files appear below progress

- **GIVEN** job 有進度資料或已發布 EPUB／KEPUB
- **WHEN** UI 渲染 job 詳細內容
- **THEN** 進度列 MUST 位於可下載檔案區上方
- **AND** 可下載檔案區 MUST NOT 佔用進度右側欄位
- **AND** 既有逐章／逐卷連結與全部下載連結 MUST 保持可用

## Requirement: chapter progress is always visible

UI MUST 持續顯示已完成章節數與總章節數；圖片頁數進度不得取代章節進度。

### Scenario: image fetching still shows chapter counts

- **GIVEN** 漫畫正在取得某章的圖片
- **WHEN** `progress` 同時包含 `completed`、`total`、`chapter` 與 `image`
- **THEN** UI MUST 顯示 `completed / total` 的章節進度
- **AND** UI MAY 顯示目前章節與圖片作為輔助細節
- **AND** 進度條 MUST 以完成章節／總章節計算
- **AND** 漫畫 UI MUST 另外顯示目前章節圖片已下載／圖片總數的獨立進度
- **AND** 圖片完成但 EPUB 尚未產生時，獨立進度 MUST 顯示圖片已完成與產檔中狀態

### Scenario: Bridge batch progress does not overwrite chapter progress

- **GIVEN** WCF 正在第 6 / 8 章處理一批 8 張圖片
- **AND** Bridge callback 回報 `assets_verified` 的 `6 / 8`
- **WHEN** WCF 更新持久化 job 狀態
- **THEN** 整體章節進度 MUST 仍為 5 / 8 已完成、目前第 6 章
- **AND** 目前章節進度 MUST 顯示該批次的 6 / 8 張圖片
- **AND** Bridge callback 的批次計數 MUST NOT 被寫入 job 的整體 `completed`／`total`

### Scenario: total chapter count is not known yet

- **GIVEN** job 尚未取得章節清單
- **WHEN** UI 渲染 queued 或初始化 job
- **THEN** 已完成章節 MUST 顯示為 0
- **AND** 總章節 MUST 顯示為 `-` 或等價的未知狀態
