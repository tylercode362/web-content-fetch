const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { BridgeClient, normalizeBaseUrl } = require('./bridge-client');
const { getBinding, isUuid, publicBinding } = require('./binding-store');
const { cleanBookTitle, writeMangaChapterEpub, writeNovelEpub } = require('./epub-writer');

const MAX_CHAPTERS = 2000;
const MAX_PAGES = 512;
const MAX_IMAGES = 1024;
const MANGA_ASSET_BATCH_SIZE = 8;
const MAX_RETRIES = 2;
const DEFAULT_MAX_CONCURRENT_JOBS = 5;
const MAX_CONCURRENT_JOBS = 5;

class DownloadOrchestrator {
  constructor({ jobs, update, removeJob, config, saveConfig, outputDir, checkpointDir, maxConcurrentJobs, maxConcurrentJobsPerBinding }) {
    this.jobs = jobs;
    this.update = update;
    this.removeJob = removeJob || (() => {});
    this.config = config;
    this.saveConfig = saveConfig;
    this.outputDir = outputDir;
    this.checkpointDir = checkpointDir || path.join(outputDir, '.checkpoints');
    this.maxConcurrentJobs = normalizeConcurrency(
      maxConcurrentJobs ?? maxConcurrentJobsPerBinding ?? process.env.WEB_CONTENT_FETCH_MAX_CONCURRENT_JOBS,
      DEFAULT_MAX_CONCURRENT_JOBS
    );
    this.draining = false;
    this.runningJobs = new Map();
    this.runningFqdns = new Set();
    this.controllers = new Map();
    this.clients = new Map();
    this.refreshClients();
  }

  refreshClients() {
    const activeIds = new Set();
    for (const binding of this.config.bindings || []) {
      activeIds.add(binding.bindingId);
      const existing = this.clients.get(binding.bindingId);
      if (existing) existing.update(binding);
      else this.clients.set(binding.bindingId, new BridgeClient(binding));
    }
    for (const bindingId of this.clients.keys()) {
      if (!activeIds.has(bindingId)) this.clients.delete(bindingId);
    }
    this.client = this.clients.get(this.config.activeBindingId) || null;
  }

  reconfigure(config) {
    this.config = config;
    this.refreshClients();
  }

  get paired() {
    return (this.config.bindings || []).some(binding =>
      Boolean(binding.serviceCredential && binding.browserClientId)
    );
  }

  get activeBinding() {
    return getBinding(this.config);
  }

