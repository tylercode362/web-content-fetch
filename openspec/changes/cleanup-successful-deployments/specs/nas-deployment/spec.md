## ADDED Requirements

### Requirement: Successful deployment cleanup occurs after verification

The NAS deployer SHALL remove project-owned obsolete deployment artifacts only after the replacement container and its Local Gateway route pass bounded health checks. It MUST NOT create a program source backup; source recovery is performed by redeploying the desired Git revision.

#### Scenario: Successful deployment

- **WHEN** staging validation, build, cutover, container health, and Gateway health succeed
- **THEN** obsolete Web Content Fetch staging is removed
- **AND** stale packaged source, orphan containers, and project-labelled dangling images are removed
- **AND** configuration, exported content, volumes, and user data remain intact

#### Scenario: Failed deployment

- **WHEN** cutover or health verification fails
- **THEN** image and configuration recovery is attempted
- **AND** staging and recovery logs are retained for diagnosis
