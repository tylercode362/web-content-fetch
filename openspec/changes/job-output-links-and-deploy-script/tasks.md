# Tasks

## RED

- [x] Record the backward-compatible `downloads` contract and expandable job
  presentation requirements.
- [x] Record the reusable local deployment safety boundary.

## GREEN

- [x] Add structured EPUB/KEPUB metadata while retaining legacy outputs.
- [x] Replace the one-line queue rendering with expandable job details.
- [x] Add unit tests for output metadata and rendered UI contract.
- [x] Add and document the reusable local `Deploy.ps1` script.
- [x] Bump and synchronize the Web Content Fetch version.

## REFACTOR / VERIFY

- [x] Run Compose config, unit tests, OpenSpec strict validation, deployment
  dry-run, and health/status checks.
- [x] Verify the active download is not interrupted by source-only changes;
  restart the service only after the current job is safe to resume.
