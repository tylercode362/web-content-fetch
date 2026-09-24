function validateCallbackUrl(value, env = process.env, defaultPort = 8092) {
  const parsed = parseCallbackUrl(value);

  if (parsed.pathname === '/web-content-fetch/api/bridge/callback') {
    const allowedOrigins = String(env.WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS || '')
      .split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    if (!allowedOrigins.includes(parsed.origin.toLowerCase())) throw new Error('callback_url_origin_forbidden');
    const internalCallback = env.WEB_CONTENT_FETCH_CALLBACK_URL || `http://host.docker.internal:${defaultPort}/api/bridge/callback`;
    validateDirectCallbackUrl(parseCallbackUrl(internalCallback), env);
    return parsed.href;
  }

  return validateDirectCallbackUrl(parsed, env);
}

function resolveCallbackUrl(value, env = process.env, defaultPort = 8092) {
  const configuredUrl = validateCallbackUrl(value, env, defaultPort);
  if (new URL(configuredUrl).pathname !== '/web-content-fetch/api/bridge/callback') return configuredUrl;
  const internalCallback = env.WEB_CONTENT_FETCH_CALLBACK_URL ||
    'http://host.docker.internal:' + defaultPort + '/api/bridge/callback';
  return validateDirectCallbackUrl(parseCallbackUrl(internalCallback), env);
}

function parseCallbackUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new Error('callback_url_invalid');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || parsed.search) {
    throw new Error('callback_url_invalid');
  }
  return parsed;
}

function validateDirectCallbackUrl(parsed, env) {
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || parsed.search) {
    throw new Error('callback_url_invalid');
  }
  if (parsed.pathname !== '/api/bridge/callback') throw new Error('callback_url_invalid');
  if (isLoopbackHostname(parsed.hostname)) throw new Error('callback_url_must_be_reachable_from_bridge');
  const allowedHosts = String(env.WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS || 'host.docker.internal')
    .split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.some(allowed => host === allowed || (allowed.includes('.') && host.endsWith(`.${allowed}`)))) {
    throw new Error('callback_url_host_forbidden');
  }
  return parsed.href;
}

function isLoopbackHostname(hostname) {
  const value = String(hostname).toLowerCase();
  return value === 'localhost' || value === 'ip6-localhost' || value === '0.0.0.0' || value === '::1' ||
    value === '127.0.0.1' || value.startsWith('127.');
}

module.exports = { validateCallbackUrl, resolveCallbackUrl };
