import {applyChill} from '../../src/cat-passives';
import {createBattle} from '../../src/battle';
import {projectileCapacityForGrowth} from '../../src/progression-capacity';
import {GROWTH_NUMBERS as N} from '../../src/progression-content';
import {ENEMIES} from '../../src/level-config';
import {Session} from '../../src/rules';
import {makeRunConfig} from '../../src/combat-config';
declare function require(path:string):any;
const w=window as any;
async function boot(){
 const images:any={};for(const id of ['CAT01','CAT02','CAT03'])images[id]=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='assets/ui/'+id+'.png';});
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),old=factory.prototype.graphics;let arena:any;
 factory.prototype.graphics=function(...args:any[]){arena=this.scene;return old.apply(this,args);};
 const battle=await createBattle(document.getElementById('stage')!,{onState(){},onInterrupt(){},onFinish(){}},images);factory.prototype.graphics=old;
 let session:Session;const advance=Session.prototype.advance;Session.prototype.advance=function(dt:number){session=this;return advance.call(this,dt);};
 const a=arena,g=a.game,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const step=(frames=1)=>{for(let f=0;f<frames;f++){now+=1000/60;g.scene.update(now,1000/60);g.scene.processQueue();}};
 const start=(cat:string,tuning:any={attributePlan:'A',xpTarget:28})=>{g.loop.wake=()=>{};battle.start(Object.freeze({...makeRunConfig(cat,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic'),growthTuning:tuning}));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 const choose=(id:string)=>{const growth=battle.snapshot().progression!;g.loop.wake=()=>{};const ok=battle.confirmUpgrade(growth.runId,growth.offer!.id,id);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();return ok;};
 // Controlled rank/offer setup; actual confirmation, physics, Clock, damage,
 // native Group reuse and Session still execute. No claim of natural acquisition.
 const install=(ranks:any)=>{a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};a.growth.collect(8);step();a.growth.offer.choices=['L1_HEART'];if(!choose('L1_HEART'))throw Error('actual growth confirmation');};
 w.runCrossWeaponChecks=async()=>{const checks:any[]=[];const check=(name:string,pass:unknown,value:any)=>{checks.push({name,pass:!!pass,value:value===undefined?undefined:JSON.parse(JSON.stringify(value))});if(!pass)throw Error(name);};const resolve=a.resolveProjectile,projectile=a.projectile;try{
 const initial:any={};
 const coldFire=a.fireVolley,flowerReadable=a.readableFlower;
 try{for(const id of ['E01','E03','E04'] as const){
  start('CAT02');a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};position(a.cat,360,720);
  const e=a.placeSliceEnemy(id,360,420),chill=a.chillOf(e),velocity=()=>Math.hypot(e.body.velocity.x,e.body.velocity.y);
  step();check(id+' keeps fixed native speed without chill',Math.abs(velocity()-ENEMIES[id].speed)<1e-7,velocity());
  applyChill(chill,session!.elapsed,session!.runConfig.chill);step();check(id+' one actual chill layer slows native velocity15percent',Math.abs(velocity()-ENEMIES[id].speed*.85)<1e-7,velocity());
  applyChill(chill,session!.elapsed,session!.runConfig.chill);step();check(id+' two actual chill layers slow native velocity30percent',Math.abs(velocity()-ENEMIES[id].speed*.7)<1e-7,velocity());
  if(id==='E04'){position(e,360,540);a.readableFlower=()=>true;Object.assign(e.getData('behavior'),{phase:'warning',until:session!.elapsed,nextAttack:0});}
  applyChill(chill,session!.elapsed,session!.runConfig.chill);step(20);
  check(id+' third layer freezes actual native velocity',velocity()===0&&battle.snapshot().enemyStatuses.find(x=>x.id===e.getData('id'))?.frozen,{velocity:velocity(),state:chill});
  if(id==='E04')check('frozen flower neither fires nor retains expired warning',a.enemyProjectiles.countActive(true)===0&&e.getData('behavior').phase==='chase',e.getData('behavior'));
  step(28);
  if(id==='E04'){
   check('flower thaws into a fresh readable warning rather than overdue fire',e.getData('behavior').phase==='warning'&&e.getData('behavior').until>session!.elapsed+.7&&a.enemyProjectiles.countActive(true)===0,e.getData('behavior'));
   step(60);check('flower fires normally after the new warning',a.enemyProjectiles.countActive(true)===1,battle.snapshot().enemyProjectiles);
  }else check(id+' resumes base speed after thaw',Math.abs(velocity()-ENEMIES[id].speed)<1e-7,velocity());
  a.readableFlower=flowerReadable;
 }}finally{a.fireVolley=coldFire;a.readableFlower=flowerReadable;}

 for(const cat of ['CAT01','CAT02','CAT03']){
  start(cat);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
  const s=battle.snapshot();check(cat+' enters actual 600s courtyard growth',s.durationSeconds===600&&!!s.progression&&s.contentId.includes('v13'),{duration:s.durationSeconds,growth:s.progression});
  initial[cat]=s;check(cat+' keeps frozen native cadence and passive',s.weaponInterval===(cat==='CAT01'?.8:cat==='CAT02'?1/1.2:1/1.5)&&s.passiveState!==null,s.weaponStats);
  if(cat==='CAT01')check('orange keeps30u animation and12u contact',s.presentation?.bodyDisplay.width===30&&s.engine.bodies.cat.radius===12,s.presentation);
  else check(cat+' retains existing58u static display',a.cat.displayWidth===58,a.cat.displayWidth);
  // Native line collision: additional pierce adds to W04 instead of replacing it.
  install({L1_PIERCE:1,L1_EVO_PIERCE:1});
  const config=session!.effectiveConfig,p={x:360,y:600};position(a.cat,p.x,p.y);
  const enemies=[a.placeSliceEnemy('E01',390,600),a.placeSliceEnemy('E01',420,600),a.placeSliceEnemy('E01',450,600)];enemies.forEach((e:any)=>{e.setData('hp',10000);e.body.moves=false;});
  a.projectile(p,0,'bell','PRIMARY',9000,config.weapon.damage*config.directDamageMultiplier,config.weapon.extraPierce,config.weapon.bulletSpeed,config.weapon.bulletLifeSeconds);
  const fire=a.fireVolley;a.fireVolley=()=>{};step(18);
  check(cat+' actual swept projectile damages three distinct targets',enemies.every((e:any)=>e.getData('hp')<10000)&&config.weapon.extraPierce===(cat==='CAT02'?4:2),enemies.map((e:any)=>e.getData('hp')));
  a.fireVolley=fire;enemies.forEach((e:any)=>{e.body.moves=true;a.recycle(e,a.enemies);});
  // Independent ability uses the same unsplit base for all cats.
  start(cat,{attributePlan:'B',xpTarget:28});a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};install({L1_ORBIT_BELL:1,L1_DAMAGE:2,L1_RATE:3,L1_SPLIT:1});
  const bell=battle.snapshot().bellAbilities!.orbits[0],enemy=a.placeSliceEnemy('E01',bell.x,bell.y);enemy.setData('hp',1000);enemy.body.moves=false;a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,12*1.2,session!.elapsed);
  check(cat+' B ring has independent10.8 actual damage and1.24 haste',Math.abs(enemy.getData('hp')-989.2)<1e-7&&Math.abs(battle.snapshot().bellAbilities!.orbitHaste-1.24)<1e-8,{hp:enemy.getData('hp'),ability:battle.snapshot().bellAbilities});enemy.body.moves=true;a.recycle(enemy,a.enemies);
  // 886XP plus two actual elite deaths has30 reward transactions, not level31.
  start(cat);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.growth.collect(886);step();let chosen=0;
  while(battle.snapshot().progression!.offer){const snapshot=battle.snapshot().progression!,id=snapshot.offer!.choices[0];check(cat+' valid XP confirmation '+chosen,choose(id),id);chosen++;if(chosen>40)throw Error('queue loop');}
  check(cat+' real Arena28 XP offers becomeLv29 without extra reward',chosen===28&&battle.snapshot().progression!.level===29&&battle.snapshot().progression!.totalXP===886,battle.snapshot().progression);
  for(const [i,time] of [150,300].entries()){
   session!.elapsed=time;session!.hp=20;const e=a.enterSpecial('EL01',{x:100,y:100});step(75);check(cat+' elite'+i+' actually leaves arrival',e.body.enable,e.getData('behavior'));
   a.abilityHit(e,10000,'fixture');step();const before=battle.snapshot(),growth=before.progression!;check(cat+' elite'+i+' actual death queues elite not XP',growth.offer?.source==='elite'&&growth.level===29&&growth.totalXP===886,growth);
   const id=growth.offer!.choices[0];check(cat+' elite'+i+' actual confirm and recovery',choose(id)&&battle.snapshot().progression!.eliteRewards.length===i+1&&session!.hp>20,battle.snapshot().progression);
  }
  check(cat+' combined actual30 choices and stillLv29',chosen+battle.snapshot().progression!.eliteRewards.length===30&&battle.snapshot().progression!.level===29,battle.snapshot().progression);
 }
 // All projectiles kept inside the map with zero speed, no hits: exact source
 // generation compared with actual Session shots over full native lifetimes.
 for(const cat of ['CAT01','CAT02','CAT03'])for(const rate of [29,40]){
  a.resolveProjectile=resolve;a.projectile=projectile;start(cat);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
  install({L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,L1_RATE:rate});
  position(a.cat,360,700);const target=a.placeSliceEnemy('E01',500,700);target.setData('hp',1e9);target.body.moves=false;
  const attempts:any={PRIMARY:0,SECONDARY:0,SUMMON:0};a.resolveProjectile=()=>false;
  a.projectile=function(origin:any,angle:number,frame:string,source:string,...rest:any[]){attempts[source]++;return projectile.call(this,origin,angle,frame,source,rest[0],rest[1],rest[2],0,rest[4],rest[5]);};
  const fire=a.fireVolley;a.fireVolley=function(...args:any[]){a.abilities.state.collect(8,true);return fire.apply(this,args);};
  let peak=0;for(let f=0;f<1800;f++){step();peak=Math.max(peak,a.projectiles.countActive(true));}
  a.fireVolley=fire;const state=battle.snapshot();
  check(cat+' '+(rate+7)+' investments actual native source emissions are never lost',JSON.stringify(attempts)===JSON.stringify(state.sourceCounts)&&state.projectileDiagnostics.failedSpawns===0&&state.shots>20&&state.reloadCompletions>2,{attempts,actual:state.sourceCounts,peak,capacity:state.projectileDiagnostics,shots:state.shots,reloads:state.reloadCompletions});
  check(cat+' dynamic capacity is sufficient and matches pure bound',peak<=a.projectiles.maxSize&&a.projectiles.maxSize===projectileCapacityForGrowth(session!.runConfig,session!.effectiveConfig,a.growth.snapshot().ranks),state.projectileDiagnostics);
  target.body.moves=true;a.recycle(target,a.enemies);a.projectile=projectile;a.resolveProjectile=resolve;
 }
 for(let n=0;n<20;n++){start(n%2?'CAT03':'CAT01');const s=battle.snapshot();check('restart'+n+' clears growth, old shots, target and modifier inputs',s.projectiles===0&&s.progression!.level===1&&s.progression!.totalXP===0&&s.progression!.eliteRewards.length===0&&!s.moveHeld&&s.bellAbilities!.trails.length===0&&s.projectileDiagnostics.capacity===24,{projectiles:s.projectiles,level:s.progression!.level,capacity:s.projectileDiagnostics});}
 start('CAT01');return {status:'PASS',scope:'ACTUAL_ARENA_CONTROLLED_NOT_NATURAL_BALANCE',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.projectile=projectile;a.resolveProjectile=resolve;}};
 w.crossWeaponFixture={battle,a,g,step,start,wake};w.ready=true;
}boot().catch(e=>w.bootError=String(e));
