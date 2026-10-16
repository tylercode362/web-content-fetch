const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DownloadOrchestrator } = require('../job-orchestrator');

test('manga reader evidence survives a restart before the first image and rejects another chapter', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'manga-reader-'));
  const make = () => new DownloadOrchestrator({ jobs: new Map(), update() {}, config: {}, outputDir: root, saveConfig() {} });
  const job = { id: 'synthetic' }, url = 'https://example.test/comic/1/2.html';
  const result = { success: true, kind: 'manga', mode: 'chapter', sourceUrl: url, pageCount: 2,
    images: [{ url: 'https://cdn.example.test/1.png', pageUrl: url, pageIndex: 0 }, { url: 'https://cdn.example.test/2.png', pageUrl: url, pageIndex: 1 }] };
  try {
    await make().writeMangaReaderCheckpoint(job, 0, url, result);
    assert.deepEqual(await make().readMangaReaderCheckpoint(job, 0, url), result);
    assert.equal(await make().readMangaReaderCheckpoint(job, 0, 'https://example.test/comic/1/3.html'), null);
    await assert.rejects(make().writeMangaReaderCheckpoint(job, 0, url, { ...result, images: [] }), /manga_reader_checkpoint_invalid/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
