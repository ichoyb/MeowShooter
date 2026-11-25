import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import {makeRunConfig} from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import {Session} from '../src/rules';
const base=()=>courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
const ranks=(more:Record<string,number>={})=>({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...more});
const plan=()=>{const C=(Growth as any).WeaponBursts;assert.equal(typeof C,'function','root-volley burst rules must exist');return new C();};

test('courtyard initial speed is 170 and ordinary drops stay full with the denser-pressure XP curve',()=>{
 assert.equal(base().moveSpeed,170);assert.equal(makeRunConfig('CAT01','W01','p2-basic').moveSpeed,198);
 assert.deepEqual(['E01','E03','E04','EL01','B01'].map(Growth.dropExperience),[2,2,3,0,0]);
 assert.equal(Growth.experienceNeeded(1),8);assert.equal(Growth.experienceNeeded(4),14);
});
test('pierce, range, reload and movement are actual additive derived stats',()=>{
 const c=Growth.deriveGrowthConfig(base(),ranks({L1_PIERCE:1,L1_EVO_PIERCE:1,L1_RELOAD:4,L1_RANGE:4,L1_MOVE:4}) as any);
 assert.equal(c.weapon.extraPierce,2);assert.equal(c.weapon.pierceDamageMultiplier,.7);
 assert(Math.abs(c.moveSpeed-238)<1e-8);assert.equal(c.weapon.targetRange,384);assert.equal(c.weapon.reloadSeconds,2.4/1.8);
 assert.equal(base().weapon.extraPierce,0);assert.equal(base().moveSpeed,170);
});
test('split and piercing compose without another damage multiplier or duplicated secondary',()=>{
 const c=Growth.deriveGrowthConfig(base(),ranks({L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_PIERCE:1,L1_EVO_PIERCE:1,L1_DAMAGE:2}) as any);
 assert.equal(c.weapon.pellets,3);assert.equal(c.weapon.extraPierce,2);assert(Math.abs(c.weapon.damage-13.44)<1e-8);
 assert.equal(c.secondary.damageMultiplier,.75);
});
test('reload speed upgrade during reload preserves completed fraction and does not refill ammunition',()=>{
 const s=new Session(base());for(let i=0;i<12;i++)s.step(i? .8:0,{x:1,y:0});s.advance(.35);
 const previous=s.reloadLeft;s.pause('upgrade');s.applyGrowth(ranks({L1_RELOAD:1}) as any);
 assert(Math.abs(s.reloadLeft-previous/1.2)<1e-8);assert.equal(s.ammo,0);assert.equal(s.shots,12);
});
test('tail echoes only occur on the last root volley, repeat ids do not duplicate them',()=>{
 const b=plan(),r=ranks({L1_ECHO:1});
 assert.deepEqual(b.onVolley(base(),r,{id:1,ammo:11,reloads:0,opening:false}),[]);
 const shots=b.onVolley(base(),r,{id:2,ammo:0,reloads:0,opening:false});
 assert.equal(shots.length,2);assert.deepEqual(shots.map((s:any)=>s.angle),[-18,18]);assert(shots.every((s:any)=>s.damage===3&&s.effect==='TAIL_ECHO'));
 assert.deepEqual(b.onVolley(base(),r,{id:2,ammo:0,reloads:0,opening:false}),[]);
});
test('cadence keeps original opening passive, replaces the real reload opening and does not add a fourth secondary',()=>{
 const b=plan(),r=ranks({L1_ECHO:1,L1_EVO_CADENCE:1});
 const initial=b.onVolley(base(),r,{id:1,ammo:11,reloads:0,opening:true});assert.equal(initial.length,1);assert.equal(initial[0].damage,9);
 const reload=b.onVolley(base(),r,{id:13,ammo:11,reloads:1,opening:true});assert.equal(reload.length,3);assert.deepEqual(reload.map((s:any)=>s.angle),[-12,0,12]);assert(reload.every((s:any)=>s.damage===6&&s.effect==='OPENING_BURST'));
 assert.equal(b.onVolley(base(),r,{id:14,ammo:10,reloads:1,opening:false}).length,3);
 assert.equal(b.onVolley(base(),r,{id:15,ammo:9,reloads:1,opening:false}).length,3);
 assert.deepEqual(b.onVolley(base(),r,{id:16,ammo:8,reloads:1,opening:false}),[]);
});
test('every route and progression can be reached from genuine legal offers, with repeatable support',()=>{
 const paths=[['L1_SPLIT','L1_DAMAGE','L1_RATE','L1_EVO_BARRAGE'],['L1_PIERCE','L1_DAMAGE','L1_RANGE','L1_EVO_PIERCE'],['L1_ECHO','L1_RELOAD','L1_RATE','L1_EVO_CADENCE']];
 for(const path of paths){
  let n=1;const g=new Growth.RunGrowth(1,()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;});g.collect(10000);
  let step=0;
  for(let i=0;i<45&&step<path.length;i++){
   const o=g.snapshot().offer!,wanted=path[step],id=o.choices.includes(wanted as any)?wanted:o.choices.find(id=>id==='L1_HEART'||id==='L1_MOVE')||o.choices.find(id=>!id.startsWith('L1_EVO_'))!;
   assert(g.confirm(1,o.id,id));if(id===wanted)step++;
  }
  assert.equal(step,4,path.join(' -> '));
 }
});

