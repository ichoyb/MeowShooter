import {historicalNormal44Config} from './helpers/historical-growth';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import * as Config from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import {Session} from '../src/rules';
import {growthCardSummary,growthChange,growthDetail,growthPage,growthBuild} from '../src/ui/progression';
import type {GrowthRanks,GrowthId} from '../src/progression';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const normal=(cat='CAT01',weapon='W01')=>historicalNormal44Config(cat,weapon);
const pilot=(cat='CAT01',weapon='W01'):Config.RunConfig=>({...normal(cat,weapon),growthPool:undefined,sustainRewards:{enabled:true},rewardContracts:{enabled:true}} as any);
const eligible=(id:string,ranks=zero,base=pilot(),picks=4)=>(Growth.growthCardEligible as any)(id,ranks,base,picks);
const contract=(ranks:GrowthRanks,base=pilot())=>{assert.equal(typeof (Growth as any).contractMultipliers,'function');return (Growth as any).contractMultipliers(base,ranks);};
const forced=(g:any,id:string,source='experience',commit?:()=>number|false)=>{
 if(source==='elite')g.queueElite('elite-'+g.snapshot().confirmedPicks,100+g.snapshot().confirmedPicks);else g.pending++;
 g.offer={id:++g.sequence,choices:[id,'L1_RATE','L1_HEART'],source,...(source==='elite'?{encounterId:g.eliteQueue[0].encounterId,birthId:g.eliteQueue[0].birthId}:{})};
 return g.confirm(g.runId,g.offer.id,id,commit);
};
const ready=(random=()=>0,base=pilot(),ranks:GrowthRanks={...zero,L1_ORBIT_BELL:1})=>{
 const g:any=new Growth.RunGrowth(7,random,base);g.ranks={...ranks};
 for(let i=0;i<4;i++)assert(forced(g,'L1_HEART'));
 return g;
};

test('controlled48 explicitly adds only two tradeoffs and keeps normal44 and controlled46 versions',()=>{
 for(const [cat,w] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,w),n=normal(cat,w),s={...n,sustainRewards:{enabled:true}} as any;
  assert.equal(Growth.growthCards(b).length,48);assert.equal(Growth.growthCards(n).length,44);assert.equal(Growth.growthCards(s).length,46);
  assert.equal(new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion,'courtyard-growth-contracts-v16-controlled48-v1');
  assert.equal(new Growth.RunGrowth(1,()=>0,n).snapshot().rulesVersion,'courtyard-growth-defense-v14');
  assert.equal(new Growth.RunGrowth(1,()=>0,s).snapshot().rulesVersion,'courtyard-growth-sustain-v15-controlled46-v1');
  for(const id of ['R04','R05']){const c=Growth.growthCard(id);assert(c);assert.equal(c.kind,'tradeoff');assert.equal(c.limit,1);assert(!Growth.growthCards(n).includes(c));}
  for(const id of ['R06','R07'])assert(!Growth.growthCards(b).some(c=>c.id===id));
 }
 for(const b of [{...pilot(),sustainRewards:undefined},{...pilot(),areaAbilities:undefined},{...courtyardRunConfig(Config.makeRunConfig('CAT01','W01','p2-basic')),rewardContracts:{enabled:true}}] as any[]){
  const v=new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion;assert.doesNotMatch(v,/controlled48|controlled46/);assert.match(v,/-contracts-v1$/);
 }
});

test('rewardContracts is playtest-only and the historical normal44 fixture does not enable it',()=>{
 assert.equal((normal() as any).rewardContracts,undefined);
 const check=(Config as any).assertRewardContractsProfile;assert.equal(typeof check,'function');
 for(const p of ['release','review'])assert.throws(()=>check(pilot(),p),/playtest/);
 assert.doesNotThrow(()=>check(pilot(),'playtest'));
});

