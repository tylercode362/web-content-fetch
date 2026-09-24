const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { BridgeClient, BridgeTransportError } = require('../bridge-client');
const { normalizeConfig } = require('../binding-store');
const { DownloadOrchestrator, isClearable } = require('../job-orchestrator');

test('batch cleanup policy selects failed and cancelled jobs only', () => {
  assert.deepEqual(['queued', 'running', 'paused', 'complete', 'cancelled', 'error'].filter(isClearable), ['cancelled', 'error']);
});

test('Bridge network failures use a recoverable transport diagnostic', async () => {
  const client = new BridgeClient({ baseUrl: 'http://127.0.0.1:1' });
  await assert.rejects(
    client.json('/v1/secure/key'),
    error => error instanceof BridgeTransportError && error.status === 0 && error.message === 'bridge_transport_failed'
  );
});

test('Bridge client keeps the supplied binding URL through construction and update', () => {
  const client = new BridgeClient({ bridgeUrl: 'http://192.168.50.140:8088/chrome-bridge' });
  assert.equal(client.baseUrl, 'http://192.168.50.140:8088/chrome-bridge');
  client.update({ bridgeUrl: 'http://192.168.50.141:8088/chrome-bridge' });
  assert.equal(client.baseUrl, 'http://192.168.50.141:8088/chrome-bridge');
});

test('saved Bridge credentials are verified without changing binding state', async () => {
  const previousList = BridgeClient.prototype.listBrowserClients;
  const browserClientId = '33333333-3333-4333-8333-333333333333';
  const config = normalizeConfig({
    bridgeUrl: 'http://192.168.50.140:8088/chrome-bridge',
    serviceClientId: '11111111-1111-4111-8111-111111111111',
    serviceCredential: 'saved-credential',
    browserClientId
  });
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map(), update() {}, config, saveConfig: async () => {
      throw new Error('status must not persist');
    }, outputDir: '/tmp/output'
  });
  const snapshot = JSON.stringify(config);
  try {
    BridgeClient.prototype.listBrowserClients = async () => ({ success: false, code: 'authentication_failed' });
    const authFailure = await orchestrator.bindingStatus();
    assert.equal(authFailure.status, 'authentication_failed');
    assert.equal(authFailure.browserClientId, browserClientId);
    assert.equal(authFailure.lastHeartbeatAt, null);
    assert.ok(Number.isFinite(Date.parse(authFailure.checkedAt)));
    BridgeClient.prototype.listBrowserClients = async () => ({ success: true, clients: [] });
    const offline = await orchestrator.bindingStatus();
    assert.equal(offline.status, 'browser_offline');
    assert.equal(offline.lastHeartbeatAt, null);
    BridgeClient.prototype.listBrowserClients = async () => ({
      success: true, clients: [{
        browserClientId, online: true, lastSeenAt: '2026-09-25T10:20:30.000Z'
      }]
    });
    const verified = await orchestrator.bindingStatus();
    assert.equal(verified.status, 'verified');
    assert.equal(verified.browserClientId, browserClientId);
    assert.equal(verified.lastHeartbeatAt, '2026-09-25T10:20:30.000Z');
    assert.ok(Number.isFinite(Date.parse(verified.checkedAt)));
    BridgeClient.prototype.listBrowserClients = async () => ({
      success: true, clients: [{
        browserClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        online: true,
        lastSeenAt: '2026-09-25T10:20:30.000Z'
      }]
    });
    const otherExtension = await orchestrator.bindingStatus();
    assert.equal(otherExtension.status, 'browser_offline');
    assert.equal(otherExtension.lastHeartbeatAt, null);
    BridgeClient.prototype.listBrowserClients = async () => { throw new Error('secret details'); };
    const unavailable = await orchestrator.bindingStatus();
    assert.equal(unavailable.status, 'unavailable');
    assert.equal(unavailable.lastHeartbeatAt, null);
    assert.ok(Number.isFinite(Date.parse(unavailable.checkedAt)));
    assert.equal(JSON.stringify(config), snapshot);
  } finally {
    BridgeClient.prototype.listBrowserClients = previousList;
  }
});

