// P4 local QA only: standalone actual-Arena entry, never part of main.
import {build} from 'esbuild';
import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('BUILD_PROFILE=playtest required');
const out=path.resolve(process.env.NORMAL50_SCENE_DIR||'../.local/checks/normal50-admission-20261105/scene');
if(!out.endsWith(path.normalize('normal50-admission-20261105/scene')))throw Error('Use this run-specific scene output only');
mkdirSync(out,{recursive:true});
const rulesFile=path.join(out,'normal50-rules.mjs');
await build({define:{__DEVTOOLS__:'false'},stdin:{contents:"export * from './src/progression'; export * from './src/combat-config'; export * from './src/level-config'; export * from './src/progression-capacity';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node22',outfile:rulesFile});
const R=await import(pathToFileURL(rulesFile)),zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const sum=r=>Object.values(r).reduce((a,b)=>a+b,0),baseFor=cat=>R.normalCourtyardRunConfig(R.makeRunConfig(cat,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic'));
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let x=Math.imul(seed^seed>>>15,1|seed);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
const witnesses=[],samePoolProofs=[],capacityInvariance=[];
for(const cat of ['CAT01','CAT02','CAT03'])for(const pair of [['R04','R06'],['R05','R07']]){
 const base=baseFor(cat),desired=['C21','C13','C12','M10',...pair];let found;
 for(let seed=1;seed<=10000&&!found;seed++){
  const g=new R.RunGrowth(1,rng(seed),base),picks=[];
  for(let n=0;n<36;n++){
   const s=g.snapshot();g.collect(Math.ceil((s.nextXP-s.xp)/2)*2);const o=g.snapshot().offer;
   const id=desired.find(id=>o.choices.includes(id)&&!g.snapshot().ranks[id])||o.choices.find(id=>['L1_DAMAGE','L1_RATE','L1_HEART','L1_MOVE','L1_RANGE','L1_RELOAD'].includes(id))||o.choices.find(id=>!id.startsWith('R'));
   if(!id||!g.confirm(1,o.id,id))break;picks.push(id);
   if(desired.every(id=>g.snapshot().ranks[id])){found={cat,pair,seed,picks};break;}
  }
 }
 assert(found,cat+' '+pair+' needs <=36 legal offered choices');
 // Replay the exact RNG with the two chosen R cards paid by actual elites.
 // Candidate construction is shared; neither XP level nor source changes it.
 const g=new R.RunGrowth(1,rng(found.seed),base);found.steps=[];let elites=0;
 for(const id of found.picks){const s=g.snapshot(),source=pair.includes(id)?'elite':'experience';let amount=0;
  if(source==='elite')assert(g.queueElite('EL01-'+(++elites),elites));else {amount=Math.ceil((s.nextXP-s.xp)/2)*2;g.collect(amount);}
  g.openOffer();const offer=g.snapshot().offer;assert(offer.choices.includes(id));assert(R.growthCardEligible(id,s.ranks,base,s.confirmedPicks));assert.equal(offer.source,source);
  found.steps.push({id,source,amount,offer:{id:offer.id,choices:offer.choices,source},confirmedBefore:s.confirmedPicks});assert(g.confirm(1,offer.id,id));
 }
 assert.equal(elites,2);found.final=g.snapshot();found.scope='FIXED_RNG_LEGAL_OFFER_WITNESS_NOT_NATURAL_FORMATION_RATE';witnesses.push(found);
 for(const wanted of ['C21','M10',...pair]){
  const twin=new R.RunGrowth(1,rng(found.seed),base);
  for(const [index,pick]of found.steps.entries()){
   const state=twin.snapshot();if(pick.id===wanted){assert(twin.queueElite('same-pool',1));twin.openOffer();}else twin.collect(Math.ceil((state.nextXP-state.xp)/2)*2);
   const offer=twin.snapshot().offer;assert.deepEqual(offer.choices,pick.offer.choices);assert(offer.choices.includes(pick.id));
   if(pick.id===wanted){assert.equal(offer.source,'elite');samePoolProofs.push({cat,pair,seed:found.seed,wanted,pick:index+1,choices:offer.choices,scope:'PURE_RULE_IDENTICAL_RNG_XP_ELITE_POOL_PROOF_NOT_ACTUAL_DEATH'});break;}
   assert(twin.confirm(1,offer.id,pick.id));
  }
 }
}
const capacityFile=path.resolve('../.local/checks/g4d-normal-pool-20261104/capacity/capacity-search.json'),capacity=JSON.parse(readFileSync(capacityFile,'utf8'));assert.equal(capacity.status,'PASS');
const scenarios=[];
for(const row of capacity.rows.filter(r=>r.flight)){
 scenarios.push({id:'retained-maximum36',cat:row.cat,before:row.maxRanks36});
 scenarios.push({id:'retained-maximum47-diagnostic',cat:row.cat,before:row.maxRanks47,diagnostic:true});
 for(const [budget,ranks]of [[36,row.maxRanks36],[47,row.maxRanks47]]){const base=baseFor(row.cat),actual={...zero,...ranks},cap=R.projectileCapacityForGrowth(base,R.deriveGrowthConfig(base,actual),actual);assert.equal(cap,row['maximum'+budget+'Observed']);capacityInvariance.push({cat:row.cat,budget,retainedCapacity:cap});}
 const mixed={L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,C23:1,M31:1,E21:1,L1_PIERCE:1,M05:1,E23:1,M12:1,C15:1,C16:1,E16:1,L1_TRAIL_BELL:1,L1_DUO_TRAIL_CADENCE:1,L1_ORBIT_BELL:3,A07:1,A08:1,A10:1,C12:1,C13:1,E14:1,A16:2,L1_RATE:2,L1_RANGE:1,L1_RELOAD:1};
 scenarios.push({id:'retained-native-long-short-rhythm-dual-companions',cat:row.cat,crowded:true,before:mixed,after:{...mixed,A15:1}});
 for(const pair of [['R04','R06'],['R05','R07']]){
  const added={...mixed,C21:1,M10:1,[pair[0]]:1,[pair[1]]:1};
  // Spend the same legal budget on the four new cards, preserving the full
  // native source mix and both companions rather than increasing the budget.
  for(const id of ['A08','A10'])if(sum(added)>35)delete added[id];
  assert(sum(added)<=35);scenarios.push({id:'normal50-native-'+pair.join('-'),cat:row.cat,crowded:true,before:added,after:{...added,A15:1}});
 }
}
for(const c of scenarios){c.legalRankPaths=[];for(const ranks of [c.before,c.after].filter(Boolean)){
 assert(sum(ranks)<=(c.diagnostic?47:36));const actual={...zero},base=baseFor(c.cat),route=[];
 while(Object.entries(ranks).some(([id,n])=>(actual[id]||0)<n)){
  const id=Object.keys(ranks).find(id=>(actual[id]||0)<ranks[id]&&R.growthCardEligible(id,actual,base,route.length));assert(id,'Legal path with actual pick count: '+c.id);actual[id]=(actual[id]||0)+1;route.push(id);
 }c.legalRankPaths.push(route);
 if(ranks.C21){const old={...actual};for(const id of ['C21','M10','R04','R05','R06','R07'])delete old[id];
  const current=R.deriveGrowthConfig(base,actual),prior=R.deriveGrowthConfig(base,old),cap=R.projectileCapacityForGrowth(base,current,actual),priorCap=R.projectileCapacityForGrowth(base,prior,old);assert.equal(cap,priorCap);
  const fields=['pellets','spreadDegrees','extraPierce','pierceDamageMultiplier','targetRange','bulletSpeed','bulletLifeSeconds','ammoCapacity','reloadSeconds','intervalSeconds'];for(const key of fields)assert.equal(current.weapon[key],prior.weapon[key]);assert.equal(R.companionFrequency(actual),R.companionFrequency(old));
  capacityInvariance.push({id:c.id,cat:c.cat,investments:route.length,cap,priorCap,unchangedWeaponFields:fields,companionFrequency:R.companionFrequency(actual)});
 }
}}
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
writeFileSync(path.join(out,'scene-inputs.json'),JSON.stringify({status:'PASS',scope:'CONTROLLED_QA_NOT_RELEASE',witnesses,samePoolProofs,capacityInvariance,scenarios,priorCapacity:{file:capacityFile,sha256:sha(capacityFile)},rulesSHA256:sha(rulesFile)},null,2)+'\n');
const {buildOptions}=await import('./build.mjs'),dist=path.join(out,'scene-dist');mkdirSync(dist,{recursive:true});cpSync(path.dirname(path.dirname(buildOptions.outfile)),dist,{recursive:true});
await build({define:{__DEVTOOLS__:'false'},...buildOptions,entryPoints:['tests/fixtures/normal50-admission-checks.ts'],outfile:path.join(dist,'assets/normal50-admission-checks.js')});
writeFileSync(path.join(dist,'normal50-admission-checks.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="./assets/style.css"><script defer src="./assets/normal50-admission-checks.js"></script></head><body style="margin:0"><div id="stage" style="position:relative;width:390px;height:844px"></div><div id="cardProbe"></div></body></html>');
const inputs=['tests/fixtures/normal50-admission-checks.ts','tools/build-normal50-admission-checks.mjs','src/battle.ts','src/progression.ts','src/progression-content.ts','src/level-config.ts','src/rules.ts','src/progression-capacity.ts','src/contract-rules.ts','src/sustain-rules.ts','src/sentinel-abilities.ts','src/experience-pickups.ts'];
writeFileSync(path.join(out,'scene-build.json'),JSON.stringify({atUTC:new Date().toISOString(),scope:'P4_NORMAL50_CONTROLLED_ACTUAL_ARENA_NOT_RELEASE',dist,node:process.version,mainSHA256:sha(path.join(dist,'assets/main.js')),checksSHA256:sha(path.join(dist,'assets/normal50-admission-checks.js')),sourceHashes:Object.fromEntries(inputs.map(f=>[f,sha(f)])),witnesses:witnesses.map(w=>({cat:w.cat,pair:w.pair,seed:w.seed,picks:w.picks.length})),scenarios:scenarios.length},null,2)+'\n');
console.log(JSON.stringify({out,witnesses:witnesses.map(w=>({cat:w.cat,pair:w.pair,seed:w.seed,picks:w.picks.length})),scenarios:scenarios.length}));
