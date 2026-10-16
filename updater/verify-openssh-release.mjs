// Build-time only. Public release materials never enter the updater runtime.
import {createHash} from 'node:crypto';
import {readFile, stat, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const ARTIFACTS = ['archive', 'signature', 'releaseKey'];
const MAX_BYTES = 32 * 1024 * 1024;
const fail = code => { throw new Error(code); };

export function validateLock(lock) {
  if (lock?.schemaVersion !== 1 || !/^\d+\.\d+p\d+$/.test(lock.version ?? '') ||
      !/^[A-F0-9]{40}$/.test(lock.primaryFingerprint ?? '') ||
      !/^[A-F0-9]{40}$/.test(lock.signerFingerprint ?? '') || lock.signatureDigestAlgorithm !== '10') fail('invalid_source_lock');
  const archive = `https://cdn.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-${lock.version}.tar.gz`;
  const urls = {archive, signature: `${archive}.asc`, releaseKey: 'https://cdn.openbsd.org/pub/OpenBSD/OpenSSH/RELEASE_KEY.asc'};
  for (const name of ARTIFACTS) {
    if (lock[name]?.url !== urls[name] || !/^[a-f0-9]{64}$/.test(lock[name]?.sha256 ?? '')) fail('invalid_source_lock');
  }
  return lock;
}

const artifactPath = (lock, name, directory) => join(directory, new URL(lock[name].url).pathname.split('/').at(-1));

export async function verifyArtifactHashes(lock, directory) {
  validateLock(lock);
  for (const name of ARTIFACTS) {
    const path = artifactPath(lock, name, directory);
    const info = await stat(path);
    if (!info.isFile() || info.size < 1 || info.size > MAX_BYTES) fail(`source_size_invalid:${name}`);
    const actual = createHash('sha256').update(await readFile(path)).digest('hex');
    if (actual !== lock[name].sha256) fail(`source_hash_mismatch:${name}`);
  }
}

export function assertSignatureStatus(result, lock) {
  validateLock(lock);
  const lines = (result.stdout ?? '').split(/\r?\n/).filter(line => line.startsWith('[GNUPG:] ')).map(line => line.slice(9).split(/\s+/));
  const rejected = new Set(['BADSIG', 'ERRSIG', 'EXPSIG', 'EXPKEYSIG', 'REVKEYSIG', 'KEYEXPIRED', 'SIGEXPIRED', 'NO_PUBKEY', 'NODATA', 'FAILURE', 'ERROR']);
  const valid = lines.filter(fields => fields[0] === 'VALIDSIG');
  const good = lines.filter(fields => fields[0] === 'GOODSIG');
  if (result.status !== 0 || result.error || lines.some(fields => rejected.has(fields[0])) || valid.length !== 1 || good.length !== 1) fail('source_signature_invalid');
  const fields = valid[0];
  if (fields[1] !== lock.signerFingerprint || fields[10] !== lock.primaryFingerprint || fields[8] !== lock.signatureDigestAlgorithm || fields[9] !== '00' || good[0][1] !== lock.signerFingerprint.slice(-16)) fail('source_signature_invalid');
}

export async function verifyReleaseDirectory(lock, directory) {
  await verifyArtifactHashes(lock, directory);
  const home = await mkdtemp(join(tmpdir(), 'updater-release-gpg-'));
  const options = {encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, shell: false};
  const common = ['--no-options', '--batch', '--no-tty', '--no-autostart', '--homedir', home, '--no-auto-key-retrieve', '--auto-key-locate', 'clear'];
  try {
    // A dedicated public-key ring avoids importing into any user keyring or
    // starting an agent. Keep gpg verification so expiry/revocation status is checked.
    const keyring = join(home, 'release-keyring.gpg');
    const converted = spawnSync('gpg', [...common, '--output', keyring, '--dearmor', artifactPath(lock, 'releaseKey', directory)], options);
    if (converted.status !== 0 || converted.error) fail('source_key_conversion_failed');
    const verified = spawnSync('gpg', [...common, '--no-default-keyring', '--keyring', keyring, '--status-fd=1', '--verify', artifactPath(lock, 'signature', directory), artifactPath(lock, 'archive', directory)], options);
    assertSignatureStatus(verified, lock);
  } finally {
    await rm(home, {recursive: true, force: true});
  }
  return {version: lock.version, sha256: lock.archive.sha256, signerFingerprint: lock.signerFingerprint};
}

async function download(lock, directory) {
  validateLock(lock);
  // Refuse an existing output directory; never overwrite user materials.
  await mkdir(directory, {mode: 0o700});
  for (const name of ARTIFACTS) {
    await downloadArtifact(lock, name, directory);
  }
  return verifyReleaseDirectory(lock, directory);
}

export function retryableDownload(result) {
  const http = Number((result.stdout ?? '').trim());
  if ([401, 403, 429].includes(http) || /permission denied|operation not permitted|access denied|not authorized|approval.*(?:denied|cancel)/i.test(result.stderr ?? '')) return false;
  if ([35, 51, 58, 60, 77, 90].includes(result.status)) return false;
  if (result.status === 22) return [408, 500, 502, 503, 504].includes(http);
  return [5, 6, 7, 18, 28, 52, 55, 56].includes(result.status) || result.error?.code === 'ETIMEDOUT';
}

export async function downloadArtifact(lock, name, directory, {
  run = spawnSync,
  wait = ms => new Promise(done => setTimeout(done, ms)),
  record = item => console.error(JSON.stringify(item)),
} = {}) {
  validateLock(lock);
  if (!ARTIFACTS.includes(name)) fail('invalid_source_artifact');
  for (let attempt = 1; attempt <= 6; attempt++) {
    const result = run('curl', [
      '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https',
      '--connect-timeout', '20', '--max-time', '120', '--max-filesize', String(MAX_BYTES),
      '--write-out', '%{http_code}', '--output', artifactPath(lock, name, directory), lock[name].url,
    ], {encoding: 'utf8', timeout: 125000, maxBuffer: 1024 * 1024, shell: false});
    const httpStatus = Number((result.stdout ?? '').trim());
    record({event: 'openssh_source_download', artifact: name, attempt, exitCode: result.status, httpStatus,
      errorCode: result.error?.code ?? null, detail: (result.stderr ?? '').trim().slice(0, 1024)});
    if (result.status === 0 && !result.error && httpStatus === 200) return;
    // Never retry rate limits, authorization/TLS failures or explicit denials.
    if (attempt === 6 || !retryableDownload(result)) fail(`source_download_failed:${name}`);
    await wait(attempt * 2000);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, directory, ...extra] = process.argv.slice(2);
    if (!['download', 'verify'].includes(mode) || !directory || extra.length) fail('usage: download|verify MATERIAL_DIRECTORY');
    const lock = JSON.parse(await readFile(new URL('./openssh-source.lock.json', import.meta.url), 'utf8'));
    console.log(JSON.stringify(await (mode === 'download' ? download(lock, resolve(directory)) : verifyReleaseDirectory(lock, resolve(directory)))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
