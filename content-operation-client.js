const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const terminalRetry = new Set(['browser_client_offline', 'browser_client_disconnected', 'browser_command_timeout',
  'browser_content_selector_timeout', 'browser_content_ready_timeout', 'browser_navigation_timeout', 'content_operation_stopped']);
const stopped = new Set(['content_operation_unknown', 'content_operation_expired', 'content_operation_server_changed',
  'content_operation_unresolved', 'content_operation_capacity', 'content_operation_wait_timeout', 'content_operations_unsupported']);

async function callContentOperation({ client, job, body, signal, update, now = Date.now,
  wait = (ms, stop) => delay(ms, undefined, { signal: stop }), pollMs = 2000, maxWaitMs = 2 * 60 * 60_000 + 5 * 60_000 }) {
  const digest = contentRequestDigest(body);
  let pending = job.contentOperation;
  const save = value => { pending = value; update(job, { contentOperation: value }); };
  const request = action => {
    const timeout = AbortSignal.timeout(15_000);
    return action(signal ? AbortSignal.any([signal, timeout]) : timeout);
  };
  if (pending?.code === 'content_operation_conflict') throw operationError('content_operation_unresolved');
  if (pending && pending.digest !== digest) {
    if (!['complete', 'error', 'cancelled'].includes(pending.state)) {
      const previous = await request(stop => client.getContentOperation(pending, { signal: stop }));
      assertStatus(previous);
      if (!['complete', 'error', 'cancelled'].includes(previous.state)) throw operationError('content_operation_unresolved');
    }
    save(null);
  }
  if (pending && ['error', 'cancelled'].includes(pending.state)) {
    if (pending.code === 'content_operation_conflict') throw operationError('content_operation_unresolved');
    save(null);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (signal?.aborted) throw signal.reason;
      if (!pending) {
        const instance = await request(stop => client.operationServerInstance(stop));
        save({ requestId: `${now()}_${crypto.randomUUID()}`, serverInstanceId: instance, digest, state: 'pending' });
      }
      let status = await request(stop => client.createContentOperation(body, pending, { signal: stop }));
      while (true) {
        assertStatus(status);
        if (['complete', 'error', 'cancelled'].includes(status.state)) {
          const result = status.result;
          if (!result || typeof result.success !== 'boolean') throw operationError('content_operation_unknown');
          save({ ...pending, state: status.state, ...(result.code ? { code: result.code } : {}) });
          if (status.state === 'complete' && result.success) return result;
          throw operationError(result.code === 'content_operation_conflict' ? 'content_operation_unresolved'
            : status.state === 'cancelled' ? 'content_operation_stopped' : result.code || 'browser_operation_failed');
        }
        if (status.state !== 'running') throw operationError('content_operation_unknown');
        if (now() - Number(pending.requestId.split('_', 1)[0]) >= maxWaitMs) throw operationError('content_operation_wait_timeout');
        await wait(pollMs, signal);
        status = await request(stop => client.getContentOperation(pending, { signal: stop }));
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      const knownTerminal = pending && ['error', 'cancelled'].includes(pending.state);
      const retryTerminal = knownTerminal && terminalRetry.has(error.code);
      const retryTransport = !knownTerminal && (error.name === 'BridgeTransportError' || error.code === 'bridge_transport_failed');
      if (stopped.has(error.code) || attempt === 2 || (!retryTerminal && !retryTransport)) throw error;
      if (retryTerminal) save(null);
      await wait(1000 * (attempt + 1), signal);
    }
  }
}

function assertStatus(status) {
  if (status?.success === false) throw operationError(status.code === 'action_unsupported'
    ? 'content_operations_unsupported' : status.code || 'content_operation_unknown');
  if (status?.state === 'expired') throw operationError('content_operation_expired');
  if (!status || status.success !== true) throw operationError('content_operation_unknown');
}

function operationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function contentRequestDigest(value) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

module.exports = { callContentOperation, contentRequestDigest };
