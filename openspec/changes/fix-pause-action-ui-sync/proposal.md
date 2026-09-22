# Fix queue action UI synchronization

## Why

After a pause request completes, the queue card can remain on the temporary action state until the browser is refreshed. The UI renders before removing the per-job pending action marker, then does not render again.

## Scope

- Fix the state cleanup order for pause, resume, cancel, and delete actions.
- Preserve the existing API, SSE, job state, and file cleanup contracts.
- Add source-level regression coverage for the final synchronization.

## Non-goals

- Do not change the Bridge protocol, resume strategy, or EPUB/KEPUB output.
- Do not change the existing ability to cancel a pausing job.
