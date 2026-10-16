# 原生 headless 驗收

`Invoke-NativeUiAcceptance.ps1` 使用指定的 WCF／Bridge 正式映像，建立 internal 測試網路及一次性服務。沒有主機連接埠、正式 volume、個人認證或真實網站。測試完依本次隨機標籤核對後只清除自身容器／網路；保留測試映像與 Git 外的紀錄。

瀏覽器固定為 Microsoft Playwright 官方映像 digest，使用非 root、read-only、cap-drop ALL 與 no-new-privileges。Chromium sandbox 保持啟用；不使用 `--no-sandbox`、SYS_ADMIN 或真實 Chrome／IAB。先從下列固定版本取得官方 seccomp JSON，在 Git 外保存，再使用 `New-ChromiumUiSeccomp.ps1` 核對 SHA256 並生成測試專用設定。唯一額外規則是允許 `chroot` syscall，讓 Chromium 在自身 user namespace 內建立 sandbox；容器外層不授予 CAP_SYS_CHROOT。設定不套用到正式服務。

來源：<https://raw.githubusercontent.com/microsoft/playwright/v1.64.0/utils/docker/seccomp_profile.json>

```powershell
./test/New-ChromiumUiSeccomp.ps1 -OfficialProfile D:/projects/.diagnostics/playwright-seccomp-v1.64.0.json -OutputPath D:/projects/.diagnostics/chromium-ui-seccomp.json
./test/Invoke-NativeUiAcceptance.ps1 -WcfImage wcf-runtime:<sha> -BridgeImage bridge-production:<sha> -SeccompProfile D:/projects/.diagnostics/chromium-ui-seccomp.json -EvidenceDirectory D:/projects/.diagnostics/native-ui-<sha>
```

測試透過 CDP Input 的原生鍵盤、滑鼠與觸控事件操作正式表單及工作卡片，頁面 JavaScript evaluate 只讀取 DOM。斷言涵蓋桌面與平板的建立、暫停、恢復、同一 requestId 不重建、遠端釋放阻塞時仍為取消中、釋放後取消完成及重新載入／SSE 重連。真實 Bridge 的 HTTP、Noise、registry 與 ContentFetchService 都會執行；只有 Extension 的網站與釋放回條為受控合成 fixture。此結果不能宣稱真實漫畫網站下載通過。

加上 `-SeparateConfig` 時，fixture 將 canonical 合成綁定放在獨立 0700 目錄並啟用保留配對模式；每次控制狀態讀取均斷言 credential 檔案位元組不變、原 state 不出現 config.json。這是儲存路徑與原生流程的合成驗證，不搬移正式資料。
