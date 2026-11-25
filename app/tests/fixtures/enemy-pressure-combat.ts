import './courtyard-boss-combat';
declare function require(path:string):any;
import {ENEMIES} from '../../src/level-config';
const w=window as any;
w.runEnemyPressureChecks=()=>{
 const {a,battle,g,start,step,tick,position}=w.sliceFixture,checks:any[]=[],failures:string[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>{checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});if(!pass)throw Error(name);};
 const suite=(name:string,run:()=>void)=>{try{run();}catch(error){failures.push(name+': '+String(error));}};
 const oldFire=a.fireVolley;a.fireVolley=()=>{};
 const quiet=()=>{start();a.spawns.take=()=>null;a.reinforcements.begin=()=>false;a.cameras.main.stopFollow();a.cameras.main.preRender();};
 const boss=(half=false,x=300,y=720)=>{const b=a.placeSliceEnemy('B01',x,y);b.setData('hp',half?ENEMIES.B01.hp*.5:10000);b.getData('behavior').until=0;return b;};
 const shots=()=>a.enemyProjectiles.getChildren().filter((s:any)=>s.active);
 const resume=()=>{const wake=g.loop.wake;g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();};
 try{
 suite('pressure and long charge readability',()=>{
  quiet();position(a.cat,500,720);const b=boss();const s=b.getData('behavior');s.scatterCooldownUntil=100;step();
  check('actual visible Boss can start a 264u horizontal charge beyond the viewport',s.phase==='warning'&&a.readableAttack(b,{x:1,y:0},264),{state:s,view:a.cameras.main.worldView});
  const x=b.body.center.x;while(s.phase==='warning')step();const entered=battle.snapshot().elapsed;
  while(s.phase==='dash')step();check('native Arcade charge retains full264u at240u/s across camera edge',Math.abs(b.body.center.x-x-264)<5&&Math.abs(battle.snapshot().elapsed-entered-1.1)<.02,{travel:b.body.center.x-x,duration:battle.snapshot().elapsed-entered});
  quiet();const elite=a.placeSliceEnemy('EL01',300,720);position(a.cat,470,720);step();check('actual elite pressure has480HP and .8sec charge',elite.getData('hp')===480&&elite.getData('behavior').phase==='warning'&&ENEMIES.EL01.dashSeconds===.8,{hp:elite.getData('hp'),state:elite.getData('behavior')});
  quiet();const off=boss(false,100,720);position(a.cat,300,720);step();check('fully offscreen source cannot begin a hidden long charge',off.getData('behavior').phase==='chase',off.getData('behavior'));
  quiet();const vertical=boss(false,360,650);position(a.cat,360,910);vertical.getData('behavior').scatterCooldownUntil=100;step();check('vertical long charge admits readable starting body',vertical.getData('behavior').phase==='warning',vertical.getData('behavior'));
  quiet();const edge=boss(false,300,720);const view=a.cameras.main.worldView;position(edge,view.x+90,view.y+20);step();check('HUD-hidden starting body cannot warn or scatter',edge.getData('behavior').phase==='chase',{state:edge.getData('behavior'),view});
 });
 suite('actual distance and cooldown boundaries',()=>{
  for(const distance of [149.999,150,260,260.001]){
   quiet();position(a.cat,300+distance,720);const b=boss();step();const expected=distance>=150&&distance<=260?'scatter-warning':'warning';
   check('actual distance '+distance+' selects '+expected,b.getData('behavior').phase===expected,{state:b.getData('behavior'),distance});
  }
  quiet();position(a.cat,500,720);const b=boss();b.getData('behavior').scatterCooldownUntil=100;step();check('actual cooldown-unavailable medium range falls back to charge',b.getData('behavior').phase==='warning'&&a.bossProjectileSlots.reserved===0,{state:b.getData('behavior'),reserved:a.bossProjectileSlots.reserved});
 });
 suite('one-round lock and actual projectile contract',()=>{
  quiet();position(a.cat,500,720);const b=boss(),s=b.getData('behavior');step();const started=battle.snapshot().elapsed;
  check('actual medium-range Boss reserves5 slots before its1.1s warning',s.phase==='scatter-warning'&&a.bossProjectileSlots.reserved===5&&Math.abs(s.until-started-1.1)<1e-8,{state:s,reserved:a.bossProjectileSlots?.reserved});
  const commands=a.warning.commandBuffer.length;check('scatter warning actually draws locked fan and round markers',commands>0,commands);
  check('scatter core charge and round markers render above the opaque Boss body',a.scatterCore?.depth>1&&a.scatterCore.commandBuffer.length>0,{depth:a.scatterCore?.depth??null,commands:a.scatterCore?.commandBuffer.length??0});
  battle.pause('menu');g.scene.processQueue();const pauseState=JSON.stringify({time:battle.snapshot().elapsed,state:s,commands:a.warning.commandBuffer,reserved:a.bossProjectileSlots.reserved});step(90);
  check('menu freezes scatter warning Graphics, deadline and reservation',pauseState===JSON.stringify({time:battle.snapshot().elapsed,state:s,commands:a.warning.commandBuffer,reserved:a.bossProjectileSlots.reserved}),s);resume();
  position(a.cat,360,940);b.setData('hp',ENEMIES.B01.hp*.4);step(20);check('current scatter keeps its original direction and one round across half health',s.scatterRounds===1&&s.direction.x===1&&Math.abs(s.direction.y)<1e-8&&s.scatterCooldownUntil===started+10,s);
  a.cameras.main.setScroll(0,0).preRender();step();check('a committed scatter cannot cancel after its source leaves the camera',s.phase==='scatter-warning'&&!a.readableScatter(b)&&a.bossProjectileSlots.reserved===5,{state:s,reserved:a.bossProjectileSlots.reserved});
  while(s.phase==='scatter-warning')step();const fired=shots();
  check('actual first volley has5 native14u/5u/110u/s bubbles,12damage and world-boundary lifetime',fired.length===5&&fired.every((q:any)=>q.displayWidth===14&&Math.abs(q.body.halfWidth-5)<.0001&&Math.abs(q.body.velocity.length()-110)<.0001&&q.getData('damage')===12&&q.getData('lifeTimer')===null&&q.getData('lifeMode')==='world-boundary'),fired.map((q:any)=>({size:q.displayWidth,radius:q.body.halfWidth,velocity:q.body.velocity,damage:q.getData('damage'),lifeMode:q.getData('lifeMode')})));
  const angles=fired.map((q:any)=>Math.atan2(q.body.velocity.y,q.body.velocity.x)*180/Math.PI).sort((x:number,y:number)=>x-y);
  check('actual locked angles are minus48/minus24/0/24/48degrees',angles.every((v:number,i:number)=>Math.abs(v-[-48,-24,0,24,48][i])<.0001),angles);
  check('emission consumes all reservations and enters recovery without new round',a.bossProjectileSlots.reserved===0&&s.phase==='recover',{reserved:a.bossProjectileSlots.reserved,state:s});
  step(35);check('half-health crossing cannot add a second volley',shots().length===5&&s.scatterRounds===1,{active:shots().length,state:s});
 });
 suite('pool preflight shared with flowers',()=>{
  quiet();position(a.cat,500,720);const flower=a.placeSliceEnemy('E04',250,900);flower.getData('behavior').nextAttack=1000;flower.getData('behavior').direction={x:0,y:1};
  for(let n=0;n<7;n++)a.emitBubble(flower);const b=boss(true);step();
  check('nine free slots cannot start an enraged ten-slot scatter',b.getData('behavior').phase==='warning'&&a.bossProjectileSlots.reserved===0,{state:b.getData('behavior'),active:shots().length,reserved:a.bossProjectileSlots.reserved});
  quiet();position(a.cat,500,720);const owner=boss(true);step();const f=a.placeSliceEnemy('E04',250,900);f.getData('behavior').nextAttack=1000;f.getData('behavior').direction={x:0,y:1};
  for(let n=0;n<7;n++)a.emitBubble(f);check('normal flower cannot consume ten reserved Boss slots',shots().length===6&&a.bossProjectileSlots.reserved===10&&a.emitBubble(f)===null,{active:shots().length,reserved:a.bossProjectileSlots.reserved});
  while(owner.getData('behavior').phase==='scatter-warning')step();while(owner.getData('behavior').phase==='scatter-wait')step();check('all ten promised bullets launch beside six ordinary bullets with no empty attack',shots().length===16&&a.bossProjectileSlots.reserved===0,{active:shots().length,reserved:a.bossProjectileSlots.reserved,state:owner.getData('behavior')});
  quiet();position(a.cat,500,720);const cancelled=boss(true);step();const flower2=a.placeSliceEnemy('E04',250,900);flower2.getData('behavior').direction={x:0,y:1};a.recycle(cancelled,a.enemies);check('death before release cancels reserved slots immediately',a.bossProjectileSlots.reserved===0&&!!a.emitBubble(flower2),{reserved:a.bossProjectileSlots.reserved,active:shots().length});
 });
 suite('long frame advances only one round and world wall still stops charge',()=>{
  quiet();position(a.cat,500,720);const b=boss(true);step();const old=a.emitBossScatter,rounds:number[]=[];a.emitBossScatter=function(owner:any,round:number){rounds.push(round);return old.call(this,owner,round);};
  try{tick(2500);check('a long frame launches only round one and schedules a fresh.55s wait',rounds.length===1&&rounds[0]===1&&b.getData('behavior').phase==='scatter-wait'&&Math.abs(b.getData('behavior').until-battle.snapshot().elapsed-.55)<1e-8&&a.bossProjectileSlots.reserved===5,{rounds,state:b.getData('behavior'),reserved:a.bossProjectileSlots.reserved});step();check('next frame cannot replay overdue second round',rounds.length===1,rounds);step(33);check('second round launches exactly once after its fresh wait',rounds.length===2&&rounds[1]===2&&a.bossProjectileSlots.reserved===0,{rounds,reserved:a.bossProjectileSlots.reserved});}finally{a.emitBossScatter=old;}
  quiet();a.cameras.main.setScroll(360,568).preRender();position(a.cat,700,720);const wall=boss(false,650,720);Object.assign(wall.getData('behavior'),{phase:'warning',until:.05,scatterCooldownUntil:100,direction:{x:1,y:0}});step(4);const entered=battle.snapshot().elapsed;while(wall.getData('behavior').phase==='dash')step();
  check('actual Arcade world wall stops charge before1.1s without treating camera edge as a wall',wall.getData('behavior').phase==='recover'&&Math.abs(wall.body.center.x-688)<.001&&battle.snapshot().elapsed-entered<.5,{state:wall.getData('behavior'),center:wall.body.center,elapsed:battle.snapshot().elapsed-entered});
 });
 suite('two-round lock pause and lifetime',()=>{
  quiet();position(a.cat,500,720);const b=boss(true),s=b.getData('behavior');step();check('actual enraged scatter reserves10 and locks two rounds/eight-second cooldown',s.phase==='scatter-warning'&&s.scatterRounds===2&&a.bossProjectileSlots.reserved===10&&Math.abs(s.scatterCooldownUntil-battle.snapshot().elapsed-8)<1e-8,{state:s,reserved:a.bossProjectileSlots.reserved});
  while(s.phase==='scatter-warning')step();const firstTime=battle.snapshot().elapsed;check('only first five launch at warning deadline',shots().length===5&&a.bossProjectileSlots.reserved===5&&s.phase==='scatter-wait',{count:shots().length,reserved:a.bossProjectileSlots.reserved,state:s});
  position(a.cat,360,940);battle.pause('background');g.scene.processQueue();const frozen=JSON.stringify({time:battle.snapshot().elapsed,state:s,shots:shots().map((q:any)=>({x:q.x,y:q.y,t:q.getData('lifeTimer')?.elapsed??null})),reserved:a.bossProjectileSlots.reserved});step(300);
  check('background freezes pending second round, flight, Clock lifetime and quota',frozen===JSON.stringify({time:battle.snapshot().elapsed,state:s,shots:shots().map((q:any)=>({x:q.x,y:q.y,t:q.getData('lifeTimer')?.elapsed??null})),reserved:a.bossProjectileSlots.reserved}),frozen);resume();step();
  check('resume cannot immediately catch up or add a volley',shots().length===5&&battle.snapshot().elapsed-firstTime<.03,{count:shots().length,elapsed:battle.snapshot().elapsed-firstTime});
  while(s.phase==='scatter-wait')step();const secondTime=battle.snapshot().elapsed,second=shots().slice(5).map((q:any)=>Math.atan2(q.body.velocity.y,q.body.velocity.x)*180/Math.PI).sort((x:number,y:number)=>x-y);
  check('second five launch after.55s with original aim plus12degrees',shots().length===10&&Math.abs(secondTime-firstTime-.55)<.02&&second.every((v:number,i:number)=>Math.abs(v-[-36,-12,12,36,60][i])<.0001),{second,spacing:secondTime-firstTime,count:shots().length});
  b.getData('behavior').until=1000;while(battle.snapshot().elapsed<firstTime+2.79)step();check('first volley remains before former2.8sec limit',shots().length>=5,{count:shots().length,elapsed:battle.snapshot().elapsed});step(40);check('world-boundary bullets survive former lifetime without reservations',shots().length>0&&shots().every((q:any)=>q.getData('lifeTimer')===null)&&a.bossProjectileSlots.reserved===0,{count:shots().length,reserved:a.bossProjectileSlots.reserved});while(battle.snapshot().elapsed<firstTime+15)step();check('native world-boundary passage eventually releases every long-flight bullet',shots().length===0&&a.bossProjectileSlots.reserved===0,{count:shots().length,reserved:a.bossProjectileSlots.reserved});
 });
 suite('actual shared damage and long-frame sweep',()=>{
  quiet();position(a.cat,430,720);const b=boss(false,300,720);b.getData('behavior').until=1000;b.getData('behavior').direction={x:1,y:0};
  a.bossProjectileSlots.reserve(b,5);a.emitBossScatter(b,1);const q=shots()[2];for(const other of shots())if(other!==q)a.recycle(other,a.enemyProjectiles);position(q,414,720);q.setVelocity(110,0);step();
  check('real Boss bubble deals12 through existing one-hit collision and recycles',battle.snapshot().hp===78&&!q.active,{hp:battle.snapshot().hp,active:q.active});
  a.bossProjectileSlots.reserve(b,5);a.emitBossScatter(b,1);const protectedShot=shots()[2];position(protectedShot,430,720);step();check('shared.7sec protection consumes another Boss bubble without stacking',battle.snapshot().hp===78&&!protectedShot.active,{hp:battle.snapshot().hp,active:protectedShot.active});
  quiet();position(a.cat,430,720);const long=boss(false,300,720);long.getData('behavior').until=1000;long.getData('behavior').direction={x:1,y:0};a.bossProjectileSlots.reserve(long,5);a.emitBossScatter(long,1);const fast=shots()[2];for(const other of shots())if(other!==fast)a.recycle(other,a.enemyProjectiles);position(fast,390,720);fast.setVelocity(110,0);tick(700);check('native relative geometry catches one long-frame Boss bubble crossing',battle.snapshot().hp===78&&!fast.active,{hp:battle.snapshot().hp,active:fast.active});
 });
 suite('contact, slam and flower share one clock',()=>{
  quiet();position(a.cat,430,720);
  const b=boss(false,350,720);b.getData('behavior').until=1000;
  a.resolveSlam(b);
  check('native slam starts the shared protection',battle.snapshot().hp===70,battle.snapshot().hp);
  const flower=a.placeSliceEnemy('E04',200,720);flower.getData('behavior').direction={x:1,y:0};
  const bubble=a.emitBubble(flower);position(bubble,430,720);a.resolveBubbles();
  check('flower bubble after slam is consumed without damage',battle.snapshot().hp===70&&!bubble.active,battle.snapshot().hp);
  a.recycle(b,a.enemies);a.recycle(flower,a.enemies);
  const fog=a.placeSliceEnemy('E01',430,720);step();
  check('ordinary contact during the same protection does not stack',battle.snapshot().hp===70,battle.snapshot().hp);
  while(battle.snapshot().elapsed<.7)step();
  check('ordinary contact can hit again after the shared interval',battle.snapshot().hp===62,{hp:battle.snapshot().hp,elapsed:battle.snapshot().elapsed,active:fog.active});
 });
 suite('twenty restart cleanup',()=>{
  quiet();position(a.cat,500,720);boss(true);step();while(a.enemies.getFirstAlive().getData('behavior').phase==='scatter-warning')step();step(34);const warmed=a.children.length;
  for(let n=0;n<20;n++){quiet();position(a.cat,500,720);const b=boss(true);step();if(n%2)while(b.getData('behavior').phase==='scatter-warning')step();}
  quiet();step();check('twenty restarts clear pending rounds, reservation, old bubbles and Clock events',a.bossProjectileSlots.reserved===0&&shots().length===0&&battle.snapshot().engine.timers===0&&a.children.length===warmed,{reserved:a.bossProjectileSlots.reserved,active:shots().length,timers:battle.snapshot().engine.timers,warmed,children:a.children.length});
 });
 }finally{a.fireVolley=oldFire;}
 return {status:failures.length?'FAIL':'PASS',scope:'ACTUAL_CONTROLLED_SCENE_NOT_NATURAL_BALANCE',checks,failures};
};

