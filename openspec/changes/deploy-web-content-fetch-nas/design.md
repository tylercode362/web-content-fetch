# Design

WCF NAS overlay 加入兩個固定 external network：

- local-gateway-chrome-bridge：連到 nas-bridge:8788。
- local-gateway-web-content-fetch：讓 Local Gateway 代理 web-content-fetch:8092。

Bridge 與 WCF 共用 `local-gateway-chrome-bridge`。使用者可在 UI 填入
Gateway 公開的 `/web-content-fetch/api/bridge/callback`；WCF 只接受此固定
路徑與部署時設定的 Gateway host，儲存前轉成共用 network 內的
`http://web-content-fetch:8092/api/bridge/callback`。Chrome Bridge 只允許
`web-content-fetch` 作為此 callback 的 Docker host。

NAS 的 `.env` 不進入封裝。既有部署優先沿用 NAS 專案目錄內的設定；首次
部署只有在指定 `-InitializeRemoteConfig` 時，才會把本機被忽略的 `.env`
傳到 staging，先將 Bridge 與 callback 設定正規化為 NAS 服務位址，並依
`-NasHost` 設定唯一允許的 Gateway callback origin，再以 `0600` 複製到新專案。
部署腳本先以 staging 驗證
Compose，再備份既有來源，最後只重新建立 web-content-fetch。失敗時保留
staging 與 backup，並嘗試恢復舊來源；不執行全域 Docker 清理。
