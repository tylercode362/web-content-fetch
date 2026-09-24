const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

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
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  }));
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
      WEB_CONTENT_FETCH_CALLBACK_URL: 'http://web-content-fetch:8092/api/bridge/callback',
      WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS: 'web-content-fetch,host.docker.internal'
    },
    stdio: 'ignore'
  });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
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
    const cookie = page.headers.get('set-cookie').split(';')[0];
    const token = html.match(/name="csrf-token" content="([^"]+)"/)[1];
    const stateResponse = await fetch(base + '/api/state');
    const statePayload = await stateResponse.json();
    assert.equal(Object.hasOwn(statePayload.binding, 'callbackUrl'), false);
    assert.equal(Object.hasOwn(statePayload.binding, 'callbackDeliveryUrl'), false);
    const bridgeStatus = await fetch(base + '/api/bridge/status', { headers: { origin: base } });
    assert.equal(bridgeStatus.status, 200);
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
    const rejected = await fetch(base + '/api/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        bridgeUrl: 'http://host.docker.internal:8788',
        callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
      })
    });
    assert.equal(rejected.status, 422);
    assert.equal((await rejected.json()).error, 'callback_url_managed_by_deployment');
    const accepted = await fetch(base + '/api/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ bridgeUrl: 'http://host.docker.internal:8788' })
    });
    assert.equal(accepted.status, 200);
    const saved = JSON.parse(await fs.readFile(path.join(state, 'config.json'), 'utf8'));
    assert.equal(saved.callbackUrl, 'http://web-content-fetch:8092/api/bridge/callback');
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
});
