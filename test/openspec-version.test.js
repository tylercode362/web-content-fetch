const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('OpenSpec stays pinned in the isolated tools stage', () => {
  const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
  const [runtimeStages, toolsStage] = dockerfile.split('FROM base AS tools');
  assert.ok(toolsStage.includes('@fission-ai/openspec@1.14.3'));
  assert.equal(runtimeStages.includes('@fission-ai/openspec'), false);
});
