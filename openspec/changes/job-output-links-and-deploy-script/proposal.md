# Proposal: Expand Job Output Links and Add Reusable Deployment

## Why

Web Content Fetch already produces one EPUB and one Kobo KEPUB EPUB for a
novel, and one pair per manga chapter. The queue response currently exposes
only a flat legacy `outputs` array and the page renders each job as a single
line, making the target and available downloads difficult to inspect.

## Scope

- Add a backward-compatible structured `downloads` list to each public job.
- Render each queue item as an expandable job showing title, source URL,
  binding identity, progress, diagnostic, and EPUB/KEPUB links.
- Add a reusable local Docker Compose deployment script based on the
  opendata-research deployment safety baseline.
- Add OpenSpec, unit tests, version synchronization, and deployment dry-run
  coverage.

## Out of scope

- Changing EPUB/KEPUB generation or the active download job.
- Deleting old job outputs or migrating persisted state.
- NAS-specific SSH deployment; this script targets the configured local
  Compose project and does not manage remote hosts or credentials.