test('pairing updates the single WCF Bridge binding', async () => {
  const previousPair = BridgeClient.prototype.pair;
  const saved = [];
  try {
    BridgeClient.prototype.pair = async function (code) {
      assert.equal(code, '123456');
      assert.equal(this.baseUrl, 'http://192.168.50.140:8088/chrome-bridge');
      assert.equal(this.serviceClientId, '22222222-2222-4222-8222-222222222222');
      this.serviceCredential = 'new-credential';
      this.browserClientId = '44444444-4444-4444-8444-444444444444';
      this.fingerprint = 'fingerprint';
      return {
        serviceClientId: this.serviceClientId,
        serviceCredential: 'new-credential',
        browserClientId: this.browserClientId,
        fingerprint: 'fingerprint'
      };
    };
    const oldServiceClientId = '11111111-1111-4111-8111-111111111111';
    const config = normalizeConfig({
      bridgeUrl: 'http://host.docker.internal:8788',
      callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback',
      expectedFingerprint: 'fingerprint',
      serviceClientId: oldServiceClientId,
      serviceCredential: 'old-credential',
      browserClientId: '33333333-3333-4333-8333-333333333333'
    });
    const oldBindingId = config.bindings[0].bindingId;
    const pausedJob = { id: 'paused-job', status: 'paused', bindingId: oldBindingId,
      browserClientId: '33333333-3333-4333-8333-333333333333' };
    const completeJob = { id: 'complete-job', status: 'complete', bindingId: oldBindingId,
      browserClientId: '33333333-3333-4333-8333-333333333333' };
    const orchestrator = new DownloadOrchestrator({
      jobs: new Map([['paused-job', pausedJob], ['complete-job', completeJob]]), update() {},
      config, saveConfig: async value => saved.push(JSON.parse(JSON.stringify(value))), outputDir: '/tmp/output'
    });

    const result = await orchestrator.pair('123456', {
      bridgeUrl: 'http://192.168.50.140:8088/chrome-bridge',
      serviceClientId: '22222222-2222-4222-8222-222222222222'
    });
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].bindingId, oldBindingId);
    assert.equal(result.bindings[0].paired, true);
    assert.equal(result.bindings[0].serviceClientId, '22222222-2222-4222-8222-222222222222');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].bindings.length, 1);
    assert.ok(saved[0].bindingAliases.includes(oldBindingId));
    assert.equal(saved[0].activeBindingId, result.activeBindingId);
    assert.equal(saved[0].bindings[0].bridgeUrl, 'http://192.168.50.140:8088/chrome-bridge');
    assert.equal(pausedJob.browserClientId, '44444444-4444-4444-8444-444444444444');
    assert.equal(completeJob.browserClientId, '33333333-3333-4333-8333-333333333333');
  } finally {
    BridgeClient.prototype.pair = previousPair;
  }
});

