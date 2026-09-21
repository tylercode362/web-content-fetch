# Multi-browser bindings and job cancellation

## ADDED Requirements

### Requirement: persistent browser bindings

The service SHALL persist multiple Bridge binding profiles. Each WCF browser SHALL generate a `serviceClientId` with `crypto.randomUUID()` on first use, persist it in browser localStorage, and reuse it for later pairing requests from that browser; the service SHALL treat that UUID as immutable for the profile.

#### Scenario: browser service UUID is stable

- **WHEN** the same browser loads WCF more than once
- **THEN** it SHALL submit the same service UUID for later pairing requests
- **AND** a second browser SHALL generate a different service UUID

#### Scenario: two browsers share one Bridge

- **GIVEN** browser A and browser B each present a valid six-digit pairing code to the same Bridge URL
- **WHEN** both pairings complete
- **THEN** web-content-fetch SHALL retain two binding profiles
- **AND** each profile SHALL have a different service UUID and browser UUID
- **AND** neither pairing SHALL revoke the other profile

### Requirement: additive site capabilities preserve existing bindings

The Bridge SHALL treat a six-digit pairing as authorization for the service-to-browser binding, not as a one-site approval. When a trusted local Extension reports a known additive site capability, the Bridge MUST make that capability available to enabled service bindings for the same browser without requiring another pairing code. It MUST NOT grant unknown capabilities or modify bindings for another browser.

#### Scenario: existing WCF binding uses a newly supported site

- **GIVEN** web-content-fetch already has an enabled service binding to browser A
- **AND** browser A reconnects with a known new site capability
- **WHEN** web-content-fetch requests that supported site through the existing binding
- **THEN** the request is allowed without another six-digit pairing
- **AND** the existing service credential, service UUID, browser UUID, and browser B bindings remain unchanged

#### Scenario: browsers use different Bridges

- **GIVEN** two profiles are paired against different configured Bridge URLs
- **WHEN** jobs are created for each profile
- **THEN** each job SHALL route only to its selected profile
- **AND** changing the active profile SHALL NOT reroute existing jobs

### Requirement: identity-visible jobs

Every DownloadJob SHALL persist a binding reference and public Bridge identity metadata.

#### Scenario: queued job routing

- **WHEN** a job is accepted with binding B
- **THEN** the persisted snapshot SHALL include bindingId, bridgeUrl, browserClientId and serviceClientId
- **AND** the snapshot SHALL exclude serviceCredential
- **AND** retry SHALL continue using binding B even if the UI active binding changes

### Requirement: cancellable queue

The service SHALL allow an authorized same-origin caller to cancel queued and running DownloadJobs.

#### Scenario: queued cancellation

- **WHEN** a queued job is cancelled
- **THEN** it SHALL transition to cancelled without opening a Bridge tab
- **AND** it SHALL remain persisted and visible in the queue

#### Scenario: running cancellation

- **WHEN** a running job is cancelled
- **THEN** the service SHALL stop starting new chapter, page, asset or EPUB-write steps
- **AND** SHALL request cancellation of the matching Bridge operation
- **AND** SHALL close only tabs owned by that operation when the Bridge supports cancellation
- **AND** SHALL end in cancelled rather than complete

#### Scenario: terminal idempotency

- **WHEN** cancellation targets a complete, failed or already cancelled job
- **THEN** the API SHALL return the existing terminal snapshot
- **AND** SHALL NOT delete outputs or mutate another job

### Requirement: additive Bridge cancellation

chrome-bridge SHALL expose `content.cancel` as an authenticated additive action keyed by service, browser and opaque operationKey.

#### Scenario: matching active operation

- **WHEN** a paired service cancels its active content operation
- **THEN** the Bridge SHALL ask the Extension to cancel the matching operation lease
- **AND** the Extension SHALL close only ephemeral tabs tracked for that operation
- **AND** the Bridge SHALL release the operation resource

#### Scenario: unknown operation

- **WHEN** the operationKey is missing, expired or owned by another service/browser binding
- **THEN** the Bridge SHALL return a non-success cancellation result without revealing another operation
- **AND** existing Browser Read operations SHALL remain unchanged

### Requirement: reconnectable cancellation state

The UI and persisted snapshot SHALL distinguish queued, running, cancelling, cancelled, complete and error states.

#### Scenario: SSE reconnect during cancellation

- **WHEN** the EventSource reconnects after a cancel request
- **THEN** the UI SHALL load the persisted job snapshot
- **AND** SHALL not replay a stale progress event that changes cancelled back to running

### Requirement: pausable and resumable jobs

The service SHALL support pausing and resuming novel and manga jobs without discarding completed chapter checkpoints.

#### Scenario: pause a running job

- **WHEN** an authorized caller pauses a running job
- **THEN** the service SHALL stop at a safe operation boundary
- **AND** it SHALL preserve completed chapter checkpoints
- **AND** it SHALL expose the job as paused

#### Scenario: resume a paused job

- **WHEN** an authorized caller resumes a paused job
- **THEN** the service SHALL continue from the first incomplete chapter
- **AND** it SHALL not fetch or rewrite valid completed chapter checkpoints again

#### Scenario: restart recovery

- **WHEN** the service restarts while a job is running
- **THEN** the job SHALL return to the queue with its persisted progress
- **AND** the scheduler SHALL continue from valid checkpoints

### Requirement: destructive cancellation cleanup

Cancelling a non-terminal job SHALL delete that job's downloaded checkpoint and staging files without deleting another job's files.

#### Scenario: cancel a partially downloaded job

- **WHEN** an authorized caller cancels a queued, paused or running job
- **THEN** the service SHALL end the job as cancelled
- **AND** SHALL remove its partial novel assets or manga EPUB/Kepub files
- **AND** SHALL preserve completed outputs belonging to other jobs

### Requirement: credential privacy

Binding and job public projections SHALL never expose credentials, pairing codes or raw secure operation frames.

#### Scenario: state and log inspection

- **WHEN** `/api/state`, SSE, job output or normal logs are inspected
- **THEN** they SHALL expose only public UUID and endpoint metadata required for routing
- **AND** SHALL not contain serviceCredential or pairing code

### Requirement: cross-FQDN parallel jobs

The service SHALL allow bounded parallel jobs when their target FQDNs differ, while allowing at most one active job for each normalized FQDN.

#### Scenario: novel and manga run together

- **GIVEN** queued novel and manga jobs target different FQDNs
- **WHEN** both jobs are dispatched
- **THEN** they MAY open separate browser tabs concurrently
- **AND** each job SHALL use an independent secure Bridge session
- **AND** the Bridge FQDN queues SHALL continue to enforce per-FQDN ordering and limits

#### Scenario: same FQDN remains serial

- **GIVEN** two jobs target the same normalized FQDN
- **WHEN** one job is active
- **THEN** the other job SHALL remain queued
- **AND** it SHALL not open a second tab for that FQDN until the active job finishes or is cancelled

#### Scenario: existing social and video features remain isolated

- **GIVEN** a Threads, X or YouTube request is running
- **WHEN** a content job for another FQDN is dispatched
- **THEN** the request SHALL not share tab state or secure request sequencing with the other job
