import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunGrowth,experienceNeeded,dropExperience,deriveGrowthConfig,GROWTH_ROUTES,GROWTH_CARDS} from '../src/progression';
import {Session} from '../src/rules';
import {makeRunConfig} from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import * as Growth from '../src/progression';
import {growthPage,growthBuild,growthDetail,growthChange} from '../src/ui/progression';
const base=()=>courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
const zeroRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const fixedRuns=()=>[makeRunConfig('CAT01','W01','p2-basic'),makeRunConfig('CAT02','W04','p2-basic'),makeRunConfig('CAT03','W02','p2-basic')];
test('G4 neutral names retain all twenty runtime IDs and the two independently named bell skills',()=>{
 const labels={L1_DAMAGE:'力量增幅',L1_RATE:'攻击节奏',L1_RANGE:'远距感知',L1_SPLIT:'多重投射',L1_SHOCK_BELL:'震荡回响',L1_RICOCHET:'折射弹道',L1_TRAIL_BELL:'猫步留铃',L1_ORBIT_BELL:'环身飞铃'};
 assert.equal(GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id)).length,20);for(const [id,name] of Object.entries(labels))assert.equal(GROWTH_CARDS.find(c=>c.id===id)!.name,name);
});
test('G4 split adds pellets without reducing total volley damage for any fixed weapon; barrage applies the same factor once',()=>{
 for(const b of fixedRuns()){
  const split=deriveGrowthConfig(b,{...zeroRanks,L1_SPLIT:1}),barrage=deriveGrowthConfig(b,{...zeroRanks,L1_SPLIT:1,L1_EVO_BARRAGE:1});
  const factor=Math.max(.8,b.weapon.pellets/(b.weapon.pellets+1));
  assert.equal(split.weapon.pellets,b.weapon.pellets+1);assert.equal(barrage.weapon.pellets,b.weapon.pellets+2);
  assert.equal(split.weapon.damage,b.weapon.damage*factor);assert.equal(barrage.weapon.damage,split.weapon.damage);
  assert(split.weapon.damage*split.weapon.pellets>=b.weapon.damage*b.weapon.pellets);
  assert.equal(split.weapon.spreadDegrees,b.weapon.spreadDegrees+8);
 }
});
test('G4 native piercing stacks with core and evolution without reducing the weapon native allowance',()=>{
 const b=makeRunConfig('CAT02','W04','p2-basic');
 assert.equal(deriveGrowthConfig(b,{...zeroRanks,L1_PIERCE:1}).weapon.extraPierce,3);
 assert.equal(deriveGrowthConfig(b,{...zeroRanks,L1_PIERCE:1,L1_EVO_PIERCE:1}).weapon.extraPierce,4);
 assert.equal(b.weapon.extraPierce,2);
});
test('G4 light magazine halves each base magazine with upward rounding and never increases capacity',()=>{
 for(const b of fixedRuns())for(const capacity of [b.weapon.ammoCapacity,1,3]){
  const custom={...b,weapon:{...b.weapon,ammoCapacity:capacity}},c=deriveGrowthConfig(custom,{...zeroRanks,L1_ECHO:1,L1_LIGHT_MAG:1,L1_RELOAD:2});
  assert.equal(c.weapon.ammoCapacity,Math.max(1,Math.ceil(capacity/2)));assert(c.weapon.ammoCapacity<=capacity);
  assert.equal(c.weapon.reloadSeconds,b.weapon.reloadSeconds/1.4*.8);
 }
});
test('G4 independent ability damage uses twelve and global growth across all weapons and ignores direct and projectile modifiers',()=>{
 for(const b of fixedRuns())for(const directDamageMultiplier of [.9,1,1.8]){
  assert.equal(Growth.abilityDamage({...b,directDamageMultiplier},{...zeroRanks,L1_DAMAGE:2,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_PIERCE:1}),12*1.4);
 }
});
test('G4 default experience produces 28 upgrades plus two independent elite rewards at the 886 XP benchmark',()=>{
 const g=new RunGrowth(1,()=>0);g.collect(886);g.queueElite('elite-1',1);g.queueElite('elite-2',2);
 const s=g.snapshot();assert.equal(s.level,29);assert.equal(s.pending,30);assert.equal(s.xp,7);assert.equal(s.totalXP,886);assert.equal(s.elitePending.length,2);
 const upper=new RunGrowth(2,()=>0);upper.collect(1266);assert.equal(upper.snapshot().level,35);assert.equal(upper.snapshot().pending,34);
});
test('G4 A and B derive all six attributes independently without mutating the frozen base or default plan',()=>{
 const b=base(),r={...zeroRanks,L1_DAMAGE:2,L1_RATE:2,L1_HEART:2,L1_RELOAD:2,L1_RANGE:2,L1_MOVE:2};
 for(const [attributePlan,amounts] of [['A',[.2,.15,15,.2,.15,.1]],['B',[.1,.08,8,.1,.08,.05]]] as const){
  const config={...b,growthTuning:{attributePlan,xpTarget:28 as const}},c=deriveGrowthConfig(config,r),[damage,rate,heart,reload,range,move]=amounts;
  assert.equal(c.weapon.damage,b.weapon.damage*(1+2*damage));assert.equal(c.weapon.intervalSeconds,b.weapon.intervalSeconds/(1+2*rate));
  assert.equal(c.maxHp,b.maxHp+2*heart);assert.equal(c.weapon.reloadSeconds,b.weapon.reloadSeconds/(1+2*reload));
  assert.equal(c.weapon.targetRange,b.weapon.targetRange*(1+2*range));assert.equal(c.moveSpeed,b.moveSpeed*(1+2*move));
  assert.equal(Growth.abilityDamage(config,r),12*(1+2*damage));
 }
 assert.equal(deriveGrowthConfig(b,r).weapon.damage,12*1.4);assert.equal(b.maxHp,90);
});
test('G4 diagnostic XP targets stay explicit and report their chosen attribute plan',()=>{
 for(const xpTarget of [20,28,36] as const){
  const g=new RunGrowth(1,()=>0,{...base(),growthTuning:{attributePlan:'B',xpTarget}});g.collect(886);
  assert.equal(g.snapshot().level,xpTarget+1);assert.equal(g.snapshot().pending,xpTarget);
  assert.equal(g.snapshot().attributePlan,'B');assert.equal(g.snapshot().xpTarget,xpTarget);
 }
});
test('G4 B HEART confirms its smaller actual health gain before the separate elite recovery',()=>{
 const config={...base(),growthTuning:{attributePlan:'B' as const,xpTarget:28 as const}},session=new Session(config),g=new RunGrowth(1,()=>.2,config);
 session.damage(80);session.pause('upgrade');g.queueElite('elite-1',1);g.openOffer();const o=g.snapshot().offer!;
 assert(g.confirm(1,o.id,'L1_HEART',(r,source)=>session.applyGrowthReward(r,source==='elite'?.2:0)));
 assert.equal(session.effectiveConfig.maxHp,98);assert.equal(session.hp,37.6);assert.equal(g.snapshot().eliteRewards[0].recovered,19.6);
 assert(!g.confirm(1,o.id,'L1_HEART',(r)=>session.applyGrowthReward(r,.2)));assert.equal(session.hp,37.6);
});
test('G4 every fixed pair completes 34 actual experience choices and two elites with unique legal offers',()=>{
 for(const config of fixedRuns())for(let seed=1;seed<=30;seed++){
  let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const g=new RunGrowth(seed,random,config);g.collect(1266);g.queueElite('elite-1',1);g.queueElite('elite-2',2);let experience=0,elite=0;
  while(g.snapshot().offer){const s=g.snapshot(),o=s.offer!;assert.equal(new Set(o.choices).size,3);
   assert(o.choices.every(id=>Growth.growthCardEligible(id,s.ranks,config)));o.source==='elite'?elite++:experience++;
   const id=o.choices[0];assert(g.confirm(seed,o.id,id));assert(!g.confirm(seed,o.id,id));
  }
  assert.equal(experience,34);assert.equal(elite,2);assert.equal(g.snapshot().totalXP,1266);assert.equal(g.snapshot().pending,0);
 }
});
test('G4 all fixed pairs retain the same twenty legal cards through actual prerequisite state',()=>{
 const r={...zeroRanks,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_RANGE:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1};
 for(const b of fixedRuns())for(const card of GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id))){
  const ranks={...r,[card.id]:0};
  assert.equal((Growth as any).growthCardEligible?.(card.id,ranks,b),true,b.weaponId+' '+card.id);
 }
});
test('G4 missing projectile or magazine capability excludes its cards from offers and rejects a forged confirmation',()=>{
 const b=base(),cases=[
  {weapon:{...b.weapon,pellets:0},blocked:['L1_SPLIT','L1_PIERCE','L1_ECHO','L1_EVO_BARRAGE','L1_EVO_PIERCE','L1_EVO_CADENCE','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME','L1_RANGE']},
  {weapon:{...b.weapon,ammoCapacity:0},blocked:['L1_ECHO','L1_EVO_CADENCE','L1_LIGHT_MAG','L1_DUO_TRAIL_CADENCE','L1_RELOAD']},
  {weapon:{...b.weapon,bulletSpeed:NaN},blocked:['L1_SPLIT','L1_PIERCE','L1_ECHO','L1_PICKUP_CHIME']},
  {weapon:{...b.weapon,reloadSeconds:Infinity},blocked:['L1_ECHO','L1_LIGHT_MAG','L1_RELOAD']}
 ];
 for(const c of cases){
  const g:any=new RunGrowth(1,()=>0,{...b,weapon:c.weapon});g.collect(10000);
  g.ranks={...zeroRanks,L1_DAMAGE:2,L1_RATE:2,L1_RELOAD:2,L1_RANGE:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1};
  g.offer=null;g.openOffer();assert(g.snapshot().offer.choices.every((id:string)=>!c.blocked.includes(id)));
  for(const id of c.blocked){g.ranks[id]=0;g.offer={id:999,choices:[id],source:'experience'};assert.equal(g.confirm(1,999,id),false,id);}
 }
});
test('elite facts are deduplicated, stable ordered before unopened XP and never replace an open offer',()=>{
 const g:any=new RunGrowth(7,()=>0);
 assert.equal(typeof g.queueElite,'function');
 assert(g.queueElite('elite-2',12));assert(g.queueElite('elite-1',11));assert(!g.queueElite('elite-1',11));assert(!g.queueElite('elite-1',99));assert(!g.queueElite('forged-encounter',11));
 g.collect(8);let s=g.snapshot();assert.equal(s.level,2);assert.equal(s.totalXP,8);assert.equal(s.pending,3);assert.equal(s.offer.source,'elite');assert.equal(s.offer.encounterId,'elite-1');
 const first=s.offer;assert(g.confirm(7,first.id,'L1_SPLIT'));s=g.snapshot();assert.equal(s.offer.encounterId,'elite-2');assert.equal(s.eliteRewards.length,1);
 assert(g.confirm(7,s.offer.id,'L1_DAMAGE'));s=g.snapshot();assert.equal(s.offer.source,'experience');assert.equal(s.level,2);assert.equal(s.pending,1);
 const frozen=JSON.stringify(s.offer);assert(g.queueElite('elite-3',13));g.openOffer();assert.equal(JSON.stringify(g.snapshot().offer),frozen);
});
test('elite confirmation atomically applies HEART then twenty percent of new maximum and logs actual capped healing',()=>{
 const g:any=new RunGrowth(1,()=>.2),s:any=new Session(base());s.damage(80);s.pause('upgrade');g.queueElite('elite-1',20);g.openOffer();
 const offer=g.snapshot().offer;assert(offer.choices.includes('L1_HEART'));
 assert(!g.confirm(1,offer.id,'L1_HEART',()=>false));assert.equal(s.hp,10);assert.equal(g.snapshot().ranks.L1_HEART,0);
 assert(g.confirm(1,offer.id,'L1_HEART',(r:any,source:any)=>s.applyGrowthReward(r,source==='elite'?.2:0)));
 assert.equal(s.hp,46);assert.equal(s.snapshot().maxHp,105);assert.equal(g.snapshot().eliteRewards[0].recovered,21);
 assert(!g.confirm(1,offer.id,'L1_HEART',(r:any)=>s.applyGrowthReward(r,.2)));assert.equal(s.hp,46);
 const full:any=new Session(base());assert.equal(full.applyGrowthReward({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0},.2),0);
 full.damage(1000);assert.equal(full.applyGrowthReward({L1_DAMAGE:0,L1_RATE:0,L1_HEART:1},.2),false);assert.equal(full.hp,0);
 assert.match(growthBuild(g.snapshot()),/精英战利品/);assert.match(growthBuild(g.snapshot()),/21/);
});
test('approved XP curve and only ordinary enemies pay experience',()=>{
 assert.deepEqual([1,2,3,4,5,6,7].map(level=>experienceNeeded(level)),[8,10,12,14,15,17,19]);
 assert.deepEqual(['E01','E02','E03','E04','EL01','B01','object'].map(dropExperience),[2,0,2,3,0,0,0]);
});
test('carry XP, queue offers, stable candidates and reject duplicate/stale decisions',()=>{
 let calls=0;const g=new RunGrowth(7,()=>{calls++;return .4;});g.collect(25);
 let s=g.snapshot();assert.equal(s.level,3);assert.equal(s.xp,7);assert.equal(s.pending,2);
 const offer=s.offer!;assert.equal(new Set(offer.choices).size,3);const before=calls;
 assert.deepEqual(g.snapshot().offer,offer);assert.equal(calls,before);
 const chosen=offer.choices[0];assert.equal(g.confirm(6,offer.id,chosen),false);
 assert.equal(g.confirm(7,offer.id,chosen),true);assert.equal(g.snapshot().pending,1);
 assert.equal(g.confirm(7,offer.id,chosen),false);assert.equal(g.snapshot().ranks[chosen],1);
 const next=g.snapshot().offer!;assert.notEqual(next.id,offer.id);assert.equal(g.confirm(7,next.id,next.choices[0]),true);
 assert.equal(g.snapshot().offer,null);assert.equal(g.snapshot().pending,0);
});
test('basic damage and rate remain real choices beyond the third selection',()=>{
 const g=new RunGrowth(1,()=>0);g.collect(1000);
 for(const id of ['L1_DAMAGE','L1_DAMAGE','L1_DAMAGE','L1_DAMAGE','L1_RATE','L1_RATE','L1_RATE','L1_RATE']){
  const o=g.snapshot().offer!;assert(o.choices.includes(id as any));assert(g.confirm(1,o.id,id));
 }
 const s=g.snapshot(),c=deriveGrowthConfig(base(),s.ranks);assert.equal(s.ranks.L1_DAMAGE,4);assert.equal(s.ranks.L1_RATE,4);
 assert(Math.abs(c.weapon.damage-21.6)<1e-8);assert.equal(c.weapon.intervalSeconds,.5);assert(s.offer);
});