test('running job cancellation aborts fetch and sends an additive Bridge cancel request', async () => {
  const previousCancel = BridgeClient.prototype.cancelContentFetch;
  const bindingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      serviceCredential: 'credential',
      browserClientId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const job = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    url: 'https://m.manhuagui.com/comic/46693/',
    kind: 'manga',
    status: 'queued',
    bindingId,
    callbackToken: 'callback-token',
    progress: { phase: 'queued', completed: 0, total: null }
  };
  const jobs = new Map([[job.id, job]]);
  const updates = [];
  const orchestrator = new DownloadOrchestrator({
    jobs,
    config,
    saveConfig: async () => {},
    outputDir: '/tmp/output',
    update(value, change) {
      Object.assign(value, change);
      updates.push({ status: value.status, phase: value.progress?.phase });
    }
  });
  let cancelKey = null;
  BridgeClient.prototype.cancelContentFetch = async function (operationKey) {
    cancelKey = operationKey;
    return { success: true, cancelled: true };
  };
  const fakeClient = {
    paired: true,
    async contentFetch(body, { signal }) {
      assert.equal(body.operationKey, job.id);
      if (body.mode !== 'chapters') throw new Error('unexpected_fetch');
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('request_aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
  };
  orchestrator.clients.set(bindingId, fakeClient);

  const running = orchestrator.run(job);
  for (let attempt = 0; attempt < 20 && job.status !== 'running'; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(job.status, 'running');
  orchestrator.cancel(job.id);
  await running;

  assert.equal(cancelKey, job.id);
  assert.equal(job.status, 'cancelled');
  assert.deepEqual(job.outputs, []);
  assert.ok(updates.some(item => item.status === 'cancelling'));
  assert.ok(updates.some(item => item.status === 'cancelled'));
  BridgeClient.prototype.cancelContentFetch = previousCancel;
});

test('different FQDN jobs run in parallel within one browser binding', async () => {
  const bindingId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      serviceCredential: 'credential',
      browserClientId: '99999999-9999-4999-8999-999999999999'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const jobs = new Map([
    ['job-novel-parallel', {
      id: 'job-novel-parallel', url: 'https://tw.linovelib.com/novel/2014.html', kind: 'novel',
      status: 'queued', bindingId, progress: { phase: 'queued', completed: 0, total: null }
    }],
    ['job-manga-parallel', {
      id: 'job-manga-parallel', url: 'https://m.manhuagui.com/comic/46693/', kind: 'manga',
      status: 'queued', bindingId, progress: { phase: 'queued', completed: 0, total: null }
    }]
  ]);
  const orchestrator = new DownloadOrchestrator({
    jobs, config, saveConfig: async () => {}, outputDir: '/tmp/output', update() {},
    maxConcurrentJobs: 2
  });
  let running = 0;
  let peak = 0;
  const releases = [];
  orchestrator.run = async job => {
    job.status = 'running';
    running += 1;
    peak = Math.max(peak, running);
    await new Promise(resolve => releases.push(resolve));
    running -= 1;
    job.status = 'complete';
  };

  await orchestrator.drain();
  assert.equal(peak, 2);
  assert.equal(running, 2);
  releases.splice(0).forEach(resolve => resolve());
  for (let attempt = 0; attempt < 20 && [...jobs.values()].some(job => job.status !== 'complete'); attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.deepEqual([...jobs.values()].map(job => job.status), ['complete', 'complete']);
});

test('same FQDN jobs remain serial even when parallel capacity is available', async () => {
  const bindingId = '11111111-1111-4111-8111-111111111111';
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: '22222222-2222-4222-8222-222222222222',
      serviceCredential: 'credential',
      browserClientId: '33333333-3333-4333-8333-333333333333'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const jobs = new Map([
    ['job-one', { id: 'job-one', url: 'https://tw.linovelib.com/novel/2014.html', kind: 'novel', status: 'queued', bindingId, progress: {} }],
    ['job-two', { id: 'job-two', url: 'https://tw.linovelib.com/novel/2015.html', kind: 'novel', status: 'queued', bindingId, progress: {} }]
  ]);
  const orchestrator = new DownloadOrchestrator({
    jobs, config, saveConfig: async () => {}, outputDir: '/tmp/output', update() {}, maxConcurrentJobs: 5
  });
  let running = 0;
  const releases = [];
  orchestrator.run = async job => {
    job.status = 'running';
    running += 1;
    await new Promise(resolve => releases.push(resolve));
    running -= 1;
    job.status = 'complete';
  };

  await orchestrator.drain();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(running, 1);
  assert.equal([...jobs.values()].filter(job => job.status === 'queued').length, 1);
  releases.shift()();
  for (let attempt = 0; attempt < 20 && [...jobs.values()].some(job => job.status !== 'complete'); attempt += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(running, 1);
  releases.shift()();
  for (let attempt = 0; attempt < 20 && [...jobs.values()].some(job => job.status !== 'complete'); attempt += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual([...jobs.values()].map(job => job.status), ['complete', 'complete']);
});

test('paused jobs resume from checkpoints and cancellation removes job files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-job-'));
  const bindingId = '44444444-4444-4444-8444-444444444444';
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: '55555555-5555-4555-8555-555555555555',
      serviceCredential: 'credential',
      browserClientId: '66666666-6666-4666-8666-666666666666'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const job = {
    id: 'job-pause-cleanup',
    url: 'https://tw.linovelib.com/novel/2014.html',
    kind: 'novel',
    status: 'queued',
    bindingId,
    progress: { phase: 'queued', completed: 1, total: 3 },
    outputs: ['job-pause-cleanup.epub'],
    outputGroups: [{ chapterIndex: 0, title: '第一章', files: ['job-pause-cleanup.epub'] }]
  };
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config,
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  await orchestrator.ensureStage(job);
  await orchestrator.writeJobManifest(job, '測試小說', [{ url: job.url, title: '第一章' }]);
  await orchestrator.writeChapterCheckpoint(job, 0, { title: '第一章', contentHtml: '<p>已完成</p>', images: [] });
  await fs.writeFile(path.join(orchestrator.stagePath(job), 'partial.epub'), 'partial');
  await fs.mkdir(path.join(root, 'output'), { recursive: true });
  await fs.writeFile(path.join(root, 'output', 'job-pause-cleanup.epub'), 'published');
  let drainCount = 0;
  orchestrator.drain = async () => { drainCount += 1; };

  orchestrator.pause(job.id);
  assert.equal(job.status, 'paused');
  orchestrator.resume(job.id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(job.status, 'queued');
  assert.equal(drainCount, 1);
  await orchestrator.cancel(job.id);
  assert.equal(job.status, 'cancelled');
  await assert.rejects(() => fs.access(orchestrator.checkpointPath(job)));
  await assert.rejects(() => fs.access(orchestrator.stagePath(job)));
  await assert.rejects(() => fs.access(path.join(root, 'output', 'job-pause-cleanup.epub')));
});

test('browser client disconnect is retried with the existing binding', async () => {
  const job = {
    id: 'job-disconnect-retry',
    status: 'running',
    progress: { phase: 'fetching_chapters', completed: 1, total: 3 }
  };
  const phases = [];
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: '/tmp/output',
    update(value, change) {
      Object.assign(value, change);
      phases.push(value.progress?.phase);
    }
  });
  let attempts = 0;
  const fakeClient = {
    async contentFetch(body) {
      assert.equal(body.operationKey, job.id);
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('browser_client_disconnected');
        error.code = 'browser_client_disconnected';
        throw error;
      }
      return { success: true };
    }
  };

  const result = await orchestrator.callWithRetry(
    job,
    fakeClient,
    { operationKey: job.id, mode: 'chapters' },
    new AbortController().signal
  );

  assert.deepEqual(result, { success: true });
  assert.equal(attempts, 2);
  assert.ok(phases.includes('retrying'));
});

