// Recovery must never turn a persisted stop request back into content fetching.
function recoverJobState(job) {
  if (!['running', 'pausing', 'cancelling', 'paused'].includes(job.status)) return job;
  if (job.status === 'cancelling' || job.cancelRequested) {
    job.status = 'cancelling';
    job.cancelRequested = true;
    job.pauseRequested = false;
  } else if (job.status === 'pausing' || job.status === 'paused' || job.pauseRequested) {
    job.status = 'paused';
    job.pauseRequested = true;
    job.cancelRequested = false;
  } else {
    job.status = 'queued';
    job.pauseRequested = false;
    job.cancelRequested = false;
  }
  job.diagnostic = 'recovered_after_restart';
  job.bridgeProgress = null;
  job.progress = { ...(job.progress || {}), phase: job.status };
  return job;
}
module.exports = { recoverJobState };
