const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { normalizeConfig } = require('../binding-store');
const { DownloadOrchestrator, MAX_PAGES, MAX_IMAGES, MAX_CHAPTERS } = require('../job-orchestrator');

test('only the authorized page request budget increases', () => {
  assert.equal(MAX_PAGES, 1000);
  assert.equal(MAX_IMAGES, 1024);
  assert.equal(MAX_CHAPTERS, 2000);
});

for (const kind of ['manga', 'novel']) {
  test(kind + ' chapter request sends the 1000-page budget', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-page-budget-'));
    const bindingId = '44444444-4444-4444-8444-444444444444';
    const config = normalizeConfig({
      bindings: [{
        bindingId,
        bridgeUrl: 'http://127.0.0.1:8788',
        serviceClientId: '55555555-5555-4555-8555-555555555555',
        serviceCredential: 'synthetic-fixture',
        browserClientId: '66666666-6666-4666-8666-666666666666'
      }],
      activeBindingId: bindingId
    });
    const job = { id: 'page-budget-' + kind, url: 'https://example.test/book', kind, status: 'queued', bindingId };
    const orchestrator = new DownloadOrchestrator({
      jobs: new Map([[job.id, job]]), config, saveConfig: async () => {},
      outputDir: path.join(root, 'output'),
      update(value, change) { Object.assign(value, change); }
    });
    let chapterRequest;
    orchestrator.clients.set(bindingId, {
      paired: true,
      async contentFetch(body) {
        if (body.mode === 'chapters') {
          assert.equal(body.maxChapters, 2000);
          return { success: true, title: 'Synthetic fixture', chapters: [{ url: 'https://example.test/chapter', title: 'Chapter 1' }] };
        }
        chapterRequest = body;
        throw new Error('synthetic_stop_after_request');
      }
    });
    await orchestrator.run(job);
    assert.equal(chapterRequest.mode, 'chapter');
    assert.equal(chapterRequest.kind, kind);
    assert.equal(chapterRequest.maxPages, 1000);
    if (kind === 'manga') assert.equal(chapterRequest.maxImages, 1024);
    assert.equal(job.status, 'error');
    assert.equal(job.diagnostic, 'synthetic_stop_after_request');
  });
}
