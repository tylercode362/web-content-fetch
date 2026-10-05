const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
require.cache[require.resolve('../bridge-client')] = {exports:{BridgeClient:class {}}};
require.cache[require.resolve('../epub-writer')] = {exports:{cleanBookTitle:v=>v,writeNovelEpub:async()=>{},writeMangaChapterEpub:async()=>{}}};
const {DownloadOrchestrator} = require('../job-orchestrator');
test('WCF50-05 partial publication retains ownership for explicit cleanup', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'wcf-publication-'));
 const stage = path.join(root,'stage');
 const output = path.join(root,'output');
 await fs.mkdir(stage); await fs.mkdir(output);
 const first=path.join(stage,'book.epub'), second=path.join(stage,'book.kepub.epub');
 await fs.writeFile(first,'synthetic epub'); await fs.writeFile(second,'synthetic kepub');
 const job={id:'synthetic',outputs:[],outputGroups:[]};
 const o=new DownloadOrchestrator({jobs:new Map(),update:(j,v)=>Object.assign(j,v),config:{},outputDir:output});
 o.ensureStage=async()=>stage;
 const rename=fs.rename;
 fs.rename=async(from,to)=>{if(from===second){const e=new Error('injected second rename failure');e.code='EIO';throw e;}return rename(from,to);};
 try {
  await assert.rejects(o.publishOutputs(job,[first,second]),{code:'EIO'});
  assert.deepEqual(job.outputs,['book.epub']);
  assert.equal(await fs.readFile(path.join(output,'book.epub'),'utf8'),'synthetic epub');
  await o.removePublishedOutputs(job);
  assert.deepEqual(await fs.readdir(output),[]);
  assert.equal(await fs.readFile(second,'utf8'),'synthetic kepub');
 } finally {fs.rename=rename;await fs.rm(root,{recursive:true,force:true});}
});
