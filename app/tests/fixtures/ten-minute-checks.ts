import {BOSS_SCATTER,ENEMY_BUBBLE,SPAWN_STAGES} from '../../src/level-config';
// Controlled tests attached to the existing actual progression Arena fixture.
export function tenMinuteChecks(a:any,g:any,battle:any,start:any,choose:any,position:any,tick:any){
 const w=window as any,wake=g.loop.wake.bind(g.loop);
 w.runCrossModeEnemyCapacityChecks=async()=>{
  const checks:any[]=[],verify=(name:string,pass:any,value:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);},fire=a.fireVolley,trySpawn=a.trySpecialSpawn;
  try{start();a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   const group=a.enemies;for(let i=0;i<26;i++)a.placeSliceEnemy('E01',80+i*20,200);
   const retained=group.getChildren().filter((e:any)=>e.getData('art')).map((e:any)=>({sprite:e,art:e.getData('art')}));
   verify('courtyard warms26 native enemy Sprites under max32',group.countActive(true)===26&&group.maxSize===32&&retained.length===26,battle.snapshot().engine.groups.enemies);
   for(const cat of ['CAT02','CAT03']){start(cat);verify(cat+' starts P2 with2 active and max10 in the same larger native pool',a.enemies===group&&group.maxSize===10&&group.countActive(true)===2&&group.getLength()>=26,battle.snapshot().engine.groups.enemies);
    let accepted=0;for(let i=0;i<35;i++)if(a.place(group,80+i%8*60,.2,'enemy'))accepted++;
    verify(cat+' ordinary place cannot reuse dead members beyond actual P2 cap10',accepted===8&&group.countActive(true)===10&&a.place(group,80,.2,'enemy')===null,{accepted,active:group.countActive(true),allocated:group.getLength(),maxSize:group.maxSize});
    a.recycle(group.getFirstAlive(),group);verify(cat+' one native recycle permits exactly one replacement',!!a.place(group,80,.2,'enemy')&&group.countActive(true)===10&&a.place(group,80,.2,'enemy')===null,battle.snapshot().engine.groups.enemies);
    verify(cat+' keeps pooled EnemyPresentation ownership without deleting limbs',retained.every((r:any)=>group.contains(r.sprite)&&r.sprite.getData('art')===r.art),{retained:retained.length,allocated:group.getLength()});
   }
   start();a.spawns.take=()=>null;tick(330000);for(let i=0;i<100;i++)a.spawnCourtyardEnemy('E01');const e1=a.enterSpecial('EL01',{x:650,y:200}),e2=a.enterSpecial('EL01',{x:650,y:400});
   for(const e of group.getChildren())if(e.active)e.body.moves=false;tick(120000);const boss=a.enterSpecial('B01',{x:650,y:600});verify('returning courtyard still supports26 ordinary plus2 elites plusBoss under native max32',a.enemies===group&&group.maxSize===32&&group.countActive(true)===29&&e1&&e2&&boss,battle.snapshot().engine.groups.enemies);
   start('CAT02');for(let i=0;i<35;i++)a.place(group,80,.2,'enemy');verify('P2 cap10 survives another return from the29-entity courtyard pool',group.countActive(true)===10&&group.getLength()===29&&group.maxSize===10,battle.snapshot().engine.groups.enemies);
   return {status:'PASS',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.fireVolley=fire;a.trySpecialSpawn=trySpawn;start();}
 };
 w.runTenMinuteCapacityChecks=async()=>{
  const checks:any[]=[],verify=(name:string,pass:any,value:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);},fire=a.fireVolley,trySpawn=a.trySpecialSpawn;
  const quiet=()=>{start();a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
  const count=(id:string)=>a.enemies.getChildren().filter((e:any)=>e.active&&e.getData('enemyId')===id).length;
  try{
   for(const stage of SPAWN_STAGES){quiet();tick(stage.start*1000);for(let i=0;i<100;i++){a.spawnCourtyardEnemy('E03');a.spawnCourtyardEnemy('E04');}
    verify('stage '+stage.start+' enforces side/flower caps',count('E03')===stage.typeCaps.E03&&count('E04')===stage.typeCaps.E04,{side:count('E03'),flower:count('E04'),stage});
    for(let i=0;i<100;i++)a.spawnCourtyardEnemy('E01');verify('stage '+stage.start+' shares ordinary cap and never fills special reserve',a.enemies.countActive(true)===stage.cap&&!a.spawnCourtyardEnemy('E01')&&a.enemies.maxSize===32,battle.snapshot().engine.groups);
   }
   quiet();tick(330000);const overlap1=a.enterSpecial('EL01',{x:650,y:200}),overlap2=a.enterSpecial('EL01',{x:650,y:400});tick(1201);
   let quotas=a.reinforcements.snapshot(battle.snapshot().elapsed).encounters;verify('overlapping native elite arrivals each receive their own first reinforcement',quotas.length===2&&quotas.every((e:any)=>e.spawned===1),quotas);
   const deadBirth=overlap1.getData('id');overlap1.setData('hp',1);a.abilityHit(overlap1,1,'fixture');tick(0);choose(battle.snapshot().progression.offer.choices[0]);
   for(let i=0;i<12;i++){for(const e of a.enemies.getChildren())if(e.active)e.body.moves=false;tick(500);}
   quotas=a.reinforcements.snapshot(battle.snapshot().elapsed).encounters;verify('elite death preserves its finite arrival window and both overlapping quotas reach6',quotas[0].spawned===6&&quotas[1].spawned===6&&!a.enemies.getChildren().some((e:any)=>e.active&&e.getData('id')===deadBirth)&&overlap2.active,quotas);
   quiet();tick(330000);for(let i=0;i<100;i++)a.spawnCourtyardEnemy('E01');const e1=a.enterSpecial('EL01',{x:650,y:200}),e2=a.enterSpecial('EL01',{x:650,y:400});
   verify('26 normal plus two due elites occupy28 native slots',count('E01')===26&&e1&&e2&&a.enemies.countActive(true)===28,battle.snapshot().level);
   for(const e of a.enemies.getChildren())if(e.active){e.body.moves=false;Object.assign(e.getData('behavior'),{phase:'recover',until:1000});}
   tick(120000);const boss=a.enterSpecial('B01',{x:650,y:600});verify('Boss due at450 has reserved capacity beside26 normal and two elites',boss&&a.enemies.countActive(true)===29&&a.enemies.maxSize===32,battle.snapshot().engine.groups);
   verify('lower final cap does not delete six existing normals and blocks refill',count('E01')===26&&!a.spawnCourtyardEnemy('E01'),battle.snapshot().enemies);
   const ordinary=a.enemies.getChildren().filter((e:any)=>e.active&&e.getData('enemyId')==='E01');for(const e of ordinary.slice(0,6)){e.setData('hp',1);a.abilityHit(e,1,'fixture');}
   verify('exact final cap20 still blocks replacement',count('E01')===20&&!a.spawnCourtyardEnemy('E01'),count('E01'));
   ordinary[6].setData('hp',1);a.abilityHit(ordinary[6],1,'fixture');verify('one freed slot permits one new normal without burst',a.spawnCourtyardEnemy('E01')&&count('E01')===20&&!a.spawnCourtyardEnemy('E01'),count('E01'));
   const before=a.reinforcements.snapshot(450);tick(1201);verify('independent encounter quotas remain separate in Scene snapshots',a.reinforcements.snapshot(battle.snapshot().elapsed).encounters.length===3&&before.encounters[0].encounterId!==before.encounters[1].encounterId,a.reinforcements.snapshot(battle.snapshot().elapsed));
   return {status:'PASS',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.fireVolley=fire;a.trySpecialSpawn=trySpawn;start();}
 };
 w.runTenMinuteRewardsChecks=async()=>{
  const checks:any[]=[],verify=(name:string,pass:any,value:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};
  const fire=a.fireVolley,spawn=a.spawnCourtyardEnemy,trySpawn=a.trySpecialSpawn;
  const quiet=()=>{start();a.fireVolley=()=>{};a.spawns.take=()=>null;a.spawnCourtyardEnemy=()=>false;};
  const elite=(id:string)=>a.enemies.getChildren().find((e:any)=>e.active&&e.getData('encounterId')===id);
  const kill=(e:any)=>{e.setData('hp',1);a.abilityHit(e,1,'fixture');};
  const hurt=(damage:number)=>{a.enemyBubble(battle.snapshot().player,{x:0,y:0},{...ENEMY_BUBBLE,speed:0,damage});tick(0);};
  try{
   quiet();verify('actual courtyard has 600 seconds and native enemy Group32',battle.snapshot().durationSeconds===600&&a.enemies.maxSize===32,battle.snapshot().engine.groups);
   tick(150000);let first=elite('elite-1');verify('150s first elite has encounter and native birth',first&&battle.snapshot().level.encounters[0].spawnedAt===150,battle.snapshot().level);
   tick(1201);position(first,80,200);first.body.moves=false;tick(148799);tick(1201);let second=elite('elite-2');verify('300s second elite arrives with first still alive',first.active&&second&&a.enemies.countActive(true)===2,battle.snapshot().level);
   tick(148799);verify('450s Boss coexists with both undefeated elites',first.active&&second.active&&elite('boss-1')&&battle.snapshot().level.bossAt===450,battle.snapshot().level);
   quiet();tick(150000);tick(1201);first=elite('elite-1');hurt(80);verify('actual enemy projectile puts cat at 10 HP',battle.snapshot().hp===10,battle.snapshot().hp);
   a.growth.random=()=>.2;kill(first);for(const [id,type]of [[999,'E01'],[998,'E04'],[997,'E04']])a.pickups.drop(id,type,battle.snapshot().player);tick(0);
   let s=battle.snapshot(),o=s.progression.offer;verify('elite loot precedes same-frame XP without adding level',o.source==='elite'&&s.progression.level===2&&s.progression.pending===2,s.progression);
   const frozen=JSON.stringify(o);battle.pause('background');g.scene.processQueue();tick(30000);verify('background freezes candidates and effective time',JSON.stringify(battle.snapshot().progression.offer)===frozen&&battle.snapshot().elapsed===s.elapsed,battle.snapshot().progression);
   g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();verify('actual HEART confirmation precedes twenty-percent recovery',choose('L1_HEART')&&battle.snapshot().hp===46&&battle.snapshot().maxHp===105,battle.snapshot().progression);
   verify('duplicate click cannot heal or consume queued XP',!battle.confirmUpgrade(s.progression.runId,o.id,'L1_HEART')&&battle.snapshot().hp===46&&battle.snapshot().progression.offer.source==='experience',battle.snapshot().progression);
   verify('actual ledger records selected HEART and 21 recovered HP',battle.snapshot().progression.eliteRewards[0].recovered===21&&battle.snapshot().progression.eliteRewards[0].cardId==='L1_HEART',battle.snapshot().progression.eliteRewards);
   choose(battle.snapshot().progression.offer.choices[0]);quiet();tick(150000);tick(1201);first=elite('elite-1');tick(148799);tick(1201);second=elite('elite-2');kill(second);kill(first);tick(0);s=battle.snapshot();
   verify('reverse death order still opens elite-1 first',s.progression.offer.encounterId==='elite-1'&&s.progression.elitePending.length===2,s.progression);
   choose(s.progression.offer.choices[0]);verify('one confirmation claims one elite and opens next',battle.snapshot().progression.eliteRewards.length===1&&battle.snapshot().progression.offer.encounterId==='elite-2',battle.snapshot().progression);
   const old=battle.snapshot().progression.offer;start();verify('restart rejects old run confirmation and clears queue',!battle.confirmUpgrade(s.progression.runId,old.id,old.choices[0])&&battle.snapshot().progression.pending===0,battle.snapshot().progression);
   for(let i=0;i<20;i++){quiet();tick(150000);const e=elite('elite-1'),timer=e.getData('lifeTimer');start();tick(1300);verify('restart '+i+' clears arrival callback, reward and input',!e.active&&timer.callback===undefined&&battle.snapshot().progression.pending===0&&!battle.snapshot().moveHeld,battle.snapshot().level);}
   quiet();tick(150000);tick(1201);first=elite('elite-1');const oldBirth=first.getData('id');a.recycle(first,a.enemies);const reused=a.placeSliceEnemy('EL01',80,200),kills=battle.snapshot().kills;
   a.applyHitResult(reused,{targetId:oldBirth,targetKind:'enemy',source:'AREA',damage:1,killed:true,firstEnemyHit:false},'area',battle.snapshot().elapsed,{x:80,y:200},{x:80,y:200});
   verify('stale native birth callback cannot kill or reward reused Sprite',reused.active&&battle.snapshot().kills===kills&&battle.snapshot().progression.pending===0&&battle.snapshot().level.eliteDefeatedAt===null,battle.snapshot().level);
   for(const terminal of ['timeout','death','cleared']){quiet();tick(150000);tick(1201);first=elite('elite-1');
    if(terminal==='cleared'){tick(298799);tick(0);tick(1201);kill(elite('boss-1'));}
    kill(first);if(terminal==='death')hurt(1000);else if(terminal==='timeout')tick(448799);tick(0);s=battle.snapshot();verify('terminal '+terminal+' suppresses pending loot and healing',s.result===terminal&&s.progression.offer===null&&s.progression.pending===0,s.progression);}
   return {status:'PASS',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.fireVolley=fire;a.spawnCourtyardEnemy=spawn;a.trySpecialSpawn=trySpawn;start();}
 };
 w.runBossBoundaryChecks=async()=>{
  const checks:any[]=[],verify=(name:string,pass:any,value:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);},fire=a.fireVolley,trySpawn=a.trySpecialSpawn;
  try{start();a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};position(a.cat,360,1200);
   const owner=a.placeSliceEnemy('B01',360,200);owner.body.moves=false;const scatter=(origin:any,direction:any)=>{a.bossProjectileSlots.reserve(owner,1);return a.enemyBubble(origin,direction,BOSS_SCATTER,owner);};
   const timedBirth=a.enemyBubble({x:100,y:200},{x:0,y:0},ENEMY_BUBBLE),oldTimer=timedBirth.getData('lifeTimer');tick(1000);
   verify('E04 reused-slot fixture starts with a live real2.5s Timer',timedBirth.active&&oldTimer.delay===2500&&oldTimer.callback!==undefined,{source:timedBirth.getData('source'),lifeMode:timedBirth.getData('lifeMode'),timerDelay:oldTimer.delay,active:timedBirth.active,birthId:timedBirth.getData('id')});a.recycle(timedBirth,a.enemyProjectiles);
   const reusedBoss=scatter({x:100,y:200},{x:0,y:0});tick(2000);verify('same Sprite E04 to Boss reuse cancels old Timer and survives past old2.5s deadline',reusedBoss===timedBirth&&reusedBoss.active&&oldTimer.callback===undefined&&reusedBoss.getData('lifeTimer')===null&&reusedBoss.getData('lifeMode')==='world-boundary'&&reusedBoss.getData('source')==='B01',{same:reusedBoss===timedBirth,active:reusedBoss.active,oldCallback:typeof oldTimer.callback,lifeMode:reusedBoss.getData('lifeMode')});a.recycle(reusedBoss,a.enemyProjectiles);
   const reusedFlower=a.enemyBubble({x:100,y:200},{x:0,y:0},ENEMY_BUBBLE),newTimer=reusedFlower.getData('lifeTimer');verify('same Sprite Boss to E04 reuse restores a fresh2.5s Timer and timed source',reusedFlower===reusedBoss&&newTimer!==oldTimer&&newTimer.delay===2500&&reusedFlower.getData('source')==='E04'&&reusedFlower.getData('lifeMode')==='timed',{same:reusedFlower===reusedBoss,delay:newTimer.delay,source:reusedFlower.getData('source')});tick(2499);verify('reused E04 remains alive before its own fresh deadline',reusedFlower.active,reusedFlower.active);tick(2);verify('reused E04 expires once at its own fresh2.5s deadline',!reusedFlower.active&&reusedFlower.getData('lifeTimer')===null,reusedFlower.active);
   const shot=scatter({x:100,y:200},{x:0,y:1});tick(3000);verify('Boss scatter survives old 2.8s outside camera without lifetime Timer',shot.active&&shot.getData('lifeTimer')===null&&shot.getData('lifeMode')==='world-boundary'&&shot.body.center.y>500,{active:shot.active,y:shot.y});a.recycle(shot,a.enemyProjectiles);
   for(const [x,y,dx,dy]of [[1,200,-1,0],[719,200,1,0],[100,1,0,-1],[100,1439,0,1]]){const b=scatter({x,y},{x:dx,y:dy});tick(20);verify('native world edge '+dx+','+dy+' recycles scatter',!b.active,{x:b.x,y:b.y});}
   const ordinary=a.enemyBubble({x:100,y:200},{x:0,y:0},ENEMY_BUBBLE);tick(2499);verify('E04 bubble still lives until original 2.5s',ordinary.active&&ordinary.getData('lifeMode')==='timed',ordinary.active);tick(2);verify('E04 bubble expires at original deadline',!ordinary.active,ordinary.active);
   const hit=scatter(battle.snapshot().player,{x:0,y:0}),hp=battle.snapshot().hp;tick(0);tick(0);verify('scatter hit damages once and frees slot',battle.snapshot().hp===hp-12&&!hit.active,battle.snapshot().hp);
   const held=scatter({x:100,y:200},{x:0,y:1}),y=held.y;for(const reason of ['menu','background']){battle.pause(reason);g.scene.processQueue();tick(5000);verify(reason+' freezes long-flight body with no lifetime Timer',held.y===y&&held.getData('lifeTimer')===null,held.y);g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();}
   for(let i=0;i<20;i++){scatter({x:100,y:200},{x:0,y:1});start();verify('scatter restart '+i+' clears native slots and callbacks',battle.snapshot().enemyProjectiles.length===0&&battle.snapshot().engine.timers===0,battle.snapshot().engine);}
   return {status:'PASS',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.fireVolley=fire;a.trySpecialSpawn=trySpawn;start();}
 };
 w.runBossBoundaryDisposeChecks=async()=>{
  const checks:any[]=[],verify=(name:string,pass:any,value:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};
  try{start();a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   const owner=a.placeSliceEnemy('B01',100,200);owner.body.moves=false;a.bossProjectileSlots.reserve(owner,1);
   const long=a.enemyBubble({x:100,y:200},{x:0,y:0},BOSS_SCATTER,owner),ordinary=a.enemyBubble({x:100,y:300},{x:0,y:0},ENEMY_BUBBLE),timer=ordinary.getData('lifeTimer');
   verify('dispose fixture owns one untimed and one timed native enemy projectile',long.active&&ordinary.active&&long.getData('lifeTimer')===null&&timer.delay===2500,battle.snapshot().enemyProjectiles);
   battle.dispose();await new Promise(r=>setTimeout(r,20));verify('dispose clears both native projectile types and old timed callback',!long.active&&!ordinary.active&&timer.callback===undefined,{long:long.active,ordinary:ordinary.active,callback:typeof timer.callback});
   verify('disposed controller rejects stale reward confirmation',battle.confirmUpgrade(1,1,'L1_HEART')===false,true);return {status:'PASS',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}
 };
}