test('8Comic manga resumes after a failed image batch without refetching completed images', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-manga-batch-'));
  const bindingId = '77777777-7777-4777-8777-777777777777';
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: '88888888-8888-4888-8888-888888888888',
      serviceCredential: 'credential',
      browserClientId: '99999999-9999-4999-8999-999999999999'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const chapterUrl = 'https://www.8comic.com/view/26490.html?ch=1';
  const job = {
    id: 'job-manga-batch',
    url: 'https://www.8comic.com/html/26490.html',
    kind: 'manga',
    status: 'queued',
    bindingId,
    callbackToken: 'callback-token',
    progress: { phase: 'queued', completed: 0, total: null }
  };
  const imageData = (await sharp({
    create: { width: 80, height: 120, channels: 4, background: '#00ff00' }
  }).png().toBuffer()).toString('base64');
  const batchSizes = [];
  const publishedSnapshots = [];
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config,
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); if (Array.isArray(value.outputGroups) && value.outputGroups.length) publishedSnapshots.push(value.outputGroups.map(group => ({ ...group }))); }
  });
  const fakeClient = {
    paired: true,
    async contentFetch(body) {
      if (body.mode === 'chapters') return {
        success: true,
        title: '阿邦',
        chapters: [{ url: chapterUrl, title: '第一章' }]
      };
      if (body.mode === 'chapter') return {
        success: true,
        title: '第一章',
        images: Array.from({ length: 9 }, (_value, index) => ({
          url: `https://img0.8comic.com/0/26490/1/${String(index + 1).padStart(3, '0')}_abc.jpg`,
          pageUrl: chapterUrl,
          alt: `第 ${index + 1} 頁`
        }))
      };
      assert.equal(body.mode, 'assets');
      batchSizes.push(body.assets.length);
      if (batchSizes.length === 2) return { success: true, assets: [] };
      return {
        success: true,
        assets: body.assets.map(image => ({
          success: true,
          assetUrl: image.url,
          data: imageData,
          mime: 'image/png'
        }))
      };
    }
  };
  orchestrator.clients.set(bindingId, fakeClient);

  await orchestrator.run(job);

  assert.equal(job.status, 'error');
  assert.equal((await orchestrator.readChapterCheckpoint(job, 0, '-images')).assetCount, 8);
  orchestrator.drain = async () => {};
  orchestrator.resume(job.id);
  assert.equal(job.status, 'queued');
  await orchestrator.run(job);

  assert.deepEqual(batchSizes, [8, 1, 1]);
  assert.equal(job.status, 'complete');
  assert.equal(job.progress.completed, 1);
  assert.equal(job.outputs.length, 2);
  assert.equal(job.outputGroups.length, 1);
  assert.equal(job.outputGroups[0].title, '第一章');
  assert.equal(publishedSnapshots.length > 0, true);
  assert.equal(job.outputs[0], '阿邦-chapter-0001.epub');
  assert.equal(job.outputs[1], '阿邦-chapter-0001.kepub.epub');
  assert.doesNotMatch(job.outputs[0], /job-manga-batch|[0-9a-f]{8}-[0-9a-f-]{27}/i);
});

