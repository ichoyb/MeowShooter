// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig} from '../../src/combat-config';
import {courtyardBalanceRunConfig} from '../../src/level-config';
import {Session} from '../../src/rules';
import {RunGrowth,deriveGrowthConfig,WeaponBursts,BellAbilityState,GROWTH_NUMBERS as N,type GrowthRanks} from '../../src/progression';
import {abilityDamage,nativeSpiritDamage,pulseStats,anchorStats} from '../../src/area-ability-rules';
import {sentinelStats} from '../../src/sentinel-rules';
import {DEVTOOLS_DEFAULTS,readDevtoolsSettings,writeDevtoolsSettings,scaleCount,devtoolsRewards} from '../model';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const base=(cat='CAT01',weapon='W01')=>courtyardBalanceRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
function session(multiplier=1,cat='CAT01',weapon='W01'){
 const s=new Session(base(cat,weapon));s.devtools!.setSettings({...DEVTOOLS_DEFAULTS,dmg:multiplier});return s;
}
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,actual+' != '+expected);

test('inv rejects actual incoming damage without HP, shield or accepted feedback facts',()=>{
 const s=session();s.applyGrowth({...zero,C13:1});
 const hp=s.hp,defense=s.defenseSnapshot();s.devtools!.setSettings({...DEVTOOLS_DEFAULTS,inv:true});
 assert.deepEqual(s.damage(1000),{accepted:false,rawDamage:1000,afterArmor:0,shieldAbsorbed:0,hpLost:0,shieldBroke:false});
 assert.equal(s.hp,hp);assert.equal(s.result,null);assert.deepEqual(s.defenseSnapshot(),defense);
 s.devtools!.setSettings(DEVTOOLS_DEFAULTS);assert.equal(s.damage(1000).accepted,true);assert.equal(s.result,'death');
});

test('direct reward and real offer share commit, eligibility, HP growth and failed-commit atomicity',()=>{
 const b=base(),s=session(),g=new RunGrowth(1,()=>0,b),before=JSON.stringify(g.snapshot());
 assert.equal(g.devtoolsGrant!('L1_HEART',()=>false),false);assert.equal(JSON.stringify(g.snapshot()),before);
 assert.equal(g.devtoolsGrant!('L1_EVO_BARRAGE',r=>s.applyGrowthReward(r)),false);
 s.damage(10);const hp=s.hp;
 assert.equal(g.devtoolsGrant!('L1_HEART',r=>s.applyGrowthReward(r)),true);assert.equal(s.hp,hp+15);assert.equal(g.snapshot().level,1);assert.equal(g.snapshot().totalXP,0);
 assert.equal(g.devtoolsGrant!('L1_ORBIT_BELL',r=>s.applyGrowthReward(r)),true);
 assert.equal(g.devtoolsGrant!('L1_ORBIT_BELL',r=>s.applyGrowthReward(r)),true);
 assert.equal(g.devtoolsGrant!('L1_ORBIT_BELL',r=>s.applyGrowthReward(r)),true);
 assert.equal(g.devtoolsGrant!('L1_ORBIT_BELL',r=>s.applyGrowthReward(r)),false);
 assert.equal(g.devtoolsGrant!('R04',r=>s.applyGrowthReward(r)),true);assert.equal(g.devtoolsGrant!('R05',r=>s.applyGrowthReward(r)),false);
 g.collect(g.snapshot().nextXP-g.snapshot().xp);
 const offer=g.snapshot().offer!;assert.ok(offer);assert.equal(g.devtoolsGrant!('L1_DAMAGE',r=>s.applyGrowthReward(r)),false);
 const picks=g.snapshot().confirmedPicks;
 assert.equal(g.confirm(1,offer.id,offer.choices[0],r=>s.applyGrowthReward(r)),true);
 assert.equal(g.snapshot().confirmedPicks,picks+1);assert.equal(g.confirm(1,offer.id,offer.choices[0]),false);
 assert.deepEqual(s.effectiveConfig.weapon,deriveGrowthConfig(b,g.snapshot().ranks,s.movementContext()).weapon);
});

