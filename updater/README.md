# web-content-fetch: independent repository updater

## Updater contract compatibility gate

The project updater is a separately installed service. Application source, the shared Gateway module, or stopping its scheduler never upgrades the updater protocol.

Classify the host before an application deployment:

1. **Updater absent:** retain the existing first-application-deployment path. The application may continue with its explicit missing-updater opt-in, without creating updater keys, host pins, state, or a polling schedule.
2. **Old updater installed:** upgrade the standalone updater first through the existing reviewed Compose/image-digest flow, with `--no-build --pull never`. Preserve its config, keys, state, and deployment-status data. Then run the real project-scoped `host-status`; continue only when the response is successful and contains `project: web-content-fetch`. An app checkout, Gateway-module update, or scheduler stop is not an updater protocol upgrade.
3. **Legacy central updater:** use the existing owner-migration procedure to establish independent ownership. If the project is already owned, do not rerun migration as a substitute for a producer-version upgrade.

This source-level change and its focused regression do not perform the NAS image/digest upgrade or prove live host output. Do not claim the host is recovered until that separate procedure and real `host-status` check have succeeded.

## Source and consumer verification scope

Run the focused producer regression from the repository root:

```sh
node --test test/repository-polling-producer.test.js
```

The focused result was 1 passed, 0 failed, and 0 skipped in the reviewed Linux
container. WCF's `npm test` uses `node --test test/*.test.js`, so the focused
file is included by that wildcard. The local deployment script delegates to an
externally supplied shared module; no local consumer test proves that missing
or wrong `project` fields in `host-status` or pin receipts are rejected. That
consumer check remains pending against the installed module.

這是 `web-content-fetch` 的獨立 updater。它只在 owner 明確啟用後，每 300 秒確認一次 GitHub `main`；它不掛 Docker socket，不執行來源 Dockerfile，也不取得應用程式 credential。請把本目錄獨立安裝在 `/volume1/docker/web-content-fetch-updater`。

`/volume1/docker/web-content-fetch-updater-store` 下的 config、keys、state、status 必須是該專案自己的 0700/0600 store。缺少 updater `.env` metadata、deploy key 或 GitHub host pin 時，setup 會詢問；按 Enter 的 skip 只代表不啟用自動檢查與自動部署，不會偽造 contract。既有損壞、錯誤 repository、錯誤 host pin 或 partial key 仍會停止。

自動部署只會將 exact-main archive 交給外部、owner 安裝的 immutable release supervisor。supervisor 必須先有固定 `web-content-fetch` template、digest image、review record、健康 baseline 與 rollback state，並以 `--no-build --pull never` 切換；本 updater 本身不會 build、pull 或重啟應用程式。

實際 image provenance、NAS 權限、GitHub read-only key、Docker health、rollback 與 DSM service 安裝仍須由 owner 另行驗證。本次程式變更沒有連線 NAS、建立 key 或啟用排程。
## Central consumer evidence — 2026-10-07

Central consumer evidence: Gateway commit `e0ec726970aa4dd1766996364d38b8664ab8a696`, module `scripts/Repository-DeploySetup.psm1` blob `9a5008ebed750b8851c467827aee852fb12c513b`; `pwsh -NoLogo -NoProfile -NonInteractive -File tests/powershell/Repository-DeploySetup.Tests.ps1` exits 0, covering missing/wrong-project host-status and pin receipts plus successful pinning. This is shared-module offline evidence, not proof of the module installed on NAS or this application's external module integration. No local module was added.

This supersedes the missing central consumer evidence stated below; local integration remains unverified.
