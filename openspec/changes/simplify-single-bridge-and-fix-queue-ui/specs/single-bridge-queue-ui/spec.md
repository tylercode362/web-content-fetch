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
