const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { BridgeClient } = require('../bridge-client');
const { normalizeConfig } = require('../binding-store');
const { DownloadOrchestrator, isClearable } = require('../job-orchestrator');

test('batch cleanup policy selects failed and cancelled jobs only', () => {
  assert.deepEqual(['queued', 'running', 'paused', 'complete', 'cancelled', 'error'].filter(isClearable), ['cancelled', 'error']);
});

test('pairing adds a fixed per-browser binding without revoking existing profiles', async () => {
  const previousPair = BridgeClient.prototype.pair;
  const saved = [];
  try {
    BridgeClient.prototype.pair = async function (code) {
      assert.equal(code, '123456');
      assert.equal(this.baseUrl, 'http://host.docker.internal:8788');
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
    const orchestrator = new DownloadOrchestrator({
      jobs: new Map(), update() {}, config, saveConfig: async value => saved.push(JSON.parse(JSON.stringify(value))), outputDir: '/tmp/output'
    });

    const result = await orchestrator.pair('123456', {
      serviceClientId: '22222222-2222-4222-8222-222222222222'
    });
    assert.equal(result.bindings.length, 2);
    assert.equal(result.bindings[0].bindingId, oldBindingId);
    assert.equal(result.bindings[0].serviceClientId, oldServiceClientId);
    assert.equal(result.bindings[1].paired, true);
    assert.notEqual(result.bindings[1].serviceClientId, oldServiceClientId);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].bindings.length, 2);
    assert.equal(saved[0].activeBindingId, result.activeBindingId);
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

test('8Comic manga images are fetched in bounded batches', async () => {
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

  assert.deepEqual(batchSizes, [8, 1]);
  assert.equal(job.status, 'complete');
  assert.equal(job.progress.completed, 1);
  assert.equal(job.outputs.length, 2);
  assert.equal(job.outputGroups.length, 1);
  assert.equal(job.outputGroups[0].title, '第一章');
  assert.equal(publishedSnapshots.length > 0, true);
  assert.match(job.outputs[0], /^job-manga-batch-/);
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

test('non-recoverable error jobs remain terminal', async () => {
  const job = { id: 'job-parser-error', status: 'error', diagnostic: 'chapter_list_empty' };
  const orchestrator = new DownloadOrchestrator({
    jobs: new Map([[job.id, job]]),
    config: normalizeConfig({}),
    saveConfig: async () => {},
    outputDir: '/tmp/output',
    update(value, change) { Object.assign(value, change); }
  });

  assert.equal(orchestrator.resume(job.id), job);
  assert.equal(job.status, 'error');
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
