import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import * as Combat from '../src/combat-config';
import * as Growth from '../src/progression';
import {courtyardRunConfig} from '../src/level-config';
import {WeaponBursts} from '../src/weapon-bursts';
import {growthChange,growthBuild,growthDetail} from '../src/ui/progression';
const zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const ids=['A15','M05','M09'];
const legacy26=(cat='CAT01',weapon='W01'):RunConfig=>({...courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),projectileTraits:{enabled:true}});
const pilot=(cat='CAT01',weapon='W01'):RunConfig=>({...legacy26(cat,weapon),projectileFlight:Object.freeze({enabled:true})}) as RunConfig;
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('flight opt-in is explicit and release/review reject it independently of the critical flag',()=>{
 assert.equal(typeof (Combat as any).assertProjectileFlightProfile,'function');
 const validate=(run:RunConfig,profile:string)=>(Combat as any).assertProjectileFlightProfile(run,profile);
 for(const profile of ['release','review'])assert.throws(()=>validate(pilot(),profile),/playtest/);
 assert.doesNotThrow(()=>validate(pilot(),'playtest'));
 for(const profile of ['release','review','playtest'])assert.doesNotThrow(()=>validate(legacy26(),profile));
});

test('three flight identities remain isolated while definitions include two separately gated hunting cards',()=>{
 assert.equal(Growth.GROWTH_CARDS.length,33);
 const all={...zero,L1_DAMAGE:2,L1_RATE:2,L1_RANGE:2,L1_RELOAD:2,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,C23:1};
 const allEligible=new Set([zero,all,{...all,L1_PICKUP_CHIME:0}].flatMap(ranks=>Growth.GROWTH_CARDS.filter(c=>Growth.growthCardEligible(c.id,ranks,legacy26('CAT02','W04'))).map(c=>c.id)));
 // Owned one-time cores are represented by their zero-rank eligibility.
 assert.equal(allEligible.size,26);
 for(const id of ids){assert(Growth.GROWTH_CARDS.some(c=>c.id===id));assert(!Growth.growthCardEligible(id as any,all,legacy26()));assert(!Growth.growthCardEligible(id as any,all));}
 const off=Growth.deriveGrowthConfig(legacy26(),{...zero,A15:20,M05:1,M09:1,L1_PIERCE:1} as any);
 assert.equal(off.weapon.bulletSpeed,legacy26().weapon.bulletSpeed);assert.equal(off.weapon.pierceDamageMultiplier,.7);
 for(const id of ['C18','M26'])assert(!Growth.growthCardEligible(id as any,zero,pilot()));
 for(const id of ['M12','E23']){assert(Growth.GROWTH_CARDS.some(c=>c.id===id));assert(!Growth.growthCardEligible(id as any,zero,legacy26()));}
});

test('A15 and M05 require real projectiles without a core; M09 requires native or purchased piercing',()=>{
 for(const b of [pilot(),pilot('CAT02','W04'),pilot('CAT03','W02')]){
  for(const id of ['A15','M05'])assert(Growth.growthCardEligible(id as any,zero,b));
  assert(!Growth.growthCardEligible('M05' as any,{...zero,M05:1} as any,b));
  assert.equal(Growth.growthCardEligible('M09' as any,zero,b),b.weapon.extraPierce>0);
  assert(Growth.growthCardEligible('M09' as any,{...zero,L1_PIERCE:1},b));
  assert(!Growth.growthCardEligible('M09' as any,{...zero,L1_PIERCE:1,M09:1} as any,b));
  for(const id of ids)assert(!Growth.growthCardEligible(id as any,{...zero,L1_PIERCE:1},{...b,weapon:{...b.weapon,pellets:0}}));
 }
});

test('A15 adds10 percent per pick without a cap, preserves maximum straight distance and range growth',()=>{
 for(const b of [pilot(),pilot('CAT02','W04'),pilot('CAT03','W02')])for(const range of [0,4,30])for(const rank of [1,3,12,100]){
  const prior=Growth.deriveGrowthConfig(b,{...zero,L1_RANGE:range}),next=Growth.deriveGrowthConfig(b,{...zero,L1_RANGE:range,A15:rank} as any),v=1+.1*rank;
  near(next.weapon.bulletSpeed,b.weapon.bulletSpeed*v);near(next.weapon.bulletLifeSeconds,prior.weapon.bulletLifeSeconds/v);
  near(next.weapon.bulletSpeed*next.weapon.bulletLifeSeconds,prior.weapon.bulletSpeed*prior.weapon.bulletLifeSeconds);
  assert.equal(next.weapon.targetRange,prior.weapon.targetRange);assert.equal(next.weapon.damage,prior.weapon.damage);
  assert.equal(next.weapon.intervalSeconds,prior.weapon.intervalSeconds);assert.deepEqual(next.spirit,b.spirit);
  assert(Growth.growthCardEligible('A15' as any,{...zero,A15:rank} as any,b));
 }
 assert(Growth.deriveGrowthConfig(pilot('CAT03','W02'),{...zero,A15:1} as any).weapon.bulletLifeSeconds<.55);
});

