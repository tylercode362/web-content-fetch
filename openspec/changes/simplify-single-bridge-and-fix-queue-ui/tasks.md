## RED

- [ ] Add regression tests for single-binding migration and repeated pairing.
- [ ] Add server/UI tests for CSRF renewal, cleanup response ids, and URL input layout contract.

## GREEN

- [ ] Normalize persisted binding state to one canonical profile with aliases.
- [ ] Update pairing, job loading, and job creation to use the canonical profile.
- [ ] Remove the job binding selector and fix form flex sizing.
- [ ] Add `/api/csrf` and one-retry client synchronization.
- [ ] Make batch cleanup publish and report exact deletion results.

## REFACTOR

- [ ] Remove obsolete multi-binding UI/source paths without changing Bridge protocol compatibility.
- [ ] Synchronize package version and update the security/UI documentation.

## VERIFY

- [ ] Run Compose config, tests, dependency/privacy scans, and strict OpenSpec validation.
- [ ] Verify through the Gateway that adding a job and terminal cleanup no longer returns `csrf_forbidden`.
- [ ] Verify URL input width and one Bridge summary in Chrome without deleting existing user records.
