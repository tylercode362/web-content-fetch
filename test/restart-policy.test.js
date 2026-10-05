const test = require('node:test');
const assert = require('node:assert/strict');
const { recoverJobState } = require('../restart-policy');

test('restart preserves stop intent and only requeues interrupted work', () => {
  for (const [status, expected] of [['running', 'queued'], ['pausing', 'paused'], ['cancelling', 'cancelling'], ['paused', 'paused']]) {
    const job = { status, progress: { completed: 3 }, pauseRequested: status === 'pausing', cancelRequested: status === 'cancelling' };
    recoverJobState(job);
    assert.equal(job.status, expected);
    assert.equal(job.progress.completed, 3);
    if (expected === 'paused') assert.equal(job.pauseRequested, true);
    if (expected === 'cancelling') assert.equal(job.cancelRequested, true);
  }
  const job = { status: 'running', cancelRequested: true, pauseRequested: true };
  recoverJobState(job);
  assert.equal(job.status, 'cancelling');
});
