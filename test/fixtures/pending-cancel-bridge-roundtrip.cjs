// Real Bridge registry/ContentFetchService + Noise/HTTP; synthetic Extension and EPUB cleanup only.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
if (!process.env.BRIDGE_SOURCE) throw Error('Explicit existing Bridge source required');
if (process.env.BRIDGE_COMPILED !== '1') {
  if (!process.env.BRIDGE_DEPENDENCIES) throw Error('Explicit existing Bridge dependencies required');
  require(path.join(process.env.BRIDGE_DEPENDENCIES, 'ts-node/register/transpile-only'));
}
const bridge = process.env.BRIDGE_SOURCE;
const { AuthStore } = require(path.join(bridge, 'bridge-server/auth-store'));
const { BrowserRegistry } = require(path.join(bridge, 'bridge-server/browser-registry'));
const { NoiseResponder, generateStaticKeyPair } = require(path.join(bridge, 'bridge-server/secure-channel'));
const { createSecureApiHandler } = require(path.join(bridge, 'bridge-server/secure-api'));
const { SecureBrowserService } = require(path.join(bridge, 'bridge-server/secure-browser-service'));
const { BridgeClient } = require('../../bridge-client');
// These cancellation tests never generate EPUBs. No image/native dependency is replaced in production.
require.cache[require.resolve('../../epub-writer')] = { exports: {
  cleanBookTitle() { throw Error('epub_generation_out_of_scope'); },
  cleanMangaTitle() { throw Error('epub_generation_out_of_scope'); },
  writeMangaChapterEpub() { throw Error('epub_generation_out_of_scope'); },
  writeNovelEpub() { throw Error('epub_generation_out_of_scope'); }
} };
const { DownloadOrchestrator } = require('../../job-orchestrator');
const { CALLBACK_URL } = require('../../service-endpoints');
const realFetch = global.fetch;
global.fetch = (url, options) => {
  if (String(url) === CALLBACK_URL) return Promise.resolve(new Response('{}', { status: 200 }));
  if (!String(url).startsWith('http://127.0.0.1:')) throw Error('external_network_forbidden');
  return realFetch(url, options);
};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(predicate, label) {
  for (let i = 0; i < 600; i++) { if (predicate()) return; await delay(5); }
  throw Error('fixture_wait_timeout:' + label);
}

async function fixture({ delayedCreate = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pending-cancel-noise-'));
  const browserId = '8ef9a4a1-3c20-4b49-9f80-bb3d62dd6421', serviceId = '2f0c7aa1-a444-47e1-bc91-50be82b5158a';
  const auth = new AuthStore(path.join(root, 'synthetic-auth.json'), Buffer.alloc(32, 8));
  await auth.registerLocalBrowser({ browserClientId: browserId, allowedRuleIds: ['manhuagui-mobile-content'] });
  const credential = await auth.pairService({ browserClientId: browserId, serviceClientId: serviceId });
  const registry = new BrowserRegistry();
  registry.register({ browserClientId: browserId, displayName: 'synthetic', extensionVersion: '3.3.1', protocolVersion: 1,
    operatorApiVersion: 2, capabilities: ['manhuagui-mobile-content'], resources: [{ resourceId: 'slot', state: 'available' }] },
  { readyState: 1, send() {}, close() {} });
  const cleanup = deferred(), create = deferred();
  if (!delayedCreate) create.resolve();
  const counters = { runs: 0, releases: 0, cancels: 0, earlyCancels: 0, creates: 0, unknown: 0 };
  let rejectFlow;
  const extension = { responder: new NoiseResponder(generateStaticKeyPair()),
    runOperation: async (browser, service, execute) => {
      counters.runs++;
      try { return await execute({ operationId: 'op-' + counters.runs, resourceId: 'slot', leaseId: 'lease' }); }
      finally { await cleanup.promise; counters.releases++; }
    },
    executeFlow: () => new Promise((resolve, reject) => { rejectFlow = reject; }),
    sendCommand: async (browser, command) => {
      if (command === 'cancelOperation') rejectFlow?.(Error('operation_cancelled'));
      return { success: true };
    }
  };
  const service = new SecureBrowserService(auth, registry, extension, 0);
  const handler = createSecureApiHandler({ responder: extension.responder, auth, registry,
    execute: async (principal, browser, action, body) => {
      if (action === 'content.operation.create') { counters.creates++; await create.promise; }
      const result = await service.execute(principal, browser, action, body);
      if (action === 'content.cancel') { counters.cancels++; if (result.cancelled === false) counters.earlyCancels++; }
      if (action === 'content.operation.get' && result.code === 'content_operation_unknown') counters.unknown++;
      return result;
    }
  });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const bindingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const binding = { bindingId, bridgeUrl: `http://127.0.0.1:${server.address().port}`, serviceClientId: serviceId,
    browserClientId: browserId, serviceCredential: credential };
  const job = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bindingId, kind: 'manga', url: 'https://m.manhuagui.com/comic/1/',
    callbackToken: 'synthetic-callback-only', status: 'queued', progress: {} };
  const checkpoint = path.join(root, 'checkpoint.keep'), output = path.join(root, 'output.keep');
  await fs.writeFile(checkpoint, 'synthetic checkpoint'); await fs.writeFile(output, 'synthetic output');
  const cleaned = [];
  const orchestrator = new DownloadOrchestrator({ jobs: new Map([[job.id, job]]), config: { bindings: [binding], activeBindingId: bindingId },
    outputDir: root, update: (value, change) => Object.assign(value, change), saveConfig() {} });
  orchestrator.removeJobFiles = async () => { cleaned.push('checkpoint'); await fs.rm(checkpoint, { force: true }); };
  orchestrator.removePublishedOutputs = async () => { cleaned.push('output'); await fs.rm(output, { force: true }); };
  return { job, binding, orchestrator, counters, cleaned, cleanup, create,
    preserved: async () => { assert.equal(job.status, 'cancelling'); assert.deepEqual(cleaned, []); await fs.access(checkpoint); await fs.access(output); },
    close: async () => { create.resolve(); cleanup.resolve(); rejectFlow?.(Error('operation_cancelled'));
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); }
  };
}

