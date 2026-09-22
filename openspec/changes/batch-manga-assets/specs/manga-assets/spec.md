## ADDED Requirements

### Requirement: bounded manga asset batches

WCF SHALL 對同一個 8Comic 來源頁的漫畫圖片使用不超過 8 張的 Bridge asset batch，
並將回傳圖片依原順序加入章節輸出。

#### Scenario: same-page 8Comic images are batched

GIVEN 章節 evidence 含有同一個 8Comic `pageUrl` 的 9 張圖片
WHEN WCF 取得該章節圖片
THEN WCF SHALL 送出兩批，大小為 8 與 1，且輸出順序保持不變。

#### Scenario: multi-page readers keep legacy path

GIVEN 漫畫 evidence 的圖片來自不同 `pageUrl`
WHEN WCF 取得圖片
THEN WCF SHALL 維持單張 asset 流程，不把不同頁面合併到同一個批次。
