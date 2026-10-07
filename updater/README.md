# web-content-fetch: independent repository updater

這是 `web-content-fetch` 的獨立 updater。它只在 owner 明確啟用後，每 300 秒確認一次 GitHub `main`；它不掛 Docker socket，不執行來源 Dockerfile，也不取得應用程式 credential。請把本目錄獨立安裝在 `/volume1/docker/web-content-fetch-updater`。

`/volume1/docker/web-content-fetch-updater-store` 下的 config、keys、state、status 必須是該專案自己的 0700/0600 store。缺少 updater `.env` metadata、deploy key 或 GitHub host pin 時，setup 會詢問；按 Enter 的 skip 只代表不啟用自動檢查與自動部署，不會偽造 contract。既有損壞、錯誤 repository、錯誤 host pin 或 partial key 仍會停止。

自動部署只會將 exact-main archive 交給外部、owner 安裝的 immutable release supervisor。supervisor 必須先有固定 `web-content-fetch` template、digest image、review record、健康 baseline 與 rollback state，並以 `--no-build --pull never` 切換；本 updater 本身不會 build、pull 或重啟應用程式。

實際 image provenance、NAS 權限、GitHub read-only key、Docker health、rollback 與 DSM service 安裝仍須由 owner 另行驗證。本次程式變更沒有連線 NAS、建立 key 或啟用排程。
