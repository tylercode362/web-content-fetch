const { CALLBACK_URL } = require('./service-endpoints');

// Older saved values and deployment overrides are migrated to the fixed
// service-DNS endpoint. Bridge callbacks never depend on the browser's URL.
function validateCallbackUrl(value) {
  if (value && value !== CALLBACK_URL) throw new Error('callback_url_managed_by_service');
  return CALLBACK_URL;
}

function resolveCallbackUrl(value) {
  return validateCallbackUrl(value);
}

module.exports = { validateCallbackUrl, resolveCallbackUrl };
