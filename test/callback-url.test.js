const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCallbackUrl } = require('../callback-url');

const env = {
  WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS: 'http://192.168.50.140:8088',
  WEB_CONTENT_FETCH_CALLBACK_URL: 'http://web-content-fetch:8092/api/bridge/callback',
  WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS: 'host.docker.internal,web-content-fetch'
};

test('normalizes the configured Gateway callback route to the in-network WCF endpoint', () => {
  assert.equal(
    validateCallbackUrl('http://192.168.50.140:8088/web-content-fetch/api/bridge/callback', env),
    'http://web-content-fetch:8092/api/bridge/callback'
  );
});

test('accepts the configured in-network callback endpoint', () => {
  assert.equal(
    validateCallbackUrl('http://web-content-fetch:8092/api/bridge/callback', env),
    'http://web-content-fetch:8092/api/bridge/callback'
  );
});

test('keeps existing host-gateway callback settings readable during migration', () => {
  assert.equal(
    validateCallbackUrl('http://host.docker.internal:8092/api/bridge/callback', env),
    'http://host.docker.internal:8092/api/bridge/callback'
  );
});

test('rejects unconfigured proxy origins, unexpected paths, loopback and unallowlisted hosts', () => {
  assert.throws(() => validateCallbackUrl(
    'http://192.168.50.141:8088/web-content-fetch/api/bridge/callback', env
  ), /callback_url_origin_forbidden/);
  assert.throws(() => validateCallbackUrl(
    'http://192.168.50.140:8088/other/api/bridge/callback', env
  ), /callback_url_invalid/);
  assert.throws(() => validateCallbackUrl(
    'http://127.0.0.1:8092/api/bridge/callback', env
  ), /callback_url_must_be_reachable_from_bridge/);
  assert.throws(() => validateCallbackUrl(
    'http://untrusted.example/api/bridge/callback', env
  ), /callback_url_host_forbidden/);
  assert.throws(() => validateCallbackUrl(
    'http://not-web-content-fetch.web-content-fetch:8092/api/bridge/callback', env
  ), /callback_url_host_forbidden/);
  assert.throws(() => validateCallbackUrl(
    'ftp://web-content-fetch:8092/api/bridge/callback', { ...env, WEB_CONTENT_FETCH_CALLBACK_URL: 'ftp://web-content-fetch:8092/api/bridge/callback' }
  ), /callback_url_invalid/);
});
