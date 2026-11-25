// Reproducible legal-candidate prefix search, not exhaustive reachability or balance.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.env.FORTRESS_CHECK_DIR||'../.local/checks/fortress-fusion-pilot-20261104');
const file=path.join(root,'companion-rules.mjs'),d2File=path.resolve('../.local/checks/companion-pilot-20261104/companion-rules.mjs');
if(file===d2File)throw Error('D3 output must not overwrite the frozen D2 rules; select an independent FORTRESS_CHECK_DIR');
mkdirSync(root,{recursive:true});
const result=await build({stdin:{contents:"export * from './src/progression';export * from './src/combat-config';export * from './src/level-config';export * from './src/progression-capacity';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node22',outfile:file,metafile:true});
const R=await import(pathToFileURL(file));
const priorFile=path.resolve('../.local/checks/g4c-normal-pool-20261104/admission/admission-rules.mjs'),P=await import(pathToFileURL(priorFile));
const D2=await import(pathToFileURL(d2File));
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const historicalNormal=(run)=>{const {sustainRewards,rewardContracts,movementContracts,...base}=R.normalCourtyardRunConfig(run);return base;};
const rows=[],seen=new Set();let prefixes=0,confirmations=0,aboveFloor=0;
for(const [cat,weapon]of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']])for(const flight of [false,true]){
 let maximum36=24,maximum47=24,maxRanks36=null,maxRanks47=null,partnerPrefixes=0;
 for(let seed=1;seed<=1000;seed++){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const base={...historicalNormal(R.makeRunConfig(cat,weapon,'p2-basic')),projectileFlight:flight?{enabled:true}:undefined,defenseCompanions:{enabled:true}},legacy={...base,defenseCompanions:undefined};
  assert.equal(R.growthCards(base).length,44);const g=new R.RunGrowth(seed,random,base);g.collect(1000000);
  for(let pick=1;pick<=47;pick++){
   const snapshot=g.snapshot(),offer=snapshot.offer;assert(offer&&offer.choices.length===3);
   for(const id of offer.choices)assert(R.growthCardEligible(id,snapshot.ranks,base));
   const policy=seed%4;let id;
   if(policy===0)id=['E14','C12','C13','A16'].find(id=>offer.choices.includes(id));
   if(policy===1)id=offer.choices.find(x=>['L1_SPLIT','L1_ECHO','C23','M05','M12','L1_RATE','L1_RANGE'].includes(x));
   if(policy===2)id=offer.choices.find(x=>!snapshot.ranks[x]);
   id??=offer.choices[Math.floor(random()*offer.choices.length)];assert(g.confirm(seed,offer.id,id));confirmations++;seen.add(id);
   const ranks=g.snapshot().ranks,cost=Object.values(ranks).reduce((a,b)=>a+b,0);assert.equal(cost,pick);const effective=R.deriveGrowthConfig(base,ranks);
   const cap=R.projectileCapacityForGrowth(base,effective,ranks),off=R.projectileCapacityForGrowth(legacy,effective,ranks),old=P.projectileCapacityForGrowth(legacy,effective,ranks);
   assert.equal(cap,D2.projectileCapacityForGrowth(base,effective,ranks),'E14 changes neither source cadence nor lifetime capacity');
   assert.equal(off,old,'disabled D2 must retain legacy capacity exactly');
   const F=1+.1*(ranks.A16??0),frame=1/R.BATTLE_MIN_FPS,window=(life,interval,extra)=>Math.floor((life+extra)/(interval-1e-8))+1;
   const oldSpirit=base.passive==='spirit'?window(base.spirit.bulletLifeSeconds,base.spirit.intervalSeconds,flight?frame:0):0;
   const newSpirit=base.passive==='spirit'?window(base.spirit.bulletLifeSeconds,base.spirit.intervalSeconds/F,frame):0;
   const sentry=ranks.C12?window(1,1/F,frame):0,added=newSpirit-oldSpirit+sentry;
   assert(cap>=off&&cap<=off+added);if(off>24){assert.equal(cap,off+added);aboveFloor++;}
   if(ranks.C12||ranks.A16)partnerPrefixes++;prefixes++;
   if(pick<=36&&cap>maximum36){maximum36=cap;maxRanks36={...ranks};}if(cap>maximum47){maximum47=cap;maxRanks47={...ranks};}
  }
 }
 rows.push({cat,flight,seeds:1000,prefixes:47000,partnerPrefixes,maximum36Observed:maximum36,maximum47Observed:maximum47,maxRanks36,maxRanks47});
}
const report={status:'PASS',node:process.version,rulesSHA256:sha(file),priorRulesSHA256:sha(priorFile),d2RulesSHA256:sha(d2File),toolSHA256:sha(new URL(import.meta.url)),sourceSHA256:Object.fromEntries(Object.keys(result.metafile.inputs).filter(f=>f!=='<stdin>').map(f=>[f,sha(f)])),seedsPerCatAndFlight:1000,confirmations,prefixes,aboveFloorExactCompanionDifferentials:aboveFloor,identitiesActuallyConfirmed:[...seen].sort(),rows,scope:'D3 controlled44 legal actual-candidate prefix search through47 investments (<=36 pressure separate from47 diagnostic). Exact capacity against frozen D2, analytical per-source windows plus retained old-main/flight proof; not exhaustive enumeration, natural XP/formation rate, phone or balance.'};
assert.equal(prefixes,282000);assert.equal(seen.size,44);assert(seen.has('E14')&&seen.has('C12')&&seen.has('A16'));
writeFileSync(path.join(root,'capacity-search.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,prefixes,identities:seen.size,rows:rows.map(({cat,flight,maximum36Observed,maximum47Observed})=>({cat,flight,maximum36Observed,maximum47Observed}))}));
