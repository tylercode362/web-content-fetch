const crypto = require('node:crypto');

const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_TOKENS = 128;

function createCsrfStore(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? options.ttlMs
    : TOKEN_TTL_MS;
  const maxTokens = Number.isInteger(options.maxTokens) && options.maxTokens > 0
    ? options.maxTokens
    : MAX_TOKENS;
  const tokens = new Map();

  function purge(now = Date.now()) {
    for (const [token, expiresAt] of tokens) {
      if (expiresAt <= now) tokens.delete(token);
    }
    while (tokens.size > maxTokens) tokens.delete(tokens.keys().next().value);
  }

  return {
    issue() {
      const now = Date.now();
      purge(now);
      while (tokens.size >= maxTokens) tokens.delete(tokens.keys().next().value);
      const token = crypto.randomBytes(24).toString('base64url');
      tokens.set(token, now + ttlMs);
      return token;
    },

    verify(headerToken, cookieToken) {
      const candidate = String(headerToken || '');
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(candidate)) return false;
      const registeredUntil = tokens.get(candidate);
      if (registeredUntil && registeredUntil > Date.now()) return true;
      if (registeredUntil) {
        tokens.delete(candidate);
        return false;
      }
      return constantTimeEqual(candidate, cookieToken);
    },

    cookieHeader(token) {
      return 'wcf_csrf=' + encodeURIComponent(String(token)) + '; HttpOnly; SameSite=Strict; Path=/';
    },

    size() {
      purge();
      return tokens.size;
    }
  };
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return leftBuffer.length > 0 && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { MAX_TOKENS, TOKEN_TTL_MS, createCsrfStore };
