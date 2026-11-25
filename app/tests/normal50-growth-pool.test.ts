import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Config from '../src/combat-config';
import {normalCourtyardRunConfig,courtyardRunConfig,COURTYARD_LEVEL,ENEMIES} from '../src/level-config';
import * as Growth from '../src/progression';
import {Session} from '../src/rules';
import {NavigationModel} from '../src/ui/model';
import {growthBuild,growthDetail,growthCardSummary} from '../src/ui/progression';
import {controlled44Config,historicalNormal44Config} from './helpers/historical-growth';

const pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']] as const;
const zero:Growth.GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const added=['C21','M10','R04','R05','R06','R07'] as const;
const rIds=['R04','R05','R06','R07'] as const;
const flags=['projectileTraits','projectileFlight','huntTargeting','areaAbilities','defenseCompanions','sustainRewards','rewardContracts','movementContracts'] as const;
const normal=(cat='CAT01',weapon='W01')=>normalCourtyardRunConfig(Config.makeRunConfig(cat,weapon,'p2-basic'));
const snapshot=(base:Config.RunConfig)=>new Growth.RunGrowth(1,()=>0,base).snapshot();
function harness(base=normal('CAT03','W02'),seed=7){
 let value=seed,draws=0,queue:number[]=[];
 const random=()=>{draws++;if(queue.length)return queue.shift()!;value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 const g=new Growth.RunGrowth(seed,random,base);
 return {g,base,set:(values:number[])=>{queue=values.slice();},draws:()=>draws};
}
type Harness=ReturnType<typeof harness>;
function next(h:Harness,elite=false){
 const before=h.g.snapshot();assert.equal(before.offer,null);
 if(elite){assert(h.g.queueElite('elite-'+before.confirmedPicks,100+before.confirmedPicks));h.g.openOffer();}
 else h.g.collect(before.nextXP-before.xp);
 return h.g.snapshot().offer!;
}
function four(h:Harness){
 for(let i=0;i<4;i++){
  const offer=next(h,i===2),s=h.g.snapshot();assert.equal(s.confirmedPicks,i);
  assert(!offer.choices.some(id=>rIds.includes(id as any)));
  const id=offer.choices.find(id=>Growth.growthCard(id)!.kind==='attribute')??offer.choices[0];
  assert(h.g.confirm(s.runId,offer.id,id));assert(!h.g.confirm(s.runId,offer.id,id));
 }
 assert.equal(h.g.snapshot().confirmedPicks,4);
}
function rOffer(h:Harness,pick:number,chance=0,elite=false){
 const s=h.g.snapshot();
 const advanced=s.routes.some(r=>r.eligible&&r.evolution!==null)||s.combinations.some(c=>c.eligible);
 // The final two draws keep the logical slot order visible for this assertion.
 h.set([...(advanced?[]:[0]),chance,pick,0,.999999,.999999]);
 return next(h,elite);
}
function buy(h:Harness,target:Growth.GrowthId){
 for(let i=0;i<400;i++){
  const offer=next(h),s=h.g.snapshot();
  const needsAttackCore=!s.routes.some(r=>r.coreOwned)&&!['C18','C15','C16','C12'].some(id=>Growth.growthRank(s.ranks,id as Growth.GrowthId));
  const id=offer.choices.includes(target)?target:(needsAttackCore?offer.choices.find(id=>Growth.growthCard(id)!.kind==='core'&&!['C13','C21'].includes(id)):undefined)??offer.choices.find(id=>Growth.growthCard(id)!.kind==='attribute')??offer.choices[0];
  assert(h.g.confirm(s.runId,offer.id,id));
  if(id===target)return;
 }
 assert.fail('real candidate stream never reached '+target);
}

test('normal50 admits exactly six identities with the approved category counts; historical44 remains explicit',()=>{
 assert.equal(Growth.NORMAL_GROWTH_RULES_VERSION,'courtyard-growth-normal50-v18');
 for(const [cat,w]of pairs){
  const b=normal(cat,w),cards=Growth.growthCards(b),old=Growth.growthCards(historicalNormal44Config(cat,w));
  assert.equal(cards.length,50);assert.equal(new Set(cards.map(c=>c.id)).size,50);
  assert.deepEqual(cards.filter(c=>!old.some(o=>o.id===c.id)).map(c=>c.id),added);
  const count=(k:string)=>cards.filter(c=>c.kind===k).length;
  assert.deepEqual([count('attribute'),count('core'),count('attachment'),count('evolution')+count('combination'),count('tradeoff')],[14,12,11,9,4]);
  assert.equal(snapshot(b).rulesVersion,'courtyard-growth-normal50-v18');
  assert.equal(snapshot(historicalNormal44Config(cat,w)).rulesVersion,'courtyard-growth-defense-v14');
  const ranks:Growth.GrowthRanks={...zero,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_RANGE:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,C23:1,C18:1,M05:1,C15:1,C16:1,C12:1,C13:1};
  for(const card of cards)assert(Growth.growthCardEligible(card.id,{...ranks,[card.id]:0},b,4),cat+' '+card.id);
 }
});

test('normal50 applies only the starter damage balance, freezes eight capabilities and grants no cards',()=>{
 for(const [cat,w,oldDamage,damage,volleyDamage]of [['CAT01','W01',12,12,12],['CAT02','W04',32,29,26.1],['CAT03','W02',8,7.5,37.5]] as const){
  const b=normal(cat,w),s=new Session(b),g=snapshot(b);
  assert(Object.isFrozen(b)&&Object.isFrozen(b.weapon));for(const flag of flags){assert.deepEqual(b[flag],{enabled:true});assert(Object.isFrozen(b[flag]));}
  assert(Object.isFrozen(b.growthTuning));assert.deepEqual(b.growthTuning,{attributePlan:'A',xpTarget:28});
  assert.equal(normalCourtyardRunConfig(b),b);assert.equal(courtyardRunConfig(b),b);
  const old=historicalNormal44Config(cat,w),ordinary=courtyardRunConfig(Config.makeRunConfig(cat,w,'p2-basic'));
  assert.equal(old.weapon.damage,oldDamage);assert.equal(ordinary.weapon.damage,oldDamage);
  assert.deepEqual(normalCourtyardRunConfig(old),b);
  assert.deepEqual(normalCourtyardRunConfig({...b,weapon:old.weapon}),b);
  assert.equal(b.weapon.damage,damage,cat);
  const {weapon,directDamageMultiplier}=s.effectiveConfig;
  assert.equal(Number((weapon.damage*directDamageMultiplier*weapon.pellets).toFixed(3)),volleyDamage);
  const {growthPool,growthTuning,...rest}=b;for(const flag of flags)delete (rest as any)[flag];
  assert.deepEqual(rest,{...ordinary,weapon:{...ordinary.weapon,damage}});
  assert.deepEqual(g.ranks,zero);assert.equal(g.confirmedPicks,0);assert.equal(g.totalXP,0);assert.equal(g.offer,null);assert.equal(g.pending,0);
  assert.equal(s.hp,b.maxHp);assert.equal(s.defenseSnapshot().shield,0);
  assert.equal(s.snapshot().sustain.lifeCircuitOwned,false);assert.equal(s.snapshot().sustain.reloadShieldOwned,false);
 }
 const tuned=normalCourtyardRunConfig({...Config.makeRunConfig('CAT01','W01','p2-basic'),growthTuning:{attributePlan:'B',xpTarget:20}});
 assert.deepEqual(tuned.growthTuning,{attributePlan:'B',xpTarget:20});
 assert.equal(COURTYARD_LEVEL.duration,600);assert.deepEqual(Object.values(ENEMIES).map(e=>e.speed),[54,50,96,32,48,45]);
 assert.deepEqual([1,2,3,10].map(n=>Growth.experienceNeeded(n)),[8,10,12,24]);
});

test('playtest navigation, confirmed selection and restart all feed the same normal50 frozen configuration',()=>{
 const m=new NavigationModel(false,true);
 for(const [cat,w]of pairs){
  m.beginSelection();assert(m.previewCat(cat));assert(m.confirmSelection());
  const run=normalCourtyardRunConfig(m.beginRun());m.run=run;
  assert.equal(run.catId,cat);assert.equal(run.weaponId,w);assert.equal(snapshot(run).rulesVersion,'courtyard-growth-normal50-v18');
  assert.equal(normalCourtyardRunConfig(m.run),run);
  const h=harness(run);four(h);assert.equal(new Growth.RunGrowth(999,()=>0,m.run).snapshot().confirmedPicks,0);
 }
});

test('release/review reject all three newly admitted capabilities; playtest accepts each independently',()=>{
 for(const [flag,check]of [['sustainRewards',Config.assertSustainRewardsProfile],['rewardContracts',Config.assertRewardContractsProfile],['movementContracts',Config.assertMovementContractsProfile]] as const){
  const b={...Config.makeRunConfig('CAT01','W01','p2-basic'),[flag]:{enabled:true}} as Config.RunConfig;
  for(const profile of ['release','review']as const)assert.throws(()=>check(b,profile),/playtest/);
  assert.doesNotThrow(()=>check(b,'playtest'));
 }
 assert.throws(()=>normalCourtyardRunConfig(Config.makeRunConfig('CAT01','W01','diagnostic')),/diagnostic|p2-basic/);
});

test('all incomplete flags and marker-only configurations retain controlled metadata, while old complete pilots retain 46/48/50',()=>{
 for(let mask=0;mask<256;mask++)for(const marked of [false,true]){
  const b:any={...courtyardRunConfig(Config.makeRunConfig('CAT01','W01','p2-basic')),...(marked?{growthPool:'normal'}:{})};
  for(let i=0;i<flags.length;i++)if(mask&(1<<i))b[flags[i]]={enabled:true};
  assert.equal(snapshot(b).rulesVersion==='courtyard-growth-normal50-v18',marked&&mask===255,`mask ${mask} marker ${marked}`);
 }
 const base=controlled44Config();
 for(const [extra,version,size]of [
  [{sustainRewards:{enabled:true}},'courtyard-growth-sustain-v15-controlled46-v1',46],
  [{sustainRewards:{enabled:true},rewardContracts:{enabled:true}},'courtyard-growth-contracts-v16-controlled48-v1',48],
  [{sustainRewards:{enabled:true},rewardContracts:{enabled:true},movementContracts:{enabled:true}},'courtyard-growth-movement-v17-controlled50-v1',50]
 ]as const){const b={...base,...extra};assert.equal(snapshot(b).rulesVersion,version);assert.equal(Growth.growthCards(b).length,size);}
});

test('four successful real reward confirmations unlock R; failed and duplicate confirmations leave offers and RNG frozen',()=>{
 const h=harness();
 for(let i=0;i<4;i++){
  const offer=next(h,i===1),s=h.g.snapshot(),draws=h.draws();assert.equal(s.confirmedPicks,i);
  assert(!offer.choices.some(id=>rIds.includes(id as any)));
  const id=offer.choices[0];assert(!h.g.confirm(s.runId+1,offer.id,id));assert(!h.g.confirm(s.runId,offer.id+1,id));
  assert(!h.g.confirm(s.runId,offer.id,id,()=>false));h.g.collect(0);h.g.openOffer();
  assert.deepEqual(h.g.snapshot(),s);assert.equal(h.draws(),draws);
  assert(h.g.confirm(s.runId,offer.id,id));assert(!h.g.confirm(s.runId,offer.id,id));
 }
 const offer=rOffer(h,0);assert(offer.choices.includes('R04'));assert.equal(h.g.snapshot().confirmedPicks,4);
});

test('all four legal R share one equal 20 percent logical exploration branch for XP and unique elite rewards',()=>{
 for(const elite of [false,true])for(let i=0;i<4;i++){
  const h=harness();four(h);const s=h.g.snapshot(),offer=rOffer(h,(i+.5)/4,.199999,elite);
  assert.equal(offer.source,elite?'elite':'experience');assert.equal(offer.choices[1],rIds[i]);
  assert.equal(offer.choices.filter(id=>rIds.includes(id as any)).length,1);
  assert.equal(Growth.growthCard(offer.choices[2])!.kind,'attribute');
  if(!s.routes.some(r=>r.coreOwned)&&!s.ranks.C21)assert.equal(Growth.growthCard(offer.choices[0])!.kind,'core');
  if(s.routes.some(r=>r.eligible)||s.combinations.some(c=>c.eligible))assert(['evolution','combination'].includes(Growth.growthCard(offer.choices[0])!.kind));
  assert.equal(Growth.growthExplorationWeight(rIds[i],s.ranks,[[rIds[i]]]),1);
  if(elite){assert(!h.g.queueElite(offer.encounterId!,offer.birthId!));assert(!h.g.queueElite('duplicate-birth',offer.birthId!));}
 }
 const h=harness();four(h);assert(!rOffer(h,0,.2).choices.some(id=>rIds.includes(id as any)));
});

test('a real declined R retains equal eligibility and the next R cannot displace an actually unlocked advance',()=>{
 const h=harness();four(h);let offer=rOffer(h,0);
 assert.equal(offer.choices[1],'R04');assert(h.g.confirm(h.g.runId,offer.id,offer.choices[2]));
 offer=rOffer(h,0);assert.equal(offer.choices[1],'R04');
 assert(h.g.confirm(h.g.runId,offer.id,offer.choices[2]));
 buy(h,'L1_SPLIT');buy(h,'L1_RATE');buy(h,'L1_RATE');
 const s=h.g.snapshot();assert(s.routes.some(r=>r.eligible)||s.combinations.some(c=>c.eligible));
 offer=rOffer(h,.8);assert(['evolution','combination'].includes(Growth.growthCard(offer.choices[0])!.kind));
 assert.equal(offer.choices[1],'R07');assert.equal(Growth.growthCard(offer.choices[2])!.kind,'attribute');
});

test('real normal50 purchases stack the same attribute beyond three with the existing additive formula',()=>{
 const h=harness(normal());for(let i=0;i<10;i++)buy(h,'L1_DAMAGE');
 const r=h.g.snapshot().ranks;assert(r.L1_DAMAGE>=10);
 const after=Growth.deriveGrowthConfig(h.base,r),before=Growth.deriveGrowthConfig(h.base,{...r,L1_DAMAGE:0});
 assert(Math.abs(after.weapon.damage-before.weapon.damage*(1+.2*r.L1_DAMAGE))<1e-9);
 assert(Growth.growthCardEligible('L1_DAMAGE',r,h.base,h.g.snapshot().confirmedPicks));
});

test('R groups are mutually exclusive one-offs, and real purchases can combine across the two groups',()=>{
 for(const source of ['R04','R05']as const)for(const movement of ['R06','R07']as const){
  const h=harness();four(h);let offer=rOffer(h,source==='R04'?.1:.3);
  assert(offer.choices.includes(source));assert(h.g.confirm(h.g.runId,offer.id,source));
  for(const id of ['R04','R05']as const)assert(!Growth.growthCardEligible(id,h.g.snapshot().ranks,h.base,h.g.snapshot().confirmedPicks));
  offer=rOffer(h,movement==='R06'?.1:.9);assert(offer.choices.includes(movement));assert(h.g.confirm(h.g.runId,offer.id,movement));
  for(const id of rIds)assert(!Growth.growthCardEligible(id,h.g.snapshot().ranks,h.base,h.g.snapshot().confirmedPicks));
  offer=next(h);
  assert(!offer.choices.some(id=>rIds.includes(id as any)));
 }
});

test('no legal R consumes no extra random draw before four confirmations or after four without a real attack',()=>{
 for(const attack of [true,false]){
  const base=normal('CAT01','W01'),b=attack?base:{...base,weapon:{...base.weapon,damage:0}};
  const on=harness(b),off=harness({...b,rewardContracts:undefined,movementContracts:undefined});
  for(let i=0;i<(attack?4:8);i++){
   const a=next(on),b=next(off);assert.deepEqual(a.choices,b.choices);assert.equal(on.draws(),off.draws());
   assert(!a.choices.some(id=>rIds.includes(id as any)));
   const id=a.choices.find(id=>Growth.growthCard(id)!.kind==='attribute')??a.choices[0];
   assert(on.g.confirm(on.g.runId,a.id,id));assert(off.g.confirm(off.g.runId,b.id,id));
  }
 }
 const b=normal('CAT01','W01'),r={...zero,C21:1,C13:1,M10:1};
 for(const id of ['R04','R05']as const)assert(!Growth.growthCardEligible(id,r,b,4),'sustain/shield do not create independent damage');
 for(const id of ['A07','A08','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME']as const)assert(!Growth.growthCardEligible(id,r,b,4));
});

test('normal50 keeps real weapon, independent-source and purchased shield/magazine prerequisites',()=>{
 for(const [cat,w]of pairs){
  const b=normal(cat,w);
  assert(Growth.growthCardEligible('C21',zero,b));assert(!Growth.growthCardEligible('M10',zero,b));
  assert(Growth.growthCardEligible('M10',{...zero,C13:1},b));
  for(const weapon of [{...b.weapon,damage:0},{...b.weapon,pellets:0}])for(const id of ['C21',...rIds])assert(!Growth.growthCardEligible(id,{...zero,C12:1},{...b,weapon},4));
  for(const weapon of [{...b.weapon,ammoCapacity:0},{...b.weapon,reloadSeconds:0}])assert(!Growth.growthCardEligible('M10',{...zero,C13:1},{...b,weapon},4));
  for(const id of ['R04','R05']as const){assert.equal(Growth.growthCardEligible(id,zero,b,4),cat==='CAT03');assert(Growth.growthCardEligible(id,{...zero,C12:1},b,4));}
  for(const id of ['R06','R07']as const){assert(!Growth.growthCardEligible(id,zero,b,3));assert(Growth.growthCardEligible(id,zero,b,4));}
 }
 const h=harness(normal());buy(h,'C13');buy(h,'M10');buy(h,'C21');
 for(const id of ['C13','M10','C21']as const){assert.equal(h.g.snapshot().ranks[id],1);assert(!Growth.growthCardEligible(id,h.g.snapshot().ranks,h.base,100));}
});

test('normal50 attributes remain repeatable and normal owned effects retain area data even without the base argument',()=>{
 const b=normal(),r={...zero,C15:1,L1_ORBIT_BELL:1,A08:2};
 for(const card of Growth.growthCards(b).filter(c=>c.kind==='attribute'&&c.id!=='A11'))assert(Growth.growthCardEligible(card.id,{...r,C12:1,[card.id]:100},b,4),card.id);
 assert.match(growthBuild({...snapshot(b),ranks:r}),/66u/);
 const owned={...snapshot(b),ranks:Object.fromEntries(Growth.growthCards(b).map(c=>[c.id,1])) as Growth.GrowthRanks};
 assert.equal((growthBuild(owned,b,{courtyard:true}).match(/data-action="growth-owned-detail:/g)||[]).length,50);
 for(const id of added){assert.doesNotMatch(growthDetail(id,snapshot(b),b).body,/undefined|NaN/);assert(growthCardSummary(id,snapshot(b),b).benefit);}
});
