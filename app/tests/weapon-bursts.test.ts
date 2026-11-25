import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WeaponBursts} from '../src/weapon-bursts';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {deriveGrowthConfig,RunGrowth,growthCardEligible,growthRoutes,growthCombinations,GROWTH_CARDS,type GrowthRanks} from '../src/progression';
import {growthChange,growthBuild,growthDetail} from '../src/ui/progression';
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const pilot=(cat='CAT01',weapon='W01')=>({...makeRunConfig(cat,weapon,'p2-basic'),projectileTraits:{enabled:true as const}}) as RunConfig;
const rhythm=(bursts:WeaponBursts,base:RunConfig,ranks:GrowthRanks,id:number)=>(bursts as any).onRhythmVolley(base,ranks,{id});
test('C23 is the sixth real core and opt-in26 requires actual prerequisites, never old20',()=>{
 assert.equal(GROWTH_CARDS.length,33);
 for(const id of ['C23','M31','E21'] as const)assert(!growthCardEligible(id,zero,makeRunConfig('CAT01','W01','p2-basic')));
 const base=pilot();assert(growthCardEligible('C23',zero,base));assert(!growthCardEligible('C23',{...zero,C23:1},base));
 assert(!growthCardEligible('C23',zero,{...base,weapon:{...base.weapon,pellets:0}}));
 assert(!growthCardEligible('M31',zero,base));assert(growthCardEligible('M31',{...zero,C23:1},base));
 assert(!growthCardEligible('E21',{...zero,C23:1},base));assert(!growthCardEligible('E21',{...zero,L1_SPLIT:1},base));
 assert(growthCardEligible('E21',{...zero,C23:1,L1_SPLIT:1},base));
 assert(growthCardEligible('L1_SHOCK_BELL',{...zero,C23:1},base));
 assert(growthCardEligible('L1_PICKUP_CHIME',{...zero,C23:1},base));
 const route=growthRoutes({...zero,C23:1}).find(r=>r.core==='C23');assert(route?.coreOwned);assert.deepEqual(route.supports,['L1_DAMAGE','L1_RATE']);
 assert(growthCombinations({...zero,C23:1,L1_SPLIT:1}).some(c=>c.id==='E21'&&c.eligible));
});
test('C23 starts at zero on acquisition, deduplicates true roots, and keeps count through M31 and E21 picks',()=>{
 const b=new WeaponBursts(),base=pilot();assert.equal(typeof (b as any).onRhythmVolley,'function');
 for(let id=1;id<=7;id++)assert.equal(rhythm(b,base,zero,id),null);
 const r={...zero,C23:1};for(let id=8;id<=10;id++)assert.equal(rhythm(b,base,r,id),null);
 assert.equal(rhythm(b,base,{...r,M31:1,L1_SPLIT:1,E21:1},10),null);
 const intent=rhythm(b,base,{...r,M31:1,L1_SPLIT:1,E21:1},11);
 assert.equal(intent.delay,.5);assert.equal(intent.retarget,true);assert.deepEqual(intent.segments.map((s:any)=>s.offset),[0,.06,.12]);
 assert.equal((b.snapshot() as any).rhythmCounter,0);assert.equal((b.snapshot() as any).rhythmTriggers,1);
});
test('twelve actual roots count three rhythm triggers independently from one12-round or six2-round tails',()=>{
 for(const [base,ranks,tails] of [[pilot(),{...zero,C23:1,L1_ECHO:1},1],[pilot('CAT03','W02'),{...zero,C23:1,L1_ECHO:1,L1_LIGHT_MAG:1},6]] as const){
  const config=deriveGrowthConfig(base,ranks),b=new WeaponBursts();let triggers=0;
  for(let id=1;id<=12;id++){const ammo=config.weapon.ammoCapacity-id%config.weapon.ammoCapacity;const actualAmmo=ammo===config.weapon.ammoCapacity?0:ammo;
   b.onVolley(config,ranks,{id,ammo:actualAmmo,reloads:Math.floor((id-1)/config.weapon.ammoCapacity),opening:false});if(rhythm(b,config,ranks,id))triggers++;
  }
  assert.equal(b.snapshot().tailBursts,tails);assert.equal(triggers,3);
 }
});
test('C23 freezes single noncritical pellet P, lifetime speed range and shape; E21 replaces single without M06 compression',()=>{
 const b=new WeaponBursts(),base=pilot('CAT03','W02'),r={...zero,L1_DAMAGE:2,C23:1,L1_SPLIT:1,M06:1};
 const config=deriveGrowthConfig(base,r);for(let id=1;id<4;id++)rhythm(b,config,r,id);const old=rhythm(b,config,r,4);
 assert.equal(old.delay,.18);assert.equal(old.retarget,false);assert.equal(old.segments.length,1);assert.equal(old.segments[0].damage,config.weapon.damage*config.directDamageMultiplier*.6);
 assert.equal(old.life,config.weapon.bulletLifeSeconds);assert.equal(old.speed,config.weapon.bulletSpeed);assert.equal(old.range,config.weapon.targetRange);
 const next={...r,M31:1,E21:1};for(let id=5;id<8;id++)rhythm(b,config,next,id);const evolved=rhythm(b,config,next,8);
 assert.deepEqual(evolved.segments.map((s:any)=>s.angle),[-12,0,12]);assert(evolved.segments.every((s:any)=>s.damage===config.weapon.damage*config.directDamageMultiplier*.3));
 assert.equal(old.delay,.18);assert.equal(old.segments.length,1);assert(Object.isFrozen(old));assert(Object.isFrozen(old.segments));
 assert.equal(rhythm(new WeaponBursts(),makeRunConfig('CAT01','W01','p2-basic'),{...zero,C23:1},4),null);
});
test('E21 is a guaranteed selectable combination; declined offers preserve eligibility and real UI explains the change',()=>{
 const base=pilot(),g:any=new RunGrowth(19,()=>0,base);g.ranks={...zero,C23:1,L1_SPLIT:1};g.collect(1000);
 let s=g.snapshot();assert(s.offer.choices.includes('E21'));assert.equal(s.ranks.E21,undefined);
 assert(g.confirm(19,s.offer.id,'L1_DAMAGE'));s=g.snapshot();assert(s.offer.choices.includes('E21'));assert(g.confirm(19,s.offer.id,'E21'));
 s=g.snapshot();assert.equal(s.ranks.E21,1);assert(!growthCardEligible('E21',s.ranks,base));
 assert.match(growthChange('C23',s,base),/4/);assert.match(growthChange('M31',s,base),/0\.18.*0\.5/);assert.match(growthChange('E21',s,base),/3.*30%/);
 assert.match(growthBuild(s),/节律弹幕/);assert.match(growthDetail('E21',s).body,/节拍双击.*多重投射/);
});