test('all legal ten-pick D2c rank combinations fit the conservative native projectile lifetime bound',()=>{
 const attributes=['L1_DAMAGE','L1_RATE','L1_HEART','L1_RELOAD','L1_RANGE','L1_MOVE'];
 const abilities=['L1_SPLIT','L1_PIERCE','L1_ECHO','L1_EVO_BARRAGE','L1_EVO_PIERCE','L1_EVO_CADENCE','L1_SHOCK_BELL','L1_RICOCHET','L1_LIGHT_MAG','L1_TRAIL_BELL','L1_ORBIT_BELL','L1_PICKUP_CHIME','L1_DUO_TRAIL_CADENCE','L1_DUO_STAR_RING'];
 let combinations=0,peak=0,worst:any;
 const visit=(r:any,index:number,left:number)=>{
  if(index<attributes.length){for(let n=0;n<=left;n++)visit({...r,[attributes[index]]:n},index+1,left-n);return;}
  if(left)return;
  if(r.L1_EVO_BARRAGE&&(!r.L1_SPLIT||r.L1_DAMAGE+r.L1_RATE<2))return;
  if(r.L1_EVO_PIERCE&&(!r.L1_PIERCE||r.L1_DAMAGE+r.L1_RANGE<2))return;
  if(r.L1_EVO_CADENCE&&(!r.L1_ECHO||r.L1_RELOAD+r.L1_RATE<2))return;
  if((r.L1_SHOCK_BELL||r.L1_RICOCHET||r.L1_PICKUP_CHIME)&&!r.L1_SPLIT&&!r.L1_PIERCE&&!r.L1_ECHO&&!r.L1_TRAIL_BELL&&!r.L1_ORBIT_BELL)return;
  if(r.L1_LIGHT_MAG&&!r.L1_ECHO)return;
  if(r.L1_DUO_TRAIL_CADENCE&&(!r.L1_TRAIL_BELL||!r.L1_ECHO))return;
  if(r.L1_DUO_STAR_RING&&(!r.L1_ORBIT_BELL||!r.L1_PICKUP_CHIME))return;
  const c=Growth.deriveGrowthConfig(base(),r),w=c.weapon;
  const cycle=(w.ammoCapacity-1)*w.intervalSeconds+Math.max(w.intervalSeconds,w.reloadSeconds);
  assert(w.bulletLifeSeconds<cycle,'at most one real reload/tail in the lifetime window');
  const volleys=Math.ceil(w.bulletLifeSeconds/w.intervalSeconds),bound=volleys*(w.pellets+(r.L1_PICKUP_CHIME?1:0))+(r.L1_EVO_CADENCE?Math.min(3,volleys)*3:1)+(r.L1_ECHO?2:0);
  combinations++;if(bound>peak){peak=bound;worst={...r};}assert(bound<=24,JSON.stringify({bound,r}));
 };
 for(let mask=0;mask<1<<abilities.length;mask++){
  const r:any=ranks();let used=0;for(let i=0;i<abilities.length;i++)if(mask>>i&1){r[abilities[i]]=1;used++;}
  if(used<=10)visit(r,0,10-used);
 }
 assert(combinations>1000);console.log(JSON.stringify({scope:'ALL_LEGAL_TEN_PICK_NO_COLLISION_BOUND',combinations,peak,worst}));
});

