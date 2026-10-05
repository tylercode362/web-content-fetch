const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const {spawn} = require('node:child_process');
const {once} = require('node:events');

async function fixture(t, jobs = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-review-'));
  const state = path.join(root, 'state'), output = path.join(root, 'output');
  await fs.mkdir(state); await fs.mkdir(output);
  for(const job of jobs) for(const name of job.outputs || []) await fs.writeFile(path.join(output,name),'synthetic output');
  await fs.writeFile(path.join(state, 'jobs.json'), JSON.stringify(jobs));
  const reserve = net.createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
  const child = spawn(process.execPath, ['--require', path.join(__dirname, 'fixtures/review-server-preload.cjs'), path.join(__dirname, '../server.js')], {
    env: {...process.env, WEB_CONTENT_FETCH_PORT: String(port), WEB_CONTENT_FETCH_BIND_HOST: '127.0.0.1', WEB_CONTENT_FETCH_STATE_DIR: state, WEB_CONTENT_FETCH_OUTPUT_DIR: output}, stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';child.stdout.on('data', b => {logs += b;});child.stderr.on('data', b => {logs += b;});
  t.after(async () => {if (child.exitCode === null && child.signalCode === null) {const stopped = once(child, 'exit'); child.kill(); await stopped;} await fs.rm(root, {recursive: true, force: true});});
  const request = rawPath => new Promise((resolve, reject) => {const req = http.get({hostname: '127.0.0.1', port, path: rawPath}, res => {const chunks=[];res.on('data', b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);});
  for(let n=0;n<100;n++){try{if((await request('/healthz')).status===200)return {request,output,state,child};}catch{}if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,20));}
  throw Error('server_start_timeout: '+logs);
}

test('WCF-01/02 actual HTTP serves Unicode filenames and survives malformed percent paths', async t => {
  const f = await fixture(t);
  for(const name of ['阿邦-chapter-0001.epub','日本語.epub','plain.epub']){
    await fs.writeFile(path.join(f.output,name),'synthetic epub');
    const r=await f.request('/downloads/'+encodeURIComponent(name));
    assert.equal(r.status,200);assert.equal(r.body.toString(),'synthetic epub');
    assert.equal(r.headers['content-disposition'],`attachment; filename="download.epub"; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  for(const suffix of ['%ZZ','%E0%A4','%0D%0Aevil','..%2Foutside.epub']){
    assert.equal((await f.request('/downloads/'+suffix)).status,400);
    assert.equal((await f.request('/healthz')).status,200);
  }
  assert.equal(f.child.exitCode,null);
});

test('WCF-03 restart keeps pause and completes pending cancel without browser fetching', async t => {
  const pausedId='11111111-1111-4111-8111-111111111111',cancelId='22222222-2222-4222-8222-222222222222';
  const f=await fixture(t,[{id:pausedId,status:'pausing',pauseRequested:true,outputs:[],progress:{}},{id:cancelId,status:'cancelling',cancelRequested:true,outputs:['cancel.epub'],progress:{}}]);
  let saved=[];for(let n=0;n<100;n++){saved=JSON.parse(await fs.readFile(path.join(f.state,'jobs.json'),'utf8'));if(saved.find(j=>j.id===cancelId)?.status==='cancelled')break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(saved.find(j=>j.id===pausedId).status,'paused');
  assert.equal(saved.find(j=>j.id===cancelId).status,'cancelled');
  await assert.rejects(fs.access(path.join(f.output,'cancel.epub')),{code:'ENOENT'});
  assert.equal((await f.request('/healthz')).status,200);
});

test('WCF-02 malformed percent encoding is rejected without terminating the HTTP process', async t => {
  const f=await fixture(t);
  assert.equal((await f.request('/downloads/%ZZ')).status,400);
  assert.equal((await f.request('/downloads/%E0%A4')).status,400);
  assert.equal((await f.request('/healthz')).status,200);
  assert.equal(f.child.exitCode,null);
});
