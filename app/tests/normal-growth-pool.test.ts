import {historicalNormal44Config} from './helpers/historical-growth';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Level from '../src/level-config';
import {makeRunConfig,assertProjectileTraitsProfile,assertProjectileFlightProfile,assertHuntTargetingProfile,assertAreaAbilitiesProfile,assertDefenseCompanionsProfile,type RunConfig} from '../src/combat-config';
import {GROWTH_CARDS,GROWTH_RULES_VERSION,RunGrowth,growthCards,growthCardEligible,growthRank,type GrowthId,type GrowthRanks} from '../src/progression';
import {growthCardSummary,growthDetail,growthBuild} from '../src/ui/progression';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']] as const;
const flightHunt:GrowthId[]=['A15','M05','M09','C18','M26','M12','E23'];
const area:GrowthId[]=['A07','A08','A10','C15','C16','E16'];
const defense:GrowthId[]=['A13','C13','C12','A16','E14'];
const added=[...flightHunt,...area,...defense];
const normalIds:GrowthId[]=['L1_DAMAGE','L1_RATE','L1_HEART','L1_RELOAD','L1_RANGE','L1_MOVE','L1_SPLIT','L1_PIERCE','L1_ECHO','L1_EVO_BARRAGE','L1_EVO_PIERCE','L1_EVO_CADENCE','L1_SHOCK_BELL','L1_RICOCHET','L1_TRAIL_BELL','L1_ORBIT_BELL','L1_PICKUP_CHIME','L1_LIGHT_MAG','L1_DUO_TRAIL_CADENCE','L1_DUO_STAR_RING','A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23','A07','A08','A10','C15','C16','E16',...defense];
const legacy=(cat='CAT01',weapon='W01'):RunConfig=>({...Level.courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),projectileTraits:{enabled:true}});
const legacy33=(cat='CAT01',weapon='W01'):RunConfig=>({...legacy(cat,weapon),projectileFlight:{enabled:true},huntTargeting:{enabled:true}});
const normal=historicalNormal44Config;
const prerequisites:GrowthRanks={...zero,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_RANGE:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,C23:1,C18:1,M05:1,C15:1,C16:1,C12:1,C13:1};
const reachable=(base:RunConfig)=>growthCards(base).filter(card=>growthCardEligible(card.id,{...prerequisites,[card.id]:0},base)).map(card=>card.id).sort();

test('historical normal courtyard retains exact v14 with 44 reachable identities and preserves explicit legacy26 and legacy33 scopes',()=>{
 assert.equal(GROWTH_RULES_VERSION,'courtyard-growth-defense-v14');
 assert.equal(GROWTH_CARDS.length,33,'the base catalog remains available to historical controlled fixtures');
 for(const [cat,weapon]of pairs){
  const oldIds=reachable(legacy(cat,weapon)),old33=reachable(legacy33(cat,weapon)),ids=reachable(normal(cat,weapon));
  assert.equal(oldIds.length,26);assert.equal(old33.length,33);assert.equal(new Set(ids).size,44);
  assert.deepEqual(old33,[...oldIds,...flightHunt].sort());assert.deepEqual(ids,[...old33,...area,...defense].sort());
  assert.deepEqual(ids,[...oldIds,...added].sort());
  assert.deepEqual(ids,normalIds.slice().sort());assert.deepEqual(growthCards(normal(cat,weapon)).map(c=>c.id).sort(),ids);
 }
});

test('historical normal44 fixture freezes its five capabilities at default A28 and starts every fixed pair at zero growth',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon),s=new RunGrowth(1,()=>0,b).snapshot();
  assert(Object.isFrozen(b));assert.deepEqual(b.growthTuning,{attributePlan:'A',xpTarget:28});
  for(const flag of [b.projectileTraits,b.projectileFlight,b.huntTargeting,b.areaAbilities,b.defenseCompanions]){assert.deepEqual(flag,{enabled:true});assert(Object.isFrozen(flag));}
  assert.equal(s.rulesVersion,'courtyard-growth-defense-v14');assert.deepEqual(s.ranks,zero);
  assert.equal(s.level,1);assert.equal(s.totalXP,0);assert.equal(s.pending,0);assert.equal(s.offer,null);
  assert.deepEqual(b.weapon,legacy(cat,weapon).weapon);assert.equal(b.maxHp,legacy(cat,weapon).maxHp);
  const {growthPool,projectileTraits,projectileFlight,huntTargeting,areaAbilities,defenseCompanions,growthTuning,...parameters}=b;
  assert.deepEqual(parameters,Level.courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),'normal admission only grants the existing capabilities and default tuning');
 }
 const configured=(Level as any).normalCourtyardRunConfig({...makeRunConfig('CAT01','W01','p2-basic'),growthTuning:{attributePlan:'B',xpTarget:20}});
 assert.deepEqual(configured.growthTuning,{attributePlan:'B',xpTarget:20});
});

