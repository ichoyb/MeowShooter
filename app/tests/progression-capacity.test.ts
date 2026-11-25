import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import * as CombatConfig from '../src/combat-config';
import {GROWTH_NUMBERS as N} from '../src/progression-content';
import {courtyardRunConfig} from '../src/level-config';
import {deriveGrowthConfig,type GrowthRanks} from '../src/progression';
import {Session} from '../src/rules';
import {CatPassives} from '../src/cat-passives';
import {WeaponBursts} from '../src/weapon-bursts';
import {BellAbilityState} from '../src/bell-ability-rules';
import {projectileCapacityForGrowth} from '../src/progression-capacity';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const allEmitters={L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1};
const runs=()=>[courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),courtyardRunConfig(makeRunConfig('CAT03','W02','p2-basic')),courtyardRunConfig(makeRunConfig('CAT02','W04','p2-basic'))];
type LiveEmission={until:number;count:number};
type Change={ready:(session:Session)=>boolean;ranks:GrowthRanks};

// This is a rules-only emission ledger, not a runtime entity pool. Session,
// WeaponBursts, CatPassives and BellAbilityState decide every emitted source.
// Assume no hit or boundary ever removes a shot, so only its original lifespan
// removes it. The real Scene's Clock runs before the same frame's new volleys.
function observe(base:RunConfig,initial:GrowthRanks,changes:Change[]=[],seconds=24,dt=1/240){
 const session=new Session(base),passives=new CatPassives(base),bursts=new WeaponBursts(),ability=new BellAbilityState();
 let ranks={...initial},live:LiveEmission[]=[],pending:{at:number;until:number;count:number}[]=[],peak=0,highestCapacity=0,transitions=0,transitionOccupancy=0;
 let primary=0,secondary=0,summon=0;session.applyGrowth(ranks);
 for(let frame=0;frame*dt<seconds;frame++){
  const change=changes[transitions];
  if(change?.ready(session)){
   session.pause('upgrade');ranks={...change.ranks};session.applyGrowth(ranks);session.finishUpgrade();transitions++;
   transitionOccupancy=Math.max(transitionOccupancy,live.reduce((sum,entry)=>sum+entry.count,0));
  }
  const config=session.effectiveConfig,capacity=projectileCapacityForGrowth(base,config,ranks);
  highestCapacity=Math.max(highestCapacity,capacity);
  // A ready chime on every volley is an explicit pressure fixture. It does not
  // claim that a natural run can continuously collect eight XP this quickly.
  ability.collect(8,!!ranks.L1_PICKUP_CHIME);
  const volley=session.step(dt,{x:1,y:0});
  live=live.filter(entry=>entry.until>session.elapsed);
  passives.syncReloads(session.reloadCompletions);
  if(volley){
   const opening=passives.onVolley(volley.id,session.reloadCompletions);
   const extra=bursts.onVolley(config,ranks,{id:volley.id,ammo:session.ammo,reloads:session.reloadCompletions,opening}).length;
   const chime=Number(ability.onVolley(volley.id,!!ranks.L1_PICKUP_CHIME));
   primary+=config.weapon.pellets;secondary+=extra+chime;
   live.push({until:session.elapsed+config.weapon.bulletLifeSeconds,count:config.weapon.pellets+extra+chime});
   const rhythm=bursts.onRhythmVolley(config,ranks,{id:volley.id});
   if(rhythm)for(const shot of rhythm.segments)pending.push({at:session.elapsed+rhythm.delay+shot.offset,until:session.elapsed+rhythm.delay+shot.offset+rhythm.life,count:1});
  }
  for(const shot of pending.filter(s=>s.at<=session.elapsed))live.push(shot);pending=pending.filter(s=>s.at>session.elapsed);
  if(passives.spiritAttack(session.elapsed,{x:0,y:0},[{id:1,x:1,y:0,alive:true,kind:'enemy'}])){
   summon++;live.push({until:session.elapsed+config.spirit.bulletLifeSeconds,count:1});
  }
  const active=live.reduce((sum,entry)=>sum+entry.count,0);peak=Math.max(peak,active);
  assert(active<=capacity,JSON.stringify({weapon:base.weaponId,passive:base.passive,at:session.elapsed,active,capacity,ranks}));
 }
 return {peak,highestCapacity,transitions,transitionOccupancy,roots:session.shots,reloads:session.reloadCompletions,primary,secondary,summon};
}

