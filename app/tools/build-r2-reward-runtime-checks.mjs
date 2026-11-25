// Existing controlled Scene observer entry; normal main has no test exports.
import {build} from 'esbuild';
import {cpSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('R2 controlled UI check requires playtest');
const {buildOptions}=await import('./build.mjs');
const config=buildConfig(),out=path.resolve('../.local/checks/r2-rewards/runtime');
mkdirSync(out,{recursive:true});cpSync(config.dist,out,{recursive:true});
await build({...buildOptions,entryPoints:['tests/fixtures/progression-ui.ts'],outfile:path.join(out,'assets/main.js')});
console.log(JSON.stringify({fixture:out,scope:'CONTROLLED_SCENE_NOT_NORMAL_PLAYER_BUILD'}));
