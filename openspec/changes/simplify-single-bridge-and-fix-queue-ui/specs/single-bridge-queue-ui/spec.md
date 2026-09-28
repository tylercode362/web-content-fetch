# Single Bridge binding and queue UI

## MODIFIED Requirements

### Requirement: one WCF Bridge binding

The Web Content Fetch service MUST use at most one canonical Chrome Bridge binding.

#### Scenario: duplicate profiles are migrated

- **GIVEN** persisted state contains more than one valid binding profile
- **WHEN** the service starts
- **THEN** it MUST select the active profile, or the first valid profile when no active profile is valid
- **AND** it MUST expose only that profile to the UI
- **AND** old job binding ids MUST resolve to the canonical profile without deleting job data

#### Scenario: repeated pairing updates the same service binding

- **GIVEN** the service already has a canonical profile
- **WHEN** a user completes the six-digit pairing flow again
- **THEN** the service MUST update that profile instead of appending another profile

### Requirement: queue form remains usable

The new-job form MUST not render a multi-binding selector and its URL input MUST remain usable at desktop and narrow widths.

#### Scenario: one binding does not shrink the URL input

- **GIVEN** the service has one paired Bridge
- **WHEN** the queue page renders the new-job form
- **THEN** the URL input MUST have a non-zero flexible width
- **AND** the form MUST submit the job using the canonical binding

### Requirement: reliable terminal cleanup

The terminal cleanup action MUST remove only `error` and `cancelled` jobs, their own outputs and checkpoints, and MUST return the actual deleted job ids.

#### Scenario: cleanup result is reflected immediately

- **GIVEN** failed or cancelled jobs are visible in the queue
- **WHEN** the user confirms terminal cleanup
- **THEN** the API MUST return the deleted count and ids
- **AND** the queue snapshot MUST no longer contain successfully deleted jobs
- **AND** completed jobs MUST remain

### Requirement: recoverable same-origin CSRF

The service MUST retain exact Origin validation and CSRF protection while allowing a stale same-origin page to refresh its token once.

#### Scenario: stale page token is renewed

- **GIVEN** a same-origin POST receives `csrf_forbidden` because its page token is stale
- **WHEN** the UI requests same-origin `/api/csrf`
- **THEN** the service MUST issue a short-lived token and cookie without exposing credentials in logs
- **AND** the UI MUST retry the original POST at most once

#### Scenario: cross-origin request remains forbidden

- **GIVEN** a request has an origin outside the configured exact origin
- **WHEN** it calls a mutating API
- **THEN** the service MUST reject it even if a token header is present

### Requirement: Gateway-proxied UI uses the public same-origin boundary

The Web Content Fetch UI MUST keep service-to-service traffic on the dedicated
Docker network, while browser UI/API requests MUST validate the exact public
Gateway origin. The service MUST NOT use its container loopback address as the
NAS UI origin. When the trusted Gateway forwards `/web-content-fetch/`, the
service MAY derive the exact origin from the forwarded scheme and Host headers;
an explicitly configured origin remains supported for deployments with a fixed
public hostname.

#### Scenario: NAS Gateway request is accepted

- **GIVEN** the Gateway forwards `/web-content-fetch/` with a valid forwarded
  scheme and Host
- **WHEN** the browser sends a same-origin API request
- **THEN** the request is accepted when its Origin exactly matches that public
  Gateway origin
- **AND** WCF-to-Bridge traffic continues to use Docker service DNS

#### Scenario: Untrusted origin remains forbidden

- **GIVEN** the request is forwarded through the WCF prefix
- **WHEN** its Origin does not exactly match the forwarded public origin or an
  explicitly configured origin
- **THEN** the service MUST return `origin_forbidden`
