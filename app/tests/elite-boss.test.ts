import test from 'node:test';
import assert from 'node:assert/strict';
import * as content from '../src/level-config';
import * as director from '../src/level-rules';
import * as behavior from '../src/enemy-behavior';
import {makeRunConfig} from '../src/combat-config';
import {Session} from '../src/rules';
import {chooseCourtyardSpawn} from '../src/arena-layout';
const right={x:1,y:0},left={x:-1,y:0},readable={dash:true,slam:true};
const run=()=>{assert.equal(typeof (content as any).courtyardRunConfig,'function');return (content as any).courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));};
const level=()=>{assert.equal(typeof (director as any).CourtyardLevel,'function');return new (director as any).CourtyardLevel();};
const state=(id:string,now=0)=>(behavior as any).newEnemyState(id,now);
test('Boss scatter has world-boundary lifetime while ordinary flower keeps timed bubbles',()=>{
 assert.equal((content.BOSS_SCATTER as any).lifeMode,'world-boundary');assert.equal((content.BOSS_SCATTER as any).life,null);assert.equal(content.ENEMY_BUBBLE.life,2.5);assert.equal(content.ENEMY_BUBBLE.maxCount,16);
});
const step=(...args:any[])=>{assert.equal(typeof (behavior as any).stepSpecial,'function');if(args.length===8)args.push(100,()=>.9);return (behavior as any).stepSpecial(...args);};

