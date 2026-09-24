# Tasks

- [x] RED: Define page address, delivery address, and legacy migration behavior.
- [x] GREEN: Remove callback controls and details from the settings UI.
- [x] GREEN: Make deployment callback delivery authoritative over saved state.
- [x] GREEN: Stop saving a browser callback URL as a global setting.
- [x] VERIFY: Build Compose image, run synthetic tests, validate Compose and
  OpenSpec, and check that the UI does not expose callback settings.
- [x] VERIFY: Run an isolated settings API smoke test with stale saved state.
- [ ] VERIFY: Deploy to NAS and verify the Gateway UI and Bridge callback
  delivery without interrupting existing jobs.
- [x] GREEN: Make the Bridge client honor binding.bridgeUrl on construction
  and reconfiguration; cover pairing and resumed jobs.
