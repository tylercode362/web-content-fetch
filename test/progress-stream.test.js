const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createProgressStream } = require('../progress-stream');
function response() { const r = new EventEmitter(); r.writes=[];r.accept=true;r.destroyed=false;r.write=b=>{r.writes.push(b);return r.accept};r.destroy=()=>{r.destroyed=true;r.emit('close')};return r; }
test('slow SSE client holds only the latest complete snapshot until drain',()=>{
 const r=response();r.accept=false;let closed=0;const send=createProgressStream(r,()=>closed++);
 send('initial');for(let n=0;n<1000;n++)send(`snapshot-${n}`);assert.deepEqual(r.writes,['initial']);r.accept=true;r.emit('drain');assert.deepEqual(r.writes,['initial','snapshot-999']);r.emit('close');assert.equal(closed,1);assert.equal(r.listenerCount('drain'),0);send('late');assert.equal(r.writes.length,2);
});
test('SSE write errors close the subscriber without escaping into the publisher',()=>{
 const r=response();r.write=()=>{throw Error('closed')};let closed=0;const send=createProgressStream(r,()=>closed++);assert.doesNotThrow(()=>send('state'));assert.equal(closed,1);assert.equal(r.destroyed,true);
});
test('SSE stalled socket expires and cleans all listeners',async()=>{
 const r=response();r.accept=false;let closed=0;const send=createProgressStream(r,()=>closed++,10);send('state');await new Promise(resolve=>setTimeout(resolve,30));assert.equal(r.destroyed,true);assert.equal(closed,1);assert.equal(r.listenerCount('drain'),0);
});
