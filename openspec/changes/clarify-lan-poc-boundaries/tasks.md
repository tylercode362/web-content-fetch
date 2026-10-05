- [x] 1. 核對 CSRF 與 Compose 現況，修正治理文件。
- [x] 2. 執行 CSRF 測試、Compose config 與 OpenSpec strict validation，記錄實際 exit。

驗證：既有 Node image 4f77a690f2f8、OpenSpec image 5b22436776c8，均以 network none 與唯讀掛載執行。CSRF 3/3、Compose config、OpenSpec strict validation 的 exit 均為 0。本切片未修改 runtime，未執行完整產品驗收。
