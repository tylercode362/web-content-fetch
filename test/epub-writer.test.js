const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const sharp = require('sharp');
const { writeNovelEpub, writeMangaChapterEpub, sanitizeNovelHtml } = require('../epub-writer');

async function tempOutput() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'wcf-epub-'));
}

async function png(width, height, color) {
  return (await sharp({
    create: { width, height, channels: 4, background: color }
  }).png().toBuffer()).toString('base64');
}

async function readZip(filePath) {
  return JSZip.loadAsync(await fs.readFile(filePath));
}

test('novel output contains sanitized chapters and a kepub companion', async () => {
  const outputDir = await tempOutput();
  const result = await writeNovelEpub({
    outputDir,
    title: '測試小說',
    chapters: [
      { title: '第一章', contentHtml: '<p>正文</p><script>alert(1)</script>' },
      { title: '第二章', contentHtml: '<p>結尾</p>' }
    ]
  });
  const epub = await readZip(result.epubPath);
  assert.equal(await epub.file('mimetype').async('text'), 'application/epub+zip');
  const first = await epub.file('OEBPS/text/chapter-0001.xhtml').async('text');
  const second = await epub.file('OEBPS/text/chapter-0002.xhtml').async('text');
  assert.match(first, /正文/);
  assert.doesNotMatch(first, /script|alert/);
  assert.match(second, /結尾/);
  assert.equal(await fs.stat(result.kepubPath).then(stat => stat.isFile()), true);
  assert.equal(sanitizeNovelHtml('<p>x</p><script>bad</script>').includes('script'), false);
});

test('novel and manga outputs exclude advertisement markup and assets', async () => {
  const outputDir = await tempOutput();
  const novel = await writeNovelEpub({
    outputDir,
    title: '排除廣告小說',
    chapters: [{
      title: '第一章',
      contentHtml: '<div class="ad-banner"><p>廣告</p><img src="https://ads.example.test/banner.jpg"></div><p>正文</p>',
      images: [{
        sourceUrl: 'https://ads.example.test/banner.jpg',
        data: await png(600, 400, '#ff0000'),
        alt: '廣告'
      }]
    }]
  });
  const novelEpub = await readZip(novel.epubPath);
  const novelChapter = await novelEpub.file('OEBPS/text/chapter-0001.xhtml').async('text');
  assert.match(novelChapter, /正文/);
  assert.doesNotMatch(novelChapter, /廣告|ads\.example\.test|banner/);
  assert.equal(novel.imageCount, 0);

  const manga = await writeMangaChapterEpub({
    outputDir,
    title: '排除廣告漫畫',
    chapterTitle: '第 1 話',
    chapterIndex: 0,
    images: [
      { sourceUrl: 'https://ads.example.test/banner.jpg', data: await png(600, 400, '#ff0000'), alt: '廣告' },
      { sourceUrl: 'https://img.example.test/page-1.jpg', data: await png(900, 1200, '#00ff00'), alt: '正文頁' }
    ]
  });
  const mangaEpub = await readZip(manga.epubPath);
  assert.equal(manga.imageEntries.length, 1);
  assert.equal(await mangaEpub.file('OEBPS/images/image-0001.jpg').async('nodebuffer').then(value => value.length > 0), true);
  assert.equal(mangaEpub.file('OEBPS/images/image-0002.jpg'), null);
});

test('advertisement filtering does not treat data-ad field names as ad content', async () => {
  const outputDir = await tempOutput();
  const result = await writeNovelEpub({
    outputDir,
    title: '正文保留',
    chapters: [{
      title: '第一章',
      contentHtml: '<p>正文內容仍應保留</p><div class="notice">一般提示</div>',
      images: [],
      baseUrl: 'https://example.com/chapter'
    }]
  });
  const zip = await readZip(result.epubPath);
  const chapter = await zip.file('OEBPS/text/chapter-0001.xhtml').async('string');
  assert.match(chapter, /正文內容仍應保留/);
  assert.match(chapter, /一般提示/);
});

test('novel output embeds verified inline images with Kobo dimensions', async () => {
  const outputDir = await tempOutput();
  const sourceUrl = 'https://img3.readpai.com/2/2014/116255/157721.jpg';
  const result = await writeNovelEpub({
    outputDir,
    title: '含插圖小說',
    chapters: [{
      title: '第一章',
      baseUrl: 'https://tw.linovelib.com/novel/2014/72367.html',
      contentHtml: `<p>圖片前文字</p><img src="${sourceUrl}" alt="插圖"><p>圖片後文字</p>`,
      images: [{
        sourceUrl,
        data: await png(1600, 900, '#3366ff'),
        alt: '插圖'
      }]
    }]
  });
  const epub = await readZip(result.epubPath);
  const chapter = await epub.file('OEBPS/text/chapter-0001.xhtml').async('text');
  assert.match(chapter, /圖片前文字/);
  assert.match(chapter, /圖片後文字/);
  assert.match(chapter, /src="\.\.\/images\/novel-image-0001\.jpg"/);
  assert.match(chapter, /width="1404" height="790"/);
  assert.doesNotMatch(chapter, /readpai\.com/);
  assert.equal(await epub.file('OEBPS/images/novel-image-0001.jpg').async('nodebuffer').then(value => value.length > 0), true);
  assert.equal(result.imageCount, 1);
  assert.equal(await fs.stat(result.kepubPath).then(stat => stat.isFile()), true);
});

test('manga output optimizes images and writes Kobo inline dimensions in order', async () => {
  const outputDir = await tempOutput();
  const result = await writeMangaChapterEpub({
    outputDir,
    title: '測試漫畫',
    chapterTitle: '第 1 話',
    chapterIndex: 0,
    images: [
      { data: await png(2808, 3744, '#ff0000'), alt: '頁一' },
      { data: await png(900, 1200, '#00ff00'), alt: '頁二' }
    ]
  });
  const epub = await readZip(result.epubPath);
  const first = await epub.file('OEBPS/text/page-0001.xhtml').async('text');
  const second = await epub.file('OEBPS/text/page-0002.xhtml').async('text');
  assert.match(first, /width="1404" height="1872"/);
  assert.match(second, /width="900" height="1200"/);
  assert.match(first, /viewport/);
  assert.match(first, /images\/image-0001\.jpg/);
  assert.match(second, /images\/image-0002\.jpg/);
  assert.equal(result.pageCount, 2);
  assert.equal(await fs.stat(result.kepubPath).then(stat => stat.isFile()), true);
});
