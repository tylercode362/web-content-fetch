const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

for (const [status, message] of [
  ['cancelling', '取消請求已送出，等待工作取消與檔案清理完成'],
  ['cancelled', '工作已取消，相關檔案已清除'],
  ['complete', '取消尚未確認，請查看工作狀態']
]) {
  test('cancel click reports the API job status ' + status, async () => {
    const source = await fs.readFile(path.join(__dirname, '..', 'ui.js'), 'utf8');
    const start = source.indexOf("document.querySelector('#jobs').addEventListener('click'");
    const end = source.indexOf('const events = new EventSource', start);
    assert.ok(start >= 0 && end > start);
    let listener, refreshed = 0;
    const feedback = [];
    const pendingActions = new Set();
    const button = { dataset: { action: 'cancel', jobId: 'fixture-job' } };
    vm.runInNewContext(source.slice(start, end), {
      document: { querySelector: () => ({ addEventListener: (_event, callback) => { listener = callback; } }) },
      confirm: () => true,
      pendingActions,
      post: async url => {
        assert.equal(url, '/api/jobs/fixture-job/cancel');
        return { job: { id: 'fixture-job', status } };
      },
      responsePayload: async payload => payload,
      setFeedback: (_selector, text) => feedback.push(text),
      refresh: async () => { refreshed += 1; }
    });
    await listener({ target: { closest: () => button } });
    assert.equal(feedback.at(-1), message);
    assert.equal(refreshed, 1);
    assert.equal(pendingActions.size, 0);
  });
}
