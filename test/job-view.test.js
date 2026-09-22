const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { classifyOutput, publicDownloads } = require('../job-view');

test('public downloads classify EPUB and KEPUB while rejecting unsafe names', () => {
  assert.deepEqual(classifyOutput('阿邦-chapter-0001.epub'), {
    filename: '阿邦-chapter-0001.epub',
    format: 'EPUB'
  });
  assert.deepEqual(classifyOutput('阿邦-chapter-0001.kepub.epub'), {
    filename: '阿邦-chapter-0001.kepub.epub',
    format: 'KEPUB'
  });
  assert.equal(classifyOutput('../outside.epub'), null);
  assert.equal(classifyOutput('not-a-book.zip'), null);
});

test('public download list preserves every valid output with same-origin hrefs', () => {
  assert.deepEqual(publicDownloads([
    'overlord.epub',
    'overlord.kepub.epub',
    '../secret.epub'
  ]), [
    { filename: 'overlord.epub', format: 'EPUB', href: '/downloads/overlord.epub' },
    { filename: 'overlord.kepub.epub', format: 'KEPUB', href: '/downloads/overlord.kepub.epub' }
  ]);
});

test('queue source contains expandable jobs and structured download rendering', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /className="job"/);
  assert.match(source, /job\.downloads/);
  assert.match(source, /下載檔案/);
  assert.doesNotMatch(source, /decorateJobs=/);
});

test('reusable deployment script is confirmation-gated and health-checked', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'scripts', 'Deploy.ps1'), 'utf8');
  assert.match(source, /ConfirmDeploy/);
  assert.match(source, /composeArguments.*config.*--quiet/s);
  assert.match(source, /8092\/healthz/);
  assert.doesNotMatch(source, /docker\s+system\s+prune/);
  assert.doesNotMatch(source, /volume\s+rm/);
});

test('package and lockfile versions stay synchronized', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const lockJson = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  assert.equal(lockJson.version, packageJson.version);
  assert.equal(lockJson.packages[''].version, packageJson.version);
});
