#!/usr/bin/env node
// Dedicated NAS repository boundary. No HTTP server, Docker socket, checkout or repo commands.
import {constants} from 'node:fs';
import {chmod, lstat, mkdir, open, readdir, rename, rmdir, unlink} from 'node:fs/promises';
import {createHash, randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {DEPLOY_PROJECTS, deploymentRequestId, exportPinnedSource} from './repository-source.mjs';

export const PROJECT_IDS = Object.freeze(['prime-video', 'opendata-research', 'spatial-sketch', 'tw-stock-valuation-lab', 'chrome-bridge', 'web-content-fetch', 'self-home-3d', 'local-gateway']);
export const POLL_INTERVAL_MS = 300_000;
export const DEFAULT_PATHS = Object.freeze({config: '/repo-config', keys: '/deploy-keys', state: '/repo-state'});
const ENV_KEYS = ['REPO_CONFIG_VERSION', 'REPO_PROJECT_ID', 'REPO_GITHUB', 'REPO_BRANCH', 'REPO_SSH_KEY_PATH', 'REPO_KNOWN_HOSTS_PATH', 'REPO_POLL_ENABLED', 'REPO_DEPLOY_MODE'];
const MAX_FILE = 32 * 1024;
const VERIFY_LIFETIME_MS = 15 * 60_000;
const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
// Kill the full Git/SSH process group on timeout or excess stdout. stderr is discarded.
export function executeBounded(file, args, options) {
  return new Promise((resolvePromise, reject) => {
    let child; let timer; let settled = false; let failed = false; let size = 0; const chunks = [];
    const signal = options.signal;
    const stop = () => { failed = true; if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } };
    const finish = (error) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', stop); if (error) reject(new Error(signal?.aborted ? 'operation_cancelled' : 'command_failed')); else resolvePromise({stdout: Buffer.concat(chunks).toString('utf8')}); };
    if (signal?.aborted) { finish(true); return; }
    try { child = spawn(file, args, {cwd: options.cwd, env: options.env, detached: true, shell: false, stdio: ['ignore', 'pipe', 'ignore']}); }
    catch { finish(true); return; }
    child.once('error', () => finish(true));
    child.stdout.on('data', (chunk) => { size += chunk.length; if (size > options.maxBuffer) stop(); else chunks.push(chunk); });
    // Wait for process termination before releasing a store lock or cleaning source files.
    child.once('close', (code, childSignal) => finish(failed || code !== 0 || childSignal));
    signal?.addEventListener('abort', stop, {once: true});
    timer = setTimeout(stop, options.timeout);
    if (signal?.aborted) stop();
  });
}
const SAFE_CODES = new Set(['invalid_config', 'invalid_project', 'invalid_repository', 'invalid_host_key', 'unsafe_directory', 'unsafe_file', 'already_exists', 'confirmation_required', 'not_configured', 'host_key_missing', 'key_missing', 'verification_required', 'verification_expired', 'git_failed', 'invalid_remote_ref', 'key_generation_failed', 'setup_incomplete', 'repository_mismatch', 'repository_store_busy', 'storage_failed', 'invalid_state', 'deployment_contract_unavailable', 'deployment_approval_required', 'source_export_failed', 'operation_cancelled', 'requested_sha_not_main', 'deployment_queue_busy', 'repository_scheduler_busy', 'updater_ownership_required', 'project_scope_required']);
class RepositoryError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (code) => { throw new RepositoryError(code); };
export const safeRepositoryError = (error) => ({ok: false, status: error instanceof RepositoryError && SAFE_CODES.has(error.code) ? error.code : 'storage_failed'});
const checkAbort = (signal) => { if (signal?.aborted) fail('operation_cancelled'); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assertProject = (id) => { if (!PROJECT_IDS.includes(id)) fail('invalid_project'); return id; };
const assertRepository = (repo) => { if (typeof repo !== 'string' || !REPOSITORY.test(repo) || /[\r\n]/.test(repo) || repo.split('/')[1].endsWith('.git') || repo.includes('..')) fail('invalid_repository'); return repo; };
const assertConfirmation = (confirmed) => { if (confirmed !== true) fail('confirmation_required'); };

export function validateRepositoryConfig(value, paths = DEFAULT_PATHS) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== ENV_KEYS.length || Object.keys(value).some((k) => !ENV_KEYS.includes(k))) fail('invalid_config');
  const id = assertProject(value.REPO_PROJECT_ID);
  assertRepository(value.REPO_GITHUB);
  if (value.REPO_CONFIG_VERSION !== '1' || value.REPO_BRANCH !== 'main' || value.REPO_SSH_KEY_PATH !== join(paths.keys, id, 'id_ed25519') || value.REPO_KNOWN_HOSTS_PATH !== join(paths.keys, 'github_known_hosts') || !['true', 'false'].includes(value.REPO_POLL_ENABLED) || !['disabled', 'supervisor-v1'].includes(value.REPO_DEPLOY_MODE) || (value.REPO_DEPLOY_MODE === 'supervisor-v1' && !DEPLOY_PROJECTS.includes(id))) fail('invalid_config');
  return {...value};
}
export function parseRepositoryEnv(bytes, paths = DEFAULT_PATHS) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_FILE || bytes.includes(0)) fail('invalid_config');
  const result = Object.create(null);
  for (const line of bytes.toString('utf8').split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Z_]+)=([A-Za-z0-9/._-]+)$/.exec(line);
    if (!match || Object.hasOwn(result, match[1]) || !ENV_KEYS.includes(match[1])) fail('invalid_config');
    result[match[1]] = match[2];
  }
  return validateRepositoryConfig(result, paths);
}
const renderEnv = (config) => `${ENV_KEYS.map((key) => `${key}=${config[key]}`).join('\n')}\n`;

