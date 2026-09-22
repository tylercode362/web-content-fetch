# Design

The queue action handler keeps its success and failure messages in the existing try/catch. The finally block removes `pendingActions` first and then performs one `refresh()`. The final render therefore reads the persisted job state without treating the job as pending; later SSE events continue to work normally.

`refresh()` already absorbs connection errors, so the final synchronization cannot create an unhandled exception. Removing the earlier refresh calls also avoids rendering the temporary action state before the marker is cleared.
