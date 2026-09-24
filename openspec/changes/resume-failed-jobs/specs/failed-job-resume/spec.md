# Failed job resume

## ADDED Requirements

### Requirement: Resume a failed job explicitly

WCF SHALL offer a resume action for every failed novel and manga job. The
action SHALL requeue the same job without deleting its checkpoints or
published output. Completed and cancelled jobs SHALL NOT be resumed.

#### Scenario: Error after a completed chapter

- WHEN the operator resumes an error job with a completed chapter checkpoint
- THEN that chapter is reused and the next incomplete chapter is processed

#### Scenario: Error before a checkpoint

- WHEN the operator resumes an error job without a usable checkpoint
- THEN the job restarts discovery and continues under the same job ID

### Requirement: Resume a partial chapter image sequence

WCF SHALL atomically checkpoint a contiguous prefix of verified image assets
for a chapter and reuse it only when the chapter URL and ordered image URLs
still match.

#### Scenario: Manga fails after the first image batch

- WHEN a manga chapter fails after a verified batch of images
- AND the operator resumes the job with unchanged chapter evidence
- THEN WCF fetches only the remaining images

#### Scenario: Evidence changes

- WHEN the chapter or ordered image URLs differ from the partial checkpoint
- THEN WCF discards the partial assets and refetches the chapter images

#### Scenario: Cancellation

- WHEN the operator cancels a paused or running job
- THEN all partial checkpoints and published outputs belonging to that job
  are removed as before