export function validateHostKey(line) {
  const match = /^github\.com ssh-ed25519 ([A-Za-z0-9+/]{68})\n?$/.exec(line);
  if (!match) fail('invalid_host_key');
  const bytes = Buffer.from(match[1], 'base64');
  const prefix = Buffer.from('0000000b7373682d6564323535313900000020', 'hex');
  if (bytes.length !== 51 || !bytes.subarray(0, prefix.length).equals(prefix)) fail('invalid_host_key');
  return {line: `github.com ssh-ed25519 ${match[1]}\n`, fingerprint: `SHA256:${createHash('sha256').update(bytes).digest('base64').replace(/=+$/, '')}`};
}
export function parseMainRef(stdout) {
  if (typeof stdout !== 'string' || stdout.length > 256) fail('invalid_remote_ref');
  const match = /^([a-f0-9]{40})\trefs\/heads\/main\n?$/.exec(stdout);
  if (!match) fail('invalid_remote_ref');
  return match[1];
}

// Never inherit GIT_CONFIG_*, SSH_AUTH_SOCK, proxies, HOME, askpass or URL rewrite rules.
export function gitInvocation(config, wrapperPath) {
  validateRepositoryConfig(config, {keys: dirname(config.REPO_KNOWN_HOSTS_PATH)});
  if (!isAbsolute(wrapperPath) || !/^\/[A-Za-z0-9/._-]+$/.test(wrapperPath)) fail('invalid_config');
  return {file: '/usr/bin/git', args: ['-c', 'protocol.allow=never', '-c', 'protocol.ssh.allow=always', '-c', 'core.hooksPath=/dev/null', '-c', 'gc.auto=0', 'ls-remote', '--exit-code', '--refs', `git@github.com:${config.REPO_GITHUB}.git`, 'refs/heads/main'], options: {cwd: '/', timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: MAX_FILE, encoding: 'utf8', env: {
    PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C', LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'ssh', GIT_SSH: wrapperPath, GIT_SSH_VARIANT: 'ssh',
    REPO_SSH_KEY_PATH: config.REPO_SSH_KEY_PATH, REPO_KNOWN_HOSTS_PATH: config.REPO_KNOWN_HOSTS_PATH,
  }}};
}

