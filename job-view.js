const path = require('node:path');

function classifyOutput(value) {
  const normalized = String(value || '').replaceAll('\\', '/');
  if (!normalized || normalized !== path.posix.basename(normalized) || normalized.startsWith('.') || normalized.includes('\0')) return null;
  const lower = normalized.toLowerCase();
  if (lower.endsWith('.kepub.epub')) return { filename: normalized, format: 'KEPUB' };
  if (lower.endsWith('.epub')) return { filename: normalized, format: 'EPUB' };
  return null;
}

function publicDownloads(outputs) {
  if (!Array.isArray(outputs)) return [];
  return outputs.map(classifyOutput).filter(Boolean).map(({ filename, format }) => ({
    filename,
    format,
    href: `/downloads/${encodeURIComponent(filename)}`
  }));
}

function publicOutputGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((group, position) => {
    if (!group || !Array.isArray(group.files)) return null;
    const files = publicDownloads(group.files);
    if (files.length === 0) return null;
    const chapterIndex = Number.isInteger(group.chapterIndex) && group.chapterIndex >= 0
      ? group.chapterIndex
      : position;
    return {
      chapterIndex,
      label: String(group.title || `第 ${chapterIndex + 1} 章`).slice(0, 500),
      downloads: files
    };
  }).filter(Boolean);
}

function legacyMangaOutputGroups(outputs) {
  const groups = new Map();
  for (const value of Array.isArray(outputs) ? outputs : []) {
    const classified = classifyOutput(value);
    const match = classified?.filename.match(/-chapter-(\d{4})\.(?:kepub\.)?epub$/i);
    if (!match) continue;
    const chapterIndex = Number(match[1]) - 1;
    const group = groups.get(chapterIndex) || { chapterIndex, title: `第 ${chapterIndex + 1} 章`, files: [] };
    group.files.push(classified.filename);
    groups.set(chapterIndex, group);
  }
  return [...groups.values()].sort((left, right) => left.chapterIndex - right.chapterIndex);
}

module.exports = { classifyOutput, publicDownloads, publicOutputGroups, legacyMangaOutputGroups };