test('core is offered early, immediately changes projectiles, and is only acquired once',()=>{
 const g=new RunGrowth(1,()=>.1);g.collect(1000);const o=g.snapshot().offer!;
 assert(o.choices.includes('L1_SPLIT' as any));assert(g.confirm(1,o.id,'L1_SPLIT'));
 const s=g.snapshot(),c=deriveGrowthConfig(base(),s.ranks);
 assert.equal(c.weapon.pellets,2);assert.equal(c.weapon.spreadDegrees,8);assert(Math.abs(c.weapon.damage-9.6)<1e-8);
 assert(!s.offer!.choices.includes('L1_SPLIT' as any));assert(!g.confirm(1,s.offer!.id,'L1_SPLIT'));
});

test('two related picks unlock the next offer evolution; rejecting preserves eligibility',()=>{
 const g=new RunGrowth(3,()=>0);g.collect(1000);
 for(const id of ['L1_SPLIT','L1_DAMAGE','L1_RATE']){const o=g.snapshot().offer!;assert(g.confirm(3,o.id,id));}
 let o=g.snapshot().offer!;assert(o.choices.includes('L1_EVO_BARRAGE' as any));
 assert(g.confirm(3,o.id,'L1_DAMAGE'));o=g.snapshot().offer!;assert(o.choices.includes('L1_EVO_BARRAGE' as any));
 assert(g.confirm(3,o.id,'L1_EVO_BARRAGE'));const s=g.snapshot(),c=deriveGrowthConfig(base(),s.ranks);
 assert.equal(c.weapon.pellets,3);assert.equal(c.weapon.spreadDegrees,8);assert(Math.abs(c.weapon.damage-12*1.4*.8)<1e-8);
 assert(!s.offer!.choices.includes('L1_EVO_BARRAGE' as any));assert(!g.confirm(3,o.id,'L1_EVO_BARRAGE'));
});

