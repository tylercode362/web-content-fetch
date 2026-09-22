const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const sanitizeHtml = require('sanitize-html');
const sharp = require('sharp');
const execFileAsync = promisify(execFile);

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_BOOK_BYTES = 512 * 1024 * 1024;
const KOBO_MAX_WIDTH = Number(process.env.WEB_CONTENT_FETCH_KOBO_MAX_WIDTH || 1404);
const KOBO_MAX_HEIGHT = Number(process.env.WEB_CONTENT_FETCH_KOBO_MAX_HEIGHT || 1872);
const AD_MARKER_RE = /(?:^|[^a-z0-9])(?:ad|ads|advert|advertisement|sponsor|sponsored|banner|popup|popunder|interstitial|promo|promotion|commercial)(?:$|[^a-z0-9])/i;
const AD_TEXT_RE = /(?:廣告|贊助|彈窗|彈出)/i;
const MAX_TITLE_LENGTH = 160;
const MAX_FILENAME_STEM_LENGTH = 80;
const MANGA_PAGE_CSS = 'html,body{margin:0;padding:0;}svg{display:block;margin:0;padding:0;}';
const TITLE_SITE_SUFFIX_RE = /(?:最新漫畫|最新漫画|小說|小説|漫畫|漫画)(?:線上|线上|綫上|在線|在线)?(?:看|觀看|观看|閱讀|阅读)?(?:[_\s|｜—–-]|$)|(?:看漫畫|看漫画|無限動漫|无限动漫|嗶哩輕小說|哔哩轻小说|8comic(?:\.com)?|Fami通文庫|Fami通文库)/iu;
const TITLE_DOMAIN_RE = /(?:https?:\/\/|www\.)[^\s|｜]+|\b[\p{L}\p{N}-]+\.(?:com|net|org|tw|cn|cc|me|io)(?:\/[^\s|｜]*)?/giu;

function cleanBookTitle(value, fallback = 'book') {
  let title = String(value || '')
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(TITLE_DOMAIN_RE, ' ')
    .trim();
  const suffix = title.search(TITLE_SITE_SUFFIX_RE);
  if (suffix > 0) title = title.slice(0, suffix);
  title = title
    .replace(/^[\s《「『【〔［({<]+|[\s》」』】〕］)}>]+$/gu, '')
    .replace(/[^\p{L}\p{N}\p{M}\s-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/-{2,}/g, '-')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  return title || fallback;
}

function isAdvertisementAsset(asset) {
  const values = [
    asset?.sourceUrl, asset?.assetUrl, asset?.url, asset?.alt,
    asset?.name, asset?.filename
  ].filter(Boolean).join(' ');
  return AD_MARKER_RE.test(values) || AD_TEXT_RE.test(values);
}

async function writeNovelEpub({ outputDir, title, chapters }) {
  if (!Array.isArray(chapters) || chapters.length === 0) throw new Error('novel_has_no_chapters');
  const bookTitle = cleanBookTitle(title, 'Novel');
  const entries = [];
  const images = [];
  const imageBySource = new Map();
  let imageIndex = 0;
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const chapterImages = new Map();
    for (const asset of Array.isArray(chapter.images) ? chapter.images : []) {
      if (isAdvertisementAsset(asset)) continue;
      const sourceUrl = normalizeImageSource(asset.sourceUrl || asset.assetUrl || asset.url, chapter.baseUrl || chapter.url);
      if (!sourceUrl) throw new Error('novel_image_source_invalid');
      let prepared = imageBySource.get(sourceUrl);
      if (!prepared) {
        const optimized = await optimizeImage(asset, imageIndex);
        imageIndex += 1;
        prepared = {
          ...optimized,
          filename: `novel-image-${String(imageIndex).padStart(4, '0')}.jpg`
        };
        imageBySource.set(sourceUrl, prepared);
        images.push(prepared);
      }
      chapterImages.set(sourceUrl, prepared);
    }
    const sanitized = sanitizeNovelHtml(String(chapter.contentHtml || ''));
    const rewritten = rewriteNovelImages(sanitized, chapterImages, chapter.baseUrl || chapter.url);
    entries.push({
      id: `chapter-${String(index + 1).padStart(4, '0')}`,
      title: cleanBookTitle(chapter.title || `第 ${index + 1} 章`, `第 ${index + 1} 章`),
      html: rewritten
    });
  }
  if (entries.some(entry => !entry.html.trim())) throw new Error('novel_chapter_has_no_content');
  const filename = `${slugify(bookTitle)}.epub`;
  const epubPath = path.join(outputDir, filename);
  await writeEpub({ outputDir, filename, title: bookTitle, entries, images });
  const kepubPath = await convertToKepub(epubPath);
  return {
    epubPath,
    kepubPath,
    files: [epubPath, kepubPath],
    filename,
    title: bookTitle,
    chapterCount: entries.length,
    imageCount: images.length
  };
}

