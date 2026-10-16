# 設計

WCF 仍是工作與檔案狀態的唯一管理者。只有原操作查詢明確回報執行個體變更時，才進入復原分支；一般 unknown、expired、conflict 與傳輸錯誤沿用原有保留資料行為。

復原沿用獨立取消用戶端與同一個 15 秒預算。要求綁定指紋、服務與瀏覽器身分一致，已驗證的新執行個體不同於舊值；透過現有 browser.clients.list 確認指定瀏覽器在線，再對原 job operationKey 取消並確認 cancelled=false。最後重查舊身分仍回報 server_changed，並核對用戶端執行個體未變。這些請求不建立瀏覽器工作、不要求所有資源閒置、不碰其他 operationKey。新執行個體不會接納舊執行個體的延遲 create。

成功時保留原 requestId／serverInstanceId，標記該操作 cancelled 並記錄 confirmedServerInstanceId，再執行既有受路徑檢查限制的工作檔案清理。失敗、瀏覽器離線、目前操作仍活動、綁定不符或再次重啟時保留檔案，允許使用者重試取消。

不採用直接清空 contentOperation、把所有錯誤視為取消完成、重新下載、取消整個服務或重啟容器。部署前須確認沒有活動工作；隔離測試不得掛載正式 state／output。
