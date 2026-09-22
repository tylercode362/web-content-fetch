# Job Output Links and Reusable Deployment

## ADDED Requirements

### Requirement: Public jobs expose EPUB and KEPUB download metadata

The service MUST retain the existing public `outputs` array of download hrefs
for compatibility and MUST add a `downloads` array for safe published output files. Each download
entry MUST include a same-origin href, the published filename, and a format
label of `EPUB` or `KEPUB`. Invalid or unsafe persisted output names MUST NOT
be exposed as download links.

#### Scenario: Completed novel exposes both formats

- **GIVEN** a completed novel job has an `.epub` and `.kepub.epub` output
- **WHEN** a caller reads the public job state
- **THEN** `outputs` remains available
- **AND** `downloads` contains one `EPUB` link and one `KEPUB` link

#### Scenario: Manga exposes per-chapter pairs

- **GIVEN** a completed manga job has one EPUB/KEPUB pair for each chapter
- **WHEN** the queue state is rendered
- **THEN** every published file appears in the download list
- **AND** each entry preserves its chapter filename and format label

### Requirement: Queue jobs are expandable and identify their target

The queue page MUST render every job as an expandable accessible item. The
expanded content MUST show the target title, source URL, progress, binding
identity, diagnostic when present, and separate EPUB/KEPUB download links when
available. Existing pause, resume, cancel, and terminal delete actions MUST
remain state-limited as before.

#### Scenario: User inspects a job

- **GIVEN** a queued, running, paused, completed, or failed job is visible
- **WHEN** the user expands that job
- **THEN** the title and source URL are visible
- **AND** the current progress and binding identity are visible
- **AND** available EPUB and KEPUB links are grouped under downloads

#### Scenario: Unsafe persisted output is present

- **GIVEN** a legacy job contains an invalid output name
- **WHEN** the queue is rendered
- **THEN** the invalid name is not turned into a link
- **AND** other valid outputs remain available

### Requirement: Deployment is repeatable and confirmation-gated

The project MUST provide a reusable `scripts/Deploy.ps1` that validates the
fixed Compose project before mutation, performs no deployment without
`-ConfirmDeploy`, waits for the service health check after deployment, and
does not run global Docker cleanup or delete named volumes. The script MUST
not read or transmit secrets.

#### Scenario: Preview deployment target

- **GIVEN** the operator runs `Deploy.ps1` without `-ConfirmDeploy`
- **WHEN** the script validates its parameters
- **THEN** it prints the fixed project and Compose target
- **AND** it performs no build, restart, cleanup, or volume mutation

#### Scenario: Confirmed deployment

- **GIVEN** the operator supplies `-ConfirmDeploy`
- **WHEN** Compose validation, build, and `up -d` succeed
- **THEN** the script waits for the fixed Web Content Fetch health endpoint
- **AND** reports service status
- **AND** leaves named state and output volumes intact

#### Scenario: Deployment failure

- **GIVEN** a build, Compose operation, or health check fails
- **WHEN** the script stops
- **THEN** it returns a non-zero failure
- **AND** it does not perform global cleanup or delete recovery data