test('base profiles retain at least the existing 24 native projectile slots',()=>{
 for(const base of [makeRunConfig('CAT01','W01','diagnostic'),...runs()])assert.equal(projectileCapacityForGrowth(base,base,zero),24);
});

test('36-investment actual Session emissions survive full lifetimes for every weapon and passive',()=>{
 const vectors:GrowthRanks[]=[
  {...zero,...allEmitters,L1_RATE:30},
  {...zero,...allEmitters,L1_RATE:8,L1_RANGE:17,L1_RELOAD:5},
  {...zero,...allEmitters,L1_RATE:13,L1_RELOAD:17}
 ];
 let exceedsOldPool=false;
 for(const base of runs())for(const ranks of vectors)for(const passive of ['reload-secondary','chill','spirit'] as const){
  assert.equal(Object.values(ranks).reduce((sum,n)=>sum+n,0),36);
  const result=observe({...base,passive},ranks);
  assert(result.roots>12&&result.reloads>=2);assert(result.primary>0&&result.secondary>0);
  assert.equal(result.summon>0,passive==='spirit');exceedsOldPool ||= result.peak>32;
 }
 assert(exceedsOldPool,'the real emission ledger must expose the obsolete 32-slot limit');
});

test('47-investment diagnostic vectors remain bounded without a hardcoded XP or slot ceiling',()=>{
 const vectors:GrowthRanks[]=[
  {...zero,...allEmitters,L1_RATE:41},
  {...zero,...allEmitters,L1_PICKUP_CHIME:0,L1_RATE:12,L1_RANGE:25,L1_RELOAD:5},
  {...zero,...allEmitters,L1_PICKUP_CHIME:0,L1_RATE:26,L1_RELOAD:16}
 ];
 for(const base of runs())for(const ranks of vectors){
  assert.equal(Object.values(ranks).reduce((sum,n)=>sum+n,0),47);
  const result=observe(base,ranks);assert(result.reloads>=2);
 }
 const base=runs()[1],ranks=vectors[1],effective=deriveGrowthConfig(base,ranks);
 assert.equal(projectileCapacityForGrowth(base,effective,ranks),89);
});

test('light magazine acquired with four old volleys flying uses the base magazine in its window bound',()=>{
 const base=runs()[1],before:GrowthRanks={...zero,...allEmitters,L1_LIGHT_MAG:0,L1_RATE:30},after={...before,L1_LIGHT_MAG:1};
 const result=observe(base,before,[{ready:s=>s.shots===4,ranks:after}],8,.001);
 assert.equal(result.transitions,1);assert(result.transitionOccupancy>32);
 const effective=deriveGrowthConfig(base,after);
 // Deliberately forgetting the original four-round magazine underestimates
 // the already emitted shots. This witnesses why current capacity alone fails.
 const lostHistory={...base,weapon:{...base.weapon,ammoCapacity:effective.weapon.ammoCapacity}};
 assert(result.transitionOccupancy>projectileCapacityForGrowth(lostHistory,effective,after));
 assert(result.peak<=projectileCapacityForGrowth(base,effective,after));
});

test('old projectiles remain covered through rate, range, reload and light upgrades at magazine phases',()=>{
 for(const base of runs())for(const phase of [1,base.weapon.ammoCapacity-1,base.weapon.ammoCapacity]){
  const initial:GrowthRanks={...zero,...allEmitters,L1_LIGHT_MAG:0,L1_RATE:8,L1_RANGE:8,L1_RELOAD:8};
  const steps:Change[]=[
   {ready:s=>s.shots>=phase,ranks:{...initial,L1_LIGHT_MAG:1}},
   {ready:s=>s.reloadCompletions>=1,ranks:{...initial,L1_LIGHT_MAG:1,L1_RATE:9}},
   {ready:s=>s.reloadCompletions>=2,ranks:{...initial,L1_LIGHT_MAG:1,L1_RATE:9,L1_RANGE:9}},
   {ready:s=>s.reloadCompletions>=3,ranks:{...initial,L1_LIGHT_MAG:1,L1_RATE:9,L1_RANGE:9,L1_RELOAD:9}}
  ];
  for(const dt of [1/30,1/60,1/240])assert.equal(observe(base,initial,steps,30,dt).transitions,4);
 }
});

