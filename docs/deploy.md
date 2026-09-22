# Web Content Fetch 部署

使用專案內的 `scripts/Deploy.ps1` 進行可重複的本機 Docker Compose 部署。

預覽與驗證 Compose 設定：

```powershell
.\scripts\Deploy.ps1
```

確認後建立映像、執行容器內測試、啟動服務並等待 healthz：

```powershell
.\scripts\Deploy.ps1 -ConfirmDeploy
```

若已經有要使用的映像，可略過 build；若只需要快速重啟，也可略過測試：

```powershell
.\scripts\Deploy.ps1 -ConfirmDeploy -SkipBuild -SkipTests
```

腳本固定使用本專案的 Compose 與 `web-content-fetch` service，不讀取或傳送
credential，不刪除 state/output named volume，也不執行全域 Docker cleanup。
