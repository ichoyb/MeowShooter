import {createBattle} from '../../src/battle';
import {COMBAT_SLICE,COURTYARD_LEVEL} from '../../src/level-config';
import {makeRunConfig} from '../../src/combat-config';
declare function require(path:string):any;
const w=window as any,out=document.getElementById('result')!,stage=document.getElementById('stage')!;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function boot(){
 const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('assets/ui/'+id+'.png')));
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),original=factory.prototype.graphics;
 factory.prototype.graphics=function(...args:any[]){w.sliceArena=this.scene;return original.apply(this,args);};
 let battle:Awaited<ReturnType<typeof createBattle>>;
 try{battle=await createBattle(stage,{onState(){},onInterrupt:r=>battle.pause(r),onFinish(){}},{CAT01,CAT02,CAT03});}
 finally{factory.prototype.graphics=original;}
 const a=w.sliceArena,g=a.game,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const checks:any[]=[];
 const check=(name:string,condition:unknown,actual:unknown)=>{checks.push({name,pass:!!condition,actual:JSON.parse(JSON.stringify(actual))});if(!condition)throw Error(name);};
 const tick=(ms:number)=>{now+=ms;g.scene.update(now,ms);};
 const step=(frames=1)=>{for(let i=0;i<frames;i++)tick(1000/60);};
 const start=(cat='CAT01')=>{g.loop.wake=()=>{};battle.start(makeRunConfig(cat as any,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic'));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 w.sliceFixture={a,battle,g,step,tick,start,position,checks,check};
 w.runE02CommitChecks=()=>{try{
  start();const hopper=a.placeSliceEnemy('E02',430,720);hopper.setData('hp',10000);step();
  const state=hopper.getData('behavior'),locked={...state.direction},deadline=state.until;
  check('E02 commits direction at the readable warning start',state.phase==='warning'&&locked.x<-.99&&Math.abs(locked.y)<.001,state);
  position(a.cat,360,810);step(20);
  check('sidestepping during warning cannot turn its risk band',state.phase==='warning'&&Math.abs(state.direction.x-locked.x)<1e-8&&Math.abs(state.direction.y-locked.y)<1e-8,{locked,state});
  battle.pause('menu');g.scene.processQueue();const paused=JSON.stringify({elapsed:battle.snapshot().elapsed,state});step(30);
  check('committed warning pauses without progressing',JSON.stringify({elapsed:battle.snapshot().elapsed,state})===paused,paused);
  g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
  position(hopper,100,720);step();
  check('moving outside visible risk area does not cancel a committed warning',!a.readableAttack(hopper,locked)&&state.phase==='warning'&&state.until===deadline,state);
  while(battle.snapshot().elapsed<deadline+.01)step();
  check('committed E02 executes original direction and speed',state.phase==='dash'&&Math.abs(hopper.body.velocity.x-locked.x*220)<.001&&Math.abs(hopper.body.velocity.y-locked.y*220)<.001,{state,velocity:{x:hopper.body.velocity.x,y:hopper.body.velocity.y}});
  step(34);check('committed dash still enters recovery',state.phase==='recover',state);
  return {status:'PASS',scope:'CONTROLLED_PHASER_SCENE_NOT_NATURAL_PLAY',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runNoAimLineChecks=()=>{try{
  start();const enemy=a.placeSliceEnemy('E01',430,720);enemy.setData('hp',10000);
  const old=a.guide.lineBetween;let lines=0;a.guide.lineBetween=function(...args:any[]){lines++;return old.apply(this,args);};
  try{step(3);}finally{a.guide.lineBetween=old;}
  const s=battle.snapshot();check('real automatic volley and projectile still occur',s.shots===1&&s.projectiles>0,{shots:s.shots,projectiles:s.projectiles});
  check('player targeting Graphics draws no trajectory guide',lines===0,{lineCalls:lines,remainingTargetMarkerCommands:a.guide.commandBuffer.length});
  check('enemy risk warning still renders',(()=>{const h=a.placeSliceEnemy('E02',430,760);h.setData('hp',10000);step();return h.getData('behavior').phase==='warning'&&a.warning.commandBuffer.length>0;})(),a.warning.commandBuffer.length);
  return {status:'PASS',scope:'CONTROLLED_PHASER_SCENE_NOT_NATURAL_PLAY',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runSliceChecks=()=>{try{
  start();const s=battle.snapshot();
  check('30u approved layered cat, unchanged physical center',s.presentation?.bodyDisplay.width===30&&s.player.x===360&&s.player.y===720,s.presentation);
  check('new slice has no startup targets or crates',s.enemies===0&&s.engine.groups.objects.active===0,s.engine.groups);
  check('same preserved 12u contact baseline, awaiting calibration',s.engine.bodies.cat.radius===12,s.engine.bodies.cat);
  for(const radius of [8,10,12]){
   start();const body=a.cat.body;body.setCircle(radius/Math.abs(a.cat.scaleX)*(1+Number.EPSILON));
   body.setOffset(a.cat.width/2-body.halfWidth/Math.abs(a.cat.scaleX),a.cat.height/2-body.halfHeight/Math.abs(a.cat.scaleY));position(a.cat,360,720);
   const enemy=a.placeSliceEnemy('E01',360+radius+12,720);a.physics.world.update(now,0);const hits=a.physics.overlapCirc(body.center.x,body.center.y,body.halfWidth,true,false);
   check('inclusive calibrated tangent '+radius,hits.includes(enemy.body),{radius:body.halfWidth,center:{x:body.center.x,y:body.center.y},enemyCenter:{x:enemy.body.center.x,y:enemy.body.center.y}});
   position(enemy,360+radius+12+.1,720);a.physics.world.update(now,0);check('separated calibrated circle '+radius,!a.physics.overlapCirc(body.center.x,body.center.y,body.halfWidth,true,false).includes(enemy.body),radius);
  }
  start();const follower=a.placeSliceEnemy('E01',430,720);const x=follower.x;step(10);
  check('E01 follows with native Body without moving visual float into physics',follower.x<x&&follower.body.halfWidth===12&&follower.getData('hp')<=48,{x:follower.x,radius:follower.body.halfWidth,art:follower.getData('art').snapshot()});
  start();a.placeSliceEnemy('E01',384,720);step();const firstHp=battle.snapshot().hp;step(20);
  check('E01 contact deals 8 once within shared .7s protection',firstHp===82&&battle.snapshot().hp===82,battle.snapshot().hp);
  start();const hopper=a.placeSliceEnemy('E02',430,720);hopper.setData('hp',10000);step();
  check('E02 starts a readable .9s warning',hopper.getData('behavior').phase==='warning',hopper.getData('behavior'));
  const phaseUntil=hopper.getData('behavior').until;step(30);
  check('E02 does not dash early',hopper.getData('behavior').phase==='warning',hopper.getData('behavior'));
  battle.pause('menu');g.scene.processQueue();const paused=JSON.stringify({time:battle.snapshot().elapsed,state:hopper.getData('behavior'),art:hopper.getData('art').snapshot()});step(60);
  check('pause freezes effective time, warning and native tweens',JSON.stringify({time:battle.snapshot().elapsed,state:hopper.getData('behavior'),art:hopper.getData('art').snapshot()})===paused,paused);
  g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
  while(battle.snapshot().elapsed<phaseUntil+.01)step();const locked={...hopper.getData('behavior').direction};
  check('E02 enters a real locked-direction dash',hopper.getData('behavior').phase==='dash',hopper.getData('behavior'));
  position(a.cat,500,740);step(3);check('player changing side cannot steer a running dash',JSON.stringify(hopper.getData('behavior').direction)===JSON.stringify(locked),hopper.getData('behavior'));
  step(34);check('dash ends in native recovery',hopper.getData('behavior').phase==='recover',hopper.getData('behavior'));
  start();const cap=a.children.length;for(let i=0;i<8;i++)a.placeSliceEnemy(i===7?'E02':'E01',80+i*60,700);
  step();const filled=a.children.length;for(let i=0;i<20;i++){start();for(let j=0;j<8;j++)a.placeSliceEnemy(j===7?'E02':'E01',80+j*60,700);step();}
  check('20 restarts reuse native groups and presentation nodes',a.children.length===filled&&battle.snapshot().projectiles<=24,{before:cap,warm:filled,after:a.children.length,groups:battle.snapshot().engine.groups});
  start('CAT02');check('CAT02 retains previous P2 display and configuration',a.cat.displayWidth===58&&battle.snapshot().catId==='CAT02'&&battle.snapshot().contentId==='p2-basic',battle.snapshot().catId);
  start('CAT03');check('CAT03 retains previous P2 display and configuration',a.cat.displayWidth===58&&battle.snapshot().catId==='CAT03',battle.snapshot().catId);
  start();const fast=a.placeSliceEnemy('E02',310,720);fast.setData('hp',10000);Object.assign(fast.getData('behavior'),{phase:'dash',until:1,direction:{x:1,y:0},nextAttack:4.5});
  tick(500);
  check('long-frame crossing dash cannot tunnel through player',battle.snapshot().hp===78,{hp:battle.snapshot().hp,x:fast.body.center.x,player:battle.snapshot().player});
  start();for(let i=0;i<8;i++)a.placeSliceEnemy('E01',80+i*60,700);step();start('CAT02');start();for(let i=0;i<8;i++)a.placeSliceEnemy('E01',80+i*60,700);step();
  const sharedWarm=a.children.length;
  for(let i=0;i<20;i++){start('CAT02');start();for(let j=0;j<8;j++)a.placeSliceEnemy('E01',80+j*60,700);step();}
  check('alternating legacy and new content preserves pooled presentation ownership',a.children.length===sharedWarm,{warm:sharedWarm,after:a.children.length});
  start();const edge=a.placeSliceEnemy('E02',430,720);edge.setData('hp',10000);step();
  position(edge,10,720);step();check('committed warning outside readable viewport stays committed',edge.getData('behavior').phase==='warning',edge.getData('behavior'));
  start();const nearMiss=a.placeSliceEnemy('E02',310,745);Object.assign(nearMiss.getData('behavior'),{phase:'dash',until:1,direction:{x:1,y:0},nextAttack:4.5});tick(500);
  check('path supplement does not widen the 24u combined radius',battle.snapshot().hp===90,{hp:battle.snapshot().hp,enemy:nearMiss.body.center});
  start();const hazard=a.placeSliceEnemy('E01',360,720);hazard.setData('hp',100000);
  for(let f=0;f<1200&&!battle.snapshot().result;f++)step();
  check('controlled genuine contact reaches death exactly once',battle.snapshot().result==='death'&&battle.snapshot().hp===0,{elapsed:battle.snapshot().elapsed,hp:battle.snapshot().hp,result:battle.snapshot().result});
  start();for(let f=0;f<COURTYARD_LEVEL.duration*60+1000&&!battle.snapshot().result;f++){
   const growth=battle.snapshot().progression,offer=growth?.offer;
   if(offer){g.loop.wake=()=>{};battle.confirmUpgrade(growth.runId,offer.id,offer.choices[0]);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();continue;}
   const direction=Math.floor(f/120)%4;
   a.keys.D.isDown=direction===0;a.keys.S.isDown=direction===1;a.keys.A.isDown=direction===2;a.keys.W.isDown=direction===3;step();
  }
  check('controlled complete-level native movement reaches coherent actual result',!!battle.snapshot().result&&battle.snapshot().elapsed<=COURTYARD_LEVEL.duration,{elapsed:battle.snapshot().elapsed,hp:battle.snapshot().hp,result:battle.snapshot().result,kills:battle.snapshot().kills,shots:battle.snapshot().shots});
  out.textContent=JSON.stringify({status:'PASS',checks});return {status:'PASS',checks};
 }catch(error){out.textContent=JSON.stringify({status:'FAIL',error:String(error),checks});return {status:'FAIL',error:String(error),checks};}};
 out.textContent='READY';
}
boot().catch(error=>{out.textContent=String(error);});
