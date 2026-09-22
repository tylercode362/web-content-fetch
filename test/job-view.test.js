const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { classifyOutput, publicDownloads, publicOutputGroups, legacyMangaOutputGroups } = require('../job-view');

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

test('public output groups preserve chapter labels and file links', () => {
  assert.deepEqual(publicOutputGroups([
    { chapterIndex: 2, title: '第三章', files: ['job-epub.epub', 'job-epub.kepub.epub'] },
    { chapterIndex: 3, title: '不安全', files: ['../bad.epub'] }
  ]), [
    { chapterIndex: 2, label: '第三章', downloads: [
      { filename: 'job-epub.epub', format: 'EPUB', href: '/downloads/job-epub.epub' },
      { filename: 'job-epub.kepub.epub', format: 'KEPUB', href: '/downloads/job-epub.kepub.epub' }
    ] }
  ]);
});

test('legacy manga outputs can be grouped after service upgrade', () => {
  assert.deepEqual(legacyMangaOutputGroups([
    '阿邦-chapter-0002.epub',
    '阿邦-chapter-0001.kepub.epub',
    '阿邦-chapter-0001.epub'
  ]), [
    { chapterIndex: 0, title: '第 1 章', files: ['阿邦-chapter-0001.kepub.epub', '阿邦-chapter-0001.epub'] },
    { chapterIndex: 1, title: '第 2 章', files: ['阿邦-chapter-0002.epub'] }
  ]);
});

test('queue source contains expandable jobs and structured download rendering', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /ui\.css/);
  assert.match(source, /outputGroups/);
  assert.match(source, /download-all/);
  assert.match(source, /clear-terminal/);
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
