const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { BridgeClient } = require('../bridge-client');
const { normalizeConfig } = require('../binding-store');
const { DownloadOrchestrator } = require('../job-orchestrator');

for (const code of ['content_reader_incomplete', 'content_reader_images_incomplete', 'content_reader_page_evidence_invalid']) {
  test(`exhausted ${code} retries pause the job and preserve its files`, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wcf-reader-recovery-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const bindingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const config = normalizeConfig({ bindings: [{ bindingId,
      bridgeUrl: 'http://bridge.test:8788',
      serviceClientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', serviceCredential: 'fixture',
      browserClientId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], activeBindingId: bindingId });
    const job = { id: 'reader-recovery', url: 'https://tw.manhuagui.com/comic/1/', kind: 'manga',
      status: 'queued', bindingId, outputs: ['previous.epub'], progress: { completed: 1, total: 2 } };
    const identities = [];
    t.mock.method(BridgeClient.prototype, 'operationServerInstance', async () => 'instance');
    t.mock.method(BridgeClient.prototype, 'createContentOperation', async (_body, operation) => {
      identities.push(operation.requestId);
      return { success: true, state: 'error', result: { success: false, code } };
    });
    const outputDir = path.join(root, 'output'), checkpointDir = path.join(root, 'checkpoint');
    await fs.mkdir(outputDir);
    await fs.mkdir(path.join(checkpointDir, job.id), { recursive: true });
    await fs.writeFile(path.join(outputDir, 'previous.epub'), 'previous-output');
    await fs.writeFile(path.join(checkpointDir, job.id, 'sentinel'), 'saved-checkpoint');
    const orchestrator = new DownloadOrchestrator({ jobs: new Map([[job.id, job]]), config,
      outputDir, checkpointDir, saveConfig: async () => {}, update: (value, change) => Object.assign(value, change) });
    await orchestrator.run(job);
    assert.equal(identities.length, 3);
    assert.equal(new Set(identities).size, 3);
    assert.equal(job.status, 'paused');
    assert.equal(job.diagnostic, code);
    assert.equal(job.progress.completed, 1);
    assert.deepEqual(job.outputs, ['previous.epub']);
    assert.equal(await fs.readFile(path.join(outputDir, 'previous.epub'), 'utf8'), 'previous-output');
    assert.equal(await fs.readFile(path.join(checkpointDir, job.id, 'sentinel'), 'utf8'), 'saved-checkpoint');
  });
}