test('published output filenames omit job UUIDs and avoid same-title collisions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-output-names-'));
  const outputDir = path.join(root, 'output');
  const config = normalizeConfig({});
  const createOrchestrator = job => new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config,
    saveConfig: async () => {},
    outputDir,
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  const firstJob = { id: 'job-output-name-a', outputs: [] };
  const secondJob = { id: 'job-output-name-b', outputs: [] };
  const first = createOrchestrator(firstJob);
  const second = createOrchestrator(secondJob);
  const firstStage = await first.ensureStage(firstJob);
  const secondStage = await second.ensureStage(secondJob);
  const names = ['阿邦-chapter-0001.epub', '阿邦-chapter-0001.kepub.epub'];
  for (const name of names) {
    await fs.writeFile(path.join(firstStage, name), 'first');
    await fs.writeFile(path.join(secondStage, name), 'second');
  }

  const firstPublished = await first.publishOutputs(firstJob, names.map(name => path.join(firstStage, name)));
  firstJob.outputs = firstPublished;
  const secondPublished = await second.publishOutputs(secondJob, names.map(name => path.join(secondStage, name)));

  assert.deepEqual(firstPublished, names);
  assert.deepEqual(secondPublished, ['阿邦-2-chapter-0001.epub', '阿邦-2-chapter-0001.kepub.epub']);
  assert.ok(secondPublished.every(name => !name.includes(secondJob.id)));
  assert.equal(await fs.readFile(path.join(outputDir, names[0]), 'utf8'), 'first');
  assert.equal(await fs.readFile(path.join(outputDir, secondPublished[0]), 'utf8'), 'second');
});

test('recoverable disconnect error jobs resume without removing checkpoints', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-disconnect-'));
  const job = {
    id: 'job-disconnect-resume',
    url: 'https://www.8comic.com/html/26490.html',
    kind: 'manga',
    status: 'error',
    diagnostic: 'browser_client_disconnected',
    progress: { phase: 'failed', completed: 0, total: 11 }
  };
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  await orchestrator.ensureStage(job);
  await orchestrator.writeJobManifest(job, '阿邦', [{ url: job.url, title: '第一章' }]);
  let drainCount = 0;
  orchestrator.drain = async () => { drainCount += 1; };

  const resumed = orchestrator.resume(job.id);

  assert.equal(resumed.status, 'queued');
  assert.equal(resumed.diagnostic, null);
  assert.equal(drainCount, 1);
  await assert.doesNotReject(() => fs.access(orchestrator.checkpointPath(job)));
  await assert.doesNotReject(() => fs.access(orchestrator.stagePath(job)));
});

test('any error job can be requeued without deleting saved progress', async () => {
  const job = { id: 'job-parser-error', status: 'error', diagnostic: 'chapter_list_empty' };
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: '/tmp/output',
    update(value, change) { Object.assign(value, change); }
  });

  orchestrator.drain = async () => {};
  assert.equal(orchestrator.resume(job.id), job);
  assert.equal(job.status, 'queued');
  assert.equal(job.diagnostic, null);
});

test('partial image checkpoints are reused only for matching chapter evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-partial-images-'));
  const job = { id: 'job-image-identity' };
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  const evidence = [{ url: 'https://images.example.test/1.jpg' }, { url: 'https://images.example.test/2.jpg' }];
  const asset = { sourceUrl: evidence[0].url, data: 'YWJj', mime: 'image/jpeg' };
  await orchestrator.writeImageCheckpoint(job, 0, 'novel', 'https://books.example.test/1', evidence, [asset]);
  assert.deepEqual(
    await orchestrator.reusableImageAssets(job, 0, 'novel', 'https://books.example.test/1', evidence),
    [asset]
  );
  assert.deepEqual(
    await orchestrator.reusableImageAssets(job, 0, 'novel', 'https://books.example.test/2', evidence),
    []
  );
  assert.deepEqual(
    await orchestrator.reusableImageAssets(job, 0, 'novel', 'https://books.example.test/1', [
      evidence[0], { url: 'https://images.example.test/changed.jpg' }
    ]),
    []
  );
  await orchestrator.removeJobFiles(job);
  await assert.rejects(() => fs.access(orchestrator.checkpointPath(job)));
});

