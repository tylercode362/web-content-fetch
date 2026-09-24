# Resume failed download jobs

## Why

Only a small set of Bridge diagnostics currently permits resuming a failed
job. A failure late in a chapter also repeats images already downloaded.

## Scope

- Show a resume action for every failed novel or manga job without deleting
  checkpoints, published chapters, or output files.
- Reuse completed chapters and verified partial chapter image assets.
- Recheck chapter/image identity before reusing partial assets.
- Keep cancellation and deletion destructive as before, and preserve the
  original failure diagnostic until an explicit resume action succeeds.
