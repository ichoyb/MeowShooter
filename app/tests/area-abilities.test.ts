import {historicalNormal44Config} from './helpers/historical-growth';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import * as Config from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import {growthChange,growthCardSummary,growthDetail,growthBuild,growthPage} from '../src/ui/progression';
const zero:Growth.GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const controlled33=(cat='CAT01',weapon='W01'):Config.RunConfig=>({...courtyardRunConfig(Config.makeRunConfig(cat,weapon,'p2-basic')),projectileTraits:{enabled:true},projectileFlight:{enabled:true},huntTargeting:{enabled:true}});
const pilot=(cat='CAT01',weapon='W01'):Config.RunConfig=>({...controlled33(cat,weapon),areaAbilities:{enabled:true}});
const close=(actual:number,expected:number)=>assert(Math.abs(actual-expected)<1e-10,`${actual} ≈ ${expected}`);
const newIds=['A07','A08','A10','C15','C16','E16'];
const fn=(id:string)=>{const f=(Growth as any)[id];assert.equal(typeof f,'function',id+' must be exported as a pure rule');return f;};

test('six area identities require explicit controlled opt-in while normal44 adopts exact v14',()=>{
 const base=controlled33(),normal=historicalNormal44Config();
 assert.equal(Growth.GROWTH_CARDS.length,33);
 assert.equal(new Growth.RunGrowth(1,()=>0,base).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits-flight-v2-hunt-v1');
 assert.equal(new Growth.RunGrowth(1,()=>0,normal).snapshot().rulesVersion,'courtyard-growth-defense-v14');assert.equal(Growth.growthCards(normal).length,44);
 for(const id of newIds)assert.equal(Growth.growthCardEligible(id as Growth.GrowthId,{...zero,C15:1} as Growth.GrowthRanks,base),false);
 assert.equal(fn('growthCards')(base).length,33);assert.equal(fn('growthCards')(pilot()).length,39);
 assert.match(new Growth.RunGrowth(1,()=>0,pilot()).snapshot().rulesVersion,/-controlled.*-area-v2$/);
 for(const id of ['A07','A08','A10'])assert.equal(fn('growthCard')(id).limit,null);
 assert.equal(fn('growthCard')('C15').limit,1);
 for(const id of ['C16','E16'])assert.equal(fn('growthCard')(id).limit,1);
 assert(!new Growth.RunGrowth(1,()=>0,base).snapshot().combinations.some(c=>(c.id as string)==='E16'));
});

test('A07 and A08 qualify only actual beneficiaries, native spirit qualifies only A07',()=>{
 const eligible=(id:string,r:Record<string,number>={},b=pilot())=>Growth.growthCardEligible(id as Growth.GrowthId,{...zero,...r},b);
 assert(!eligible('A07'));assert(!eligible('A08'));assert(eligible('A10'));assert(eligible('C15'));assert(!eligible('C15',{C15:1}));
 for(const source of ['L1_TRAIL_BELL','L1_ORBIT_BELL','C15','C16'])for(const id of ['A07','A08'])assert(eligible(id,{[source]:1}),id+' '+source);
 assert(eligible('A07',{L1_PICKUP_CHIME:1}));assert(!eligible('A08',{L1_PICKUP_CHIME:1}));
 assert(!eligible('A07',{L1_SHOCK_BELL:1}));assert(eligible('A08',{L1_SHOCK_BELL:1}));
 assert(eligible('A07',{},pilot('CAT03','W02')));assert(!eligible('A08',{},pilot('CAT03','W02')));
 assert(eligible('A07',{C15:1,A07:1000}));assert(eligible('A08',{C15:1,A08:1000}));assert(eligible('A10',{A10:1000}));
});

test('independent S and pulse values match all three fixed pairs, native spirit excludes strength',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,weapon),r={...zero,A07:1,L1_DAMAGE:1,L1_SPLIT:1,A11:5,A12:3,C18:1};
  assert.equal(Growth.abilityDamage(b,r),18);assert.equal(fn('nativeSpiritDamage')(b,r),7.5);
  const stats=fn('pulseStats');close(stats(b,zero).damage,8.4);assert.equal(stats(b,{...zero,A07:1}).damage,10.5);
  const s=stats(b,r);assert.equal(s.damage,12.6);assert.deepEqual([s.intervalSeconds,s.radius,s.targets],[3,48,8]);
  const direct=Growth.deriveGrowthConfig(b,{...zero,A07:5,A08:5,A10:5});assert.deepEqual(direct.weapon,b.weapon);
  const unflagged={...b,areaAbilities:undefined};close(Growth.abilityDamage(unflagged,r),14.4);assert.equal(fn('nativeSpiritDamage')(unflagged,r),6);
 }
});