test('R04 and R05 require an actual weapon plus an independent source, real four picks, and symmetric exclusion',()=>{
 for(const id of ['R04','R05']){
  for(const r of [zero,{...zero,C13:1},{...zero,C21:1},{...zero,C18:1},{...zero,L1_SHOCK_BELL:1}])assert(!eligible(id,r),id);
  for(const source of ['L1_TRAIL_BELL','L1_ORBIT_BELL','L1_PICKUP_CHIME','C15','C16','C12']){
   const r={...zero,[source]:1};assert(eligible(id,r),source);assert(!eligible(id,r,pilot(),3));
   assert(!eligible(id,r,{...pilot(),weapon:{...pilot().weapon,damage:0}}));
   assert(!eligible(id,r,normal()));
  }
  assert(eligible(id,zero,pilot('CAT03','W02')));assert(!eligible(id,{...zero,[id]:1,L1_ORBIT_BELL:1}));
  assert(!eligible(id,{...zero,[id==='R04'?'R05':'R04']:1,L1_ORBIT_BELL:1}));
 }
 assert(!eligible('R04',{...zero,C12:1},{...pilot(),defenseCompanions:undefined}));
 assert(!eligible('R04',{...zero,C15:1},{...pilot(),areaAbilities:undefined}));
});

test('source multipliers apply once to P12 S12 spirit6 while K remains its own bucket',()=>{
 for(const [id,p,s,k] of [['R04',9.6,16.2,8.1],['R05',16.2,9.6,4.8]] as const){
  const b=pilot(),r={...zero,[id]:1};near(Growth.deriveGrowthConfig(b,r).weapon.damage,p);near(Growth.abilityDamage(b,r),s);near(Growth.nativeSpiritDamage(b,r),k);
  assert.deepEqual(contract(r),{weapon:id==='R04'?.8:1.35,skill:id==='R04'?1.35:.8});
  near(Growth.skillMultiplier(b,{...r,A07:1}),1.25);near(Growth.abilityDamage(b,{...r,L1_DAMAGE:1,A07:1}),s*1.2*1.25);
  near(Growth.nativeSpiritDamage(b,{...r,L1_DAMAGE:8,A07:1}),k*1.25);
  assert.deepEqual(contract(r,normal()),{weapon:1,skill:1});near(Growth.deriveGrowthConfig(normal(),r).weapon.damage,12);
 }
});

for(const [cat,w] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']])test(cat+' retains actual weapon identity and splits source families with existing derivation',()=>{
 const b=pilot(cat,w),r={...zero,L1_DAMAGE:1,L1_SPLIT:1,C23:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_PICKUP_CHIME:1,C12:1,C13:1,E14:1};
 const before=Growth.deriveGrowthConfig(b,r),after=Growth.deriveGrowthConfig(b,{...r,R04:1} as any);
 near(after.weapon.damage,before.weapon.damage*.8);
 for(const key of ['pellets','spreadDegrees','extraPierce','pierceDamageMultiplier','targetRange','bulletSpeed','bulletLifeSeconds','ammoCapacity','reloadSeconds','intervalSeconds'] as const)assert.equal(after.weapon[key],before.weapon[key]);
 assert.equal(after.maxHp,before.maxHp);assert.equal(after.moveSpeed,before.moveSpeed);assert.deepEqual(after.chill,before.chill);
 const burst=new Growth.WeaponBursts(),shots=burst.onVolley(after,r,{id:1,ammo:0,reloads:1,opening:true});
 for(const shot of shots)near(shot.damage,after.weapon.damage*b.directDamageMultiplier*(shot.effect==='TAIL_ECHO'?.25:.5));
 const s=Growth.sentinelStats(b,{...r,R04:1} as any,true);near(s.damage,Growth.abilityDamage(b,r)*1.35*.6*.8);
 near(Growth.pulseStats(b,{...r,R04:1} as any).damage,Growth.abilityDamage(b,r)*1.35*.7);
 near(Growth.anchorStats(b,{...r,R04:1} as any).damage,Growth.abilityDamage(b,r)*1.35*.4);
});

test('rhythm freezes already-derived weapon damage at its actual root and does not read a later contract',()=>{
 const b=pilot(),r={...zero,C23:1},bursts=new Growth.WeaponBursts();
 let old:any;for(let i=1;i<=4;i++)old=bursts.onRhythmVolley(Growth.deriveGrowthConfig(b,r),r,{id:i});
 near(old.segments[0].damage,7.2);const next={...r,R04:1} as any;
 let fresh:any;for(let i=5;i<=8;i++)fresh=bursts.onRhythmVolley(Growth.deriveGrowthConfig(b,next),next,{id:i});
 near(old.segments[0].damage,7.2);near(fresh.segments[0].damage,5.76);assert(Object.isFrozen(old.segments[0]));
});

