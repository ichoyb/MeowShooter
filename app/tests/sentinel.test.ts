import {historicalNormal44Config} from './helpers/historical-growth';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {growthCards,growthCard,growthCardEligible,RunGrowth,deriveGrowthConfig,type GrowthRanks} from '../src/progression';
import {growthChange,growthCardSummary,growthDetail} from '../src/ui/progression';
import {companionFrequency,sentinelStats} from '../src/sentinel-rules';
import {nativeSpiritDamage} from '../src/area-ability-rules';
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const base=(cat='CAT01',weapon='W01'):RunConfig=>({...historicalNormal44Config(cat,weapon),growthPool:undefined,defenseCompanions:{enabled:true}});
test('controlled defense44 and normal44 share C12/A16 rules with distinct snapshots',()=>{
 const b=base(),normal=historicalNormal44Config();
 assert.equal(growthCards(b).length,44);assert.equal(growthCards(normal).length,44);
 assert.equal(growthCard('C12')?.limit,1);assert.equal(growthCard('A16')?.limit,null);assert.equal(growthCard('E14')?.limit,1);
 assert.match(new RunGrowth(1,()=>0,b).snapshot().rulesVersion,/-controlled-defense-v3$/);
 assert(growthCardEligible('C12',zero,normal));assert(!growthCardEligible('A16',zero,normal));
 assert.equal(new RunGrowth(1,()=>0,normal).snapshot().rulesVersion,'courtyard-growth-defense-v14');
 assert(growthCardEligible('C12',zero,b));assert(!growthCardEligible('C12',{...zero,C12:1},b));
 assert(!growthCardEligible('A16',zero,b));assert(growthCardEligible('A16',{...zero,C12:1,A16:100},b));
 assert(growthCardEligible('A16',zero,base('CAT03','W02')));
});
test('sentinel is a damage core for A07 and old attachments but never grants A08 or armor qualification',()=>{
 const b=base();for(const id of ['A07','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'] as const)assert(growthCardEligible(id,{...zero,C12:1},b),id);
 assert(!growthCardEligible('A08',{...zero,C12:1},b));
 for(const id of ['A07','A08','A16','L1_SHOCK_BELL'] as const)assert(!growthCardEligible(id,{...zero,C13:1},b),id);
});
test('compound controlled suffix displays real area radii and sentinel range without changing primary stats',()=>{
 const b=base(),r={...zero,C12:1,A16:2,C15:1,C16:1,A08:2},g={...new RunGrowth(1,()=>0,b).snapshot(),ranks:r};
 for(const id of ['C12','A16'] as const){const summary=growthCardSummary(id,g,b);assert(summary.benefit);assert.doesNotMatch(growthDetail(id,g,b).body,/undefined|NaN/);}
 assert.match(growthDetail('C12',g,b,{source:'owned'}).body,/180u/);
 assert.match(growthDetail('L1_ORBIT_BELL',{...g,ranks:{...r,L1_ORBIT_BELL:1}},b,{source:'owned'}).body,/66u/);
 assert.match(growthDetail('C15',g,b,{source:'owned'}).body,/52.8u/);assert.match(growthDetail('C16',g,b,{source:'owned'}).body,/66u/);
 assert.match(growthChange('A16',g,b),/1.2.*1.3/);
 assert.deepEqual(deriveGrowthConfig(b,r).weapon,deriveGrowthConfig(b,zero).weapon);
 const spirit=base('CAT03','W02');assert.equal(nativeSpiritDamage(spirit,{...zero,L1_DAMAGE:30,A07:2}),9);
});

test('pure sentinel and frequency stats freeze the declared damage and exclude area, flight, main and spirit strength leaks',()=>{
 assert.equal(typeof companionFrequency,'function');assert.equal(typeof sentinelStats,'function');
 assert.equal(companionFrequency(zero),1);assert.equal(companionFrequency({...zero,A16:100}),11);
 const b=base(),r={...zero,L1_DAMAGE:2,A07:2,A16:1,A08:20,A15:20,L1_RATE:20,L1_RANGE:20,A11:4,A12:5};
 const stats=sentinelStats(b,r);assert(Math.abs(stats.damage-15.12)<1e-10);const {damage,...shape}=stats;assert.deepEqual(shape,{deploySeconds:6,durationSeconds:6,range:180,intervalSeconds:1/1.1,speed:600,lifeSeconds:1});
 assert.equal(nativeSpiritDamage(base('CAT03','W02'),r),9);
});

test('actual controlled offers admit C12 once and repeat A16 without gifting unchosen upgrades',()=>{
 const b=base('CAT03','W02');let value=8;const g=new RunGrowth(5,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},b);
 g.collect(2_000_000);let c12=false;
 for(let i=0;i<1800&&(g.snapshot().ranks.A16??0)<100;i++){
  const s=g.snapshot(),offer=s.offer!;assert(offer);for(const id of offer.choices)assert(growthCardEligible(id,s.ranks,b));
  const id=(!c12&&offer.choices.includes('C12')?'C12':offer.choices.includes('A16')?'A16':offer.choices.find(id=>id!=='A16')??offer.choices[0]);
  assert(g.confirm(5,offer.id,id));assert(!g.confirm(5,offer.id,id));if(id==='C12')c12=true;
 }
 assert(c12);assert.equal(g.snapshot().ranks.A16,100);assert.equal(g.snapshot().ranks.C12,1);
});

test('owned radius text uses the actual area capability even with a defense suffix',()=>{
 const b={...base(),areaAbilities:undefined},g={...new RunGrowth(1,()=>0,b).snapshot(),ranks:{...zero,C12:1,L1_ORBIT_BELL:1,A08:2}};
 assert.match(growthDetail('L1_ORBIT_BELL',g,b,{source:'owned'}).body,/60u/);
 assert.doesNotMatch(growthDetail('L1_ORBIT_BELL',g,b,{source:'owned'}).body,/66u/);
});

test('A16 current and candidate facts mention only companions actually present',()=>{
 const cat=base(),g={...new RunGrowth(1,()=>0,cat).snapshot(),ranks:{...zero,C12:1,A16:2}};
 assert.doesNotMatch(growthChange('A16',g,cat),/星灵/);assert.doesNotMatch(growthDetail('A16',g,cat,{source:'owned'}).body.split('<h2>完整规则</h2>')[0],/星灵/);
 const spirit=base('CAT03','W02'),native={...new RunGrowth(1,()=>0,spirit).snapshot(),ranks:{...zero,A16:2}};
 assert.doesNotMatch(growthChange('A16',native,spirit),/哨卫/);
});
