# Proposal: Clear failed and cancelled jobs only

目前佇列頁的批次清理按鈕會刪除所有 terminal job，包含已成功完成與已取消的工作。這不符合保留成功下載紀錄的需求，也容易誤刪可用輸出。

本變更將批次清理範圍限制為 `error` 與 `cancelled` 工作，更新按鈕與確認文字；完成工作仍保留在列表，使用者仍可透過單筆刪除操作明確移除它們。既有 `clear-terminal` API route 保留為相容別名，但行為同樣只清除失敗與已取消工作。
