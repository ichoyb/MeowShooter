// Candidate availability only: fixed XP inputs and assumed elite defeats.
// This does not simulate kills, movement, damage, natural difficulty or FPS.
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.env.GROWTH_SIMULATION_DIR||'../.local/checks/cross-weapon-growth-20261027');
mkdirSync(out,{recursive:true});
const moduleFile=path.join(out,'simulation-rules.mjs');
await build({define:{__DEVTOOLS__:'false'},stdin:{contents:"export * from './src/progression'; export {GROWTH_CORES} from './src/progression-content'; export * from './src/combat-config'; export * from './src/level-config';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node22',outfile:moduleFile});
const {RunGrowth,makeRunConfig,courtyardRunConfig,growthCardEligible,GROWTH_CARDS,GROWTH_CORES}=await import(pathToFileURL(moduleFile));
const seeds=1000,ratios=[.5,.7,.9,1],pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']];
const routes=[
 {id:'barrage',path:['L1_SPLIT','L1_DAMAGE','L1_RATE','L1_EVO_BARRAGE'],goal:'L1_EVO_BARRAGE'},
 {id:'pierce',path:['L1_PIERCE','L1_DAMAGE','L1_RANGE','L1_EVO_PIERCE'],goal:'L1_EVO_PIERCE'},
 {id:'cadence',path:['L1_ECHO','L1_RELOAD','L1_RATE','L1_EVO_CADENCE'],goal:'L1_EVO_CADENCE'},
 {id:'trail-cadence',path:['L1_TRAIL_BELL','L1_ECHO','L1_DUO_TRAIL_CADENCE'],goal:'L1_DUO_TRAIL_CADENCE'},
 {id:'star-ring',path:['L1_ORBIT_BELL','L1_PICKUP_CHIME','L1_DUO_STAR_RING'],goal:'L1_DUO_STAR_RING'}
];
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let x=Math.imul(seed^seed>>>15,1|seed);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
const cohorts=[];let offers=0,confirmations=0;
for(const [cat,weapon] of pairs)for(const ratio of ratios)for(const route of routes){
 let formed450=0,second450=0,formed600=0,minPicks=Infinity,maxPicks=0;
 const base=courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
 for(let seed=1;seed<=seeds;seed++){
  const growth=new RunGrowth(seed,rng(seed),base);let actualXP=0;
  const drain=()=>{while(growth.snapshot().offer){
   const s=growth.snapshot(),o=s.offer;offers++;
   if(o.choices.length!==3||new Set(o.choices).size!==3||!o.choices.every(id=>growthCardEligible(id,s.ranks,base)))throw Error('illegal candidate');
   const missing=route.path.filter(id=>!s.ranks[id]);
   const unowned=GROWTH_CORES.filter(id=>!s.ranks[id]);
   const order=[...missing,...(GROWTH_CORES.filter(id=>s.ranks[id]>0).length<2?unowned:[]),'L1_DAMAGE','L1_RATE','L1_RELOAD','L1_HEART','L1_MOVE','L1_RANGE'];
   const id=order.find(id=>o.choices.includes(id))||o.choices[0];
   if(!growth.confirm(seed,o.id,id))throw Error('valid confirmation rejected');
   if(growth.confirm(seed,o.id,id))throw Error('duplicate confirmation accepted');
   confirmations++;
  }};
  // XP checkpoints from the approved nominal birth table. Elite rewards are
  // assumed claimed at180/330s for this controlled availability calculation.
  for(const [time,fullXP] of [[60,38],[150,138],[180,196],[240,310],[300,446],[330,535],[450,893],[600,1266]]){
   const total=Math.floor(fullXP*ratio);growth.collect(total-actualXP);actualXP=total;drain();
   if(time===180||time===330){growth.queueElite(time===180?'elite-1':'elite-2',time);growth.openOffer();drain();}
   if(time===450){const s=growth.snapshot();formed450+=Number(!!s.ranks[route.goal]);second450+=Number(GROWTH_CORES.filter(id=>s.ranks[id]>0).length>=2);}
  }
  const final=growth.snapshot(),picks=final.level-1+final.eliteRewards.length;
  formed600+=Number(!!final.ranks[route.goal]);minPicks=Math.min(minPicks,picks);maxPicks=Math.max(maxPicks,picks);
  if(final.eliteRewards.length!==2||GROWTH_CARDS.length!==20)throw Error('reward scope drift');
 }
 cohorts.push({cat,weapon,ratio,route:route.id,runs:seeds,formedBy450:formed450/seeds,secondCoreBy450:second450/seeds,formedBy600:formed600/seeds,minPicks,maxPicks});
}
const recommended=cohorts.filter(c=>c.ratio===.7);
const result={status:'PASS',scope:'FIXED_XP_CANDIDATE_AVAILABILITY_NOT_NATURAL_BALANCE',runs:seeds*pairs.length*ratios.length*routes.length,seedsPerCohort:seeds,offers,confirmations,attributePlan:'A',xpTarget:28,assumptions:{eliteClaims:[180,330],policy:'Prefer missing route steps, then a second core, then attributes',xp:'nominal checkpoint totals × fixed collection ratio; no pickup/kill simulation'},recommendedTargets:{routeFormedBy450:.9,secondCoreBy450:.7},recommendedTargetsMet:recommended.every(c=>c.formedBy450>=.9&&c.secondCoreBy450>=.7),cohorts};
writeFileSync(path.join(out,'candidate-simulation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,runs:result.runs,offers,confirmations,recommendedTargetsMet:result.recommendedTargetsMet,recommended}));