async function writeMangaChapterEpub({ outputDir, title, chapterTitle, chapterIndex, images }) {
  const contentImages = Array.isArray(images) ? images.filter(image => !isAdvertisementAsset(image)) : [];
  if (contentImages.length === 0) throw new Error('manga_chapter_has_no_images');
  const bookTitle = cleanBookTitle(title, '漫畫');
  const cleanChapterTitle = cleanBookTitle(chapterTitle || `第 ${chapterIndex + 1} 章`, `第 ${chapterIndex + 1} 章`);
  const imageEntries = [];
  for (let index = 0; index < contentImages.length; index += 1) {
    imageEntries.push(await optimizeImage(contentImages[index], index));
  }
  const entries = imageEntries.map((image, index) => ({
    id: `page-${String(index + 1).padStart(4, '0')}`,
    title: `${cleanChapterTitle} ${index + 1}`,
    image
  }));
  const base = `${slugify(bookTitle)}-chapter-${String(chapterIndex + 1).padStart(4, '0')}`;
  const filename = `${base}.epub`;
  const epubPath = path.join(outputDir, filename);
  await writeEpub({
    outputDir,
    filename,
    title: `${bookTitle} - ${cleanChapterTitle}`,
    entries,
    fixedLayout: true
  });
  const kepubPath = await convertToKepub(epubPath);
  return {
    epubPath,
    kepubPath,
    files: [epubPath, kepubPath],
    filename,
    title: cleanChapterTitle || bookTitle,
    pageCount: entries.length,
    imageEntries
  };
}

