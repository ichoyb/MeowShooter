import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {BattleSnapshot} from '../src/battle';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {normalCourtyardRunConfig} from '../src/level-config';
import {Session} from '../src/rules';
import {RunGrowth,growthCards,growthCard,growthCardEligible,growthRank,GROWTH_ROUTES,GROWTH_COMBINATIONS,deriveGrowthConfig,orbitStats,type GrowthId} from '../src/progression';
import {growthCardSummary,growthChange} from '../src/ui/progression';
import * as Receipts from '../src/ui/reward-receipt';

const pairs=[['CAT01','W01'],['CAT02','W04'],['CAT03','W02']] as const;
const number=(value:number)=>Number(value.toFixed(3));
const base=(cat='CAT01',weapon='W01')=>normalCourtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
function harness(config=base(),seed=71){
 let value=seed;
 const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 const growth=new RunGrowth(seed,random,config),session=new Session(config);
 const snapshot=()=>({...session.snapshot(),progression:{...growth.snapshot(),contracts:session.contractSnapshot()},weaponStats:session.effectiveConfig.weapon,moveSpeed:session.effectiveConfig.moveSpeed}) as BattleSnapshot;
 return {config,growth,session,snapshot};
}
type Harness=ReturnType<typeof harness>;
function next(h:Harness,elite=false){
 const g=h.growth.snapshot();assert.equal(g.offer,null);
 if(elite){assert(h.growth.queueElite('elite-'+g.confirmedPicks,g.confirmedPicks+1));h.growth.openOffer();}
 else h.growth.collect(g.nextXP-g.xp);
 return h.growth.snapshot().offer!;
}
function confirm(h:Harness,id:GrowthId){
 const before=h.snapshot(),offer=before.progression!.offer!;
 assert(h.growth.confirm(h.growth.runId,offer.id,id,(ranks,source)=>h.session.applyGrowthReward(ranks,source==='elite'?.2:0)));
 return {before,after:h.snapshot(),id};
}
function buy(h:Harness,target:GrowthId,elite=false,beforeConfirm?:()=>void){
 for(let i=0;i<500;i++){
  const offer=next(h,elite);
  const id=offer.choices.includes(target)?target:offer.choices.find(id=>growthCard(id)!.kind==='attribute')!;
  assert(id,'a real offer keeps an attribute alternative');
  if(id===target)beforeConfirm?.();
  const fact=confirm(h,id);if(id===target)return fact;
 }
 assert.fail('actual candidate stream did not reach '+target);
}
function prepare(h:Harness,id:GrowthId){
 const own=(required:GrowthId)=>{if(!growthRank(h.growth.snapshot().ranks,required)){prepare(h,required);buy(h,required);}};
 const route=GROWTH_ROUTES.find(route=>route.evolution===id);
 if(route){own(route.core);buy(h,route.supports[0]);buy(h,route.supports[0]);}
 for(const required of GROWTH_COMBINATIONS.find(combination=>combination.id===id)?.requires??[])own(required);
 if(growthCard(id)!.kind==='attachment')own('L1_ORBIT_BELL');
 if(id==='L1_LIGHT_MAG')own('L1_ECHO');
 if(id==='A07'||id==='A08')own('L1_ORBIT_BELL');
 if(id==='A16'&&h.config.passive!=='spirit')own('C12');
 if(id==='M06'&&h.config.weapon.pellets===1)own('L1_SPLIT');
 if(id==='M09'&&!h.config.weapon.extraPierce)own('L1_PIERCE');
 if(id==='M26')own('C18');
 if(id==='M31')own('C23');
 if(id==='M10')own('C13');
 if(growthCard(id)!.kind==='tradeoff'){
  own('L1_ORBIT_BELL');
  while(h.growth.snapshot().confirmedPicks<4)buy(h,'L1_DAMAGE');
 }
 assert(growthCardEligible(id,h.growth.snapshot().ranks,h.config,h.growth.snapshot().confirmedPicks),'prepared legal '+id);
}
function receipt(fact:ReturnType<typeof confirm>,config:RunConfig){
 assert.equal(typeof (Receipts as any).makeRewardReceipt,'function','reward receipts need a pure snapshot projection');
 return (Receipts as any).makeRewardReceipt(fact.before,fact.after,fact.id,config);
}

