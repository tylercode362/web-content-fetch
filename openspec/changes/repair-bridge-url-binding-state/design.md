# Design

The `/api/config` handler compares the normalized requested URL with the active binding URL. When the URL changes, it clears `serviceCredential`, `browserClientId`, and `expectedFingerprint`, updates the binding timestamp, and returns `rebindRequired: true`. The service UUID and binding UUID remain stable so the user can pair the same WCF browser service with the selected Bridge.

The UI uses the response flag to show that a new six-digit code is required. Pairing remains the only operation that restores the credential and browser identity. Existing configuration and callback validation remain unchanged.