  async pair(code, options = {}) {
    if (!/^[0-9]{6}$/.test(String(code || ''))) throw new Error('pairing_code_invalid');
    const bridgeUrl = normalizeBaseUrl(String(
      options.bridgeUrl || this.config.defaultBridgeUrl || this.activeBinding?.bridgeUrl || ''
    ));
    const now = new Date().toISOString();
    const requestedServiceClientId = String(options.serviceClientId || '');
    const previous = this.config.bindings?.[0] || null;
    const binding = {
      bindingId: previous?.bindingId || crypto.randomUUID(),
      bridgeUrl,
      expectedFingerprint: '',
      serviceClientId: isUuid(requestedServiceClientId)
        ? requestedServiceClientId
        : (previous?.serviceClientId || crypto.randomUUID()),
      serviceCredential: '',
      browserClientId: '',
      createdAt: previous?.createdAt || now,
      updatedAt: now
    };
    const client = new BridgeClient(binding);
    const result = await client.pair(String(code), 'web-content-fetch');
    binding.serviceCredential = result.serviceCredential;
    binding.browserClientId = result.browserClientId;
    binding.expectedFingerprint = client.fingerprint || result.fingerprint || '';
    binding.updatedAt = new Date().toISOString();
    this.config.defaultBridgeUrl = bridgeUrl;
    this.config.bindings = [binding];
    this.config.bindingAliases = [...new Set([
      ...(this.config.bindingAliases || []),
      binding.bindingId
    ])];
    this.config.activeBindingId = binding.bindingId;
    await this.saveConfig(this.config);
    this.refreshClients();
    return publicBinding(this.config);
  }

  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (true) {
        if (this.runningJobs.size >= this.maxConcurrentJobs) break;
        const job = [...this.jobs.values()].find(item => {
          if (item.status !== 'queued' || this.runningJobs.has(item.id)) return false;
          return !this.runningFqdns.has(this.fqdnKey(item));
        });
        if (!job) break;
        this.start(job);
      }
    } finally {
      this.draining = false;
    }
  }

  start(job) {
    const fqdn = this.fqdnKey(job);
    this.runningFqdns.add(fqdn);
    const execution = Promise.resolve()
      .then(() => this.run(job))
      .catch(error => {
        this.update(job, {
          status: 'error',
          progress: { phase: 'failed', completed: job.progress?.completed || 0, total: job.progress?.total || null },
          diagnostic: safeDiagnostic(error)
        });
      })
      .finally(() => {
        this.runningJobs.delete(job.id);
        this.runningFqdns.delete(fqdn);
        void this.drain();
      });
    this.runningJobs.set(job.id, execution);
  }

  fqdnKey(job) {
    try {
      return new URL(String(job.url)).hostname.toLowerCase().replace(/\.$/, '');
    } catch {
      return `invalid:${job.id}`;
    }
  }

  storageKey(job) {
    const value = String(job.id || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('job_id_invalid');
    return value;
  }

  checkpointPath(job) {
    return path.join(this.checkpointDir, this.storageKey(job));
  }

  stagePath(job) {
    return path.join(this.outputDir, '.jobs', this.storageKey(job));
  }

  async writeCheckpoint(job, name, value) {
    const directory = this.checkpointPath(job);
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const filePath = path.join(directory, name);
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600 });
    await fsp.rename(temporary, filePath);
  }

  async readCheckpoint(job, name) {
    try {
      return JSON.parse(await fsp.readFile(path.join(this.checkpointPath(job), name), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error('checkpoint_invalid');
    }
  }

  async writeJobManifest(job, title, chapters) {
    await this.writeCheckpoint(job, 'manifest.json', { title, chapters });
  }

  async readJobManifest(job) {
    const value = await this.readCheckpoint(job, 'manifest.json');
    if (!value || typeof value.title !== 'string' || !Array.isArray(value.chapters) || value.chapters.length === 0) return null;
    if (requiresLinovelManifestRefresh(job, value)) return null;
    return value;
  }

  chapterCheckpointName(index) {
    return `chapters/chapter-${String(index).padStart(6, '0')}.json`;
  }

  async writeChapterCheckpoint(job, index, value) {
    const directory = path.join(this.checkpointPath(job), 'chapters');
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const filePath = path.join(directory, `chapter-${String(index).padStart(6, '0')}.json`);
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(value) + '\n', { mode: 0o600 });
    await fsp.rename(temporary, filePath);
  }

  async readChapterCheckpoint(job, index) {
    return this.readCheckpoint(job, this.chapterCheckpointName(index));
  }

  async ensureStage(job) {
    const directory = this.stagePath(job);
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    return directory;
  }

  async removeJobFiles(job) {
    const paths = [this.checkpointPath(job), this.stagePath(job)];
    await Promise.all(paths.map(filePath => fsp.rm(filePath, { recursive: true, force: true })));
    await Promise.all(paths.map(filePath => this.assertPathMissing(filePath, 'job_delete_incomplete')));
  }

  async publishOutputs(job, files, options = {}) {
    const stage = path.resolve(await this.ensureStage(job));
    const published = [];
    const prefix = options.prefix ? `${this.storageKey(job)}-` : '';
    for (const file of files) {
      const source = path.resolve(String(file));
      if (source !== stage && !source.startsWith(stage + path.sep)) throw new Error('job_output_path_invalid');
      const relative = path.relative(stage, source);
      const name = path.basename(relative);
      if (!name || name.startsWith('.')) throw new Error('job_output_path_invalid');
      const destination = path.join(this.outputDir, `${prefix}${name}`);
      await fsp.rm(destination, { force: true });
      await fsp.rename(source, destination);
      published.push(relativeOutput(this.outputDir, destination));
    }
    return published;
  }

  async existingPublishedFiles(job, files) {
    if (!Array.isArray(files) || files.length === 0) return null;
    const root = path.resolve(this.outputDir);
    const paths = [];
    for (const value of files) {
      const candidate = path.resolve(root, String(value || ''));
      if (candidate === root || !candidate.startsWith(root + path.sep) || path.basename(candidate) !== String(value || '')) return null;
      paths.push(candidate);
    }
    try {
      await Promise.all(paths.map(file => fsp.access(file)));
      return paths;
    } catch {
      return null;
    }
  }

  async recordMangaOutput(job, chapterIndex, title, files) {
    const validFiles = [...new Set((Array.isArray(files) ? files : []).map(value => String(value || '')).filter(Boolean))];
    if (validFiles.length === 0) throw new Error('manga_output_missing');
    const groups = Array.isArray(job.outputGroups) ? job.outputGroups.filter(group => group?.chapterIndex !== chapterIndex) : [];
    groups.push({ chapterIndex, title: String(title || `第 ${chapterIndex + 1} 章`).slice(0, 500), files: validFiles });
    groups.sort((left, right) => left.chapterIndex - right.chapterIndex);
    const outputs = [...new Set([
      ...(Array.isArray(job.outputs) ? job.outputs : []),
      ...groups.flatMap(group => Array.isArray(group.files) ? group.files : [])
    ])];
    this.update(job, { outputs, outputGroups: groups });
  }

  publishedOutputNames(job) {
    return [...new Set([
      ...(Array.isArray(job.outputs) ? job.outputs : []),
      ...(Array.isArray(job.outputGroups) ? job.outputGroups.flatMap(group => group?.files || []) : [])
    ].map(value => String(value || '')).filter(Boolean))];
  }

  publishedOutputPaths(job) {
    const root = path.resolve(this.outputDir);
    return this.publishedOutputNames(job).map(value => {
      const candidate = path.resolve(root, value);
      if (candidate === root || !candidate.startsWith(root + path.sep) || path.basename(candidate) !== value) throw new Error('job_output_path_invalid');
      return candidate;
    });
  }

  async removePublishedOutputs(job) {
    const paths = this.publishedOutputPaths(job);
    await Promise.all(paths.map(filePath => fsp.rm(filePath, { force: true })));
    await Promise.all(paths.map(filePath => this.assertPathMissing(filePath, 'job_delete_incomplete')));
  }

  async assertPathMissing(filePath, diagnostic) {
    try {
      await fsp.lstat(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    throw new Error(diagnostic);
  }

  async existingStageFiles(job, files) {
    if (!Array.isArray(files) || files.length === 0) return null;
    const stage = path.resolve(await this.ensureStage(job));
    const paths = [];
    for (const value of files) {
      const candidate = path.resolve(stage, String(value || ''));
      if (candidate !== stage && !candidate.startsWith(stage + path.sep)) return null;
      paths.push(candidate);
    }
    try {
      await Promise.all(paths.map(file => fsp.access(file)));
      return paths;
    } catch {
      return null;
    }
  }

  async cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (isTerminal(job.status)) return job;
    if (job.status === 'queued' || job.status === 'paused') {
      await this.removeJobFiles(job);
      await this.removePublishedOutputs(job);
      this.update(job, {
        status: 'cancelled',
        progress: { ...(job.progress || {}), phase: 'cancelled' },
        diagnostic: null,
        outputs: [],
        outputGroups: []
      });
      return job;
    }
    if (job.status === 'running' || job.status === 'pausing' || job.status === 'cancelling') {
      job.cancelRequested = true;
      job.pauseRequested = false;
      this.update(job, {
        status: 'cancelling',
        progress: { ...(job.progress || {}), phase: 'cancelling' }
      });
      this.controllers.get(job.id)?.abort();
      const binding = getBinding(this.config, job.bindingId);
      if (binding?.serviceCredential && binding.browserClientId) {
        const cancelClient = new BridgeClient(binding);
        void cancelClient.cancelContentFetch(job.id).catch(() => {});
      }
    }
    return job;
  }

  async delete(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (!isTerminal(job.status)) throw new Error('job_not_terminal');
    if (this.runningJobs.has(job.id)) throw new Error('job_still_running');

    const removedOutputs = this.publishedOutputNames(job);
    this.publishedOutputPaths(job);
    await this.removeJobFiles(job);
    await this.removePublishedOutputs(job);
    this.jobs.delete(job.id);
    await this.removeJob(job.id);
    job.deletedOutputCount = removedOutputs.length;
    return job;
  }

  pause(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || isTerminal(job.status) || job.status === 'paused' || job.status === 'pausing') return job || null;
    if (job.status === 'queued') {
      job.pauseRequested = true;
      this.update(job, { status: 'paused', progress: { ...(job.progress || {}), phase: 'paused' }, diagnostic: null });
      return job;
    }
    if (job.status === 'running') {
      job.pauseRequested = true;
      this.update(job, { status: 'pausing', progress: { ...(job.progress || {}), phase: 'pausing' } });
      this.controllers.get(job.id)?.abort();
      const binding = getBinding(this.config, job.bindingId);
      if (binding?.serviceCredential && binding.browserClientId) {
        const cancelClient = new BridgeClient(binding);
        void cancelClient.cancelContentFetch(job.id).catch(() => {});
      }
    }
    return job;
  }

  resume(jobId) {
    const job = this.jobs.get(jobId);
    const recoverableError = job?.status === 'error' && isRecoverableBridgeDiagnostic(job.diagnostic);
    if (!job || job.status === 'complete' || job.status === 'cancelled' ||
        (job.status !== 'paused' && !recoverableError)) return job || null;
    job.pauseRequested = false;
    job.cancelRequested = false;
    this.update(job, {
      status: 'queued',
      progress: { ...(job.progress || {}), phase: 'queued' },
      diagnostic: null
    });
    void this.drain();
    return job;
  }

  async run(job) {
    const binding = getBinding(this.config, job.bindingId);
    const pooledClient = binding ? this.clients.get(binding.bindingId) : null;
    const client = pooledClient && !(pooledClient instanceof BridgeClient)
      ? pooledClient
      : (binding ? new BridgeClient(binding) : null);
    if (!binding || !client?.paired) {
      this.update(job, {
        status: 'error',
        diagnostic: 'bridge_not_paired',
        progress: { phase: 'failed', completed: 0, total: null }
      });
      return;
    }

    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    this.update(job, {
      status: 'running',
      diagnostic: null,
      progress: {
        ...(job.progress || {}),
        phase: 'resuming',
        completed: Number.isInteger(job.progress?.completed) ? job.progress.completed : 0,
        total: Number.isInteger(job.progress?.total) ? job.progress.total : null
      }
    });
    try {
      const callback = {
        callbackUrl: this.config.callbackUrl,
        callbackToken: job.callbackToken,
        callbackJobId: job.id
      };
      const call = body => this.callWithRetry(job, client, {
        ...body,
        operationKey: job.id,
        ...callback
      }, controller.signal);

      this.assertActive(job);
      const savedManifest = await this.readJobManifest(job);
      const manifest = savedManifest || await call({
        url: job.url,
        kind: job.kind,
        mode: 'chapters',
        maxChapters: MAX_CHAPTERS
      });
      const chapters = Array.isArray(manifest?.chapters) ? manifest.chapters : [];
      if (chapters.length === 0) throw new Error('chapter_list_empty');
      const fallbackTitle = (job.kind === 'novel' ? '小說' : '漫畫') + ' ' + job.id;
      const title = cleanBookTitle(manifest.title || job.title || fallbackTitle, fallbackTitle);
      job.title = title;
      await this.ensureStage(job);
      if (!savedManifest) await this.writeJobManifest(job, title, chapters);
      this.update(job, {
        progress: {
          phase: 'fetching_chapters',
          completed: savedManifest && Number.isInteger(job.progress?.completed)
            ? Math.min(job.progress.completed, chapters.length)
            : 0,
          total: chapters.length
        }
      });

      if (job.kind === 'novel') {
        const contents = [];
        for (let index = 0; index < chapters.length; index += 1) {
          this.assertActive(job);
          const chapter = chapters[index];
          let savedChapter = await this.readChapterCheckpoint(job, index);
          if (savedChapter?.contentHtml && !checkpointMatchesChapter(savedChapter, chapter.url)) {
            savedChapter = null;
          }
          if (savedChapter?.contentHtml) {
            contents.push(savedChapter);
            this.update(job, { progress: { phase: 'resuming', completed: index + 1, total: chapters.length } });
            continue;
          }
          let result;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
            result = await call({
              url: job.url,
              chapterUrl: chapter.url,
              kind: 'novel',
              mode: 'chapter',
              maxPages: MAX_PAGES
            });
            if (!result?.contentHtml) throw new Error('novel_chapter_content_missing');
            const hasInlineImages = /<img\b/i.test(result.contentHtml);
            const imageCount = Array.isArray(result.images) ? result.images.length : 0;
            if (!hasInlineImages || imageCount > 0) break;
            if (attempt === MAX_RETRIES) throw new Error('novel_inline_images_missing');
            this.update(job, { progress: { ...(job.progress || {}), phase: 'retrying', retry: attempt + 1 } });
            await delay(1000 * (attempt + 1));
          }
          const evidence = Array.isArray(result.images) ? result.images : [];
          if (/<img\b/i.test(result.contentHtml) && evidence.length === 0) {
            throw new Error('novel_inline_images_missing');
          }
          const assets = [];
          for (let imageIndex = 0; imageIndex < evidence.length; imageIndex += 1) {
            this.assertActive(job);
            const image = evidence[imageIndex];
            const asset = await call({
              url: job.url,
              chapterUrl: chapter.url,
              sourcePageUrl: image.pageUrl || chapter.url,
              assetUrl: image.url,
              kind: 'novel',
              mode: 'asset'
            });
            if (!asset?.data) throw new Error('novel_image_asset_bytes_missing');
            assets.push({ ...asset, sourceUrl: image.url, alt: image.alt || '' });
            this.update(job, {
              progress: {
                phase: 'fetching_images',
                completed: index,
                total: chapters.length,
                chapter: index + 1,
                chapterTotal: chapters.length,
                image: imageIndex + 1,
                imageTotal: evidence.length
              }
            });
          }
          const chapterContent = {
            title: cleanBookTitle(chapter.title || result.title || '第 ' + (index + 1) + ' 章', '第 ' + (index + 1) + ' 章'),
            contentHtml: result.contentHtml,
            images: assets,
            baseUrl: chapter.url
          };
          await this.writeChapterCheckpoint(job, index, chapterContent);
          contents.push(chapterContent);
          this.assertActive(job);
          this.update(job, { progress: { phase: 'fetching_chapters', completed: index + 1, total: chapters.length } });
        }
        this.assertActive(job);
        this.update(job, { progress: { phase: 'writing_epub', completed: chapters.length, total: chapters.length } });
        const output = await writeNovelEpub({ outputDir: await this.ensureStage(job), title, chapters: contents });
        this.assertActive(job);
        const published = await this.publishOutputs(job, output.files);
        await this.removeJobFiles(job);
        this.update(job, {
          status: 'complete',
          progress: { phase: 'complete', completed: chapters.length, total: chapters.length },
          outputs: published,
          chapterCount: chapters.length
        });
        return;
      }

      for (let index = 0; index < chapters.length; index += 1) {
        this.assertActive(job);
        const chapter = chapters[index];
        const savedChapter = await this.readChapterCheckpoint(job, index);
        const resumedFiles = await this.existingPublishedFiles(job, savedChapter?.files);
        if (resumedFiles) {
          await this.recordMangaOutput(job, index, cleanBookTitle(savedChapter.title || chapter.title, `第 ${index + 1} 章`), savedChapter.files);
          this.update(job, { progress: { phase: 'resuming', completed: index + 1, total: chapters.length } });
          continue;
        }
        const stagedFiles = await this.existingStageFiles(job, savedChapter?.files);
        if (stagedFiles) {
          const chapterTitle = cleanBookTitle(savedChapter.title || chapter.title, `第 ${index + 1} 章`);
          const published = await this.publishOutputs(job, stagedFiles, { prefix: true });
          await this.recordMangaOutput(job, index, chapterTitle, published);
          await this.writeChapterCheckpoint(job, index, { title: chapterTitle, files: published });
          this.update(job, { progress: { phase: 'resuming', completed: index + 1, total: chapters.length } });
          continue;
        }
        const chapterResult = await call({
          url: job.url,
          chapterUrl: chapter.url,
          kind: 'manga',
          mode: 'chapter',
          maxPages: MAX_PAGES,
          maxImages: MAX_IMAGES
        });
        const evidence = Array.isArray(chapterResult?.images) ? chapterResult.images : [];
        if (evidence.length === 0) throw new Error('manga_chapter_images_missing');
        const assets = [];
        const canBatchAssets = isEightComicChapter(chapter, evidence);
        for (let imageIndex = 0; imageIndex < evidence.length;) {
          this.assertActive(job);
          const batch = canBatchAssets
            ? evidence.slice(imageIndex, imageIndex + MANGA_ASSET_BATCH_SIZE)
            : [evidence[imageIndex]];
          const firstImage = batch[0];
          const sourcePageUrl = firstImage.pageUrl || chapter.url;
          const response = await call(canBatchAssets ? {
            url: job.url,
            chapterUrl: chapter.url,
            sourcePageUrl,
            assets: batch.map(image => ({
              url: image.url,
              ...(image.pageUrl ? { pageUrl: image.pageUrl } : {}),
              ...(Number.isInteger(image.pageIndex) ? { pageIndex: image.pageIndex } : {})
            })),
            kind: 'manga',
            mode: 'assets'
          } : {
            url: job.url,
            chapterUrl: chapter.url,
            sourcePageUrl,
            assetUrl: firstImage.url,
            ...(Number.isInteger(firstImage.pageIndex) ? { pageIndex: firstImage.pageIndex } : {}),
            kind: 'manga',
            mode: 'asset'
          });
          const downloaded = canBatchAssets
            ? (Array.isArray(response?.assets) ? response.assets : [])
            : [response];
          if (downloaded.length !== batch.length) throw new Error('manga_asset_batch_incomplete');
          for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
            const image = batch[batchIndex];
            const asset = downloaded[batchIndex];
            if (!asset?.data) throw new Error('manga_asset_bytes_missing');
            assets.push({ ...asset, alt: image.alt || '' });
            this.update(job, {
              progress: {
                phase: 'fetching_images',
                completed: index,
                total: chapters.length,
                chapter: index + 1,
                chapterTotal: chapters.length,
                image: imageIndex + batchIndex + 1,
                imageTotal: evidence.length
              }
            });
          }
          imageIndex += batch.length;
        }
        this.assertActive(job);
        this.update(job, { progress: { phase: 'writing_epub', completed: index, total: chapters.length, chapter: index + 1 } });
        const stage = await this.ensureStage(job);
        const output = await writeMangaChapterEpub({
          outputDir: stage,
          title,
          chapterTitle: chapter.title || chapterResult.title || '第 ' + (index + 1) + ' 章',
          chapterIndex: index,
          images: assets
        });
        const chapterTitle = cleanBookTitle(chapter.title || chapterResult.title || '第 ' + (index + 1) + ' 章', '第 ' + (index + 1) + ' 章');
        const published = await this.publishOutputs(job, output.files, { prefix: true });
        await this.recordMangaOutput(job, index, chapterTitle, published);
        await this.writeChapterCheckpoint(job, index, { title: chapterTitle, files: published });
        this.assertActive(job);
        this.update(job, { progress: { phase: 'fetching_chapters', completed: index + 1, total: chapters.length } });
      }
      this.assertActive(job);
      await this.removeJobFiles(job);
      this.update(job, {
        status: 'complete',
        progress: { phase: 'complete', completed: chapters.length, total: chapters.length },
        outputs: [...new Set(job.outputs || [])],
        outputGroups: Array.isArray(job.outputGroups) ? job.outputGroups : [],
        chapterCount: chapters.length
      });
    } catch (error) {
      if (job.cancelRequested || (isAbortError(error) && !job.pauseRequested)) {
        await this.removeJobFiles(job);
        await this.removePublishedOutputs(job);
        this.update(job, {
          status: 'cancelled',
          progress: { ...(job.progress || {}), phase: 'cancelled' },
          diagnostic: null,
          outputs: [],
          outputGroups: []
        });
      } else if (job.pauseRequested || job.status === 'pausing' || isPauseError(error)) {
        this.update(job, {
          status: 'paused',
          progress: { ...(job.progress || {}), phase: 'paused' },
          diagnostic: null
        });
      } else if (isRecoverableBridgeDiagnostic(safeDiagnostic(error))) {
        this.update(job, {
          status: 'paused',
          progress: { ...(job.progress || {}), phase: 'paused' },
          diagnostic: safeDiagnostic(error)
        });
      } else {
        this.update(job, {
          status: 'error',
          progress: { phase: 'failed', completed: job.progress?.completed || 0, total: job.progress?.total || null },
          diagnostic: safeDiagnostic(error)
        });
      }
    } finally {
      this.controllers.delete(job.id);
    }
  }

  async callWithRetry(job, client, body, signal) {
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        this.assertActive(job);
        return await client.contentFetch(body, { signal });
      } catch (error) {
        if (job.cancelRequested) throw cancellationError();
        if (job.pauseRequested || job.status === 'pausing') throw pauseError();
        if (isAbortError(error)) throw cancellationError();
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_RETRIES) break;
        this.update(job, { progress: { ...(job.progress || {}), phase: 'retrying', retry: attempt + 1 } });
        await delay(1000 * (attempt + 1));
      }
    }
    throw lastError || new Error('bridge_request_failed');
  }

  assertActive(job) {
    if (job.cancelRequested || job.status === 'cancelling' || job.status === 'cancelled') {
      throw cancellationError();
    }
    if (job.pauseRequested || job.status === 'pausing' || job.status === 'paused') {
      throw pauseError();
    }
  }
}

