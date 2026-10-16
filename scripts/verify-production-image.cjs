const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
const manifest = read('package.json');
const lock = read('package-lock.json');
assert.equal(process.env.NODE_ENV, 'production');
assert.equal(manifest.name, 'web-content-fetch');
assert.equal(manifest.version, lock.version);
assert.deepEqual(manifest.dependencies, lock.packages[''].dependencies);
assert.equal(Object.keys(manifest.devDependencies || {}).length, 0);
assert.equal(fs.existsSync('/usr/local/bin/kepubify'), true);

const forbidden = new Set(['jest', 'ts-jest', 'typescript', 'ts-node', '@fission-ai/openspec',
  'eslint', 'prettier', 'playwright', 'puppeteer', 'npm', 'corepack']);
const installed = new Map();
function inspectModules(relative) {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) {
    if (name === '.bin' || name === '.package-lock.json') continue;
    const target = path.join(relative, name);
    assert.equal(fs.lstatSync(path.join(root, target)).isSymbolicLink(), false, `unexpected link: ${target}`);
    if (name.startsWith('@')) {
      for (const child of fs.readdirSync(path.join(root, target))) inspectPackage(path.join(target, child));
    } else inspectPackage(target);
  }
}
function inspectPackage(relative) {
  const entry = lock.packages[relative.split(path.sep).join('/')];
  assert.ok(entry, `package outside runtime lock: ${relative}`);
  assert.notEqual(entry.dev, true, `dev package: ${relative}`);
  const value = read(path.join(relative, 'package.json'));
  assert.equal(value.version, entry.version, `version mismatch: ${relative}`);
  assert.equal(forbidden.has(value.name) || /^@(jest|types)\//.test(value.name), false,
    `development tool: ${value.name}`);
  installed.set(relative.split(path.sep).join('/'), value.version);
  inspectModules(path.join(relative, 'node_modules'));
}
inspectModules('node_modules');
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (relative && !entry.optional) assert.ok(installed.has(relative), `missing runtime package: ${relative}`);
}
for (const name of Object.keys(manifest.dependencies)) require(require.resolve(name, { paths: [root] }));
for (const name of ['test', 'docs', '.agents', 'updater', 'openspec', 'scripts', 'AGENTS.md', 'Dockerfile']) {
  assert.equal(fs.existsSync(path.join(root, name)), false, `unnecessary source/tooling: ${name}`);
}
for (const executable of ['npm', 'npx', 'corepack', 'yarn', 'yarnpkg', 'pnpm', 'pnpx']) {
  for (const directory of process.env.PATH.split(path.delimiter)) {
    assert.equal(fs.existsSync(path.join(directory, executable)), false, `package manager: ${executable}`);
  }
}
for (const name of ['npm', 'corepack']) assert.equal(fs.existsSync(`/usr/local/lib/node_modules/${name}`), false);
assert.equal(fs.readdirSync('/opt').some(name => name.startsWith('yarn-v')), false);
console.log(JSON.stringify({ productionContent: 'pass', version: manifest.version,
  directDependencies: Object.keys(manifest.dependencies).sort(), installedPackages: installed.size }));