test('each of the 50 legal rewards uses the real confirmation and existing text for all three fixed weapons',()=>{
 let covered=0;
 for(const [cat,weapon]of pairs)for(const [index,card]of growthCards(base(cat,weapon)).entries()){
  const h=harness(base(cat,weapon),71+index);prepare(h,card.id);const fact=buy(h,card.id),r=receipt(fact,h.config);
  assert(r,cat+' '+card.id);covered++;
  assert.equal(r.runId,fact.before.progression!.runId);assert.equal(r.offerId,fact.before.progression!.offer!.id);
  assert.equal(r.cardId,card.id);assert.equal(r.name,card.name);assert.equal(r.icon,card.icon);assert.equal(r.source,'experience');
  assert.equal(r.rankBefore,growthRank(fact.before.progression!.ranks,card.id));assert.equal(r.rankAfter,r.rankBefore+1);
  const summary=growthCardSummary(card.id,fact.before.progression!,h.config);
  assert.equal(r.benefit,summary.benefit);assert.equal(r.cost,summary.cost);assert.equal(r.change,growthChange(card.id,fact.before.progression!,h.config));
  assert(!/undefined|NaN/.test(r.benefit+(r.cost??'')+r.change),cat+' '+card.id);
  const mode=card.kind==='attribute'?'attribute':card.kind==='tradeoff'?'tradeoff':['evolution','combination'].includes(card.kind)?'evolution':'core';
  assert.equal(r.mode,mode,cat+' '+card.id);assert.equal(r.durationMs,({attribute:200,tradeoff:300,evolution:650,core:400})[mode]);
 }
 assert.equal(covered,150);
});

test('unconfirmed, expired, duplicate, wrong-run and wrong-card inputs produce no receipt',()=>{
 const h=harness(),fact=buy(h,'L1_DAMAGE'),call=(before:BattleSnapshot,after:BattleSnapshot,id:string=fact.id)=>(Receipts as any).makeRewardReceipt(before,after,id,h.config);
 receipt(fact,h.config);
 assert.equal(call(fact.before,fact.before),null);assert.equal(call(fact.after,fact.after),null);
 assert.equal(call(fact.before,fact.after,'not-a-card'),null);
 const other=growthCards(h.config).find(card=>!fact.before.progression!.offer!.choices.includes(card.id))!.id;
 assert.equal(call(fact.before,fact.after,other),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,runId:999}}),null);
 assert.equal(call({...fact.before,progression:null},fact.after),null);
 assert.equal(call(fact.before,{...fact.after,progression:null}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,offer:fact.before.progression!.offer}}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,offer:{...fact.before.progression!.offer!,id:0}}}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,confirmedPicks:fact.before.progression!.confirmedPicks}}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,confirmedPicks:fact.after.progression!.confirmedPicks+1}}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,ranks:{...fact.after.progression!.ranks,L1_DAMAGE:fact.after.progression!.ranks.L1_DAMAGE+1}}}),null);
 assert.equal(call(fact.before,{...fact.after,progression:{...fact.after.progression!,ranks:{...fact.after.progression!.ranks,L1_RATE:fact.after.progression!.ranks.L1_RATE+1}}}),null);
 assert.equal(call(fact.before,{...fact.after,catId:'CAT02'}),null);
 const later=buy(h,'L1_DAMAGE');assert.equal(call(fact.before,later.after),null);
});

test('successive pending offers identify the consumed offer and do not require an empty next offer',()=>{
 const h=harness();h.growth.collect(100);const before=h.snapshot(),id=before.progression!.offer!.choices[0],fact=confirm(h,id),r=receipt(fact,h.config);
 assert(fact.after.progression!.offer);assert(fact.after.progression!.offer!.id>before.progression!.offer!.id);assert.equal(r.offerId,before.progression!.offer!.id);
});

