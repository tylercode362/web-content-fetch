const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { DownloadOrchestrator, publicBinding, safeDiagnostic, isClearable } = require('./job-orchestrator');
const { normalizeBaseUrl } = require('./bridge-client');
const { applyBindingToJob, getBinding, normalizeConfig } = require('./binding-store');
const { publicDownloads, publicOutputGroups, legacyMangaOutputGroups } = require('./job-view');
const { createCsrfStore } = require('./csrf');
const { validateCallbackUrl } = require('./callback-url');

const host = process.env.WEB_CONTENT_FETCH_BIND_HOST || '127.0.0.1';
const port = Number(process.env.WEB_CONTENT_FETCH_PORT || 8092);
const stateDir = process.env.WEB_CONTENT_FETCH_STATE_DIR || path.join(process.cwd(), '.state');
const outputDir = process.env.WEB_CONTENT_FETCH_OUTPUT_DIR || path.join(process.cwd(), 'output');
const stateFile = path.join(stateDir, 'jobs.json');
const configFile = path.join(stateDir, 'config.json');
const jobs = new Map();
const subscribers = new Set();
const csrfStore = createCsrfStore();
const maxJobs = 256;

fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const config = loadConfig();
loadJobs();
void saveConfig(config).catch(() => {});

function loadConfig() {
  let value = {};
  try { value = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') console.error('configuration unavailable');
  }
  const normalized = normalizeConfig(value, {
    ...process.env,
    WEB_CONTENT_FETCH_CALLBACK_URL: process.env.WEB_CONTENT_FETCH_CALLBACK_URL ||
      `http://host.docker.internal:${port}/api/bridge/callback`
  });
  normalized.callbackUrl = validateCallbackUrl(normalized.callbackUrl);
  return normalized;
}

async function saveConfig(value) {
  const temporary = `${configFile}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await fsp.rename(temporary, configFile);
}

function loadJobs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    for (const job of Array.isArray(parsed) ? parsed : []) {
      if (!job || typeof job.id !== 'string') continue;
      const binding = getBinding(config, job.bindingId);
      if (binding) applyBindingToJob(job, binding);
      if (job.status === 'running' || job.status === 'pausing' || job.status === 'cancelling') {
        job.status = 'queued';
        job.diagnostic = 'recovered_after_restart';
        job.pauseRequested = false;
        job.cancelRequested = false;
        job.bridgeProgress = null;
        job.progress = { ...(job.progress || {}), phase: 'queued' };
      }
      jobs.set(job.id, job);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('job state unavailable');
  }
}

function persistJobs() {
  const temporary = `${stateFile}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify([...jobs.values()], null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, stateFile);
}

