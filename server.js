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
    WEB_CONTENT_FETCH_CALLBACK_URL: value.callbackUrl ||
      process.env.WEB_CONTENT_FETCH_CALLBACK_URL ||
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

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 64 * 1024) reject(new Error('request_too_large'));
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('invalid_json')); }
    });
    request.on('error', reject);
  });
}

function renderLegacyHtml(token) {
  return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="csrf-token" content="' + escapeHtml(token) + '"><title>Web Content Fetch</title>' +
    '<style>body{font-family:system-ui,sans-serif;max-width:980px;margin:2rem auto;padding:0 1rem;color:#172033}input,select,button{font:inherit;padding:.55rem}form{display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0 1rem}input{flex:1;min-width:20rem}section{border:1px solid #dce2ec;border-radius:12px;padding:1rem;margin:1rem 0}li{margin:.55rem 0}.job{border:1px solid #dce2ec;border-radius:8px;padding:.65rem .8rem}.job summary{cursor:pointer;font-weight:600}.job-target{overflow-wrap:anywhere}.job-meta{font-size:.9rem;color:#526176}.downloads{border-top:1px solid #e6eaf0;padding-top:.5rem}.downloads ul{margin:.35rem 0}.muted{color:#64748b}.identity{font-size:.85rem;color:#526176}.error{color:#a00}code{overflow-wrap:anywhere}</style></head>' +
    '<body><h1>內容下載任務</h1>' +
    '<section><h2>Bridge 設定</h2><label>Bridge Server URL <input id="bridgeUrl" type="url" size="42"></label>' +
    '<label>Bridge callback URL <input id="callbackUrl" type="url" size="52"></label>' +
    '<label>目前 binding <select id="bindingSelect"></select></label>' +
    '<button id="saveConfig">儲存設定</button><p id="binding" class="muted"></p>' +
    '<p class="muted">本瀏覽器的 service UUID 會隨機產生並固定保存；輸入六碼會建立新的 browser/service binding，既有 binding 不會被撤銷。</p><p id="browserServiceId" class="muted"></p>' +
    '<label>六碼綁定碼 <input id="pairCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" size="8"></label><button id="pair">新增 Bridge 綁定</button><p id="configStatus"></p></section>' +
    '<section><h2>新增任務</h2><form id="form"><input id="url" type="url" placeholder="小說或漫畫作品網址" required>' +
    '<select id="kind"><option value="auto">自動判斷</option><option value="novel">小說</option><option value="manga">漫畫</option></select>' +
    '<select id="jobBinding" required></select><button>加入佇列</button></form><p id="status"></p></section><section><h2>佇列</h2><ul id="jobs"></ul></section><script>' +
    'const token=document.querySelector("[name=csrf-token]").content;' +
    'const makeUuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const bytes=new Uint8Array(16);if(crypto.getRandomValues)crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i+=1)bytes[i]=Math.floor(Math.random()*256);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);};' +
    'const browserServiceId=(()=>{const key="web-content-fetch.serviceClientId";let value=localStorage.getItem(key);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||"")){value=makeUuid();localStorage.setItem(key,value);}return value;})();' +
    'document.querySelector("#browserServiceId").textContent="本瀏覽器 service UUID："+browserServiceId;' +
    'const esc=value=>{const node=document.createElement("span");node.textContent=String(value??"");return node.innerHTML;};' +
    'const profileLabel=p=>p.serviceClientId+"｜browser "+p.browserClientId+"｜"+p.bridgeUrl;' +
    'const fillSelect=(id,profiles,selected)=>{const node=document.querySelector(id);node.textContent="";for(const p of profiles){const option=document.createElement("option");option.value=p.bindingId;option.textContent=profileLabel(p);node.append(option);}if(!profiles.length){const option=document.createElement("option");option.value="";option.textContent="尚未綁定";node.append(option);}node.value=selected||"";};' +
    'const renderBinding=b=>{const profiles=b.bindings||[];fillSelect("#bindingSelect",profiles,b.activeBindingId);fillSelect("#jobBinding",profiles,b.activeBindingId);document.querySelector("#binding").textContent=(b.paired?"已綁定：":"尚未綁定：")+(b.bridgeUrl||"")+"｜callback "+(b.callbackUrl||"")+"｜browser "+(b.browserClientId||"-")+"｜service "+(b.serviceClientId||"-");};' +
    'const safeHttpUrl=value=>{try{const url=new URL(String(value||""));return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return"";}};' +
    'const renderJobs=jobs=>{const list=document.querySelector("#jobs");list.textContent="";for(const job of jobs){const item=document.createElement("li");const details=document.createElement("details");details.className="job";const summary=document.createElement("summary");summary.textContent=(job.status||"-")+" · "+(job.kind||"-")+" · "+(job.title||job.url||"未命名工作");details.append(summary);const target=document.createElement("p");target.className="job-target";target.append(document.createTextNode("目標網址："));const targetUrl=safeHttpUrl(job.url);if(targetUrl){const link=document.createElement("a");link.href=targetUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent=String(job.url);target.append(link);}else target.append(document.createTextNode(String(job.url||"-")));details.append(target);const meta=document.createElement("p");meta.className="job-meta";meta.textContent="進度："+JSON.stringify(job.progress||{})+"｜章節："+(job.chapterCount||"-");details.append(meta);const identity=document.createElement("p");identity.className="identity";identity.textContent="binding "+(job.bindingId||"-")+"｜browser "+(job.browserClientId||"-")+"｜service "+(job.serviceClientId||"-")+"｜Bridge "+(job.bridgeUrl||"-");details.append(identity);if(job.diagnostic){const diagnostic=document.createElement("p");diagnostic.className="error";diagnostic.textContent="診斷："+job.diagnostic;details.append(diagnostic);}const downloads=document.createElement("div");downloads.className="downloads";const heading=document.createElement("strong");heading.textContent="下載檔案";downloads.append(heading);const downloadList=document.createElement("ul");for(const download of Array.isArray(job.downloads)?job.downloads:[]){if(!download||!download.href)continue;const row=document.createElement("li");const link=document.createElement("a");link.href=download.href;link.download=download.filename||"";link.textContent=(download.format||"檔案")+"："+(download.filename||download.href);row.append(link);downloadList.append(row);}if(downloadList.children.length)downloads.append(downloadList);else{const empty=document.createElement("span");empty.className="muted";empty.textContent=" 尚未產生可下載的 EPUB／KEPUB。";downloads.append(empty);}details.append(downloads);const actions=document.createElement("p");const addAction=(action,label)=>{const button=document.createElement("button");button.dataset.jobId=job.id;button.dataset.action=action;button.textContent=label;actions.append(button);};if(["queued","running"].includes(job.status))addAction("pause","暫停");if(job.status==="paused")addAction("resume","恢復");if(["queued","running","pausing","paused","cancelling"].includes(job.status))addAction("cancel","取消並刪除");if(["complete","error","cancelled"].includes(job.status))addAction("delete","刪除記錄與輸出");if(actions.children.length)details.append(actions);item.append(details);list.append(item);}};' +
    'const renderJobsWithRecovery=jobs=>{renderJobs(jobs);const resumable=["browser_client_disconnected","browser_client_offline","browser_command_timeout","browser_navigation_timeout","bridge_transport_failed","secure_transport_failed"];[...document.querySelector("#jobs").children].forEach((item,index)=>{const job=jobs[index];if(job?.status!=="error"||!resumable.includes(job.diagnostic))return;const details=item.querySelector("details");if(!details)return;const actions=document.createElement("p");const button=document.createElement("button");button.dataset.jobId=job.id;button.dataset.action="resume";button.textContent="恢復";actions.append(button);details.append(actions);});};' +
    'const render=data=>{renderBinding(data.binding||{});renderJobsWithRecovery(data.jobs||[]);};' +
    'async function refresh(){const r=await fetch("/api/state");if(!r.ok)throw new Error("state_http_"+r.status);const data=await r.json();const binding=data.binding||{};document.querySelector("#bridgeUrl").value=binding.bridgeUrl||"";document.querySelector("#callbackUrl").value=binding.callbackUrl||"";render({...data,binding});}' +
    'async function post(path,body){return fetch(path,{method:"POST",headers:{"content-type":"application/json","x-csrf-token":token},body:JSON.stringify(body)});}' +
    'document.querySelector("#saveConfig").onclick=async()=>{const r=await post("/api/config",{bridgeUrl:document.querySelector("#bridgeUrl").value,callbackUrl:document.querySelector("#callbackUrl").value,activeBindingId:document.querySelector("#bindingSelect").value});document.querySelector("#configStatus").textContent=r.ok?"設定已儲存":"設定失敗";await refresh();};' +
    'document.querySelector("#pair").onclick=async()=>{const r=await post("/api/bridge/pair",{code:document.querySelector("#pairCode").value,bridgeUrl:document.querySelector("#bridgeUrl").value,serviceClientId:browserServiceId});document.querySelector("#configStatus").textContent=r.ok?"Bridge 綁定成功":"Bridge 綁定失敗";await refresh();};' +
    'document.querySelector("#form").addEventListener("submit",async e=>{e.preventDefault();const r=await post("/api/jobs",{url:document.querySelector("#url").value,kind:document.querySelector("#kind").value,bindingId:document.querySelector("#jobBinding").value});document.querySelector("#status").textContent=r.ok?"已加入佇列":"加入失敗";await refresh();});' +
    'document.querySelector("#jobs").addEventListener("click",async e=>{const id=e.target.dataset.jobId;const action=e.target.dataset.action;if(!id||!action)return;if(action==="cancel"&&!confirm("取消後會刪除這個工作已下載的暫存檔，確定繼續嗎？"))return;if(action==="delete"&&!confirm("這會刪除工作記錄、已產生的 EPUB 與暫存檔，確定繼續嗎？"))return;await post("/api/jobs/"+encodeURIComponent(id)+"/"+action,{});await refresh();});' +
    'const events=new EventSource("/api/events");events.onmessage=e=>{const data=JSON.parse(e.data);render(data);};refresh();' +
    '</script></body></html>';
}

