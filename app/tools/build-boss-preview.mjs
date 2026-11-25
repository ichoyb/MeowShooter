// Compile a development encounter with the real battle module; no source rewriting.
import {build} from 'esbuild';
import {cpSync,mkdirSync,copyFileSync} from 'node:fs';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('Boss preview requires playtest');
const {buildOptions}=await import('./build.mjs'),config=buildConfig();
const root=path.resolve('../.local/previews/boss-presence-v01'),out=path.join(root,'combat'),src=path.resolve('../assets/art/courtyard-enemies/boss-presence/combat-v01');
mkdirSync(out,{recursive:true});cpSync(config.dist,out,{recursive:true});
await build({...buildOptions,entryPoints:['tests/fixtures/boss-presence-preview.ts'],outfile:path.join(out,'assets/boss-preview.js')});
copyFileSync(path.join(src,'index.html'),path.join(out,'index.html'));copyFileSync(path.join(src,'review.css'),path.join(out,'assets/boss-preview.css'));
cpSync(config.dist,path.join(root,'game'),{recursive:true});
console.log(JSON.stringify({preview:'http://127.0.0.1:8877/combat/',game:'http://127.0.0.1:8877/game/',scope:'DEVELOPMENT_ENCOUNTER_NOT_PACKAGED'}));