function publicJob(job) {
  const outputGroups = publicOutputGroups(job.outputGroups).length > 0
    ? publicOutputGroups(job.outputGroups)
    : (job.kind === 'manga' ? publicOutputGroups(legacyMangaOutputGroups(job.outputs)) : []);
  return {
    id: job.id,
    url: job.url,
    kind: job.kind,
    title: job.title || null,
    status: job.status,
    progress: job.progress,
    bridgeProgress: job.bridgeProgress || null,
    diagnostic: job.diagnostic || null,
    outputs: Array.isArray(job.outputs) ? job.outputs.map(output => `/downloads/${encodeURIComponent(output)}`) : [],
    downloads: publicDownloads(job.outputs),
    outputGroups,
    downloadAll: Array.isArray(job.outputs) && job.outputs.length > 0
      ? `/api/jobs/${encodeURIComponent(job.id)}/download-all`
      : null,
    chapterCount: job.chapterCount || null,
    bindingId: job.bindingId || null,
    bridgeUrl: job.bridgeUrl || null,
    browserClientId: job.browserClientId || null,
    serviceClientId: job.serviceClientId || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function update(job, change) {
  Object.assign(job, change, { updatedAt: new Date().toISOString() });
  persistJobs();
  publish();
}

function publish() {
  const body = `data: ${JSON.stringify({ jobs: [...jobs.values()].map(publicJob), binding: publicBinding(config) })}\n\n`;
  for (const response of subscribers) response.write(body);
}

const orchestrator = new DownloadOrchestrator({
  jobs,
  update,
  removeJob(jobId) {
    jobs.delete(jobId);
    persistJobs();
    publish();
  },
  config,
  saveConfig,
  outputDir,
  checkpointDir: path.join(stateDir, 'checkpoints')
});

function supported(value) {
  const parsed = new URL(value);
  if (parsed.hostname === 'm.manhuagui.com' && /^\/comic\/\d+\/?$/.test(parsed.pathname)) return 'manga';
  if (parsed.hostname === 'www.8comic.com' && /^\/html\/\d+\.html$/.test(parsed.pathname)) return 'manga';
  if (parsed.hostname === 'tw.linovelib.com' && /^\/novel\/\d+(?:\.html|\/?$)/.test(parsed.pathname)) return 'novel';
  return null;
}

function drain() {
  void orchestrator.drain().catch(error => console.error(safeDiagnostic(error)));
}

function originAllowed(request) {
  const configured = process.env.WEB_CONTENT_FETCH_ALLOWED_ORIGIN || `http://127.0.0.1:${port}`;
  if (request.headers.origin) return request.headers.origin === configured;
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  try {
    return request.headers.host === new URL(configured).host;
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const result = {};
  for (const item of String(request.headers.cookie || '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    try { result[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1)); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

function csrfAllowed(request) {
  const cookies = parseCookies(request);
  return csrfStore.verify(request.headers['x-csrf-token'], cookies.wcf_csrf);
}

function callbackAllowed(request, job) {
  return Boolean(job && typeof request.headers['x-bridge-callback-token'] === 'string' &&
    request.headers['x-bridge-callback-token'] === job.callbackToken);
}

function sendJson(response, status, value, extra) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(extra || {})
  });
  response.end(JSON.stringify(value));
}

function readJson(request, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) reject(new Error('request_too_large'));
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('invalid_json')); }
    });
    request.on('error', reject);
  });
}

