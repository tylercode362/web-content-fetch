const path = require('node:path');

function classifyOutput(value) {
  const normalized = String(value || '').replaceAll('\\', '/');
  if (!normalized || normalized !== path.posix.basename(normalized) || normalized.startsWith('.') || normalized.includes('\0')) return null;
  const lower = normalized.toLowerCase();
  if (lower.endsWith('.kepub.epub')) return { filename: normalized, format: 'KEPUB' };
  if (lower.endsWith('.epub')) return { filename: normalized, format: 'EPUB' };
  return null;
}

function publicDownloads(outputs) {
  if (!Array.isArray(outputs)) return [];
  return outputs.map(classifyOutput).filter(Boolean).map(({ filename, format }) => ({
    filename,
    format,
    href: `/downloads/${encodeURIComponent(filename)}`
  }));
}

module.exports = { classifyOutput, publicDownloads };
