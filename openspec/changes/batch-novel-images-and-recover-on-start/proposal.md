## Why

Linovel currently reads a chapter and then starts another Bridge operation for its illustrations. That reopens the same chapter and adds avoidable queue and page-load time.

## What Changes

- Keep the chapter's background tab open after lazy-image scrolling, then fetch illustrations in that same Bridge operation.
- Recheck document height while scrolling so images that expand the page are not skipped.
- Deliver each verified image through the authenticated WCF callback and checkpoint it before continuing, avoiding one secure Bridge round trip and tab open per image.
- Keep a bounded fallback for older Bridge versions or images the same-tab fetch cannot retrieve.
- Preserve explicit pause/resume semantics; a page refresh reloads job state but does not silently resume a user-paused job.

## Impact

- Affected code: Chrome Bridge content-fetch and WCF job orchestration.
- Existing manga batches, Browser Read, Threads, X, and YouTube behavior remain unchanged.
