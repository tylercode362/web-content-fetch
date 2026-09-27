# NAS helper line endings

## ADDED Requirements

### Requirement: Remote helper is uploaded with POSIX line endings

The NAS deployment entrypoint MUST upload the remote shell helper as UTF-8
without BOM using LF line endings, regardless of the checkout line-ending
format. It MUST remove the local temporary helper after success or failure.

#### Scenario: Deploy from a Windows checkout

- **GIVEN** the checked-out remote helper contains CRLF line endings
- **WHEN** the deployment entrypoint prepares the helper for upload
- **THEN** the uploaded temporary helper contains LF line endings only
- **AND** `/bin/sh` can parse `set -eu`

#### Scenario: Deployment fails after staging preparation

- **WHEN** the deployment exits through its cleanup path
- **THEN** the local normalized helper is removed
- **AND** remote staging and recovery data remain available for diagnosis
