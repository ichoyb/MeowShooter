import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

for (const profile of ['release', 'review', 'playtest']) {
  test(`${profile}: normal build configuration owns courtyard activation`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      'import {buildConfig} from "./tools/build-config.mjs";process.stdout.write(JSON.stringify(buildConfig()))'],
    {env: {...process.env, BUILD_PROFILE: profile}, encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).courtyardEnabled, profile === 'playtest');
    assert.equal(JSON.parse(result.stdout).combatSliceEnabled, profile === 'playtest');
  });
}

