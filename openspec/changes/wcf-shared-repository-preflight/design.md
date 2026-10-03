# Design

The WCF script imports the installed Local Gateway `Repository-DeploySetup.psm1` using a path relative to the WCF checkout. After the operator's existing `-ConfirmDeploy` gate and SSH identity-file check, it calls `Initialize-NasRepositoryHostPin`, then `Invoke-NasRepositorySetup`, before Compose validation and archive creation. Both receive the fixed project identifier; only repository setup receives the fixed repository identifier. The module checks the approved GitHub.com SSH host key pin stored in the NAS updater store and owner-confirmed, read-only repository-key registration. The script never starts or enables updater polling.

Trust boundary: the workstation invokes SSH to the NAS using the existing NAS identity. The repository deploy key is a separate NAS-owned key used for read-only GitHub access. Workstation-to-NAS SSH host identity, the GitHub.com host key pin stored on the NAS, and repository deploy-key authorization are three separate checks. GitHub.com public host-key enrollment and repository public-key registration require separate owner confirmations. No private key or password is returned to GitHub or logged.

Failure modes are fail-closed: missing module, missing or mismatched GitHub.com host key pin, repository mismatch, missing key in noninteractive mode, or unconfirmed registration aborts before validation, packaging, transfer, staging, or cutover. Recovery is to install the reviewed shared module/updater prerequisites and complete the owner-confirmed setup, then retry.

Rejected alternatives: keyscan/TOFU, keyless polling, broad repository selection, and automatic updater activation.
