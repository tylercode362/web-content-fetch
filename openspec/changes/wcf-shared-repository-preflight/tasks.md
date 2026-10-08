# Tasks

## 相容 runtime 依賴安全修補
- [x] 已核對官方 sharp 0.35.5 tarball SRI 與完整 prebuilt 依賴閉包的 registry metadata，更新原 `^0.35.4` 約束內的 lock；其27個 entries 保留既有修補。此項只代表來源修補完成。
- [x] 已核對官方 source-map-js 1.2.2 tarball SRI，在 PostCSS 的 `^1.2.1` 約束內只更新該 entry 的 version、resolved 與 integrity；package.json、其餘依賴 entries、產品程式與圖片格式政策均未變。此項只代表來源修補完成。
- [x] root 回報對合併 sharp／source-map-js 修補後的 v1 候選完成獨立雲端 fresh installed audit 與 omit-dev audit，均為零 findings，129條依賴 edges 相容；此結果不取代正式容器驗證。
- [x] root 回報 v1 雲端 EPUB 圖片回歸6/6、format/reject9/9、安全9/9與 strict32/32通過；來源報告為 Library `libfile_c513d6b8e4a4819190e0460c1cd256f3`。這些結果限於 v1 候選，不代表後續提交已執行正式 Docker gates。
- [x] 已以 parent `5fc94302c635497bda70fd8734bcf80461bddd5c` 加 v1 patch `7a80a4320bc0bf96668c8b7f1b1999dc446513ee6695e5545f322b95c2c30279` 的隔離快照完成容器 npm ci 與原完整 npm test：77 passed、0 failed、0 skipped，exit 0。測試 image 為 `sha256:84cd7d49e74487829c6c6c0e309dd4e9d617696b923bc111422af205c10b97f7`；實際 sharp 0.35.5、source-map-js 1.2.2，lock SHA256 `ff889d4eea108117bd9b72daac8fcd0bbaffe0ce988cbb5b460485dd53777528` 未變。read-only rootfs 與受限 HOME tmpfs 保留；外部 reviewed module blob `9a5008ebed750b8851c467827aee852fb12c513b` 以原檔名唯讀掛載。原 EROFS、錯誤模組掛載檔名的 RED 均保留於 Git 外；parent 與 v1 的兩項部署測試亦各為2 passed、0 failed、0 skipped，未修改產品或 fixture。
- [x] 同一 v1 快照以 repo 既有 tools image `sha256:5b22436776c8149612f20da8c5430f8bb71216d898823af955b8090ead0afafc` 執行全庫 OpenSpec strict：32 passed、0 failed，exit 0。這些結果綁定 v1 來源，不宣稱後續文件提交已重跑。
- [ ] 其餘品質／secret scan、NAS 與部署 gates 仍未結案；本項非 main 或部署批准，不宣稱 main-ready。

## Updater verification

- [x] RED/GREEN: exercise the real `updater/lib/repository-polling.mjs` producer through `updater/project.json` for missing, confirmed-pin, and pinned `host-status` stdout; assert missing scope and wrong project producer arguments reject. This is producer-only coverage.
- [x] Sync the project-scoped producer responses to the canonical shared polling contract without changing Dockerfile, project manifest, Compose, or security guards.
- [ ] VERIFY (NAS-only): run the existing standalone updater image/digest upgrade with `--no-build --pull never`, preserve config/keys/state/status, and capture a real `project: web-content-fetch` `host-status`; this source review does not perform that operation.
- [ ] Keep absent-updater manual bootstrap, old-installed-producer upgrade, and legacy-central owner migration as separate gates; do not treat app checkout, Gateway-module updates, or scheduler stop as protocol upgrade.

- [x] Wire WCF deployment to the installed shared module with fixed project and repository arguments and separate host-pin parameters.
- [x] Distinguish NAS SSH identity, the GitHub.com host key pin stored on the NAS, and repository-key authorization.
- [x] Document module path, updater-store prerequisites, and owner confirmations.
- [x] Add synthetic coverage of the actual deployment preflight statements and shared-module negative cases.
- [x] Run PowerShell 7.4.11 parsing and synthetic runtime checks against the reviewed module; current logs cover missing module, missing/mismatched GitHub.com pin, missing key, fixed repository, and strict-binding regression.
- [x] Run OpenSpec 1.8.0 strict validation for this change and deploy-web-content-fetch-nas in the isolated source snapshot; both pass. This is not repository-wide validation.
- [x] Run four targeted Node checks with zero skips, patch whitespace/apply checks, and source/hash checks; preserve the original handoff manifest discrepancy.
- [x] Root reviewed and approved the eight-file source-only candidate for publication; this limited review does not satisfy the broader verification or NAS runtime gates.
- [ ] Complete the repository-required broader verification gates before claiming deployment readiness.

Historical completion marks are not evidence for this revised candidate. NAS runtime, key metadata, and polling have not been verified. No deployment or NAS modification is part of this candidate review.

- [x] Central consumer evidence: Gateway commit `e0ec726970aa4dd1766996364d38b8664ab8a696`, module `scripts/Repository-DeploySetup.psm1` blob `9a5008ebed750b8851c467827aee852fb12c513b`; `pwsh -NoLogo -NoProfile -NonInteractive -File tests/powershell/Repository-DeploySetup.Tests.ps1` exits 0, covering missing/wrong-project host-status and pin receipts plus successful pinning. This is shared-module offline evidence, not proof of the module installed on NAS or this application's external module integration. No local module was added.
- [ ] Verify the externally supplied module identity and installed version during the separately authorized integration/deployment gate.

- [x] Reverify actual app preflight against canonical module 9a5008ebed750b8851c467827aee852fb12c513b: preserve Red, align opt-in ordering and scoped fixtures, retain missing/wrong-project and strict/manual-bootstrap cases. Offline integration only; no installed NAS acceptance.

Focused evidence: Node/Pwsh offline integration plus producer: 5 passed, 0 failed, 0 skipped; canonical module is unchanged. Negative cases include missing/wrong host-status project, missing/wrong repository project, missing/mismatched host pin, missing key without opt-in, and unsupported Repository parameter. Explicit scoped missing-key bootstrap returns a bounded manual receipt without trust/key/polling effects. Installed module identity/version and broader gates remain pending.
