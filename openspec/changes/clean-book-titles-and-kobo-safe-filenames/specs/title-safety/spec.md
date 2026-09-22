# Title safety

## ADDED Requirements

### Requirement: Source titles are normalized before persistence and output

系統 MUST 移除來源書名中的已知網站／平台尾綴、URL、domain、控制字元與檔名不安全特殊符號，並限制清理後標題長度；小說與漫畫的 job title、EPUB metadata 與章節標題 MUST 使用清理後值。

#### Scenario: Novel title contains platform suffixes

- **GIVEN** Bridge 回傳包含「小說線上看」、作者／出版社與平台名稱的小說標題
- **WHEN** job 建立 EPUB／KEPUB
- **THEN** job 與 EPUB metadata MUST 只保留作品識別名稱，不得包含平台尾綴

#### Scenario: Manga title contains site suffixes

- **GIVEN** Bridge 回傳包含「最新漫畫」、「看漫畫」、「無限動漫」或 `8comic.com` 的漫畫標題
- **WHEN** job 建立逐章 EPUB／KEPUB
- **THEN** job、章節 metadata 與下載顯示名稱 MUST 不包含這些網站尾綴

### Requirement: Output filenames are short and Kobo-safe

小說與漫畫輸出檔名 MUST 使用清理後書名產生；檔名 stem MUST 有固定長度上限，且只可包含 Unicode 文字、數字與連字號。EPUB 與對應 KEPUB MUST 共用相同 stem。

#### Scenario: Special characters are present

- **GIVEN** 書名包含 URL、斜線、冒號、括號、引號、控制字元或其他特殊符號
- **WHEN** 系統產生輸出檔案
- **THEN** EPUB／KEPUB 檔名 MUST 不含這些符號，且 MUST 能通過既有安全下載路徑規則

### Requirement: Existing published outputs are preserved

標題清理更新 MUST NOT 自動重新命名既有已發布檔案或刪除既有 job；只有新產生或重建的輸出使用清理後名稱。

#### Scenario: Service restarts with old jobs

- **GIVEN** state 中存在舊版 job 與已發布輸出
- **WHEN** 新版服務啟動
- **THEN** 舊輸出連結 MUST 維持可用，且服務 MUST 不執行全域檔案重新命名
