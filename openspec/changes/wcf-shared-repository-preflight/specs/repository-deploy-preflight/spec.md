# Repository deployment preflight

## ADDED Requirements

### Requirement: Verify the GitHub.com SSH host key pin stored on the NAS before repository access
The WCF deployment script MUST verify the approved GitHub.com SSH host key pin stored in the NAS updater store before repository-access verification and before any local Compose validation, archive creation, upload, staging, or cutover. This check MUST remain separate from verification of the NAS SSH host identity and authorization through the repository-specific deploy key. It MUST stop if the module is missing, the GitHub.com pin is absent without explicit owner confirmation, or the stored fingerprint differs from the reviewed fingerprint. It MUST NOT silently enroll a key, use keyscan/TOFU, disable strict host checking, or overwrite a mismatched pin.

#### Scenario: GitHub.com host key pin is missing in noninteractive mode
- GIVEN the NAS SSH connection has been established through its own approved host-trust process
- AND the NAS updater store does not contain the approved GitHub.com SSH host key pin
- WHEN repository preflight runs noninteractively
- THEN it stops with an explicit missing GitHub.com host-key-pin diagnostic before repository access or deployment side effects
- AND it does not enroll a host key, create a deploy key, or enable polling

#### Scenario: A deploy key does not replace host identity verification
- GIVEN a WCF repository deploy key exists
- AND the stored GitHub.com host fingerprint differs from the approved fingerprint
- WHEN repository preflight runs
- THEN it stops before repository-access verification and preserves the existing pin
- AND the deploy key does not bypass the host identity failure

### Requirement: Verify exact read-only repository access
The preflight MUST verify repository access for project `web-content-fetch` and repository `tylercode362/web-content-fetch`. It MUST stop if read access is not verified. Missing repository keys MUST fail closed in noninteractive mode. Interactive key creation and GitHub read-only registration each require separate owner confirmation. Private keys and app credentials MUST NOT be exposed.

#### Scenario: Missing key without interaction
- GIVEN the exact repository has no registered deployment key
- WHEN preflight runs noninteractively
- THEN it stops without creating or registering a key

#### Scenario: Existing verified key
- GIVEN the exact repository has a verified read-only key
- WHEN preflight runs
- THEN it continues with the same fixed project and repository identifiers

### Requirement: Keep updater inactive
The WCF deployment script MUST NOT enable, start, or request updater polling as part of preflight or deployment setup.

#### Scenario: Repository setup completes
- WHEN host trust and repository read access are verified
- THEN deployment proceeds to its existing validation and deployment gates without enabling updater polling