test('all 50 reward rows project the real eligibility, prerequisites, caps and mutual exclusion',()=>{
 const b=base(),s=session(),g=new RunGrowth(1,()=>0,b);
 const rows=()=>devtoolsRewards(b,g.snapshot(),null);
 assert.equal(rows().length,50);assert.match(rows().find(c=>c.id==='R04')!.reason!,/4 次/);
 assert.match(rows().find(c=>c.id==='E14')!.reason!,/定点哨卫.*能量护盾/);
 assert.equal(g.devtoolsGrant!('C12',r=>s.applyGrowthReward(r)),true);
 assert.equal(g.devtoolsGrant!('C13',r=>s.applyGrowthReward(r)),true);
 assert.equal(rows().find(c=>c.id==='E14')!.reason,null);
 assert.equal(g.devtoolsGrant!('E14',r=>s.applyGrowthReward(r)),true);
 assert.match(rows().find(c=>c.id==='E14')!.reason!,/上限/);
 assert.equal(g.devtoolsGrant!('L1_DAMAGE',r=>s.applyGrowthReward(r)),true);
 assert.equal(g.devtoolsGrant!('R06',r=>s.applyGrowthReward(r)),true);
 assert.match(rows().find(c=>c.id==='R07')!.reason!,/互斥/);
});

for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']] as const)for(const contract of [undefined,'R04','R05'] as const)test(cat+' dmg multiplies each primary/secondary/area/shock/spirit/sentry source exactly once with '+(contract??'no contract'),()=>{
 const ranks:GrowthRanks={...zero,L1_DAMAGE:2,L1_ECHO:1,L1_EVO_CADENCE:1,L1_SPLIT:1,C23:1,C15:1,C16:1,C12:1,A07:2,...(contract?{[contract]:1}:{})};
 const a=session(1,cat,weapon),b=session(3,cat,weapon);a.applyGrowth(ranks);b.applyGrowth(ranks);
 near(b.effectiveConfig.weapon.damage,a.effectiveConfig.weapon.damage*3);
 const facts={id:1,ammo:0,reloads:1,opening:true};
 const shotsA=new WeaponBursts().onVolley(a.effectiveConfig,ranks,facts),shotsB=new WeaponBursts().onVolley(b.effectiveConfig,ranks,facts);
 assert.ok(shotsA.some(s=>s.effect==='OPENING_BURST'));assert.ok(shotsA.some(s=>s.effect==='TAIL_ECHO'));
 shotsA.forEach((shot,i)=>near(shotsB[i].damage,shot.damage*3));
 const rhythmA=new WeaponBursts(),rhythmB=new WeaponBursts();
 for(let id=1;id<=4;id++){
  const x=rhythmA.onRhythmVolley(a.effectiveConfig,ranks,{id}),y=rhythmB.onRhythmVolley(b.effectiveConfig,ranks,{id});
  if(x)x.segments.forEach((part,i)=>near(y!.segments[i].damage,part.damage*3));
 }
 const sources=(s:Session)=>[
  abilityDamage(s.runConfig,ranks,s.movementContext()),
  abilityDamage(s.runConfig,ranks,s.movementContext())*N.trailDamage,
  abilityDamage(s.runConfig,ranks,s.movementContext())*N.orbitDamages[0],
  abilityDamage(s.runConfig,ranks,s.movementContext())*N.chimeDamage,
  pulseStats(s.runConfig,ranks,s.movementContext()).damage,
  anchorStats(s.runConfig,ranks,s.movementContext()).damage,
  nativeSpiritDamage(s.runConfig,ranks,s.movementContext()),
  sentinelStats(s.runConfig,ranks,false,s.movementContext()).damage,
  s.effectiveConfig.weapon.damage*N.shockDamage,
 ];
 sources(a).forEach((damage,i)=>near(sources(b)[i],damage*3));
 const frozen=JSON.stringify(b.runConfig),oldShots=shotsB.map(s=>s.damage),oldAnchor=sources(b)[5];
 b.devtools!.setSettings({...DEVTOOLS_DEFAULTS,dmg:2});
 near(b.effectiveConfig.weapon.damage,a.effectiveConfig.weapon.damage*2);assert.equal(JSON.stringify(b.runConfig),frozen);assert.ok(Object.isFrozen(b.runConfig));
 assert.deepEqual(shotsB.map(s=>s.damage),oldShots);near(oldAnchor,sources(a)[5]*3);
});

