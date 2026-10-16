// Node 24 built-ins + CDP native input; page evaluation only observes the DOM.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const target = process.env.UI_URL;
const control = process.env.UI_CONTROL_URL;
if (!target || !control || !process.env.CHROME_PATH) throw Error('Explicit isolated UI URLs and Chromium required');
let browser, socket, sequence = 0;
const pending = new Map(), pageErrors = [];
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(150); }
  throw Error('UI wait timeout: ' + label);
}
async function observe(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw Error('DOM observation failed');
  return r.result.value;
}
const stats = () => fetch(control + '/stats').then(r => r.json());
async function click(selector, touch, attempt = 0) {
  assert.ok(attempt < 8, 'native scroll must reach target: ' + selector);
  const box = await until(() => observe(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled) return null;
    const r = e.getBoundingClientRect(); return r.width && r.height ? { x:r.x+r.width/2,y:r.y+r.height/2,height:innerHeight } : null;
  })()`), selector);
  if (box.y > box.height - 30 || box.y < 30) {
    if (touch) {
      const start = box.y < 30 ? 300 : box.height - 150;
      const end = box.y < 30 ? box.height - 150 : 300;
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: start }] });
      for (let i = 1; i <= 12; i++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400, y: start + (end - start) * i / 12 }] });
        await delay(20);
      }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await delay(250);
    } else await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 600, deltaX: 0, deltaY: box.y < 30 ? -500 : 500 });
    return click(selector, touch, attempt + 1);
  }
  delete box.height;
  if (touch) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...box, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...box, button: 'left', clickCount: 1 });
  }
}
async function rendered(id, status) {
  await until(() => observe(`document.querySelector('details[data-job-id="${id}"] .badge')?.textContent === ${JSON.stringify(status)}`), 'rendered ' + status);
}
async function scenario(touch, serial) {
  await send('Emulation.setDeviceMetricsOverride', { width: touch ? 820 : 1280, height: touch ? 1180 : 900, deviceScaleFactor: 1, mobile: touch });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch });
  await send('Page.navigate', { url: target });
  await until(() => observe('document.readyState === "complete" && !!document.querySelector("#url")'), 'formal UI loaded');
  const before = await stats();
  await click('#url', touch);
  await send('Input.insertText', { text: 'https://m.manhuagui.com/comic/' + serial + '/' });
  assert.equal(await observe('document.querySelector("#url").value'), 'https://m.manhuagui.com/comic/' + serial + '/');
  if (touch) await click('#form .primary', true);
  else {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  }
  const started = await until(async () => { const s = await stats(); return s.runs === before.runs + 1 && s.jobs.find(j => !before.jobs.some(old => old.id === j.id) && j.requestId) && s; }, 'real Bridge execution').catch(async e => {
    console.error(await observe('JSON.stringify({feedback:document.querySelector("#status")?.textContent,ready:document.readyState,focused:document.activeElement?.id})'));
    throw e;
  });
  const job = started.jobs.find(j => !before.jobs.some(old => old.id === j.id));
  await rendered(job.id, '執行中');
  const action = name => `button[data-job-id="${job.id}"][data-action="${name}"]`;
  await click(`details[data-job-id="${job.id}"] > summary`, touch);
  await click(action('pause'), touch);
  await rendered(job.id, '已暫停');
  assert.equal((await stats()).releases, before.releases);
  await click(action('resume'), touch);
  await rendered(job.id, '執行中');
  const resumed = await stats();
  assert.equal(resumed.runs, started.runs, 'resume must not recreate operation');
  assert.equal(resumed.jobs.find(j => j.id === job.id).requestId, job.requestId);
  await click(action('cancel'), touch);
  await rendered(job.id, '取消中');
  assert.equal((await stats()).releases, before.releases, 'held remote release');
  await fetch(control + '/release', { method: 'POST' });
  await rendered(job.id, '已取消');
  const ended = await stats();
  assert.equal(ended.runs, started.runs); assert.equal(ended.releases, before.releases + 1);
  await send('Page.reload');
  await rendered(job.id, '已取消');
  assert.equal((await stats()).runs, started.runs);
  console.log('PASS native ' + (touch ? 'tablet touch' : 'desktop keyboard/mouse') + ': create/pause/resume/cancel, release barrier and reload/SSE reconnect');
}
async function main() {
  browser = spawn(process.env.CHROME_PATH, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--remote-debugging-port=9222', '--user-data-dir=/tmp/native-ui-profile'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const tab = await until(async () => {
    try { const r = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }); return r.ok && await r.json(); } catch { return false; }
  }, 'sandboxed Chromium CDP', 45000);
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data), entry = pending.get(message.id);
    if (entry) { clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) console.error('HTTP', message.params.response.status, new URL(message.params.response.url).pathname);
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await scenario(false, 1); await scenario(true, 2);
  assert.deepEqual(pageErrors, []);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  browser?.kill('SIGTERM');
});
