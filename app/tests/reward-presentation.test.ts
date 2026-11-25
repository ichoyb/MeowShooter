import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {GROWTH_CARDS,RunGrowth,deriveGrowthConfig,growthNumbers,type GrowthId,type GrowthRanks,type GrowthSnapshot} from '../src/progression';
import * as UI from '../src/ui/progression';
import {esc} from '../src/ui/components';
import {NavigationModel} from '../src/ui/model';
import {renderLayer} from '../src/ui/layers';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const number=(n:number)=>Number(n.toFixed(3));
const base=(cat='CAT01',weapon='W01'):RunConfig=>({...makeRunConfig(cat,weapon,'p2-basic'),projectileTraits:{enabled:true},projectileFlight:{enabled:true}});
const snapshot=(b:RunConfig,ranks:GrowthRanks=zero,choices:GrowthId[]=['L1_SPLIT']):GrowthSnapshot=>({...new RunGrowth(73,()=>0,b).snapshot(),ranks:{...ranks},offer:{id:18,choices,source:'experience'}});
const summary=(id:GrowthId,g:GrowthSnapshot,b:RunConfig):{benefit:string;cost?:string}=>{
 assert.equal(typeof (UI as any).growthCardSummary,'function','reward summaries must read the actual frozen run');
 return (UI as any).growthCardSummary(id,g,b);
};

test('split shows all three weapons actual pellet gain, per-pellet loss and final spread on the card',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=base(cat,weapon),g=snapshot(b),before=deriveGrowthConfig(b,g.ranks),after=deriveGrowthConfig(b,{...g.ranks,L1_SPLIT:1});
  const page=UI.growthPage(g,b).body;
  assert(page.includes(`主弹 ${before.weapon.pellets} → ${after.weapon.pellets}颗`));
  assert(page.includes(`每颗 ${number(before.weapon.damage*b.directDamageMultiplier)} → ${number(after.weapon.damage*b.directDamageMultiplier)}伤害`),'the card must expose actual per-pellet damage loss');
  assert(page.includes(`总散角 ${before.weapon.spreadDegrees} → ${after.weapon.spreadDegrees}°`),'spread tradeoff must remain on the card');
  if(weapon==='W02')assert(!page.includes('×0.8'),'native five-pellet damage uses 5/6 rather than a fixed .8');
 }
});

test('light magazine exposes halved native capacity and actual reload time after existing attributes',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=base(cat,weapon),g=snapshot(b,{...zero,L1_ECHO:1,L1_RELOAD:2},['L1_LIGHT_MAG']);
  const before=deriveGrowthConfig(b,g.ranks),after=deriveGrowthConfig(b,{...g.ranks,L1_LIGHT_MAG:1}),s=summary('L1_LIGHT_MAG',g,b);
  assert(s.benefit.includes(`${number(before.weapon.reloadSeconds)} → ${number(after.weapon.reloadSeconds)}秒`));
  assert(s.cost?.includes(`基础弹匣减半：${before.weapon.ammoCapacity} → ${after.weapon.ammoCapacity}发`));
  assert.match(s.cost!,/不补弹/);
 }
});

test('both attribute plans show their real incremental gains without adopting draft 25 percent',()=>{
 for(const attributePlan of ['A','B'] as const){
  const b={...base(),growthTuning:{attributePlan,xpTarget:28 as const}},g=snapshot(b),n=growthNumbers(attributePlan);
  for(const [id,expected] of [['L1_DAMAGE',`+${100*n.damage}%`],['L1_RATE',`+${100*n.rate}%`],['L1_HEART',`+${n.heart}`],['L1_RELOAD',`+${100*n.reload}%`],['L1_RANGE',`+${100*n.range}%`],['L1_MOVE',`+${100*n.move}%`]] as const){
   assert(summary(id,g,b).benefit.includes(expected),`${attributePlan} ${id}`);
   assert(!summary(id,g,b).benefit.includes('+25%'));
  }
 }
});

test('the last critical-chance card shows the actual five-point increment and source scope',()=>{
 const b=base(),g=snapshot(b,{...zero,A11:5},['A11']);
 const page=UI.growthPage(g,b).body,s=summary('A11',g,b);
 assert.match(s.benefit,/\+5个百分点.*55% → 60%/);assert.doesNotMatch(page,/\+10个百分点/);
 assert.match(s.cost!,/仅主弹.*60%/);
 const critical=summary('A12',snapshot(b,{...zero,A12:3}),b);
 assert.match(critical.benefit,/4.5 → 5.5/);assert.match(critical.cost!,/非暴击.*副弹/);
});

