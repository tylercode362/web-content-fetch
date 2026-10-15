const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'ui.js'), 'utf8');
const start = source.indexOf('  const progressInfo = job => {');
const end = source.indexOf('  const appendDownload = ', start);
assert.ok(start >= 0 && end > start);
const progressInfo = vm.runInNewContext(source.slice(start, end) + '\nprogressInfo;');
const job = (bridgeProgress, progress = {}, status = 'running') => ({
  status,
  progress: { phase: 'fetching_chapters', completed: 1, total: 4, ...progress },
  bridgeProgress
});

test('page reading shows pages without treating a limit as the page total', () => {
  for (const pages of [0, 1, 6, 20]) {
    const result = progressInfo(job({ phase: 'chapter_images_read', pages, completed: pages, total: 512 }));
    assert.match(result.detailLabel, new RegExp('已讀取 ' + pages + ' 頁'));
    assert.match(result.chapterDownloadLabel, new RegExp('已讀取 ' + pages + ' 頁'));
    assert.doesNotMatch(result.chapterDownloadLabel, /512/);
    assert.equal(result.chapterLabel, '章節進度：1 / 4（已完成／總章節）');
    assert.equal(result.ratio, 0.25);
    assert.equal(result.chapterDownloadRatio, 0);
  }
});

test('reader image counts are never mislabeled as page counts', () => {
  const result = progressInfo(job({ phase: 'chapter_images_read', pages: 2, completed: 10, total: 10 }));
  assert.match(result.chapterDownloadLabel, /已讀取 2 頁/);
  assert.doesNotMatch(result.chapterDownloadLabel, /10/);
});

test('missing or invalid page counts keep the legacy fallback', () => {
  for (const pages of [undefined, null, -1, 1.5, '6', '<img>', Infinity]) {
    const result = progressInfo(job({ phase: 'chapter_images_read', pages, completed: 6, total: 512 }));
    assert.match(result.chapterDownloadLabel, /讀取中/);
    assert.doesNotMatch(result.chapterDownloadLabel, /已讀取|512|<img>/);
  }
});

test('both existing asset verification phases keep image counts', () => {
  for (const phase of ['assets_verified', 'asset_verified']) {
    const result = progressInfo(job({ phase, completed: 1, total: 1 }, {
      phase: 'fetching_images', chapter: 2, image: 3, imageTotal: 10
    }));
    assert.equal(result.chapterDownloadLabel, '第 2 章 · 圖片 4 / 10');
    assert.equal(result.chapterDownloadRatio, 0.4);
  }
});

test('stale reading events do not replace terminal or later phase displays', () => {
  const reading = { phase: 'chapter_images_read', pages: 6, completed: 6, total: 512 };
  for (const status of ['complete', 'error', 'cancelled', 'paused', 'pausing', 'cancelling']) {
    assert.doesNotMatch(progressInfo(job(reading, {}, status)).chapterDownloadLabel, /已讀取/);
  }
  const writing = progressInfo(job(reading, { phase: 'writing_epub', chapter: 2 }));
  assert.equal(writing.chapterDownloadRatio, 1);
  assert.doesNotMatch(writing.chapterDownloadLabel, /已讀取/);
});

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const callbackStart = serverSource.indexOf("      const progress = {", serverSource.indexOf("body.progress &&"));
const callbackEnd = serverSource.indexOf("      update(job, { bridgeProgress: progress });", callbackStart);
assert.ok(callbackStart >= 0 && callbackEnd > callbackStart);
const callback = body => vm.runInNewContext(
  serverSource.slice(callbackStart, callbackEnd) + '\nprogress;', { body }
);

test('callback preserves only valid page counts on the existing reading phase', () => {
  for (const pages of [0, 1, 6]) {
    const progress = callback({ progress: { phase: 'chapter_images_read', completed: 10, total: 512, pages } });
    assert.equal(progress.pages, pages);
    assert.equal(progress.completed, 10);
    assert.equal(progress.total, 512);
    assert.match(progressInfo(job(progress)).chapterDownloadLabel, new RegExp('已讀取 ' + pages + ' 頁'));
  }
  for (const pages of [undefined, null, -1, 1.5, '6', '<img>', Infinity]) {
    const progress = callback({ progress: { phase: 'chapter_images_read', pages } });
    assert.equal(Object.hasOwn(progress, 'pages'), false);
  }
  for (const phase of ['assets_verified', 'asset_verified', 'chapter_page_read', 'unknown']) {
    const progress = callback({ progress: { phase, completed: 1, total: 10, pages: 6 } });
    assert.equal(Object.hasOwn(progress, 'pages'), false);
    assert.equal(progress.phase, phase);
    assert.equal(progress.completed, 1);
    assert.equal(progress.total, 10);
  }
});
