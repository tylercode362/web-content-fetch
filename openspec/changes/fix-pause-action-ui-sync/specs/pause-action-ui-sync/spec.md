# Pause action UI synchronization

## ADDED Requirements

### Requirement: completed job actions leave the pending state

The queue UI MUST remove the per-job pending action marker before its final state synchronization.

#### Scenario: pause action shows the persisted paused state without a reload

- **GIVEN** a running job is visible and the user selects pause
- **WHEN** the pause request returns successfully and the server has persisted the resulting job state
- **THEN** the UI MUST remove the temporary operation marker
- **AND** the UI MUST refresh the job snapshot
- **AND** the job card MUST be able to show the paused state without a browser reload

#### Scenario: action failure also clears the temporary marker

- **GIVEN** a job action request fails
- **WHEN** the error is displayed
- **THEN** the UI MUST remove the temporary operation marker
- **AND** the job list MUST be synchronized again so the action is not permanently stuck