test('novel resumes after a failed inline image without refetching verified images', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-novel-image-resume-'));
  const bindingId = '12121212-1212-4212-8212-121212121212';
  const chapterUrl = 'https://tw.linovelib.com/novel/2014/100.html';
  const imageUrls = [
    'https://images.example.test/novel-1.png',
    'https://images.example.test/novel-2.png'
  ];
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: '34343434-3434-4434-8434-343434343434',
      serviceCredential: 'credential',
      browserClientId: '56565656-5656-4656-8656-565656565656'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const job = {
    id: 'job-novel-image-resume',
    url: 'https://tw.linovelib.com/novel/2014.html',
    kind: 'novel',
    status: 'queued',
    bindingId,
    callbackToken: 'callback-token',
    progress: { phase: 'queued', completed: 0, total: null }
  };
  const imageData = (await sharp({
    create: { width: 40, height: 60, channels: 4, background: '#00ff00' }
  }).png().toBuffer()).toString('base64');
  const fetchedAssets = [];
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config,
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  orchestrator.clients.set(bindingId, {
    paired: true,
    async contentFetch(body) {
      if (body.mode === 'chapters') return {
        success: true, title: '插圖小說', chapters: [{ url: chapterUrl, title: '第一章' }]
      };
      if (body.mode === 'chapter') return {
        success: true,
        contentHtml: `<p>正文</p><img src="${imageUrls[0]}"><img src="${imageUrls[1]}">`,
        images: imageUrls.map(url => ({ url, pageUrl: chapterUrl }))
      };
      assert.equal(body.mode, 'asset');
      fetchedAssets.push(body.assetUrl);
      if (fetchedAssets.length === 2) return { success: true };
      return { success: true, data: imageData, mime: 'image/png' };
    }
  });

  await orchestrator.run(job);
  assert.equal(job.status, 'error');
  assert.equal((await orchestrator.readChapterCheckpoint(job, 0, '-images')).assetCount, 1);
  orchestrator.drain = async () => {};
  orchestrator.resume(job.id);
  await orchestrator.run(job);
  assert.equal(job.status, 'complete');
  assert.deepEqual(fetchedAssets, [imageUrls[0], imageUrls[1], imageUrls[1]]);
  assert.equal(job.outputs.length, 2);
});