function renderHtml(token) {
  return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="csrf-token" content="' + escapeHtml(token) + '"><title>Web Content Fetch</title>' +
    '<link rel="stylesheet" href="ui.css"></head><body>' +
    '<main class="shell"><header class="hero"><div><p class="eyebrow">LOCAL CONTENT WORKSPACE</p><h1>內容下載任務</h1><p class="lede">小說整部輸出；漫畫逐章／逐卷完成就能下載。</p></div><div id="connection" class="connection" data-state="unknown">檢查 Bridge 中…</div></header>' +
    '<section class="panel settings"><div class="section-heading"><div><p class="eyebrow">連線設定</p><h2>Chrome Bridge 設定</h2></div><span class="section-note">六碼僅供建立授權</span></div>' +
    '<div class="settings-grid"><label>Chrome Bridge 網址<input id="bridgeUrl" type="url"></label></div>' +
    '<div class="settings-actions"><div class="binding-summary"><span>目前授權狀態</span><strong id="bindingId">尚未設定</strong></div><button id="saveConfig" class="button secondary">儲存網址</button><label>Extension 顯示的六碼<input id="pairCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" size="8"></label><button id="pair" class="button secondary">改綁產生六碼的 Extension</button></div><p id="boundExtensionId" class="hint"></p><p id="binding" class="hint"></p><p id="bridgeHeartbeat" class="hint"></p><p id="browserServiceId" class="hint"></p><p id="configStatus" class="feedback"></p></section>' +
    '<section class="panel add-job"><div class="section-heading"><div><p class="eyebrow">QUEUE</p><h2>新增下載任務</h2></div><span class="section-note">同一 FQDN 會依序處理</span></div><form id="form"><input id="url" type="url" placeholder="貼上小說或漫畫作品網址" required><select id="kind"><option value="auto">自動判斷</option><option value="novel">小說</option><option value="manga">漫畫</option></select><button class="button primary">加入佇列</button></form><p id="status" class="feedback"></p></section>' +
    '<section class="queue-header"><div><p class="eyebrow">DOWNLOAD QUEUE</p><h2>工作佇列</h2></div><div class="queue-tools"><div id="stats" class="stats"></div><button id="clearFailed" class="button ghost">清除失敗與取消紀錄</button></div></section><section id="jobs" class="jobs" aria-live="polite"></section></main><script src="ui.js"></script></body></html>';
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(response, 200, { ok: true, service: 'web-content-fetch', bridgeUrl: publicBinding(config).bridgeUrl, paired: orchestrator.paired });
  }
  if (request.method === 'GET' && url.pathname === '/ui.css') return serveStatic(response, 'ui.css', 'text/css; charset=utf-8');
  if (request.method === 'GET' && url.pathname === '/ui.js') return serveStatic(response, 'ui.js', 'text/javascript; charset=utf-8');
  if (request.method === 'GET' && url.pathname === '/') {
    const token = csrfStore.issue();
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': csrfStore.cookieHeader(token),
      'Content-Security-Policy': "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'",
      'Referrer-Policy': 'no-referrer'
    });
    return response.end(renderHtml(token));
  }

  if (request.method === 'POST' && url.pathname === '/api/bridge/callback') {
    let body;
    const callbackType = String(request.headers['x-bridge-callback-type'] || '');
    const callbackJobId = String(request.headers['x-bridge-callback-job-id'] || '');
    const maxCallbackBytes = callbackType === 'novel_asset' ? 24 * 1024 * 1024
      : callbackType === 'novel_images' ? 2 * 1024 * 1024 : 64 * 1024;
    if (callbackType === 'novel_asset' || callbackType === 'novel_images') {
      const callbackJob = jobs.get(callbackJobId);
      if (!callbackAllowed(request, callbackJob)) return sendJson(response, 403, { error: 'callback_forbidden' });
      const contentLength = Number(request.headers['content-length'] || 0);
      if (contentLength > maxCallbackBytes) return sendJson(response, 413, { error: 'request_too_large' });
    }
    try { body = await readJson(request, maxCallbackBytes); } catch { return sendJson(response, 400, { error: 'invalid_json' }); }
    if ((callbackType === 'novel_asset' || callbackType === 'novel_images') && body.jobId !== callbackJobId) {
      return sendJson(response, 403, { error: 'callback_forbidden' });
    }
    const job = typeof body.jobId === 'string' ? jobs.get(body.jobId) : null;
    if (!callbackAllowed(request, job)) return sendJson(response, 403, { error: 'callback_forbidden' });
    if (body.type === 'novel_images' && callbackType === 'novel_images') {
      try {
        const result = await orchestrator.registerNovelImagesCallback(body.jobId, body);
        return sendJson(response, 202, result);
      } catch (error) {
        return sendJson(response, 409, { error: safeDiagnostic(error) });
      }
    }
    if (body.type === 'novel_asset' && callbackType === 'novel_asset') {
      try {
        const result = await orchestrator.acceptNovelAssetCallback(body.jobId, body);
        return sendJson(response, 202, result);
      } catch (error) {
        return sendJson(response, 409, { error: safeDiagnostic(error) });
      }
    }
    if ((job.status === 'queued' || job.status === 'running') && body.progress && typeof body.progress === 'object') {
      const progress = {
        phase: String(body.progress.phase || 'bridge_callback').slice(0, 64),
        completed: Number.isInteger(body.progress.completed) ? body.progress.completed : 0,
        total: Number.isInteger(body.progress.total) ? body.progress.total : null
      };
      update(job, { bridgeProgress: progress });
    }
    return sendJson(response, 202, { accepted: true });
  }

  if (!originAllowed(request)) return sendJson(response, 403, { error: 'origin_forbidden' });
  if (request.method === 'GET' && url.pathname === '/api/csrf') {
    const token = csrfStore.issue();
    return sendJson(response, 200, { csrfToken: token }, { 'Set-Cookie': csrfStore.cookieHeader(token) });
  }
  if (request.method === 'GET' && url.pathname === '/api/bridge/status') {
    return sendJson(response, 200, await orchestrator.bindingStatus());
  }
  if (request.method === 'GET' && (url.pathname === '/api/state' || url.pathname === '/api/jobs')) {
    return sendJson(response, 200, { jobs: [...jobs.values()].map(publicJob), binding: publicBinding(config) });
  }
  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    response.write(`data: ${JSON.stringify({ jobs: [...jobs.values()].map(publicJob), binding: publicBinding(config) })}\n\n`);
    subscribers.add(response);
    request.on('close', () => subscribers.delete(response));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/config') {
    if (!csrfAllowed(request)) return sendJson(response, 403, { error: 'csrf_forbidden' });
    try {
      const body = await readJson(request);
      const nextBridgeUrl = normalizeBaseUrl(String(body.bridgeUrl || ''));
      if (Object.hasOwn(body, 'callbackUrl') &&
          validateCallbackUrl(String(body.callbackUrl || '')) !== config.callbackUrl) {
        throw new Error('callback_url_managed_by_deployment');
      }
      if (body.activeBindingId && !getBinding(config, String(body.activeBindingId))) {
        throw new Error('binding_not_found');
      }
      const binding = getBinding(config, body.activeBindingId ? String(body.activeBindingId) : '');
      const bridgeChanged = Boolean(binding && binding.bridgeUrl !== nextBridgeUrl);
      config.defaultBridgeUrl = nextBridgeUrl;
      if (binding) {
        if (bridgeChanged) {
          binding.serviceCredential = '';
          binding.browserClientId = '';
          binding.expectedFingerprint = '';
        }
        binding.bridgeUrl = nextBridgeUrl;
        binding.updatedAt = new Date().toISOString();
        config.activeBindingId = binding.bindingId;
      } else {
        config.activeBindingId = null;
      }
      orchestrator.reconfigure(config);
      await saveConfig(config);
      return sendJson(response, 200, { binding: publicBinding(config), rebindRequired: bridgeChanged });
    } catch (error) {
      return sendJson(response, 422, { error: safeDiagnostic(error) });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/bridge/pair') {
    if (!csrfAllowed(request)) return sendJson(response, 403, { error: 'csrf_forbidden' });
    try {
      const body = await readJson(request);
      const binding = await orchestrator.pair(body.code, { bridgeUrl: body.bridgeUrl, serviceClientId: body.serviceClientId });
      publish();
      return sendJson(response, 200, { binding });
    } catch (error) {
      return sendJson(response, 422, { error: safeDiagnostic(error) });
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/jobs') {
    if (!csrfAllowed(request)) return sendJson(response, 403, { error: 'csrf_forbidden' });
    if (jobs.size >= maxJobs) return sendJson(response, 429, { error: 'queue_full' });
    try {
      const body = await readJson(request);
      const urlValue = new URL(String(body.url || ''));
      if (!['http:', 'https:'].includes(urlValue.protocol)) throw new Error('url_invalid');
      const detected = supported(urlValue.href);
      const kind = body.kind === 'auto' ? detected : body.kind;
      if (!detected || !['novel', 'manga'].includes(kind) || kind !== detected) return sendJson(response, 422, { error: 'unsupported_url' });
      const binding = getBinding(config, String(body.bindingId || ''));
      if (!binding || !binding.serviceCredential || !binding.browserClientId) {
        return sendJson(response, 422, { error: 'bridge_not_paired' });
      }
      const now = new Date().toISOString();
      const job = {
        id: crypto.randomUUID(),
        url: urlValue.href,
        kind,
        status: 'queued',
        callbackToken: crypto.randomBytes(32).toString('base64url'),
        progress: { phase: 'queued', completed: 0, total: null },
        createdAt: now,
        updatedAt: now
      };
      applyBindingToJob(job, binding);
      jobs.set(job.id, job);
      persistJobs();
      publish();
      drain();
      return sendJson(response, 202, { job: publicJob(job) });
    } catch (error) {
      return sendJson(response, 400, { error: error.message === 'url_invalid' ? 'url_invalid' : 'invalid_json' });
    }
  }
  if (request.method === 'POST' && ['/api/jobs/clear-failed', '/api/jobs/clear-terminal'].includes(url.pathname)) {
    if (!csrfAllowed(request)) return sendJson(response, 403, { error: 'csrf_forbidden' });
    const clearableJobs = [...jobs.values()].filter(job => isClearable(job.status));
    const deletedJobIds = [];
    const failures = [];
    try {
      for (const job of clearableJobs) {
        try {
          const deletedJob = await orchestrator.delete(job.id);
          if (deletedJob && !jobs.has(job.id)) deletedJobIds.push(job.id);
        } catch (error) {
          failures.push({ jobId: job.id, error: safeDiagnostic(error) });
        }
      }
      publish();
      if (failures.length > 0) {
        return sendJson(response, 422, {
          error: 'cleanup_incomplete',
          deleted: deletedJobIds.length,
          deletedJobIds,
          failures,
          statuses: ['error', 'cancelled']
        });
      }
      return sendJson(response, 200, {
        deleted: deletedJobIds.length,
        deletedJobIds,
        statuses: ['error', 'cancelled']
      });
    } catch (error) {
      return sendJson(response, 422, { error: safeDiagnostic(error) });
    }
  }
  const jobActionMatch = request.method === 'POST' && url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})\/(pause|resume|cancel|delete)$/i);
  if (jobActionMatch) {
    if (!csrfAllowed(request)) return sendJson(response, 403, { error: 'csrf_forbidden' });
    const job = jobs.get(jobActionMatch[1]);
    if (!job) return sendJson(response, 404, { error: 'job_not_found' });
    const action = jobActionMatch[2].toLowerCase();
    try {
      if (action === 'pause') orchestrator.pause(job.id);
      else if (action === 'resume') orchestrator.resume(job.id);
      else if (action === 'cancel') await orchestrator.cancel(job.id);
      else {
        const deletedJob = await orchestrator.delete(job.id);
        return sendJson(response, 200, {
          deleted: true,
          jobId: job.id,
          removedOutputs: deletedJob?.deletedOutputCount || 0
        });
      }
    } catch (error) {
      return sendJson(response, 422, { error: safeDiagnostic(error) });
    }
    return sendJson(response, 200, { job: publicJob(job) });
  }
  const archiveMatch = request.method === 'GET' && url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})\/download-all$/i);
  if (archiveMatch) {
    const job = jobs.get(archiveMatch[1]);
    if (!job) return sendJson(response, 404, { error: 'job_not_found' });
    return downloadAll(response, job);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/downloads/')) return downloadOutput(response, decodeURIComponent(url.pathname.slice('/downloads/'.length)));
  return sendJson(response, 404, { error: 'not_found' });
});

