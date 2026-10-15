const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const context = { URL };
vm.runInNewContext(source.slice(source.indexOf('function supported('), source.indexOf('function drain(')), context);

test('accepts tw and mobile work URLs without accepting unrelated hosts or chapters', () => {
  for (const url of ['https://tw.manhuagui.com/comic/61792/', 'https://tw.manhuagui.com/comic/61792', 'https://m.manhuagui.com/comic/61792/']) {
    assert.equal(context.supported(url), 'manga');
  }
  for (const url of ['https://evil.tw.manhuagui.com/comic/61792/', 'https://tw.manhuagui.com.evil.test/comic/61792/', 'https://tw.manhuagui.com/comic/61792/913697.html', 'https://tw.manhuagui.com/comic/nope/']) {
    assert.equal(context.supported(url), null);
  }
});
