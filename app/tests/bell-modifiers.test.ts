import test from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import * as Level from '../src/level-config';
import {makeRunConfig} from '../src/combat-config';
import {Session} from '../src/rules';
const ranks=(more:Record<string,number>={})=>({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...more});
const base=()=>Level.courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
test('G4 tail and cadence work for every magazine weapon while the base opening remains orange-only',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const config=makeRunConfig(cat,weapon,'p2-basic'),b=new Growth.WeaponBursts(),r=ranks({L1_ECHO:1,L1_EVO_CADENCE:1});
  const initial=b.onVolley(config,r,{id:1,ammo:config.weapon.ammoCapacity-1,reloads:0,opening:true});
  assert.equal(initial.length,cat==='CAT01'?1:0);
  const tail=b.onVolley(config,r,{id:2,ammo:0,reloads:0,opening:false});assert.equal(tail.length,2);assert(tail.every(s=>s.effect==='TAIL_ECHO'));
  for(let id=3;id<=5;id++){
   const volley=b.onVolley(config,r,{id,ammo:1,reloads:1,opening:id===3});assert.equal(volley.length,3);
   assert(volley.every(s=>s.effect==='OPENING_BURST'&&s.damage===config.weapon.damage*config.directDamageMultiplier*.5));
  }
  assert.equal(b.onVolley(config,r,{id:6,ammo:1,reloads:1,opening:false}).length,0);
  assert.equal(config.passive,cat==='CAT01'?'reload-secondary':cat==='CAT02'?'chill':'spirit');
 }
});
test('D2c exposes exactly twenty implemented cards and keeps six unlimited attributes',()=>{
 const legacy=Growth.GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id));
 assert.equal(legacy.length,20);
 assert.deepEqual(legacy.filter(c=>c.limit===null).map(c=>c.id),['L1_DAMAGE','L1_RATE','L1_HEART','L1_RELOAD','L1_RANGE','L1_MOVE']);
 for(const id of ['L1_SHOCK_BELL','L1_RICOCHET','L1_LIGHT_MAG'])assert(Growth.GROWTH_CARDS.some(c=>c.id===id&&c.limit===1));
});
test('declining the first two cores keeps a genuine core exploration slot on every later reward',()=>{
 const g=new Growth.RunGrowth(1,()=>0);g.collect(10000);
 for(let i=0;i<10;i++){
  const offer=g.snapshot().offer!;
  assert(offer.choices.some(id=>Growth.GROWTH_CARDS.find(c=>c.id===id)!.kind==='core'),'missing core after '+i+' declined choices');
  const attribute=offer.choices.find(id=>Growth.GROWTH_CARDS.find(c=>c.id===id)!.kind==='attribute')!;assert(g.confirm(1,offer.id,attribute));
 }
});
test('core exploration after two declined rewards uses the recent-decline half weight',()=>{
 let draw=0;const g=new Growth.RunGrowth(1,()=>draw);g.collect(10000);
 let offer=g.snapshot().offer!;assert(offer.choices.includes('L1_SPLIT'));assert(g.confirm(1,offer.id,'L1_DAMAGE'));
 offer=g.snapshot().offer!;assert(offer.choices.includes('L1_SPLIT'));draw=.3;assert(g.confirm(1,offer.id,'L1_DAMAGE'));
 assert(g.snapshot().offer!.choices.includes('L1_PIERCE'));assert(!g.snapshot().offer!.choices.includes('L1_SPLIT'));
});
test('attachments require a real owned core and light magazine specifically requires echo',()=>{
 let seed=41;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const seen=new Set<string>();
 for(let run=1;run<=100;run++){
  const g=new Growth.RunGrowth(run,random);g.collect(10000);
  for(let pick=0;pick<15;pick++){
   const s=g.snapshot(),o=s.offer!,core=s.routes.some(r=>r.coreOwned);
   for(const id of o.choices){if(id==='L1_SHOCK_BELL'||id==='L1_RICOCHET')assert(core);if(id==='L1_LIGHT_MAG')assert(s.ranks.L1_ECHO);seen.add(id);}
   const wanted=['L1_ECHO','L1_SHOCK_BELL','L1_RICOCHET','L1_LIGHT_MAG','L1_EVO_CADENCE','L1_RELOAD'];
   const id=wanted.find(id=>o.choices.includes(id as any))??o.choices[0];assert(g.confirm(run,o.id,id));
  }
 }
 for(const id of ['L1_SHOCK_BELL','L1_RICOCHET','L1_LIGHT_MAG'])assert(seen.has(id),id+' must be genuinely offerable');
});
test('courtyard reload trial is CAT01 only and light magazine composes after reload attributes',()=>{
 assert.equal(base().weapon.reloadSeconds,2.4);
 assert.equal(makeRunConfig('CAT01','W01','p2-basic').weapon.reloadSeconds,1.4);
 assert.equal(Level.courtyardRunConfig(makeRunConfig('CAT02','W04','p2-basic')).weapon.reloadSeconds,1.8);
 const c=Growth.deriveGrowthConfig(base(),ranks({L1_ECHO:1,L1_LIGHT_MAG:1,L1_RELOAD:2}) as any);
 assert.equal(c.weapon.ammoCapacity,6);assert.equal(c.weapon.reloadSeconds,2.4/1.4*.8);
 const s=new Session(base());s.step(0,{x:1,y:0});s.applyGrowth(ranks({L1_ECHO:1,L1_LIGHT_MAG:1}) as any);
 assert.equal(s.ammo,6);assert.equal(s.reloadCompletions,0);assert.equal(s.reloadLeft,0);
 for(let i=0;i<6;i++)s.step(.8,{x:1,y:0});s.advance(.48);
 const ratio=s.reloadLeft/s.effectiveConfig.weapon.reloadSeconds;s.applyGrowth(ranks({L1_ECHO:1,L1_LIGHT_MAG:1,L1_RELOAD:2}) as any);
 assert(Math.abs(s.reloadLeft/s.effectiveConfig.weapon.reloadSeconds-ratio)<1e-8);assert.equal(s.ammo,0);assert.equal(s.reloadCompletions,0);
});
test('shock ledger shares a root volley and releases every reference without a growing history',()=>{
 const C=(Growth as any).BellModifiers;assert.equal(typeof C,'function');const b=new C();
 const a=b.acquire(1),sibling=b.acquire(1);assert.equal(a,sibling);b.release(a);
 assert.equal(b.shock(a),true);assert.equal(b.shock(sibling),false);b.release(sibling);
 for(let i=2;i<10002;i++){const v=b.acquire(i);b.release(v);assert.equal(b.shock(v),true);}
 assert.equal(b.snapshot().activeVolleys,0);assert.equal(b.snapshot().shocks,10001);
});
test('cadence grants three actual root volleys after a real reload and resets rather than stacks',()=>{
 const b=new Growth.WeaponBursts(),r=ranks({L1_ECHO:1,L1_EVO_CADENCE:1}) as any;
 const fire=(id:number,reloads:number,ammo=5,opening=false)=>b.onVolley(base(),r,{id,reloads,ammo,opening});
 assert.equal(fire(1,0,11,true)[0].damage,9);
 assert.equal(fire(2,1,5,true).length,3);assert.deepEqual(fire(3,1).map(s=>s.angle),[-12,0,12]);
 assert.equal(fire(3,1).length,0);assert.equal(b.snapshot().cadenceRemaining,1);
 assert.equal(fire(4,2,5,true).length,3);assert.equal(b.snapshot().cadenceRemaining,2);
 assert.equal(fire(5,2).length,3);assert.equal(fire(6,2,0).length,5);assert.equal(fire(7,2).length,0);
 assert.equal(b.snapshot().cadenceRemaining,0);
});
test('arrival quotas use effective time, finite windows, and never accumulate a burst backlog',()=>{
 const C=(Level as any).ArrivalReinforcements;assert.equal(typeof C,'function');const q=new C();
 assert(q.begin('EL01',160));assert.equal(q.begin('EL01',160),false);assert.equal(q.due(161.19),false);
 assert(q.due(161.2));q.attempt(161.2,false);assert.equal(q.due(161.2),false);assert(q.due(162.8));q.attempt(162.8,true);
 assert.equal(q.snapshot(162.8).spawned,1);assert.equal(q.due(162.8),false);assert.equal(q.due(169.21),false);
 assert.equal(q.snapshot(169.21).expired,true);assert.equal(q.snapshot(169.21).remaining,5);
 assert(q.begin('B01',180));assert.equal(q.snapshot(180).remaining,8);q.clear();assert.equal(q.due(181.2),false);
});
