# NAS 部署

若固定 updater 已存在但 WCF 專案的 updater .env metadata、deploy key 或 GitHub host pin 缺少，部署前會詢問 owner 是否完成設定。輸入確認字串並完成唯讀 deploy key 註冊後才會啟用該 updater 的自動檢查；在任一提示直接按 Enter 可略過，WCF 應用程式仍照既有 staging、Compose、備份與 health gate 部署，但自動 pull-main container 不會運作。這裡的 updater .env 與應用程式專案目錄內的 .env 是不同設定；InitializeRemoteConfig 只處理後者。


## 共用儲存庫前置檢查的必要條件

WCF 部署腳本預期 `D:\projects\web-content-fetch` 與 `D:\projects\local-gateway` 位於同一層目錄。它會以 `scripts\Deploy-Nas.ps1` 為基準，載入 `..\..\local-gateway\scripts\Repository-DeploySetup.psm1`。部署前須先在該路徑安裝經審查的共用模組；這是由 Local Gateway 維護的執行期相依模組，須取自其經審查的來源。

若這是舊版主機的第一次 WCF 應用程式部署，不必先安裝 updater；本機來源入口會以明確的 AllowMissingUpdater 狀態繼續應用程式 staging、Compose、備份與 health gate，且不會建立 key、host pin、updater store 或 polling。部署成功後，仍須依 Local Gateway 安裝說明另行安裝此專案專用的 updater 與受保護儲存區。預期 updater 根目錄為 /volume1/docker/web-content-fetch-updater，受保護儲存區包含 config、keys、state 與 status。若 updater 已存在但只是缺少設定，可依上一段選擇完成或略過；若是檢查失敗、repository mismatch、pin 不符或不安全狀態，WCF 部署仍會停止；NAS 安裝與整合須由擁有者另行完成設定並驗證。

若固定 updater 已存在，存取儲存庫前 NAS updater 儲存區必須保存已核准的 **GitHub.com SSH 主機金鑰 pin**。這項 pin 用來識別 GitHub.com，不是 NAS 本身；部署主機連線 NAS 的 SSH 主機身分，由共用模組的傳輸層以嚴格主機檢查獨立驗證。缺少 GitHub.com pin 時須由擁有者互動確認；pin 不符時立即停止，不覆寫既有資料。首次設定儲存庫金鑰時，建立 NAS 專用金鑰，以及將其公開金鑰註冊為僅可唯讀存取 `tylercode362/web-content-fetch`，各自需要擁有者確認。若是固定 updater 尚未存在的第一次本機來源部署，明確的 AllowMissingUpdater 只會跳過這些 remote repository checks；`-IdentityFile` 指定的 SSH 身分檔案用來向 NAS 驗證部署主機，與 NAS 持有的 GitHub deploy key 不同；不得傳送或顯示私密金鑰及應用程式憑證。

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
