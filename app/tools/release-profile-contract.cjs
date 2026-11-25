'use strict';
const path = require('node:path'), vm = require('node:vm');
const { buildSync } = require('esbuild');
module.exports = function profileContract(config) {
  const app = path.resolve(__dirname, '..');
  const result = buildSync({ stdin: { contents: `
    import {COURTYARD} from './src/arena-layout';
    import {WORLD_WIDTH} from './src/battle-geometry';
    import {COMBAT_SLICE,COURTYARD_LEVEL,ENEMIES,courtyardRunConfig,courtyardBalanceRunConfig} from './src/level-config';
    import {makeRunConfig} from './src/combat-config';
    import {chapterNames} from './src/ui/chapter';
    export {COURTYARD,WORLD_WIDTH,COMBAT_SLICE,COURTYARD_LEVEL,ENEMIES,chapterNames};
    export const runs=Object.fromEntries(['CAT01','CAT02','CAT03'].map(cat=>{const run=makeRunConfig(cat,({CAT01:'W01',CAT02:'W04',CAT03:'W02'})[cat],'p2-basic');return [cat,{probe:run,courtyard:courtyardRunConfig(run),normal:courtyardBalanceRunConfig(run)}]}));
  `, resolveDir: app, sourcefile: 'profile-contract.ts' }, bundle: true, write: false, platform: 'node', format: 'cjs' });
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, sandbox);
  const values = JSON.parse(JSON.stringify(sandbox.module.exports));
  return { ...values, courtyard: config.runtime.courtyardEnabled, run: cat => values.runs[cat][config.runtime.combatSliceEnabled ? 'courtyard' : 'probe'], normalRun: cat => values.runs[cat][config.runtime.combatSliceEnabled ? 'normal' : 'probe'] };
};