export function createRepositoryStore({paths = DEFAULT_PATHS, projectId = null, now = Date.now, execute = executeBounded, wrapperPath = fileURLToPath(new URL('./repository-ssh.sh', import.meta.url))} = {}) {
  const projectIds = projectId === null ? PROJECT_IDS : [assertProject(projectId)];
  const checkProject = (id) => { assertProject(id); if (!projectIds.includes(id)) fail('invalid_project'); return id; };
  const uid = process.getuid?.();
  const pathValues = Object.values(paths);
  if (Object.keys(paths).sort().join(',') !== 'config,keys,state' || new Set(pathValues).size !== 3 || pathValues.some((p) => typeof p !== 'string' || !isAbsolute(p) || resolve(p) !== p || !/^\/[A-Za-z0-9/._-]+$/.test(p)) || pathValues.some((p, i) => pathValues.some((q, j) => i !== j && p.startsWith(`${q}/`)))) fail('unsafe_directory');
  async function directoryCheck(directory, exact = true) {
    let current = directory;
    while (true) {
      const info = await lstat(current).catch(() => fail('unsafe_directory'));
      if (uid === undefined || info.isSymbolicLink() || !info.isDirectory() || (info.uid !== uid && info.uid !== 0) || (info.mode & 0o022) !== 0 || (current === directory && exact && (info.uid !== uid || (info.mode & 0o7777) !== 0o700))) fail('unsafe_directory');
      if (current === '/') break;
      current = dirname(current);
    }
  }
  async function checkRoots() { for (const directory of pathValues) await directoryCheck(directory); }
  async function fileInfo(path) {
    let info;
    try { info = await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.uid !== uid || info.nlink !== 1 || (info.mode & 0o7777) !== 0o600 || info.size > MAX_FILE) fail('unsafe_file');
    return info;
  }
  async function readSafe(path) {
    const before = await fileInfo(path);
    if (!before) return null;
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const after = await handle.stat();
      if (after.dev !== before.dev || after.ino !== before.ino || !after.isFile() || after.nlink !== 1 || after.uid !== uid || (after.mode & 0o7777) !== 0o600 || after.size > MAX_FILE) fail('unsafe_file');
      const bytes = Buffer.alloc(MAX_FILE + 1);
      let size = 0;
      while (size < bytes.length) { const result = await handle.read(bytes, size, bytes.length - size, null); if (!result.bytesRead) break; size += result.bytesRead; }
      if (size > MAX_FILE) fail('unsafe_file');
      return bytes.subarray(0, size);
    } finally { await handle.close(); }
  }
  async function syncDir(path) { const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY); try { await handle.sync(); } finally { await handle.close(); } }
  async function atomicWrite(path, bytes) {
    await fileInfo(path);
    const temp = join(dirname(path), `.pending-${randomBytes(12).toString('hex')}`);
    let handle;
    try {
      handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
      await rename(temp, path); await syncDir(dirname(path));
    } finally { if (handle) await handle.close(); await unlink(temp).catch((e) => { if (e.code !== 'ENOENT') throw e; }); }
  }
  async function withLock(action) {
    await checkRoots();
    const path = join(paths.state, '.repository.lock');
    try { await mkdir(path, {mode: 0o700}); } catch (error) { if (error.code === 'EEXIST') fail('repository_store_busy'); throw error; }
    try { return await action(); } finally { await rmdir(path); }
  }
  const configPath = (id) => join(paths.config, `${checkProject(id)}.env`);
  const statePath = (id, kind) => join(paths.state, `${checkProject(id)}.${kind}.json`);
  async function readConfig(id) { const bytes = await readSafe(configPath(id)); if (!bytes) fail('not_configured'); const config = parseRepositoryEnv(bytes, paths); if (config.REPO_PROJECT_ID !== id) fail('invalid_config'); return config; }
  async function readState(id, kind) {
    const bytes = await readSafe(statePath(id, kind));
    if (!bytes) return null;
    try { const value = JSON.parse(bytes); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_state'); return value; } catch { fail('invalid_state'); }
  }
  const writeState = (id, kind, value) => atomicWrite(statePath(id, kind), `${JSON.stringify(value)}\n`);
  async function keyBinding(config) {
    await directoryCheck(dirname(config.REPO_SSH_KEY_PATH));
    const privateKey = await readSafe(config.REPO_SSH_KEY_PATH);
    const hostKey = await readSafe(config.REPO_KNOWN_HOSTS_PATH);
    if (!privateKey?.length) fail('key_missing');
    if (!hostKey?.length) fail('host_key_missing');
    validateHostKey(hostKey.toString('utf8'));
    // Hash never leaves the private verification record, and is invalidated on key/pin change.
    return sha256(JSON.stringify({repo: config.REPO_GITHUB, branch: config.REPO_BRANCH, key: sha256(privateKey), host: sha256(hostKey)}));
  }
  async function remoteMain(config, {signal} = {}) {
    checkAbort(signal);
    const command = gitInvocation(config, wrapperPath);
    let result;
    try { result = await execute(command.file, command.args, {...command.options, signal}); } catch { checkAbort(signal); fail('git_failed'); }
    checkAbort(signal);
    return parseMainRef(result.stdout);
  }
  async function readContract(config) {
    if (!DEPLOY_PROJECTS.includes(config.REPO_PROJECT_ID)) fail('deployment_contract_unavailable');
    await directoryCheck(join(paths.state, 'deploy-status'));
    const bytes = await readSafe(join(paths.state, 'deploy-status', 'contracts.json'));
    if (!bytes) fail('deployment_contract_unavailable');
    let contracts;
    try { contracts = JSON.parse(bytes); } catch { fail('deployment_contract_unavailable'); }
    if (contracts?.version !== 1 || !Array.isArray(contracts.contracts) || contracts.contracts.length > DEPLOY_PROJECTS.length) fail('deployment_contract_unavailable');
    const matches = contracts.contracts.filter((item) => item.project === config.REPO_PROJECT_ID);
    if (matches.length !== 1) fail('deployment_contract_unavailable');
    const contract = matches[0];
    if (contract.repository !== config.REPO_GITHUB || contract.adapterVersion !== 'supervisor-v1' || contract.ready !== true || !/^[a-f0-9]{64}$/.test(contract.contractHash)) fail('deployment_contract_unavailable');
    return contract;
  }
  async function prepareQueue() {
    for (const name of ['deploy-inbox']) {
      const path = join(paths.state, name);
      try { await mkdir(path, {mode: 0o700}); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      await directoryCheck(path);
    }
    await directoryCheck(join(paths.state, 'deploy-status'));
  }
  async function readQueue(name, id) {
    await directoryCheck(join(paths.state, name));
    const bytes = await readSafe(join(paths.state, name, `${id}.json`));
    if (!bytes) return null;
    try { const value = JSON.parse(bytes); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_state'); return value; } catch { fail('invalid_state'); }
  }
  async function queueDeployment(config, sha, binding, options = {}) {
    await prepareQueue();
    const lock = join(paths.state, 'deploy-inbox', `.${config.REPO_PROJECT_ID}.queue.lock`);
    try { await mkdir(lock, {mode: 0o700}); } catch (error) { if (error.code === 'EEXIST') fail('deployment_queue_busy'); throw error; }
    try { return await queueDeploymentLocked(config, sha, binding, options); }
    finally { await rmdir(lock); }
  }
  async function queueDeploymentLocked(config, sha, binding, {signal} = {}) {
    checkAbort(signal);
    const id = config.REPO_PROJECT_ID; const contract = await readContract(config);
    const approval = await readState(id, 'deployment-approval');
    if (!approval || approval.version !== 1 || approval.binding !== binding || approval.contractHash !== contract.contractHash) fail('deployment_approval_required');
    await prepareQueue();
    const requestId = deploymentRequestId(id, config.REPO_GITHUB, sha);
    const existing = await readQueue('deploy-inbox', id); const receipt = await readQueue('deploy-status', id);
    const receiptMatches = existing && receipt && receipt.version === 1 && receipt.project === id && receipt.requestId === existing.requestId && receipt.sha === existing.sha && receipt.contractHash === existing.contractHash;
    const terminal = receiptMatches && ['healthy', 'rolled_back', 'failed', 'recovery_required'].includes(receipt.status);
    if (existing) {
      if (existing.contractHash !== contract.contractHash) fail('deployment_approval_required');
      if (existing.version !== 1 || existing.project !== id || existing.repository !== config.REPO_GITHUB || !SHA.test(existing.sha) || existing.requestId !== deploymentRequestId(id, existing.repository, existing.sha)) fail('invalid_state');
      if (existing.requestId === requestId) return {deploymentStatus: receiptMatches ? (['accepted', 'preparing', 'deploying', 'healthy', 'rolled_back', 'failed', 'recovery_required'].includes(receipt.status) ? receipt.status : 'pending') : 'pending', deployedSha: receiptMatches && receipt.status === 'healthy' ? sha : null};
      if (!terminal || receipt.status === 'recovery_required') return {deploymentStatus: 'previous_deployment_pending', deployedSha: null};
    }
    try { await exportPinnedSource({project: id, repository: config.REPO_GITHUB, sha, stateDirectory: paths.state, command: gitInvocation(config, wrapperPath), execute, checkDirectory: directoryCheck, atomicJson: atomicWrite, signal}); }
    catch { checkAbort(signal); fail('source_export_failed'); }
    checkAbort(signal);
    await atomicWrite(join(paths.state, 'deploy-inbox', `${id}.json`), `${JSON.stringify({version: 1, project: id, repository: config.REPO_GITHUB, sha, requestId, contractHash: contract.contractHash, requestedAt: now()})}\n`);
    return {deploymentStatus: 'queued', deployedSha: null};
  }
  function validVerification(record, binding) {
    return record && record.version === 1 && record.binding === binding && SHA.test(record.sha) && Number.isSafeInteger(record.verifiedAt) && record.verifiedAt > 0 && record.verifiedAt <= now();
  }
  async function requireOwnership() {
    if (projectId === null) return;
    const bytes = await readSafe(join(paths.state, 'updater-owner.json'));
    let owner; try { owner = JSON.parse(bytes); } catch { fail('updater_ownership_required'); }
    if (!owner || Object.keys(owner).sort().join(',') !== 'legacyRetired,mode,project,version' || owner.version !== 1 || owner.project !== projectId || owner.mode !== 'independent' || owner.legacyRetired !== true) fail('updater_ownership_required');
  }
  return {
    async withSchedulerLock(action) {
      if (projectId === null) return action();
      await checkRoots(); await requireOwnership();
      const lock = join(paths.state, '.scheduler.lock');
      try { await mkdir(lock, {mode: 0o700}); } catch (error) { if (error.code === 'EEXIST') fail('repository_scheduler_busy'); throw error; }
      try { return await action(); } finally { await rmdir(lock); }
    },
    async dueIn() {
      if (projectId === null) return 0;
      await checkRoots(); await requireOwnership();
      const bytes = await readSafe(join(paths.state, 'worker-status.json'));
      if (!bytes) return 0;
      let state; try { state = JSON.parse(bytes); } catch { fail('invalid_state'); }
      if (!Number.isSafeInteger(state.checkedAt) || state.checkedAt > now() || state.checkedAt <= 0) fail('invalid_state');
      return Math.max(0, POLL_INTERVAL_MS - (now() - state.checkedAt));
    },
    async hostStatus() { return withLock(async () => { const bytes = await readSafe(join(paths.keys, 'github_known_hosts')); if (!bytes) return {ok: false, status: 'host_key_missing'}; const host = validateHostKey(bytes.toString('utf8')); return {ok: true, status: 'host_key_pinned', fingerprint: host.fingerprint}; }); },
    async inspect(id, repository) {
      checkProject(id); assertRepository(repository);
      return withLock(async () => {
        if (!await fileInfo(configPath(id))) {
          const host = await readSafe(join(paths.keys, 'github_known_hosts'));
          if (!host) fail('host_key_missing');
          validateHostKey(host.toString('utf8'));
          const partial = await lstat(join(paths.keys, id)).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
          return {ok: false, status: partial ? 'setup_incomplete' : 'not_configured', project: id};
        }
        const config = await readConfig(id);
        if (config.REPO_GITHUB !== repository) fail('repository_mismatch');
        await keyBinding(config);
        return {ok: true, status: 'configured', project: id, repository, enabled: config.REPO_POLL_ENABLED === 'true'};
      });
    },
    async pinHostKey(line, {confirmed = false} = {}) {
      assertConfirmation(confirmed);
      const host = validateHostKey(line);
      return withLock(async () => {
        const target = join(paths.keys, 'github_known_hosts');
        if (await fileInfo(target)) fail('already_exists');
        await atomicWrite(target, host.line);
        return {ok: true, status: 'host_key_pinned', fingerprint: host.fingerprint};
      });
    },
    async setup(id, repository, {confirmed = false} = {}) {
      assertConfirmation(confirmed); checkProject(id); assertRepository(repository);
      return withLock(async () => {
        if (await fileInfo(configPath(id))) fail('already_exists');
        const host = await readSafe(join(paths.keys, 'github_known_hosts'));
        if (!host) fail('host_key_missing');
        validateHostKey(host.toString('utf8'));
        const keyDirectory = join(paths.keys, id);
        try { await mkdir(keyDirectory, {mode: 0o700}); } catch (error) { if (error.code === 'EEXIST') fail('already_exists'); throw error; }
        const keyPath = join(keyDirectory, 'id_ed25519');
        try {
          await execute('/usr/bin/ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', `local-gateway-${id}`, '-f', keyPath], {timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: MAX_FILE, cwd: '/', env: {PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C'}});
          await chmod(`${keyPath}.pub`, 0o600);
          if (!await readSafe(keyPath)) fail('key_generation_failed');
          const publicKey = (await readSafe(`${keyPath}.pub`))?.toString('utf8').trim();
          if (!publicKey || !/^ssh-ed25519 [A-Za-z0-9+/]{68} local-gateway-[a-z0-9-]+$/.test(publicKey)) fail('key_generation_failed');
          const config = validateRepositoryConfig({REPO_CONFIG_VERSION: '1', REPO_PROJECT_ID: id, REPO_GITHUB: repository, REPO_BRANCH: 'main', REPO_SSH_KEY_PATH: keyPath, REPO_KNOWN_HOSTS_PATH: join(paths.keys, 'github_known_hosts'), REPO_POLL_ENABLED: 'false', REPO_DEPLOY_MODE: 'disabled'}, paths);
          await atomicWrite(configPath(id), renderEnv(config));
          return {ok: true, status: 'awaiting_github_read_only_key', project: id, repository, publicKey};
        } catch (error) {
          // Keep partial key material protected and disabled; never regenerate/overwrite automatically.
          if (error instanceof RepositoryError) throw error;
          fail('key_generation_failed');
        }
      });
    },
    async publicKey(id) { return withLock(async () => { const config = await readConfig(id); await directoryCheck(dirname(config.REPO_SSH_KEY_PATH)); const bytes = await readSafe(`${config.REPO_SSH_KEY_PATH}.pub`); if (!bytes) fail('key_missing'); const publicKey = bytes.toString('utf8').trim(); if (!/^ssh-ed25519 [A-Za-z0-9+/]{68} local-gateway-[a-z0-9-]+$/.test(publicKey)) fail('unsafe_file'); return {ok: true, project: id, repository: config.REPO_GITHUB, publicKey}; }); },
    async verify(id) { return withLock(async () => {
      const config = await readConfig(id); const binding = await keyBinding(config);
      const previous = await readState(id, 'verification');
      await writeState(id, 'verification', {version: 1, binding, sha: validVerification(previous, binding) ? previous.sha : null, verifiedAt: validVerification(previous, binding) ? previous.verifiedAt : 0, lastAttemptSucceeded: false});
      const sha = await remoteMain(config);
      // Failed attempts cannot authorize new enablement; already-approved polling can recover
      // transient transport failures only by successfully reading the same bound repository again.
      await writeState(id, 'verification', {version: 1, binding, sha, verifiedAt: now(), lastAttemptSucceeded: true});
      return {ok: true, status: 'read_access_verified', project: id, sha, readOnlyProven: false};
    }); },
    async enable(id, {confirmed = false, readOnlyConfirmed = false} = {}) {
      assertConfirmation(confirmed); assertConfirmation(readOnlyConfirmed);
      return withLock(async () => {
        await requireOwnership();
        const config = await readConfig(id); const binding = await keyBinding(config); const record = await readState(id, 'verification');
        if (!validVerification(record, binding) || record.lastAttemptSucceeded !== true) fail('verification_required');
        if (now() - record.verifiedAt > VERIFY_LIFETIME_MS) fail('verification_expired');
        await writeState(id, 'approval', {version: 1, binding, approvedAt: now(), readOnlyAttested: true});
        config.REPO_POLL_ENABLED = 'true'; await atomicWrite(configPath(id), renderEnv(config));
        return {ok: true, status: 'polling_enabled', project: id, deployMode: 'disabled'};
      });
    },
    async prepareSource(id, repository, sha, {signal} = {}) {
      checkProject(id); assertRepository(repository);
      if (!DEPLOY_PROJECTS.includes(id) || typeof sha !== 'string' || sha.length !== 40 || !SHA.test(sha)) fail('invalid_config');
      return withLock(async () => {
        checkAbort(signal);
        const config = await readConfig(id);
        if (config.REPO_GITHUB !== repository) fail('repository_mismatch');
        await keyBinding(config); await readContract(config);
        const observed = await remoteMain(config, {signal});
        if (observed !== sha) fail('requested_sha_not_main');
        let manifest;
        try { manifest = await exportPinnedSource({project: id, repository, sha, stateDirectory: paths.state, command: gitInvocation(config, wrapperPath), execute, checkDirectory: directoryCheck, atomicJson: atomicWrite, signal}); }
        catch { checkAbort(signal); fail('source_export_failed'); }
        checkAbort(signal);
        return {ok: true, status: 'source_prepared', project: id, repository, sha, archiveSha256: manifest.archiveSha256, bytes: manifest.bytes, pollingEnabled: config.REPO_POLL_ENABLED === 'true'};
      });
    },
    async enableDeployment(id, {confirmed = false} = {}) {
      assertConfirmation(confirmed);
      return withLock(async () => {
        await requireOwnership();
        const config = await readConfig(id); const binding = await keyBinding(config); const record = await readState(id, 'verification');
        if (config.REPO_POLL_ENABLED !== 'true' || !validVerification(record, binding) || record.lastAttemptSucceeded !== true) fail('verification_required');
        if (now() - record.verifiedAt > VERIFY_LIFETIME_MS) fail('verification_expired');
        const contract = await readContract(config); await prepareQueue();
        await writeState(id, 'deployment-approval', {version: 1, binding, contractHash: contract.contractHash, approvedAt: now()});
        config.REPO_DEPLOY_MODE = 'supervisor-v1'; await atomicWrite(configPath(id), renderEnv(config));
        return {ok: true, status: 'supervised_deployment_enabled', project: id};
      });
    },
    async disableDeployment(id, {confirmed = false} = {}) { assertConfirmation(confirmed); return withLock(async () => { const config = await readConfig(id); config.REPO_DEPLOY_MODE = 'disabled'; await atomicWrite(configPath(id), renderEnv(config)); return {ok: true, status: 'supervised_deployment_disabled', project: id, pendingRequestsUnchanged: true}; }); },
    async disable(id, {confirmed = false} = {}) { assertConfirmation(confirmed); return withLock(async () => { const config = await readConfig(id); config.REPO_POLL_ENABLED = 'false'; await atomicWrite(configPath(id), renderEnv(config)); return {ok: true, status: 'polling_disabled', project: id}; }); },
    async status() { return withLock(async () => {
      const results = [];
      for (const id of projectIds) if (await fileInfo(configPath(id))) { const config = await readConfig(id); const state = await readState(id, 'status'); results.push({project: id, repository: config.REPO_GITHUB, enabled: config.REPO_POLL_ENABLED === 'true', deployMode: config.REPO_DEPLOY_MODE, status: state?.status ?? 'not_polled', observedSha: SHA.test(state?.observedSha ?? '') ? state.observedSha : null, checkedAt: Number.isSafeInteger(state?.checkedAt) ? state.checkedAt : null}); }
      return {ok: true, repositories: results};
    }); },
    async pollAll({signal} = {}) { return withLock(async () => {
      checkAbort(signal); await requireOwnership();
      const results = [];
      // Reject surprise config files rather than deriving arbitrary project names/paths from them.
      const entries = await readdir(paths.config);
      if (entries.some((name) => !projectIds.some((id) => name === `${id}.env`) && !/^\.pending-[a-f0-9]{24}$/.test(name))) fail('invalid_config');
      for (const id of projectIds) {
        if (signal?.aborted) break;
        if (!await fileInfo(configPath(id))) { if (projectId !== null) results.push({ok: false, project: id, status: 'not_configured'}); continue; }
        let result;
        try {
          const config = await readConfig(id);
          if (config.REPO_POLL_ENABLED !== 'true') { results.push({ok: true, project: id, status: 'disabled'}); continue; }
          const binding = await keyBinding(config); const verification = await readState(id, 'verification'); const approval = await readState(id, 'approval');
          if (!validVerification(verification, binding) || !approval || approval.version !== 1 || approval.binding !== binding || approval.readOnlyAttested !== true || !Number.isSafeInteger(approval.approvedAt) || approval.approvedAt > now()) fail('verification_required');
          const sha = await remoteMain(config, {signal});
          await writeState(id, 'verification', {version: 1, binding, sha, verifiedAt: now(), lastAttemptSucceeded: true});
          const previous = await readState(id, 'status');
          const deployment = config.REPO_DEPLOY_MODE === 'supervisor-v1' ? await queueDeployment(config, sha, binding, {signal}) : null;
          result = {ok: true, project: id, status: deployment ? 'supervised_deployment' : id === 'local-gateway' ? 'self_update_requires_supervisor' : 'deployment_adapter_unavailable', observedSha: sha, changed: previous?.observedSha !== sha, checkedAt: now(), deployedSha: null, ...(deployment ?? {})};
        } catch (error) { result = {...safeRepositoryError(error), project: id, checkedAt: now(), deployedSha: null}; }
        await writeState(id, 'status', result); results.push(result);
      }
      const summary = {ok: results.every((r) => r.ok), checkedAt: now(), repositories: results};
      await atomicWrite(join(paths.state, 'worker-status.json'), `${JSON.stringify(summary)}\n`);
      return summary;
    }); },
    async health() { await checkRoots(); const bytes = await readSafe(join(paths.state, 'worker-status.json')); if (!bytes) return {ok: false, status: 'not_polled'}; let state; try { state = JSON.parse(bytes); } catch { fail('invalid_state'); } return {ok: state.ok === true && Number.isSafeInteger(state.checkedAt) && state.checkedAt <= now() && now() - state.checkedAt <= POLL_INTERVAL_MS * 2, status: 'repository_worker'}; },
  };
}

export async function runRepositoryScheduler({store = createRepositoryStore(), wait = sleep, signal, onStatus = () => {}} = {}) {
  const run = async () => {
    while (!signal?.aborted) {
      // Persisted per-project due time prevents immediate repeated reads on restart.
      const dueIn = store.dueIn ? await store.dueIn() : 0;
      if (dueIn === 0) {
        let result; try { result = await store.pollAll({signal}); } catch (error) { result = safeRepositoryError(error); }
        await onStatus(result);
      }
      if (signal?.aborted) break;
      try { await wait(dueIn || POLL_INTERVAL_MS, undefined, {signal}); } catch (error) { if (signal?.aborted) break; throw error; }
    }
  };
  if (store.withSchedulerLock) return store.withSchedulerLock(run);
  return run();
}

export async function confirmOwner(challenge, {input = process.stdin, output = process.stdout} = {}) {
  if (!input.isTTY || !output.isTTY) fail('confirmation_required');
  const terminal = createInterface({input, output});
  try { if ((await terminal.question(`Type exactly ${challenge}: `)) !== challenge) fail('confirmation_required'); } finally { terminal.close(); }
}
export async function repositoryMain(argv = process.argv.slice(2), {projectId = null, paths = DEFAULT_PATHS, store: injectedStore} = {}) {
  const [command, ...args] = argv;
  if (projectId === null) fail('project_scope_required');
  assertProject(projectId);
  const projectCommands = ['prepare-source', 'ensure', 'ensure-check', 'setup', 'setup-confirmed', 'verify', 'enable', 'disable', 'enable-deploy', 'disable-deploy', 'public-key'];
  if (projectCommands.includes(command) && args[0] !== projectId) fail('invalid_project');
  const store = injectedStore ?? createRepositoryStore({projectId, paths});
  const abort = new AbortController(); process.once('SIGTERM', () => abort.abort()); process.once('SIGINT', () => abort.abort());
  let result;
  if (command === 'run' && !args.length) {
    await runRepositoryScheduler({store, signal: abort.signal, onStatus: (status) => process.stdout.write(`${JSON.stringify(status)}\n`)}); return;
  } else if (command === 'prepare-source' && args.length === 3) {
    result = await store.prepareSource(args[0], args[1], args[2], {signal: AbortSignal.any([abort.signal, AbortSignal.timeout(75_000)])});
  } else if ((command === 'ensure' || command === 'ensure-check') && args.length === 2) {
    const [id, repository] = args; const current = await store.inspect(id, repository);
    if (current.ok) result = await store.verify(id);
    else if (command === 'ensure-check' || current.status !== 'not_configured') result = current;
    else {
      process.stdout.write('Creates a persistent unencrypted NAS deploy key for this repository. Only its PUBLIC key goes to GitHub. No application code will be deployed by this worker.\n');
      await confirmOwner(`CREATE KEY ${id} ${repository}`);
      const created = await store.setup(id, repository, {confirmed: true});
      process.stdout.write(`Add this PUBLIC key to https://github.com/${repository}/settings/keys and leave Allow write access unchecked:\n${created.publicKey}\n`);
      await confirmOwner(`ADDED READ-ONLY KEY ${id}`);
      result = await store.verify(id);
    }
  } else if (command === 'host-status' && !args.length) result = await store.hostStatus();
  else if (command === 'pin-host-key-confirmed' && args.length === 2) {
    const host = validateHostKey(args[0]);
    if (args[1] !== `--owner-confirmed=PIN_HOST:${host.fingerprint}`) fail('confirmation_required');
    result = await store.pinHostKey(host.line, {confirmed: true});
  } else if (command === 'pin-host-key' && args.length === 1) {
    const host = validateHostKey(args[0]);
    process.stdout.write(`Verify against GitHub official SSH fingerprints first: ${host.fingerprint}\n`);
    await confirmOwner(`PIN ${host.fingerprint}`); result = await store.pinHostKey(host.line, {confirmed: true});
  } else if (command === 'setup-confirmed' && args.length === 3) {
    assertProject(args[0]); assertRepository(args[1]);
    if (args[2] !== `--owner-confirmed=CREATE_KEY:${args[0]}:${args[1]}`) fail('confirmation_required');
    result = await store.setup(args[0], args[1], {confirmed: true});
  } else if (command === 'setup' && args.length === 2) {
    assertProject(args[0]); assertRepository(args[1]);
    process.stdout.write('Creates a new persistent unencrypted NAS deploy key and disabled metadata. Only add its PUBLIC key to this GitHub repository; leave Allow write access unchecked.\n');
    await confirmOwner(`CREATE KEY ${args[0]} ${args[1]}`); result = await store.setup(args[0], args[1], {confirmed: true});
  } else if (command === 'enable' && args.length === 1) {
    assertProject(args[0]);
    process.stdout.write('ls-remote proves read access, not read-only permissions. Confirm this repository deploy key has Allow write access unchecked in GitHub. Deployment remains disabled.\n');
    await confirmOwner(`ENABLE READ-ONLY POLLING ${args[0]}`); result = await store.enable(args[0], {confirmed: true, readOnlyConfirmed: true});
  } else if (command === 'enable-deploy' && args.length === 1) {
    assertProject(args[0]);
    process.stdout.write('Enables recurring deployment of future main commits through the independently verified supervisor contract, including health checks and rollback.\n');
    await confirmOwner(`ENABLE SUPERVISED DEPLOYMENT ${args[0]}`); result = await store.enableDeployment(args[0], {confirmed: true});
  } else if (command === 'disable-deploy' && args.length === 1) {
    assertProject(args[0]); process.stdout.write('Stops new deployment requests; already accepted requests remain owned by the supervisor.\n');
    await confirmOwner(`DISABLE SUPERVISED DEPLOYMENT ${args[0]}`); result = await store.disableDeployment(args[0], {confirmed: true});
  } else if (command === 'disable' && args.length === 1) {
    assertProject(args[0]); await confirmOwner(`DISABLE POLLING ${args[0]}`); result = await store.disable(args[0], {confirmed: true});
  } else if (command === 'verify' && args.length === 1) result = await store.verify(args[0]);
  else if (command === 'public-key' && args.length === 1) result = await store.publicKey(args[0]);
  else if (command === 'status' && !args.length) result = await store.status();
  else if (command === 'poll-once' && !args.length) result = await store.pollAll({signal: abort.signal});
  else if (command === 'health' && !args.length) result = await store.health();
  else fail('invalid_config');
  process.stdout.write(`${JSON.stringify(result)}\n`); if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) repositoryMain().catch((error) => { process.stderr.write(`${JSON.stringify(safeRepositoryError(error))}\n`); process.exitCode = 1; });
