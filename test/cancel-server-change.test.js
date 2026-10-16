const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { BridgeClient } = require('../bridge-client');
const { DownloadOrchestrator } = require('../job-orchestrator');

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-cancel-restart-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const binding = { bindingId: 'binding', serviceClientId: 'service', browserClientId: 'browser',
    serviceCredential: 'synthetic', expectedFingerprint: options.unpinned ? '' : 'synthetic-fingerprint' };
  const operation = { requestId: '1700000000000_original', serverInstanceId: 'old', state: 'running', digest: 'digest' };
  const job = { id: 'target', bindingId: 'binding', browserClientId: 'browser', serviceClientId: 'service',
    status: 'cancelling', contentOperation: operation, progress: {}, outputs: ['target.epub'] };
  if (options.wrongBinding) job.serviceClientId = 'different-service';
  const other = { id: 'other', status: 'running', progress: { completed: 2 }, outputs: ['other.epub'] };
  const otherSnapshot = structuredClone(other);
  const files = ['target.checkpoint', 'target.epub', 'other.checkpoint', 'other.epub'];
  for (const file of files) await fs.writeFile(path.join(root, file), file);
  const calls = [];
  t.mock.method(BridgeClient.prototype, 'cancelContentFetch', async function (key) {
    assert.equal(key, job.id); calls.push('cancel'); this.serverInstanceId ||= options.sameInstance ? 'old' : 'new';
    return options.malformedCancel ? { success: true } : { success: true, cancelled: options.active === true };
  });
  t.mock.method(BridgeClient.prototype, 'getContentOperation', async function (value) {
    assert.deepEqual(value, operation); calls.push('get');
    return { success: false, code: options.finalUnknown && calls.filter(call => call === 'get').length > 1
      ? 'content_operation_unknown' : options.diagnostic || 'content_operation_server_changed' };
  });
  t.mock.method(BridgeClient.prototype, 'operationServerInstance', async function () { return this.serverInstanceId; });
  t.mock.method(BridgeClient.prototype, 'listBrowserClients', async function () {
    calls.push('list'); if (options.restartAgain) this.serverInstanceId = 'newer';
    if (options.transport) throw new Error('bridge_transport_failed');
    return { success: true, clients: [{ browserClientId: options.wrongBrowser ? 'another' : 'browser', online: !options.offline },
      { browserClientId: 'busy-other', online: true, resources: [{ state: 'busy' }] }] };
  });
  const jobs = new Map([[job.id, job], [other.id, other]]);
  const orchestrator = new DownloadOrchestrator({ jobs, config: { bindings: [binding], activeBindingId: 'binding' },
    outputDir: root, update(value, change) { Object.assign(value, change); }, saveConfig() {} });
  orchestrator.runningJobs.set(other.id, Promise.resolve());
  orchestrator.removeJobFiles = async value => { assert.equal(value.id, job.id); await fs.rm(path.join(root, 'target.checkpoint')); };
  orchestrator.removePublishedOutputs = async value => { assert.equal(value.id, job.id); await fs.rm(path.join(root, 'target.epub')); };
  return { job, operation, calls, orchestrator, async verify(preserved) {
    assert.deepEqual(other, otherSnapshot); assert.equal(orchestrator.runningJobs.has(other.id), true);
    for (const file of files) {
      if (preserved || file.startsWith('other')) assert.equal(await fs.readFile(path.join(root, file), 'utf8'), file);
      else await assert.rejects(fs.access(path.join(root, file)), { code: 'ENOENT' });
    }
  } };
}

test('changed Bridge cancels only the old job while another job is running', async t => {
  const f = await fixture(t);
  await f.orchestrator.cancel(f.job.id);
  assert.equal(f.job.status, 'cancelled'); assert.equal(f.job.diagnostic, null);
  assert.deepEqual(f.job.contentOperation, { ...f.operation, state: 'cancelled', code: undefined,
    cancellation: { reason: 'server_changed', confirmedServerInstanceId: 'new' } });
  assert.ok(f.calls.includes('list')); await f.verify(false);
});

for (const options of [{ unpinned: true }, { wrongBinding: true }, { sameInstance: true }, { offline: true },
  { wrongBrowser: true }, { active: true }, { restartAgain: true }, { transport: true },
  { malformedCancel: true }, { finalUnknown: true },
  { diagnostic: 'content_operation_expired' }, { diagnostic: 'content_operation_unresolved' }]) {
  test('insufficient cancellation evidence preserves every file: ' + JSON.stringify(options), async t => {
    const f = await fixture(t, options);
    await assert.rejects(f.orchestrator.cancel(f.job.id));
    assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.job.contentOperation, f.operation);
    await f.verify(true);
  });
}