test('A08 derives current orbits and deployment geometry without changing frequency or caps',()=>{
 const b=pilot(),r={...zero,A08:2},geometry=fn('abilityGeometry')(b,r);
 for(const [key,value]of Object.entries({shockRadius:35.2,trailTrigger:33,trailRadius:46.2,orbitRadius:66,starRadius:88,orbitSize:17.6,orbitHitRadius:8.8,pulseRadius:52.8,anchorRadius:66}))assert(Math.abs(geometry[key]-value)<1e-10,key);
 assert.equal(fn('areaMultiplier')(b,{...zero,A08:100}),6);
 assert.equal(Growth.orbitStats(1).cooldown,.8);
});

test('area pilot reward descriptions distinguish current owned effects from the next purchase',()=>{
 const b=pilot(),g={...new Growth.RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,C15:1,A07:1,A08:1,A10:1}} as Growth.GrowthSnapshot;
 for(const id of newIds)assert(growthCardSummary(id as Growth.GrowthId,g,b).benefit.length>0);
 assert.match(growthChange('A07' as Growth.GrowthId,g,b),/15 → 18/);
 assert.match(growthChange('A08' as Growth.GrowthId,g,b),/1\.05 → 1\.1/);
 assert.match(growthChange('A10' as Growth.GrowthId,g,b),/44 → 48/);
 const owned=growthDetail('A07',g,b,{source:'owned'}).body;assert.match(owned,/15/);assert.doesNotMatch(owned,/15 → 18/);
 const pulse=growthDetail('C15',g,b,{source:'owned'}).body;assert.match(pulse,/10\.5/);assert.match(pulse,/50\.4u/);
 assert.match(growthCardSummary('L1_SHOCK_BELL',g,b).benefit,/33\.6u/);
 assert.match(growthDetail('L1_ORBIT_BELL',{...g,ranks:{...g.ranks,L1_ORBIT_BELL:1}},b,{source:'owned'}).body,/63u/);
 const build=growthBuild({...g,ranks:{...g.ranks,A07:2,A10:2}},b);
 assert.match(build,/当前K ×1\.5/);assert.match(build,/当前吸附启动48u/);
});

test('area feature is rejected outside playtest before any Scene is changed',()=>{
 const gate=(Config as any).assertAreaAbilitiesProfile;assert.equal(typeof gate,'function');
 for(const profile of ['release','review'])assert.throws(()=>gate(pilot(),profile),/playtest/);
 assert.doesNotThrow(()=>gate(pilot(),'playtest'));
});

test('A07 current and next native spirit values are shown only for a cat that actually has spirit',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,weapon),g={...new Growth.RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,A07:1}} as Growth.GrowthSnapshot;
  const next=growthChange('A07',g,b),owned=growthDetail('A07',g,b,{source:'owned'}).body;
  if(cat==='CAT03'){assert.match(next,/原生星灵7\.5 → 9/);assert.match(owned,/原生星灵7\.5伤害/);}
  else{assert.doesNotMatch(next,/原生星灵/);assert.doesNotMatch(owned,/原生星灵7\.5伤害/);}
 }
});

test('area reward and owned-build icons stay within the retained courtyard runtime assets',()=>{
 const retained=new Set(['BALL.svg','MAG.svg','GUARD.svg','MOVE.svg']);
 for(const card of Growth.AREA_GROWTH_CARDS)assert(retained.has(card.icon),card.id+' references unloaded courtyard icon '+card.icon);
 const b=pilot(),g={...new Growth.RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,A07:1,A08:1,A10:1,C15:1},
  offer:{id:1,choices:['A07','A08','C15'],source:'experience'}} as Growth.GrowthSnapshot;
 for(const markup of [growthPage(g,b,undefined,{courtyard:true}).body,growthBuild(g,b,{courtyard:true})]){
  const icons=Array.from(markup.matchAll(/data-ui-asset="([^"]+)"/g),match=>match[1]);assert(icons.length>=3);
  for(const icon of icons)assert(retained.has(icon),'rendered unloaded courtyard icon '+icon);
 }
});

