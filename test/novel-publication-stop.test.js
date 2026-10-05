const test = require('node:test');
const assert = require('node:assert/strict');
// External transport and book generation are synthetic; the real orchestrator runs.
require.cache[require.resolve('../bridge-client')] = {exports:{BridgeClient:class {constructor(){this.paired=true;} cancelContentFetch(){return Promise.resolve();}}}};
require.cache[require.resolve('../epub-writer')] = {exports:{cleanBookTitle:value=>value,writeNovelEpub:async()=>({files:['synthetic-stage.epub']})}};
const {DownloadOrchestrator} = require('../job-orchestrator');

for(const point of ['publish','cleanup']) for(const action of ['cancel','pause']) {
 test(`WCF50-03 ${action} during final ${point} preserves stop intent`,async()=>{
  const bindingId='11111111-1111-4111-8111-111111111111';
  const binding={bindingId,serviceClientId:bindingId,browserClientId:bindingId,serviceCredential:'synthetic-test-value'};
  const job={id:'synthetic-novel',bindingId,kind:'novel',url:'https://tw.linovelib.com/novel/1.html',status:'queued',outputs:[],progress:{}};
  let enter,release;const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r),removed=[];let cleanupCount=0;
  const o=new DownloadOrchestrator({jobs:new Map([[job.id,job]]),update:(j,v)=>Object.assign(j,v),config:{bindings:[binding],activeBindingId:bindingId},outputDir:'/synthetic-unused'});
  o.readJobManifest=async()=>({title:'Synthetic',chapters:[{url:'https://tw.linovelib.com/novel/1/1.html'}]});
  o.ensureStage=async()=>'/synthetic-unused';
  o.readChapterCheckpoint=async()=>({contentHtml:'<p>Synthetic</p>'});
  o.publishOutputs=async()=>{if(point==='publish'){enter();await barrier;}return ['published.epub'];};
  o.removeJobFiles=async()=>{if(point==='cleanup'&&cleanupCount++===0){enter();await barrier;}};
  o.removePublishedOutputs=async()=>removed.push(...job.outputs);
  const running=o.run(job);await entered;
  if(action==='cancel')await o.cancel(job.id);else o.pause(job.id);
  release();await running;
  assert.equal(job.status,action==='cancel'?'cancelled':'paused');
  if(action==='cancel'){assert.deepEqual(removed,['published.epub']);assert.deepEqual(job.outputs,[]);}
  else assert.deepEqual(job.outputs,['published.epub']);
 });
}

for (const action of ['cancel', 'pause']) {
 test(`WCF50-03 manga ${action} during final cleanup preserves stop intent`, async () => {
  const bindingId = '11111111-1111-4111-8111-111111111111';
  const binding = {bindingId, serviceClientId:bindingId, browserClientId:bindingId, serviceCredential:'synthetic-test-value'};
  const job = {id:'synthetic-manga', bindingId, kind:'manga', url:'https://www.comicabc.com/1', status:'queued', outputs:['chapter.epub'], progress:{}};
  let enter, release;
  const entered = new Promise(resolve => {enter=resolve;});
  const barrier = new Promise(resolve => {release=resolve;});
  let cleanupCount = 0;
  const removed = [];
  const o = new DownloadOrchestrator({jobs:new Map([[job.id,job]]), update:(j,v)=>Object.assign(j,v), config:{bindings:[binding],activeBindingId:bindingId}, outputDir:'/synthetic-unused'});
  o.ensureStage = async () => '/synthetic-unused';
  o.readJobManifest = async () => ({title:'Synthetic',chapters:[{url:'https://www.comicabc.com/1/1'}]});
  o.readChapterCheckpoint = async () => ({title:'Chapter',files:['chapter.epub']});
  o.existingPublishedFiles = async () => ['chapter.epub'];
  o.recordMangaOutput = async () => {};
  o.removeJobFiles = async () => {if(cleanupCount++===0){enter();await barrier;}};
  o.removePublishedOutputs = async () => removed.push(...job.outputs);
  const running = o.run(job);
  await entered;
  if(action==='cancel') await o.cancel(job.id); else o.pause(job.id);
  release();
  await running;
  assert.equal(job.status, action==='cancel'?'cancelled':'paused');
  if(action==='cancel') assert.deepEqual(removed,['chapter.epub']);
 });
}