function isEightComicChapter(chapter, evidence) {
  if (!Array.isArray(evidence) || evidence.length < 2) return false;
  try {
    const chapterUrl = new URL(String(chapter?.url || ''));
    if (chapterUrl.hostname !== 'www.8comic.com' || !/^\/view\/\d+\.html$/i.test(chapterUrl.pathname)) return false;
    const sourcePageUrl = String(evidence[0]?.pageUrl || chapterUrl.href);
    return evidence.every(image => String(image?.pageUrl || chapterUrl.href) === sourcePageUrl);
  } catch {
    return false;
  }
}

function relativeOutput(outputDir, filePath) {
  return path.relative(outputDir, filePath).replaceAll('\\', '/');
}

function safeDiagnostic(error) {
  const value = String(error?.code || error?.message || 'job_failed').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
  return value || 'job_failed';
}

function requiresLinovelManifestRefresh(job, manifest) {
  if (job.kind !== 'novel' || !Array.isArray(manifest?.chapters)) return false;
  try {
    return new URL(String(job.url)).hostname === 'tw.linovelib.com' && manifest.chapters.some(chapter =>
      /^\/novel\/\d+\/vol_\d+\.html$/i.test(new URL(String(chapter?.url || '')).pathname)
    );
  } catch {
    return false;
  }
}

