# Design

## Public job contract

Keep `outputs` as the existing array of relative output names for compatible
callers. Add `downloads` as a derived array containing only safe published
filenames, their same-origin `/downloads/...` href, and a format label of
`EPUB` or `KEPUB`. Invalid legacy output entries are not exposed as links.

## Queue presentation

Use native HTML `<details>` and `<summary>` for every job. The collapsed
summary remains compact and identifies status, kind, and title. The expanded
panel shows the untrusted source URL as escaped text plus a safe HTTP link,
progress, binding identity, diagnostic, and a separate download list. Action
buttons remain available according to the existing job-state rules.

## Deployment script

`scripts/Deploy.ps1` is local-first and repeatable:

1. Resolve the project root and validate the Compose file.
2. Without `-ConfirmDeploy`, print the target and stop before mutation.
3. With confirmation, optionally build, run `docker compose up -d`, wait for
   the service health endpoint, and print bounded status evidence.
4. Never run global Docker cleanup, delete named volumes, read secrets, or
   accept arbitrary Compose project/service names.

The script supports `-SkipBuild` and a bounded health timeout for repeated
development or release use while keeping the service and Compose project
fixed to this repository.
