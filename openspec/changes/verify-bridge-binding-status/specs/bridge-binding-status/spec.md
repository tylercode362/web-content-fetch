# Bridge binding status

## ADDED Requirements

### Requirement: Verify saved Bridge authorization

WCF SHALL distinguish saved credentials from a successful authenticated Bridge request without changing binding or job state.

#### Scenario: Stale credential

- **Given** WCF stores a service credential that the configured Bridge rejects
- **When** the user checks connection status
- **Then** the UI shows that saved authorization is invalid rather than claiming the Bridge is connected

#### Scenario: Offline Extension

- **Given** the Bridge accepts the service credential but the bound Extension is offline
- **When** WCF checks status
- **Then** it distinguishes this from a rejected credential

#### Scenario: Privacy

- **Given** a status request fails
- **When** WCF returns the status response
- **Then** it MUST NOT expose the service credential, six-digit code, or raw encrypted frames

#### Scenario: Bound Extension identity

- **Given** WCF has saved a Bridge binding
- **When** the user opens Bridge settings
- **Then** the UI SHALL show the currently bound Extension UUID separately from the browser-local service UUID

#### Scenario: Successful rebinding

- **Given** WCF has paused or queued jobs for the current binding
- **When** a fresh Extension code successfully changes the bound Extension
- **Then** WCF SHALL update those resumable jobs to the new Extension UUID while retaining completed job provenance

#### Scenario: Pairing feedback follows verification

- **Given** WCF accepted a pairing code and saved the new binding
- **When** the follow-up Bridge authorization check completes
- **Then** the pairing feedback SHALL show the verified, offline, invalid, or unavailable result rather than remain at "正在驗證授權"

#### Scenario: Show the bound Extension heartbeat and check time

- **GIVEN** the saved binding targets Extension UUID `browser-123` and Bridge returns its `online` state and `lastSeenAt`
- **WHEN** WCF checks binding status
- **THEN** the status response SHALL include only the configured Extension UUID, a `checkedAt` timestamp, and that UUID's valid `lastHeartbeatAt` timestamp
- **AND** the UI SHALL show both timestamps next to the binding status

#### Scenario: Do not use another Extension's heartbeat

- **GIVEN** the saved binding targets Extension UUID `browser-123` but Bridge returns a heartbeat only for `browser-456`
- **WHEN** WCF checks binding status
- **THEN** WCF SHALL report the bound Extension offline and MUST NOT show `browser-456`'s heartbeat timestamp

#### Scenario: Offline heartbeat unavailable

- **GIVEN** the bound Extension is absent from Bridge's current client list
- **WHEN** WCF checks binding status
- **THEN** WCF SHALL show the check time and explicitly state that Bridge did not provide a heartbeat time, without inferring the last heartbeat
