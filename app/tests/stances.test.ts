import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import * as Contracts from '../src/contract-rules';
import * as Config from '../src/combat-config';
import {historicalNormal44Config,controlled44Config} from './helpers/historical-growth';
import {Session} from '../src/rules';
import {growthCardSummary,growthChange,growthDetail,growthBuild} from '../src/ui/progression';
import type {GrowthRanks} from '../src/progression';
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const normal=()=>historicalNormal44Config();
const pilot=(cat='CAT01',weapon='W01'):Config.RunConfig=>({...controlled44Config(cat,weapon),sustainRewards:{enabled:true},rewardContracts:{enabled:true},movementContracts:{enabled:true}} as any);
const context=(moving=false,stationarySeconds=0)=>({moving,stationarySeconds});
const stance=(r:GrowthRanks,c=context(),b=pilot())=>{assert.equal(typeof (Contracts as any).stanceMultiplier,'function');return (Contracts as any).stanceMultiplier(b,r,c);};
const derive=(b:Config.RunConfig,r:GrowthRanks,c=context())=>(Growth.deriveGrowthConfig as any)(b,r,c);
const damage=(b:Config.RunConfig,r:GrowthRanks,c=context())=>(Growth.abilityDamage as any)(b,r,c);
const record=(s:Session,intent:boolean,distance:number,r?:GrowthRanks)=>{assert.equal(typeof (s as any).recordMovement,'function');(s as any).recordMovement(intent,distance,r);};
const movement=(s:Session)=>{assert.equal(typeof (s as any).movementContext,'function');return (s as any).movementContext();};
const forced=(g:any,id:string,source='experience',commit?:()=>number|false)=>{
 if(source==='elite')g.queueElite('elite-'+g.snapshot().confirmedPicks,100+g.snapshot().confirmedPicks);else g.pending++;
 g.offer={id:++g.sequence,choices:[id,'L1_RATE','L1_HEART'],source,...(source==='elite'?{encounterId:g.eliteQueue[0].encounterId,birthId:g.eliteQueue[0].birthId}:{})};
 return g.confirm(g.runId,g.offer.id,id,commit);
};
const ready=(random=()=>0,b=pilot(),r:GrowthRanks={...zero,L1_SPLIT:1,L1_RATE:2,L1_ORBIT_BELL:1})=>{
 const g:any=new Growth.RunGrowth(9,random,b);g.ranks={...r};for(let i=0;i<4;i++)assert(forced(g,'L1_HEART'));return g;
};

