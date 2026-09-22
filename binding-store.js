const crypto = require('node:crypto');
const { normalizeBaseUrl } = require('./bridge-client');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID.test(String(value || ''));
}

function normalizeConfig(raw = {}, env = process.env) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const defaultBridgeUrl = normalizeBaseUrl(
    source.defaultBridgeUrl || source.bridgeUrl || env.WEB_CONTENT_FETCH_BRIDGE_URL || 'http://host.docker.internal:8788'
  );
  const callbackUrl = source.callbackUrl || env.WEB_CONTENT_FETCH_CALLBACK_URL;
  const validBindings = [];
  const seen = new Set();
  const inputBindings = Array.isArray(source.bindings) ? source.bindings : [];
  for (const item of inputBindings) {
    if (!item || !isUuid(item.bindingId) || !isUuid(item.serviceClientId) ||
        !isUuid(item.browserClientId) || seen.has(item.bindingId)) continue;
    seen.add(item.bindingId);
    validBindings.push(normalizeBinding(item, defaultBridgeUrl));
  }

  // Migrate the original single-binding shape without rotating its UUID or
  // credential. The server persists the canonical shape after startup.
  if (validBindings.length === 0 && isUuid(source.serviceClientId) && isUuid(source.browserClientId)) {
    const bindingId = isUuid(source.bindingId) ? source.bindingId : crypto.randomUUID();
    validBindings.push(normalizeBinding({
      bindingId,
      bridgeUrl: source.bridgeUrl || defaultBridgeUrl,
      expectedFingerprint: source.expectedFingerprint || env.WEB_CONTENT_FETCH_BRIDGE_FINGERPRINT || '',
      serviceClientId: source.serviceClientId,
      serviceCredential: source.serviceCredential || '',
      browserClientId: source.browserClientId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    }, defaultBridgeUrl));
  }

  const requestedActive = isUuid(source.activeBindingId) ? source.activeBindingId : '';
  const canonical = validBindings.find(item => item.bindingId === requestedActive) || validBindings[0] || null;
  const bindingAliases = [...new Set([
    ...(Array.isArray(source.bindingAliases) ? source.bindingAliases.filter(isUuid) : []),
    ...validBindings.map(item => item.bindingId),
    ...(isUuid(source.bindingId) ? [source.bindingId] : [])
  ])];
  return {
    defaultBridgeUrl,
    callbackUrl,
    activeBindingId: canonical?.bindingId || null,
    bindings: canonical ? [canonical] : [],
    bindingAliases
  };
}

function normalizeBinding(value, fallbackBridgeUrl) {
  return {
    bindingId: value.bindingId,
    bridgeUrl: normalizeBaseUrl(value.bridgeUrl || fallbackBridgeUrl),
    expectedFingerprint: String(value.expectedFingerprint || ''),
    serviceClientId: value.serviceClientId,
    serviceCredential: String(value.serviceCredential || ''),
    browserClientId: value.browserClientId,
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString())
  };
}

function getBinding(config, bindingId) {
  const canonical = config.bindings?.[0] || null;
  if (!canonical) return null;
  const requested = String(bindingId || '');
  if (!requested || requested === canonical.bindingId ||
      (Array.isArray(config.bindingAliases) && config.bindingAliases.includes(requested))) {
    return canonical;
  }
  return null;
}

function publicBindingProfile(binding) {
  return {
    bindingId: binding.bindingId,
    bridgeUrl: binding.bridgeUrl,
    expectedFingerprint: binding.expectedFingerprint || null,
    serviceClientId: binding.serviceClientId,
    browserClientId: binding.browserClientId,
    paired: Boolean(binding.serviceCredential),
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt
  };
}

function publicBinding(config) {
  const active = getBinding(config);
  return {
    bridgeUrl: active?.bridgeUrl || config.defaultBridgeUrl,
    callbackUrl: config.callbackUrl,
    activeBindingId: config.activeBindingId,
    serviceClientId: active?.serviceClientId || null,
    browserClientId: active?.browserClientId || null,
    expectedFingerprint: active?.expectedFingerprint || null,
    paired: Boolean(active?.serviceCredential),
    bindings: active ? [publicBindingProfile(active)] : []
  };
}

function applyBindingToJob(job, binding) {
  if (!binding) return job;
  job.bindingId = binding.bindingId;
  job.bridgeUrl = binding.bridgeUrl;
  job.browserClientId = binding.browserClientId;
  job.serviceClientId = binding.serviceClientId;
  return job;
}

module.exports = {
  applyBindingToJob,
  getBinding,
  isUuid,
  normalizeConfig,
  publicBinding,
  publicBindingProfile
};
