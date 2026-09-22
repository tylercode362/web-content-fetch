# 漫畫圖片批次下載

## Why

目前每張漫畫圖片都建立一次 `content.fetch` asset 工作。即使 Bridge 的同 FQDN
間隔已降為 2 秒，重複開啟、載入與關閉 Chrome 分頁仍讓單章下載很慢。

## Scope

- 8Comic 同一來源頁的圖片改以每批最多 8 張請求 Chrome Bridge。
- 保留已完成章節 checkpoint；單批失敗由既有 bounded retry 重試整批。
- 既有單張圖片流程與小說流程維持不變。