async function downloadOutput(response, relativeName) {
  if (!/^[\p{L}\p{N}._/-]+$/u.test(relativeName) || relativeName.includes('..')) return sendJson(response, 400, { error: 'output_invalid' });
  const root = path.resolve(outputDir);
  const filePath = path.resolve(root, relativeName);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return sendJson(response, 400, { error: 'output_invalid' });
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile() || stat.size > 512 * 1024 * 1024) return sendJson(response, 404, { error: 'output_not_found' });
    response.writeHead(200, { 'Content-Type': 'application/epub+zip', 'Content-Length': stat.size, 'Content-Disposition': `attachment; filename="${path.basename(filePath).replace(/"/g, '')}"`, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  } catch { return sendJson(response, 404, { error: 'output_not_found' }); }
}

async function downloadAll(response, job) {
  const files = publicDownloads(job.outputs).map(item => item.filename);
  if (files.length === 0) return sendJson(response, 404, { error: 'output_not_found' });
  const root = path.resolve(outputDir);
  const paths = [];
  try {
    for (const name of files) {
      const filePath = path.resolve(root, name);
      if (filePath === root || !filePath.startsWith(root + path.sep) || path.basename(filePath) !== name) throw new Error('output_invalid');
      const stat = await fsp.stat(filePath);
      if (!stat.isFile() || stat.size > 512 * 1024 * 1024) throw new Error('output_not_found');
      paths.push({ name, filePath });
    }
  } catch (error) {
    return sendJson(response, error.message === 'output_invalid' ? 400 : 404, { error: error.message });
  }
  const zip = new JSZip();
  for (const item of paths) zip.file(item.name, fs.createReadStream(item.filePath));
  response.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="web-content-fetch-${job.id}.zip"; filename*=UTF-8''${encodeURIComponent(String(job.title || 'content-download').slice(0, 120))}.zip`,
    'Cache-Control': 'no-store'
  });
  const stream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' });
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

function serveStatic(response, filename, contentType) {
  const filePath = path.join(__dirname, filename);
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  return fs.createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

server.listen(port, host, () => console.log(`web-content-fetch listening on http://${host}:${port}`));

for (const job of jobs.values()) if (job.status === 'queued') setImmediate(drain);
