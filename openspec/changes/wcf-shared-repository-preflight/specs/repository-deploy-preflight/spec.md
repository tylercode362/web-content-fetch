# Repository deployment preflight

### Requirement: updater protocol compatibility gate

The application deployment MUST distinguish an absent updater, an installed old producer, and a legacy central updater. An absent project updater MAY use the existing explicit manual application bootstrap. An installed old producer MUST be upgraded through the separately reviewed updater Compose/image-digest flow with `--no-build --pull never`, preserving config, keys, state, and deployment-status data, before application deployment continues. A legacy central updater MUST use the existing owner-migration procedure; an already-owned project MUST NOT rerun migration as a substitute for a producer-version upgrade. Application source checkout, shared Gateway-module updates, and stopping the updater scheduler MUST NOT be treated as protocol upgrades.

#### Scenario: installed old producer fails closed until separately upgraded
- GIVEN the project updater Compose/image exists but its producer predates project-scoped host responses, or returns a missing or wrong project
- WHEN the application deployment preflight runs
- THEN it stops before the application upload/cutover path
- AND it preserves the updater config, keys, state, and deployment-status data
- AND the standalone reviewed updater image/digest upgrade is the only allowed protocol-upgrade path
- AND the application proceeds only after the real project-scoped `host-status` returns `project: web-content-fetch`

#### Scenario: legacy central updater does not replace a version upgrade
- GIVEN a legacy central updater is present
- WHEN independent ownership has not yet been established
- THEN the existing owner-migration procedure is used
- AND when the project is already owned, migration is not rerun to replace a producer-version upgrade

#### Scenario: source-only or scheduler-only changes do not open the gate
- GIVEN only application source, the shared Gateway module, or scheduler state has changed
- WHEN no standalone updater image/digest upgrade and real project-scoped `host-status` check have completed
- THEN the host is not reported as protocol-upgraded or recovered

## ADDED Requirements

### Requirement: Verify the GitHub.com SSH host key pin when the updater is installed
When the fixed project updater exists, the WCF deployment script MUST verify the approved GitHub.com SSH host key pin stored in the NAS updater store before repository-access verification and before any local Compose validation, archive creation, upload, staging, or cutover. This check MUST remain separate from verification of the NAS SSH host identity and authorization through the repository-specific deploy key. It MUST stop if the module is missing, the existing updater is unsafe, or the stored fingerprint differs from the reviewed fingerprint. A missing pin MAY be skipped only by the local-source application entrypoint's explicit AllowRepositorySetupSkip path; strict paths and changed pins remain fail-closed. It MUST NOT silently enroll a key, use keyscan/TOFU, disable strict host checking, or overwrite a mismatched pin. A first local-source deployment MAY continue only when the fixed updater is absent and the entrypoint explicitly passes AllowMissingUpdater.

#### Scenario: GitHub.com host key pin is missing in noninteractive mode
- GIVEN the NAS SSH connection has been established through its own approved host-trust process
- AND the installed NAS updater store does not contain the approved GitHub.com SSH host key pin
- WHEN repository preflight runs noninteractively
- THEN the WCF local-source application entrypoint continues without enrolling a host key, creating a deploy key or enabling polling
- AND a strict preflight path stops with an explicit missing GitHub.com host-key-pin diagnostic before deployment side effects

#### Scenario: First application deployment before updater installation
- GIVEN the fixed WCF updater compose file is absent
- AND the workstation has local WCF source and its normal deployment gates
- WHEN the entrypoint explicitly passes AllowMissingUpdater
- THEN it continues to the existing Compose, packaging, staging and cutover checks
- AND it does not create a host pin, deploy key, updater store or polling schedule

#### Scenario: A deploy key does not replace host identity verification
- GIVEN a WCF repository deploy key exists
- AND the stored GitHub.com host fingerprint differs from the approved fingerprint
- WHEN repository preflight runs
- THEN it stops before repository-access verification and preserves the existing pin
- AND the deploy key does not bypass the host identity failure

### Requirement: Verify exact read-only repository access
The preflight MUST verify repository access for project `web-content-fetch` and repository `tylercode362/web-content-fetch`. It MUST stop if read access is not verified in a strict path. The WCF local-source application entrypoint MAY pass AllowRepositorySetupSkip so a missing project .env metadata or repository key can be skipped in noninteractive mode or by pressing Enter in the owner prompt. Interactive key creation and GitHub read-only registration each require separate owner confirmation. Private keys and app credentials MUST NOT be exposed.

#### Scenario: Missing key without interaction
- GIVEN the fixed updater exists and the exact repository has no registered deployment key
- WHEN a strict preflight runs noninteractively
- THEN it stops without creating or registering a key

#### Scenario: Application deployment skips missing key
- GIVEN the fixed updater exists and the exact repository has no registered deployment key
- AND the WCF local-source application entrypoint passes AllowRepositorySetupSkip
- WHEN preflight runs noninteractively or the owner presses Enter at the setup prompt
- THEN application deployment continues to its existing validation, packaging, staging and cutover gates
- AND automatic pull-main polling remains disabled

#### Scenario: Existing verified key
- GIVEN the fixed updater exists and the exact repository has a verified read-only key
- WHEN preflight runs
- THEN it continues with the same fixed project and repository identifiers

### Requirement: Keep updater inactive
The WCF deployment script MUST NOT enable, start, or request updater polling as part of preflight or deployment setup.

#### Scenario: Repository setup completes
- WHEN host trust and repository read access are verified
- THEN deployment proceeds to its existing validation and deployment gates without enabling updater polling
