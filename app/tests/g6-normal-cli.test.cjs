const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Check the actual runner's orchestration; the native browser suite separately
// verifies combat and elapsed time. These stubs do not prove a 600-second run.
const source = fs.readFileSync(path.join(__dirname, '../tools/g6-normal-browser-test.cjs'), 'utf8');
const file = ts.createSourceFile('runner.js', source, ts.ScriptTarget.Latest, true);
const normal = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'normal');
assert(normal, 'actual normal runner function must exist');

for (const cat of ['CAT01', 'CAT02', 'CAT03']) {
  test(`${cat} --full-run cannot bypass play/result checks without --g7`, async () => {
    let playCalls = 0;
    const observations = [];
    const page = {
      on() {},
      waitForResponse: async () => ({body: async () => Buffer.from('same')}),
      goto: async () => {},
      locator: () => ({getAttribute: async () => 'playtest'}),
      evaluate: async () => true,
      close: async () => {},
    };
    const snapshot = {
      weaponId: 'W01', weaponStats: {damage: 16},
      progression: {rulesVersion: 'fixture'}, durationSeconds: 600,
      level: {encounters: []}, catDisplay: {width: 36, height: 36},
      engine: {bodies: {cat: {radius: 12}}},
    };
    const context = {
      assert, Promise, Buffer, evidence: {errors: []}, url: 'http://local/',
      sha: () => 'same', wait: async () => {}, state: async () => ({}),
      start: async () => snapshot, walk: async () => ({}),
      pauseSettings: async () => ({}), restart: async () => ({}),
      play: async () => { playCalls++; return {elapsed: 600, result: 'timeout'}; },
      observe: (...args) => observations.push(args), fullRun: true, balanceG7: false,
    };
    vm.createContext(context);
    vm.runInContext(normal.getText(file) + ';this.normal = normal;', context);
    await context.normal({newPage: async () => page}, cat);
    assert.equal(playCalls, 1, 'full-run must not bypass play/result assertion');
    assert.ok(observations.some(([name]) => name.includes('through result')));
  });
}
