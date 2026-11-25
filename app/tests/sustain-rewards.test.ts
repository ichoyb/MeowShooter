import {historicalNormal44Config} from './helpers/historical-growth';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Rules from '../src/rules';
import * as Config from '../src/combat-config';
import * as Growth from '../src/progression';
import {courtyardRunConfig} from '../src/level-config';
import {growthBuild,growthChange,growthCardSummary,growthDetail} from '../src/ui/progression';
import type {GrowthRanks} from '../src/progression';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const aim={x:1,y:0};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const normal=(cat='CAT01',weapon='W01')=>historicalNormal44Config(cat,weapon);
const pilot=(cat='CAT01',weapon='W01'):Config.RunConfig=>({...normal(cat,weapon),growthPool:undefined,sustainRewards:{enabled:true}} as any);
const session=(ranks:GrowthRanks={...zero,C21:1} as any,base=pilot())=>{const s=new Rules.Session(base);s.applyGrowth(ranks);return s;};
const state=(s:Rules.Session)=>{const value=(s.snapshot() as any).sustain;assert(value,'Session must expose actual sustain facts');return value;};
const hit=(s:Rules.Session,actualDamage=5,source='PRIMARY',targetKind='enemy',extra={})=>{
 assert.equal(typeof (s as any).recordSustainHit,'function','actual hit facts need the sustain entry');
 return (s as any).recordSustainHit({source,targetKind,actualDamage,...extra});
};
const move=(s:Rules.Session,to:number)=>s.advance(to-s.elapsed);
const drain=(s:Rules.Session)=>{while(s.ammo>0)assert(s.step(s.snapshot().cooldown,aim));assert(s.reloadLeft>0);};
const oneRound=(reloadSeconds=.1):Config.RunConfig=>{const b=pilot();return {...b,weapon:{...b.weapon,ammoCapacity:1,intervalSeconds:.01,reloadSeconds}};};
const shieldRanks={...zero,C13:1,M10:1} as any;

test('sustain pure formulas use actual HP loss, exact cap and exact two-second boundary',()=>{
 const r=Rules as any;
 for(const name of ['lifeCircuitRecovery','reloadShieldRecovery','reloadShieldReady'])assert.equal(typeof r[name],'function',name);
 assert.equal(r.lifeCircuitRecovery(100,80,90,0),1.8);
 assert.equal(r.lifeCircuitRecovery(5,80,90,0),.1);
 assert.equal(r.lifeCircuitRecovery(100,90,90,0),0);
 assert.equal(r.lifeCircuitRecovery(100,80,90,1.8),0);
 assert.equal(r.reloadShieldRecovery(0,18),2.7);
 assert.equal(r.reloadShieldRecovery(18,18),0);
 assert.equal(r.reloadShieldReady(1.999,0),false);assert.equal(r.reloadShieldReady(2,0),true);
});

