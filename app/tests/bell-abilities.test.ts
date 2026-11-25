import test from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import {courtyardRunConfig,SPAWN_STAGES,SliceSpawns,ENEMIES,COMBAT_SLICE} from '../src/level-config';
import {makeRunConfig} from '../src/combat-config';
const ranks=(r:Record<string,number>={})=>({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...r});
test('G4 orbit rate coefficient stays local to the selected plan and preserves cooldown fraction',()=>{
 const stats=Growth.orbitStats(3,4,.08);assert.equal(stats.haste,1.32);assert.equal(stats.period,2.4/1.32);assert.equal(stats.cooldown,.5/1.32);
 assert.equal(Growth.orbitStats(3,4).haste,1.6);
 const old=.8/1.08,next=.7/1.24,state={orbitHitAt:10},now=10+old/2;
 Growth.remapOrbitCooldown(state,now,1,2,1,3,.08);assert(!Growth.orbitContact(state,now,2,3,.08));
 assert(!Growth.orbitContact(state,now+next/2-.0001,2,3,.08));assert(Growth.orbitContact(state,now+next/2,2,3,.08));
});
test('D2c has twenty implemented cards, five cores, six unlimited attributes and two single-pick combinations',()=>{
 const legacy=Growth.GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id));
 assert.equal(legacy.length,20);assert.equal(legacy.filter(c=>c.kind==='core').length,5);
 assert.equal(legacy.filter(c=>c.limit===null).length,6);assert.equal(legacy.filter(c=>c.kind==='combination').length,2);
});
test('local display sizes change independently of contact radii and enemy speeds',()=>{
 assert.equal(COMBAT_SLICE.displaySize,42);assert.equal(COMBAT_SLICE.previewContactRadius,12);assert.equal(ENEMIES.E01.size,26);assert.equal(ENEMIES.E01.radius,12);
 assert.deepEqual([ENEMIES.E01.speed,ENEMIES.E03.speed,ENEMIES.E04.speed],[54,96,32]);
});
test('trail thresholds preserve completed fraction without placing on threshold-only changes',()=>{
 const a=new Growth.BellAbilityState();a.travel(90,true);assert.deepEqual(a.travel(0,false,60),[]);assert.equal(a.snapshot().trailDistance,30);
 assert.deepEqual(a.travel(30,true,60),[1]);a.travel(30,true,60);assert.deepEqual(a.travel(0,false,180),[]);assert.equal(a.snapshot().trailDistance,90);
 assert.deepEqual(a.travel(90,true,180),[1]);a.reset();assert.deepEqual(a.travel(180,true,60),[1/3,2/3,1]);
});
test('only a real transition from below eight to full emits a charge event',()=>{
 const a=new Growth.BellAbilityState();assert.equal(a.collect(8,false),false);assert.equal(a.collect(7,true),false);assert.equal(a.collect(1,true),true);
 assert.equal(a.collect(8,true),false);assert(a.onVolley(1,true));assert.equal(a.collect(20,true),true);assert.equal(a.collect(0,true),false);
});
test('the two bell combinations require exactly their real prerequisites and selection, without attribute investments',()=>{
 const combos=Growth.GROWTH_COMBINATIONS.filter(c=>['L1_DUO_TRAIL_CADENCE','L1_DUO_STAR_RING'].includes(c.id));assert.equal(combos.length,2);
 for(const combo of combos){
  const g:any=new Growth.RunGrowth(1,()=>0);g.collect(10000);g.ranks=ranks(Object.fromEntries(combo.requires.map((id:string)=>[id,1])));g.offer=null;g.ensureOffer();
  assert(g.snapshot().offer.choices.includes(combo.id));assert.equal(g.snapshot().ranks[combo.id],undefined);
  const before=g.snapshot();assert(g.confirm(1,before.offer.id,'L1_DAMAGE'));assert(g.snapshot().offer.choices.includes(combo.id));
  assert(g.confirm(1,g.snapshot().offer.id,combo.id));assert.equal(g.snapshot().ranks[combo.id],1);assert(!g.snapshot().offer.choices.includes(combo.id));
  for(const missing of combo.requires){const h:any=new Growth.RunGrowth(2,()=>0);h.collect(10000);h.ranks=ranks(Object.fromEntries(combo.requires.filter((id:string)=>id!==missing).map((id:string)=>[id,1])));h.offer=null;h.ensureOffer();assert(!h.snapshot().offer.choices.includes(combo.id));}
 }
});
test('combined evolution/combinations guarantee uses one least-viewed stable queue, snapshots do not add views',()=>{
 const g:any=new Growth.RunGrowth(1,()=>0);g.collect(100000);g.ranks=ranks({L1_SPLIT:1,L1_DAMAGE:2,L1_TRAIL_BELL:1,L1_ECHO:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1});g.offer=null;g.ensureOffer();
 const seen:string[]=[];
 for(let i=0;i<6;i++){const o=g.snapshot().offer;seen.push(o.choices.find((id:string)=>/EVO_|DUO_/.test(id)));const views=JSON.stringify(g.evolutionViews);g.snapshot();assert.equal(JSON.stringify(g.evolutionViews),views);assert(g.confirm(1,o.id,'L1_DAMAGE'));}
 assert.deepEqual(seen.slice(0,3),['L1_DUO_STAR_RING','L1_DUO_TRAIL_CADENCE','L1_EVO_BARRAGE']);assert.deepEqual(seen.slice(3),seen.slice(0,3));
});
test('exploration applies combo-completion boost and recent-decline weight once each, only to core or attachment',()=>{
 const weight=(Growth as any).growthExplorationWeight;assert.equal(typeof weight,'function');
 const r=ranks({L1_TRAIL_BELL:1});assert.equal(weight('L1_ECHO',r,[]),2);assert.equal(weight('L1_ECHO',r,[['L1_ECHO'],['L1_ECHO']]),1);
 assert.equal(weight('L1_PICKUP_CHIME',r,[]),1);assert.equal(weight('L1_DAMAGE',r,[['L1_DAMAGE']]),1);
 assert.equal(weight('L1_PICKUP_CHIME',ranks({L1_ORBIT_BELL:1}),[]),2);assert.equal(weight('L1_ECHO',ranks({L1_TRAIL_BELL:1,L1_DUO_TRAIL_CADENCE:1}),[]),1);
});
test('ability D excludes split and pierce; move trial is 170 and one MOVE 187',()=>{
 const fn=(Growth as any).abilityDamage;assert.equal(typeof fn,'function');const b=courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 assert.equal(fn(b,ranks({L1_DAMAGE:4,L1_SPLIT:1})),21.6);assert.equal(fn({...b,directDamageMultiplier:.9},ranks({L1_DAMAGE:2})),12*1.4);
 assert(Math.abs(Growth.deriveGrowthConfig(b,ranks({L1_MOVE:1})).moveSpeed-187)<1e-8);assert.equal(b.moveSpeed,170);assert.equal(makeRunConfig('CAT01','W01','p2-basic').moveSpeed,198);
});
test('distance threshold fractions retain residual, exclude non-input movement and reset',()=>{
 const C=(Growth as any).BellAbilityState;assert.equal(typeof C,'function');const a=new C();
 assert.deepEqual(a.travel(100,true),[]);assert.deepEqual(a.travel(400,false),[]);assert.deepEqual(a.travel(300,true),[80/300,260/300]);assert.equal(a.snapshot().trailDistance,40);
 a.reset();assert.deepEqual(a.travel(360,true),[.5,1]);assert.equal(a.snapshot().trailDistance,0);
});
test('merged actual XP saturates charge, discards surplus, has no backcredit and consumes one per root',()=>{
 const C=(Growth as any).BellAbilityState;assert.equal(typeof C,'function');const a=new C();a.collect(7,false);assert.equal(a.snapshot().charge,0);
 a.collect(7,true);assert.equal(a.onVolley(1,true),false);a.collect(30,true);assert.equal(a.snapshot().charge,8);assert(a.onVolley(2,true));assert(!a.onVolley(2,true));assert.equal(a.snapshot().charge,0);
 a.collect(8,true);assert(!a.onVolley(3,false));assert.equal(a.snapshot().charge,8);a.reset();assert.equal(a.snapshot().charge,0);
});
test('orbit cooldown is shared in enemy birth state and recycled birth resets it',()=>{
 const fn=(Growth as any).orbitContact;assert.equal(typeof fn,'function');const state={orbitHitAt:-Infinity};
 assert(fn(state,1));assert(!fn(state,1));assert(!fn(state,1.79));assert(fn(state,1.8));assert(fn({orbitHitAt:-Infinity},1.81));
});
test('new core supports and attachment gates are real without standalone evolution',()=>{
 for(const core of ['L1_TRAIL_BELL','L1_ORBIT_BELL']){let found=false;let seed=1;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let run=1;run<=100;run++){const g=new Growth.RunGrowth(run,rng);g.collect(10000);if(!g.snapshot().offer!.choices.includes(core as any))continue;
   found=true;assert(g.confirm(run,1,core));const route=g.snapshot().routes.find(r=>r.core===core)!;assert(route.coreOwned);assert(!route.eligible);
   let chime=false;for(let i=0;i<14;i++){const o=g.snapshot().offer!;chime ||= o.choices.includes('L1_PICKUP_CHIME' as any);assert(g.confirm(run,o.id,o.choices[0]));}assert(chime);
  }assert(found);
 }
});
test('six finite pressure stages continue until 600 with a lower final cap and no deletion rule',()=>{
 assert.deepEqual(SPAWN_STAGES.map(s=>[s.start,s.end,s.interval,s.cap]),[[3,60,3,8],[60,150,1.8,12],[150,240,1.2,16],[240,330,.95,20],[330,450,.7,26],[450,600,.9,20]]);
 const s=new SliceSpawns();assert.equal(s.take(150),'E01');assert.equal(s.take(330),'E01');assert(s.take(599.99));assert.equal(s.take(599.99),null);assert.equal(s.take(600),null);
});

