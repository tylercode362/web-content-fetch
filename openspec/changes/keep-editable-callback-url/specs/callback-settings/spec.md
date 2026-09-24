# Callback address selection

## ADDED Requirements

### Requirement: Keep callback routing internal

The settings UI SHALL NOT request, display, or submit a callback URL. WCF SHALL
select a Bridge-reachable callback route from its deployment configuration.

#### Scenario: Local page

- WHEN the page is opened at http://127.0.0.1:8092/
- THEN the user sees no callback URL control or value
- AND Bridge uses the configured delivery route, never the loopback page URL

#### Scenario: NAS Gateway page

- WHEN the page is opened at
  http://192.168.50.140:8088/web-content-fetch/
- THEN the user sees no callback URL control or value
- AND Bridge uses the configured delivery route

#### Scenario: Direct Docker service page

- WHEN the page is opened at http://web-content-fetch:8092/
- THEN Bridge uses the configured delivery route

### Requirement: Send a reachable Bridge delivery URL

WCF SHALL send the validated deployment callback endpoint in Chrome Bridge
content requests. An explicit deployment setting SHALL override a stale saved
callback value.

#### Scenario: NAS Docker network

- WHEN the deployment callback endpoint is
  http://web-content-fetch:8092/api/bridge/callback
- THEN Bridge receives that endpoint even when the browser uses the Gateway

#### Scenario: Local Compose

- WHEN the deployment callback endpoint is
  http://host.docker.internal:8092/api/bridge/callback
- THEN Bridge receives that endpoint even when the browser uses 127.0.0.1

#### Scenario: Stale persisted URL

- WHEN saved state contains an older callback URL and the deployment supplies
  a different explicit callback endpoint
- THEN startup and subsequent Bridge requests use the deployment endpoint

### Requirement: Preserve settings compatibility

Saving Bridge settings from the current UI SHALL not submit a callback
route as a global override. Legacy settings requests with an
equivalent callback URL SHALL remain valid; conflicting destinations SHALL
fail without changing the saved Bridge settings.

#### Scenario: Save through the current UI

- WHEN the operator saves a Bridge URL while viewing the Gateway page
- THEN the callback delivery endpoint remains the one configured by deployment
- AND no callback URL appears in the settings UI

#### Scenario: Conflicting legacy callback

- WHEN a legacy client submits a different callback destination
- THEN the request is rejected without changing the binding or delivery URL

### Requirement: Honor the entered Bridge Server URL

WCF SHALL use the exact normalized Bridge Server URL in a binding for
pairing, authenticated requests, and cancellation. It SHALL NOT replace that
URL with the client's default or an internal network alias.

#### Scenario: Pair with a Gateway Bridge URL

- WHEN the operator enters a Gateway Bridge URL and starts six-digit pairing
- THEN the client requests the key, handshake, and secure request from that URL

#### Scenario: Continue a bound job

- WHEN a bound job resumes or cancels
- THEN its Bridge requests use the saved binding URL
