// Synthetic boundary fixture: exercise the actual HTTP server and queue recovery
// without crypto transport, external sites, archive generation or image codecs.
const Module = require('node:module');
if (process.env.WCF_TEST_QUEUE_ONLY) {
  const http = require('node:http');
  const on = http.IncomingMessage.prototype.on;
  let waiting = 0;
  http.IncomingMessage.prototype.on = function(event, listener) {
    if (event === 'end' && this.method === 'POST' && this.url === '/api/jobs' && ++waiting === 2) console.log('WCF_TEST_BODIES_WAITING');
    return on.call(this, event, listener);
  };
}
if (process.env.WCF_TEST_STREAM_FAILURE) {
  const fs = require('node:fs');
  const {Readable} = require('node:stream');
  const original = fs.createReadStream;
  fs.createReadStream = function(filename, options) {
    if (String(filename).endsWith('fault.epub')) return new Readable({read() {this.destroy(Object.assign(new Error('synthetic read failure'), {code: process.env.WCF_TEST_STREAM_FAILURE}));}});
    return original.call(this, filename, options);
  };
}
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'jszip') return class { constructor() { throw Error('archive_not_in_fixture'); } };
  if (request === './bridge-client') return { BridgeClient: class { constructor() { if (!process.env.WCF_TEST_QUEUE_ONLY) throw Error('bridge_call_not_expected'); this.paired = false; } } };
  if (request === './epub-writer') return { cleanBookTitle: value => value };
  return load.call(this, request, parent, isMain);
};