test('attribute B and maxed non-projectile skills do not force artificial projectile additions',()=>{
 for(const run of runs()){
  const base={...run,growthTuning:{attributePlan:'B' as const,xpTarget:36 as const}};
  const ranks:GrowthRanks={...zero,...allEmitters,L1_RATE:10,L1_RANGE:10,L1_RELOAD:10};
  const result=observe(base,ranks);assert(result.reloads>=2);
  const effective=deriveGrowthConfig(base,ranks),independent={...ranks,L1_TRAIL_BELL:1,L1_ORBIT_BELL:3,L1_DUO_TRAIL_CADENCE:1,L1_DUO_STAR_RING:1,L1_SHOCK_BELL:1,L1_RICOCHET:1,L1_PIERCE:1,L1_EVO_PIERCE:1};
  assert.equal(projectileCapacityForGrowth(base,effective,ranks),projectileCapacityForGrowth(base,deriveGrowthConfig(base,independent),independent));
 }
});

test('cadence replaces the orange opening and the native spirit is a separate source in the same capacity',()=>{
 const base=runs()[1],ranks:GrowthRanks={...zero,...allEmitters,L1_RATE:8,L1_RANGE:17,L1_RELOAD:5},effective=deriveGrowthConfig(base,ranks);
 const normal=projectileCapacityForGrowth({...base,passive:'none'},{...effective,passive:'none'},ranks);
 assert.equal(projectileCapacityForGrowth({...base,passive:'reload-secondary'},{...effective,passive:'reload-secondary'},ranks),normal);
 assert.equal(projectileCapacityForGrowth(base,effective,ranks),normal+1);
});

test('rhythm capacity covers latest620ms emission window plus old shots across36 and47investment actual roots',()=>{
 const rhythm={C23:1,M31:1,E21:1};
 for(const run of runs()){
  const base={...run,projectileTraits:{enabled:true as const}},ranks={...zero,...allEmitters,...rhythm,L1_RATE:20,L1_RANGE:20};
  const effective=deriveGrowthConfig(base,ranks),legacy={...ranks,C23:0,M31:0,E21:0};
  assert(projectileCapacityForGrowth(base,effective,ranks)>projectileCapacityForGrowth(base,effective,legacy),'native Group must include delayed rhythm shots');
  for(const budget of [36,47])for(const [rate,range] of [[budget-9,0],[12,budget-21],[6,budget-15]]){
   const r={...zero,...allEmitters,...rhythm,L1_RATE:rate,L1_RANGE:range};assert.equal(Object.values(r).reduce((n,v)=>n+v,0),budget);
   assert(observe(base,r,[],40,.001).secondary>0);
  }
  const before={...zero,...allEmitters,C23:1,L1_LIGHT_MAG:0,L1_RATE:15,L1_RANGE:12};
  const after={...before,L1_LIGHT_MAG:1,M31:1,E21:1};
  assert.equal(observe(base,before,[{ready:s=>s.shots===4,ranks:after}],20,.001).transitions,1);
 }
});

test('native Clock quantization reserves the fourth rhythm group at the life+620ms+two50ms boundary',()=>{
 const run=runs()[1],base:RunConfig={...run,passive:'none',projectileTraits:{enabled:true},weapon:{...run.weapon,intervalSeconds:.1,reloadSeconds:.1,ammoCapacity:12}};
 const ranks={...zero,L1_SPLIT:1,C23:1,M31:1,E21:1},effective=deriveGrowthConfig(base,ranks);
 const without={...ranks,C23:0,M31:0,E21:0};
 // 0.55s life + 0.62s nominal delay spans 12 possible roots; native Clock
 // rounds BOTH the first event and the later segment up to a frame. At the
 //20Hz cap the 1.27s conservative window includes 13 roots => four triples.
 assert.equal(projectileCapacityForGrowth(base,effective,ranks)-projectileCapacityForGrowth(base,effective,without),12);
 assert.equal((CombatConfig as any).BATTLE_MIN_FPS,20);
});

