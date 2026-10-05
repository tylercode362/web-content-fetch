## Design

HTTP handler 對 URL 解析及下載解碼做局部驗證，最外層處理非同步拒絕。下載標頭用固定 ASCII fallback，原始檔名只透過 percent-encoded filename* 表示；路徑限制保持不變。

啟動時 running 才可恢復 queued；pausing 成為 paused；cancelling 保留取消旗標並執行原有檔案清理。清理失敗保留 cancelling 與診斷，使用者可再次取消。Bridge 與工作狀態責任不變，不發出新的擷取要求。

CSRF token 只在 bounded store 內且未到期時有效。多分頁持有的已登錄 token 仍有效；重啟或淘汰後透過既有 renew 重取。拒絕無期限 double-submit fallback，而不變更 Origin/session 邊界。
