# NAS 部署

部署前請先在 NAS 啟動 Local Gateway 與 Chrome Bridge，讓
local-gateway-chrome-bridge 已存在。首次部署可使用
`-InitializeRemoteConfig` 明確傳送本機被忽略的 `.env`；後續部署會優先
沿用 NAS 專案目錄內既有的 `.env`。`.env` 不會進入部署封裝或 Git。

NAS `.env` 至少設定：

    WEB_CONTENT_FETCH_BRIDGE_URL=http://nas-bridge:8788
    WEB_CONTENT_FETCH_CALLBACK_URL=http://web-content-fetch:8092/api/bridge/callback
    WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS=host.docker.internal,web-content-fetch
    WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS=http://<NAS_HOST>:8088
    WEB_CONTENT_FETCH_PORT=8092

使用 `-InitializeRemoteConfig` 時，腳本會在暫存副本中將 Bridge 與 callback
改成上述 NAS 位址，並依 `-NasHost` 設定 Gateway callback origin，不會改寫本機 `.env`。
網頁的 Callback URL 可填 `http://<NAS_HOST>:8088/web-content-fetch/api/bridge/callback`；
WCF 只接受部署設定的 Gateway origin，並會轉成 Docker network 內的 callback 位址。

建議順序：

    Set-Location D:\projects\local-gateway
    .\scripts\Deploy-Nas.ps1 -NasHost '<NAS-LAN-IP>' -NasUser '<NAS-USER>' -ConfirmDeploy

    Set-Location D:\projects\chrome-bridge
    .\scripts\Deploy-Nas.ps1 -NasHost '<NAS-LAN-IP>' -NasUser '<NAS-USER>' -UseSudo -ConfirmDeploy

    Set-Location D:\projects\web-content-fetch
    .\scripts\Deploy-Nas.ps1 -NasHost '<NAS-LAN-IP>' -NasUser '<NAS-USER>' `
        -UseSudo -InitializeRemoteConfig -ConfirmDeploy

若 NAS 使用固定的 SSH port 或 identity file，三個腳本都可用
-NasPort 與 -IdentityFile 覆寫。若未指定 `-InitializeRemoteConfig` 且
NAS 尚未有 `.env`，部署會安全停止並保留 recovery/staging 證據。
