import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';

if(process.env.BUILD_PROFILE!=='playtest')throw Error('Use BUILD_PROFILE=playtest');
const config=buildConfig(),normal=path.resolve(config.dist);
const out=path.resolve(process.env.IMPACT_PREVIEW_DIR||'../.local/checks/combat-impact-pilot-20261112/preview');
if(existsSync(path.join(out,'impact-build.json')))throw Error('Use a new output directory; preserve previous evidence');
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const main=path.join(normal,'assets/main.js'),style=path.join(normal,'assets/style.css');
const normalMainSHA256=sha(main),normalStyleSHA256=sha(style);
mkdirSync(out,{recursive:true});cpSync(normal,out,{recursive:true});cpSync(normal,path.join(out,'normal'),{recursive:true});
const {buildOptions,versions}=await createBuildOptions(config);
const entry='tests/fixtures/combat-impact-sample.ts',outfile=path.join(out,'assets/combat-impact-sample.js');
const result=await build({...buildOptions,entryPoints:[entry],outfile});
const inputs=Object.keys(result.metafile.inputs).map(n=>n.replaceAll('\\','/'));
if(!inputs.includes('src/battle.ts')||!inputs.includes('src/impact-presentation.ts'))throw Error('Actual Arena and approved impact module must be bundled');
writeFileSync(path.join(out,'index.html'),readFileSync('tests/fixtures/combat-impact-sample.html'));
writeFileSync(path.join(out,'assets/impact-sample.css'),readFileSync('tests/fixtures/combat-impact-sample.css'));
if(sha(main)!==normalMainSHA256||sha(style)!==normalStyleSHA256)throw Error('Normal preview changed');
const receipt={scope:'CONTROLLED_NATIVE_IMPACT_COMPARISON_NOT_PLAYER_ENTRY',atUtc:new Date().toISOString(),versions,
 normalMainSHA256,normalStyleSHA256,fixtureSHA256:sha(outfile),inputs,
 fixtureSourceSHA256:sha(entry),impactSourceSHA256:sha('src/impact-presentation.ts'),newRuntimeImages:0,
 normalDistRebuilt:false,normalGameRulesChanged:false,notTested:['Platform','Android','iOS','Chrome61','Phone FPS']};
writeFileSync(path.join(out,'impact-build.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({out,...receipt,inputs:inputs.length},null,2));
