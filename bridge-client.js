const crypto = require('node:crypto');
const {
  Handshake,
  Noise_25519_ChaChaPoly_BLAKE2s
} = require('salty-crypto');

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class BridgeTransportError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BridgeTransportError';
    this.status = status;
  }
}

class SecureSession {
  constructor(sessionId, sendCipher, receiveCipher) {
    this.sessionId = sessionId;
    this.sendCipher = sendCipher;
    this.receiveCipher = receiveCipher;
    this.sendCount = 0;
    this.receiveCount = 0;
    this.createdAt = Date.now();
    this.closed = false;
  }

  get expired() {
    return this.closed || Date.now() - this.createdAt >= 60 * 60 * 1000;
  }

  encryptJson(value) {
    this.assertOpen();
    const chunks = this.sendCipher.encrypt_large(textEncoder.encode(JSON.stringify(value)));
    const frame = {
      version: 1,
      sessionId: this.sessionId,
      counter: this.sendCount,
      ciphertext: chunks.map(toBase64)
    };
    this.sendCount += 1;
    return frame;
  }

  decryptJson(frame) {
    this.assertOpen();
    if (!frame || frame.version !== 1 || frame.sessionId !== this.sessionId ||
        frame.counter !== this.receiveCount) {
      throw new Error('secure_frame_rejected');
    }
    const chunks = Array.isArray(frame.ciphertext) ? frame.ciphertext : [frame.ciphertext];
    if (chunks.length < 1 || chunks.length > 256) throw new Error('secure_frame_rejected');
    const plaintext = this.receiveCipher.decrypt_large(chunks.map(fromBase64));
    this.receiveCount += 1;
    return JSON.parse(textDecoder.decode(plaintext));
  }

  close() {
    this.closed = true;
  }

  assertOpen() {
    if (this.expired) {
      this.closed = true;
      throw new Error('secure_session_expired');
    }
  }
}