test('release, review and diagnostic cannot adopt normal44; controlled fixtures expose their actual scope',()=>{
 const b=normal();
 for(const profile of ['release','review'] as const)for(const validate of [assertProjectileTraitsProfile,assertProjectileFlightProfile,assertHuntTargetingProfile,assertAreaAbilitiesProfile,assertDefenseCompanionsProfile])assert.throws(()=>validate(b,profile),/playtest/);
 for(const validate of [assertProjectileTraitsProfile,assertProjectileFlightProfile,assertHuntTargetingProfile,assertAreaAbilitiesProfile,assertDefenseCompanionsProfile])assert.doesNotThrow(()=>validate(b,'playtest'));
 assert.throws(()=>(Level as any).normalCourtyardRunConfig(makeRunConfig('CAT01','W01','diagnostic')),/diagnostic|p2-basic/);
 for(const [base,suffix]of [[legacy(),'-controlled-traits'],[{...legacy(),projectileFlight:{enabled:true}},'-controlled-traits-flight-v2'],[{...legacy(),huntTargeting:{enabled:true}},'-controlled-traits-hunt-v1'],[{...legacy(),projectileFlight:{enabled:true},huntTargeting:{enabled:true}},'-controlled-traits-flight-v2-hunt-v1']] as const){
  assert.equal(new RunGrowth(1,()=>0,base).snapshot().rulesVersion,'courtyard-growth-area-v13'+suffix);
 }
});

test('every incomplete capability set and missing normal marker reports its exact controlled suffix',()=>{
 const flags=['projectileTraits','projectileFlight','huntTargeting','areaAbilities','defenseCompanions'] as const,suffixes=['-traits','-flight-v2','-hunt-v1','-area-v2'];
 for(let mask=0;mask<32;mask++)for(const marked of [false,true]){
  const b:RunConfig={...Level.courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),...(marked?{growthPool:'normal' as const}:{})};
  for(let i=0;i<flags.length;i++)if(mask&(1<<i))Object.assign(b,{[flags[i]]:{enabled:true}});
  const suffix=mask&16?'-defense-v3':suffixes.map((part,i)=>mask&(1<<i)?part:'').join('');
  assert.equal(new RunGrowth(1,()=>0,b).snapshot().rulesVersion,marked&&mask===31?GROWTH_RULES_VERSION:'courtyard-growth-area-v13-controlled'+suffix,`marker ${marked}, capabilities ${mask}`);
 }
 const areaOnly:RunConfig={...Level.courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),growthPool:'normal',areaAbilities:{enabled:true}};
 for(const id of ['A11','A12','M06','C23','M31','E21',...flightHunt] as GrowthId[])assert(!growthCardEligible(id,{...prerequisites,[id]:0},areaOnly),id+' must retain its own gate');
});

test('a normal scope marker alone neither grants gated cards nor mislabels a controlled capability set',()=>{
 const b:RunConfig={...legacy(),growthPool:'normal'},s=new RunGrowth(1,()=>0,b).snapshot();
 for(const id of added)assert(!growthCardEligible(id,{...prerequisites,[id]:0},b));
 assert.equal(s.rulesVersion,'courtyard-growth-area-v13-controlled-traits');
});

test('normal44 eligibility retains purchased-core requirements, repeatable speed and real weapon capability gates',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);
  for(const id of ['A15','M05','C18','M12'] as const)assert(growthCardEligible(id,zero,b));
  assert(growthCardEligible('A15',{...zero,A15:50},b));
  assert.equal(growthCardEligible('M09',zero,b),weapon==='W04');assert(growthCardEligible('M09',{...zero,L1_PIERCE:1},b));
  assert(!growthCardEligible('M26',zero,b));assert(growthCardEligible('M26',{...zero,C18:1},b));
  assert(!growthCardEligible('E23',{...zero,M05:1},b));assert(!growthCardEligible('E23',{...zero,L1_PIERCE:1},b));
  assert(growthCardEligible('E23',{...zero,L1_PIERCE:1,M05:1},b));
  for(const id of ['L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'] as const)assert(growthCardEligible(id,{...zero,C18:1},b));
  for(const id of flightHunt)assert(!growthCardEligible(id,{...prerequisites,[id]:0},{...b,weapon:{...b.weapon,pellets:0}}));
  assert(!growthCardEligible('M12',zero,{...b,weapon:{...b.weapon,ammoCapacity:0}}));
 }
});