// This audit covers rank vectors, not random offers or permutations of picks.
// Each orbit rank costs one pick (0..3); all other abilities are binary. Damage,
// heart and move do not change projectile count/lifetime/cadence. For fixed
// abilities/rate/reload/range, damage only needs to meet the two route gates.
// If d is that minimum and k picks remain for these three attributes, there are
// C(k-d+2,2) legal equivalent allocations. Sum these counts for every total <=15.
// Every counted vector has an acquisition order: attributes, cores, attachments,
// evolutions, combinations. Extra orbit ranks may follow the first orbit pick.
function auditFifteenPickProjectileCapacity(){
 const maximumPicks=15,N=Growth.GROWTH_NUMBERS;
 const legacy=Growth.GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id));
 const abilityCards=legacy.filter(c=>c.kind!=='attribute'&&c.id!=='L1_ORBIT_BELL');
 const cores=legacy.filter(c=>c.kind==='core').map(c=>c.id);
 assert.equal(abilityCards.length,13,'review enumeration when the ability catalog changes');
 const countsByPicks=Array(maximumPicks+1).fill(0),countsByOrbitRank=[0,0,0,0];
 const peakByPicks=Array(maximumPicks+1).fill(0),exceeding24ByPicks=Array(maximumPicks+1).fill(0);
 let historicalTenPickCount=0;
 let equivalenceClasses=0,peak=0,worst:any=null,minReloadCycle=Infinity,minCadenceGap=Infinity;
 let minReloadSeconds=Infinity,maxLifeSeconds=0;
 // Calculate both the previous half-open lifetime bound and a closed endpoint
 // bound. The extra endpoint also covers Session's 1e-8 cooldown tolerance.
 const previous={peak:0,worst:null as any};
 const frozenBase=base();
 for(let mask=0;mask<1<<abilityCards.length;mask++){
  const r:any=ranks({L1_RELOAD:0,L1_RANGE:0,L1_MOVE:0});let binaryPicks=0;
  for(let i=0;i<abilityCards.length;i++)if(mask>>i&1){r[abilityCards[i].id]=1;binaryPicks++;}
  for(let orbitRank=0;orbitRank<=3;orbitRank++){
   r.L1_ORBIT_BELL=orbitRank;
   const abilityPicks=binaryPicks+orbitRank;if(abilityPicks>maximumPicks)continue;
   if(Growth.GROWTH_ROUTES.some(route=>r[route.evolution]&&!r[route.core]))continue;
   if(Growth.GROWTH_COMBINATIONS.some(combo=>r[combo.id]&&combo.requires.some(id=>!r[id])))continue;
   if(abilityCards.some(card=>r[card.id]&&card.kind==='attachment'&&
    (card.id==='L1_LIGHT_MAG'?!r.L1_ECHO:!cores.some(id=>r[id]>0))))continue;
   const left=maximumPicks-abilityPicks;
   for(let rate=0;rate<=left;rate++)for(let reload=0;reload<=left-rate;reload++){
    if(r.L1_EVO_CADENCE&&rate+reload<2)continue;
    for(let range=0;range<=left-rate-reload;range++){
     const damage=Math.max(0,r.L1_EVO_BARRAGE?2-rate:0,r.L1_EVO_PIERCE?2-range:0);
     const neutralPicks=left-rate-reload-range;if(damage>neutralPicks)continue;
     Object.assign(r,{L1_DAMAGE:damage,L1_RATE:rate,L1_RELOAD:reload,L1_RANGE:range,L1_HEART:neutralPicks-damage,L1_MOVE:0});
     const w=Growth.deriveGrowthConfig(frozenBase,r).weapon;
     const reloadCycle=(w.ammoCapacity-1)*w.intervalSeconds+Math.max(w.intervalSeconds,w.reloadSeconds);
     // The cycle check alone would not exclude the last cadence volley from
     // one magazine overlapping the first cadence volley of the next.
     const cadenceGap=(w.ammoCapacity-N.cadenceVolleys)*w.intervalSeconds+Math.max(w.intervalSeconds,w.reloadSeconds);
     assert(reloadCycle>w.bulletLifeSeconds,'at most one tail and real reload per lifetime');
     if(r.L1_EVO_CADENCE)assert(cadenceGap>w.bulletLifeSeconds,'at most one cadence cluster per lifetime');
     minReloadCycle=Math.min(minReloadCycle,reloadCycle);
     if(r.L1_EVO_CADENCE)minCadenceGap=Math.min(minCadenceGap,cadenceGap);
     minReloadSeconds=Math.min(minReloadSeconds,w.reloadSeconds);maxLifeSeconds=Math.max(maxLifeSeconds,w.bulletLifeSeconds);
     const bound=(volleys:number)=>volleys*(w.pellets+(r.L1_PICKUP_CHIME?1:0))+
      (r.L1_EVO_CADENCE?Math.min(N.cadenceVolleys,volleys)*N.openingCount:1)+(r.L1_ECHO?N.tailCount:0);
     const oldBound=bound(Math.ceil(w.bulletLifeSeconds/w.intervalSeconds));
     const volleys=Math.floor((w.bulletLifeSeconds+maximumPicks*1e-8)/w.intervalSeconds)+1;
     const conservativeBound=bound(volleys);
     if(oldBound>previous.peak)Object.assign(previous,{peak:oldBound,worst:{...r}});
     if(conservativeBound>peak){peak=conservativeBound;worst={ranks:{...r},weapon:{...w},volleys,bound:conservativeBound,reloadCycle,cadenceGap};}
     equivalenceClasses++;
     for(let neutral=damage;neutral<=neutralPicks;neutral++){
      const free=neutral-damage,multiplicity=(free+2)*(free+1)/2;
      const totalPicks=abilityPicks+rate+reload+range+neutral;
      countsByPicks[totalPicks]+=multiplicity;
      countsByOrbitRank[orbitRank]+=multiplicity;
      peakByPicks[totalPicks]=Math.max(peakByPicks[totalPicks],conservativeBound);
      if(conservativeBound>24)exceeding24ByPicks[totalPicks]+=multiplicity;
      if(orbitRank<=1&&totalPicks===10)historicalTenPickCount+=multiplicity;
     }
    }
   }
  }
 }
 return {scope:'ALL_LEGAL_UP_TO_FIFTEEN_PICK_G3_RANK_VECTORS',maximumPicks,orbitRankLimit:3,
  equivalenceClasses,combinations:countsByPicks.reduce((a,b)=>a+b,0),countsByPicks,countsByOrbitRank,
  historicalTenPickCount,peakByPicks,exceeding24ByPicks,
  peak,worst,previousHalfOpenBound:previous,minReloadCycle,minCadenceGap,minReloadSeconds,maxLifeSeconds};
}

test('all legal up-to-fifteen-pick G3 rank vectors fit the declared courtyard projectile capacity',()=>{
 const audit=auditFifteenPickProjectileCapacity();
 console.log(JSON.stringify(audit));
 assert(audit.equivalenceClasses>1000);assert(audit.countsByOrbitRank.every(n=>n>0));
 assert.equal(audit.historicalTenPickCount,270901,'equivalence counts must reproduce the retained D2c exhaustive enumeration');
 // This admits a declared capacity only. Actual native Group wiring, capacity
 // restoration on reset and no dropped emissions require the Scene fixture.
 // Until G3 defines a capacity, retain the current 24-slot baseline and fail.
 const configured=(Growth.GROWTH_NUMBERS as typeof Growth.GROWTH_NUMBERS&{projectileCapacity?:number}).projectileCapacity;
 const actualCapacity=configured??24;
 assert(audit.peak<=32,'proposed 32-slot courtyard capacity must cover the complete conservative bound');
 assert(audit.peak<=actualCapacity,JSON.stringify({actualCapacity,requiredConservativeBound:audit.peak,worst:audit.worst}));
});
