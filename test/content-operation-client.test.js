const test = require('node:test');
const assert = require('node:assert/strict');
const { callContentOperation, contentRequestDigest } = require('../content-operation-client');

test('lost acceptance reply retries the same durable request and executes once', async () => {
  const job = { id: 'job' };
  let creates = 0, executions = 0, saved = false, original;
  const client = {
    operationServerInstance: async () => 'instance',
    createContentOperation: async (body, operation) => {
      assert.equal(saved, true);
      creates++;
      if (!original) { original = operation.requestId; executions++; const error = Error('bridge_transport_failed'); error.name = 'BridgeTransportError'; throw error; }
      assert.equal(operation.requestId, original);
      return { success: true, state: 'running' };
    },
    getContentOperation: async () => ({ success: true, state: 'complete', result: { success: true, pageCount: 9 } })
  };
  const result = await callContentOperation({ client, job, body: { operationKey: 'job' }, update: (j, change) => { Object.assign(j, change); saved = true; }, wait: async () => {} });
  assert.equal(result.pageCount, 9);
  assert.equal(creates, 2);
  assert.equal(executions, 1);
  assert.equal(job.contentOperation.state, 'complete');
});

const update = (job, change) => Object.assign(job, change);
const body = { operationKey: 'job', mode: 'chapter', url: 'https://example.test/chapter' };
function clientFor(result) {
  return { operationServerInstance: async () => 'instance', createContentOperation: async () => result,
    getContentOperation: async () => result };
}

test('WCF restart reuses its persisted completed operation before checkpoint', async () => {
  const pending = { requestId: `${Date.now()}_persisted`, serverInstanceId: 'instance', digest: contentRequestDigest(body), state: 'pending' };
  const job = JSON.parse(JSON.stringify({ contentOperation: pending }));
  const client = clientFor({ success: true, state: 'complete', result: { success: true, pageCount: 3 } });
  client.operationServerInstance = async () => { throw Error('must not allocate a new operation'); };
  client.createContentOperation = async (request, operation) => {
    assert.equal(operation.requestId, pending.requestId);
    return { success: true, state: 'complete', result: { success: true, pageCount: 3 } };
  };
  assert.equal((await callContentOperation({ client, job, body, update })).pageCount, 3);
});

for (const code of ['content_operation_server_changed', 'content_operation_unknown', 'content_operation_expired', 'action_unsupported']) {
  test(`${code} fails closed without starting a replacement`, async () => {
    let calls = 0;
    const client = clientFor({ success: false, code });
    client.createContentOperation = async () => { calls++; return { success: false, code }; };
    const job = {};
    await assert.rejects(callContentOperation({ client, job, body, update, wait: async () => {} }),
      { code: code === 'action_unsupported' ? 'content_operations_unsupported' : code });
    assert.equal(calls, 1);
    assert.ok(job.contentOperation.requestId);
  });
}

test('different next step cannot bypass an unresolved previous step', async () => {
  const job = { contentOperation: { requestId: `${Date.now()}_previous`, serverInstanceId: 'instance', digest: 'different', state: 'pending' } };
  const client = clientFor({ success: true, state: 'running' });
  client.createContentOperation = async () => { throw Error('must not dispatch'); };
  await assert.rejects(callContentOperation({ client, job, body, update }), { code: 'content_operation_unresolved' });
  assert.equal(job.contentOperation.digest, 'different');
});

test('abort while polling leaves identity persisted and never resubmits', async () => {
  const controller = new AbortController();
  const client = clientFor({ success: true, state: 'running' });
  const job = {};
  await assert.rejects(callContentOperation({ client, job, body, update, signal: controller.signal,
    wait: async () => { controller.abort(); throw controller.signal.reason; } }), { name: 'AbortError' });
  assert.equal(job.contentOperation.state, 'pending');
});

test('only confirmed terminal retryable failure can create a second request', async () => {
  const ids = [];
  const client = clientFor({ success: true });
  client.createContentOperation = async (body, operation) => {
    ids.push(operation.requestId);
    return ids.length === 1
      ? { success: true, state: 'error', result: { success: false, code: 'browser_command_timeout' } }
      : { success: true, state: 'complete', result: { success: true } };
  };
  await callContentOperation({ client, job: {}, body, update, wait: async () => {} });
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
});

test('poll deadline preserves unresolved operation instead of creating another', async () => {
  let now = Date.now();
  const client = clientFor({ success: true, state: 'running' });
  const job = {};
  await assert.rejects(callContentOperation({ client, job, body, update, now: () => now, maxWaitMs: 10,
    wait: async () => { now += 10; } }), { code: 'content_operation_wait_timeout' });
  assert.equal(job.contentOperation.state, 'pending');
});

test('failure to persist identity prevents dispatch', async () => {
  const client = clientFor({ success: true });
  client.createContentOperation = async () => { throw Error('must not dispatch'); };
  await assert.rejects(callContentOperation({ client, job: {}, body,
    update: () => { throw Error('disk_write_failed'); } }), /disk_write_failed/);
});

test('a different step after confirmed completion does not depend on an expired old result', async () => {
  const job = { contentOperation: { requestId: '1000000000000_old', serverInstanceId: 'old', digest: 'previous', state: 'complete' } };
  const client = clientFor({ success: true, state: 'complete', result: { success: true } });
  client.getContentOperation = async () => { throw Error('old checkpoint result is not needed for the next step'); };
  await callContentOperation({ client, job, body, update });
  assert.notEqual(job.contentOperation.requestId, '1000000000000_old');
});

test('a legacy operation conflict cannot be bypassed on resume by changing the payload', async () => {
  const job = { contentOperation: { requestId: `${Date.now()}_blocked`, serverInstanceId: 'instance',
    digest: 'previous', state: 'error', code: 'content_operation_conflict' } };
  const client = clientFor({ success: true });
  client.createContentOperation = async () => { throw Error('must not dispatch'); };
  await assert.rejects(callContentOperation({ client, job, body, update }), { code: 'content_operation_unresolved' });
});

for (const code of ['content_operation_conflict', 'content_operation_payload_conflict']) {
  test(`recovered ${code} cannot clear identity before a different step`, async () => {
    const pending = { requestId: `${Date.now()}_previous`, serverInstanceId: 'instance', digest: 'previous', state: 'pending' };
    const job = { contentOperation: pending };
    const client = clientFor({ success: true, state: 'error', result: { success: false, code } });
    client.operationServerInstance = async () => { throw Error('must not allocate'); };
    client.createContentOperation = async () => { throw Error('must not dispatch'); };
    await assert.rejects(callContentOperation({ client, job, body, update }), { code: 'content_operation_unresolved' });
    assert.equal(job.contentOperation.requestId, pending.requestId);
    assert.equal(job.contentOperation.code, code);
  });
}

test('a create payload conflict pauses durably and cannot be bypassed on resume', async () => {
  const job = {};
  let creates = 0;
  const client = clientFor({ success: false, code: 'content_operation_payload_conflict' });
  client.createContentOperation = async () => { creates++; return { success: false, code: 'content_operation_payload_conflict' }; };
  await assert.rejects(callContentOperation({ client, job, body, update }), { code: 'content_operation_unresolved' });
  const identity = { ...job.contentOperation };
  await assert.rejects(callContentOperation({ client, job, body: { ...body, mode: 'asset' }, update }),
    { code: 'content_operation_unresolved' });
  assert.equal(creates, 1);
  assert.equal(job.contentOperation.requestId, identity.requestId);
  assert.equal(job.contentOperation.code, 'content_operation_payload_conflict');
});
