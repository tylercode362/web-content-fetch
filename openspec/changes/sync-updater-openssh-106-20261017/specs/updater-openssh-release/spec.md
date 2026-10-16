## ADDED Requirements

### Requirement: Verified standalone updater client
The project updater SHALL use the reviewed canonical OpenSSH source recipe while preserving its fixed project identity and existing authorization boundary.

#### Scenario: Verified build materials
- **GIVEN** an immutable base and pinned official release materials
- **WHEN** the updater image is built
- **THEN** archive hashes and the full signer fingerprint SHALL be verified before extraction
- **AND** the runtime SHALL exclude SSH server, package managers and builder tools

#### Scenario: Project isolation
- **GIVEN** the independent project updater
- **WHEN** shared build files are synchronized
- **THEN** its project identity, strict SSH wrapper, main-only polling and protected state mounts SHALL remain unchanged
- **AND** synchronization SHALL NOT activate or restart any application or updater
