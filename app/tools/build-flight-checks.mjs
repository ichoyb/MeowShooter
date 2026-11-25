import {build} from 'esbuild';
import {cpSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('Flight checks require playtest');
const {buildOptions}=await import('./build.mjs');
const root=path.resolve(process.env.FLIGHT_CHECK_DIR||'../.local/checks/g4-2b-flight-20261028'),fixture=path.join(root,'scene-dist');
mkdirSync(fixture,{recursive:true});cpSync(buildConfig().dist,fixture,{recursive:true});
for(const name of ['flight','rhythm','projectile-traits']){
 await build({...buildOptions,entryPoints:['tests/fixtures/'+name+'-checks.ts'],outfile:path.join(fixture,'assets/'+name+'-checks.js')});
 writeFileSync(path.join(fixture,name+'-checks.html'),'<!doctype html><html><head><meta charset="utf-8"><script defer src="./assets/'+name+'-checks.js"></script></head><body style="margin:0"><div id="stage" style="position:relative;width:390px;height:844px"></div></body></html>');
}
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(path.join(root,'flight-build.json'),JSON.stringify({scope:'LOCAL_CONTROLLED_SCENE_NOT_RELEASE',fixture,normalMainSHA256:sha(path.join(fixture,'assets/main.js')),checksSHA256:Object.fromEntries(['flight','rhythm','projectile-traits'].map(name=>[name,sha(path.join(fixture,'assets/'+name+'-checks.js'))]))},null,2)+'\n');
console.log(fixture);