function checkpointMatchesChapter(checkpoint, chapterUrl) {
  if (!checkpoint?.baseUrl) return true;
  try {
    return new URL(String(checkpoint.baseUrl)).href === new URL(String(chapterUrl)).href;
  } catch {
    return false;
  }
}

function isRetryable(error) {
  const value = String(error?.code || error?.message || '');
  return isRecoverableBridgeDiagnostic(value) || /transport|timeout|offline|session|network|busy/i.test(value);
}

function isRecoverableBridgeDiagnostic(value) {
  return new Set([
    'browser_client_disconnected',
    'browser_client_offline',
    'browser_command_timeout',
    'browser_content_selector_timeout',
    'browser_content_ready_timeout',
    'browser_navigation_timeout',
    'novel_inline_images_missing',
    'bridge_transport_failed',
    'secure_transport_failed'
  ]).has(String(value || '').toLowerCase());
}

function isTerminal(status) {
  return status === 'complete' || status === 'error' || status === 'cancelled';
}

function isClearable(status) {
  return status === 'error' || status === 'cancelled';
}

function isAbortError(error) {
  return error?.name === 'AbortError' || /request_aborted|operation_cancelled/i.test(String(error?.message || error));
}

function isPauseError(error) {
  return /job_paused/i.test(String(error?.code || error?.message || error));
}

function cancellationError() {
  const error = new Error('job_cancelled');
  error.code = 'job_cancelled';
  return error;
}

function pauseError() {
  const error = new Error('job_paused');
  error.code = 'job_paused';
  return error;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeConcurrency(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_CONCURRENT_JOBS) return fallback;
  return parsed;
}

module.exports = {
  DownloadOrchestrator,
  MAX_CHAPTERS,
  MAX_IMAGES,
  MAX_PAGES,
  DEFAULT_MAX_CONCURRENT_JOBS,
  publicBinding,
  safeDiagnostic,
  isTerminal,
  isClearable
};
