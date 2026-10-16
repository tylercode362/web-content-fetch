const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
if (!process.env.BRIDGE_SOURCE) throw Error('BRIDGE_SOURCE must name the isolated Bridge source tree');
const bridge = process.env.BRIDGE_SOURCE;
require(path.join(bridge, 'node_modules/ts-node/register/transpile-only'));
const { AuthStore } = require(path.join(bridge, 'bridge-server/auth-store'));
const { BrowserRegistry } = require(path.join(bridge, 'bridge-server/browser-registry'));
const { NoiseResponder, generateStaticKeyPair } = require(path.join(bridge, 'bridge-server/secure-channel'));
const { createSecureApiHandler } = require(path.join(bridge, 'bridge-server/secure-api'));
const { SecureBrowserService } = require(path.join(bridge, 'bridge-server/secure-browser-service'));
const { BridgeClient } = require('../../bridge-client');
const { callContentOperation } = require('../../content-operation-client');

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'content-operations-'));
  const browserId = '8ef9a4a1-3c20-4b49-9f80-bb3d62dd6421';
  const serviceId = '2f0c7aa1-a444-47e1-bc91-50be82b5158a';
  const auth = new AuthStore(path.join(directory, 'auth.json'), Buffer.alloc(32, 8));
  await auth.registerLocalBrowser({ browserClientId: browserId, allowedRuleIds: ['manhuagui-mobile-content'] });
  const credential = await auth.pairService({ browserClientId: browserId, serviceClientId: serviceId });
  const registry = new BrowserRegistry();
  registry.register({ browserClientId: browserId, displayName: 'synthetic', extensionVersion: '3.3.0',
    protocolVersion: 1, operatorApiVersion: 2, capabilities: ['manhuagui-mobile-content'],
    resources: [{ resourceId: 'slot', state: 'available' }] }, { readyState: 1, send() {}, close() {} });
  const keys = generateStaticKeyPair();
  let runs = 0, releases = 0, wireRequests = 0, handshakes = 0, hold = false, rejectFlow, releaseGate;
  const extension = { responder: new NoiseResponder(keys),
    runOperation: async (browser, service, execute) => {
      runs++;
      try { return await execute({ operationId: 'op-' + runs, resourceId: 'slot', leaseId: 'lease-' + runs }); }
      finally { if (releaseGate) await releaseGate; releases++; }
    },
    executeFlow: () => new Promise((resolve, reject) => {
      rejectFlow = reject;
      if (!hold) setTimeout(() => resolve({ result: { tabId: 7, pages: [{
        url: 'https://m.manhuagui.com/comic/1/2.html', data: { status: 'ok', title: 'synthetic',
          images: [{ url: 'https://m.manhuagui.com/fixture.png', width: 1, height: 1 }] }
      }] } }), 120);
    }),
    sendCommand: async (browser, command) => { if (command === 'cancelOperation') rejectFlow(Error('operation_cancelled')); return { success: true }; }
  };
  let service = new SecureBrowserService(auth, registry, extension, 0);
  let handler = createSecureApiHandler({ responder: extension.responder, auth, registry, execute: service.execute });
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/secure/handshakes') handshakes++;
    if (req.url === '/v1/secure/request' && [1, 3].includes(++wireRequests)) res.end = function () { res.destroy(); return res; };
    return handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const binding = { baseUrl: `http://127.0.0.1:${server.address().port}`, serviceClientId: serviceId,
    serviceCredential: credential, browserClientId: browserId };
  const body = { url: 'https://m.manhuagui.com/comic/1/2.html', kind: 'manga', mode: 'chapter', operationKey: 'job' };
  const job = {};
  const update = (job, change) => Object.assign(job, change);
  let rekeyed = false;
  const client = new BridgeClient(binding);
  const wait = async (ms, signal) => {
    if (!rekeyed && client.session) { client.session.createdAt -= 60 * 60_000; rekeyed = true; }
    await delay(5, undefined, { signal });
  };
  try {
    const result = await callContentOperation({ client, job, body, update, wait });
    assert.equal(result.success, true); assert.equal(result.pageCount, 1);
    assert.equal(runs, 1); assert.equal(releases, 1);
    const beforeRekey = handshakes;
    client.session.createdAt -= 60 * 60_000;
    await callContentOperation({ client, job, body, update, wait });
    assert.ok(handshakes > beforeRekey); assert.equal(runs, 1);
    console.log('PASS real Noise/HTTP disconnects, session expiry, and repeated create execute once');
    const recovered = JSON.parse(JSON.stringify(job));
    await callContentOperation({ client: new BridgeClient(binding), job: recovered, body, update, wait: async () => {} });
    assert.equal(runs, 1);
    console.log('PASS WCF restart replays completed result before checkpoint');

    hold = true; let release;
    releaseGate = new Promise(resolve => { release = resolve; });
    const controller = new AbortController();
    const stopped = callContentOperation({ client, job, body: { ...body, chapterUrl: 'https://m.manhuagui.com/comic/1/3.html' },
      update, signal: controller.signal, wait: (ms, signal) => delay(5, undefined, { signal }) });
    const rejected = assert.rejects(stopped, { name: 'AbortError' });
    for (let i = 0; i < 200 && runs < 2; i++) await delay(5);
    assert.equal(runs, 2);
    const control = new BridgeClient(binding);
    await control.cancelContentFetch('job'); controller.abort();
    const state = await control.getContentOperation(job.contentOperation);
    assert.equal(state.state, 'running');
    release(); await rejected;
    for (let i = 0; i < 200 && releases < 2; i++) await delay(5);
    assert.equal((await control.getContentOperation(job.contentOperation)).state, 'cancelled');
    assert.equal(runs, 2); assert.equal(releases, 2);
    console.log('PASS independent cancellation session; terminal state waits for release');

    extension.responder = new NoiseResponder(keys);
    service = new SecureBrowserService(auth, registry, extension, 0);
    handler = createSecureApiHandler({ responder: extension.responder, auth, registry, execute: service.execute });
    await assert.rejects(callContentOperation({ client: new BridgeClient(binding), job: recovered, body, update, wait: async () => {} }),
      { code: 'content_operation_server_changed' });
    assert.equal(runs, 2);
    console.log('PASS Bridge restart cannot recreate an operation from the previous instance');
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