test('anchor is an independent once-only core and fusion requires both actually selected cores',()=>{
 const b=pilot(),eligible=(id:string,r:Record<string,number>={})=>Growth.growthCardEligible(id as Growth.GrowthId,{...zero,...r},b);
 assert(eligible('C16'));assert(!eligible('C16',{C16:1}));
 for(const r of [{},{C15:1},{C16:1},{A07:10,A08:10}])assert(!eligible('E16',r));
 assert(eligible('E16',{C15:1,C16:1}));assert(!eligible('E16',{C15:1,C16:1,E16:1}));
 const growth=new Growth.RunGrowth(8,()=>.99,b);
 // Start from real owned facts; the next real reward must reserve its advanced slot.
 Object.assign(growth as any,{ranks:{...zero,C15:1,C16:1}});growth.collect(8);
 assert(growth.snapshot().offer!.choices.includes('E16' as Growth.GrowthId));
 assert.equal(growth.snapshot().ranks.E16??0,0);
 assert(growth.confirm(8,growth.snapshot().offer!.id,'E16'));
 assert.equal(growth.snapshot().ranks.E16,1);
});

test('anchor deployment freezes independent S and Q without inheriting weapon or attack modifiers',()=>{
 const stats=fn('anchorStats');
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,weapon),s=stats(b,{...zero,C16:1,L1_DAMAGE:1,A07:1,A08:2,L1_RATE:9,L1_RANGE:5,L1_SPLIT:1,A11:5,A12:7,C18:1});
  assert.deepEqual([s.intervalSeconds,s.durationSeconds,s.range,s.radius,s.targets,s.arrivalRadius],[5,2,240,66,8,4]);
  close(s.damage,7.2);close(stats(b,zero).damage,4.8);
 }
});

test('anchor pull eligibility preserves frozen, entering, stopped and special enemy intents',()=>{
 const eligible=fn('anchorPullEligible'),moving={enemyId:'E01',active:true,hp:10,deathResolved:false,entering:false,frozen:false,speed:24};
 for(const enemyId of ['E01','E03','E04'])assert(eligible({...moving,enemyId}));
 for(const enemyId of ['E02','EL01','B01','box',''])assert(!eligible({...moving,enemyId}));
 for(const invalid of [{active:false},{hp:0},{deathResolved:true},{entering:true},{frozen:true},{speed:0}])assert(!eligible({...moving,...invalid}));
});

test('fusion moves only an already due pulse and current UI does not invent an unowned anchor',()=>{
 const b=pilot(),origin=fn('pulsePosition'),feet={x:100,y:200},anchor={x:180,y:220};
 for(const ranks of [zero,{...zero,C15:1},{...zero,C15:1,C16:1},{...zero,C15:1,E16:1}])assert.deepEqual(origin(ranks,feet,anchor),feet);
 assert.deepEqual(origin({...zero,C15:1,C16:1,E16:1},feet,anchor),anchor);
 assert.deepEqual(origin({...zero,C15:1,C16:1,E16:1},feet,null),feet);
 const g={...new Growth.RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,C15:1,A07:1,A08:1}} as Growth.GrowthSnapshot;
 assert.doesNotMatch(growthDetail('A08',g,b,{source:'owned'}).body,/锚点/);
 const owned={...g,ranks:{...g.ranks,C16:1,E16:1}} as Growth.GrowthSnapshot;
 assert.match(growthDetail('A08',owned,b,{source:'owned'}).body,/锚点63u/);
 assert.match(growthDetail('C16',owned,b,{source:'owned'}).body,/6伤害/);
 assert.match(growthChange('C16',g,b),/63u/);
 assert.match(growthCardSummary('E16',owned,b).benefit,/10\.5/);
 assert.match(growthDetail('E16',owned,b,{source:'owned'}).body,/不双发/);
});