test('local first-level config slows only CAT01; source P2 and diagnostic remain frozen',()=>{
 const original=makeRunConfig('CAT01','W01','p2-basic'),r=run();
 assert.equal(r.durationSeconds,600);assert.equal(r.endCondition,'boss');assert.equal(r.weapon.intervalSeconds,.8);
 assert.equal(original.weapon.intervalSeconds,.25);assert.equal(makeRunConfig('CAT01','W01','diagnostic').weapon.intervalSeconds,.5);
 assert.equal(r.weapon.damage,12);assert.equal(r.weapon.ammoCapacity,12);assert.equal(r.weapon.reloadSeconds,2.4);assert.equal(r.secondary.damageMultiplier,.75);
 assert(Object.isFrozen(r)&&Object.isFrozen(r.weapon));assert.equal(r.rulesVersion,original.rulesVersion+'-courtyard-first-level-v14');assert.equal(r.moveSpeed,170);assert.equal(original.moveSpeed,198);
 assert.equal((content as any).courtyardRunConfig(r),r);
});
test('special encounters are once-only, timed independently and keep native birth identity',()=>{
 const l=level();assert.equal(l.pending(149.999),null);assert.equal(l.pending(150),'EL01');assert(l.markSpawned('EL01',150,10));
 assert.equal(l.markSpawned('EL01',151,11),false);assert.equal(l.pending(299.999),null);assert.equal(l.pending(300),'EL01');assert(l.markSpawned('EL01',300,11));
 assert.equal(l.pending(449.999),null);assert.equal(l.pending(450),'B01');assert(l.markSpawned('B01',450,12));assert.equal(l.pending(451),null);
 assert.equal(l.defeated('EL01',460,'elite-1',999),false);assert.equal(l.defeated('EL01',460,'elite-1',10),true);assert.equal(l.defeated('EL01',461,'elite-1',10),false);
 l.defeated('B01',550,'boss-1',12);assert.equal(l.pending(599),null);assert.equal(l.bossDefeated,true);
});
test('boss clear beats timeout at deadline, death beats clear and pause blocks completion',()=>{
 const timeout=new Session(run());timeout.step(600,null);assert.equal(timeout.result,'timeout');
 const clear=new Session(run());clear.advance(600);(clear as any).completeBoss();clear.step(0,null);assert.equal(clear.result,'cleared');
 const tie=new Session(run());tie.advance(600);tie.damage(1000);(tie as any).completeBoss();assert.equal(tie.result,'death');
 const pause=new Session(run());pause.pause('menu');(pause as any).completeBoss();assert.equal(pause.result,null);
 const old=new Session(makeRunConfig('CAT01','W01','p2-basic'));old.step(120,null);assert.equal(old.result,'survived');
});
test('elite commits one dash at warning entry and cannot repeat before its cooldown',()=>{
 const s=state('EL01');step('EL01',s,0,right,readable,false,1,false);assert.equal(s.phase,'warning');
 step('EL01',s,.999,left,readable,false,1,false);assert.equal(s.phase,'warning');assert.deepEqual(s.direction,right);
 step('EL01',s,1,left,readable,false,1,false);assert.equal(s.phase,'dash');assert.deepEqual(s.direction,right);
 step('EL01',s,1.799,left,readable,false,1,false);assert.equal(s.phase,'dash');step('EL01',s,1.8,left,readable,false,1,false);assert.equal(s.phase,'recover');assert(Math.abs(s.until-2.9)<1e-8);
 step('EL01',s,2.9,left,readable,false,1,false);assert.equal(s.phase,'chase');step('EL01',s,3.599,left,readable,false,1,false);assert.equal(s.phase,'chase');
 step('EL01',s,3.6,left,readable,false,1,false);assert.equal(s.phase,'warning');assert.deepEqual(s.direction,left);assert.equal(s.until,4.6);
});
test('elite commitment ignores later visibility while freezing still interrupts',()=>{
 const s=state('EL01');step('EL01',s,0,right,readable,false,1,false);step('EL01',s,.5,left,{dash:false,slam:false},false,1,false);assert.equal(s.phase,'warning');assert.deepEqual(s.direction,right);
 step('EL01',s,1,left,{dash:false,slam:false},false,1,false);assert.equal(s.phase,'dash');assert.deepEqual(s.direction,right);
 const f=state('EL01');step('EL01',f,0,right,readable,false,1,false);step('EL01',f,1,right,readable,false,1,false);step('EL01',f,1.1,right,readable,false,1,true);assert.equal(f.phase,'recover');assert.equal(f.segment,1);
 step('EL01',f,1.5,right,readable,false,1,true);assert.equal(f.until,2.2);
});
test('boss chooses again by distance after recovery instead of forced alternation',()=>{
 const s=state('B01');step('B01',s,1.499,right,readable,false,1,false);assert.equal(s.phase,'chase');
 step('B01',s,1.5,right,readable,false,1,false);assert.equal(s.phase,'warning');step('B01',s,2.55,right,readable,false,1,false);assert.equal(s.phase,'dash');
 step('B01',s,3.65,left,readable,false,1,false);assert.equal(s.phase,'recover');step('B01',s,4.85,left,readable,false,1,false,200,()=>{throw Error('far distance must not draw');});assert.equal(s.phase,'warning');
 const slam=state('B01');step('B01',slam,1.5,right,readable,false,1,false,100,()=>.2);assert.equal(slam.phase,'slam-warning');
 assert.equal(step('B01',slam,2.549,left,readable,false,1,false).slam,false);assert.equal(step('B01',slam,2.55,left,readable,false,1,false).slam,true);
 assert.equal(step('B01',slam,2.55,left,readable,false,1,false).slam,false);assert.equal(slam.until,4.15);
 step('B01',slam,4.15,left,readable,false,1,false);assert.equal(slam.phase,'chase');assert.equal(slam.until,5.65);
});
test('boss half-health preserves windup and shortens only recovery',()=>{
 const s=state('B01');step('B01',s,3,right,readable,false,.5,false);assert.equal(s.enraged,true);assert.equal(s.until,4.05);
 step('B01',s,4.05,right,readable,false,1,false);step('B01',s,5.15,right,readable,false,1,false);assert.equal(s.enraged,true);assert(Math.abs(s.until-6.11)<1e-8);
 const slam=state('B01');step('B01',slam,3,right,readable,false,.5,false,100,()=>.2);assert.equal(slam.phase,'slam-warning');assert.equal(slam.until,4.05);
 step('B01',slam,4.05,right,readable,false,.5,false);assert(Math.abs(slam.until-5.33)<1e-8);
});
test('committed slam resolves once even after leaving the camera; long frames advance one action',()=>{
 const s=state('B01');Object.assign(s,{phase:'slam-warning',until:1,lastAttack:'slam'});
 assert.equal(step('B01',s,2,right,{dash:true,slam:false},false,1,false).slam,true);assert.equal(s.phase,'recover');
 const lag=state('EL01');step('EL01',lag,0,right,readable,false,1,false);step('EL01',lag,20,right,readable,false,1,false);assert.equal(lag.phase,'dash');assert.equal(lag.until,20.8);
});
test('special birth respects exterior gap and 240u separation without moving the cat',()=>{
 const view={x:180,y:450,width:360,height:520},player={x:360,y:720};
 const point=chooseCourtyardSpawn([{x:32,y:1000},{x:-96,y:1000}],view,player,{gap:96,minDistance:240});assert.deepEqual(point,{x:-96,y:1000});assert.deepEqual(player,{x:360,y:720});
});
test('slower starting weapon respects .8s cooldown and explicit pause without catch-up',()=>{
 const s=new Session(run());assert(s.step(0,right));assert.equal(s.step(.799,right),null);assert(s.step(.001,right));s.pause('menu');assert.equal(s.step(20,right),null);s.resume();assert.equal(s.step(0,right),null);assert.equal(s.shots,2);
});

