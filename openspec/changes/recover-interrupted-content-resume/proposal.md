## Why

使用者回報 tw.manhuagui.com 在第 4 話停止。Bridge 加密連線到期後操作失去回條，服務重啟又使舊 instance 的操作無法直接重播。

## What Changes

- 使用者續跑時，先以既有停止確認流程確認未決操作已停止，再沿用章節與圖片檢查點。
- 不刪除輸出、不變更配對、網站範圍、操作識別檢查或 Bridge 的 queue ownership。
- 隱私影響：不增加認證或內容日誌。相容性：既有同步 API 與輸出契約維持。
- 回復方式：還原程式版本，保留 state 與 output。無法確認停止時維持暫停，不建立新操作。

## Impact

僅影響 web-content-fetch 的續跑前置確認；Chrome Bridge 仍負責瀏覽器操作與連線。
