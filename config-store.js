const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { isUuid, normalizeConfig } = require('./binding-store');

const MAX_CONFIG_BYTES = 1024 * 1024;

function failure(code) {
  return new Error(code);
}

function assertSafePath(file, allowMissing = false) {
  const resolved = path.resolve(file);
  let current = resolved;
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw failure('binding_config_unsafe_path');
    } catch (error) {
      if (!(allowMissing && error.code === 'ENOENT')) throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolved;
}

function readRegular(file) {
  let descriptor;
  try {
    const resolved = assertSafePath(file);
    if (!fs.lstatSync(resolved).isFile()) throw failure('binding_config_unsafe_path');
    descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw failure('binding_config_unsafe_path');
    if (stat.size > MAX_CONFIG_BYTES) throw failure('binding_config_invalid');
    const bytes = fs.readFileSync(descriptor);
    if (bytes.length > MAX_CONFIG_BYTES) throw failure('binding_config_invalid');
    return { bytes, stat };
  } catch (error) {
    if (error.message?.startsWith('binding_')) throw error;
    if (error.code === 'ENOENT') throw failure('binding_config_missing');
    throw failure('binding_config_unavailable');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function parseConfig(bytes) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure('binding_config_invalid');
    return value;
  } catch {
    throw failure('binding_config_invalid');
  }
}

function currentBinding(value) {
  const binding = value.bindings?.[0];
  if (!Array.isArray(value.bindings) || value.bindings.length !== 1 ||
      !binding || typeof binding !== 'object' ||
      !isUuid(binding.bindingId) || !isUuid(binding.serviceClientId) || !isUuid(binding.browserClientId) ||
      value.activeBindingId !== binding.bindingId ||
      typeof binding.serviceCredential !== 'string' || !binding.serviceCredential.trim() ||
      typeof binding.expectedFingerprint !== 'string' ||
      !Array.isArray(value.bindingAliases) || value.bindingAliases.some(item => !isUuid(item))) {
    throw failure('binding_config_invalid');
  }
  const normalized = normalizeConfig(value);
  // Relocation must not silently normalize away identities, endpoints or aliases.
  if (!isDeepStrictEqual(normalized.bindings, value.bindings) ||
      !isDeepStrictEqual(normalized.bindingAliases, value.bindingAliases) ||
      normalized.activeBindingId !== value.activeBindingId) throw failure('binding_config_invalid');
  return normalized;
}

function createConfigStore({ stateDir, configDir = stateDir, requireExisting = false }) {
  const directory = path.resolve(configDir);
  const file = path.join(directory, 'config.json');
  return {
    file,
    load() {
      let record;
      try {
        record = readRegular(file);
      } catch (error) {
        if (!requireExisting && error.message === 'binding_config_missing') return normalizeConfig({});
        throw error;
      }
      const value = parseConfig(record.bytes);
      return requireExisting ? currentBinding(value) : normalizeConfig(value);
    },
    async save(value) {
      let temporary;
      try {
        assertSafePath(directory, true);
        await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
        assertSafePath(file, true);
        try {
          if (!fs.lstatSync(file).isFile()) throw failure('binding_config_unsafe_path');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        temporary = `${file}.${crypto.randomUUID()}.tmp`;
        await fsp.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        await fsp.rename(temporary, file);
        temporary = undefined;
      } catch (error) {
        if (error.message?.startsWith('binding_')) throw error;
        throw failure('binding_config_write_failed');
      } finally {
        if (temporary) await fsp.unlink(temporary).catch(() => {});
      }
    }
  };
}

function verifyBindingCopy(source, target) {
  const before = readRegular(source);
  const after = readRegular(target);
  if (path.resolve(source) === path.resolve(target) ||
      (before.stat.dev === after.stat.dev && before.stat.ino === after.stat.ino)) {
    throw failure('binding_copy_same_file');
  }
  currentBinding(parseConfig(before.bytes));
  currentBinding(parseConfig(after.bytes));
  if (!before.bytes.equals(after.bytes)) throw failure('binding_copy_conflict');
  return true;
}

if (require.main === module) {
  try {
    const [, , command, source, target, ...extra] = process.argv;
    if (command !== 'verify-copy' || !source || !target || extra.length) throw failure('binding_copy_usage');
    verifyBindingCopy(source, target);
    process.stdout.write('binding_copy_verified\n');
  } catch (error) {
    process.stderr.write((error.message?.startsWith('binding_') ? error.message : 'binding_copy_failed') + '\n');
    process.exitCode = 1;
  }
}

module.exports = { createConfigStore, verifyBindingCopy };