test('Boss D1 pressure extends charge and health while preserving warning, body and damage',()=>{
 const b=content.ENEMIES.B01;assert.equal(b.slamRadius,112);assert.equal(b.dashSpeed,240);assert.equal(b.dashSpeed*b.dashSeconds,264);assert.equal(b.warningSeconds,1.05);
 assert.equal(b.hp,1500);assert.equal(b.radius,32);assert.equal(b.contact,12);assert.equal(b.dashDamage,18);assert.equal(b.slamDamage,20);assert.equal(b.dashRecovery,1.2);assert.equal(b.slamRecovery,1.6);
 const s=state('B01');step('B01',s,3,right,readable,false,1,false);step('B01',s,4.049,left,readable,false,1,false);assert.equal(s.phase,'warning');step('B01',s,4.05,left,readable,false,1,false);assert.equal(s.phase,'dash');assert.deepEqual(s.direction,left);
 step('B01',s,4.06,right,readable,false,1,false);assert.deepEqual(s.direction,left);
});

test('Boss committed windups survive camera loss and chill without early execution',()=>{
 for(const phase of ['warning','slam-warning']){
  const s=state('B01');Object.assign(s,{phase,until:2});
  const early=step('B01',s,1,right,{dash:false,slam:false},false,.5,true);assert.equal(s.phase,phase);assert.equal(early.slam,false);assert.equal(s.until,2);
  const result=step('B01',s,2,right,{dash:false,slam:false},false,.5,true);assert.equal(s.phase,phase==='warning'?'dash':'recover');assert.equal(result.slam,phase==='slam-warning');
  assert.equal(step('B01',s,2.01,left,{dash:false,slam:false},false,.5,true).slam,false);
 }
});

test('near attacks split 60/40 at124u; far and unavailable attacks never consume a draw',()=>{
 const choose=(behavior as any).chooseBossAttack;assert.equal(typeof choose,'function');
 let slams=0,dashes=0,draws=0;
 for(let i=0;i<100;i++){const selected=choose(124,readable,()=>{draws++;return (i+.5)/100;});if(selected==='slam')slams++;else if(selected==='dash')dashes++;}
 assert.equal(slams,60);assert.equal(dashes,40);assert.equal(draws,100);
 const noDraw=()=>{throw Error('not a two-choice start');};
 assert.equal(choose(124.001,readable,noDraw),'dash');assert.equal(choose(100,{dash:false,slam:false},noDraw),null);
 assert.equal(choose(100,{dash:false,slam:true},noDraw),'slam');assert.equal(choose(100,{dash:true,slam:false},noDraw),'dash');assert.equal(choose(200,{dash:false,slam:true},noDraw),null);
});
test('one chosen warning keeps its attack across distance, camera and chill changes',()=>{
 for(const roll of [.2,.8]){
  let draws=0;const random=()=>{draws++;return roll;},s=state('B01');step('B01',s,3,right,readable,false,1,false,100,random);
  assert.equal(s.phase,roll<.6?'slam-warning':'warning');assert.equal(draws,1);const deadline=s.until;
  for(let n=0;n<10;n++)step('B01',s,3+n*.05,left,{dash:false,slam:false},false,.4,true,300,random);
  assert.equal(draws,1);assert.equal(s.until,deadline);assert.equal(s.phase,roll<.6?'slam-warning':'warning');
  const resolved=step('B01',s,deadline,left,{dash:false,slam:false},false,.4,true,300,random);assert.equal(resolved.slam,roll<.6);assert.equal(draws,1);
 }
});

