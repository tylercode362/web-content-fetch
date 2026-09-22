# 設計

DownloadOrchestrator 只有在章節網址是 8Comic `/view/<id>.html`，且圖片 evidence
全部指向同一個 `pageUrl` 時啟用批次。每批傳送圖片 URL 與頁面來源，Bridge 回傳
等長的 asset 結果；WCF 仍逐張更新 UI 進度，並在完整章節輸出前保留原有安全檢查。

Manhuagui 或跨頁 reader 不使用批次，以避免把不同 reader 頁面誤當作同一個 Chrome
分頁狀態。批次大小固定為 8，避免單一 Noise response 過大，且不改變同 FQDN 單工作
規則、取消、暫停、恢復或 EPUB／KEPUB 產出契約。
