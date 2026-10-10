- [ ] WCF50-01 串流故障注入 Red／Green、同程序健康檢查。
- [ ] WCF50-02 並行 request body 回歸。
- [ ] WCF50-03 發布 barrier／停止意圖回歸。
- [ ] 正式 Docker、完整測試及既有 Browser Read 相容性驗收。
- [ ] WCF50-04 SSE 背壓／逾時／斷線清理單元回歸；32 個上限與重連實際 Docker 驗證。
- [ ] WCF50-03 漫畫最終清理取消／暫停 barrier Red／Green。
- [ ] WCF50-05 真實暫存檔案第二次更名失敗、部分輸出歸屬與清理 Red／Green。

## 2026-10-10 雲端原生補充驗證

本次只新增驗證紀錄，不修改產品、測試或驗收門檻。2026-10-10 06:48 UTC 再次核對遠端 main，仍為 `d69b9ffec959a66d6a9d621f75cbe444ad067927`。取消提示候選 `6bd25f632222a16e35a66e17c377bcaccfb6b5dc` 與本變更候選 `31887439ea123a96dfbdc590b6cb289a0a8f731b` 均已是 main 的祖先，不再列為待合併候選；已合併不代表所有驗收完成。

- [x] 以該 main SHA 取得根目錄產品、test、scripts 與 updater 所需 57 個檔案；執行前後逐一比對 Git blob SHA，57/57 相符。
- [x] 在 Debian 13 x86_64、Node 24.19.0、npm 11.9.0 執行原始完整 `npm test`：77 項中 75 passed、0 failed、2 skipped，exit 0。跳過的兩項均因 PowerShell runtime 不可用；執行它們另需已審查的外部共享部署模組。
- [x] 上述測試包含 WCF50-01 串流 ENOENT／EIO、WCF50-02 並行 request body、WCF50-03 小說及漫畫發布／清理停止意圖、WCF50-04 背壓／逾時／32 連線上限與重連，以及 WCF50-05 第二次更名失敗與部分輸出清理。HTTP integration 使用實際原生 server 與合成邊界 fixture，不代表真實 Bridge、瀏覽器或 Docker 驗收。
- [x] 原始完整測試亦涵蓋 callback、Origin、CSRF、恢復及 EPUB／KEPUB 生成；本次 EPUB 補充負向與影像邊界檢核 9/9，headless 取消流程三個 viewport 共 15 個檢核通過。範圍與限制另見相關 change 的本日補充紀錄。
- [ ] 補足正式 Docker／Compose config、build、health 與容器安全隔離驗證；本次 Node 版本不同於 Dockerfile 固定的 Node 22.22.1，原生結果不取代權威容器 gate。
- [ ] 補足 PowerShell／外部共享模組兩項測試、既有 Browser Read 相容性、真實 Bridge／Extension 與真實網站最終輸出驗證。
- [ ] 本次未重跑全庫 OpenSpec strict、完整品質與秘密掃描；額外 dependency audit 未取得有效完成結果，不列為通過。

### 相依工具與可核對來源

依 exact lockfile 執行 `npm ci --ignore-scripts --registry=https://registry.npmjs.org`，使用獨立可寫 cache；未更新依賴。lockfile SHA-256 為 `b85ebcc39bcc7edff13c10b0247884a3b8fbb299b0ae25f4ae6ef40002d61cc7`，實際 sharp 為 0.35.5。

KEPUB 使用 [kepubify 官方 v4.0.4 Linux 64-bit 發行版](https://github.com/pgaskin/kepubify/releases/download/v4.0.4/kepubify-linux-64bit)，`--version` 為 v4.0.4；另核對官方 v4.0.4 tag checkout 為 Dockerfile 指定的 `8e959eda11d783041fc03c1a8109275a27f2f2dc`。下載二進位檔 SHA-256 為 `37d7628d26c5c906f607f24b36f781f306075e7073a6fe7820a751bb60431fc5`。此結果不宣稱該發行二進位檔等同本次由 Dockerfile 編譯的映像。

完整測試以獨立可寫 HOME 與 `WEB_CONTENT_FETCH_KEPUBIFY_PATH` 指向上述工具執行。首次 npm cache 路徑不存在、尚未配置 kepubify 時的三項恢復測試失敗，以及 updater 測試使用唯讀 HOME 的失敗均保留；補足測試環境後重跑原始全套，未修改產品或測試以通過。原始 log、截圖、trace 與執行產物保留於 Git 外；本紀錄不代表已部署。上方既有含 RED／GREEN、Docker 或整合要求的未完成項保留原狀，不因本次補充結果整批勾選。