test('support before core counts and two copies of one support qualify, heart does not',()=>{
 let draw=0;const g=new RunGrowth(1,()=>draw);g.collect(1000);
 assert(g.confirm(1,g.snapshot().offer!.id,'L1_DAMAGE'));draw=0;
 assert(g.confirm(1,g.snapshot().offer!.id,'L1_DAMAGE'));
 assert(g.confirm(1,g.snapshot().offer!.id,'L1_SPLIT'));
 assert(g.snapshot().offer!.choices.includes('L1_EVO_BARRAGE' as any));
 let heartDraw=0;const onlyHeart=new RunGrowth(2,()=>heartDraw);onlyHeart.collect(1000);heartDraw=.2;
 for(const id of ['L1_SPLIT','L1_HEART','L1_HEART','L1_HEART','L1_HEART'])assert(onlyHeart.confirm(2,onlyHeart.snapshot().offer!.id,id));
 assert(!onlyHeart.snapshot().offer!.choices.includes('L1_EVO_BARRAGE' as any));
 assert.equal(deriveGrowthConfig(base(),onlyHeart.snapshot().ranks).maxHp,150);
});

test('1000 seeded short-run sequences preserve unique legal offers, core chance and reachable evolution',()=>{
 for(let seed=1;seed<=1000;seed++){
  let value=seed;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  for(const picks of [5,6,7]){
   const g=new RunGrowth(seed,random);g.collect(1000);
   const route=g.snapshot().routes.find(r=>g.snapshot().offer!.choices.includes(r.core))!;assert(route);
   for(let i=0;i<picks;i++){
    const s=g.snapshot(),o=s.offer!;assert.equal(o.choices.length,3);assert.equal(new Set(o.choices).size,3);
    assert(o.choices.some(id=>!['L1_HEART','L1_MOVE'].includes(id)));
    const id=([route.evolution,...route.supports,route.core] as readonly string[]).find(id=>o.choices.includes(id as any))||o.choices[0];
    const chosen=i===0?route.core:id;
    assert(g.confirm(seed,o.id,chosen));assert(!g.confirm(seed,o.id,chosen));
   }
   if(route.evolution)assert.equal(g.snapshot().ranks[route.evolution],1);else assert(!g.snapshot().routes.find(r=>r.core===route.core)!.eligible);
  }
 }
});

