import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';

if(process.env.BUILD_PROFILE!=='playtest')throw Error('Use BUILD_PROFILE=playtest');
const config=buildConfig(),root=path.resolve(process.env.IMPACT_AUDIO_DIR||'../.local/checks/combat-impact-audio-20261112/candidate-v1');
if(existsSync(path.join(root,'audio-build.json')))throw Error('Choose a fresh IMPACT_AUDIO_DIR to preserve evidence');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const main=path.join(config.dist,'assets/main.js'),normalMainSHA256=sha(main);
const {buildOptions,versions,audioVendors}=await createBuildOptions(config);
const fixture=path.join(root,'fixture');mkdirSync(path.join(fixture,'assets'),{recursive:true});
const entry='tests/fixtures/impact-audio-audition.ts',outfile=path.join(fixture,'assets/impact-audio-audition.js');
const result=await build({...buildOptions,entryPoints:[entry],outfile});
const modules=Object.keys(result.metafile.inputs).map(p=>p.replaceAll('\\','/'));
if(modules.includes('src/main.ts')||modules.includes('src/battle.ts'))throw Error('Audio audition must not start actual combat');
copyFileSync('tests/fixtures/impact-audio-audition.html',path.join(fixture,'index.html'));
await build({entryPoints:['tests/fixtures/impact-audio-reference-entry.ts'],bundle:true,format:'esm',platform:'node',target:'node22',plugins:[audioVendors.plugin],outfile:path.join(root,'reference-api.mjs')});
const sourceFiles=[...new Set([...modules.filter(p=>!p.includes('node_modules/')),'tests/fixtures/impact-audio-audition.html','tools/build-impact-audio-audition.mjs','tools/render-impact-audio-references.mjs'])].sort();
const originalFiles=['src/audio/combat-data.mjs','src/audio/sound-data.mjs','src/audio/session.ts','src/audio/runtime.ts','src/audio/synthesis.mjs','src/audio/combat-synthesis.mjs','src/audio/courtyard-score.json','src/audio/boss-score.json','src/audio/vendor/current/ZzFX.js','src/audio/vendor/music/zzfx.js','src/audio/vendor/music/zzfxm.js'];
if(sha(main)!==normalMainSHA256)throw Error('Normal main was changed');
const receipt={scope:'INDEPENDENT_LISTEN_FIRST_NOT_ADOPTED_NOT_RELEASE',atUtc:new Date().toISOString(),node:process.version,versions,fixture,
 bundleSHA256:sha(outfile),htmlSHA256:sha(path.join(fixture,'index.html')),referenceAPISHA256:sha(path.join(root,'reference-api.mjs')),
 normalMainSHA256,normalDistRebuilt:false,newRuntimeImages:0,newRuntimeAudioFiles:0,
 sourceSHA256:Object.fromEntries(sourceFiles.map(p=>[p,sha(p)])),protectedAudioSHA256:Object.fromEntries(originalFiles.map(p=>[p,sha(p)])),
 vendors:audioVendors.sources,derivedVendors:audioVendors.derived,modules,deviceAcceptance:'NOT_TESTED',
 platformRules:{url:'https://miniapp-sandbox.xiaohongshu.com/minitool/doc',checkedOn:'2026-11-12',lastUpdated:'2026-11-10',newPlatformAPIsUsed:false},
 compatibility:'classic IIFE / ES2017 Chrome61 target; actual Chrome61 not tested'};
writeFileSync(path.join(root,'audio-build.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({root,fixture,bundleSHA256:receipt.bundleSHA256,normalMainSHA256,modules:modules.length}));
