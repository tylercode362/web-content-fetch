# Tasks

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