test('controlled46 is explicit, normal44 and legacy v13 retain their exact catalogs and versions',()=>{
 for(const [cat,w] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=pilot(cat,w),n=normal(cat,w);
  assert.equal(Growth.growthCards(b).length,46);assert.equal(Growth.growthCards(n).length,44);
  assert.equal(new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion,'courtyard-growth-sustain-v15-controlled46-v1');
  assert.equal(new Growth.RunGrowth(1,()=>0,n).snapshot().rulesVersion,'courtyard-growth-defense-v14');
  assert.equal(new Growth.RunGrowth(1,()=>0,{...n,growthPool:undefined}).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-defense-v3');
  for(const id of ['C21','M10']){
   assert.equal(Growth.growthCard(id)?.icon,'GUARD.svg');assert.equal(Growth.growthCard(id)?.limit,1);
   assert(!Growth.growthCardEligible(id as any,{...zero,C13:1},n));
  }
  for(const id of ['R04','R05','R06','R07'])assert(!Growth.growthCards(b).some(c=>c.id===id));
 }
 const b={...courtyardRunConfig(Config.makeRunConfig('CAT01','W01','p2-basic')),sustainRewards:{enabled:true}} as any;
 assert.doesNotMatch(new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion,/controlled46/);
 assert.match(new Growth.RunGrowth(1,()=>0,b).snapshot().rulesVersion,/-sustain-v1$/);
});

test('sustain profile is playtest-only and historical normal44 never enables it',()=>{
 assert.equal((normal() as any).sustainRewards,undefined);
 const validate=(Config as any).assertSustainRewardsProfile;assert.equal(typeof validate,'function');
 for(const p of ['release','review'])assert.throws(()=>validate(pilot(),p),/playtest/);
 assert.doesNotThrow(()=>validate(pilot(),'playtest'));
});

test('C21 requires a real projectile and gives neither area nor old attack-attachment qualification',()=>{
 const b=pilot();assert(Growth.growthCardEligible('C21' as any,zero,b));
 assert(!Growth.growthCardEligible('C21' as any,{...zero,C21:1} as any,b));
 assert(!Growth.growthCardEligible('C21' as any,zero,{...b,weapon:{...b.weapon,pellets:0}}));
 for(const id of ['A07','A08','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'])assert(!Growth.growthCardEligible(id as any,{...zero,C21:1} as any,b),id);
});

test('M10 requires purchased C13 and real positive magazine/reload capability',()=>{
 const b=pilot();assert(!Growth.growthCardEligible('M10' as any,zero,b));
 assert(Growth.growthCardEligible('M10' as any,{...zero,C13:1},b));
 assert(!Growth.growthCardEligible('M10' as any,shieldRanks,b));
 for(const weapon of [{...b.weapon,ammoCapacity:0},{...b.weapon,reloadSeconds:0},{...b.weapon,ammoCapacity:1.5}])assert(!Growth.growthCardEligible('M10' as any,{...zero,C13:1},{...b,weapon}));
 assert(!Growth.growthCardEligible('M10' as any,{...zero,C13:1},{...b,defenseCompanions:undefined}));
});

test('C21 counts each real primary damage fact regardless of first-hit credit and never heals shield',()=>{
 const s=session({...zero,C21:1,C13:1} as any);s.damage(28);assert.equal(s.hp,80);
 near(hit(s,5,'PRIMARY','enemy',{firstEnemyHit:true}),.1);
 near(hit(s,5,'PRIMARY','enemy',{firstEnemyHit:false}),.1);
 near(hit(s,5,'PRIMARY','enemy',{firstEnemyHit:false,flightPhase:'return'}),.1);
 near(s.hp,80.3);near(state(s).hpRecoveredTotal,.3);near(state(s).lifeUsedThisSecond,.3);
 assert.equal(s.defenseSnapshot().shield,0);assert.equal(s.defenseSnapshot().lastEnemyAt,0);
});

test('C21 excludes objects, secondary/pickup, spirit/sentry and all area sources without side effects',()=>{
 const s=session();s.damage(20);const before=s.snapshot();
 for(const [source,targetKind,effect] of [['PRIMARY','object',null],['SECONDARY','enemy',null],['SECONDARY','enemy','CHIME'],['SUMMON','enemy',null],['SUMMON','enemy','SENTRY'],['AREA','enemy','TRAIL'],['AREA','enemy','ORBIT'],['AREA','enemy','PULSE'],['AREA','enemy','ANCHOR'],['AREA','enemy','SHOCK']])assert.equal(hit(s,100,source!,targetKind!,{effect}),0);
 for(const d of [0,-1,NaN,Infinity,-Infinity])assert.equal(hit(s,d),0);
 assert.deepEqual(s.snapshot(),before);
});

test('C21 uses actual damage rather than nominal overkill and only actual recovery consumes budget',()=>{
 const s=session();s.damage(1);near(hit(s,5,'PRIMARY','enemy',{damage:100}),.1);
 near(s.hp,89.1);near(state(s).lifeUsedThisSecond,.1);
 near(hit(s,1000),.9);near(state(s).lifeUsedThisSecond,1);assert.equal(s.hp,90);
 assert.equal(hit(s,1000),0);near(state(s).lifeUsedThisSecond,1);
 s.damage(10);near(hit(s,1000),.8);near(state(s).hpRecoveredTotal,1.8);
 assert.equal(hit(s,1000),0);
});

test('C21 floor(elapsed) windows reset once with no carry and no growth reset',()=>{
 const s=session();s.damage(30);near(hit(s,1000),1.8);
 move(s,.999);assert.equal(hit(s,1000),0);
 s.applyGrowth({...zero,C21:1,L1_DAMAGE:1} as any);assert.equal(hit(s,1000),0);
 move(s,1);near(hit(s,1000),1.8);assert.equal(state(s).lifeWindowSecond,1);
 move(s,9.2);near(hit(s,1000),1.8);assert.equal(state(s).lifeWindowSecond,9);
 near(state(s).hpRecoveredTotal,5.4);near(state(s).lifeRemainingThisSecond,0);
});

test('C21 HP growth raises current cap but retains actual same-second spending',()=>{
 const s=session();s.damage(30);near(hit(s,1000),1.8);
 s.applyGrowth({...zero,C21:1,L1_HEART:1} as any);
 assert.equal(s.effectiveConfig.maxHp,105);near(state(s).lifeUsedThisSecond,1.8);
 near(state(s).lifeLimitPerSecond,2.1);near(hit(s,1000),.3);assert.equal(hit(s,1000),0);
});

test('elite growth/HP recovery is a separate atomic transaction and cannot reset C21 window',()=>{
 const b=pilot(),s=session({...zero,C21:1,C13:1} as any,b),g:any=new Growth.RunGrowth(7,()=>0,b);
 s.damage(48);near(hit(s,1000),1.8);g.ranks={...zero,C21:1,C13:1};g.queueElite('elite-1',17);g.openOffer();
 const offer=g.snapshot().offer;const before=s.hp;
 assert(g.confirm(7,offer.id,offer.choices[0],(r:GrowthRanks)=>s.applyGrowthReward(r,.2)));
 const reward=g.snapshot().eliteRewards[0];assert(reward.recovered>=0);assert(s.hp>=before);
 near(state(s).lifeUsedThisSecond,1.8);near(state(s).hpRecoveredTotal,1.8);assert.equal(s.defenseSnapshot().shield,0);
 if(!s.effectiveConfig.maxHp||s.effectiveConfig.maxHp===90)assert.equal(hit(s,1000),0);
 assert(!g.confirm(7,offer.id,offer.choices[0]));
});

test('C21 acquisition never credits old damage or changes opening HP',()=>{
 const s=session(zero);s.damage(20);assert.equal(hit(s,1000),0);s.applyGrowth({...zero,C21:1} as any);
 assert.equal(s.hp,70);assert.equal(state(s).hpRecoveredTotal,0);near(hit(s,5),.1);
 const off=new Rules.Session(normal());off.damage(20);off.applyGrowth({...zero,C21:1} as any);assert.equal(hit(off,100),0);assert.equal(off.hp,70);
});

test('M10 only starts on the last consumed round and restores shield alone',()=>{
 const s=session(shieldRanks);s.damage(28);const hp=s.hp;
 assert.equal(state(s).reloadStarts,0);assert.equal(state(s).shieldRecoveredTotal,0);
 while(s.ammo>1){assert(s.step(s.snapshot().cooldown,aim));assert.equal(s.defenseSnapshot().shield,0);}
 assert(s.step(s.snapshot().cooldown,aim));assert(s.reloadLeft>0);
 near(s.defenseSnapshot().shield,2.7);assert.equal(s.hp,hp);
 assert.equal(state(s).reloadStarts,1);near(state(s).shieldRecoveredTotal,2.7);near(state(s).reloadShieldLastAt,s.elapsed);
 assert.equal(s.defenseSnapshot().lastEnemyAt,0);
 s.advance(s.reloadLeft);assert.equal(s.reloadCompletions,1);near(state(s).shieldRecoveredTotal,2.7);
});

test('M10 gates actual positive recovery at exactly 2s without epsilon or delayed opportunities',()=>{
 const s=session(shieldRanks,oneRound());s.damage(18);assert(s.step(0,aim));near(s.defenseSnapshot().shield,2.7);
 s.damage(2.7);s.advance(.1);move(s,1.999);assert(s.step(0,aim));assert.equal(s.defenseSnapshot().shield,0);
 assert.equal(state(s).reloadStarts,2);assert.equal(state(s).reloadShieldLastAt,0);
 // A denied start is spent. Reaching 2.000 during that reload cannot pay it.
 move(s,2);assert.equal(s.step(0,aim),null);assert.equal(s.defenseSnapshot().shield,0);
 move(s,2.099);assert(s.step(0,aim));near(s.defenseSnapshot().shield,2.7);
 near(state(s).shieldRecoveredTotal,5.4);near(state(s).reloadShieldLastAt,2.099);
 const exact=session(shieldRanks,oneRound());exact.damage(18);assert(exact.step(0,aim));exact.damage(2.7);exact.advance(.1);move(exact,2);assert(exact.step(0,aim));near(exact.defenseSnapshot().shield,2.7);
});

test('M10 full shield never spends cooldown and missing shield only restores its actual deficit',()=>{
 const s=session(shieldRanks,oneRound());assert(s.step(0,aim));assert.equal(state(s).reloadShieldLastAt,null);assert.equal(state(s).shieldRecoveredTotal,0);
 s.damage(1);s.advance(.1);assert(s.step(0,aim));near(s.defenseSnapshot().shield,18);near(state(s).shieldRecoveredTotal,1);near(state(s).reloadShieldLastAt,.1);
});

test('M10 selection during reload, growth and capacity changes cannot fabricate a start',()=>{
 const s=session({...zero,C13:1},oneRound());s.damage(18);assert(s.step(0,aim));const before=state(s).reloadStarts;
 s.applyGrowth(shieldRanks);assert.equal(s.defenseSnapshot().shield,0);assert.equal(state(s).reloadStarts,before);
 s.applyGrowth({...shieldRanks,L1_HEART:1,L1_RELOAD:1,L1_ECHO:1,L1_LIGHT_MAG:1});assert.equal(s.defenseSnapshot().shield,0);assert.equal(state(s).reloadStarts,before);
 s.pause('menu');s.advance(5);s.resume();assert.equal(state(s).reloadStarts,before);assert.equal(s.defenseSnapshot().shield,0);
 s.advance(s.reloadLeft);assert.equal(s.defenseSnapshot().shield,0);assert.equal(state(s).reloadStarts,before);
 assert(s.step(0,aim));assert.equal(state(s).reloadStarts,before+1);near(s.defenseSnapshot().shield,3.15);
});

test('M10 cannot manufacture shields without actual C13 or without the controlled flag',()=>{
 for(const [b,r] of [[pilot(),{...zero,M10:1}],[{...pilot(),defenseCompanions:undefined},shieldRanks],[normal(),shieldRanks]] as const){
  const s=session(r as any,b);drain(s);assert.equal(state(s).shieldRecoveredTotal,0);
 }
});

test('M10 preserves C13 six-second wait even when its real start restores shield',()=>{
 const s=session(shieldRanks,oneRound());s.damage(18);assert(s.step(0,aim));near(s.defenseSnapshot().shield,2.7);
 const from=s.elapsed;s.advance(5);assert.equal(s.settleShieldRecovery(from),0);near(s.defenseSnapshot().rechargeWait,1);
 const before=s.elapsed;s.advance(1.5);near(s.settleShieldRecovery(before),.9);near(s.defenseSnapshot().shield,3.6);
});

for(const reason of ['menu','upgrade','background','inputLost'] as const)test(reason+' freezes sustain windows, real reloads and actual recovery',()=>{
 const s=session({...shieldRanks,C21:1},oneRound());s.damage(28);near(hit(s,5),.1);assert(s.step(0,aim));s.pause(reason);
 const before=s.snapshot();s.advance(100);assert.equal(s.step(100,aim),null);assert.equal(hit(s,100),0);assert.deepEqual(s.snapshot(),before);
 s.resume();s.finishUpgrade();s.advance(.1);assert.equal(state(s).lifeWindowSecond,0);near(state(s).lifeUsedThisSecond,.1);
});

for(const ending of ['damage','step-death','timeout','cleared'] as const)test(ending+' prevents late healing/starting reloads and new Session clears sustain state',()=>{
 const s=session({...shieldRanks,C21:1},oneRound());s.damage(28);near(hit(s,5),.1);assert(s.step(0,aim));
 if(ending==='damage')s.damage(10000);else if(ending==='step-death'){s.hp=0;s.step(0,aim);}else if(ending==='timeout')s.step(600-s.elapsed,aim);else s.completeBoss();
 const before=s.snapshot();assert.equal(hit(s,1000),0);s.applyGrowth({...shieldRanks,C21:1,L1_HEART:4});s.advance(50);assert.equal(s.step(0,aim),null);assert.deepEqual(s.snapshot(),before);
 const restarted=new Rules.Session(s.runConfig);const rs=state(restarted);assert.equal(rs.hpRecoveredTotal,0);assert.equal(rs.shieldRecoveredTotal,0);assert.equal(rs.lifeUsedThisSecond,0);assert.equal(rs.reloadShieldLastAt,null);assert.equal(rs.reloadStarts,0);assert.equal(rs.lifeCircuitOwned,false);assert.equal(rs.reloadShieldOwned,false);
});

test('same-frame lethal incoming damage wins over an old primary hit and the would-be last round',()=>{
 const s=session({...shieldRanks,C21:1},oneRound());s.damage(10000);assert.equal(s.result,'death');assert.equal(hit(s,10000),0);assert.equal(s.step(0,aim),null);assert.equal(state(s).reloadStarts,0);assert.equal(state(s).hpRecoveredTotal,0);assert.equal(state(s).shieldRecoveredTotal,0);
});

test('C21 and M10 real candidate transactions confirm once and owned UI reads actual current values',()=>{
 const b=pilot(),g:any=new Growth.RunGrowth(19,()=>0,b),s=session({...shieldRanks,C21:1},b);s.damage(28);near(hit(s,5),.1);drain(s);
 g.ranks={...zero,C13:1};g.collect(8);g.offer={id:1,source:'experience',choices:['C21','M10','L1_RATE']};
 assert(!g.confirm(20,1,'C21'));assert(g.confirm(19,1,'C21'));assert(!g.confirm(19,1,'C21'));assert.equal(g.snapshot().ranks.C21,1);
 const snap={...g.snapshot(),ranks:{...shieldRanks,C21:1},defense:s.defenseSnapshot(),sustain:state(s)} as any;
 assert.match(growthChange('C21' as any,snap,b),/1\.8/);assert.match(growthChange('M10' as any,snap,b),/2\.7/);
 for(const id of ['C21','M10']){assert(Growth.growthCard(id));assert(growthCardSummary(id as any,snap,b).benefit);const detail=growthDetail(id,snap,b,{courtyard:true,source:'owned'}).body;assert.doesNotMatch(detail,/undefined|NaN/);assert.match(detail,id==='C21'?/0\.1/:/2\.7/);}
 const build=growthBuild(snap,b,{courtyard:true});assert.match(build,/生命回路/);assert.match(build,/装填护罩/);
});