test('shipped minimum player projectile life preserves Clock retirement ordering used by the two-frame rhythm bound',()=>{
 const minimumFPS=(CombatConfig as any).BATTLE_MIN_FPS;assert.equal(typeof minimumFPS,'number');
 const largestSingleTimer=Math.max(N.rhythmRetargetDelay,(N.rhythmSequenceCount-1)*N.rhythmSequenceStep);
 for(const base of runs())assert(base.weapon.bulletLifeSeconds+1e-8>=largestSingleTimer+1/minimumFPS,
  'new content with shorter projectile life must revise the Clock ordering proof and native Group bound');
});

test('flight capacity retains old long-life roots after A15, without a hidden life floor',()=>{
 const run=runs()[1],base:RunConfig={...run,projectileFlight:{enabled:true},passive:'none'} as RunConfig;
 const ranks={...zero,L1_RATE:200,A15:120},effective=deriveGrowthConfig(base,ranks);
 assert(effective.weapon.bulletLifeSeconds<.05);
 // The base life is .55s; .05s Clock retirement slack with a1/46.5s root
 // interval admits four old-magazine roots per reload, even after100A15.
 assert.equal(projectileCapacityForGrowth(base,effective,ranks),24);
 const before={...zero,L1_RATE:200,L1_RELOAD:200},after={...before,A15:100};
 const result=observe(base,before,[{ready:s=>s.shots>=20,ranks:after}],3,.001);
 assert(result.transitionOccupancy>24);assert(result.peak>24);
});

test('flight return lifetime only doubles PRIMARY: derived bounds keep secondary and spirit sources separate',()=>{
 const run=runs()[1],base:RunConfig={...run,passive:'none',projectileFlight:{enabled:true},weapon:{...run.weapon,intervalSeconds:.1,reloadSeconds:.1,ammoCapacity:12}} as RunConfig;
 const ranks={...zero,A15:100,M05:1},effective=deriveGrowthConfig(base,ranks);
 // Historical life envelope .55: PRIMARY2*.55 + one Clock frame admits12
 // roots of5 pellets. Pickup is SECONDARY:.55+one frame admits7roots.
 assert.equal(projectileCapacityForGrowth(base,effective,ranks),60);
 assert.equal(projectileCapacityForGrowth(base,effective,{...ranks,L1_PICKUP_CHIME:1}),67);
 assert.equal(projectileCapacityForGrowth({...base,passive:'spirit'},{...effective,passive:'spirit'},ranks),61);
 assert.equal(projectileCapacityForGrowth(base,deriveGrowthConfig(base,{...ranks,M05:0}),{...ranks,M05:0}),35);
});

test('short flight rhythm adds three quantized frames and never relies on the old minimum-life premise',()=>{
 const run=runs()[1],base:RunConfig={...run,passive:'none',projectileFlight:{enabled:true},projectileTraits:{enabled:true},weapon:{...run.weapon,intervalSeconds:.08,reloadSeconds:.08,ammoCapacity:12}} as RunConfig;
 const ranks={...zero,A15:120,L1_SPLIT:1,C23:1,M31:1,E21:1},effective=deriveGrowthConfig(base,ranks),without={...ranks,C23:0,M31:0,E21:0};
 assert(effective.weapon.bulletLifeSeconds<1/CombatConfig.BATTLE_MIN_FPS);
 // Envelope .55 + max timer path .62 +3*.05 =1.32s:17roots,
 // ceil(17/4)=5 groups of3. With only2frames,1.27s admits16roots
 // and misses the fifth group. A15 must not collapse this to current shortlife.
 assert.equal(projectileCapacityForGrowth(base,effective,ranks)-projectileCapacityForGrowth(base,effective,without),15);
});

