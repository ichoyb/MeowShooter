const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const configure = require('../tools/release-test-config.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const parent = path.resolve(__dirname, '../../.local/tmp');

function fixture() {
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'candidate-paths-'));
  const put = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); };
  put('app/package.json', JSON.stringify({ version: '1.2.3' }));
  put('app/runtime-config.json', JSON.stringify({ release: { courtyardEnabled: false, combatSliceEnabled: false } }));
  const distFiles = { 'index.html': '<link href="assets/style.css">', 'assets/boot.js': 'boot', 'assets/main.js': 'main', 'assets/style.css': 'url(ui/cat.png)' };
  const zipFiles = { 'index.html': '<link href="style.css">', 'boot.js': 'boot', 'main.js': 'main', 'style.css': 'url(assets/ui/cat.png)' };
  const records = files => Object.entries(files).map(([file, value]) => ({ file, sha256: sha(value) }));
  for (const [file, value] of Object.entries(distFiles)) put('app/dist-1.2.3/' + file, value);
  for (const [file, value] of Object.entries(zipFiles)) put('unpacked/' + file, value);
  put('.local/builds/1.2.3/release/release-build-record.json', JSON.stringify({ profile: 'release', files: records(distFiles), sourceFiles: [] }));
  put('.local/builds/1.2.3/release/manifest.json', JSON.stringify({ profile: 'release', sha256: 'archive-sha', files: records(zipFiles), sourceFiles: [] }));
  return { root, put };
}

test('dist verifies build-record paths and bytes independently of transformed ZIP entries', () => {
  const { root, put } = fixture();
  const config = configure(root, { env: { BUILD_PROFILE: 'release' } });
  assert.equal(config.artifactKind, 'dist');
  assert.equal(config.candidate.files.find(file => file.file.endsWith('style.css')).file, 'assets/style.css');
  assert.doesNotThrow(() => config.verify());
  put('app/dist-1.2.3/assets/style.css', 'changed dist CSS');
  assert.throws(() => config.verify(), /assets\/style.css/);
});

test('unpacked ZIP verifies manifest paths and transformed entry bytes', () => {
  const { root, put } = fixture();
  const config = configure(root, { env: { BUILD_PROFILE: 'release', RELEASE_DIST: 'unpacked' } });
  assert.equal(config.artifactKind, 'archive');
  assert.equal(config.entryFile('main.js'), 'main.js');
  assert.equal(config.candidate.sha256, 'archive-sha');
  assert.doesNotThrow(() => config.verify());
  put('unpacked/style.css', 'url(ui/cat.png)');
  assert.throws(() => config.verify(), /style.css/);
});

test('profile mismatch and missing build inventory cannot borrow ZIP hashes', () => {
  const { root, put } = fixture();
  put('.local/builds/1.2.3/release/release-build-record.json', JSON.stringify({ profile: 'release', mainSha256: sha('main') }));
  assert.throws(() => configure(root, { env: { BUILD_PROFILE: 'release' } }), /build.*files|inventory/i);
  put('.local/builds/1.2.3/release/release-build-record.json', JSON.stringify({ profile: 'playtest', files: [], sourceFiles: [] }));
  assert.throws(() => configure(root, { env: { BUILD_PROFILE: 'release' } }), /profile/i);
});
