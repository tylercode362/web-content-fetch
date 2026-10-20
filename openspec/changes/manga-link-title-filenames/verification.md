# 驗證紀錄

日期：2026-10-20（臺灣時間）。專案 `D:/projects/web-content-fetch`，分支 `main`，修改前 HEAD 與本機 `origin/main` 為 `7c832e47ac9d2a7119716d399d6b32a131b21205`。只有一個 worktree；初次驗證時未 fetch、提交、推送、同步或部署，當時未確認遠端即時 SHA。

## 結果

- RED：舊 0.8.5 映像搭配唯讀來源執行 `node --test test/epub-writer.test.js`，八項中三項失敗，分別捕捉序號檔名、未轉繁體與中文長檔名超限。
- GREEN：`docker build --target test -t web-content-fetch:manga-link-names-0.8.6-test .` 成功。以目前來源唯讀掛載 `/workspace`、`NODE_PATH=/app/node_modules`，在無網路、768 MiB、128 PID、唯讀 rootfs 與獨立 tmpfs `/tmp`、`/home/app` 執行 `node --test --test-reporter=dot --test-concurrency=2 test/*.test.js`，exit 0。涵蓋來源連結優先於閱讀器誤標、混合卷／話、繁體、長名稱、同工作重名、舊檔名與 checkpoint 相容性。
- 第一輪完整測試未通過：新匯出尚未加入測試替身，兩項漫畫停止測試未到達等待點；updater 測試所需 home 因唯讀 rootfs 而失敗。補齊替身並提供隔離 home tmpfs 後完整重跑通過；未改產品權限或 updater 程式。
- `docker compose --env-file .env config --quiet`：exit 0。
- `docker compose --env-file .env --profile tools run --rm --build openspec validate manga-link-title-filenames --strict --no-interactive`：OpenSpec 1.8.0，通過。
- `node --check`：輸出層、orchestrator、全部 test JS 與 fixture CJS 通過。`git diff --check` 通過。此 JavaScript 專案未設定 formatter、lint 或 TypeScript typecheck script，本次沒有新增工具，也不將語法檢查稱為 lint／型別檢查。
- 正式 lockfile `npm audit --omit=dev --json`：零弱點。opencc-js 1.4.2 官方 registry metadata 與 lockfile integrity 一致，MIT AND Apache-2.0，無執行期相依套件；完整 lockfile 未發現 Vue 生態系名稱。
- OpenSpec 工具映像建置時 npm 回報四項 high 弱點，屬既有固定開發工具，未執行自動升級；不包含於正式候選映像。
- 既有 Gitleaks 映像 `aa036a2f4bdf` 對 `git diff --no-ext-diff -- .` 執行 `stdin --redact --no-banner`：無秘密發現。新增 OpenSpec 文件另以人工檢查確認未含認證、私人來源內容或工作資料。

## 正式候選映像

`docker build --target runtime -t web-content-fetch:manga-link-names-0.8.6 .` 成功，config digest `sha256:8a646da3da2477e3e19cd1a9d71b7def57b43b6f0791c482c21202c19a6a7b98`。

- 無網路、唯讀 rootfs、256 MiB、64 PID，以唯讀掛載提供 `/verify.cjs` 執行既有 `scripts/verify-production-image.cjs`：productionContent pass、0.8.6、43 個實際套件，正式閉包含 opencc-js，無測試來源、OpenSpec 或套件管理器。
- 同一候選映像僅使用 `/tmp/state` 與 `/tmp/output` 啟動 server，容器內 `/healthz` 通過後結束。這是隔離啟動測試，不是正式部署或真站下載驗收。

本次未接觸 Bridge／Extension／Gateway 程式、既有容器、配對、工作、checkpoint 或輸出。既有已發布檔案不自動改名，新命名須在更新服務後的新產生輸出才會生效。未執行真站或原生瀏覽器驗收。

## main 整合驗證

使用者追加要求全部進 main 後，fetch 確認遠端新增三筆提交，最新為 `e59b271`。本機修正接續於該版本；相依性文件的同位置新增衝突以保留 OpenSpec 與 opencc-js 兩筆條目解決，保留遠端全部更新。

依最新 main 的 Dockerfile 重建獨立 OpenSpec 1.14.3 tools 映像，套件安裝稽核零弱點；再次 strict 驗證本變更通過。與建置同時執行的完整回歸有兩項 HTTP fixture 啟動逾時，未改產品或測試的逾時值，待建置結束後改用 `--test-concurrency=1` 重跑。

整合後完整回歸 `node --test --test-reporter=dot --test-concurrency=1 test/*.test.js` exit 0，包含遠端新增的 OpenSpec 固定版本測試。其餘隔離條件與前述 GREEN 相同。未部署，只有本機 main worktree 需要同步。
