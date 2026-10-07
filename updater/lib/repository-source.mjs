// Called only after explicit owner deployment approval. Exports objects; never executes source.
import {constants} from 'node:fs';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, open, readdir, rename, unlink} from 'node:fs/promises';
import {createHash, randomBytes} from 'node:crypto';
import {join} from 'node:path';
export const SOURCE_LIMIT = 128 * 1024 * 1024;
export const DEPLOY_PROJECTS = Object.freeze(['prime-video', 'chrome-bridge', 'local-gateway', 'opendata-research', 'self-home-3d', 'spatial-sketch', 'tw-stock-valuation-lab', 'web-content-fetch']);
export const deploymentRequestId = (project, repository, sha) => createHash('sha256').update(`${project}\n${repository}\n${sha}`).digest('hex');
const die = () => { throw new Error('source_export_failed'); };
export async function exportPinnedSource({project, repository, sha, stateDirectory, command, execute, checkDirectory, atomicJson, signal}) {
  const checkAbort = () => { if (signal?.aborted) throw new Error('operation_cancelled'); };
  checkAbort();
  if (!DEPLOY_PROJECTS.includes(project) || !/^[a-f0-9]{40}$/.test(sha)) die();
  const cacheRoot = join(stateDirectory, 'cache'); const sourceRoot = join(stateDirectory, 'source');
  async function ensureDirectory(path) { try { await mkdir(path, {mode: 0o700}); } catch (error) { if (error.code !== 'EEXIST') throw error; } await checkDirectory(path); }
  await ensureDirectory(cacheRoot); await ensureDirectory(sourceRoot);
  const cache = join(cacheRoot, `${project}.git`); const source = join(sourceRoot, project);
  await ensureDirectory(cache); await ensureDirectory(source);
  const flags = command.args.slice(0, command.args.indexOf('ls-remote'));
  const run = async (args, timeout = 180_000) => { checkAbort(); const result = await execute(command.file, [...flags, ...args], {...command.options, timeout, signal}); checkAbort(); return result; };
  // Re-init is idempotent. No remote URL, hooks, submodules, worktree or source command is saved/run.
  await run(['init', '--bare', cache], 30_000);
  await run(['--git-dir', cache, 'fetch', '--depth=1', '--no-tags', '--no-recurse-submodules', `git@github.com:${repository}.git`, sha]);
  const verified = await run(['--git-dir', cache, 'rev-parse', '--verify', `${sha}^{commit}`], 30_000);
  if (verified.stdout.trim() !== sha) die();
  const temp = join(source, `.pending-${randomBytes(12).toString('hex')}.tar`);
  const target = join(source, `${sha}.tar`);
  let handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  await handle.close(); handle = null;
  try {
    await run(['--git-dir', cache, 'archive', '--format=tar', `--output=${temp}`, sha]);
    const info = await lstat(temp);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.uid !== process.getuid() || (info.mode & 0o7777) !== 0o600 || info.size < 1024 || info.size > SOURCE_LIMIT) die();
    const hash = createHash('sha256');
    const input = createReadStream(temp, {flags: constants.O_RDONLY | constants.O_NOFOLLOW, signal});
    for await (const chunk of input) { checkAbort(); hash.update(chunk); }
    checkAbort();
    const manifest = {version: 1, project, repository, sha, archiveSha256: hash.digest('hex'), bytes: info.size};
    // Target may be a prior interrupted export; refuse unsafe object types before atomic replacement.
    const before = await lstat(target).catch((error) => {if (error.code === 'ENOENT') return null; throw error;});
    if (before && (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.uid !== process.getuid() || (before.mode & 0o7777) !== 0o600)) die();
    const fd = await open(temp, constants.O_RDONLY | constants.O_NOFOLLOW); try {await fd.sync();} finally {await fd.close();}
    checkAbort();
    await rename(temp, target);
    await atomicJson(join(source, `${sha}.json`), `${JSON.stringify(manifest)}\n`);
    // Only completed exports are retained; supervisor owns its separate rollback releases.
    const previous = [];
    for (const name of await readdir(source)) {
      if (!/^[a-f0-9]{40}\.tar$/.test(name) || name === `${sha}.tar`) continue;
      const old = await lstat(join(source, name));
      if (!old.isFile() || old.isSymbolicLink() || old.nlink !== 1 || old.uid !== process.getuid() || (old.mode & 0o7777) !== 0o600) die();
      previous.push({name, modified: old.mtimeMs});
    }
    previous.sort((a, b) => b.modified - a.modified);
    for (const old of previous.slice(2)) {
      checkAbort();
      await unlink(join(source, old.name));
      await unlink(join(source, old.name.replace(/\.tar$/, '.json'))).catch((error) => {if (error.code !== 'ENOENT') throw error;});
    }
    // Fixed Git maintenance, never repository scripts; no background GC may outlive the lock.
    await run(['--git-dir', cache, 'gc', '--prune=now']);
    return manifest;
  } finally { await unlink(temp).catch((error) => {if (error.code !== 'ENOENT') throw error;}); }
}
