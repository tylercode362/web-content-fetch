const assert = require('node:assert/strict');
const test = require('node:test');
const { createCsrfStore } = require('../csrf');

test('issued same-origin token remains valid when another page rotates the cookie', () => {
  const store = createCsrfStore({ maxTokens: 4 });
  const first = store.issue();
  const second = store.issue();

  assert.notEqual(first, second);
  assert.equal(store.verify(first, second), true);
  assert.equal(store.verify(second, second), true);
  assert.equal(store.verify('not-a-token', second), false);
});

test('csrf store expires tokens and bounds memory', async () => {
  const store = createCsrfStore({ ttlMs: 2, maxTokens: 2 });
  const expired = store.issue();
  await new Promise(resolve => setTimeout(resolve, 8));
  assert.equal(store.verify(expired, expired), false);
  store.issue();
  store.issue();
  store.issue();
  assert.equal(store.size(), 2);
});
