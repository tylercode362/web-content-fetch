# 漫畫逐章輸出與佇列清理

## ADDED Requirements

### Requirement: 漫畫章節完成即發布輸出

漫畫工作每完成一個章節或卷，系統 MUST 發布該章的原始 EPUB 與 KEPUB，並在同一個 job 的狀態回應中提供下載資訊；不得要求整部作品先完成才可下載已完成章節。

#### Scenario: 章節完成後可下載

- **GIVEN** 漫畫 job 已完成第 N 章的圖片取得與 EPUB／KEPUB 驗證
- **WHEN** 編排器進入下一章
- **THEN** job 的輸出群組包含第 N 章的 EPUB 與 KEPUB
- **AND** SSE／state 回應包含兩個同源下載連結

### Requirement: 漫畫輸出可單章或全部下載

系統 MUST 提供單一章節／卷的 EPUB／KEPUB 連結，並提供同一 job 已發布輸出的 ZIP 全部下載連結；小說既有輸出契約 MUST 維持不變。

#### Scenario: 下載全部已完成漫畫章節

- **GIVEN** 漫畫 job 已發布至少一個章節輸出
- **WHEN** 使用者選擇下載全部
- **THEN** 系統回傳只包含該 job 已發布 EPUB／KEPUB 的 ZIP

### Requirement: 漫畫恢復使用已發布輸出

系統 MUST 將已發布章節檔案納入 checkpoint；恢復時檔案完整存在就跳過該章，缺少任一檔案才重新處理。

#### Scenario: 工作恢復不重抓已完成章節

- **GIVEN** job 在第 N 章後中斷，且第 N 章的兩個發布檔案仍存在
- **WHEN** 使用者恢復 job
- **THEN** 編排器跳過第 N 章並繼續下一個未完成章節

### Requirement: 清除紀錄同步清除檔案

系統 MUST 提供清除所有已結束工作紀錄的操作，並刪除每個被清除工作關聯的輸出、checkpoint 與 stage；執行中或未結束工作 MUST 保留。

#### Scenario: 清除已結束工作

- **GIVEN** queue 同時含 complete、error、cancelled 與 running 工作
- **WHEN** 使用者確認清除已結束紀錄
- **THEN** complete、error、cancelled 的記錄與關聯檔案都被刪除
- **AND** running 工作與其暫存資料不被刪除

### Requirement: 佇列 UI 顯示可操作進度

UI MUST 顯示統計、可讀進度、目標名稱與網址、Bridge 狀態、錯誤、單章輸出與工作操作；既有配對、SSE、暫停、恢復、取消與刪除行為 MUST 維持。

#### Scenario: UI 顯示已完成章節與清理入口

- **GIVEN** queue 有一個執行中的漫畫 job 與一個已完成 job
- **WHEN** 使用者開啟任務頁
- **THEN** UI 顯示各 job 的可讀進度、目標網址、狀態與操作按鈕
- **AND** 已完成 job 顯示逐章下載與全部下載入口
- **AND** UI 顯示清除已結束紀錄的入口

### Requirement: 輸出下載與清理必須限制在工作範圍

系統 MUST 拒絕穿越 output root、非該 job 的檔案、非 EPUB／KEPUB 檔案與不完整檔案；清除已結束紀錄時 MUST 同時刪除該 job 的輸出、checkpoint 與 stage，但 MUST NOT 刪除其他 job 或執行中 job 的檔案。

#### Scenario: 跨工作或穿越路徑的全部下載被拒絕

- **GIVEN** 使用者請求不存在 job 或嘗試以不可信檔名組成 ZIP
- **WHEN** Web Content Fetch 建立全部下載串流
- **THEN** 系統回傳錯誤且不讀取 output root 之外的檔案

### Requirement: 進度重連使用持久化快照

SSE reconnect MUST 重新取得 persisted job snapshot；事件遺失不得讓已發布的章節下載連結消失。

#### Scenario: SSE 重連保留已完成章節

- **GIVEN** 漫畫 job 已發布一個章節後瀏覽器暫時斷線
- **WHEN** UI 重新連線並讀取 `/api/state`
- **THEN** 已完成章節的輸出群組與下載連結仍存在

### Requirement: 不可信內容與廣告 fail-closed

系統 MUST 維持 Bridge extraction 與 EPUB writer 的廣告／overlay 排除與 missing-asset fail-closed 行為；不得因 UI 或逐章發布而把未驗證的 HTML、圖片或廣告寫入輸出。

#### Scenario: 缺少圖片證據不發布章節檔案

- **GIVEN** 漫畫章節包含 lazy-load 或 next 圖片但 Bridge 沒有回傳完整 verified asset bytes
- **WHEN** 該章準備發布 EPUB／KEPUB
- **THEN** 該章工作失敗或保留可恢復狀態
- **AND** 不產生可下載的半成品章節檔案
