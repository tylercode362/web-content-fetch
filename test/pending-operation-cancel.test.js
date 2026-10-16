const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { BridgeClient } = require('../bridge-client');
const { DownloadOrchestrator } = require('../job-orchestrator');
const bindingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function fixture(t, status = 'paused', state = 'pending', configured = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pending-cancel-'));
  const checkpoint = path.join(root, 'checkpoint.keep'), output = path.join(root, 'output.keep');
  await fs.writeFile(checkpoint, 'synthetic checkpoint'); await fs.writeFile(output, 'synthetic output');
  const job = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bindingId, status, progress: {},
    contentOperation: { requestId: '1700000000000_fixture', serverInstanceId: 'synthetic-instance', digest: 'synthetic-digest', state } };
  const binding = { bindingId, baseUrl: 'http://127.0.0.1:1', serviceClientId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', browserClientId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', serviceCredential: 'synthetic' };
  const orchestrator = new DownloadOrchestrator({ jobs: new Map([[job.id, job]]), config: { bindings: configured ? [binding] : [], activeBindingId: bindingId }, outputDir: root, update: (value, change) => Object.assign(value, change), saveConfig() {} });
  const originalCancel = BridgeClient.prototype.cancelContentFetch, originalGet = BridgeClient.prototype.getContentOperation;
  t.after(async () => { BridgeClient.prototype.cancelContentFetch = originalCancel; BridgeClient.prototype.getContentOperation = originalGet; await fs.rm(root, { recursive: true, force: true }); });
  const cleaned = [];
  orchestrator.removeJobFiles = async () => { cleaned.push('checkpoint'); await fs.rm(checkpoint); };
  orchestrator.removePublishedOutputs = async () => { cleaned.push('output'); await fs.rm(output); };
  return { orchestrator, job, cleaned, checkpoint, output };
}
for (const status of ['paused', 'queued', 'cancelling']) test(`${status} pending cancellation waits for independent remote cleanup confirmation`, async t => {
  const f = await fixture(t, status); let cancelClient, calls = 0, finish;
  BridgeClient.prototype.cancelContentFetch = async function (key) { assert.equal(key, f.job.id); cancelClient = this; return { success: true, cancelled: true }; };
  BridgeClient.prototype.getContentOperation = async function (operation) {
    assert.equal(this, cancelClient); assert.notEqual(this, f.orchestrator.clients.get(bindingId)); calls++;
    if (calls === 1) return { success: true, ...operation, state: 'running' };
    return new Promise(resolve => { finish = resolve; });
  };
  const cancelling = f.orchestrator.cancel(f.job.id);
  for (let i = 0; i < 100 && !finish; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(typeof finish, 'function'); assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.cleaned, []);
  await fs.access(f.checkpoint); await fs.access(f.output);
  finish({ success: true, requestId: f.job.contentOperation.requestId, serverInstanceId: f.job.contentOperation.serverInstanceId, state: 'cancelled', result: { success: false, code: 'flow_cancelled' } });
  await cancelling; assert.equal(f.job.status, 'cancelled'); assert.equal(f.job.contentOperation.state, 'cancelled'); assert.deepEqual(f.cleaned, ['checkpoint', 'output']);
});
for (const code of ['content_operation_unknown', 'content_operation_expired', 'content_operation_server_changed', 'bridge_transport_failed']) test(`${code} preserves cancelling identity and local files`, async t => {
  const f = await fixture(t), identity = { ...f.job.contentOperation };
  BridgeClient.prototype.cancelContentFetch = async () => ({ success: true, cancelled: true });
  BridgeClient.prototype.getContentOperation = async () => ({ success: false, code });
  await assert.rejects(f.orchestrator.cancel(f.job.id), { code });
  assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.job.contentOperation, identity); assert.deepEqual(f.cleaned, []); assert.equal(f.job.diagnostic, code); await fs.access(f.checkpoint); await fs.access(f.output);
});
test('unavailable binding cannot turn pending remote work into cancelled', async t => {
  const f = await fixture(t, 'queued', 'pending', false);
  await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_cancel_unavailable' }); assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.cleaned, []);
});
test('mismatched response identity is not terminal confirmation', async t => {
  const f = await fixture(t);
  BridgeClient.prototype.cancelContentFetch = async () => ({ success: true });
  BridgeClient.prototype.getContentOperation = async () => ({ success: true, state: 'cancelled', requestId: 'another', serverInstanceId: 'another' });
  await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_cancel_unconfirmed' }); assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.cleaned, []);
});
for (const state of ['complete', 'error', 'cancelled']) test(`confirmed ${state} record keeps local-only cancellation`, async t => {
  const f = await fixture(t, 'paused', state);
  BridgeClient.prototype.cancelContentFetch = async () => { throw Error('must not dispatch'); };
  await f.orchestrator.cancel(f.job.id); assert.equal(f.job.status, 'cancelled'); assert.equal(f.cleaned.length, 2);
});
test('expired result is not proof of remote cleanup', async t => {
  const f = await fixture(t);
  BridgeClient.prototype.cancelContentFetch = async () => ({ success: true });
  BridgeClient.prototype.getContentOperation = async () => ({ success: true, ...f.job.contentOperation, state: 'expired' });
  await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_expired' });
  assert.equal(f.job.status, 'cancelling'); assert.deepEqual(f.cleaned, []);
});
test('a bounded cancellation deadline preserves identity and checkpoint', async t => {
  const f = await fixture(t), timeout = AbortSignal.timeout;
  AbortSignal.timeout = () => timeout(10);
  const keepAlive = setTimeout(() => {}, 100);
  t.after(() => { AbortSignal.timeout = timeout; clearTimeout(keepAlive); });
  BridgeClient.prototype.cancelContentFetch = async () => ({ success: true });
  BridgeClient.prototype.getContentOperation = async (operation, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_cancel_timeout' });
  assert.equal(f.job.status, 'cancelling'); assert.equal(f.job.contentOperation.requestId, '1700000000000_fixture');
  assert.equal(f.job.diagnostic, 'content_operation_cancel_timeout'); assert.deepEqual(f.cleaned, []); await fs.access(f.checkpoint);
});
