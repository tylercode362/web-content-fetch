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
  const orchestratorSource = await fs.readFile(path.join(__dirname, '..', 'job-orchestrator.js'), 'utf8');
  const uiSource = await fs.readFile(path.join(__dirname, '..', 'ui.js'), 'utf8');
  assert.match(source, /ui\.css/);
  assert.match(source, /outputGroups/);
  assert.match(source, /download-all/);
  assert.match(source, /clear-failed/);
  assert.match(source, /clear-terminal/);
  assert.match(source, /isClearable/);
  assert.match(source, /bridgeProgress/);
  assert.match(source, /const bridgeChanged = Boolean\(binding && binding\.bridgeUrl !== nextBridgeUrl\)/);
  assert.match(source, /binding\.serviceCredential = ''/);
  assert.match(source, /rebindRequired: bridgeChanged/);
  assert.doesNotMatch(source, /update\(job, \{ progress \}\)/);
  assert.match(orchestratorSource, /bridgeProgress: null/);
  assert.match(orchestratorSource, /image: imageIndex/);
  assert.doesNotMatch(source, /decorateJobs=/);
  assert.match(uiSource, /node\('summary'/);
  assert.match(uiSource, /node\('details'/);
  assert.match(uiSource, /pendingActions/);
  assert.match(uiSource, /delete_not_confirmed/);
  assert.match(uiSource, /章節進度：/);
  assert.match(uiSource, /progress\.completed/);
  assert.match(uiSource, /chapterDownloadRatio/);
  assert.match(uiSource, /bridgeProgress/);
  assert.match(uiSource, /bridgeCompleted/);
  assert.match(uiSource, /目前章節下載/);
  assert.ok(uiSource.indexOf("className: 'job-progress'") < uiSource.indexOf("className: 'outputs'"));
  assert.match(uiSource, /pendingActions\.delete\(id\);\s*await refresh\(\);/s);
});

test('queue UI uses one binding, has CSRF recovery, and reports terminal cleanup results', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
  const uiSource = await fs.readFile(path.join(__dirname, '..', 'ui.js'), 'utf8');
  const cssSource = await fs.readFile(path.join(__dirname, '..', 'ui.css'), 'utf8');
  const modernUi = source.split('function renderHtml(token) {')[1].split('const server =')[0];
  assert.doesNotMatch(modernUi, /jobBinding|bindingSelect/);
  assert.match(modernUi, /bindingId/);
  assert.match(source, /api\/csrf/);
  assert.match(source, /deletedJobIds/);
  assert.match(uiSource, /credentials: 'same-origin'/);
  assert.match(uiSource, /csrf_forbidden/);
  assert.match(uiSource, /renewCsrf/);
  assert.match(uiSource, /payload\.rebindRequired/);
  assert.match(cssSource, /form #url{min-width:0/);
  assert.match(cssSource, /\.job-grid\{display:flex;flex-direction:column/);
  assert.match(cssSource, /\.outputs\{order:2;width:100%;border:0;border-top:1px solid/);
  assert.match(cssSource, /\.chapter-download-bar\{/);
});

test('reusable deployment script is confirmation-gated and health-checked', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'scripts', 'Deploy.ps1'), 'utf8');
  assert.match(source, /ConfirmDeploy/);
  assert.match(source, /composeArguments.*config.*--quiet/s);
  assert.match(source, /8092\/healthz/);
  assert.doesNotMatch(source, /docker\s+system\s+prune/);
  assert.doesNotMatch(source, /volume\s+rm/);
});

test('NAS deployment uses fixed networks and explicit config initialization', async () => {
  const source = await fs.readFile(path.join(__dirname, '..', 'scripts', 'Deploy-Nas.ps1'), 'utf8');
  const remoteSource = await fs.readFile(path.join(__dirname, '..', 'scripts', 'Deploy-Nas-remote.sh'), 'utf8');
  const overlay = await fs.readFile(path.join(__dirname, '..', 'compose.nas.example.yaml'), 'utf8');
  assert.match(source, /ConfirmDeploy/);
  assert.match(source, /--exclude=\.env/);
  assert.match(source, /--exclude=\.pnpm-store/);
  assert.match(source, /--exclude=secrets/);
  assert.match(source, /--exclude=exports/);
  assert.match(source, /Deploy-Nas-remote\.sh/);
  assert.match(source, /InitializeRemoteConfig/);
  assert.match(source, /remoteStage.*\.env/);
  assert.match(source, /WEB_CONTENT_FETCH_BRIDGE_URL.*http:\/\/nas-bridge:8788/);
  assert.match(source, /WEB_CONTENT_FETCH_CALLBACK_URL.*web-content-fetch:8092/);
  assert.match(source, /WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS.*host\.docker\.internal,web-content-fetch/);
  assert.match(source, /WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS.*NasHost.*8088/);
  assert.match(source, /不修改本機 \.env/);
  assert.match(remoteSource, /incoming_config="\$\{10\}"/);
  assert.match(remoteSource, /health_timeout="\$\{11\}"/);
  assert.match(remoteSource, /keep_staging="\$\{12\}"/);
  assert.match(remoteSource, /WEB_CONTENT_FETCH_CALLBACK_URL.*web-content-fetch:8092/);
  assert.match(remoteSource, /WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS.*nas_host.*8088/);
  assert.match(remoteSource, /first deployment requires -InitializeRemoteConfig/);
  assert.match(remoteSource, /\/usr\/local\/bin\/docker/);
  assert.match(remoteSource, /\/usr\/local\/bin\/docker-compose/);
  assert.match(overlay, /local-gateway-chrome-bridge/);
  assert.match(overlay, /local-gateway-web-content-fetch/);
  assert.match(overlay, /host\.docker\.internal:host-gateway/);
});

test('package and lockfile versions stay synchronized', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const lockJson = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  assert.equal(lockJson.version, packageJson.version);
  assert.equal(lockJson.packages[''].version, packageJson.version);
});
