const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { BridgeClient } = require('../bridge-client');
const { normalizeConfig } = require('../binding-store');
const { DownloadOrchestrator } = require('../job-orchestrator');

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
  assert.equal(job.outputs, undefined);
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
    progress: { phase: 'queued', completed: 1, total: 3 }
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
});

test('terminal job deletion removes its record, outputs and checkpoints', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-delete-'));
  const job = {
    id: 'job-terminal-delete',
    url: 'https://tw.linovelib.com/novel/2014.html',
    kind: 'novel',
    status: 'error',
    progress: { phase: 'failed', completed: 1, total: 1 },
    outputs: ['overlord.epub']
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

  await orchestrator.delete(job.id);

  assert.equal(jobs.has(job.id), false);
  await assert.rejects(() => fs.access(path.join(root, 'output', 'overlord.epub')));
  await assert.rejects(() => fs.access(orchestrator.checkpointPath(job)));
  await assert.rejects(() => fs.access(orchestrator.stagePath(job)));
});
