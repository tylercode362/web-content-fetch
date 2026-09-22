# Public output filenames

## Requirement: New download filenames omit job UUIDs

新產生的小說與漫畫 EPUB／KEPUB 公開檔名 MUST 使用清理後書名與章節名稱，且不得包含 job UUID 或其他內部工作識別值。

### Scenario: Manga chapter output

- **WHEN** 系統發布新的漫畫章節 EPUB 與 KEPUB
- **THEN** 檔名 MUST 使用 `書名-chapter-章節號.epub` 與相同 stem 的 `.kepub.epub`
- **AND** 檔名 MUST NOT 包含 job UUID

## Requirement: Same-name outputs do not overwrite one another

若 output 目錄已有相同公開檔名，系統 MUST 保留既有檔案，並為新輸出加入短數字尾碼；同一組 EPUB／KEPUB MUST 使用相同尾碼。

### Scenario: Duplicate book download

- **GIVEN** 另一個 job 已發布相同書名與章節的輸出
- **WHEN** 新 job 發布相同檔名
- **THEN** 新檔案 MUST 使用 `-2` 或下一個可用數字尾碼
- **AND** 既有檔案內容 MUST 保持不變

## Requirement: Existing links remain stable

服務升級 MUST NOT 自動重新命名既有已發布檔案；舊 job 的輸出連結與刪除流程 MUST 維持可用。
