const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DownloadOrchestrator } = require('../job-orchestrator');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-delete-fence-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const job = { id: 'failed', status: 'error', outputs: ['failed.epub'],
    contentOperation: { requestId: '1700000000000_pending', state: 'pending', serverInstanceId: 'old' } };
  const other = { id: 'other', status: 'complete', outputs: ['other.epub'] };
  const jobs = new Map([[job.id, job], [other.id, other]]);
  const orchestrator = new DownloadOrchestrator({ jobs, config: {}, outputDir: root,
    update: (value, change) => Object.assign(value, change), saveConfig() {} });
  await orchestrator.ensureStage(job);
  await orchestrator.writeCheckpoint(job, 'keep.json', { keep: true });
  await fs.writeFile(path.join(root, 'failed.epub'), 'failed');
  await fs.writeFile(path.join(root, 'other.epub'), 'other');
  return { orchestrator, job, jobs, root };
}

test('failed deletion retains record and files if remote cleanup is unconfirmed', async t => {
  const f = await fixture(t);
  f.orchestrator.confirmContentOperationStopped = async () => { throw new Error('content_operation_cancel_unconfirmed'); };
  await assert.rejects(f.orchestrator.delete(f.job.id), /content_operation_cancel_unconfirmed/);
  assert.equal(f.jobs.get(f.job.id), f.job);
  await fs.access(f.orchestrator.checkpointPath(f.job));
  assert.equal(await fs.readFile(path.join(f.root, 'failed.epub'), 'utf8'), 'failed');
});

test('confirmed remote cleanup precedes local deletion and blocks concurrent resume', async t => {
  const f = await fixture(t);
  let finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  f.orchestrator.confirmContentOperationStopped = async () => {
    entered(); await new Promise(resolve => { finish = resolve; });
    f.job.contentOperation.state = 'cancelled';
  };
  const deleting = f.orchestrator.delete(f.job.id);
  await started;
  await fs.access(path.join(f.root, 'failed.epub'));
  assert.throws(() => f.orchestrator.resume(f.job.id), /job_deleting/);
  await assert.rejects(f.orchestrator.delete(f.job.id), /job_deleting/);
  finish(); await deleting;
  assert.equal(f.jobs.has(f.job.id), false);
  assert.equal(f.jobs.has('other'), true);
  await assert.rejects(fs.access(path.join(f.root, 'failed.epub')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(f.root, 'other.epub'), 'utf8'), 'other');
});

test('failed record persistence restores the in-memory job for an idempotent deletion retry', async t => {
  const f = await fixture(t);
  f.job.contentOperation.state = 'complete';
  f.orchestrator.removeJob = () => { throw new Error('synthetic_write_failed'); };
  await assert.rejects(f.orchestrator.delete(f.job.id), /synthetic_write_failed/);
  assert.equal(f.jobs.get(f.job.id), f.job);
  f.orchestrator.removeJob = () => {};
  await f.orchestrator.delete(f.job.id);
  assert.equal(f.jobs.has(f.job.id), false);
});