test('normal44 real offers stay legal, frozen and confirm-once through 34 XP rewards and two elites',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon),seen=new Set<GrowthId>();
  for(let seed=1;seed<=32;seed++){
   let value=seed;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
   const g=new RunGrowth(seed,random,b);g.collect(1266);g.queueElite('elite-1',1);g.queueElite('elite-2',2);let xp=0,elite=0;
   while(g.snapshot().offer){
    const s=g.snapshot(),offer=s.offer!;assert.equal(new Set(offer.choices).size,3);
    if(xp===0&&elite===0)assert(offer.choices.some(id=>growthCards(b).find(c=>c.id===id)!.kind==='core'));
    for(const id of offer.choices){assert(growthCardEligible(id,s.ranks,b));seen.add(id);growthDetail(id,s,b);growthCardSummary(id,s,b);}
    g.collect(0);assert.deepEqual(g.snapshot(),s,'details and repeated observation must not reroll');
    const detached=g.snapshot();detached.offer!.choices.length=0;assert.deepEqual(g.snapshot(),s,'a reader cannot mutate the live offer');
    const priorities:GrowthId[]=['E14','C12','C13','A13','A16','E16','E23','C15','C16','M26','M09','M12','L1_PIERCE','M05','C18','A07','A08','A10','A15'];
    const id=priorities.find(id=>offer.choices.includes(id))??offer.choices[0];
    assert(!g.confirm(seed+1000,offer.id,id));assert(g.confirm(seed,offer.id,id));assert(!g.confirm(seed,offer.id,id));
    offer.source==='elite'?elite++:xp++;
   }
   assert.equal(xp,34);assert.equal(elite,2);assert.equal(g.snapshot().pending,0);assert.equal(g.snapshot().eliteRewards.length,2);
   assert.deepEqual(new RunGrowth(seed+1000,random,b).snapshot().ranks,zero,'new run never inherits previous growth');
  }
  for(const id of added)assert(seen.has(id),weapon+' never offered '+id);
 }
});

test('normal44 owned build and new-card details use the actual same-source values and show all identities once',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon),g=new RunGrowth(1,()=>0,b).snapshot();
  const owned={...g,ranks:Object.fromEntries(growthCards(b).map(c=>[c.id,1])) as GrowthRanks};
  const build=growthBuild(owned,b,{courtyard:true});
  assert.equal((build.match(/data-action="growth-owned-detail:/g)||[]).length,44);assert.doesNotMatch(build,/undefined|NaN/);
  assert(g.combinations.some(c=>c.id==='E23'&&!c.eligible&&!c.owned));
  assert(g.combinations.some(c=>c.id==='E14'&&!c.eligible&&!c.owned));
  for(const id of added){const detail=growthDetail(id,g,b);assert.doesNotMatch(detail.body,/undefined|NaN/);assert(growthCardSummary(id,g,b).benefit.length>0);}
 }
});

test('normal44 area eligibility needs actual beneficiaries while all three area attributes remain legal at rank100',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);
  assert.equal(growthCardEligible('A07',zero,b),cat==='CAT03');assert(!growthCardEligible('A08',zero,b));
  for(const id of ['A07','A08','A10'] as const){assert(growthCardEligible(id,{...zero,C15:1,[id]:100},b));assert.equal(growthCards(b).find(c=>c.id===id)!.limit,null);}
  for(const id of ['C15','C16'] as const){assert(growthCardEligible(id,zero,b));assert(!growthCardEligible(id,{...zero,[id]:1},b));}
  for(const ranks of [zero,{...zero,C15:1},{...zero,C16:1}])assert(!growthCardEligible('E16',ranks,b));
  assert(growthCardEligible('E16',{...zero,C15:1,C16:1},b));assert(!growthCardEligible('E16',{...zero,C15:1,C16:1,E16:1},b));
 }
});

