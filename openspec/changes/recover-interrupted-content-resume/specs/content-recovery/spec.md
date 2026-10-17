## ADDED Requirements

### Requirement: Confirm unresolved work before resuming

The orchestrator SHALL confirm unresolved remote work has stopped before resuming from preserved checkpoints.

#### Scenario: Resume after Bridge replacement
- **GIVEN** a paused job has a pending operation from a previous Bridge instance
- **WHEN** the user resumes and the authenticated replacement confirms the same browser is online and the job has no remote holder
- **THEN** the job reuses its checkpoints and keeps published outputs

#### Scenario: Stop confirmation unavailable
- **GIVEN** a pending operation cannot be confirmed stopped
- **WHEN** the user resumes
- **THEN** the job remains paused with its operation identity, checkpoints and outputs preserved, without dispatching new content work

### Requirement: Fence failed-job deletion

The orchestrator SHALL confirm unresolved remote operations are stopped before deleting a terminal job's checkpoints or outputs, and SHALL prevent concurrent resume or deletion of that job during cleanup.

#### Scenario: Unresolved remote work
- **GIVEN** an error job has an unresolved operation
- **WHEN** deletion cannot confirm remote cleanup
- **THEN** the record and local files remain available for recovery

#### Scenario: Resume races with deletion
- **GIVEN** deletion is awaiting cleanup confirmation
- **WHEN** the same job is resumed or deleted again
- **THEN** the competing action is rejected without dispatching new work
