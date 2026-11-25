import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Combat from '../src/combat-config';
import * as Growth from '../src/progression';
import {courtyardRunConfig} from '../src/level-config';
import {growthChange,growthCardSummary,growthDetail} from '../src/ui/progression';
const zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const legacy26=(cat='CAT01',weapon='W01')=>({...courtyardRunConfig(Combat.makeRunConfig(cat,weapon,'p2-basic')),projectileTraits:{enabled:true as const}});
const pilot=(cat='CAT01',weapon='W01')=>({...legacy26(cat,weapon),huntTargeting:{enabled:true as const}}) as Combat.RunConfig;
const huntIds=['C18','M26'];

test('hunting pilot is explicit and cannot enter release or review',()=>{
 const validate=(Combat as any).assertHuntTargetingProfile;
 assert.equal(typeof validate,'function');
 for(const profile of ['release','review'])assert.throws(()=>validate(pilot(),profile),/playtest/);
 assert.doesNotThrow(()=>validate(pilot(),'playtest'));
 for(const profile of ['release','review','playtest'])assert.doesNotThrow(()=>validate(legacy26(),profile));
});

test('C18 and M26 add two identities but do not enter the legacy26 or flight-only pools',()=>{
 assert.equal(Growth.GROWTH_CARDS.length,33);
 for(const [cat,weapon]of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=legacy26(cat,weapon),p=pilot(cat,weapon),owned={...zero,C18:1} as any;
  assert(Growth.growthCardEligible('C18' as any,zero,p));
  assert(!Growth.growthCardEligible('M26' as any,zero,p));
  assert(Growth.growthCardEligible('M26' as any,owned,p));
  for(const id of huntIds){
   assert(!Growth.growthCardEligible(id as any,owned,b));
   assert(!Growth.growthCardEligible(id as any,owned,{...b,projectileFlight:{enabled:true}}));
   assert(!Growth.growthCardEligible(id as any,owned));
   assert(!Growth.growthCardEligible(id as any,{...owned,[id]:1},p));
  }
  assert(!Growth.growthCardEligible('C18' as any,zero,{...p,weapon:{...p.weapon,bulletSpeed:0}}));
  const derived=Growth.deriveGrowthConfig(p,{...owned,M26:1});
  assert.deepEqual(derived.weapon,p.weapon,'a target-specific bonus must not be baked into every projectile');
  assert.equal(derived.moveSpeed,p.moveSpeed);
 }
});

test('marked-target UI explains highest current HP, direct primary damage and one remaining-time transfer',()=>{
 const b=pilot('CAT02','W04'),g=new Growth.RunGrowth(1,()=>0,b),s=g.snapshot();
 const change=growthChange('C18' as any,s,b),summary=growthCardSummary('C18' as any,s,b);
 assert.match(change,/4.*4/);assert.match(change,/28\.8.*33\.12/);
 assert.match(summary.benefit,/15%/);assert.match(summary.cost||'',/近/);
 const detail=growthDetail('M26',s);assert.match(detail.body,/120/);assert.match(detail.body,/剩余/);assert.match(detail.body,/一次|1次/);
 assert(!detail.body.includes('undefined'));
});

test('forged legacy26 confirmations cannot enable hunting and pilot upgrade state carries its own suffix',()=>{
 for(const id of huntIds){
  const g:any=new Growth.RunGrowth(1,()=>0,legacy26());g.collect(8);g.offer={id:12,choices:[id],source:'experience'};
  assert(!g.confirm(1,12,id));assert.equal(g.snapshot().ranks[id]??0,0);
 }
 const g:any=new Growth.RunGrowth(2,()=>0,pilot());g.collect(100);
 g.offer={id:13,choices:['C18'],source:'experience'};assert(g.confirm(2,13,'C18'));
 g.offer={id:14,choices:['M26'],source:'experience'};assert(g.confirm(2,14,'M26'));
 assert.equal(g.snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits-hunt-v1');
 const owned=g.snapshot().ranks;
 for(const id of ['L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'])assert(Growth.growthCardEligible(id as any,owned,pilot()));
 assert.equal(new Growth.RunGrowth(3,()=>0,legacy26()).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits');
});

test('C18 alone opens the real attachment exploration slot without demanding another core',()=>{
 const seen=new Set<string>(),owned={...zero,C18:1} as any;
 for(let seed=1;seed<=256;seed++){
  let value=seed;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const g:any=new Growth.RunGrowth(seed,random,pilot());g.ranks={...owned};g.collect(8);
  for(const id of g.snapshot().offer.choices)seen.add(id);
 }
 for(const id of ['M26','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'])assert(seen.has(id),id+' never appeared with only C18');
});
