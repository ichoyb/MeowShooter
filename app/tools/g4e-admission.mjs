// Fixed-XP candidate reference, not combat, pickup rate or natural balance.
import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve(process.env.G4E_ADMISSION_DIR||'../.local/checks/normal50-admission-20261105/admission');mkdirSync(out,{recursive:true});
const file=path.join(out,'admission-rules.mjs');
await build({define:{__DEVTOOLS__:'false'},stdin:{contents:"export * from './src/progression';export * from './src/combat-config';export * from './src/level-config';export * from './src/progression-capacity';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',target:'node22',outfile:file});
const R=await import(pathToFileURL(file)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const runnerSHA256=sha(new URL(import.meta.url)),zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0},pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']],newIDs=['C21','M10','R04','R05','R06','R07'];
const checkpoints=[[60,38],[150,138],[180,196],[240,310],[300,446],[330,535],[450,893],[600,1266]];
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let x=Math.imul(seed^seed>>>15,1|seed);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
const sum=r=>Object.values(r).reduce((a,b)=>a+b,0),checks=[];
const baseFor=(pair,stage)=>{const b=R.normalCourtyardRunConfig(R.makeRunConfig(...pair,'p2-basic'));
 return {...b,sustainRewards:stage>=46?b.sustainRewards:undefined,rewardContracts:stage>=48?b.rewardContracts:undefined,movementContracts:stage>=50?b.movementContracts:undefined};};
const check=(name,fn)=>{const detail=fn();checks.push({name,status:'PASS',detail});return detail;};
const sourceFiles=['src/level-config.ts','src/progression.ts','src/progression-content.ts','src/progression-capacity.ts','src/contract-rules.ts','src/sustain-rules.ts'];
let report;
try{
 check('three actual normal configurations contain50 distinct identities with exact classification and no free ranks',()=>pairs.map(pair=>{
  const b=baseFor(pair,50),cards=R.growthCards(b),g=new R.RunGrowth(1,rng(1),b),s=g.snapshot(),k={};cards.forEach(c=>k[c.kind]=(k[c.kind]||0)+1);
  assert.equal(cards.length,50);assert.equal(new Set(cards.map(c=>c.id)).size,50);assert.deepEqual([k.attribute,k.core,k.attachment,k.evolution+k.combination,k.tradeoff],[14,12,11,9,4]);
  assert.equal(s.rulesVersion,'courtyard-growth-normal50-v18');assert.equal(s.confirmedPicks,0);assert.equal(sum(s.ranks),0);assert.equal(s.totalXP,0);
  const available={...zero,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_RANGE:2,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,C23:1,C18:1,M05:1,C15:1,C16:1,C12:1,C13:1};
  for(const c of cards)assert(R.growthCardEligible(c.id,{...available,[c.id]:0},b,4),c.id+' must be individually reachable');
  for(const [a,c]of [['R04','R05'],['R06','R07']]){assert(!R.growthCardEligible(c,{...available,[a]:1},b,4));assert(!R.growthCardEligible(a,{...available,[c]:1},b,4));}
  for(const attr of cards.filter(c=>c.kind==='attribute'&&c.limit===null))assert(R.growthCardEligible(attr.id,{...available,[attr.id]:40},b,40),attr.id+' remains stackable');
  return {cat:pair[0],cards:cards.map(c=>({id:c.id,kind:c.kind,limit:c.limit})),classification:k,version:s.rulesVersion};
 }));
 check('actual unchanged spawn supply has36 maximum nominal investments, not guaranteed28 gifts',()=>{
  const prior=JSON.parse(readFileSync('../.local/checks/g4d-normal-pool-20261104/admission/rules-report.json','utf8')).checks[0].detail;
  const budget=n=>Array.from({length:n},(_,i)=>R.experienceNeeded(i+1,28)).reduce((a,b)=>a+b,0);
  assert.equal(prior.nominalXP,1266);assert(budget(34)<=1266&&budget(35)>1272);assert.equal(prior.maximumInvestments,36);assert.deepEqual(R.COURTYARD_LEVEL.eliteTimes,[150,300]);
  return {nominalXP:1266,conservativeXP:1272,maximumExperienceChoices:34,maximumEliteChoices:2,normalBudget:36,diagnosticBudget:47,eliteSpawnTimes:[150,300],assumedEliteClaimTimes:[180,330],scope:'Unchanged frozen source supply; actual kills and pickup losses are not simulated.'};
 });
 const cohorts=check('four scope references, three weapons1000seeds each at four fixed pickup ratios',()=>{
  const rows=[],seenGlobal=new Set();let offers=0,confirmations=0;
  for(const stage of [44,46,48,50])for(const pair of pairs)for(const ratio of [.5,.7,.9,1]){
   const b=baseFor(pair,stage),catalog=R.growthCards(b),exposure=Object.fromEntries(catalog.map(c=>[c.id,0])),selected={...exposure},offerExposure={...exposure},at450={},at600={};
   const advanced=catalog.filter(c=>['core','evolution','combination'].includes(c.kind)).map(c=>c.id);
   for(const id of advanced){at450[id]=0;at600[id]=0;}
   let legalR=0,offeredR=0,declinedStillLegal=0,reofferedDeclined=0,minPicks=Infinity,maxPicks=0;const witnesses=[];
   for(let seed=1;seed<=1000;seed++){
    const g=new R.RunGrowth(seed,rng(seed),b),seen=new Set(),declined=new Set(),policy=seed%2?'mobile':'fortress';let xp=0;const trace=[];
    const order=policy==='mobile'?['R04','R06','C21','L1_TRAIL_BELL','L1_ORBIT_BELL','L1_PICKUP_CHIME','L1_DUO_STAR_RING','C15','C16','E16','C13','M10','C12','E14','A07','L1_DAMAGE','L1_RATE','L1_MOVE','L1_HEART']:['R05','R07','M10','C13','C12','E14','C21','L1_PIERCE','M05','E23','C23','M31','L1_SPLIT','E21','L1_EVO_PIERCE','L1_EVO_BARRAGE','L1_ECHO','L1_EVO_CADENCE','A16','A13','L1_DAMAGE','L1_RATE','L1_RELOAD','L1_HEART'];
    const drain=time=>{while(g.snapshot().offer){
     const s=g.snapshot(),o=s.offer,legal=catalog.filter(c=>c.kind==='tradeoff'&&R.growthCardEligible(c.id,s.ranks,b,s.confirmedPicks)).map(c=>c.id),actualR=o.choices.filter(id=>R.growthCard(id).kind==='tradeoff');
     assert.equal(o.choices.length,3);assert.equal(new Set(o.choices).size,3);assert(actualR.length<=1);assert(o.choices.every(id=>R.growthCardEligible(id,s.ranks,b,s.confirmedPicks)));
     if(s.confirmedPicks<4)assert.equal(actualR.length,0);if(legal.length){legalR++;offeredR+=actualR.length;}
     for(const id of declined)if(legal.includes(id)){declinedStillLegal++;reofferedDeclined+=Number(actualR.includes(id));}
     o.choices.forEach(id=>{seen.add(id);seenGlobal.add(id);offerExposure[id]++;});offers++;
     const id=order.find(id=>o.choices.includes(id)&&(!s.ranks[id]||R.growthCard(id).kind==='attribute'&&s.ranks[id]<3))||o.choices.find(id=>R.growthCard(id).kind==='attribute')||o.choices[0];
     for(const r of actualR)if(r!==id)declined.add(r);
     g.openOffer();assert.deepEqual(g.snapshot().offer,o);assert(!g.confirm(seed+100000,o.id,id));assert.deepEqual(g.snapshot().offer,o);
     assert(g.confirm(seed,o.id,id));assert(!g.confirm(seed,o.id,id));confirmations++;selected[id]++;
     const after=g.snapshot();assert.equal(after.confirmedPicks,s.confirmedPicks+1);assert.equal(sum(after.ranks),after.confirmedPicks);
     assert(!(after.ranks.R04&&after.ranks.R05));assert(!(after.ranks.R06&&after.ranks.R07));
     if(seed===1)trace.push({time,choices:o.choices,source:o.source,selected:id,confirmed:after.confirmedPicks});
    }};
    for(const [time,total]of checkpoints){const amount=Math.floor(total*ratio);g.collect(amount-xp);xp=amount;drain(time);if(time===180||time===330){assert(g.queueElite('assumed-'+time,time));assert(!g.queueElite('assumed-'+time,time));g.openOffer();drain(time);}if(time===450||time===600){const target=time===450?at450:at600;for(const id of advanced)target[id]+=Number(!!g.snapshot().ranks[id]);}}
    const final=g.snapshot();assert.equal(final.totalXP,Math.floor(1266*ratio));assert.equal(final.eliteRewards.length,2);assert.equal(final.confirmedPicks,final.level-1+2);assert(final.confirmedPicks<=36);minPicks=Math.min(minPicks,final.confirmedPicks);maxPicks=Math.max(maxPicks,final.confirmedPicks);seen.forEach(id=>exposure[id]++);if(seed===1)witnesses.push({seed,policy,trace,ranks:final.ranks});
   }
   rows.push({stage,cat:pair[0],weapon:pair[1],seeds:1000,ratio,minPicks,maxPicks,offeredRunFractions:Object.fromEntries(Object.entries(exposure).map(([id,n])=>[id,n/1000])),offerExposure,selected,at450:Object.fromEntries(Object.entries(at450).map(([id,n])=>[id,n/1000])),at600:Object.fromEntries(Object.entries(at600).map(([id,n])=>[id,n/1000])),contracts:{legalOpportunities:legalR,offered:offeredR,rateGivenLegal:legalR?offeredR/legalR:0,declinedStillLegal,reofferedDeclined},witnesses});
  }
  return {observedIdentityCount:seenGlobal.size,identitiesNotObserved:R.growthCards(baseFor(pairs[0],50)).map(c=>c.id).filter(id=>!seenGlobal.has(id)),runs:48000,final50Runs:12000,offers,confirmations,stages:[44,46,48,50],checkpoints,rows,identitiesObserved:[...seenGlobal].sort(),assumptions:'Current identical core rules with explicit stage flags; alternate mobile/fortress policy, fixed XP and elite claim times. Not combat, natural pickup or balance; no reward guarantee.'};
 });
 report={status:'PASS',atUtc:new Date().toISOString(),node:process.version,runnerSHA256,rulesBundleSHA256:sha(file),sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,sha(p)])),checks,platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',phonePerformance:'NOT_TESTED'};
 writeFileSync(path.join(out,'rules-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',runs:cohorts.runs,final50Runs:cohorts.final50Runs,offers:cohorts.offers,checks:checks.length,out}));
}catch(e){writeFileSync(path.join(out,'rules-report.json'),JSON.stringify({status:'FAIL',error:String(e),stack:e.stack,runnerSHA256,checks},null,2)+'\n');throw e;}