test('M09 only changes per-target attenuation, with the stated fish damage and no extra target or primary damage',()=>{
 const b=pilot('CAT02','W04'),old=Growth.deriveGrowthConfig(b,zero),next=Growth.deriveGrowthConfig(b,{...zero,M09:1} as any);
 assert.equal(next.weapon.pierceDamageMultiplier,.85);assert.equal(old.weapon.pierceDamageMultiplier,.7);
 assert.equal(next.weapon.extraPierce,old.weapon.extraPierce);assert.equal(next.weapon.damage,old.weapon.damage);
 const damage=next.weapon.damage*next.directDamageMultiplier;[28.8,24.48,20.808].forEach((n,i)=>near(damage*next.weapon.pierceDamageMultiplier**i,n));
 assert.equal(Growth.deriveGrowthConfig(pilot(),{...zero,M09:1} as any).weapon.pierceDamageMultiplier,.7);
 assert.equal(Growth.deriveGrowthConfig(pilot(),{...zero,L1_PIERCE:1,M09:1} as any).weapon.pierceDamageMultiplier,.85);
});

test('already planned rhythm speed and lifetime stay frozen while new secondary intents read A15',()=>{
 const b=pilot(),bursts=new WeaponBursts(),ranks={...zero,C23:1,M31:1,L1_SPLIT:1,E21:1};
 let old:any;for(let id=1;id<=4;id++)old=bursts.onRhythmVolley(Growth.deriveGrowthConfig(b,ranks),ranks,{id});
 const next=Growth.deriveGrowthConfig(b,{...ranks,A15:12} as any);let fresh:any;
 for(let id=5;id<=8;id++)fresh=bursts.onRhythmVolley(next,ranks,{id});
 assert.equal(old.speed,b.weapon.bulletSpeed);assert.equal(old.life,b.weapon.bulletLifeSeconds);
 assert.equal(fresh.speed,next.weapon.bulletSpeed);assert.equal(fresh.life,next.weapon.bulletLifeSeconds);
 assert(fresh.speed>old.speed&&fresh.life<old.life);
 assert.equal(old.segments.length,3);assert.equal(fresh.segments.length,3);assert.deepEqual(next.spirit,b.spirit);
});

test('legacy26 offers and forged confirmations cannot enable flight, while the pilot uses a separate rules suffix',()=>{
 for(let seed=1;seed<=30;seed++){
  let value=seed;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const g:any=new Growth.RunGrowth(seed,random,legacy26('CAT02','W04'));g.collect(2000);
  for(let i=0;i<28;i++){const o=g.snapshot().offer;assert(o.choices.every((id:string)=>!ids.includes(id)));assert(g.confirm(seed,o.id,o.choices[0]));}
  for(const id of ids){g.offer={id:100,choices:[id],source:'experience'};assert(!g.confirm(seed,100,id));}
  assert.equal(g.snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits');
 }
 const g:any=new Growth.RunGrowth(1,()=>0,pilot());g.collect(8);g.offer={id:1,choices:['M05'],source:'experience'};
 assert(g.confirm(1,1,'M05'));assert.equal(g.snapshot().ranks.M05,1);assert.equal(g.snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits-flight-v2');
});

test('all three flight cards show their rule and actual derived changes, including uncapped A15',()=>{
 const b=pilot('CAT02','W04'),g:any=new Growth.RunGrowth(1,()=>0,b);g.ranks={...zero,A15:4};const s=g.snapshot();
 assert.match(growthChange('A15' as any,s,b),/1120.*1200.*0\.857.*0\.8/);
 assert.match(growthChange('M05' as any,s,b),/1\.714.*发射原点.*1个.*70%/);
 assert.match(growthChange('M09' as any,s,b),/70%.*85%.*3.*28\.8/);
 for(const id of ids)assert(!growthDetail(id,s).body.includes('undefined'));
 assert.match(growthDetail('A15',s).body,/10%.*相加.*最大.*距离/);assert.match(growthDetail('M05',s).body,/发射原点.*新目标/);
 assert.match(growthDetail('M09',s).body,/85%.*额度/);assert.match(growthBuild(s),/50%|40%/);
});
