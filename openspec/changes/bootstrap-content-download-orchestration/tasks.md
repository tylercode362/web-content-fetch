# Tasks

## Bootstrap

- [x] Add package/toolchain and a minimal `/healthz` runtime.
- [x] Add Compose runtime and `tools` OpenSpec profile.
- [x] Add non-root, read-only filesystem, bounded resources and separate state/output volumes.
- [x] Add `.env.example` without secrets and validate Compose configuration.

## Job and pairing

- [x] Define versioned DownloadJob, progress event and diagnostic schemas.
- [x] Implement persisted queue state, idempotent transitions, cancellation and retry limits.
- [x] Implement six-digit pairing, service binding storage, revocation and token redaction.
- [x] Remove the Local Bridge no-code service pairing shortcut and add a regression test that rejects the retired action.
- [x] Bootstrap state/output volume ownership for the non-root runtime and verify persisted configuration can be written.
- [x] Add negative security tests for invalid Origin, expired code, wrong service id and unsupported URL.

## Content workflows

- [x] Implement Bridge client and capability negotiation for additive `content.fetch`.
- [x] Implement chapter-list orchestration and novel single-EPUB output.
- [x] Implement manga chapter-per-EPUB output with one XHTML image sequence per chapter.
- [x] Implement asset download through an explicit allowlisted path; never accept arbitrary image hosts.
- [x] Implement Kobo-oriented image XHTML with inline numeric `width` and `height` on every `img`, bounded viewport metadata and deterministic reading order.
- [x] Implement persisted snapshot recovery with same-origin SSE/EventSource.
- [x] Run fixed `kepubify v4.0.4` after each EPUB and retain both outputs.
- [x] Implement non-loopback, host-allowlisted progress callback with per-job token.

## Verification

- [x] Add synthetic novel and manga fixtures, including next-page and overlay cases.
- [x] Add EPUB fixtures for inline image width/height and reading order.
- [x] Run existing chrome-bridge Threads/X/YouTube regression tests.
- [ ] Run formatter, lint, typecheck, unit/API/E2E tests, Compose config, OpenSpec validation and secret/privacy scan.

The remaining gates are the pre-existing Linovel headless Jest ESM fixture (`novel-e2e.test.ts` fails before output verification unless its dependency runtime is corrected) and user-controlled Chrome Extension pairing plus a real-site smoke job. The Windows Chrome connector was unavailable in this run, so no live-site success is claimed from this checklist.