test('synthetic long normal queues allow 100 actual purchases of each area attribute without an empty offer',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);let value=17;const g=new RunGrowth(17,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},b);
  // This is capacity stress, not an assertion that a ten-minute run supplies this XP.
  g.collect(2000000);let complete=false;
  for(let i=0;i<1500;i++){
   const s=g.snapshot(),offer=s.offer!;assert(offer);assert.equal(new Set(offer.choices).size,3);
   for(const id of offer.choices)assert(growthCardEligible(id,s.ranks,b));
   const repeated=(['A07','A08','A10'] as const).filter(id=>growthRank(s.ranks,id)<100);
   if(!repeated.length){complete=true;break;}
   const id=(!s.ranks.C15&&offer.choices.includes('C15')?'C15':undefined)??repeated.find(id=>offer.choices.includes(id))??offer.choices.find(id=>!['A07','A08','A10'].includes(id))!;
   assert(g.confirm(17,offer.id,id));assert(!g.confirm(17,offer.id,id));
  }
  assert(complete,cat+' must complete 100 selections of all three repeatable attributes');
  for(const id of ['A07','A08','A10'] as const)assert.equal(g.snapshot().ranks[id],100);
 }
});

test('real normal selections unlock E16, reserve its advanced slot and never award it automatically',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);let value=9;const g=new RunGrowth(9,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},b);g.collect(1266);
  let unlocked=false;
  for(let i=0;i<34;i++){
   const s=g.snapshot(),offer=s.offer!;assert(offer);assert.equal(growthRank(s.ranks,'E16'),0);
   if(s.ranks.C15&&s.ranks.C16){assert(offer.choices.includes('E16'));assert(g.confirm(9,offer.id,'E16'));assert.equal(g.snapshot().ranks.E16,1);unlocked=true;break;}
   assert(!offer.choices.includes('E16'));
   const selected=(['C15','C16'] as const).find(id=>offer.choices.includes(id))??offer.choices.find(id=>growthCards(b).find(c=>c.id===id)!.kind==='attribute')??offer.choices[0];
   assert(g.confirm(9,offer.id,selected));
  }
  assert(unlocked,cat+' must reach fusion by actual rewards');
 }
});

test('normal v14 current orbit text includes A08 while controlled scopes retain their own area marker',()=>{
 for(const b of [normal(),{...legacy33(),areaAbilities:{enabled:true as const}}]){
  const g={...new RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,L1_ORBIT_BELL:1,A08:2,L1_DUO_STAR_RING:1}};
  assert.match(growthDetail('L1_ORBIT_BELL',g,b,{source:'owned'}).body,/66u半径/);
  assert.match(growthDetail('L1_DUO_STAR_RING',g,b,{source:'owned'}).body,/88u半径/);
 }
 const g={...new RunGrowth(1,()=>0,legacy33()).snapshot(),ranks:{...zero,L1_ORBIT_BELL:1,A08:2}};
 assert.match(growthDetail('L1_ORBIT_BELL',g,legacy33(),{source:'owned'}).body,/60u半径/);
});


test('normal44 never admits the six later controlled identities',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon),g=new RunGrowth(1,()=>0,b);g.collect(8);
  for(const id of ['C21','M10','R04','R05','R06','R07']){
   assert(!growthCards(b).some(card=>card.id===id));
   assert(!growthCardEligible(id as GrowthId,prerequisites,b));
   assert(!g.confirm(1,g.snapshot().offer!.id,id));
  }
 }
});

test('normal44 defense keeps actual beneficiary and purchased prerequisite boundaries',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);
  for(const id of ['A13','C13','C12'] as const)assert(growthCardEligible(id,zero,b),id);
  assert(growthCardEligible('A13',{...zero,A13:100},b));
  assert.equal(growthCardEligible('A16',zero,b),cat==='CAT03');
  assert(growthCardEligible('A16',{...zero,C12:1,A16:100},b));
  for(const id of ['C12','C13'] as const)assert(!growthCardEligible(id,{...zero,[id]:1},b));
  for(const id of ['A07','A08','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'] as const){
   assert.equal(growthCardEligible(id,{...zero,C13:1},b),id==='A07'&&cat==='CAT03','shield gives no damage-core qualification: '+id);
   assert.equal(growthCardEligible(id,{...zero,C12:1},b),id!=='A08','sentinel is a damage core without area: '+id);
  }
  for(const r of [zero,{...zero,C12:1},{...zero,C13:1}])assert(!growthCardEligible('E14',r,b),'native spirit never substitutes for C12');
  assert(growthCardEligible('E14',{...zero,C12:1,C13:1},b));
  assert(!growthCardEligible('E14',{...zero,C12:1,C13:1,E14:1},b));
 }
});

