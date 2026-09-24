# Design

The existing resume API requeues paused jobs. It will also requeue error jobs,
regardless of diagnostic, while excluding completed and cancelled jobs. The
UI shows the same resume action for all error jobs. A job with no usable
checkpoint starts from chapter discovery; this is visible, not silently
reported as a completed checkpoint.

Per-chapter partial image checkpoints are written atomically after each
verified asset. Each asset has its own job-owned file, while a small index
records the source chapter URL, ordered source image URLs, and contiguous
asset count. This avoids rewriting every previously downloaded image whenever
another image completes. On retry, WCF fetches
the chapter evidence again and reuses only a contiguous prefix whose source
URLs match and whose assets contain bytes. A changed image list invalidates
the partial checkpoint, and the chapter starts again. Completed chapter
checkpoints and published manga EPUBs retain their existing precedence.

Partial checkpoints remain within the job-owned checkpoint directory, are
subject to existing page/image bounds, and are removed with the job files
after success or cancellation. No new Bridge protocol is required.
