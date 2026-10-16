# 分離 Bridge 綁定設定與工作資料

## Why

需求來源：使用者於 2026-10-10 要求「能夠幫忙分拆移動嗎」，前文指定清除舊專案資料時保留 Chrome Bridge 認證。現況 main 7f9fa4463232a2cbd9edf73fa4697d43e8900f49 的 config.json 與 jobs.json 共用 stateDir；直接移除 state volume 會遺失 credential。

## What Changes

- 新增獨立 config-directory override，以及保留現有配對的 fail-closed 啟動檢查。
- 提供 opt-in Compose overlay 與同環境唯讀複本核對命令；不自動搬移檔案。
- 使用目前 canonical 單一 binding 格式，不新增 legacy fallback 或 migration。未指定新路徑的現行正確預設保留。

## Impact

In scope：設定路徑、原子寫入、移轉前缺檔／毀損／衝突檢查、合成測試與文件。認證協定、配對、credential、fingerprint、ID、授權、queue 與 EPUB 功能不變。

Non-goals：新增認證、重新配對、搬真實秘密、ACL 變更、正式 volume 建立、資料刪除、部署／重啟、瀏覽器 profile 清理。真實環境與存取邊界另經具體核對及確認。

Privacy：檢查只輸出固定結果碼，不輸出 credential、JSON 內容或檔案 hash；秘密不進 Git／雲端。

Rollback：保留原檔；未確認實際身分未變前不得覆寫或刪除新舊資料。停機、掛載回復由已核准的環境操作執行。

Stop conditions：檔案缺失、內容損壞、非 current binding、不同副本、symlink、權限／I/O 錯誤均停止受影響步驟。不能以重配對補成通過。
