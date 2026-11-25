import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import * as Growth from '../src/progression';
import {growthChange,growthDetail,growthBuild} from '../src/ui/progression';
import {projectileCapacityForGrowth} from '../src/progression-capacity';
const zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0},legacy26=(cat='CAT01',weapon='W01'):RunConfig=>({...courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),projectileTraits:{enabled:true}}),pilot=(cat='CAT01',weapon='W01'):RunConfig=>({...legacy26(cat,weapon),projectileFlight:{enabled:true}});
test('two return upgrades complete33 definitions while all seven pilot identities stay out of legacy26 eligibility',()=>{
 assert.equal(Growth.GROWTH_CARDS.length,33);
 assert.equal(new Growth.RunGrowth(1,()=>0,pilot()).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits-flight-v2');
 assert.equal(new Growth.RunGrowth(1,()=>0,legacy26()).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits');
 for(const id of ['M12','E23']){
  const card=Growth.GROWTH_CARDS.find(c=>c.id===id);assert(card);assert.equal(card.limit,1);
  assert(!Growth.growthCardEligible(id as any,{...zero,L1_PIERCE:1,M05:1},legacy26()));
  assert(!Growth.growthCardEligible(id as any,{...zero,L1_PIERCE:1,M05:1}));
 }
 for(const [cat,w]of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,w);assert(Growth.growthCardEligible('M12' as any,zero,b));assert(!Growth.growthCardEligible('M12' as any,{...zero,M12:1} as any,b));
  assert(!Growth.growthCardEligible('E23' as any,zero,b));assert(!Growth.growthCardEligible('E23' as any,{...zero,M05:1} as any,b));assert(!Growth.growthCardEligible('E23' as any,{...zero,L1_PIERCE:1},b));
  assert(Growth.growthCardEligible('E23' as any,{...zero,L1_PIERCE:1,M05:1} as any,b));assert(!Growth.growthCardEligible('E23' as any,{...zero,L1_PIERCE:1,M05:1,E23:1} as any,b));
  assert(!Growth.growthCardEligible('M12' as any,zero,{...b,weapon:{...b.weapon,reloadSeconds:0}}));
  assert(!Growth.growthCardEligible('M12' as any,zero,{...b,weapon:{...b.weapon,ammoCapacity:0}}));
 }
});
test('mirror corridor is a real separately chosen guaranteed advance, with frozen offers and no free rank',()=>{
 const g:any=new Growth.RunGrowth(5,()=>.5,pilot('CAT02','W04'));g.ranks={...zero,L1_PIERCE:1,M05:1};g.collect(8);
 const offer=g.snapshot().offer;assert(offer.choices.includes('E23'));assert.equal(g.snapshot().ranks.E23,undefined);assert.equal(new Set(offer.choices).size,3);
 g.collect(0);assert.deepEqual(g.snapshot().offer,offer);assert(g.confirm(5,offer.id,'E23'));assert.equal(g.snapshot().ranks.E23,1);assert(!g.confirm(5,offer.id,'E23'));
 g.collect(100);assert(!g.snapshot().offer.choices.includes('E23'));
});
test('legacy26 forged confirmations reject both and new cards do not mutate base derived weapon stats',()=>{
 for(const id of ['M12','E23']){const b=legacy26(),g:any=new Growth.RunGrowth(1,()=>0,b);g.ranks={...zero,L1_PIERCE:1,M05:1};g.collect(8);g.offer={id:1,choices:[id],source:'experience'};assert(!g.confirm(1,1,id));}
 const b=pilot(),r={...zero,M05:1,L1_PIERCE:1};assert.deepEqual(Growth.deriveGrowthConfig(b,r),Growth.deriveGrowthConfig(b,{...r,M12:1,E23:1} as any));
});
test('legacy26 build conditions never advertise the unreachable mirror pilot while pilot conditions retain it',()=>{
 const b=legacy26(),g=new Growth.RunGrowth(1,()=>0,b).snapshot();
 assert(!g.combinations.some(c=>c.id==='E23'));
 assert.doesNotMatch(growthBuild(g,b,{courtyard:true}),/镜面回廊|返航轨迹/);
 const p=new Growth.RunGrowth(1,()=>0,pilot()).snapshot();assert(p.combinations.some(c=>c.id==='E23'));
 assert.match(growthBuild(p,pilot(),{courtyard:true}),/镜面回廊/);
});
test('cards show real follow-up cooldowns and per-leg allowances instead of implying instant reload or extra roots',()=>{
 for(const [cat,w,interval]of [['CAT01','W01','0.6'],['CAT02','W04','0.625'],['CAT03','W02','0.5']]){
  const b=pilot(cat,w),g=new Growth.RunGrowth(1,()=>0,b).snapshot();assert(growthChange('M12' as any,g,b).includes(interval));
  const text=growthDetail('M12' as any,g,b).body;assert.match(text,/2次|两次/);assert.match(text,/装填/);
 }
 const b=pilot('CAT02','W04'),g={...new Growth.RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,M05:1,L1_PIERCE:1}};
 assert.match(growthChange('E23' as any,g,b),/4/);assert.match(growthDetail('E23' as any,g,b).body,/每程|两程|回程/);
});
test('flight capacity includes the shortest hot interval while retaining historical long-life bounds',()=>{
 for(const [cat,w]of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,w),r={...zero,L1_RATE:16,L1_RANGE:20,L1_RELOAD:12,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_PIERCE:1,M05:1,M12:1,E23:1,C23:1,M31:1,E21:1};
  const c=Growth.deriveGrowthConfig(b,r as any),ordinary={...r,M12:0};
  const safe=projectileCapacityForGrowth(b,{...c,weapon:{...c.weapon,intervalSeconds:c.weapon.intervalSeconds*.75}},ordinary);
  assert.equal(projectileCapacityForGrowth(b,c,r),safe,'assume every root has the shortest permitted interval as a conservative bound');
  const fast=Growth.deriveGrowthConfig(b,{...r,A15:1000} as any);assert.equal(projectileCapacityForGrowth(b,fast,r),safe,'new short-lived shots cannot shrink capacity for old long-lived shots');
 }
});
