# 工作項目與驗證

- [x] 建立取消復原與其他工作保留的回歸測試，先確認 RED。
- [x] 實作僅限 Bridge 執行個體變更的取消復原，保留原操作身分與新執行個體確認證據。
- [x] WCF 版本升為 0.8.2，package 與 lockfile 同步，套件解析版本不變。
- [x] 執行完整隔離測試、跨 Bridge 協定測試、Compose、OpenSpec、依賴及隱私檢查。
- [x] 驗證實際正式映像內容與 runtime，核對沒有活動下載工作後僅更新 WCF。
- [x] 確認原工作已安全取消並刪除，其他工作與檔案保持不變。

## 測試環境與結果（2026-10-16）

來源基底為 main `b69b24bc1ee8252b930b1e18fe48fdf90790845a`。使用 Node v22.22.1、既有 WCF 測試映像 `7187f2e77587`、Bridge 測試映像 `abae12c3534d` 與 OpenSpec 1.8.0。隔離測試使用 network none、non-root、唯讀來源及暫存資料；不掛載正式 state／output。

- RED：修正測試 fixture 的 Map 使用方式後，新增測試為 10 pass／1 fail；成功情境因原產品回報 `content_operation_server_changed` 失敗。
- 完整回歸：`node --test --test-concurrency=1 test/*.test.js`，149 tests，147 pass、0 fail、2 個既有 PowerShell 平台 skip，exit 0。測試在容器暫存來源副本執行；HOME 使用 UID/GID 10001、mode 0700 的 tmpfs。沒有放寬既有測試的安全目錄或啟動期限。
- 跨 repo：`node test/fixtures/pending-cancel-bridge-roundtrip.cjs`，四項 PASS、exit 0。使用真實 Bridge registry、ContentFetchService、SecureBrowserService、Noise／HTTP 與合成 Extension；涵蓋等待 release、延遲 create、conflict 不可作為終止證據，以及新執行個體取消不影響另一個執行中的 holder。明確設定 BRIDGE_SOURCE=/workspace/bridge、BRIDGE_DEPENDENCIES=/app/node_modules、TS_NODE_PROJECT=/workspace/bridge/tsconfig.json。
- Compose：`docker compose config --quiet`，exit 0。
- OpenSpec：`/opt/openspec/node_modules/.bin/openspec validate --all --strict`，40 pass、0 fail，exit 0。
- 正式依賴：`npm audit --omit=dev --package-lock-only --cache /tmp/npm-cache --registry=https://registry.npmjs.org`，0 個弱點，exit 0；未升級 npm 或依賴。
- 變更檔案的私鑰、常見 token 與含密碼 URL 模式檢查未命中；原始日誌、復原副本、配對憑證與工作內容不納入 Git。

專案未提供 formatter、lint 或 JavaScript typecheck 指令，不以語法或 Node 測試宣稱這些檢查通過。未新增 UI、實體裝置或真實網站下載驗收；合成 Extension 測試不代表真實網站下載驗收。

## 正式映像與本機套用

- 使用正式 Dockerfile 的建置副本，唯一差異為將相依安裝改為 `npm ci --omit=dev --no-audit`；沒有修改原 Dockerfile。獨立依賴稽核另行執行並通過。
- 正常完成的建置指令為 `docker build --provenance=false --network=default --target runtime -f exports/cancel-recovery-noaudit.Dockerfile -t web-content-fetch:cancel-recovery-0.8.2-final .`，exit 0。未完成的早期 Docker 呼叫不列為通過證據。
- 部署 image index：`sha256:27d622ee1b24a3ebd2f2e5ac116fc91d62ef4edd9fc0444214a90a8efc42c5b1`；平台 manifest：`sha256:2ddabe428b59ed11fc1e2275e3bd0dde1f9d0f4d5d38ce2065d5b89edb8e70a5`；兩者指向相同 runtime config `sha256:3167b1092d347703eae0a72a8f6185890932f5894c7256543fb8e1b982a4c77f`。
- 對實際不可變映像執行 `node /verify-production-image.cjs`，productionContent pass、version 0.8.2、42 個 runtime 套件，exit 0；未含測試／開發工具或套件管理器。
- 同一 runtime 的隔離 smoke 確認映像內修正程式與工作目錄一致、合成空資料的 health 與 jobs API 通過，exit 0。
- 本機僅替換 WCF，保留原兩個 named volume、環境、hardening、restart policy 與 internal network。未對 Bridge／Gateway 發送重啟操作，未部署至 NAS。
- Docker 曾在移除已停止的舊 WCF 容器時等待。確認舊容器 PID 0 及新容器身分／掛載正確後，啟動已建立的新容器恢復入口；舊容器由 Docker 自行清理，再恢復正式名稱，StartedAt 不變，沒有再次重啟 WCF。
- 最終正式容器名稱為 `web-content-fetch-web-content-fetch-1`，version 0.8.2、health healthy，Gateway health HTTP 200。

## 實際取消與資料保留

- 原操作因 server instance 變更而復原成功：保留原 requestId／serverInstanceId，新確認身分不同，cancellation reason 為 server_changed。
- 原工作先成為 cancelled、diagnostic null，再透過 exact Origin／server-issued CSRF 的正式 delete API 刪除。已直接核對持久 jobs.json、checkpoint 與 staging，確認指定紀錄及所屬路徑不存在。
- 其餘兩筆工作的 canonical 雜湊、其他三份 state 檔及兩份 output 檔的 SHA-256 前後完全相同；未清除既有失敗工作或重新下載。
- 本機復原副本、部署核對腳本及原始驗證紀錄保留於 Git 忽略的 exports。未將它們視為發布產物或提交內容。