function renderHtml(token) {
  return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="csrf-token" content="' + escapeHtml(token) + '"><title>Web Content Fetch</title>' +
    '<link rel="stylesheet" href="ui.css"></head><body>' +
    '<main class="shell"><header class="hero"><div><p class="eyebrow">LOCAL CONTENT WORKSPACE</p><h1>內容下載任務</h1><p class="lede">小說整部輸出；漫畫逐章／逐卷完成就能下載。</p></div><div id="connection" class="connection" data-state="unknown">檢查 Bridge 中…</div></header>' +
    '<section class="panel settings"><div class="section-heading"><div><p class="eyebrow">CONNECTION</p><h2>Bridge 設定</h2></div><span class="section-note">配對碼只用於建立 binding</span></div>' +
    '<div class="settings-grid"><label>Bridge Server URL<input id="bridgeUrl" type="url"></label><label>Callback URL<input id="callbackUrl" type="url"></label></div>' +
    '<div class="settings-actions"><div class="binding-summary"><span>目前唯一 Bridge binding</span><strong id="bindingId">尚未綁定</strong></div><button id="saveConfig" class="button secondary">儲存設定</button><label>六碼綁定碼<input id="pairCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" size="8"></label><button id="pair" class="button secondary">重新綁定 Bridge</button></div><p id="binding" class="hint"></p><p id="browserServiceId" class="hint"></p><p id="configStatus" class="feedback"></p></section>' +
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
    try { body = await readJson(request); } catch { return sendJson(response, 400, { error: 'invalid_json' }); }
    const job = typeof body.jobId === 'string' ? jobs.get(body.jobId) : null;
    if (!callbackAllowed(request, job)) return sendJson(response, 403, { error: 'callback_forbidden' });
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
      const nextCallbackUrl = validateCallbackUrl(String(body.callbackUrl || ''));
      if (body.activeBindingId && !getBinding(config, String(body.activeBindingId))) {
        throw new Error('binding_not_found');
      }
      config.defaultBridgeUrl = nextBridgeUrl;
      const binding = getBinding(config, body.activeBindingId ? String(body.activeBindingId) : '');
      if (binding) {
        binding.bridgeUrl = nextBridgeUrl;
        config.activeBindingId = binding.bindingId;
      } else {
        config.activeBindingId = null;
      }
      config.callbackUrl = nextCallbackUrl;
      orchestrator.reconfigure(config);
      await saveConfig(config);
      return sendJson(response, 200, { binding: publicBinding(config) });
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

function validateCallbackUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || parsed.search || parsed.pathname !== '/api/bridge/callback') throw new Error('callback_url_invalid');
  if (isLoopbackHostname(parsed.hostname)) throw new Error('callback_url_must_be_reachable_from_bridge');
  const allowedHosts = String(process.env.WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS || 'host.docker.internal')
    .split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) throw new Error('callback_url_host_forbidden');
  return parsed.href;
}

function isLoopbackHostname(hostname) {
  const value = String(hostname).toLowerCase();
  return value === 'localhost' || value === 'ip6-localhost' || value === '0.0.0.0' || value === '::1' || value === '127.0.0.1' || value.startsWith('127.');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

server.listen(port, host, () => console.log(`web-content-fetch listening on http://${host}:${port}`));

for (const job of jobs.values()) if (job.status === 'queued') setImmediate(drain);
