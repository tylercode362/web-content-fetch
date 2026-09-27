## ADDED Requirements

### Requirement: Successful deployment cleanup occurs after verification

The NAS deployer SHALL remove project-owned obsolete deployment artifacts only after the replacement container and its Local Gateway route pass bounded health checks.

#### Scenario: Successful deployment

- **WHEN** staging validation, build, cutover, container health, and Gateway health succeed
- **THEN** obsolete Web Content Fetch staging and source backups are removed
- **AND** configuration, exported content, volumes, and user data remain intact

#### Scenario: Failed deployment

- **WHEN** cutover or health verification fails
- **THEN** rollback is attempted
- **AND** staging and recovery source are retained for diagnosis
