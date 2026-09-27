const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'Deploy-Nas-remote.sh'), 'utf8');

test('successful NAS deployment cleans only project-owned deployment artifacts', () => {
  const success = script.indexOf('rollback_needed=0', script.indexOf('wait_container_healthy'));
  const cleanup = script.indexOf('for cleanup_root in', success);

  assert.ok(success >= 0);
  assert.ok(cleanup > success);
  assert.match(script.slice(cleanup), /"\$remote_root\/\.staging" "\$remote_root\/\.backups"/);
  assert.match(script.slice(cleanup), /-name "\$project-\*"/);
});

test('failed NAS deployment retains staging and rollback source', () => {
  const rollback = script.slice(script.indexOf('rollback() {'), script.indexOf('trap on_exit EXIT'));

  assert.doesNotMatch(rollback, /for cleanup_root in/);
  assert.match(rollback, /runtime-source\.tar/);
  assert.match(rollback, /Staging retained/);
});