test('rhythm retarget and evolution keep increased delay, replacement and secondary spread tradeoffs visible',()=>{
 const b=base(),g=snapshot(b,{...zero,C23:1,L1_SPLIT:1});
 const retarget=summary('M31',g,b),evolution=summary('E21',g,b),cluster=summary('M06',g,b);
 assert.match(retarget.benefit,/重选.*最近敌人/);assert.match(retarget.cost!,/0.18 → 0.5秒.*无目标跳过/);
 assert.match(evolution.benefit,/1颗60% → 3颗各30%副弹/);
 assert.match(evolution.cost!,/替换原副弹.*0.06秒.*12°.*集束不收束/);
 assert.match(cluster.cost!,/覆盖缩小.*仅主弹.*副弹不变/);
});

test('every existing reward has a concise core benefit and preserves its decisive limits',()=>{
 const b=base('CAT03','W02'),g=snapshot(b,{...zero,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_ORBIT_BELL:1,C23:1});
 const required:Partial<Record<GrowthId,RegExp>>={
  L1_PIERCE:/逐敌.*70%.*仅主弹/,L1_EVO_PIERCE:/逐敌.*70%.*仅主弹/,
  L1_ECHO:/副弹.*18°.*不穿透/,L1_EVO_CADENCE:/仅真实装填.*12°/,
  L1_SHOCK_BELL:/其他敌.*35%.*副弹不触发/,L1_RICOCHET:/60%.*仅.*主弹/,
  L1_TRAIL_BELL:/布防.*满额替最早/,L1_ORBIT_BELL:/同敌共享.*不挡弹.*不免伤/,
  L1_PICKUP_CHIME:/溢出不留.*不分弹.*不穿透/,L1_DUO_TRAIL_CADENCE:/仅装填.*满额替最早/,
  L1_DUO_STAR_RING:/3秒.*已有满格不补触发/,C23:/0.18秒.*不穿透/,
  A15:/寿命.*仅新投射物.*星灵不变/,M05:/70%.*1个新目标.*副弹不返航/,
  M09:/首目标.*额度不变.*仅主弹/
 };
 assert.equal(GROWTH_CARDS.length,33);
 for(const card of GROWTH_CARDS){
  const s=summary(card.id,g,b);assert(s.benefit.length>0&&s.benefit.length<85,`${card.id} concise benefit`);
  assert(!/undefined|NaN|\.\.\.|…/.test(s.benefit+(s.cost||'')),card.id);
  if(required[card.id])assert.match(s.cost!,required[card.id]!,card.id);
 }
 const orange=base();assert.match(summary('L1_EVO_CADENCE',snapshot(orange),orange).cost!,/替换橘团75%装填首发/);
});

test('read-only details preserve the entire derived change and existing rule text for all rewards',()=>{
 const b=base('CAT03','W02'),g=snapshot(b,{...zero,L1_SPLIT:1,L1_PIERCE:1,L1_ECHO:1,L1_ORBIT_BELL:2,L1_RATE:2,A11:5});
 for(const card of GROWTH_CARDS){
  const detail=(UI.growthDetail as any)(card.id,g,b);
  assert(detail.body.includes(esc(UI.growthChange(card.id,g,b))),`${card.id} full derived change is visible in details`);
  if(card.kind!=='attribute'||['A11','A12','A15'].includes(card.id))assert(detail.body.includes(esc(card.detail)),`${card.id} original rules remain`);
  assert.match(detail.body,/查看规则不会选中或确认/);
  assert.doesNotMatch(detail.body+detail.footer,/data-action="growth-(?:select|confirm):/);
 }
 assert.doesNotThrow(()=>UI.growthDetail('L1_DAMAGE'));
});

test('layer details consume the actual run configuration rather than a default weapon',()=>{
 const b=base('CAT02','W04'),g=snapshot(b),m=new NavigationModel(false,true);m.run=b;
 m.openLayer('LAYER-03-S01',{growthDetail:'L1_SPLIT',progression:g});
 assert(renderLayer(m,{}).body.includes(esc(UI.growthChange('L1_SPLIT',g,b))));
});

test('one, two and three offers preserve separate select/detail actions and the original confirm transaction keys',()=>{
 const b=base(),before=JSON.stringify(b);
 for(const choices of [['L1_DAMAGE'],['L1_DAMAGE','L1_SPLIT'],['L1_DAMAGE','L1_SPLIT','L1_HEART']] as GrowthId[][]){
  const g=snapshot(b,zero,choices),original=JSON.stringify(g),page=UI.growthPage(g,b,choices[0]),unselected=UI.growthPage(g,b);
  assert.equal((page.body.match(/<article /g)||[]).length,choices.length);
  assert.equal((page.body.match(/data-action="growth-select:73\.18\./g)||[]).length,choices.length);
  assert.equal((page.body.match(/data-action="growth-detail:/g)||[]).length,choices.length);
  assert.doesNotMatch(page.body,/data-action="growth-confirm:/);
  assert(page.footer.includes(`data-action="growth-confirm:73.18.${choices[0]}"`));
  assert.match(unselected.footer,/data-action="growth-confirm:73\.18\."[^>]+disabled/);
  assert.equal(JSON.stringify(g),original);assert.equal(JSON.stringify(b),before);
 }
});