async function convertToKepub(epubPath) {
  const kepubPath = epubPath.replace(/\.epub$/i, '.kepub.epub');
  try {
    await execFileAsync(process.env.WEB_CONTENT_FETCH_KEPUBIFY_PATH || '/usr/local/bin/kepubify', [
      '--output', kepubPath,
      epubPath
    ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    await fs.access(kepubPath);
    return kepubPath;
  } catch (error) {
    throw new Error(`kepubify_failed_${String(error?.code || error?.message || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80)}`);
  }
}

async function optimizeImage(asset, index) {
  if (!asset || typeof asset.data !== 'string' || asset.data.length === 0) {
    throw new Error(`asset_${index + 1}_missing`);
  }
  const input = Buffer.from(asset.data, 'base64');
  if (input.length < 1 || input.length > MAX_IMAGE_BYTES) throw new Error(`asset_${index + 1}_size_invalid`);
  if (asset.sha256 && sha256(input) !== String(asset.sha256).toLowerCase()) {
    throw new Error(`asset_${index + 1}_digest_mismatch`);
  }
  let source;
  try {
    source = sharp(input, { failOn: 'error' });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error('image_metadata_invalid');
    const output = await source
      .rotate()
      .resize({
        width: KOBO_MAX_WIDTH,
        height: KOBO_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 86, chromaSubsampling: '4:4:4', progressive: false })
      .toBuffer();
    const optimizedMetadata = await sharp(output, { failOn: 'error' }).metadata();
    if (!optimizedMetadata.width || !optimizedMetadata.height) throw new Error('optimized_image_metadata_invalid');
    const swapsOrientation = [5, 6, 7, 8].includes(Number(metadata.orientation));
    const expectedWidth = swapsOrientation ? metadata.height : metadata.width;
    const expectedHeight = swapsOrientation ? metadata.width : metadata.height;
    const expectedRatio = expectedWidth / expectedHeight;
    const optimizedRatio = optimizedMetadata.width / optimizedMetadata.height;
    if (!Number.isFinite(expectedRatio) || !Number.isFinite(optimizedRatio) ||
      Math.abs((optimizedRatio / expectedRatio) - 1) > 0.01) {
      throw new Error('image_aspect_ratio_changed');
    }
    if (output.length > MAX_IMAGE_BYTES) throw new Error(`asset_${index + 1}_optimized_size_invalid`);
    return {
      data: output,
      width: optimizedMetadata.width,
      height: optimizedMetadata.height,
      mediaType: 'image/jpeg',
      filename: `image-${String(index + 1).padStart(4, '0')}.jpg`,
      alt: escapeXml(String(asset.alt || `漫畫圖片 ${index + 1}`).slice(0, 500))
    };
  } catch (error) {
    throw new Error(`asset_${index + 1}_decode_failed`);
  }
}

async function writeEpub({ outputDir, filename, title, entries, images = [], fixedLayout = false }) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');

  const manifest = [];
  const spine = [];
  const nav = [];
  if (fixedLayout) {
    zip.file('OEBPS/style.css', MANGA_PAGE_CSS);
    manifest.push('<item id="css" href="style.css" media-type="text/css"/>');
  }
  for (const image of images) {
    const imageHref = `images/${image.filename}`;
    zip.file(`OEBPS/${imageHref}`, image.data);
    manifest.push(`<item id="${image.filename}" href="${imageHref}" media-type="${image.mediaType}"/>`);
  }
  for (const entry of entries) {
    const href = `text/${entry.id}.xhtml`;
    const label = escapeXml(entry.title);
    if (entry.image) {
      const imageHref = `images/${entry.image.filename}`;
      zip.file(`OEBPS/${imageHref}`, entry.image.data);
      manifest.push(`<item id="${entry.id}-image" href="${imageHref}" media-type="${entry.image.mediaType}"/>`);
      zip.file(`OEBPS/${href}`, renderImageXhtml(entry, imageHref));
    } else {
      zip.file(`OEBPS/${href}`, renderNovelXhtml(entry));
    }
    manifest.push(`<item id="${entry.id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${entry.id}"${fixedLayout ? ' properties="rendition:spread-none"' : ''}/>`);
    nav.push(`<li><a href="${href}">${label}</a></li>`);
  }
  const navXhtml = renderNavXhtml(title, nav.join(''));
  zip.file('OEBPS/nav.xhtml', navXhtml);
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  zip.file('OEBPS/content.opf', renderOpf({ title, bookId, manifest: manifest.join(''), spine: spine.join(''), fixedLayout }));

  const output = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS'
  });
  if (output.length > MAX_BOOK_BYTES) throw new Error('epub_size_limit_exceeded');
  await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
  const temporary = path.join(outputDir, `.${filename}.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temporary, output, { mode: 0o600 });
  await fs.rename(temporary, path.join(outputDir, filename));
}

function sanitizeNovelHtml(value) {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'div', 'span', 'em', 'strong', 'b', 'i', 'u', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'ruby', 'rt', 'img'],
    allowedAttributes: { '*': ['class', 'lang'], img: ['src', 'data-src', 'alt', 'width', 'height'] },
    disallowedTagsMode: 'discard',
    allowVulnerableTags: false,
    allowedSchemes: ['http', 'https'],
    exclusiveFilter: frame => {
      const selected = Object.entries(frame.attribs || {})
        .filter(([name]) => /^(?:id|class|role|aria-label|title|name|data-ad|data-ad-slot|data-advertisement|data-testid)$/i.test(name));
      const attributes = selected.map(([, value]) => String(value || '')).join(' ');
      const explicitAdAttribute = selected.some(([name]) => /^(?:data-ad|data-ad-slot|data-advertisement)$/i.test(name));
      return explicitAdAttribute || AD_MARKER_RE.test(attributes) || AD_TEXT_RE.test(attributes);
    }
  }).trim();
}

function rewriteNovelImages(html, images, baseUrl) {
  let count = 0;
  return html.replace(/<img\b[^>]*>/gi, tag => {
    count += 1;
    const source = readHtmlAttribute(tag, 'src') || readHtmlAttribute(tag, 'data-src');
    const key = normalizeImageSource(source, baseUrl);
    const image = key ? images.get(key) : null;
    if (!image) throw new Error('novel_image_asset_missing');
    return renderInlineImage(image, `../images/${image.filename}`, '1em auto');
  });
}

function readHtmlAttribute(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match ? match[2].replaceAll('&amp;', '&') : '';
}

function normalizeImageSource(value, baseUrl) {
  if (!value) return null;
  try {
    const parsed = new URL(String(value), baseUrl || undefined);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

function renderNovelXhtml(entry) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-Hant" lang="zh-Hant"><head><title>${escapeXml(entry.title)}</title><meta name="viewport" content="width=device-width, height=device-height"/></head><body><h1>${escapeXml(entry.title)}</h1>${entry.html}</body></html>`;
}

