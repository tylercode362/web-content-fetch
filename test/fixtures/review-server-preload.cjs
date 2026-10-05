// Synthetic boundary fixture: exercise the actual HTTP server and queue recovery
// without crypto transport, external sites, archive generation or image codecs.
const Module = require('node:module');
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'jszip') return class { constructor() { throw Error('archive_not_in_fixture'); } };
  if (request === './bridge-client') return { BridgeClient: class { constructor() { throw Error('bridge_call_not_expected'); } } };
  if (request === './epub-writer') return { cleanBookTitle: value => value };
  return load.call(this, request, parent, isMain);
};
