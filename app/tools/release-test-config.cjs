'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
module.exports = function (root, { baseline = false, review = false, env = process.env } = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'app/package.json'), 'utf8')).version;
  const profile = review ? 'review' : env.BUILD_PROFILE || 'release';
  if (!['release', 'review', 'playtest'].includes(profile)) throw new Error('Invalid BUILD_PROFILE');
  const prefix = { release: 'app/dist-', review: 'app/dist-review-', playtest: 'app/dist-playtest-' }[profile];
  const output = '.local/builds/' + version + '/' + profile;
  const dist = path.resolve(root, env.RELEASE_DIST || (baseline ? '.local/rejected-0.3.0' : prefix + version));
  const manifest = path.resolve(root, env.RELEASE_MANIFEST || output + '/manifest.json');
  const buildRecord = path.resolve(root, env.RELEASE_BUILD_RECORD || output + '/' + profile + '-build-record.json');
  // Packaging moves entry files and rewrites HTML/CSS. Verify the actual layout
  // with its own receipt, never map ZIP hashes onto renamed dist files.
  const artifactKind = fs.existsSync(path.join(dist, 'main.js')) ? 'archive' : 'dist';
  const receipt = artifactKind === 'archive' ? manifest : buildRecord;
  const receiptBytes = fs.readFileSync(receipt);
  const candidate = JSON.parse(receiptBytes);
  assert.equal(candidate.profile, profile, 'Candidate receipt profile must match BUILD_PROFILE');
  assert.ok(Array.isArray(candidate.files) && candidate.files.length, 'Candidate build/manifest files inventory is required: ' + receipt);
  assert.ok(Array.isArray(candidate.sourceFiles), 'Candidate sourceFiles inventory is required: ' + receipt);
  const verify = () => {
    for (const file of candidate.files) assert.equal(sha(fs.readFileSync(path.join(dist, file.file))), file.sha256, 'Candidate bytes changed: ' + file.file);
    for (const file of candidate.sourceFiles) assert.equal(sha(fs.readFileSync(path.join(root, 'app', file.file))), file.sha256, 'Build/package before checks: ' + file.file);
  };
  const identity = { profile, artifactKind, receiptSha256: sha(receiptBytes), filesSha256: sha(JSON.stringify(candidate.files)), sourceFilesSha256: sha(JSON.stringify(candidate.sourceFiles)) };
  return { profile, version, dist, manifest, buildRecord, receipt, artifactKind, candidate, identity, verify,
    runtime: JSON.parse(fs.readFileSync(path.join(root, 'app/runtime-config.json'), 'utf8'))[profile],
    entryFile: name => artifactKind === 'archive' ? name : 'assets/' + name,
    qa: path.resolve(root, env.RELEASE_QA_OUT || '.local/checks/' + version + '/' + profile) };
};