test('repeat attributes continue beyond the third choice and use actual weapon values',()=>{
 for(const [cat,weapon]of pairs){
  const h=harness(base(cat,weapon));for(let i=0;i<4;i++)buy(h,'L1_DAMAGE');
  const fact=buy(h,'L1_DAMAGE'),r=receipt(fact,h.config),before=deriveGrowthConfig(h.config,fact.before.progression!.ranks),after=deriveGrowthConfig(h.config,fact.after.progression!.ranks);
  assert(r.rankBefore>=4);assert.equal(r.mode,'attribute');
  assert(r.change.includes(`${number(before.weapon.damage*h.config.directDamageMultiplier)} → ${number(after.weapon.damage*h.config.directDamageMultiplier)}`));
 }
});

test('orbit first acquisition and both ranks expose the real two, three and four bell counts',()=>{
 const h=harness();for(let rank=1;rank<=3;rank++){
  const fact=buy(h,'L1_ORBIT_BELL'),r=receipt(fact,h.config);
  assert.equal(r.mode,rank===1?'core':'rank');assert.equal(r.durationMs,400);assert.equal(r.rankAfter,rank);
  assert(r.change.includes(`Lv.${rank-1} → Lv.${rank}`));assert(r.change.includes(`${orbitStats(rank-1).count} → ${orbitStats(rank).count} 枚`));
 }
});

test('comet evolution and contracts preserve each weapon actual changes plus both sides of the tradeoff',()=>{
 for(const [cat,weapon]of pairs)for(const id of ['L1_EVO_BARRAGE','R04','R05','R06','R07']as const){
  const h=harness(base(cat,weapon));prepare(h,id);const fact=buy(h,id),r=receipt(fact,h.config);
  if(id==='L1_EVO_BARRAGE'){
   const before=fact.before.weaponStats,after=fact.after.weaponStats;
   assert.equal(r.mode,'evolution');assert(r.change.includes(`${before.pellets} → ${after.pellets} 颗主弹`));
  }else {assert.equal(r.mode,'tradeoff');assert(r.benefit.length>0&&r.cost.length>0);assert.match(r.change,/武器单颗 .* → .*伤害.*独立技能S .* → /);}
 }
});

test('elite healing is the actual HP difference at full and partial health, including heart growth',()=>{
 for(const [cat,weapon]of pairs)for(const missing of [0,7,70])for(const id of ['L1_DAMAGE','L1_HEART']as const){
  const h=harness(base(cat,weapon));
  // Set the controlled damage only when the actual target offer is present,
  // so earlier legal confirmations cannot fill this test's missing health.
  const fact=buy(h,id,true,()=>{h.session.hp=h.session.effectiveConfig.maxHp-missing;}),r=receipt(fact,h.config);
  assert.equal(r.mode,'elite');assert.equal(r.durationMs,450);assert.equal(r.source,'elite');
  assert.deepEqual(r.healing,{before:fact.before.hp,after:fact.after.hp,max:fact.after.maxHp,actual:fact.after.hp-fact.before.hp});
  assert.equal(r.healing.before,fact.before.maxHp-missing);
  const elite=fact.after.progression!.eliteRewards.at(-1)!;assert.equal(elite.offerId,r.offerId);
  if(id==='L1_DAMAGE')assert.equal(r.healing.actual,elite.recovered);
  else assert.equal(r.healing.actual,elite.recovered+fact.after.maxHp-fact.before.maxHp);
  if(fact.before.hp===fact.before.maxHp&&id!=='L1_HEART')assert.equal(r.healing.actual,0);
  if(missing===7&&id==='L1_DAMAGE')assert.equal(r.healing.actual,7);
  if(missing===70&&id==='L1_DAMAGE')assert(r.healing.actual>0&&r.healing.actual<70,'a large deficit remains partly unhealed');
  const missingFact={...fact,after:{...fact.after,progression:{...fact.after.progression!,eliteRewards:fact.before.progression!.eliteRewards}}};
  assert.equal(receipt(missingFact,h.config),null);
 }
});

test('projection is immutable and repeatable without changing the rule snapshots or configuration',()=>{
 const h=harness(),fact=buy(h,'L1_DAMAGE'),saved=JSON.stringify({fact,config:h.config}),first=receipt(fact,h.config),second=receipt(fact,h.config);
 assert.deepEqual(first,second);assert.equal(JSON.stringify({fact,config:h.config}),saved);
 assert(Object.isFrozen(first));assert(Object.isFrozen(first.healing));
});
