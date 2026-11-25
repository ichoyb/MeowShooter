import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('G5 combat audio fixture requires playtest');
const root=path.resolve(process.env.G5_COMBAT_AUDIO_DIR||'../.local/checks/g5-audio-integration-20261105/green-v01');
if(existsSync(root))throw Error('Choose a new evidence output; existing build preserved');
const {buildOptions}=await import('./build.mjs'),config=buildConfig(),normal=path.join(root,'normal'),fixture=path.join(root,'fixture');
for(const out of [normal,fixture]){mkdirSync(out,{recursive:true});cpSync(config.dist,out,{recursive:true});}
const result=await build({...buildOptions,entryPoints:['tests/fixtures/g5-combat-audio-checks.ts'],outfile:path.join(fixture,'assets/g5-combat-audio-checks.js')});
writeFileSync(path.join(fixture,'audio-checks.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><script defer src="./assets/g5-combat-audio-checks.js"></script><body style="margin:0"><div id="stage" style="position:relative;width:390px;height:844px"></div></body></html>');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const sources=['src/audio/combat-data.mjs','src/audio/combat-synthesis.mjs','src/audio/runtime.ts','src/audio/session.ts','src/battle.ts','tests/fixtures/g5-combat-audio-checks.ts','tools/build-g5-combat-audio-checks.mjs','tools/g5-combat-audio-native-test.cjs'];
writeFileSync(path.join(root,'audio-build.json'),JSON.stringify({scope:'LOCAL_ACTUAL_COMBAT_AUDIO_NOT_RELEASE',at:new Date().toISOString(),normal,fixture,normalMainSHA256:sha(path.join(normal,'assets/main.js')),checksSHA256:sha(path.join(fixture,'assets/g5-combat-audio-checks.js')),sourceSHA256:Object.fromEntries(sources.map(p=>[p,sha(p)])),fixtureModules:Object.keys(result.metafile.inputs),normalMainReplaced:false,newRuntimeImages:0,node:process.version},null,2));
console.log(JSON.stringify({root,normal,fixture}));
