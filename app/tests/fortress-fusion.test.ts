import {historicalNormal44Config} from './helpers/historical-growth';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {growthCards,growthCard,growthCardEligible,RunGrowth,deriveGrowthConfig,type GrowthRanks,type GrowthSnapshot} from '../src/progression';
import {growthBuild,growthChange,growthCardSummary,growthDetail} from '../src/ui/progression';
import {sentinelStats} from '../src/sentinel-rules';
import {nativeSpiritDamage} from '../src/area-ability-rules';
import {projectileCapacityForGrowth} from '../src/progression-capacity';
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const normal=(cat='CAT01',weapon='W01')=>historicalNormal44Config(cat,weapon);
const pilot=(cat='CAT01',weapon='W01'):RunConfig=>({...normal(cat,weapon),growthPool:undefined,defenseCompanions:{enabled:true}});
test('controlled defense44 and normal44 expose E14 only after both purchased cores',()=>{
 const b=pilot();assert.equal(growthCards(b).length,44);assert.equal(growthCards(normal()).length,44);
 assert.equal(growthCard('E14')?.kind,'combination');assert.equal(growthCard('E14')?.limit,1);assert.equal(growthCard('E14')?.icon,'BALL.svg');
 assert.match(new RunGrowth(1,()=>0,b).snapshot().rulesVersion,/-controlled-defense-v3$/);
 assert.equal(new RunGrowth(1,()=>0,normal()).snapshot().rulesVersion,'courtyard-growth-defense-v14');
 for(const ranks of [zero,{...zero,C12:1},{...zero,C13:1}])assert(!growthCardEligible('E14' as any,ranks,b));
 assert(growthCardEligible('E14' as any,{...zero,C12:1,C13:1},b));
 assert(!growthCardEligible('E14' as any,{...zero,C12:1,C13:1,E14:1} as any,b));
 assert(!growthCardEligible('E14' as any,{...zero,C13:1},pilot('CAT03','W02')),'native spirit cannot substitute for C12');
 assert(growthCardEligible('E14' as any,{...zero,C12:1,C13:1},normal()));
});
test('E14 follows guaranteed advance rotation and remains an independently confirmed frozen offer',()=>{
 const g:any=new RunGrowth(7,()=>.5,pilot());g.ranks={...zero,C12:1,C13:1,C15:1,C16:1};g.collect(100);
 const offer=g.snapshot().offer;assert(offer.choices.includes('E14'));assert.equal(g.snapshot().ranks.E14,undefined);
 g.collect(0);assert.deepEqual(g.snapshot().offer,offer);
 assert(g.confirm(7,offer.id,offer.choices.find((id:string)=>id!=='E14')));
 assert(g.snapshot().offer.choices.includes('E16'),'declining E14 rotates the guaranteed advance');
 assert.equal(g.snapshot().ranks.E14,undefined);
 const second=g.snapshot().offer;assert(g.confirm(7,second.id,second.choices.find((id:string)=>id!=='E16')));
 const third=g.snapshot().offer;assert(third.choices.includes('E14'));assert(g.confirm(7,third.id,'E14'));
 assert.equal(g.snapshot().ranks.E14,1);assert(!g.confirm(7,third.id,'E14'));assert(!g.snapshot().offer.choices.includes('E14'));
});
test('disabled snapshots and build/detail UI do not advertise E14 metadata',()=>{
 const b={...normal(),defenseCompanions:undefined},g=new RunGrowth(1,()=>0,b).snapshot();
 assert(!g.combinations.some(c=>String(c.id)==='E14'));
 assert.doesNotMatch(growthBuild(g,b,{courtyard:true}),/移动堡垒|E14/);
 assert.doesNotMatch(growthDetail('E14',g,b,{courtyard:true}).body,/移动堡垒|附着|定点哨卫/);
 const forged:any=new RunGrowth(1,()=>0,b);forged.ranks={...zero,C12:1,C13:1};forged.collect(8);forged.offer={id:1,source:'experience',choices:['E14']};
 assert(!forged.confirm(1,1,'E14'));
});
test('attached new sentinel damage is 80 percent while ground/native spirit and capacity stay unchanged',()=>{
 for(const [cat,w]of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']])for(const [extra,ground,attached]of [[{},7.2,5.76],[{A07:1},9,7.2],[{L1_DAMAGE:1,A07:1},10.8,8.64]] as const){
  const b=pilot(cat,w),r={...zero,...extra,C12:1,C13:1,E14:1,A16:2} as any;
  assert(Math.abs(sentinelStats(b,r).damage-ground)<1e-9);
  assert(Math.abs((sentinelStats as Function)(b,r,true).damage-attached)<1e-9);
  assert.equal(nativeSpiritDamage(b,r),6*(1+.25*(extra.A07??0)));
  const noFusion={...r,E14:0};assert.deepEqual(deriveGrowthConfig(b,r),deriveGrowthConfig(b,noFusion));
  assert.equal(projectileCapacityForGrowth(b,deriveGrowthConfig(b,r),r),projectileCapacityForGrowth(b,deriveGrowthConfig(b,noFusion),noFusion));
 }
});
test('E14 UI uses shared prerequisites, both damage forms and the actual current station state',()=>{
 const b=pilot(),r={...zero,C12:1,C13:1,E14:1,A07:1},g={...new RunGrowth(1,()=>0,b).snapshot(),ranks:r} as GrowthSnapshot;
 assert.match(growthDetail('E14',g,b,{courtyard:true}).body,/定点哨卫.*能量护盾/);
 const summary=growthCardSummary('E14' as any,g,b);assert.match(summary.benefit,/正盾|护盾/);assert.match(summary.cost??'',/八折|80%/);
 assert.match(growthChange('E14' as any,g,b),/7\.2.*9/);
 for(const [station,state,damage]of [[null,/等待.*部署/,/7\.2.*9/],[{attached:true},/当前附着/,/7\.2/],[{attached:false},/当前落地/,/9/]] as const){
  const current={...g,sentry:{active:Number(!!station),station}} as any;
  const text=growthDetail('E14',current,b,{courtyard:true,source:'owned'}).body;assert.match(text,state);assert.match(text,damage);assert.doesNotMatch(text,/undefined|NaN/);
 }
});