test('native reload secondary, moving contract and stationary recomputation retain exactly one dmg multiplier',()=>{
 const a=session(),b=session(2),ranks={...zero,R06:1};
 a.applyGrowth(ranks);b.applyGrowth(ranks);a.recordMovement(true,20);b.recordMovement(true,20);
 near(b.effectiveConfig.weapon.damage,a.effectiveConfig.weapon.damage*2);
 a.recordMovement(false,0);b.recordMovement(false,0);near(b.effectiveConfig.weapon.damage,a.effectiveConfig.weapon.damage*2);
 const facts={id:1,ammo:1,reloads:0,opening:true};
 const x=new WeaponBursts().onVolley(a.effectiveConfig,zero,facts),y=new WeaponBursts().onVolley(b.effectiveConfig,zero,facts);
 assert.equal(x[0].effect,'BASE_SECONDARY');near(y[0].damage,x[0].damage*2);
});

test('scaled fractional pickups reach real XP thresholds and pickup-chime charge without losing fractions',()=>{
 const g=new RunGrowth(1,()=>0,base()),bell=new BellAbilityState();let carry=0;
 for(let i=0;i<8;i++){
  const scaled=scaleCount(2,.5,carry);carry=scaled.carry;g.collect(scaled.count);bell.collect(scaled.count,true);
 }
 assert.equal(g.snapshot().level,2);assert.equal(g.snapshot().totalXP,8);assert.equal(g.snapshot().offer!.source,'experience');assert.equal(bell.snapshot().charge,8);
 const before=g.snapshot();g.collect(before.nextXP-before.xp);assert.equal(g.snapshot().level,3);assert.equal(g.snapshot().pending,2);
 let spawnCarry=0;const requests=[];
 for(let i=0;i<6;i++){const result=scaleCount(1,.5,spawnCarry);spawnCarry=result.carry;requests.push(result.count);}
 assert.deepEqual(requests,[0,1,0,1,0,1]);assert.equal(scaleCount(1,3,0).count,3);assert.equal(scaleCount(1,0,0).count,0);
});

test('URL settings preserve cat and the existing XP curve while rejecting invalid values at the boundary',()=>{
 const original=new URL('http://127.0.0.1:55000/?cat=CAT03&xp=36&other=keep');
 const next=writeDevtoolsSettings(original,{inv:true,dmg:3,hp:2,spawn:.5,xpm:4});
 assert.equal(next.searchParams.get('cat'),'CAT03');assert.equal(next.searchParams.get('xp'),'36');assert.equal(next.searchParams.get('other'),'keep');
 assert.deepEqual(readDevtoolsSettings(next.searchParams),{settings:{inv:true,dmg:3,hp:2,spawn:.5,xpm:4},errors:[]});
 assert.equal(original.searchParams.has('xpm'),false);
 for(const query of ['hp=0','spawn=11','dmg=-1','xpm=Infinity','inv=true','dmg='])assert.equal(readDevtoolsSettings(new URLSearchParams(query)).settings,null,query);
 assert.deepEqual(readDevtoolsSettings(new URLSearchParams()).settings,DEVTOOLS_DEFAULTS);
});