test('flight ledger covers old range and frozen delayed sequences alongside new short-life sources at20/30Hz and irregular frames',()=>{
 const emitters={...zero,...allEmitters,C23:1,M31:1,E21:1,M05:1,L1_RATE:18,L1_RELOAD:15,L1_RANGE:17};
 for(const run of runs())for(const steps of [[1/20],[1/30],[.011,.05,.023,.041,.017]]){
  const base:RunConfig={...run,projectileFlight:{enabled:true},projectileTraits:{enabled:true}} as RunConfig;
  const session=new Session(base),passives=new CatPassives(base),bursts=new WeaponBursts();
  let ranks={...emitters,A15:0},live:{until:number;count:number;source:string}[]=[],pending:{at:number;life:number;count:number}[]=[],changed=false,oldAtTransition=0,peak=0;
  session.applyGrowth(ranks);
  for(let frame=0;session.elapsed<24;frame++){
   if(!changed&&session.shots>=4){oldAtTransition=live.reduce((n,e)=>n+e.count,0)+pending.length;session.pause('upgrade');ranks={...ranks,A15:100,L1_RANGE:20};session.applyGrowth(ranks);session.finishUpgrade();changed=true;}
   const dt=steps[frame%steps.length],config=session.effectiveConfig,root=session.step(dt,{x:1,y:0});
   // Worst-case TimerEvent retirement is up to one capped frame late.
   live=live.filter(e=>e.until>session.elapsed);passives.syncReloads(session.reloadCompletions);
   for(const p of pending.filter(p=>p.at<=session.elapsed))live.push({until:session.elapsed+p.life+1/CombatConfig.BATTLE_MIN_FPS,count:p.count,source:'RHYTHM'});
   pending=pending.filter(p=>p.at>session.elapsed);
   if(root){
    const opening=passives.onVolley(root.id,session.reloadCompletions),extras=bursts.onVolley(config,ranks,{id:root.id,ammo:session.ammo,reloads:session.reloadCompletions,opening}).length;
    live.push({until:session.elapsed+2*config.weapon.bulletLifeSeconds+1/CombatConfig.BATTLE_MIN_FPS,count:config.weapon.pellets,source:'PRIMARY'});
    live.push({until:session.elapsed+config.weapon.bulletLifeSeconds+1/CombatConfig.BATTLE_MIN_FPS,count:extras+1,source:'SECONDARY'});
    const intent=bursts.onRhythmVolley(config,ranks,{id:root.id});
    if(intent)for(const segment of intent.segments)pending.push({at:session.elapsed+intent.delay+segment.offset+2/CombatConfig.BATTLE_MIN_FPS,life:intent.life,count:1});
   }
   if(passives.spiritAttack(session.elapsed,{x:0,y:0},[{id:1,x:1,y:0,alive:true,kind:'enemy'}]))live.push({until:session.elapsed+config.spirit.bulletLifeSeconds+1/CombatConfig.BATTLE_MIN_FPS,count:1,source:'SUMMON'});
   const active=live.reduce((n,e)=>n+e.count,0),capacity=projectileCapacityForGrowth(base,config,ranks);peak=Math.max(peak,active);
   assert(active<=capacity,JSON.stringify({cat:base.catId,steps,at:session.elapsed,active,capacity,ranks}));
  }
  assert(changed&&oldAtTransition>0&&peak>0);assert(deriveGrowthConfig(base,ranks).weapon.bulletLifeSeconds<.55);
 }
});


test('D2 capacity includes both F-scaled spirit and sentinel sources with one capped Clock frame in both branches',()=>{
 for(const flight of [false,true])for(const investment of [36,47]){
  const run=runs()[0],base:RunConfig={...run,passive:'none',defenseCompanions:{enabled:true},...(flight?{projectileFlight:{enabled:true as const}}:{}),weapon:{...run.weapon,intervalSeconds:.02,reloadSeconds:.02,ammoCapacity:100}};
  const r={...zero,C12:1,A16:investment-1},effective=deriveGrowthConfig(base,r),plain=projectileCapacityForGrowth(base,effective,zero),frame=1/CombatConfig.BATTLE_MIN_FPS,F=1+.1*(investment-1);
  assert.equal(Object.values(r).reduce((sum,n)=>sum+n,0),investment);
  const sentry=Math.floor((1+frame)/(1/F-1e-8))+1;
  assert.equal(projectileCapacityForGrowth(base,effective,r)-plain,sentry,'missing sentinel slots');
  const spiritBase={...base,passive:'spirit' as const},spiritEffective={...effective,passive:'spirit' as const};
  const spirit=Math.floor((base.spirit.bulletLifeSeconds+frame)/(base.spirit.intervalSeconds/F-1e-8))+1;
  assert.equal(projectileCapacityForGrowth(spiritBase,spiritEffective,r)-plain,sentry+spirit,'missing F-scaled native spirit');
  const off={...base,defenseCompanions:undefined};assert.equal(projectileCapacityForGrowth(off,{...effective,defenseCompanions:undefined},r),projectileCapacityForGrowth(off,{...effective,defenseCompanions:undefined},zero));
 }
});
