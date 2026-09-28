const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

async function loadOriginPolicy() {
  const source = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function normalizeOrigin');
  const end = source.indexOf('function parseCookies');
  assert.ok(start >= 0 && end > start);
  const context = { URL, port: 8092, process: { env: {} }, module: { exports: {} } };
  vm.runInNewContext(`${source.slice(start, end)}
module.exports = { normalizeOrigin, forwardedGatewayOrigin, originAllowed };`, context);
  return context.module.exports;
}

test('accepts the exact public Gateway origin with its forwarded port', async () => {
  const { originAllowed } = await loadOriginPolicy();
  assert.equal(originAllowed({
    method: 'GET',
    headers: {
      origin: 'http://192.168.50.140:8088',
      host: 'web-content-fetch:8092',
      'x-forwarded-host': '192.168.50.140:8088',
      'x-forwarded-proto': 'http',
      'x-forwarded-prefix': '/web-content-fetch'
    }
  }), true);
});

test('rejects a different origin even through the Gateway prefix', async () => {
  const { originAllowed } = await loadOriginPolicy();
  assert.equal(originAllowed({
    method: 'GET',
    headers: {
      origin: 'http://attacker.example:8088',
      host: 'web-content-fetch:8092',
      'x-forwarded-host': '192.168.50.140:8088',
      'x-forwarded-proto': 'http',
      'x-forwarded-prefix': '/web-content-fetch'
    }
  }), false);
});

test('keeps loopback only for direct local development without Gateway forwarding', async () => {
  const { originAllowed } = await loadOriginPolicy();
  assert.equal(originAllowed({
    method: 'GET',
    headers: { origin: 'http://127.0.0.1:8092', host: '127.0.0.1:8092' }
  }), true);
  assert.equal(originAllowed({
    method: 'GET',
    headers: {
      origin: 'http://127.0.0.1:8092',
      host: 'web-content-fetch:8092',
      'x-forwarded-host': '192.168.50.140:8088',
      'x-forwarded-proto': 'http',
      'x-forwarded-prefix': '/web-content-fetch'
    }
  }), false);
  assert.equal(originAllowed({
    method: 'GET',
    headers: {
      origin: 'http://127.0.0.1:8092',
      host: 'web-content-fetch:8092',
      'x-forwarded-prefix': '/web-content-fetch'
    }
  }), false);
});