test('confirmedPicks counts only successful confirms across experience, elites, repeats and orbit ranks',()=>{
 const g:any=new Growth.RunGrowth(5,()=>0,pilot());assert.equal(g.snapshot().confirmedPicks,0);
 g.collect(1000);assert.equal(g.snapshot().confirmedPicks,0);g.clearPending();g.ranks={...zero,L1_DAMAGE:20,L1_ORBIT_BELL:2};assert.equal(g.snapshot().confirmedPicks,0);
 assert(forced(g,'L1_HEART'));assert(forced(g,'L1_HEART','elite'));assert(forced(g,'L1_ORBIT_BELL'));assert.equal(g.snapshot().confirmedPicks,3);
 assert(!forced(g,'L1_RATE','experience',()=>false));assert.equal(g.snapshot().confirmedPicks,3);
 const offer=g.snapshot().offer;assert(!g.confirm(999,offer.id,'L1_RATE'));assert(!g.confirm(5,offer.id,'no-card'));assert.equal(g.snapshot().confirmedPicks,3);
 assert(g.confirm(5,offer.id,'L1_RATE'));assert.equal(g.snapshot().confirmedPicks,4);assert(!g.confirm(5,offer.id,'L1_RATE'));assert.equal(g.snapshot().confirmedPicks,4);
});

test('R uses the second logical slot at 20%, preserving guaranteed advance and a general attribute',()=>{
 for(const draw of [.199999,.2]){
  const values=[draw,0,0,0,0],g=ready(()=>values.shift()??0,pilot(),{...zero,L1_SPLIT:1,L1_RATE:2,L1_ORBIT_BELL:1});
  g.collect(8);const ids=g.snapshot().offer.choices;
  assert(ids.includes('L1_EVO_BARRAGE'));assert(ids.some((id:string)=>Growth.growthCard(id)?.kind==='attribute'));
  assert.equal(ids.filter((id:string)=>Growth.growthCard(id)?.kind==='tradeoff').length,draw<.2?1:0);
 }
});

test('legal R choices are equal-weight with at most one per offer, without elite weighting or decline penalties',()=>{
 for(const source of ['experience','elite'])for(const side of [0,.999999]){
  const values=[0,side,0,0,0],g=ready(()=>values.shift()??0,pilot(),{...zero,L1_SPLIT:1,L1_RATE:2,L1_ORBIT_BELL:1});
  g.recentDeclined=[['R04'],['R05']];assert.equal(Growth.growthExplorationWeight('R04' as any,g.ranks,g.recentDeclined),1);
  if(source==='elite'){assert(g.queueElite('actual-elite',901));g.openOffer();}else g.collect(8);
  const ids=g.snapshot().offer.choices;assert(ids.includes(side===0?'R04':'R05'));assert.equal(ids.filter((id:string)=>id.startsWith('R0')).length,1);
 }
});

test('no legal R consumes no extra random draw and retains old offers exactly',()=>{
 for(const source of ['no-source','too-early','owned-contract','flag-off']){
  let a=0,b=0;const rng=(n:number)=>((n*71+19)%997)/997;
  const oldBase={...pilot(),rewardContracts:undefined} as any,nextBase=source==='flag-off'?oldBase:pilot();
  const old:any=source==='too-early'?new Growth.RunGrowth(1,()=>rng(++a),oldBase):ready(()=>rng(++a),oldBase);
  const next:any=source==='too-early'?new Growth.RunGrowth(1,()=>rng(++b),nextBase):ready(()=>rng(++b),nextBase);
  old.ranks={...zero,...(source==='too-early'?{L1_ORBIT_BELL:1}:{}),...(source==='owned-contract'?{L1_ORBIT_BELL:1,R04:1}:{})};next.ranks={...old.ranks};
  for(let i=0;i<8;i++){old.pending++;next.pending++;old.openOffer();next.openOffer();assert.deepEqual(next.snapshot().offer.choices,old.snapshot().offer.choices);old.clearPending();next.clearPending();}
  assert.equal(a,b);
 }
});

