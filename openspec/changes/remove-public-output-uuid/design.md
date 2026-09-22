# Design: Remove job UUIDs from public download filenames

`DownloadOrchestrator.publishOutputs` 不再將 job UUID 加到漫畫輸出檔名。輸出檔名沿用 EPUB writer 產生的 Kobo-safe 書名與章節名稱，例如：

```text
阿邦-chapter-0001.epub
阿邦-chapter-0001.kepub.epub
```

發布前會在同一個 process 內序列化檔案名稱配置，檢查 output 目錄與目前 job 已擁有的檔案。若目標檔名已被其他 job 使用，會產生 `-2`、`-3` 等短尾碼；漫畫尾碼放在書名與 `-chapter-xxxx` 之間，保留既有章節分組辨識方式。EPUB 與對應 KEPUB 共用同一個尾碼。

job 的 UUID、checkpoint 路徑與工作併行／恢復機制維持不變。服務升級時不會重新命名既有公開檔案，避免破壞已保存的下載連結。
