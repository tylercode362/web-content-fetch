# 設計

## 元件與信任邊界
WCF 以持久保存的 requestId、serverInstanceId 與本機 payload digest 追蹤每個邏輯步驟，短請求輪詢結果，保留 job 級 operationKey 供取消。 WCF 仍為工作佇列與 EPUB 的唯一狀態來源。所有 create／get 都經既有 Noise、service credential 與 browser binding 驗證；查詢結果不依賴瀏覽器在線，但綁定必須仍有效。取消需等原 promise 終止，不能以取消訊息送達當作鎖釋放。

## 協定與資源上限
新增 action 保留 secure protocol version 1。create body 包含 requestId、serverInstanceId、request；get 包含 requestId、serverInstanceId。requestId 為時間戳加不透明 UUID；新請求只接受最近 30 分鐘、最多快 30 秒的 ID，已存在的活動操作可持續查詢。結果保留 30 分鐘，最多 2048 筆 metadata、64 MiB 結果，每筆不超過 secure JSON 上限。過期結果回 expired；metadata 只在 admission 時窗與結果期限皆結束後回收，舊 ID 不得重新執行。重啟後 instance fence 拒絕舊請求。

WCF 每次 HTTP 呼叫最長 15 秒、每 2 秒查詢，總輪詢預算 2 小時加 5 分鐘。每個步驟先持久保存 requestId 與 instance，再送 create；回應遺失仍用相同身分重送。完成結果在下一個不同步驟前保留 pending 記錄，避免 WCF 在寫 checkpoint 前重啟就產生新身分。不同步驟若碰到尚未終止的舊操作，先停止，不能換 key 略過。只有已確認終止的可重試錯誤才可建立下一次嘗試。

## 失敗與拒絕方案
Bridge 不支援新 action 時明確停止，不回退同步請求。unknown／expired／server changed／pending mismatch 均暫停並保留狀態。HTTP 斷線不會取消操作；使用者的暫停／取消沿用獨立控制 session。安全 session 期限不變，輪詢可重新握手。沒有延長 timeout、關閉鎖或隨機換 job key 的替代方案。舊站的 lazy-load、next、overlay 與 missing-asset 檢查全部沿用既有 Flow。
