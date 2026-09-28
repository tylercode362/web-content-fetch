const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { BRIDGE_URL, CALLBACK_URL } = require('../service-endpoints');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('running settings page keeps the callback internal and deployment-owned', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-callback-test-'));
  const state = path.join(root, 'state');
  const output = path.join(root, 'output');
  await fs.mkdir(state);
  await fs.writeFile(path.join(state, 'config.json'), JSON.stringify({
    defaultBridgeUrl: 'http://192.168.50.140:8088/chrome-bridge',
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  }));
  await fs.writeFile(path.join(state, 'jobs.json'), JSON.stringify([{
    id: 'callback-contract-job',
    url: 'https://tw.linovelib.com/novel/1/',
    kind: 'novel',
    status: 'paused',
    callbackToken: 'callback-contract-token',
    progress: { phase: 'paused', completed: 0, total: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }]));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      WEB_CONTENT_FETCH_BIND_HOST: '127.0.0.1',
      WEB_CONTENT_FETCH_PORT: String(port),
      WEB_CONTENT_FETCH_STATE_DIR: state,
      WEB_CONTENT_FETCH_OUTPUT_DIR: output,
      WEB_CONTENT_FETCH_BRIDGE_URL: 'http://127.0.0.1:8788',
      WEB_CONTENT_FETCH_CALLBACK_URL: 'http://192.168.50.140:8088/callback',
      WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS: 'web-content-fetch,host.docker.internal'
    },
    stdio: 'ignore'
  });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (child.exitCode !== null) break;
      try {
        healthy = (await fetch(base + '/healthz')).ok;
        if (healthy) break;
      } catch { /* startup is still in progress */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(healthy, true, 'isolated service started');
    const page = await fetch(base + '/');
    const html = await page.text();
    assert.doesNotMatch(html, /Callback URL|id="callbackUrl"|callbackDelivery/);
    assert.doesNotMatch(html, /Chrome Bridge 網址|id="bridgeUrl"|儲存網址/);
    const cookie = page.headers.get('set-cookie').split(';')[0];
    const token = html.match(/name="csrf-token" content="([^"]+)"/)[1];
    const stateResponse = await fetch(base + '/api/state');
    const statePayload = await stateResponse.json();
    assert.equal(Object.hasOwn(statePayload.binding, 'callbackUrl'), false);
    assert.equal(Object.hasOwn(statePayload.binding, 'callbackDeliveryUrl'), false);
    assert.equal(Object.hasOwn(statePayload.binding, 'bridgeUrl'), false);
    assert.equal(Object.hasOwn(statePayload.binding.bindings[0] || {}, 'bridgeUrl'), false);
    const health = await (await fetch(base + '/healthz')).json();
    assert.equal(Object.hasOwn(health, 'bridgeUrl'), false);
    const migratedConfig = JSON.parse(await fs.readFile(path.join(state, 'config.json'), 'utf8'));
    assert.equal(migratedConfig.defaultBridgeUrl, BRIDGE_URL);
    assert.equal(migratedConfig.callbackUrl, CALLBACK_URL);
    const bridgeStatus = await fetch(base + '/api/bridge/status', { headers: { origin: base } });
    assert.equal(bridgeStatus.status, 200);
    const forwardedStatus = await fetch(base + '/api/bridge/status', { headers: { origin: 'http://gateway.example:8088', host: 'gateway.example:8088', 'x-forwarded-host': 'gateway.example:8088', 'x-forwarded-proto': 'http', 'x-forwarded-prefix': '/web-content-fetch' } });
    assert.equal(forwardedStatus.status, 200);
    const rejectedOrigin = await fetch(base + '/api/bridge/status', { headers: { origin: 'http://attacker.example:8088', host: 'gateway.example:8088', 'x-forwarded-host': 'gateway.example:8088', 'x-forwarded-proto': 'http', 'x-forwarded-prefix': '/web-content-fetch' } });
    assert.equal(rejectedOrigin.status, 403);
    assert.equal((await rejectedOrigin.json()).error, 'origin_forbidden');
    assert.deepEqual(await bridgeStatus.json(), {
      status: 'not_configured',
      browserClientId: null,
      checkedAt: null,
      lastHeartbeatAt: null
    });
    const headers = {
      origin: base,
      cookie,
      'x-csrf-token': token,
      'content-type': 'application/json'
    };
    const configMutation = await fetch(base + '/api/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ bridgeUrl: 'http://host.docker.internal:8788' })
    });
    assert.equal(configMutation.status, 404);
    assert.equal((await configMutation.json()).error, 'not_found');
    const canonicalCallback = await fetch(base + '/api/bridge/callback', {
      method: 'POST',
      headers: {
        authorization: 'Bearer callback-contract-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ jobId: 'callback-contract-job', progress: { phase: 'bridge_callback' } })
    });
    assert.equal(canonicalCallback.status, 202);
    const rejectedCallback = await fetch(base + '/api/bridge/callback', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ jobId: 'callback-contract-job' })
    });
    assert.equal(rejectedCallback.status, 403);
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
});
