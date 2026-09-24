# Novel batch retrieval and recovery

## ADDED Requirements

### Requirement: Retrieve novel illustrations in the chapter tab

WCF SHALL retrieve verified Linovel chapter illustrations while the Bridge keeps the chapter tab open after the lazy-image scroll and extraction step.

#### Scenario: Chapter contains several illustrations

- **WHEN** WCF processes a Linovel chapter containing verified inline illustrations
- **THEN** Bridge SHALL retrieve the illustrations in the same chapter operation and tab
- **AND** it SHALL deliver each verified image to WCF through the authenticated callback
- **AND** it SHALL keep their source order and checkpoint each verified image
- **AND** it SHALL preserve the existing image allowlist, size, MIME, and integrity validation

### Requirement: Resume after refresh

WCF SHALL restore interrupted running jobs from their persisted chapter and image checkpoints after a service restart, while preserving explicit user-paused state across a UI refresh.

#### Scenario: Running job is interrupted

- **WHEN** the WCF process restarts while a job is running
- **THEN** the job SHALL return to the queue and continue from durable checkpoints

#### Scenario: User-paused job is displayed after refresh

- **WHEN** the user refreshes the WCF page while the job is paused
- **THEN** WCF SHALL show the paused state and keep the explicit resume action available
- **AND** it SHALL NOT silently undo the user's pause request
