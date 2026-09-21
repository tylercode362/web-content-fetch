# Tasks

## RED — contracts and migration

- [x] Add multi-binding config/job schema and flat-config migration fixture.
- [x] Add additive `content.cancel` request/response contract and operationKey validation.
- [x] Add negative tests for credential redaction, wrong binding, unknown operation and terminal cancellation.

## GREEN — vertical slice

- [x] Persist multiple bindings and expose active binding selection in the UI/API.
- [x] Route each job through its immutable binding and show Bridge/browser/service UUID metadata.
- [x] Implement queued and running cancellation with bounded cooperative fallback.
- [x] Implement Bridge active-operation registry and Extension-owned-tab cancellation.

## REFACTOR — compatibility

- [x] Preserve flat `/api/state.binding` projection and migrate existing jobs safely.
- [x] Keep existing Browser Read, Threads, X and YouTube paths untouched; update additive protocol tests only.
- [x] Keep callback and output state transitions fail-closed.

## VERIFY

- [x] Run WCF unit/API tests, Chrome Bridge focused tests and existing regression suites.
- [x] Run Compose config and OpenSpec strict validation for WCF and the new Chrome Bridge change.
- [x] Scan logs and public snapshots for credential/pairing-code leakage.
- [x] Add bounded per-binding parallel scheduling for different FQDN jobs with independent Bridge sessions.
- [x] Preserve existing service bindings when a trusted local Extension adds a known supported-site capability; add regression coverage for the no-repair requirement.
- [x] Add regression coverage for concurrent novel and manga jobs.
- [x] Add persisted novel/manga checkpoints and restart recovery.
- [x] Add pause/resume controls and cooperative Bridge cancellation.
- [x] Delete job-scoped partial files when cancelling.