test('D1 pressure extends elite and Boss runs while preserving ordinary pools and contact contracts',()=>{
 const e=content.ENEMIES.EL01,b=content.ENEMIES.B01;
 assert.equal(content.COURTYARD_LEVEL.id,'courtyard-first-level-v14');
 assert.equal(e.hp,480);assert.equal(e.dashSpeed*e.dashSeconds,160);assert.equal(e.recovery,1.1);assert.equal(e.attackInterval,3.6);
 assert.equal(b.hp,1500);assert.equal(b.dashSpeed*b.dashSeconds,264);assert.equal(b.chase,1.5);assert.equal(b.dashRecovery,1.2);assert.equal(b.slamRecovery,1.6);
 assert.equal(b.speed,45);assert.equal(b.size,96);assert.equal(b.radius,32);assert.equal(b.contact,12);assert.equal(b.dashDamage,18);assert.equal(b.slamDamage,20);assert.equal(b.slamRadius,112);
 assert.equal(content.ENEMY_BUBBLE.maxCount,16);assert.equal(content.COURTYARD_LEVEL.duration,600);assert.deepEqual(content.COURTYARD_LEVEL.eliteTimes,[150,300]);assert.equal(content.COURTYARD_LEVEL.bossAt,450);
});
test('scatter capacity uses the same inclusive HP boundary as a new warning and keeps sticky enrage',()=>{
 for(const [enraged,hp,rounds] of [[false,.500001,1],[false,.5,2],[true,.8,2]] as const){
  const s=state('B01');s.enraged=enraged;
  const predicted=behavior.bossScatterRounds(behavior.bossIsEnraged(s.enraged,hp));
  step('B01',s,1.5,right,{...readable,scatter:true},false,hp,false,200,()=>.9);
  assert.equal(predicted,rounds);assert.equal(s.scatterRounds,predicted);
  assert.equal(predicted*content.BOSS_SCATTER.angles.length,rounds*5);
 }
});
test('scatter takes priority only at inclusive 150–260u, with ready cooldown and readable reserved capacity',()=>{
 const choose=behavior.chooseBossAttack as any,noDraw=()=>{throw Error('scatter and far starts must not draw');};
 for(const distance of [150,200,260])assert.equal(choose(distance,{...readable,scatter:true},noDraw,true),'scatter');
 for(const distance of [149.999,260.001])assert.equal(choose(distance,{...readable,scatter:true},noDraw,true),'dash');
 assert.equal(choose(200,{...readable,scatter:true},noDraw,false),'dash');
 assert.equal(choose(200,{...readable,scatter:false},noDraw,true),'dash');
 assert.equal(choose(200,{dash:false,slam:true,scatter:false},noDraw,true),null);
 assert.equal(choose(124,{...readable,scatter:true},()=>.2,true),'slam');
});
test('scatter locks initial aim, one round and ten-second cooldown even when crossing half health or leaving camera',()=>{
 const s=state('B01'),r={...readable,scatter:true};step('B01',s,1.5,right,r,false,1,false,200,()=>.9);
 assert.equal(s.phase,'scatter-warning');assert.equal(s.until,2.6);assert.equal(s.scatterRounds,1);assert.equal(s.scatterCooldownUntil,11.5);
 step('B01',s,2,left,{dash:false,slam:false,scatter:false},false,.4,true,300,()=>{throw Error('committed attack reselected');});
 assert.deepEqual(s.direction,right);assert.equal(s.scatterRounds,1);assert.equal(s.until,2.6);assert.equal(s.scatterCooldownUntil,11.5);
 const fire=step('B01',s,2.6,left,{dash:false,slam:false,scatter:false},false,.4,true,300,()=>.9);
 assert.equal(fire.scatterRound,1);assert.equal(s.phase,'recover');assert(Math.abs(s.until-3.88)<1e-8);
 assert.equal(step('B01',s,2.6,left,r,false,.4,false,200,()=>.9).scatterRound,0);
});
test('enraged scatter locks two rounds at initial direction with .55s spacing and no long-frame catch-up',()=>{
 const s=state('B01'),r={...readable,scatter:true};step('B01',s,1.5,right,r,false,.5,false,260,()=>.9);
 assert.equal(s.phase,'scatter-warning');assert.equal(s.scatterRounds,2);assert.equal(s.scatterCooldownUntil,9.5);
 const first=step('B01',s,2.6,left,r,false,.5,false,100,()=>.9);assert.equal(first.scatterRound,1);assert.equal(s.phase,'scatter-wait');assert.deepEqual(s.direction,right);
 assert.equal(step('B01',s,3.149,left,r,false,.5,false,100,()=>.9).scatterRound,0);
 const second=step('B01',s,3.15,left,r,false,.5,false,100,()=>.9);assert.equal(second.scatterRound,2);assert.equal(s.phase,'recover');assert(Math.abs(s.until-4.43)<1e-8);
 const lag=state('B01');step('B01',lag,1.5,right,r,false,.5,false,200,()=>.9);
 assert.equal(step('B01',lag,20,left,r,false,.5,false,100,()=>.9).scatterRound,1);assert.equal(lag.phase,'scatter-wait');assert.equal(lag.until,20.55);
 assert.equal(step('B01',lag,20,left,r,false,.5,false,100,()=>.9).scatterRound,0);
});
test('scatter cooldown and unreadable or full pool fall back to old distance selection',()=>{
 for(const scatter of [false,true]){
  const s=state('B01');s.scatterCooldownUntil=100;step('B01',s,1.5,right,{...readable,scatter},false,.5,false,200,()=>.2);assert.equal(s.phase,'warning');
 }
 const full=state('B01');step('B01',full,1.5,right,{...readable,scatter:false},false,.5,false,200,()=>.2);assert.equal(full.phase,'warning');
});