test('evolution cannot appear before core or be selected by forging an offered id',()=>{
 const g=new RunGrowth(1,()=>0);g.collect(1000);
 for(let i=0;i<5;i++){const o=g.snapshot().offer!;assert(!o.choices.includes('L1_EVO_BARRAGE' as any));assert(!g.confirm(1,o.id,'L1_EVO_BARRAGE'));assert(g.confirm(1,o.id,'L1_DAMAGE'));}
});
test('stats always derive from frozen base and reload is unaffected by fire-rate growth',()=>{
 const b=base(),g=new RunGrowth(1,()=>0);g.collect(8);g.confirm(1,g.snapshot().offer!.id,'L1_RATE');
 const config=deriveGrowthConfig(b,g.snapshot().ranks);assert.equal(b.weapon.intervalSeconds,.8);assert.equal(config.weapon.intervalSeconds,.8/1.15);assert(Object.isFrozen(b));
 const session=new Session(b);session.step(0,{x:1,y:0});session.advance(.2);const before=session.snapshot();
 session.applyGrowth(g.snapshot().ranks);assert(Math.abs(session.snapshot().cooldown-before.cooldown/1.15)<1e-8);assert.equal(session.shots,1);assert.equal(session.ammo,b.weapon.ammoCapacity-1);
 session.applyGrowth(g.snapshot().ranks);assert.equal(session.hp,b.maxHp);
});
test('heart heals its new rank once; cannot resurrect or grow terminal sessions',()=>{
 const session=new Session(base());session.damage(40);session.pause('upgrade');
 const ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:1};session.applyGrowth(ranks);assert.equal(session.hp,65);assert.equal(session.snapshot().maxHp,105);
 session.applyGrowth(ranks);assert.equal(session.hp,65);session.resume();assert.deepEqual(session.reasons,['upgrade']);
 session.finishUpgrade();session.damage(1000);session.applyGrowth({...ranks,L1_HEART:2});assert.equal(session.hp,0);assert.equal(session.result,'death');
});