function renderImageXhtml(entry, imageHref) {
  const image = entry.image;
  const width = Number(image.width);
  const height = Number(image.height);
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-Hant" lang="zh-Hant"><head><title>${escapeXml(entry.title)}</title><meta name="viewport" content="width=${width}, height=${height}"/><link rel="stylesheet" type="text/css" href="../style.css"/></head><body>${renderKoboSvg(image, `../${imageHref}`)}</body></html>`;
}

function renderInlineImage(image, imageHref, margin) {
  const width = Number(image.width);
  const height = Number(image.height);
  const imageClass = width > height ? 'widthImage' : 'heightImage';
  return `<img src="${imageHref}" alt="${image.alt || ''}" width="${width}" height="${height}" class="${imageClass}" style="display:block;width:${width}px;height:${height}px;margin:${margin};"/>`;
}

function renderKoboSvg(image, imageHref) {
  const width = Number(image.width);
  const height = Number(image.height);
  return `<svg class="full" xmlns="http://www.w3.org/2000/svg" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" baseProfile="full" viewBox="0 0 ${width} ${height}"><image height="${height}" width="${width}" x="0" xlink:href="${imageHref}" y="0"/></svg>`;
}

function renderNavXhtml(title, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-Hant" lang="zh-Hant"><head><title>${escapeXml(title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${escapeXml(title)}</h1><ol>${items}</ol></nav></body></html>`;
}

function renderOpf({ title, bookId, manifest, spine, fixedLayout = false }) {
  const layout = fixedLayout
    ? '<meta property="rendition:layout">pre-paginated</meta><meta property="rendition:spread">none</meta>'
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(bookId)}</dc:identifier><dc:title>${escapeXml(title)}</dc:title><dc:language>zh-Hant</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>${layout}</metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

function slugify(value) {
  const normalized = cleanBookTitle(value, 'book')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILENAME_STEM_LENGTH)
    .replace(/^-+|-+$/g, '');
  return normalized || 'book';
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  MAX_IMAGE_BYTES,
  KOBO_MAX_HEIGHT,
  KOBO_MAX_WIDTH,
  normalizeImageSource,
  rewriteNovelImages,
  optimizeImage,
  sanitizeNovelHtml,
  cleanBookTitle,
  writeMangaChapterEpub,
  writeNovelEpub
};
