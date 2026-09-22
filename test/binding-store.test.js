const assert = require('node:assert/strict');
const test = require('node:test');
const { getBinding, normalizeConfig, publicBinding } = require('../binding-store');

const firstBindingId = '11111111-1111-4111-8111-111111111111';
const secondBindingId = '22222222-2222-4222-8222-222222222222';

function profile(bindingId, serviceClientId, browserClientId) {
  return {
    bindingId,
    bridgeUrl: 'http://host.docker.internal:8788',
    serviceClientId,
    serviceCredential: 'credential-' + bindingId,
    browserClientId
  };
}

test('multiple persisted profiles migrate to the active canonical binding', () => {
  const config = normalizeConfig({
    activeBindingId: secondBindingId,
    bindings: [
      profile(firstBindingId, '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'),
      profile(secondBindingId, '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666')
    ]
  });

  assert.equal(config.bindings.length, 1);
  assert.equal(config.bindings[0].bindingId, secondBindingId);
  assert.equal(config.activeBindingId, secondBindingId);
  assert.equal(getBinding(config, firstBindingId).bindingId, secondBindingId);
  assert.equal(getBinding(config, secondBindingId).bindingId, secondBindingId);
  assert.equal(publicBinding(config).bindings.length, 1);
});

test('unknown binding ids do not silently select the canonical profile', () => {
  const config = normalizeConfig({
    bindings: [profile(
      firstBindingId,
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444'
    )]
  });

  assert.equal(getBinding(config, '77777777-7777-4777-8777-777777777777'), null);
});