test('G4 linear experience keeps the first eight and full ordinary drops',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>Growth.experienceNeeded(i+1)),[8,10,12,14,15,17,19,20]);
 assert.deepEqual(['E01','E03','E04'].map(Growth.dropExperience),[2,2,3]);
 const g=new Growth.RunGrowth(1,()=>0);g.collect(404);assert.equal(g.snapshot().level,18);assert.equal(g.snapshot().pending,17);assert.equal(g.snapshot().xp,29);
});

test('G3 orbit ranks own 2/3/4 bells and only orbit is a three-pick core',()=>{
 const card=Growth.GROWTH_CARDS.find(c=>c.id==='L1_ORBIT_BELL')!;
 assert.equal(card.limit,3);assert.equal(Growth.GROWTH_RULES_VERSION,'courtyard-growth-defense-v14');
 assert.deepEqual([1,2,3].map(rank=>{const s=(Growth as any).orbitStats(rank);return {count:s.count,cooldown:s.cooldown};}),[{count:2,cooldown:.8},{count:3,cooldown:.7},{count:4,cooldown:.5}]);
 assert.deepEqual([Growth.GROWTH_NUMBERS.orbitRadius,Growth.GROWTH_NUMBERS.orbitSize,Growth.GROWTH_NUMBERS.orbitHitRadius],[60,16,8]);
 assert.equal(Growth.GROWTH_CARDS.filter(c=>c.kind!=='attribute'&&c.limit!==1).length,1);
});
test('G3 main orbit uses per-rank independent damage and RATE for both native period and shared cooldown',()=>{
 const b=courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 for(const rank of [1,2,3])for(const rate of [0,1,3,8,12]){
  const s=(Growth as any).orbitStats(rank,rate),h=1+.15*rate,coefficient=[.75,1,1.4][rank-1];
  assert.equal(s.damageCoefficient,coefficient);assert.equal(s.haste,h);assert.equal(s.period,2.4/h);assert.equal(s.cooldown,[.8,.7,.5][rank-1]/h);
  assert.equal(Growth.abilityDamage(b,ranks({L1_DAMAGE:2,L1_SPLIT:1,L1_PIERCE:1,L1_RATE:rate}))*s.damageCoefficient,12*1.4*coefficient);
  assert.equal(Growth.GROWTH_NUMBERS.starDamage,1.5);assert.equal(Growth.GROWTH_NUMBERS.chimeDamage,.75);
 }
 assert.deepEqual([Growth.GROWTH_NUMBERS.trailMax,Growth.GROWTH_NUMBERS.duoTrailMax],[6,9]);
 assert(!('trailLife' in Growth.GROWTH_NUMBERS));
 assert(Growth.growthRoutes(ranks({L1_ORBIT_BELL:1,L1_RATE:1})).find(r=>r.core==='L1_ORBIT_BELL')!.supports.includes('L1_RATE' as never));
});
test('G3 RATE-only and simultaneous rank upgrades preserve every unfinished shared cooldown fraction',()=>{
 for(const [from,to,oldRate,newRate] of [[1,1,0,1],[2,2,1,3],[3,3,3,8],[1,2,0,3],[2,3,8,9]])for(const fraction of [0,.25,.5,.99,1,2]){
  const old=[.8,.7,.5][from-1]/(1+.15*oldRate),next=[.8,.7,.5][to-1]/(1+.15*newRate),now=10+old*fraction,state={orbitHitAt:10};
  (Growth as any).remapOrbitCooldown(state,now,from,to,oldRate,newRate);
  assert.equal((Growth as any).orbitContact(state,now,to,newRate),fraction>=1);
  if(fraction<1){assert(!(Growth as any).orbitContact(state,now+next*(1-fraction)-.0001,to,newRate));assert((Growth as any).orbitContact(state,now+next*(1-fraction),to,newRate));}
 }
 const untouched={orbitHitAt:-Infinity};(Growth as any).remapOrbitCooldown(untouched,10,1,1,0,8);assert.equal(untouched.orbitHitAt,-Infinity);
});
test('G3 shared enemy cooldown uses each rank and remaps completed fraction immediately',()=>{
 const remap=(Growth as any).remapOrbitCooldown;assert.equal(typeof remap,'function');
 for(const [from,to] of [[1,2],[2,3]]){
  const old=(Growth as any).orbitStats(from).cooldown,next=(Growth as any).orbitStats(to).cooldown;
  for(const fraction of [0,.25,.5,.99,1,2]){const state={orbitHitAt:10};const now=10+old*fraction;remap(state,now,from,to);
   assert.equal(Growth.orbitContact(state,now,to),fraction>=1);
   if(fraction<1){assert(!Growth.orbitContact(state,now+next*(1-fraction)-.0001,to));assert(Growth.orbitContact(state,now+next*(1-fraction),to));}
  }
 }
 const virgin={orbitHitAt:-Infinity};remap(virgin,4,1,2);assert.equal(virgin.orbitHitAt,-Infinity);
});
test('G3 owned orbit upgrades occupy related slot, unowned core exploration remains available, rank3 leaves legal pool',()=>{
 for(const rank of [1,2]){let upgrades=0;
  for(let seed=1;seed<=120;seed++){let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const g:any=new Growth.RunGrowth(seed,random);g.collect(10000);g.ranks=ranks({L1_ORBIT_BELL:rank});g.offer=null;g.ensureOffer();const o=g.snapshot().offer;
   if(o.choices.includes('L1_ORBIT_BELL')){upgrades++;assert(o.choices.some((id:string)=>id!=='L1_ORBIT_BELL'&&Growth.GROWTH_CARDS.find(c=>c.id===id)!.kind!=='attribute'));assert(g.confirm(seed,o.id,'L1_ORBIT_BELL'));assert.equal(g.snapshot().ranks.L1_ORBIT_BELL,rank+1);}
  }assert(upgrades>0);
 }
 const g:any=new Growth.RunGrowth(1,()=>0);g.collect(10000);g.ranks=ranks({L1_ORBIT_BELL:3});g.offer=null;g.ensureOffer();for(let i=0;i<20;i++){const o=g.snapshot().offer;assert(!o.choices.includes('L1_ORBIT_BELL'));assert(g.confirm(1,o.id,o.choices[0]));}
});