test('R never enters first-slot or fallback pools even when its branch is skipped',()=>{
 for(const ranks of [{...zero},{...zero,C21:1},{...zero,L1_ORBIT_BELL:1}]){
  const g=ready(()=>.999999,pilot('CAT03','W02'),ranks);g.collect(8);
  const ids=g.snapshot().offer.choices;assert(ids.every((id:string)=>!id.startsWith('R0')));assert.equal(ids.length,3);
 }
});

test('opened offers stay frozen; failed and invalid R confirms preserve count and cost, successful R excludes the other side',()=>{
 const g=ready(()=>0);g.collect(8);const offer=g.snapshot().offer;assert(offer.choices.includes('R04'));
 const before=g.snapshot();g.openOffer();g.collect(0);assert.deepEqual(g.snapshot(),before);
 assert(!g.confirm(g.runId,offer.id,'R04',()=>false));assert.deepEqual(g.snapshot(),before);
 assert(g.confirm(g.runId,offer.id,'R04'));assert.equal(g.snapshot().confirmedPicks,5);assert.equal(g.snapshot().ranks.R04,1);
 assert(!g.confirm(g.runId,offer.id,'R04'));assert(!eligible('R05',g.snapshot().ranks));
 assert(forced(g,'L1_HEART'));assert(forced(g,'L1_RATE'));assert.equal(g.snapshot().ranks.R04,1);assert.equal(g.snapshot().ranks.R05,undefined);
 g.pending++;g.offer={id:++g.sequence,choices:['R05','L1_HEART','L1_RATE'],source:'experience'};assert(!g.confirm(g.runId,g.offer.id,'R05'));
});

test('R legality is rechecked at confirmation rather than trusting an already-open card',()=>{
 const g=ready(()=>0);g.collect(8);const offer=g.snapshot().offer;g.ranks={...zero,C13:1};assert(!g.confirm(g.runId,offer.id,'R04'));assert.equal(g.snapshot().confirmedPicks,4);
});

test('C21 follows actual weapon loss indirectly while M10 shield recovery does not multiply',()=>{
 for(const [id,expected] of [['R04',.192],['R05',.324]] as const){
  const b=pilot(),s=new Session({...b,weapon:{...b.weapon,ammoCapacity:1}});s.applyGrowth({...zero,C21:1,C13:1,M10:1,[id]:1} as any);s.damage(28);
  near(s.recordSustainHit({source:'PRIMARY',targetKind:'enemy',actualDamage:s.effectiveConfig.weapon.damage}),expected);
  assert(s.step(0,{x:1,y:0}));near(s.defenseSnapshot().shield,2.7);
 }
});

test('tradeoff card faces and owned details show benefit, cost, exclusion and separate K from contract skill damage',()=>{
 const b=pilot('CAT03','W02'),g=ready(()=>0,b);g.collect(8);const snap=g.snapshot();
 for(const id of ['R04','R05'] as GrowthId[]){
  const summary=growthCardSummary(id,snap,b);assert.match(summary.benefit,/1.35/);assert.match(summary.cost??'',/0.8/);assert.match(summary.cost??'',/互斥/);
  const detail=growthDetail(id,snap,b,{courtyard:true}).body;assert.doesNotMatch(detail,/undefined|NaN/);assert.match(detail,/取舍/);assert.match(detail,/互斥/);
  const owned={...snap,ranks:{...snap.ranks,[id]:1,A07:1}};assert.match(growthBuild(owned,b,{courtyard:true}),/互斥/);assert.match(growthDetail(id,owned,b,{courtyard:true,source:'owned'}).body,/当前效果/);
  assert.match(growthChange('A07',owned,b),/K 1.25 → 1.5/);
  assert.match(growthDetail('A07',owned,b,{courtyard:true,source:'owned'}).body,new RegExp('取舍契约×'+(id==='R04'?'1.35':'0.8')));
  assert.match(growthChange('L1_DAMAGE',owned,b),/技能S/);assert.doesNotMatch(growthChange('L1_DAMAGE',owned,b),/铃术D/);
  assert.doesNotMatch(growthDetail('L1_DAMAGE',owned,b,{courtyard:true,source:'owned'}).body,/铃术D/);
 }
 const face=growthPage(snap,b,undefined,{courtyard:true}).body;assert.match(face,/1.35/);assert.match(face,/0.8/);assert.match(face,/互斥/);
});
