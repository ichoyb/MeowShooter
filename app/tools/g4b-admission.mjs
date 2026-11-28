// B4 normal-pool admission: actual exported rules, arithmetic XP supply upper
// bound and candidate transactions. This is not a natural kill/pickup simulation.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const out=path.resolve(process.env.G4B_ADMISSION_DIR||'../.local/checks/g4b-normal-pool-20261104/admission');
mkdirSync(out,{recursive:true});
const file=path.join(out,'admission-rules.mjs');
await build({define:{__DEVTOOLS__:'false'},stdin:{contents:"export * from './src/progression'; export {GROWTH_CORES} from './src/progression-content'; export * from './src/combat-config'; export * from './src/level-config'; export * from './src/progression-capacity';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node22',outfile:file});
const R=await import(pathToFileURL(file));
const {normalCourtyardRunConfig,makeRunConfig,SPAWN_STAGES,SliceSpawns,ArrivalReinforcements,COURTYARD_LEVEL,dropExperience,experienceNeeded,RunGrowth,GROWTH_CARDS,GROWTH_CORES,growthCardEligible,growthCombinations,growthRoutes,deriveGrowthConfig,projectileCapacityForGrowth,GROWTH_NUMBERS:N}=R;
const pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']],zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const baseFor=([cat,weapon])=>normalCourtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
const sum=r=>Object.values(r).reduce((a,b)=>a+b,0);
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let x=Math.imul(seed^seed>>>15,1|seed);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
const checks=[];const check=(name,fn)=>{const detail=fn();checks.push({name,status:'Pass',detail});return detail;};
const inputs=['src/level-config.ts','src/progression.ts','src/progression-content.ts','src/progression-capacity.ts','src/rules.ts','src/weapon-bursts.ts','src/cat-passives.ts'];
const sourceHashes=()=>Object.fromEntries(inputs.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
let budget;
try{
const xp=check('600 seconds actual spawn slots, finite arrivals and A28 investment ceiling',()=>{
 const rows=SPAWN_STAGES.map(s=>{const spawns=new SliceSpawns(),nominal=[];for(let i=0;i<Math.ceil((s.end-s.start)/s.interval);i++)nominal.push(spawns.take(s.start+i*s.interval));
  const extra=spawns.take(s.end-1e-9),nominalXP=nominal.reduce((n,id)=>n+dropExperience(id),0);
  return {start:s.start,end:s.end,nominalSlots:nominal.length,nominalXP,toleranceExtra:extra,conservativeXP:nominalXP+dropExperience(extra)};
 });
 const arrivals=new ArrivalReinforcements(),encounters=[...COURTYARD_LEVEL.eliteTimes.map((at,i)=>({id:'EL01',at,key:'elite-'+i})),{id:'B01',at:COURTYARD_LEVEL.bossAt,key:'boss'}];
 for(const [i,e] of encounters.entries()){assert(arrivals.begin(e.id,e.at,e.key,i+1));for(let t=e.at;t<e.at+10;t+=.1)for(const id of arrivals.dueEncounters(t))arrivals.attempt(t,true,id);}
 const arrivalRows=arrivals.snapshot(600).encounters;assert.deepEqual(arrivalRows.map(e=>e.spawned),[6,6,8]);
 const arrivalXP=arrivalRows.reduce((n,e)=>n+e.spawned*dropExperience('E01'),0),nominalXP=rows.reduce((n,s)=>n+s.nominalXP,0)+arrivalXP,conservativeXP=rows.reduce((n,s)=>n+s.conservativeXP,0)+arrivalXP;
 assert.equal(nominalXP,1266);assert.equal(conservativeXP,1272);
 const cost=picks=>Array.from({length:picks},(_,i)=>experienceNeeded(i+1,28)).reduce((a,b)=>a+b,0);
 const maxXP=Array.from({length:100},(_,i)=>i).filter(i=>cost(i)<=conservativeXP).at(-1);assert.equal(maxXP,34);assert.equal(cost(35),1307);budget=maxXP+COURTYARD_LEVEL.eliteTimes.length;assert.equal(budget,36);
 return {rows,arrivalRows,arrivalXP,nominalXP,conservativeXP,cost34:cost(34),cost35:cost(35),maximumExperiencePicks:maxXP,maximumElitePicks:2,maximumInvestments:budget,scope:'Supply upper bound assumes every possible slot is born, killed and collected. Not a promise of attainable natural XP.'};
});
check('normal identity, capability gates and unbounded attributes',()=>{
 assert.equal(GROWTH_CARDS.length,33);assert.equal(new Set(GROWTH_CARDS.map(c=>c.id)).size,33);assert.equal(GROWTH_CORES.length,7);
 const rows=[];for(const pair of pairs){const base=baseFor(pair),g=new RunGrowth(1,rng(1),base);assert.equal(g.snapshot().rulesVersion,'courtyard-growth-flight-hunt-v12');assert.equal(g.snapshot().attributePlan,'A');assert.equal(g.snapshot().xpTarget,28);
  for(const id of ['A15','M05','M12','C18'])assert(growthCardEligible(id,zero,base));
  assert.equal(growthCardEligible('M09',zero,base),pair[1]==='W04');assert(growthCardEligible('M09',{...zero,L1_PIERCE:1},base));assert(!growthCardEligible('M26',zero,base));assert(growthCardEligible('M26',{...zero,C18:1},base));
  assert(!growthCardEligible('E23',{...zero,M05:1},base));assert(!growthCardEligible('E23',{...zero,L1_PIERCE:1},base));assert(growthCardEligible('E23',{...zero,M05:1,L1_PIERCE:1},base));
  for(const n of [0,1,3,34,100]){const ranks={...zero,A15:n,L1_DAMAGE:n,L1_RATE:n,L1_RELOAD:n,L1_RANGE:n,L1_MOVE:n,A12:n},c=deriveGrowthConfig(base,ranks);
   for(const id of ['A15','L1_DAMAGE','L1_RATE','L1_RELOAD','L1_RANGE','L1_MOVE','A12'])assert(growthCardEligible(id,ranks,base));
   assert(Math.abs(c.weapon.bulletSpeed-base.weapon.bulletSpeed*(1+.1*n))<1e-7);assert(Math.abs(c.weapon.bulletSpeed*c.weapon.bulletLifeSeconds-Math.max(base.weapon.bulletSpeed*base.weapon.bulletLifeSeconds,c.weapon.targetRange))<1e-7);
  }
  rows.push({cat:pair[0],weapon:pair[1],initialEligible:GROWTH_CARDS.filter(c=>growthCardEligible(c.id,zero,base)).map(c=>c.id),version:g.snapshot().rulesVersion});
 }
 return {rows,repeatRanksChecked:[0,1,3,34,100],overBudgetScope:'Ranks100 checks absence of artificial caps only; capacity admission uses36.'};
});
check('new core joins first-offer coverage and all advanced identities receive existing guarantee',()=>{
 const rows=[];for(const pair of pairs){const base=baseFor(pair),firstCores=new Set();for(let seed=1;seed<=500;seed++){const g=new RunGrowth(seed,rng(seed),base);g.collect(8);for(const id of g.snapshot().offer.choices)if(GROWTH_CORES.includes(id))firstCores.add(id);}
  assert.deepEqual([...firstCores].sort(),[...GROWTH_CORES].sort());
  const ranks={...zero,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,C23:1,C18:1,M05:1};
  const expected=[...growthRoutes(ranks).filter(r=>r.eligible).map(r=>r.evolution),...growthCombinations(ranks).filter(c=>c.eligible).map(c=>c.id)],g=new RunGrowth(9,rng(9),base);g.ranks=ranks;g.collect(1272);const seen=new Set();
  for(let i=0;i<expected.length;i++){const before=g.snapshot(),o=before.offer;assert(expected.some(id=>o.choices.includes(id)));o.choices.filter(id=>expected.includes(id)).forEach(id=>seen.add(id));g.openOffer();assert.deepEqual(g.snapshot().offer,o);const id=o.choices.find(id=>GROWTH_CARDS.find(c=>c.id===id).kind==='attribute');assert(id);assert(g.confirm(9,o.id,id));}
  assert.deepEqual([...seen].sort(),expected.sort());rows.push({cat:pair[0],firstCores:[...firstCores],guaranteedAdvanced:[...seen],views:expected.length});
 }return {rows,scope:'Controlled rank eligibility and guarantee; normal RunGrowth transaction, no natural-acquisition claim.'};
});
const routes=[{id:'mirror',path:['L1_PIERCE','M05','E23','M09','A15'],goal:'E23'},{id:'hunt-cluster',path:['C18','M26','L1_SPLIT','M06','L1_DAMAGE'],goal:'M26'},{id:'reload-burst',path:['L1_ECHO','L1_RELOAD','L1_RATE','L1_EVO_CADENCE','M12'],goal:'M12'}];
check('three weapons times three routes actual candidate transactions at observed supply fractions',()=>{
 const rows=[];let offers=0,attributesRepeated=0;const seen=new Set(),seeds=200;
 for(const pair of pairs)for(const ratio of [.5,.7,1])for(const route of routes){let formed=0,completed=0,minPicks=Infinity,maxPicks=0,firstCore=0;const witnesses=[];const base=baseFor(pair);
  for(let seed=1;seed<=seeds;seed++){const g=new RunGrowth(seed,rng(seed),base),trace=[];g.collect(Math.floor(xp.conservativeXP*ratio));g.queueElite('elite-150',150);g.queueElite('elite-300',300);let count=0;
   while(g.snapshot().offer){const s=g.snapshot(),o=s.offer;assert.equal(o.choices.length,3);assert.equal(new Set(o.choices).size,3);assert(o.choices.every(id=>growthCardEligible(id,s.ranks,base)));o.choices.forEach(id=>seen.add(id));
    const id=[...route.path.filter(id=>!s.ranks[id]),'A15','L1_RATE','L1_DAMAGE','L1_RELOAD','L1_RANGE'].find(id=>o.choices.includes(id))||o.choices[0];
    if(GROWTH_CARDS.find(c=>c.id===id).kind==='attribute'&&s.ranks[id]>0)attributesRepeated++;
    if(seed===1)trace.push({offer:o,chosen:id});assert(g.confirm(seed,o.id,id));assert(!g.confirm(seed,o.id,id));assert(!g.confirm(seed-1,o.id,id));count++;offers++;
   }const s=g.snapshot();assert.equal(s.eliteRewards.length,2);assert.equal(s.totalXP,Math.floor(xp.conservativeXP*ratio));assert.equal(count,s.level-1+2);assert.equal(sum(s.ranks),count);assert(count<=budget);
   formed+=Number(!!s.ranks[route.goal]);completed+=Number(route.path.every(id=>s.ranks[id]>0));firstCore+=Number(GROWTH_CORES.some(id=>s.ranks[id]>0));minPicks=Math.min(minPicks,count);maxPicks=Math.max(maxPicks,count);if(seed===1)witnesses.push({seed,trace,ranks:s.ranks});
  }rows.push({cat:pair[0],weapon:pair[1],ratio,route:route.id,seeds,goalFraction:formed/seeds,completeFivePickFraction:completed/seeds,anyCoreFraction:firstCore/seeds,minPicks,maxPicks,witnesses});
 }assert.equal(seen.size,33);assert(attributesRepeated>0);return {runs:rows.length*seeds,offers,attributesRepeated,identitiesObserved:[...seen].sort(),rows,scope:'Fixed XP supply fractions and two assumed elite defeats; this validates candidate legality and availability only, not combat balance or natural route formation.'};
});
check('all legal occupancy projections within36 investments retain dynamic Group proof',()=>{
 // Capacity depends only on these source switches and rate/range/reload. The
 // ignored identities cannot add Group members. A15 only shortens new lives;
 // the flight proof deliberately retains every historical source life.
 const cases=[];let enumerated=0;
 for(const pair of pairs){const base=baseFor(pair);let maximum={capacity:0},maxWithHot={capacity:0},maxWithReturnHot={capacity:0};
  for(let split=0;split<3;split++)for(let echo=0;echo<3;echo++)for(let light=0;light<2;light++)for(let pickup=0;pickup<2;pickup++)for(let rhythm=0;rhythm<3;rhythm++)for(let returning=0;returning<2;returning++)for(let hot=0;hot<2;hot++){
   if(light&&!echo||rhythm===2&&!split)continue;
   const flags={...(split?{L1_SPLIT:1}:{}),...(split===2?{L1_EVO_BARRAGE:1}:{}),...(echo?{L1_ECHO:1}:{}),...(echo===2?{L1_EVO_CADENCE:1}:{}),...(light?{L1_LIGHT_MAG:1}:{}),...(pickup?{L1_PICKUP_CHIME:1}:{}),...(rhythm?{C23:1}:{}),...(rhythm===2?{E21:1}:{}),...(returning?{M05:1}:{}),...(hot?{M12:1}:{})};
   if(pickup&&!split&&!echo&&!rhythm)flags.C18=1;
   const fixed=sum(flags),remaining=budget-fixed;
   for(let rate=0;rate<=remaining;rate++)for(let range=0;range<=remaining-rate;range++)for(let reload=0;reload<=remaining-rate-range;reload++){
    // Barrage's missing support can be DAMAGE; cadence has only RATE/RELOAD.
    if(echo===2&&rate+reload<2)continue;const damage=split===2?Math.max(0,2-rate):0;if(rate+range+reload+damage>remaining)continue;
    const ranks={...zero,...flags,L1_RATE:rate,L1_RANGE:range,L1_RELOAD:reload,L1_DAMAGE:damage},config=deriveGrowthConfig(base,ranks),capacity=projectileCapacityForGrowth(base,config,ranks);enumerated++;assert(Number.isInteger(capacity)&&capacity>=24);
    const row={capacity,ranks,investments:sum(ranks),life:config.weapon.bulletLifeSeconds,minimumRootInterval:config.weapon.intervalSeconds*(hot?N.hotStartIntervalMultiplier:1)};
    if(capacity>maximum.capacity)maximum=row;if(hot&&capacity>maxWithHot.capacity)maxWithHot=row;if(returning&&hot&&capacity>maxWithReturnHot.capacity)maxWithReturnHot=row;
   }
  }
  cases.push({cat:pair[0],weapon:pair[1],maximum,maxWithHot,maxWithReturnHot});
 }
 return {enumerated,cases,budget,proof:{historicalLife:'L=max(base.life,current.range/base.speed), unaffected by any earlier A15 rank',primary:'rootsIn(2*L+1/20) when M05, otherwise rootsIn(L+1/20), current pellets bound all old pellets',rootInterval:'current.interval*0.75 with M12; actual hot roots are a subset, old roots are never faster',reload:'base magazine preserves old long magazines; current smaller magazine bounds tail/opening emissions',secondary:'nonreturn source life L; tail and cadence or orange opening counted independently; pickup pessimistically every root',rhythm:'L+0.50+2*0.06+3/20 covers frozen old intents and Clock insertion/rounding, max three members every four roots',spirit:'separate native life/interval plus1/20 endpoint slack in shared Group',projection:'M31 and E23 do not increase this already conservative bound; other identities do not add projectile Group members. A15 may only shorten new lives. All legal <=36 ranks project to an enumerated vector with no larger budget.'},scope:'Exhaustive source/rate/range/reload projection and mathematical upper bound; native Scene stress separately verifies implementation. No hard slot or XP cap introduced.'};
});
const report={status:'PASS',atUTC:new Date().toISOString(),node:process.version,sourceHashes:sourceHashes(),checks,platform:'NOT_TESTED',phonePerformance:'NOT_TESTED'};
writeFileSync(path.join(out,'rules-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:checks.length,budget,enumerated:checks.at(-1).detail.enumerated,maxima:checks.at(-1).detail.cases.map(c=>({cat:c.cat,max:c.maximum.capacity,ranks:c.maximum.ranks})),out}));
}catch(error){writeFileSync(path.join(out,'rules-report.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,sourceHashes:sourceHashes(),checks},null,2)+'\n');throw error;}