test('movement scope adds R06 R07 independently and complete controlled50 preserves old identities',()=>{
 const b=pilot(),n=normal(),s={...n,sustainRewards:{enabled:true}} as any,c={...s,rewardContracts:{enabled:true}};
 assert.equal(Growth.growthCards(b).length,50);assert.equal(Growth.growthCards(n).length,44);assert.equal(Growth.growthCards(s).length,46);assert.equal(Growth.growthCards(c).length,48);
 assert.equal(new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion,'courtyard-growth-movement-v17-controlled50-v1');
 assert.equal(new Growth.RunGrowth(1,()=>0,n).snapshot().rulesVersion,'courtyard-growth-defense-v14');
 assert.equal(new Growth.RunGrowth(1,()=>0,s).snapshot().rulesVersion,'courtyard-growth-sustain-v15-controlled46-v1');
 assert.equal(new Growth.RunGrowth(1,()=>0,c).snapshot().rulesVersion,'courtyard-growth-contracts-v16-controlled48-v1');
 for(const id of ['R06','R07']){const card=Growth.growthCard(id);assert(card);assert.equal(card.kind,'tradeoff');assert.equal(card.limit,1);assert(!Growth.growthCards(c).includes(card));}
 for(const flag of ['sustainRewards','rewardContracts','areaAbilities','defenseCompanions','projectileTraits','projectileFlight','huntTargeting']){
  const partial={...b,[flag]:undefined};assert.doesNotMatch(new Growth.RunGrowth(1,()=>0,partial).snapshot().rulesVersion,/controlled50|controlled48|controlled46/);
 }
 const only={...n,movementContracts:{enabled:true}} as any;assert.equal(Growth.growthCards(only).length,46);assert(!Growth.growthCards(only).some(c=>c.id==='R04'||c.id==='R05'));
});
test('movement contracts are rejected outside playtest and remain disabled in historical normal44',()=>{
 const check=(Config as any).assertMovementContractsProfile;assert.equal(typeof check,'function');
 for(const p of ['release','review'])assert.throws(()=>check(pilot(),p),/playtest/);
 assert.doesNotThrow(()=>check(pilot(),'playtest'));assert.equal((normal() as any).movementContracts,undefined);
});
test('R06 movement 1.25 versus stop .8 and R07 moving .8 neutral .999 versus charged 1.4',()=>{
 near(stance({...zero,R06:1} as any,context(true)),1.25);near(stance({...zero,R06:1} as any,context()),.8);
 near(stance({...zero,R07:1} as any,context(true,20)),.8);near(stance({...zero,R07:1} as any,context(false,.999)),1);near(stance({...zero,R07:1} as any,context(false,1)),1.4);
 near(stance({...zero,R07:1} as any,context(false,20)),1.4);near(stance({...zero,R06:1} as any,context(true),normal()),1);
 assert.deepEqual(Contracts.contractMultipliers(pilot(),{...zero,R04:1,R06:1} as any),{weapon:.8,skill:1.35});
});
test('R06 R07 need four confirmed picks and actual attack but no independent source on all weapons',()=>{
 for(const [cat,w] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']])for(const id of ['R06','R07']){
  const b=pilot(cat,w),eligible=(r=zero,picks=4,base=b)=>(Growth.growthCardEligible as any)(id,r,base,picks);
  assert(eligible());assert(!eligible(zero,3));assert(!eligible(zero,4,{...b,weapon:{...b.weapon,damage:0}}));assert(!eligible(zero,4,normal()));
  assert(!eligible({...zero,[id]:1}));assert(!eligible({...zero,[id==='R06'?'R07':'R06']:1}));
  for(const source of ['R04','R05'])assert(eligible({...zero,[source]:1}));
 }
 for(const id of ['R04','R05'])assert(!(Growth.growthCardEligible as any)(id,{...zero,R06:1},pilot(),4));
});
test('R04 R06 cross multiplication is once per weapon and skill: P12 to12, S12 to20.25',()=>{
 const b=pilot(),r={...zero,R04:1,R06:1} as any,c=context(true);
 near(derive(b,r,c).weapon.damage,12);near(damage(b,r,c),20.25);near((Growth.nativeSpiritDamage as any)(b,r,c),10.125);
 near((Growth.pulseStats as any)(b,r,c).damage,14.175);near((Growth.anchorStats as any)(b,r,c).damage,8.1);
 near((Growth.sentinelStats as any)(b,r,true,c).damage,9.72);
 const r2={...zero,R05:1,R07:1} as any;near(derive(b,r2,context(false,1)).weapon.damage,22.68);near(damage(b,r2,context(false,1)),13.44);
});
test('Session records native displacement with intent: low amplitude is moving; wall and camera are stationary',()=>{
 const s=new Session(pilot());s.applyGrowth({...zero,R06:1} as any);
 record(s,true,.000100001);assert.equal(movement(s).moving,true);near(s.effectiveConfig.weapon.damage,15);
 s.advance(.1);record(s,true,.0001);assert.equal(movement(s).moving,false);near(s.effectiveConfig.weapon.damage,9.6);
 s.advance(.2);record(s,true,0);near(movement(s).stationarySeconds,.2);
 record(s,false,99);assert.equal(movement(s).moving,false);near(movement(s).stationarySeconds,.2);
 for(const d of [NaN,Infinity,-1]){record(s,true,d);assert.equal(movement(s).moving,false);}
});
test('R07 acquisition resets old standing, same reward does not reset, real movement starts a new stand',()=>{
 const s=new Session(pilot()),r={...zero,R07:1} as any;s.advance(12);record(s,false,0);
 s.applyGrowth(r);near(movement(s).stationarySeconds,0);near(s.effectiveConfig.weapon.damage,12);
 s.advance(.999);record(s,false,0);near(s.effectiveConfig.weapon.damage,12);
 s.applyGrowth({...r,L1_HEART:1});s.advance(.001);record(s,false,0);near(movement(s).stationarySeconds,1);near(s.effectiveConfig.weapon.damage,16.8);
 record(s,true,.01);near(s.effectiveConfig.weapon.damage,9.6);s.advance(.1);record(s,false,0);near(movement(s).stationarySeconds,0);
 s.advance(1);record(s,false,0);near(s.effectiveConfig.weapon.damage,16.8);
});
test('R07 reaches one effective second across native-sized frames despite floating point cancellation',()=>{
 const s=new Session(pilot());
 for(let i=0;i<101;i++)s.advance(.05);
 record(s,false,0);s.applyGrowth({...zero,R07:1} as any);
 for(let i=0;i<19;i++){s.advance(.05);record(s,false,0);}
 near(s.effectiveConfig.weapon.damage,12);
 s.advance(.049);record(s,false,0);near(movement(s).stationarySeconds,.999);near(s.effectiveConfig.weapon.damage,12);
 s.advance(.001);record(s,false,0);near(movement(s).stationarySeconds,1);near(s.effectiveConfig.weapon.damage,16.8);near((s.snapshot() as any).contracts.stance,1.4);
 const exact=new Session(pilot());for(let i=0;i<101;i++)exact.advance(.05);exact.applyGrowth({...zero,R07:1} as any);
 for(let i=0;i<20;i++){exact.advance(.05);record(exact,false,0);}
 near(exact.effectiveConfig.weapon.damage,16.8);near((exact.snapshot() as any).contracts.stance,1.4);
 const owned={...new Growth.RunGrowth(1,()=>0,pilot()).snapshot(),ranks:{...zero,R07:1},contracts:(exact.snapshot() as any).contracts} as any;
 assert.match(growthDetail('R07',owned,pilot(),{courtyard:true,source:'owned'}).body,/蓄势已满/);
});
test('pause upgrade background freeze stance age and repeated movement updates do not change HP reload or cadence',()=>{
 const b=pilot(),s=new Session(b);s.applyGrowth({...zero,R07:1,C13:1,M10:1} as any);s.damage(28);record(s,false,0);
 s.step(0,{x:1,y:0});const hp=s.hp,ammo=s.ammo,reload=s.reloadLeft,shots=s.shots;
 for(const reason of ['menu','upgrade','background'] as const){s.pause(reason);s.advance(20);record(s,true,1);assert.equal(movement(s).moving,false);near(movement(s).stationarySeconds,0);if(reason==='upgrade')s.finishUpgrade();else s.resume();}
 for(let i=0;i<20;i++)record(s,i%2===0,.5);assert.equal(s.hp,hp);assert.equal(s.ammo,ammo);assert.equal(s.reloadLeft,reload);assert.equal(s.shots,shots);
 const fresh=new Session(b);near(movement(fresh).stationarySeconds,0);assert.equal(movement(fresh).moving,false);
 const snap=(s.snapshot() as any).contracts;assert(snap);assert.equal(snap.moving,movement(s).moving);near(snap.stance,1);assert.equal(snap.stationarySince,s.elapsed);
});
test('root and derived secondary damage freeze at emission and rhythm does not multiply a later stance twice',()=>{
 const b=pilot(),r={...zero,R06:1,C23:1,L1_ECHO:1} as any,old=derive(b,r,context(true)),fresh=derive(b,r,context());
 near(old.weapon.damage,15);near(fresh.weapon.damage,9.6);near(old.weapon.damage,15);
 const bursts=new Growth.WeaponBursts();let pending:any;for(let i=1;i<=4;i++)pending=bursts.onRhythmVolley(old,r,{id:i});near(pending.segments[0].damage,9);
 const tail=bursts.onVolley(old,r,{id:5,ammo:0,reloads:0,opening:false});near(tail[0].damage,3.75);
 for(let i=5;i<=8;i++)bursts.onRhythmVolley(fresh,r,{id:i});near(pending.segments[0].damage,9);assert(Object.isFrozen(pending.segments[0]));
});
test('all four legal R share the same second-slot 20 percent branch and keep advance plus attribute',()=>{
 for(const source of ['experience','elite'])for(const [side,id] of [[0,'R04'],[.25,'R05'],[.5,'R06'],[.99999,'R07']] as const){
  const values=[.199999,side,0,0,0],g=ready(()=>values.shift()??0);g.recentDeclined=[['R06'],['R07']];
  if(source==='elite'){g.queueElite('real-elite',901);g.openOffer();}else g.collect(8);
  const ids=g.snapshot().offer.choices;assert(ids.includes(id));assert.equal(ids.filter((id:string)=>id.startsWith('R0')).length,1);assert(ids.includes('L1_EVO_BARRAGE'));assert(ids.some((id:string)=>Growth.growthCard(id)?.kind==='attribute'));
  assert.equal(Growth.growthExplorationWeight(id as any,g.ranks,g.recentDeclined),1);
 }
 const values=[.2,0,0,0,0],g=ready(()=>values.shift()??0);g.collect(8);assert(!g.snapshot().offer.choices.some((id:string)=>id.startsWith('R0')));
});
test('no legal movement R and disabled scope do not consume an extra random value',()=>{
 for(const reason of ['too-early','owned-pair','invalid-weapon','scope-off']){
  let a=0,b=0;const rng=(n:number)=>((n*71+19)%997)/997,oldBase={...pilot(),movementContracts:undefined} as any;
  const nextBase=reason==='scope-off'?oldBase:pilot();if(reason==='invalid-weapon'){oldBase.weapon={...oldBase.weapon,damage:0};(nextBase as any).weapon=oldBase.weapon;}
  const old:any=new Growth.RunGrowth(1,()=>rng(++a),oldBase),next:any=new Growth.RunGrowth(1,()=>rng(++b),nextBase);
  old.confirmedPicks=next.confirmedPicks=reason==='too-early'?3:4;old.ranks={...zero,R04:1,...(reason==='owned-pair'?{R06:1}:{})};next.ranks={...old.ranks};
  for(let i=0;i<10;i++){old.pending++;next.pending++;old.openOffer();next.openOffer();assert.deepEqual(next.snapshot().offer.choices,old.snapshot().offer.choices);old.clearPending();next.clearPending();}assert.equal(a,b);
 }
});
test('actual confirms freeze offers count only success and preserve cross-group R while excluding opposite stance',()=>{
 const g=ready(()=>0,pilot(),{...zero,R04:1}),before=g.snapshot().confirmedPicks;
 assert(!forced(g,'R06','experience',()=>false));assert.equal(g.snapshot().confirmedPicks,before);const offer=g.snapshot().offer;
 g.openOffer();g.collect(0);assert.deepEqual(g.snapshot().offer,offer);assert(g.confirm(9,offer.id,'R06'));assert.equal(g.snapshot().confirmedPicks,before+1);assert(!g.confirm(9,offer.id,'R06'));
 assert.equal(g.snapshot().ranks.R04,1);assert.equal(g.snapshot().ranks.R06,1);assert(!forced(g,'R07'));assert(!forced(g,'R06'));assert(!forced(g,'R05'));
});
test('C21 receives stance only via actual HP damage and M10 plus other non-damage values remain unchanged',()=>{
 const b=pilot(),r={...zero,R06:1,C21:1,C13:1,M10:1} as any,s=new Session({...b,weapon:{...b.weapon,ammoCapacity:1}});s.applyGrowth(r);s.damage(28);record(s,true,1);
 near(s.recordSustainHit({source:'PRIMARY',targetKind:'enemy',actualDamage:s.effectiveConfig.weapon.damage}),.3);assert(s.step(0,{x:1,y:0}));near(s.defenseSnapshot().shield,2.7);
 const current=s.effectiveConfig;assert.deepEqual(current.chill,b.chill);assert.equal(current.moveSpeed,b.moveSpeed);assert.equal(current.maxHp,b.maxHp);near(Growth.skillMultiplier(b,r),1);near(Growth.areaMultiplier(b,r),1);assert.equal(Growth.pickupMagnetRadius(b,r),40);
});
test('candidate faces show real benefits costs and mutual exclusion; R07 prediction resets age; owned shows current state',()=>{
 const b=pilot(),g=ready(()=>0).snapshot(),charged={...g,ranks:{...g.ranks,R07:1},contracts:{moving:false,stationarySeconds:9,stationarySince:0,stance:1.4,enabled:true}} as any;
 for(const id of ['R06','R07']){
  const summary=growthCardSummary(id as any,g,b);assert.match(summary.benefit,id==='R06'?/1.25/:/1.4/);assert.match(summary.cost??'',/0.8/);assert.match(summary.cost??'',/互斥/);
  const detail=growthDetail(id as any,g,b,{courtyard:true}).body;assert.match(detail,/互斥/);assert.doesNotMatch(detail,/NaN|undefined/);
 }
 const unowned={...charged,ranks:{...g.ranks}};assert.match(growthChange('R07' as any,unowned,b),/重新|重置|从0/);assert.match(growthChange('R07' as any,unowned,b),/12 → 12/);
 assert.match(growthDetail('R07' as any,charged,b,{courtyard:true,source:'owned'}).body,/1.4/);assert.match(growthBuild(charged,b,{courtyard:true}),/蓄势|静止/);
 const moving={...charged,contracts:{...charged.contracts,moving:true,stationarySeconds:0,stationarySince:null,stance:.8}};
 assert.match(growthDetail('R07' as any,moving,b,{courtyard:true,source:'owned'}).body,/移动/);assert.match(growthDetail('R07' as any,moving,b,{courtyard:true,source:'owned'}).body,/0.8/);
});