class BridgeClient {
  constructor(options = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl || 'http://host.docker.internal:8788');
    this.expectedFingerprint = options.expectedFingerprint || '';
    this.serviceClientId = options.serviceClientId || crypto.randomUUID();
    this.serviceCredential = options.serviceCredential || '';
    this.browserClientId = options.browserClientId || '';
    this.session = null;
    this.connecting = null;
    this.requestTail = Promise.resolve();
  }

  update(options = {}) {
    const nextUrl = normalizeBaseUrl(options.baseUrl || this.baseUrl);
    if (nextUrl !== this.baseUrl) this.invalidateSession();
    this.baseUrl = nextUrl;
    if (options.expectedFingerprint !== undefined) this.expectedFingerprint = String(options.expectedFingerprint || '');
    if (options.serviceClientId) this.serviceClientId = options.serviceClientId;
    if (options.serviceCredential !== undefined) this.serviceCredential = String(options.serviceCredential || '');
    if (options.browserClientId !== undefined) this.browserClientId = String(options.browserClientId || '');
  }

  get paired() {
    return Boolean(this.serviceCredential && this.browserClientId);
  }

  async connect(signal) {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const metadata = await this.json('/v1/secure/key', undefined, signal);
      const publicKey = fromBase64(String(metadata.publicKey || ''));
      const actualFingerprint = fingerprint(publicKey);
      if (this.expectedFingerprint && normalizeFingerprint(actualFingerprint) !== normalizeFingerprint(this.expectedFingerprint)) {
        throw new Error('bridge_key_fingerprint_mismatch');
      }
      const handshake = new Handshake(Noise_25519_ChaChaPoly_BLAKE2s, 'NK', 'initiator', {
        remoteStaticPublicKey: publicKey
      });
      const outgoing = handshake.writeMessage(new Uint8Array());
      const reply = await this.json('/v1/secure/handshakes', { message: toBase64(outgoing.packet) }, signal);
      const incoming = handshake.readMessage(fromBase64(String(reply.message || '')));
      if (!incoming.finished) throw new Error('bridge_handshake_incomplete');
      this.session?.close();
      this.session = new SecureSession(reply.sessionId, incoming.finished.send, incoming.finished.recv);
      this.serverInstanceId = String(reply.serverInstanceId || '');
      this.fingerprint = actualFingerprint;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async pair(pairingCode, displayName = 'web-content-fetch') {
    const response = await this.request({
      action: 'service.pair',
      pairingCode: String(pairingCode || ''),
      serviceClientId: this.serviceClientId,
      displayName
    });
    if (!response?.success || typeof response.serviceCredential !== 'string' ||
        typeof response.browserClientId !== 'string') {
      throw new Error(String(response?.code || 'authentication_failed'));
    }
    this.serviceCredential = response.serviceCredential;
    this.browserClientId = response.browserClientId;
    return {
      serviceClientId: this.serviceClientId,
      serviceCredential: this.serviceCredential,
      browserClientId: this.browserClientId,
      fingerprint: this.fingerprint || ''
    };
  }

  async listBrowserClients() {
    return this.authenticatedRequest('browser.clients.list');
  }

  async contentFetch(body, options = {}) {
    if (!this.browserClientId) throw new Error('browser_client_not_configured');
    const response = await this.authenticatedRequest('content.fetch', this.browserClientId, body, options);
    return assertBridgeSuccess(response);
  }

  async cancelContentFetch(operationKey, options = {}) {
    if (!this.browserClientId) throw new Error('browser_client_not_configured');
    const response = await this.authenticatedRequest('content.cancel', this.browserClientId, { operationKey }, options);
    return assertBridgeSuccess(response);
  }

  async revokeSelf() {
    const response = await this.authenticatedRequest('credential.revokeSelf');
    if (response?.success) {
      this.serviceCredential = '';
      this.browserClientId = '';
    }
    return response;
  }

  async authenticatedRequest(action, browserClientId, body, options = {}) {
    if (!this.serviceCredential) throw new Error('service_not_enrolled');
    return this.request({
      action,
      serviceClientId: this.serviceClientId,
      serviceCredential: this.serviceCredential,
      ...(browserClientId ? { browserClientId } : {}),
      ...(body ? { body } : {})
    }, options);
  }

  async request(value, options = {}) {
    const signal = options.signal;
    const run = this.requestTail.then(() => {
      if (signal?.aborted) throw abortError();
      return this.requestInOrder(value, signal);
    });
    this.requestTail = run.then(() => undefined, () => undefined);
    return run;
  }

  async requestInOrder(value, signal) {
    if (!this.session || this.session.expired) await this.connect(signal);
    try {
      return await this.sendOnCurrentSession(value, signal);
    } catch (error) {
      const retry = error instanceof BridgeTransportError && error.status === 401;
      this.invalidateSession();
      if (!retry) throw error;
      await this.connect(signal);
      try {
        return await this.sendOnCurrentSession(value, signal);
      } finally {
        this.invalidateSession();
      }
    }
  }

  async sendOnCurrentSession(value, signal) {
    const session = this.session;
    if (!session) throw new Error('bridge_session_missing');
    const response = await this.json('/v1/secure/request', session.encryptJson(value), signal);
    try {
      return session.decryptJson(response);
    } catch {
      throw new BridgeTransportError(200, 'secure_transport_failed');
    }
  }

  invalidateSession() {
    this.session?.close();
    this.session = null;
  }

  async json(path, body, signal) {
    let response;
    try {
      response = await fetch(this.baseUrl + path, body === undefined
        ? { headers: { connection: 'close' }, signal }
        : {
          method: 'POST',
          headers: { 'content-type': 'application/json', connection: 'close' },
          body: JSON.stringify(body),
          signal
        });
    } catch (error) {
      if (isAbortError(error)) throw error;
      const transportError = new BridgeTransportError(0, 'bridge_transport_failed');
      transportError.cause = error;
      throw transportError;
    }
    if (!response.ok) throw new BridgeTransportError(response.status, 'bridge_transport_failed');
    return response.json();
  }
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function abortError() {
  const error = new Error('request_aborted');
  error.name = 'AbortError';
  return error;
}

function assertBridgeSuccess(response) {
  if (response?.success === false) {
    const error = new Error(String(response.code || 'bridge_request_failed'));
    error.code = String(response.code || 'bridge_request_failed');
    throw error;
  }
  return response;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value));
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    throw new Error('bridge_url_invalid');
  }
  return parsed.href.replace(/\/$/, '');
}

function toBase64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('invalid_base64');
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(Buffer.from(value)).digest('hex').toUpperCase().match(/.{1,4}/g).join('-');
}

function normalizeFingerprint(value) {
  return String(value || '').replace(/[^0-9A-F]/gi, '').toUpperCase();
}

module.exports = { BridgeClient, BridgeTransportError, normalizeBaseUrl, normalizeFingerprint };
