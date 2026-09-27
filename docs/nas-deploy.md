# NAS 部署

部署前請先在 NAS 啟動 Local Gateway 與 Chrome Bridge，讓兩個
internal Docker networks 都已存在。首次部署可使用
`-InitializeRemoteConfig` 明確傳送本機被忽略的 `.env`；後續部署會優先
沿用 NAS 專案目錄內既有的 `.env`。`.env` 不會進入部署封裝或 Git。

WCF 不需要設定 Bridge URL、callback URL 或 host port。Bridge API 固定使用
`http://nas-bridge:8788`，callback 固定使用
`http://web-content-fetch:8092/api/bridge/callback`；兩者只在各自的
internal Docker networks 內解析。`-InitializeRemoteConfig` 只會傳送本機
`.env`，不會改寫它。部署會拒絕缺少或不是 internal 的 Gateway networks，
並透過容器 health status 與 Gateway route 檢查服務，不依賴主機發布 8092。

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
