# Tasks

- [x] Wire WCF deployment to the installed shared module with fixed project and repository arguments and separate host-pin parameters.
- [x] Distinguish NAS SSH identity, the GitHub.com host key pin stored on the NAS, and repository-key authorization.
- [x] Document module path, updater-store prerequisites, and owner confirmations.
- [x] Add synthetic coverage of the actual deployment preflight statements and shared-module negative cases.
- [x] Run PowerShell 7.4.11 parsing and synthetic runtime checks against the reviewed module; current logs cover missing module, missing/mismatched GitHub.com pin, missing key, fixed repository, and strict-binding regression.
- [x] Run OpenSpec 1.8.0 strict validation for this change and deploy-web-content-fetch-nas in the isolated source snapshot; both pass. This is not repository-wide validation.
- [x] Run four targeted Node checks with zero skips, patch whitespace/apply checks, and source/hash checks; preserve the original handoff manifest discrepancy.
- [x] Root reviewed and approved the eight-file source-only candidate for publication; this limited review does not satisfy the broader verification or NAS runtime gates.
- [ ] Complete the repository-required broader verification gates before claiming deployment readiness.

Historical completion marks are not evidence for this revised candidate. NAS runtime, key metadata, and polling have not been verified. No deployment or NAS modification is part of this candidate review.