test('novel image batches resume from ordered callback checkpoints after a partial batch failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-novel-batch-resume-'));
  const bindingId = '12121212-1212-4212-8212-121212121212';
  const chapterUrl = 'https://tw.linovelib.com/novel/2014/100.html';
  const imageUrls = Array.from({ length: 5 }, (_value, index) =>
    'https://img.linovelib.com/novel-' + (index + 1) + '.png');
  const config = normalizeConfig({
    bindings: [{
      bindingId,
      bridgeUrl: 'http://host.docker.internal:8788',
      serviceClientId: '34343434-3434-4434-8434-343434343434',
      serviceCredential: 'credential',
      browserClientId: '56565656-5656-4656-8656-565656565656'
    }],
    activeBindingId: bindingId,
    callbackUrl: 'http://host.docker.internal:8092/api/bridge/callback'
  });
  const job = {
    id: 'job-novel-batch-resume',
    url: 'https://tw.linovelib.com/novel/2014.html',
    kind: 'novel',
    status: 'queued',
    bindingId,
    callbackToken: 'callback-token',
    progress: { phase: 'queued', completed: 0, total: null }
  };
  const imageData = (await sharp({
    create: { width: 40, height: 60, channels: 4, background: '#00ff00' }
  }).png().toBuffer()).toString('base64');
  const digest = crypto.createHash('sha256').update(Buffer.from(imageData, 'base64')).digest('hex');
  const resumeStarts = [];
  const chapterCalls = [];
  const failedBatches = [];
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config,
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); }
  });
  orchestrator.clients.set(bindingId, {
    paired: true,
    async contentFetch(body) {
      if (body.mode === 'chapters') return {
        success: true, title: '插圖小說', chapters: [{ url: chapterUrl, title: '第一章' }]
      };
      if (body.mode === 'chapter') {
        chapterCalls.push(body);
        const evidence = imageUrls.map((url, index) => ({
          url,
          pageUrl: chapterUrl,
          width: 40,
          height: 60,
          alt: '插圖 ' + (index + 1)
        }));
        const result = await orchestrator.registerNovelImagesCallback(job.id, {
          runId: body.novelAssetRunId,
          chapterIndex: body.novelChapterIndex,
          images: evidence
        });
        resumeStarts.push(result.resumeFromImageIndex);
        const firstImageToSend = chapterCalls.length === 1 ? 0 : result.resumeFromImageIndex;
        const lastImageToSend = chapterCalls.length === 1 ? 2 : evidence.length;
        for (let imageIndex = firstImageToSend; imageIndex < lastImageToSend; imageIndex += 1) {
          await orchestrator.acceptNovelAssetCallback(job.id, {
            runId: body.novelAssetRunId,
            chapterIndex: body.novelChapterIndex,
            imageIndex,
            sourceUrl: evidence[imageIndex].url,
            asset: { data: imageData, mime: 'image/png', sha256: digest }
          });
        }
        return {
          success: true,
          title: '第一章',
          contentHtml: '<p>正文</p><img src="' + imageUrls[0] + '">',
          images: evidence
        };
      }
      assert.equal(body.mode, 'assets');
      failedBatches.push(body.assets.map(image => image.url));
      return { success: true, assets: [] };
    }
  });

  await orchestrator.run(job);
  assert.equal(job.status, 'error');
  assert.equal((await orchestrator.readChapterCheckpoint(job, 0, '-images')).assetCount, 2);
  orchestrator.drain = async () => {};
  orchestrator.resume(job.id);
  await orchestrator.run(job);

  assert.equal(job.status, 'complete');
  assert.deepEqual(resumeStarts, [0, 2]);
  assert.equal(chapterCalls.length, 2);
  assert.deepEqual(failedBatches, [imageUrls.slice(2)]);
  assert.equal(job.outputs.length, 2);
});

test('terminal job deletion removes its record, outputs and checkpoints', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-delete-'));
  const job = {
    id: 'job-terminal-delete',
    url: 'https://tw.linovelib.com/novel/2014.html',
    kind: 'novel',
    status: 'error',
    progress: { phase: 'failed', completed: 1, total: 1 },
    outputs: ['overlord.epub'],
    outputGroups: [{ chapterIndex: 0, files: ['overlord.kepub.epub'] }]
  };
  const jobs = new Map([[job.id, job]]);
  const orchestrator = new DownloadOrchestrator({
    jobs,
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); },
    removeJob(jobId) { jobs.delete(jobId); }
  });
  await orchestrator.ensureStage(job);
  await orchestrator.writeJobManifest(job, 'OVERLORD', [{ url: job.url, title: '第一章' }]);
  await fs.mkdir(path.join(root, 'output'), { recursive: true });
  await fs.writeFile(path.join(root, 'output', 'overlord.epub'), 'epub');
  await fs.writeFile(path.join(root, 'output', 'overlord.kepub.epub'), 'kepub');

  const deletedJob = await orchestrator.delete(job.id);

  assert.equal(jobs.has(job.id), false);
  assert.equal(deletedJob.deletedOutputCount, 2);
  await assert.rejects(() => fs.access(path.join(root, 'output', 'overlord.epub')));
  await assert.rejects(() => fs.access(path.join(root, 'output', 'overlord.kepub.epub')));
  await assert.rejects(() => fs.access(orchestrator.checkpointPath(job)));
  await assert.rejects(() => fs.access(orchestrator.stagePath(job)));
});

test('terminal deletion rejects unsafe grouped output and keeps the job record', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-delete-unsafe-'));
  const job = {
    id: 'job-terminal-delete-unsafe',
    status: 'error',
    outputs: [],
    outputGroups: [{ chapterIndex: 0, files: ['../outside.epub'] }]
  };
  const jobs = new Map([[job.id, job]]);
  const orchestrator = new DownloadOrchestrator({
    jobs,
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: path.join(root, 'output'),
    checkpointDir: path.join(root, 'checkpoints'),
    update(value, change) { Object.assign(value, change); },
    removeJob(jobId) { jobs.delete(jobId); }
  });

  await assert.rejects(() => orchestrator.delete(job.id), /job_output_path_invalid/);
  assert.equal(jobs.has(job.id), true);
});
