const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { createConfigStore, verifyBindingCopy } = require('../config-store');
const { BRIDGE_URL, CALLBACK_URL } = require('../service-endpoints');

function fixture() {
  const id = '11111111-1111-4111-8111-111111111111';
  return {
    defaultBridgeUrl: BRIDGE_URL, callbackUrl: CALLBACK_URL,
    activeBindingId: id, bindingAliases: [id], bindings: [{
      bindingId: id, bridgeUrl: BRIDGE_URL,
      serviceClientId: '22222222-2222-4222-8222-222222222222',
      browserClientId: '33333333-3333-4333-8333-333333333333',
      serviceCredential: 'synthetic-test-credential', expectedFingerprint: 'synthetic-fingerprint',
      createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z'
    }]
  };
}

function workspace(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'wcf-config-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stateDir = path.join(root, 'state');
  const configDir = path.join(root, 'auth');
  fs.mkdirSync(stateDir); fs.mkdirSync(configDir);
  return { root, stateDir, configDir };
}
function write(dir, value = fixture()) {
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600 });
  return file;
}

test('explicit config directory preserves current identity and separates writes', async t => {
  const { stateDir, configDir } = workspace(t);
  const file = write(configDir);
  const before = fs.readFileSync(file);
  const store = createConfigStore({ stateDir, configDir, requireExisting: true });
  assert.deepEqual(store.load(), fixture());
  assert.deepEqual(fs.readFileSync(file), before);
  await store.save(fixture());
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), fixture());
  assert.equal(fs.existsSync(path.join(stateDir, 'config.json')), false);
  assert.deepEqual(fs.readdirSync(configDir), ['config.json']);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('unset config directory keeps current stateDir default', t => {
  const { stateDir } = workspace(t); write(stateDir);
  assert.deepEqual(createConfigStore({ stateDir }).load(), fixture());
});

test('fresh unpaired installation remains possible without preserve mode', t => {
  const { stateDir, configDir } = workspace(t);
  const store = createConfigStore({ stateDir, configDir });
  assert.equal(store.load().bindings.length, 0);
  assert.deepEqual(fs.readdirSync(configDir), []);
});

test('preserve mode missing target cannot fall back to source or write empty config', t => {
  const { stateDir, configDir } = workspace(t); const source = write(stateDir);
  const before = fs.readFileSync(source);
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_missing/);
  assert.deepEqual(fs.readdirSync(configDir), []);
  assert.deepEqual(fs.readFileSync(source), before);
});

test('malformed config fails without exposing bytes or rewriting', t => {
  const { stateDir, configDir } = workspace(t);
  const file = path.join(configDir, 'config.json'); fs.writeFileSync(file, '{"credential":"DO-NOT-EXPOSE"');
  for (const requireExisting of [true, false]) {
    assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting }).load(), error => {
      assert.equal(error.message, 'binding_config_invalid'); return true;
    });
  }
  assert.equal(fs.readFileSync(file, 'utf8'), '{"credential":"DO-NOT-EXPOSE"');
});

test('preserve mode rejects empty, incomplete, multiple and legacy formats', t => {
  const { stateDir, configDir } = workspace(t);
  const incomplete = fixture(); delete incomplete.bindings[0].serviceCredential;
  const wrongActive = fixture(); wrongActive.activeBindingId = '44444444-4444-4444-8444-444444444444';
  const multiple = fixture(); multiple.bindings.push({ ...multiple.bindings[0] });
  for (const value of [{}, [], fixture().bindings[0], incomplete, wrongActive, multiple]) {
    const file = write(configDir, value); const before = fs.readFileSync(file);
    assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_invalid/);
    assert.deepEqual(fs.readFileSync(file), before);
  }
});

test('preserve mode refuses normalization that would change binding endpoint', t => {
  const { stateDir, configDir } = workspace(t);
  const value = fixture(); value.bindings[0].bridgeUrl = 'http://another-bridge.invalid'; write(configDir, value);
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_invalid/);
});

test('read-only identical-copy preflight leaves both files unchanged', t => {
  const { stateDir, configDir } = workspace(t);
  const source = write(stateDir); const target = write(configDir); const before = fs.readFileSync(target);
  assert.equal(verifyBindingCopy(source, target), true);
  assert.deepEqual(fs.readFileSync(source), before); assert.deepEqual(fs.readFileSync(target), before);
});