async function runningAbort(delayedCreate) {
  const f = await fixture({ delayedCreate }); let running;
  try {
    running = f.orchestrator.run(f.job);
    await until(() => delayedCreate ? f.counters.creates === 1 : f.counters.runs === 1, 'create entered');
    const identity = { ...f.job.contentOperation };
    await f.orchestrator.cancel(f.job.id);
    if (delayedCreate) {
      await until(() => f.counters.earlyCancels > 0 && f.counters.unknown > 0, 'cancel before create');
      await f.preserved(); f.create.resolve();
      await until(() => f.counters.runs === 1 && f.counters.cancels > f.counters.earlyCancels, 'cancel reissued after late create');
    } else await until(() => f.counters.cancels > 0, 'independent cancellation');
    await f.preserved(); assert.equal(f.counters.releases, 0); assert.equal(f.job.contentOperation.requestId, identity.requestId);
    f.cleanup.resolve(); await running;
    assert.equal(f.counters.runs, 1); assert.equal(f.counters.releases, 1); assert.equal(f.job.status, 'cancelled');
    assert.deepEqual(f.cleaned, ['checkpoint', 'output']);
    console.log(delayedCreate ? 'PASS real Noise/HTTP cancel-before-delayed-create reconciles without recreation' : 'PASS running abort waits for actual Bridge cleanup/release before local deletion');
  } finally { await f.close(); await running?.catch(() => {}); }
}

async function conflictHolder() {
  const f = await fixture();
  try {
    const client = new BridgeClient(f.binding), instance = await client.operationServerInstance();
    const body = { url: f.job.url, chapterUrl: 'https://m.manhuagui.com/comic/1/2.html', kind: 'manga', mode: 'chapter', operationKey: f.job.id };
    const holder = { requestId: `${Date.now()}_holder`, serverInstanceId: instance };
    await client.createContentOperation(body, holder); await until(() => f.counters.runs === 1, 'holder running');
    const conflict = { requestId: `${Date.now()}_conflict`, serverInstanceId: instance };
    await client.createContentOperation(body, conflict);
    let result;
    for (let i = 0; i < 100; i++) { result = await client.getContentOperation(conflict); if (result.state === 'error') break; await delay(5); }
    assert.equal(result.result.code, 'content_operation_conflict');
    f.job.status = 'paused'; f.job.contentOperation = { ...conflict, digest: 'synthetic', state: 'error', code: result.result.code };
    await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_unresolved' });
    await f.preserved(); assert.equal(f.counters.releases, 0);
    f.cleanup.resolve(); await until(() => f.counters.releases === 1, 'holder release');
    await assert.rejects(f.orchestrator.cancel(f.job.id), { code: 'content_operation_unresolved' });
    await f.preserved(); assert.equal((await client.getContentOperation(holder)).state, 'cancelled');
    console.log('PASS conflicting request terminal error cannot prove another holder stopped; identity/files remain protected');
  } finally { await f.close(); }
}

async function restartedCancellation() {
  const f = await fixture();
  try {
    const client = new BridgeClient(f.binding), instance = await client.operationServerInstance();
    f.binding.expectedFingerprint = client.fingerprint;
    const holder = { requestId: `${Date.now()}_unrelated`, serverInstanceId: instance };
    await client.createContentOperation({ url: f.job.url, chapterUrl: 'https://m.manhuagui.com/comic/1/2.html',
      kind: 'manga', mode: 'chapter', operationKey: 'unrelated-job' }, holder);
    await until(() => f.counters.runs === 1, 'unrelated holder running');
    f.job.status = 'cancelling';
    f.job.contentOperation = { requestId: `${Date.now()}_old`, serverInstanceId: 'previous-instance', state: 'running', digest: 'synthetic' };
    await f.orchestrator.cancel(f.job.id);
    assert.equal(f.job.status, 'cancelled');
    assert.equal(f.job.contentOperation.serverInstanceId, 'previous-instance');
    assert.equal(f.job.contentOperation.cancellation.confirmedServerInstanceId, instance);
    assert.deepEqual(f.cleaned, ['checkpoint', 'output']);
    assert.equal((await client.getContentOperation(holder)).state, 'running');
    assert.equal(f.counters.runs, 1); assert.equal(f.counters.creates, 1); assert.equal(f.counters.releases, 0);
    console.log('PASS authenticated replacement-instance cancellation preserves unrelated running holder without creating work');
  } finally { await f.close(); }
}

(async () => { await runningAbort(false); await runningAbort(true); await conflictHolder(); await restartedCancellation(); })()
  .catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = realFetch; });
