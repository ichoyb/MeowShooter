import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {build} from 'esbuild';

test('production and fixtures share options without importing a build side effect', async () => {
  const source = new URL('../tools/build-options.mjs', import.meta.url);
  assert.ok(existsSync(source), 'fixture options must be a side-effect-free module');
  const {createBuildOptions} = await import(source.href);
  for (const profile of ['release', 'review', 'playtest']) {
    const dist = '../.local/checks/g8-build-options-' + profile;
    const {buildOptions, adapted, audioVendors} = await createBuildOptions({
      profile, dist, courtyardEnabled: profile === 'playtest', combatSliceEnabled: profile === 'playtest',
    });
    assert.equal(existsSync(dist), false, 'creating options must not build a dist');
    assert.equal(adapted.length, 0);
    assert.equal(buildOptions.define.__DEVTOOLS__, 'false');
    assert.equal(buildOptions.define.__BUILD_PROFILE__, JSON.stringify(profile));
    assert.equal(buildOptions.define.__COURTYARD_ENABLED__, String(profile === 'playtest'));
    assert.equal(buildOptions.define.__COMBAT_SLICE_ENABLED__, String(profile === 'playtest'));
    assert.equal(buildOptions.define.__TEST_INPUT_DIAGNOSTICS__, 'false', 'player builds must not collect input traces');
    assert.deepEqual(buildOptions.target, ['es2017', 'chrome61']);
    assert.equal(!!audioVendors, profile === 'playtest');
    const result = await build({...buildOptions, write: false});
    assert.ok(result.outputFiles[0].contents.length > 0);
    assert.equal(adapted.length, 5, 'fixtures must retain all five pinned Phaser adaptations');
    if (profile === 'playtest') assert.ok(result.metafile.inputs['src/audio/vendor/music/zzfxm.js']);
  }
});

test('only an explicit independent fixture enables input diagnostics', async () => {
  const {createBuildOptions} = await import('../tools/build-options.mjs');
  const config = {profile: 'playtest', dist: '../.local/checks/input-options-fixture', courtyardEnabled: true, combatSliceEnabled: true};
  for (const enabled of [false, true]) {
    const {buildOptions} = await createBuildOptions(config, {testInputDiagnostics: enabled});
    assert.equal(buildOptions.define.__TEST_INPUT_DIAGNOSTICS__, String(enabled));
    const result = await build({...buildOptions, entryPoints: undefined,
      stdin: {contents: 'globalThis.fixtureInputDiagnostics = __TEST_INPUT_DIAGNOSTICS__;', resolveDir: process.cwd()}, write: false});
    const target = {};
    new Function('globalThis', result.outputFiles[0].text)(target);
    assert.equal(target.fixtureInputDiagnostics, enabled);
  }
});