test('upgrading during reload preserves remaining time, ammo and in-flight cadence',()=>{
 const s=new Session(base());for(let i=0;i<12;i++)s.step(i===0?0:.8,{x:1,y:0});
 assert.equal(s.ammo,0);s.advance(.3);const before=s.snapshot();s.pause('upgrade');
 s.applyGrowth({L1_DAMAGE:1,L1_RATE:1,L1_HEART:0});assert.equal(s.reloadLeft,before.reloadLeft);assert.equal(s.ammo,0);assert.equal(s.shots,before.shots);
 s.finishUpgrade();s.step(before.reloadLeft-.01,{x:1,y:0});assert.equal(s.ammo,0);s.step(.011,{x:1,y:0});assert.equal(s.reloadCompletions,1);
});

test('real cards distinguish core and evolution, show repeatable counts and actual split damage',()=>{
 const g=new RunGrowth(1,()=>0);g.collect(1000);
 assert.match(growthPage(g.snapshot(),base()).body,/新能力/);
 assert.match(growthChange('L1_SPLIT' as any,g.snapshot(),base()),/9\.6/);
 for(const id of ['L1_SPLIT','L1_DAMAGE','L1_DAMAGE'])assert(g.confirm(1,g.snapshot().offer!.id,id));
 assert.match(growthPage(g.snapshot(),base()).body,/进阶/);assert.match(growthBuild(g.snapshot()),/可进阶/);
 assert(g.confirm(1,g.snapshot().offer!.id,'L1_EVO_BARRAGE'));
 for(let i=0;i<2;i++)assert(g.confirm(1,g.snapshot().offer!.id,'L1_DAMAGE'));
 const html=growthBuild(g.snapshot());assert.match(html,/已选4次/);assert.match(html,/已进阶/);assert(!html.includes('/null'));
 assert(!growthDetail('L1_DAMAGE').body.includes('最多等级'));
});

