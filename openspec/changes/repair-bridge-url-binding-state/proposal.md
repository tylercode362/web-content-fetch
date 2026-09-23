# Repair Bridge URL binding state

## Why

Saving a different Bridge URL currently changes only the URL while preserving the credential, browser client UUID, and public-key fingerprint from the previous Bridge. The UI can then report a paired binding while requests are sent to a different Bridge instance and fail with `bridge_transport_failed`.

## Scope

- Treat a Bridge URL change as a binding identity change that requires pairing again.
- Clear the old credential, browser client UUID, and expected fingerprint before the new URL is used.
- Tell the UI that a fresh six-digit pairing code is required.
- Preserve the existing service UUID and binding record identity.

## Non-goals

- Do not add a pairing bypass or weaken the six-digit pairing requirement.
- Do not change the Chrome Bridge protocol or existing Threads, X, or YouTube features.
