// Isolated synthetic Extension; WCF, Bridge, HTTP and Noise are the real modules.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');
const bridge = process.env.BRIDGE_SOURCE;
if (!bridge) throw Error('BRIDGE_SOURCE required');
if (!process.env.UI_ORIGIN) throw Error('Explicit isolated UI_ORIGIN required');
const { AuthStore } = require(path.join(bridge, 'bridge-server/auth-store'));
const { BrowserRegistry } = require(path.join(bridge, 'bridge-server/browser-registry'));
const { NoiseResponder, generateStaticKeyPair } = require(path.join(bridge, 'bridge-server/secure-channel'));
const { createSecureApiHandler } = require(path.join(bridge, 'bridge-server/secure-api'));
const { SecureBrowserService } = require(path.join(bridge, 'bridge-server/secure-browser-service'));
const root = '/tmp/native-ui';
const browserId = '8ef9a4a1-3c20-4b49-9f80-bb3d62dd6421';
const serviceId = '2f0c7aa1-a444-47e1-bc91-50be82b5158a';
const bindingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let child, flowReject, release;
const counters = { runs: 0, releases: 0, cancels: 0 };
async function main() {
  await fs.mkdir(root + '/state', { recursive: true });
  const auth = new AuthStore(root + '/auth.json', Buffer.alloc(32, 8));
  await auth.registerLocalBrowser({ browserClientId: browserId, allowedRuleIds: ['manhuagui-mobile-content'] });
  const credential = await auth.pairService({ browserClientId: browserId, serviceClientId: serviceId });
  await fs.writeFile(root + '/state/config.json', JSON.stringify({ activeBindingId: bindingId, bindings: [{
    bindingId, serviceClientId: serviceId, browserClientId: browserId, serviceCredential: credential
  }] }), { mode: 0o600 });
  const registry = new BrowserRegistry();
  registry.register({ browserClientId: browserId, displayName: 'synthetic UI acceptance', extensionVersion: '3.3.1',
    protocolVersion: 1, operatorApiVersion: 2, capabilities: ['manhuagui-mobile-content'],
    resources: [{ resourceId: 'slot', state: 'available' }] }, { readyState: 1, send() {}, close() {} });
  const extension = { responder: new NoiseResponder(generateStaticKeyPair()),
    runOperation: async (browser, service, execute) => {
      counters.runs++;
      const cleanup = new Promise(resolve => { release = resolve; });
      try { return await execute({ operationId: 'op-' + counters.runs, resourceId: 'slot', leaseId: 'lease' }); }
      finally { await cleanup; counters.releases++; }
    },
    executeFlow: () => new Promise((resolve, reject) => { flowReject = reject; }),
    sendCommand: async (browser, command) => {
      if (command === 'cancelOperation') { counters.cancels++; flowReject?.(Error('operation_cancelled')); }
      return { success: true };
    }
  };
  const service = new SecureBrowserService(auth, registry, extension, 0);
  const secure = http.createServer(createSecureApiHandler({ responder: extension.responder, auth, registry, execute: service.execute }));
  await new Promise(resolve => secure.listen(8788, '127.0.0.1', resolve));
  const control = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/release') { assert.ok(release); release(); }
      else assert.equal(req.url, '/stats');
      let jobs = [];
      try { jobs = JSON.parse(await fs.readFile(root + '/state/jobs.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...counters, jobs: jobs.map(j => ({ id: j.id, status: j.status, requestId: j.contentOperation?.requestId })) }));
    } catch { res.writeHead(500); res.end('fixture_control_failed'); }
  });
  await new Promise(resolve => control.listen(8790, '0.0.0.0', resolve));
  child = spawn(process.execPath, ['server.js'], { cwd: '/app', stdio: 'inherit', env: { ...process.env,
    WEB_CONTENT_FETCH_BIND_HOST: '0.0.0.0', WEB_CONTENT_FETCH_STATE_DIR: root + '/state',
    WEB_CONTENT_FETCH_ALLOWED_ORIGIN: process.env.UI_ORIGIN,
    WEB_CONTENT_FETCH_OUTPUT_DIR: root + '/output', WEB_CONTENT_FETCH_PORT: '8092' } });
  child.on('exit', code => process.exit(code || 0));
  process.on('SIGTERM', () => { flowReject?.(Error('fixture_shutdown')); release?.(); child.kill('SIGTERM'); });
}
main().catch(error => { console.error(error); child?.kill(); process.exitCode = 1; });
