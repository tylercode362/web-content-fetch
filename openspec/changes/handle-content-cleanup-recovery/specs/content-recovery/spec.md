## ADDED Requirements

### Requirement: Bound retries of terminal reader validation failures
WCF SHALL retry explicitly classified reader completeness failures only after the original operation is terminal, using the existing three-attempt limit and preserving all completeness checks.

#### Scenario: A transient reader result is incomplete
- **GIVEN** Bridge confirms the original reader operation has terminated with a classified completeness failure
- **WHEN** fewer than three attempts have been made
- **THEN** WCF may allocate a fresh request for the same scope without publishing incomplete output

#### Scenario: Completeness continues to fail
- **GIVEN** all three attempts fail their reader validation
- **WHEN** the retry budget is exhausted
- **THEN** WCF pauses with the original checkpoint and a visible validation diagnostic

### Requirement: Pause explicitly when cleanup cannot be confirmed
WCF SHALL preserve the original operation identity and outputs when Bridge reports recovery-required cleanup.

#### Scenario: Release confirmation is unavailable
- **GIVEN** the authenticated operation response reports unconfirmed cleanup
- **WHEN** its bounded recovery window expires
- **THEN** the job pauses with a visible diagnostic without allocating another request

#### Scenario: A confirmed disconnected operation is retried
- **GIVEN** the original operation has settled after confirmed cleanup
- **WHEN** the bounded retry policy permits another attempt
- **THEN** a new request resumes from preserved reader and image checkpoints

#### Scenario: Resume on the same instance
- **GIVEN** a paused job retains an unconfirmed-cleanup operation
- **WHEN** the user resumes
- **THEN** remote stop is confirmed before any new content work is dispatched
