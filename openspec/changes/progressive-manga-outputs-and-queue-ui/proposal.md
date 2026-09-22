# 漫畫逐章輸出與佇列介面改善

目前漫畫工作會先把所有章節寫入工作暫存區，直到整個工作結束才發布輸出，因此使用者在長時間下載期間看不到已完成章節的 EPUB／KEPUB 下載連結。現有任務頁也只以單行文字顯示狀態，工作紀錄與檔案清理的界線不夠清楚。

本變更讓漫畫每完成一章或一卷就立即發布該章的 EPUB 與 KEPUB，工作仍保留同一個 job 與恢復能力；使用者可以下載單一章節，也可以按同一工作的全部下載取得 ZIP。佇列頁同步改成卡片式進度檢視，並提供只清除已結束工作且連同相關輸出、暫存與 checkpoint 一起刪除的操作。

漫畫清單上的每一個章節網址視為一章；該網址內的所有 next／下一頁圖片合併到同一個章節檔案。小說既有整部章節集合成一個 EPUB／KEPUB 的契約不變，Chrome Bridge protocol 與既有 Threads、X、YouTube 功能不變。

## Scope

- 漫畫 job 的逐章／逐卷發布、單章下載、全部 ZIP 下載、恢復與取消清理。
- 已結束 job 的紀錄清理與相關檔案清理。
- Web Content Fetch 任務頁的資訊架構、進度、輸出與操作回饋。

## Non-goals

- 不改變 Chrome Bridge 的站點擷取、分頁控制或既有 Threads、X、YouTube API。
- 不把小說拆成多個檔案；小說仍在所有章節完成後輸出一組 EPUB／KEPUB。
- 不提供繞過配對、登入、付費限制、驗證碼或反爬措施的能力。

## Privacy and compatibility impact

下載 ZIP 只讀取目前 job 已發布的 EPUB／KEPUB，不新增 credential、cookie 或原始頁面保存。新增欄位與 endpoint 都是 additive；既有 `downloads`、暫停、恢復、取消、SSE 與 Bridge binding 欄位維持相容。回滾時停止新 worker 並保留既有 output volume，舊版可忽略新增 `outputGroups` 欄位。

## Stop conditions

若任一輸出完整性、路徑安全、CSRF／Origin、Compose、OpenSpec 或既有測試 gate 失敗，不發布新版本、不清除既有 output，並保留可診斷的 job 狀態。
