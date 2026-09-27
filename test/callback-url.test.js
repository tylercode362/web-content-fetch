const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCallbackUrl, resolveCallbackUrl } = require('../callback-url');
const { CALLBACK_URL } = require('../service-endpoints');

test('callback always resolves to the WCF Docker service endpoint', () => {
  assert.equal(validateCallbackUrl(CALLBACK_URL), CALLBACK_URL);
  assert.equal(resolveCallbackUrl(CALLBACK_URL), CALLBACK_URL);
  assert.equal(resolveCallbackUrl(), CALLBACK_URL);
});

test('browser-visible callback URLs cannot replace the internal endpoint', () => {
  assert.throws(() => validateCallbackUrl(
    'http://192.168.50.140:8088/web-content-fetch/api/bridge/callback'
  ), /callback_url_managed_by_service/);
  assert.throws(() => resolveCallbackUrl(
    'http://host.docker.internal:8092/api/bridge/callback'
  ), /callback_url_managed_by_service/);

});
