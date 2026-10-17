const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { DownloadOrchestrator } = require('../job-orchestrator');
const { normalizeConfig } = require('../binding-store');

test('manga batches only when the authenticated chapter response advertises support', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-manga-batch-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const url = 'https://tw.manhuagui.com/comic/61792/';
  const chapterUrl = url + '914841.html';
  const config = normalizeConfig({ serviceClientId: '11111111-1111-4111-8111-111111111111',
    browserClientId: '22222222-2222-4222-8222-222222222222', serviceCredential: 'synthetic' });
  const job = { id: 'batch-supported', url, kind: 'manga', status: 'queued', bindingId: config.activeBindingId, progress: {} };
  const images = Array.from({ length: 17 }, (_, pageIndex) => ({
    url: `https://cdn.example.test/${pageIndex}.png`, pageUrl: chapterUrl, pageIndex, width: 2, height: 2
  }));
  const data = (await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer()).toString('base64');
  const batches = [];
  const fake = { paired: true, contentFetch: async request => {
    if (request.mode === 'chapters') return { title: 'Synthetic', chapters: [{ title: 'Chapter', url: chapterUrl }] };
    if (request.mode === 'chapter') return { success: true, sourceUrl: chapterUrl, images, pageCount: 17, assetBatchSupported: true };
    assert.equal(request.mode, 'assets');
    batches.push(request.assets.length);
    return { assets: request.assets.map(() => ({ data, mime: 'image/png' })) };
  } };
  const orchestrator = new DownloadOrchestrator({ jobs: new Map([[job.id, job]]), config, outputDir: root,
    saveConfig() {}, update: (value, change) => Object.assign(value, change) });
  orchestrator.clients.set(config.activeBindingId, fake);
  await orchestrator.run(job);
  assert.equal(job.status, 'complete', job.diagnostic);
  assert.deepEqual(batches, [8, 8, 1]);
  assert.equal(job.outputs.length, 2);
});