test('real normal44 purchases reserve and rotate E14 without awarding it before confirmation',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);let value=27;const g=new RunGrowth(27,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},b);
  // Synthetic queue verifies transactions and rotation, not ten-minute XP availability.
  g.collect(2_000_000);let acquired=false;
  for(let i=0;i<200;i++){
   const s=g.snapshot(),offer=s.offer!;assert(offer);
   assert.equal(growthRank(s.ranks,'E14'),0);assert.equal(growthRank(s.ranks,'E16'),0);
   if(!s.ranks.C12||!s.ranks.C13)assert(!offer.choices.includes('E14'));
   if(['C12','C13','C15','C16'].every(id=>growthRank(s.ranks,id as GrowthId)>0)){acquired=true;break;}
   const id=(['C12','C13','C15','C16'] as const).find(id=>!s.ranks[id]&&offer.choices.includes(id))??offer.choices.find(id=>growthCards(b).find(c=>c.id===id)!.kind==='attribute')!;
   assert(g.confirm(27,offer.id,id));assert(!g.confirm(27,offer.id,id));
  }
  assert(acquired,cat+' acquires all four real cores');
  const shown=new Set<GrowthId>(),rotation:GrowthId[]=[];let confirmed=false;
  // Earlier eligibility may have accumulated up to 200 views of one combination.
  // Let the less-seen combination catch up before checking alternating offers.
  for(let i=0;i<212;i++){
   const s=g.snapshot(),offer=s.offer!,advanced=offer.choices.filter(id=>id==='E14'||id==='E16');
   assert.equal(advanced.length,1);shown.add(advanced[0]);assert.equal(growthRank(s.ranks,'E14'),0);
   if(shown.size===2){rotation.push(advanced[0]);if(rotation.length>1)assert.notEqual(rotation[rotation.length-1],rotation[rotation.length-2]);}
   g.collect(0);const detached=g.snapshot();detached.offer!.choices.length=0;assert.deepEqual(g.snapshot(),s);
   if(rotation.length>=6&&offer.choices.includes('E14')){
    assert(!g.confirm(28,offer.id,'E14'));assert(g.confirm(27,offer.id,'E14'));assert(!g.confirm(27,offer.id,'E14'));confirmed=true;break;
   }
   const id=offer.choices.find(id=>growthCards(b).find(c=>c.id===id)!.kind==='attribute')!;assert(g.confirm(27,offer.id,id));
  }
  assert.deepEqual([...shown].sort(),['E14','E16']);assert(rotation.length>=6);assert(confirmed);assert.equal(g.snapshot().ranks.E14,1);
  assert(!g.snapshot().offer!.choices.includes('E14'));
  const restart=new RunGrowth(28,()=>0,b).snapshot();assert.deepEqual(restart.ranks,zero);assert.equal(restart.offer,null);assert.equal(restart.totalXP,0);
 }
});

test('normal44 queues allow 100 actual A13 and A16 purchases while sentinel and shield remain one-off',()=>{
 for(const [cat,weapon]of pairs){
  const b=normal(cat,weapon);let value=8;const g=new RunGrowth(8,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},b);g.collect(2_000_000);
  let complete=false;
  for(let i=0;i<2000;i++){
   const s=g.snapshot(),offer=s.offer!;assert(offer);assert.equal(new Set(offer.choices).size,3);
   for(const id of offer.choices)assert(growthCardEligible(id,s.ranks,b));
   if(s.ranks.C12&&s.ranks.C13&&growthRank(s.ranks,'A13')>=100&&growthRank(s.ranks,'A16')>=100){complete=true;break;}
   const id=(['C12','C13'] as const).find(id=>!s.ranks[id]&&offer.choices.includes(id))??(['A13','A16'] as const).find(id=>growthRank(s.ranks,id)<100&&offer.choices.includes(id))??offer.choices.find(id=>!['A13','A16'].includes(id))!;
   assert(g.confirm(8,offer.id,id));assert(!g.confirm(8,offer.id,id));
  }
  assert(complete,cat+' completes both repeatable attributes');
  const s=g.snapshot();for(const id of ['A13','A16'] as const)assert.equal(s.ranks[id],100);for(const id of ['C12','C13'] as const)assert.equal(s.ranks[id],1);
 }
});