test('conflicting copy and same-file targets fail without overwriting', t => {
  const { stateDir, configDir } = workspace(t);
  const source = write(stateDir); const changed = fixture(); changed.bindings[0].serviceCredential = 'other-synthetic';
  const target = write(configDir, changed); const before = fs.readFileSync(target);
  assert.throws(() => verifyBindingCopy(source, target), /binding_copy_conflict/);
  assert.throws(() => verifyBindingCopy(source, source), /binding_copy_same_file/);
  assert.deepEqual(fs.readFileSync(target), before);
});

test('symlink file and directory are rejected', t => {
  const { root, stateDir, configDir } = workspace(t); const source = write(stateDir);
  fs.symlinkSync(source, path.join(configDir, 'config.json'));
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_unsafe_path/);
  const linked = path.join(root, 'linked'); fs.symlinkSync(stateDir, linked, 'dir');
  assert.throws(() => createConfigStore({ stateDir, configDir: linked, requireExisting: true }).load(), /binding_config_unsafe_path/);
});

test('nonregular or oversized config is rejected before parse', t => {
  const { stateDir, configDir } = workspace(t);
  const file = path.join(configDir, 'config.json'); fs.mkdirSync(file);
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_unsafe_path/);
  fs.rmdirSync(file); fs.writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), /binding_config_invalid/);
});

test('failed save cannot overwrite an unsafe destination', async t => {
  const { stateDir, configDir } = workspace(t); const source = write(stateDir);
  const before = fs.readFileSync(source); fs.symlinkSync(source, path.join(configDir, 'config.json'));
  await assert.rejects(createConfigStore({ stateDir, configDir }).save(fixture()), /binding_config_unsafe_path/);
  assert.deepEqual(fs.readFileSync(source), before);
});

test('CLI reports fixed codes only for malformed and conflicting copies', t => {
  const { stateDir, configDir } = workspace(t); const source = write(stateDir); const target = write(configDir);
  const command = path.join(__dirname, '..', 'config-store.js');
  let result = spawnSync(process.execPath, [command, 'verify-copy', source, target], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'binding_copy_verified');
  fs.writeFileSync(target, '{"secret":"DO-NOT-EXPOSE"');
  result = spawnSync(process.execPath, [command, 'verify-copy', source, target], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'binding_config_invalid');
});

test('permission failure stays fail-closed with a fixed diagnostic', t => {
  const { stateDir, configDir } = workspace(t); const target = write(configDir);
  const open = fs.openSync;
  t.mock.method(fs, 'openSync', function (file, ...args) {
    if (file === target) throw Object.assign(new Error('private path denied'), { code: 'EACCES' });
    return open.call(fs, file, ...args);
  });
  assert.throws(() => createConfigStore({ stateDir, configDir, requireExisting: true }).load(), error => {
    assert.equal(error.message, 'binding_config_unavailable'); return true;
  });
});

test('server exits before accepting jobs if preserved config is missing', t => {
  const { root, stateDir, configDir } = workspace(t); write(stateDir);
  fs.writeFileSync(path.join(stateDir, 'jobs.json'), '[]\n');
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    encoding: 'utf8', timeout: 5000,
    env: {
      PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH,
      WEB_CONTENT_FETCH_STATE_DIR: stateDir, WEB_CONTENT_FETCH_CONFIG_DIR: configDir,
      WEB_CONTENT_FETCH_OUTPUT_DIR: path.join(root, 'output'),
      WEB_CONTENT_FETCH_REQUIRE_EXISTING_BINDING: '1'
    }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /binding_config_missing/);
  assert.doesNotMatch(result.stderr, /synthetic-test-credential/);
  assert.equal(fs.readFileSync(path.join(stateDir, 'jobs.json'), 'utf8'), '[]\n');
  assert.deepEqual(fs.readdirSync(configDir), []);
});

test('opt-in deployment keeps credential storage separate and externally managed', () => {
  const root = path.join(__dirname, '..');
  const base = fs.readFileSync(path.join(root, 'compose.yaml'), 'utf8');
  const overlay = fs.readFileSync(path.join(root, 'compose.bridge-auth.yaml'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  assert.doesNotMatch(base, /web_content_fetch_bridge_auth/);
  assert.match(overlay, /WEB_CONTENT_FETCH_REQUIRE_EXISTING_BINDING: "1"/);
  assert.match(overlay, /web_content_fetch_bridge_auth:\/var\/lib\/web-content-fetch\/config/);
  assert.match(overlay, /external: true/);
  assert.match(overlay, /WEB_CONTENT_FETCH_AUTH_VOLUME:\?/);
  assert.match(dockerfile, /install -d -m 0700 -o app -g app \/var\/lib\/web-content-fetch\/config/);
});
