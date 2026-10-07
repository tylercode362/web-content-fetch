const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile, mkdir, mkdtemp, rm } = require('node:fs/promises');
const { homedir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');

async function runProducer(repositoryMain, argv, options) {
  let output = '';
  const originalWrite = process.stdout.write;
  const originalExitCode = process.exitCode;
  process.stdout.write = (chunk, encoding, callback) => {
    output += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (typeof encoding === 'function') encoding();
    else if (typeof callback === 'function') callback();
    return true;
  };
  try {
    await repositoryMain(argv, options);
  } finally {
    process.stdout.write = originalWrite;
    process.exitCode = originalExitCode;
  }
  return JSON.parse(output.trim());
}

test('project-scoped updater producer emits project identity for host pin lifecycle', async (t) => {
  if (process.platform === 'win32') {
    t.skip('the updater storage contract requires POSIX ownership and paths');
    return;
  }

  const { createRepositoryStore, repositoryMain, validateHostKey } = await import(
    pathToFileURL(path.join(root, 'updater', 'lib', 'repository-polling.mjs')).href,
  );
  const projectManifest = JSON.parse(
    await readFile(path.join(root, 'updater', 'project.json'), 'utf8'),
  );
  assert.equal(projectManifest.version, 1);
  const projectId = projectManifest.project;
  const hostKeyBytes = Buffer.concat([
    Buffer.from('0000000b7373682d6564323535313900000020', 'hex'),
    Buffer.alloc(32, 7),
  ]);
  const hostLine = `github.com ssh-ed25519 ${hostKeyBytes.toString('base64')}\n`;
  const rootDirectory = await mkdtemp(path.join(homedir(), 'wcf-updater-producer-'));
  const paths = {
    config: path.join(rootDirectory, 'config'),
    keys: path.join(rootDirectory, 'keys'),
    state: path.join(rootDirectory, 'state'),
  };
  await Promise.all(Object.values(paths).map((directory) => mkdir(directory, { mode: 0o700 })));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));

  const store = createRepositoryStore({ paths, projectId });
  const options = { projectId, paths, store };
  const fingerprint = validateHostKey(hostLine).fingerprint;

  await assert.rejects(
    () => repositoryMain(['host-status'], { paths, store, projectId: null }),
    /project_scope_required/,
  );
  await assert.rejects(
    () => repositoryMain(['ensure-check'], options),
    /invalid_project/,
  );
  await assert.rejects(
    () => repositoryMain(['ensure-check', 'wrong-project', 'owner/repository'], options),
    /invalid_project/,
  );

  const missing = await runProducer(repositoryMain, ['host-status'], options);
  assert.deepEqual(missing, {
    ok: false,
    status: 'host_key_missing',
    project: projectId,
  });

  const pinned = await runProducer(
    repositoryMain,
    ['pin-host-key-confirmed', hostLine, `--owner-confirmed=PIN_HOST:${fingerprint}`],
    options,
  );
  assert.deepEqual(pinned, {
    ok: true,
    status: 'host_key_pinned',
    project: projectId,
    fingerprint,
  });

  const status = await runProducer(repositoryMain, ['host-status'], options);
  assert.deepEqual(status, {
    ok: true,
    status: 'host_key_pinned',
    project: projectId,
    fingerprint,
  });
});
