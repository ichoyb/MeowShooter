import {build} from 'esbuild';
import {readdirSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';
import {checkImageBudget} from './image-budget-check.mjs';
import {runtimeImagePath} from '../src/runtime-image-path.cjs';
import g6BattleAssets from '../src/r1-art/g6-battle-paths.json' with {type:'json'};
import chapterScenes from '../src/ui/chapter-scenes.json' with {type:'json'};
const config=buildConfig();
const {buildOptions,adapted,versions,audioVendors}=await createBuildOptions(config);
export {buildOptions};
const sha=value=>createHash('sha256').update(value).digest('hex');
mkdirSync(config.dist+'/assets/ui',{recursive:true});
mkdirSync(config.qa,{recursive:true});
const result = await build(buildOptions);
if (!Object.keys(result.metafile.inputs).some(module => module.replaceAll('\\', '/').endsWith('/phaser/src/physics/arcade/ArcadePhysics.js'))) {
  throw new Error('ADR-0008 RULE-1: build must include the official ArcadePhysics module');
}
if(adapted.length!==5)throw new Error('Missing expected Phaser adaptations');
const retiredUI=['FIRE.svg','FROST.svg','SHOCK.svg','SUMMON.svg'];
function copyRuntimeAsset(source,destination=source){
  const encoded=runtimeImagePath(destination);
  if(encoded!==destination)rmSync(path.join(config.dist,destination),{force:true});
  copyFileSync(runtimeImagePath(source),path.join(config.dist,encoded));
}
// Remove explicit retired files from this controlled dist; skipping copy alone
// would leave a prior build's decoded sources in the package inventory.
if(config.courtyardEnabled)for(const file of ['assets/r1-restoration/orange-body.png','assets/r1-restoration/orange-parts.png','assets/r1-restoration/terrain/terrain-v01.png','assets/r1-restoration/terrain/props-v01.png','assets/r1-restoration/map/map-0-0.png','assets/r1-restoration/map/map-0-1.png','assets/r1-restoration/map/map-overscan.png','assets/r1-restoration/courtyard-detail-v01.png','assets/cat.png','assets/atlas.png','assets/first-combat/parts.png',...['body-0.png','body-1.png','weapon.png','grip.png','head.png'].map(name=>'assets/cat01-pilot/'+name),...retiredUI.map(name=>'assets/ui/'+name)])rmSync(path.join(config.dist,file),{force:true});
for(const name of readdirSync('assets/ui').filter(name=>!name.endsWith('.webp')&&(!config.courtyardEnabled||!retiredUI.includes(name))))copyRuntimeAsset('assets/ui/'+name);
// Replace the same decoded images in the courtyard preview; do not retain a
// second set of hero textures or change the release / review breed portraits.
if(config.courtyardEnabled){
  for(const id of ['CAT01','CAT02','CAT03'])copyRuntimeAsset('assets/r1-restoration/ui-'+id+'.png','assets/ui/'+id+'.png');
  // Reuse the one existing CSS-background slot. The clean plate is not a
  // Phaser source and is never copied into a second package runtime path.
  copyFileSync('assets/r1-restoration/entry-scene.jpeg',config.dist+'/assets/ui/garden.jpeg');
}
const html=readFileSync('index.html','utf8').replace('<html lang="zh-CN"',`<html lang="zh-CN" data-app-version="${config.version}" data-build-id="${sha(readFileSync(config.dist+'/assets/main.js')).slice(0,12)}"`).replace('data-build-profile="release"','data-build-profile="'+config.profile+'"').replace(' · 120秒体验',config.profile==='review'?' · UI评审版':config.profile==='playtest'?' · 三猫内部试玩':' · 120秒体验');
writeFileSync(config.dist+'/index.html',html);copyFileSync('style.css',config.dist+'/assets/style.css');
await build({entryPoints:['src/boot.js'],bundle:true,format:'iife',platform:'browser',target:['es2017','chrome61'],minify:true,outfile:config.dist+'/assets/boot.js'});
if(!config.courtyardEnabled)for (const name of ['cat.png', 'atlas.png']) copyRuntimeAsset('assets/'+name);
if(config.combatSliceEnabled){
  mkdirSync(config.dist+'/assets/first-combat',{recursive:true});
  for(const name of (config.courtyardEnabled?['bubble.png','b01-dust.png']:['parts.png','bubble.png','b01-dust.png']))copyRuntimeAsset('assets/first-combat/'+name);
}
if (config.profile === 'playtest') {
  if(!config.courtyardEnabled){
  mkdirSync(config.dist+'/assets/cat01-pilot', { recursive: true });
  for (const name of ['body-0.png', 'body-1.png', 'weapon.png', 'grip.png', 'head.png']) copyRuntimeAsset('assets/cat01-pilot/'+name);
  }
  mkdirSync(config.dist+'/assets/battle-feedback', { recursive: true });
  for (const name of ['bell-hit.png', 'ground.png']) copyRuntimeAsset('assets/battle-feedback/'+name);
}
if(config.courtyardEnabled){
  for(const name of ['enemies.png','held-weapons.png','native/courtyard-native-v01.png']){
    mkdirSync(path.dirname(config.dist+'/assets/r1-restoration/'+name),{recursive:true});
    copyRuntimeAsset('assets/r1-restoration/'+name);
  }
}
if(config.profile==='playtest'&&config.courtyardEnabled)for(const file of g6BattleAssets){
  const destination=path.join(config.dist,file);
  mkdirSync(path.dirname(destination),{recursive:true});
  copyRuntimeAsset(file);
}
if(config.profile==='playtest'&&config.combatSliceEnabled){
  const narrativeDestination=path.resolve(config.dist,'story');
  if(!narrativeDestination.startsWith(path.resolve(config.dist)+path.sep))throw Error('Unsafe chapter output');
  mkdirSync(narrativeDestination,{recursive:true});
  for(const file of Object.values(chapterScenes)){
    if(!/^story\/ch01-[a-z]+\.jpeg$/.test(file))throw Error('Invalid chapter package path: '+file);
    copyFileSync('assets/narrative/'+path.basename(file),path.join(config.dist,file));
  }
  // Remove only the obsolete copied derivative folder within this verified build.
  const retiredChapterOutput=path.resolve(config.dist,'assets/narrative');
  if(!retiredChapterOutput.startsWith(path.resolve(config.dist)+path.sep))throw Error('Unsafe retired chapter output');
  rmSync(retiredChapterOutput,{recursive:true,force:true});
}
const record = { profile:config.profile,version:config.version,outputRoot:config.dist,bootSha256:sha(readFileSync(config.dist+'/assets/boot.js')), atUtc: new Date().toISOString(), node: process.version, versions, renderer:'Phaser Canvas only', output:'classic IIFE, ES2017/Chrome61', modules:Object.keys(result.metafile.inputs), adapted, mainBytes:readFileSync(config.dist+'/assets/main.js').length, mainSha256:sha(readFileSync(config.dist+'/assets/main.js')), currentPlatformRulesVerified:false, platformRulesSource:'https://miniapp-sandbox.xiaohongshu.com/minitool/doc', platformRulesReadDate:null, platformRulesAttemptedAt:new Date().toISOString(), platformRulesResult:'TIMEOUT', platformRulesFallback:'Local skill snapshot 2026-09-23; current online rules unverified', platformAcceptance:'NOT_TESTED' };
record.courtyardEnabled=config.courtyardEnabled;
record.combatSliceEnabled=config.combatSliceEnabled;
record.imageBudget=checkImageBudget(config);
Object.assign(record,{currentPlatformRulesVerified:config.rules?.status==='READ_SUCCESS',platformRulesReadDate:config.rules?.recordDate||null,platformRulesAttemptedAt:config.rules?.recordDate||null,platformRulesResult:config.rules?.status||'NOT_ATTEMPTED',platformRulesFallback:config.rules?null:'Local skill snapshot; current online rules unverified',platformRulesEvidence:config.rules});
if(audioVendors)record.audio={sources:audioVendors.sources,derived:audioVendors.derived,mode:'native Phaser WebAudioSoundManager; base 13 FX + 3 music Sound and 12 AudioBuffer; current story adds 2 Sound/Buffer on demand and releases on exit; at most 8 FX + 2 music Source, or 2 exclusive story Source; lazy single context'};
function inventory(folder){
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?inventory(path.join(folder,entry.name)):[path.join(folder,entry.name)]);
}
const measuredFiles=files=>files.sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0).map(file=>({file:file.replaceAll('\\','/'),bytes:readFileSync(file).length,sha256:sha(readFileSync(file))}));
record.files=measuredFiles(inventory(config.dist)).map(entry=>({...entry,file:path.relative(config.dist,entry.file).replaceAll('\\','/')}));
record.sourceFiles=measuredFiles(['src','assets','tools','tests'].flatMap(inventory).concat(['index.html','style.css','package.json','package-lock.json','tsconfig.json','runtime-config.json','asset-budget.json','ASSET_SOURCES.json'])).map(({file,sha256})=>({file,sha256}));
for(const file of Object.keys(result.metafile.inputs).filter(file=>file.replaceAll('\\','/').startsWith('../assets/audio/'))){
  const normalized=file.replaceAll('\\','/');
  if(!record.sourceFiles.some(item=>item.file===normalized))record.sourceFiles.push({file:normalized,sha256:sha(readFileSync(file))});
}
record.sourceFiles.sort((a,b)=>a.file.localeCompare(b.file));
record.sourceInputSha256=sha(record.sourceFiles.map(entry=>entry.file+'\0'+entry.sha256+'\n').join(''));
// The visible short build ID covers actual source inputs, including runtime art.
if(config.profile==='playtest'){
 const entry=path.join(config.dist,'index.html');
 writeFileSync(entry,readFileSync(entry,'utf8').replace(/data-build-id="[^"]*"/,`data-build-id="${record.sourceInputSha256.slice(0,12)}"`));
 record.files=measuredFiles(inventory(config.dist)).map(item=>({...item,file:path.relative(config.dist,item.file).replaceAll('\\','/')}));
}
record.sourceBaseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
record.sourceBranch=execFileSync('git',['branch','--show-current'],{encoding:'utf8',windowsHide:true}).trim();
record.sourceDirty=!!execFileSync('git',['status','--porcelain','--untracked-files=all','--','.'],{encoding:'utf8',windowsHide:true}).trim();
writeFileSync(config.qa+'/'+config.profile+'-build-record.json', JSON.stringify(record,null,2) + '\n');
console.log(JSON.stringify({status:'BUILT', mainBytes:record.mainBytes, modules:record.modules.length, adapted:adapted.map(a=>a.module)}));