test('reachable six-pick courtyard combinations fit the native 24-projectile pool even if every volley had a secondary',()=>{
 let combinations=0,peakUpperBound=0;
 for(const core of [0,1])for(const evolution of [0,1])for(let rate=0;rate<=6;rate++)for(let damage=0;damage<=6;damage++){
  const cost=core+evolution+rate+damage;
  if(cost>6||evolution&&(!core||rate+damage<2))continue;
  const c=deriveGrowthConfig(base(),{L1_DAMAGE:damage,L1_RATE:rate,L1_HEART:0,L1_SPLIT:core,L1_EVO_BARRAGE:evolution});
  // A conservative full-lifetime window, including both endpoints and one
  // secondary EVERY volley (the actual passive only fires once per reload).
  const bound=(c.weapon.pellets+1)*(Math.ceil(c.weapon.bulletLifeSeconds/c.weapon.intervalSeconds)+1);
  assert(bound<=24);peakUpperBound=Math.max(peakUpperBound,bound);combinations++;
 }
 assert(combinations>50);assert.equal(peakUpperBound,16);
});

test('G3 orbit card, detail and shared build/result show actual current and next rank',()=>{
 for(const rank of [0,1,2,3]){const g:any=new RunGrowth(1,()=>0);g.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:rank};g.pending=1;g.offer={id:1,choices:['L1_ORBIT_BELL','L1_DAMAGE','L1_HEART']};const s=g.snapshot();
  if(rank<3){const change=growthChange('L1_ORBIT_BELL',s,base());assert.match(change,new RegExp((rank?rank+1:0)+' → '+(rank+2)+' 枚'));if(rank)assert.match(change,new RegExp((rank===1?'0.8 → 0.7':'0.7 → 0.5')+'秒'));
   const page=growthPage(s,base()).body;const orbit=page.slice(page.indexOf('data-action="growth-select:1.1.L1_ORBIT_BELL"'),page.indexOf('查看规则'));if(rank)assert(!orbit.includes('新能力'));
  }
  const detail=growthDetail('L1_ORBIT_BELL',s).body;assert(!detail.includes('本局获得一次'));assert.match(detail,/最高3级/);
  if(rank){const build=growthBuild(s);assert.match(build,new RegExp('Lv.'+rank));assert.match(build,new RegExp((rank+1)+'枚'));assert.match(build,new RegExp((rank===1?'0.8':rank===2?'0.7':'0.5')+'秒'));}
 }
});
test('G3 main UI shares actual rank damage, haste, permanent finite trails and attribute scope',()=>{
 const g:any=new RunGrowth(1,()=>0);g.ranks={L1_DAMAGE:2,L1_RATE:3,L1_HEART:0,L1_ORBIT_BELL:3,L1_TRAIL_BELL:1,L1_DUO_TRAIL_CADENCE:1,L1_DUO_STAR_RING:1};
 const s=g.snapshot(),build=growthBuild(s),detail=growthDetail('L1_ORBIT_BELL',s).body;
 for(const text of [build,detail]){assert.match(text,/140%/);assert.match(text,/1.655/);assert.match(text,/0.345/);}
 assert.match(growthChange('L1_DUO_STAR_RING',s,base()),/35.28/);
 assert.match(growthChange('L1_RATE',s,base()),/环铃/);assert.match(growthChange('L1_DAMAGE',s,base()),/铃术/);
 assert.match(build,/最多9枚/);assert.match(build,/长期留存/);assert.match(growthDetail('L1_TRAIL_BELL',s).body,/替换最早/);
 assert.match(GROWTH_CARDS.find(c=>c.id==='L1_RATE')!.detail,/环铃/);assert.match(GROWTH_CARDS.find(c=>c.id==='L1_DAMAGE')!.detail,/铃术/);
});