w.runD2bPressureChecks=()=>{const {a,battle,g,start,step,tick,position}=w.sliceFixture,checks:any[]=[];const fire=a.fireVolley,trySpawn=a.trySpecialSpawn;
 const verify=(name:string,pass:unknown,actual:unknown)=>{checks.push({name,pass:!!pass,actual});if(!pass)throw Error(name);};
 try{
  const stages=require('../../src/level-config').SPAWN_STAGES;
  for(const stage of stages){
   start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};tick(stage.start*1000);for(let i=0;i<30;i++)a.spawnCourtyardEnemy('E01');
   let state=battle.snapshot();verify('native ordinary group enforces shared cap '+stage.cap+' from '+stage.start+'s',state.enemies===stage.cap&&state.engine.groups.enemies.total<=32,{enemies:state.enemies,stage,pressure:state.spawnPressure});
   const special=a.placeSliceEnemy('B01',650,720);verify('one special retains a reserved native slot at cap '+stage.cap,!!special&&a.enemies.countActive(true)===stage.cap+1&&a.enemies.maxSize===32,{total:a.enemies.countActive(true),max:a.enemies.maxSize});
   a.reinforcements.begin('B01',state.elapsed-1.2);a.reinforcements.attempt(state.elapsed,a.spawnCourtyardEnemy('E01',true));verify('arrival quota shares timed ordinary cap '+stage.cap,a.reinforcements.snapshot(state.elapsed).spawned===0&&a.enemies.countActive(true)===stage.cap+1,a.reinforcements.snapshot(state.elapsed));
   const ordinary=a.enemies.getChildren().find((e:any)=>e.active&&e.getData('enemyId')==='E01');a.recycle(ordinary,a.enemies);const scheduled=a.spawnCourtyardEnemy('E01');a.reinforcements.attempt(state.elapsed+.5,a.spawnCourtyardEnemy('E01',true));
   verify('same-frame schedule and quota attempts cannot exceed cap '+stage.cap,scheduled&&a.enemies.countActive(true)===stage.cap+1&&a.reinforcements.snapshot(state.elapsed+.5).spawned===0,{count:a.enemies.countActive(true),quota:a.reinforcements.snapshot(state.elapsed+.5)});
  }
  start();a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};tick(330000);let state=battle.snapshot();verify('real schedule continues at 330s into elite/Boss era',state.spawnPressure[4].planned===1&&state.spawnPressure[4].spawned===1,state.spawnPressure);
  for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);tick(120000);state=battle.snapshot();verify('real schedule advances to the 450s Boss pressure stage',state.spawnPressure[5].planned===1&&state.spawnPressure[5].spawned===1,state.spawnPressure);
  battle.pause('background');g.scene.processQueue();const frozen=JSON.stringify(state.spawnPressure);step(90);verify('pause freezes both native spawn schedule and quota state',JSON.stringify(battle.snapshot().spawnPressure)===frozen,battle.snapshot().spawnPressure);
  a.fireVolley=fire;a.trySpecialSpawn=trySpawn;return {status:'PASS',scope:'CONTROLLED_NATIVE_STAGE_CAPS_NOT_NATURAL_PLAY',checks};
 }catch(error){a.fireVolley=fire;a.trySpecialSpawn=trySpawn;return {status:'FAIL',error:String(error),checks};}
};
