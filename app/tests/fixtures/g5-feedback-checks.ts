import {createTraitFixture} from './projectile-traits-sample';
import {normalCourtyardRunConfig} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
import {createBattle} from '../../src/battle';
declare function require(path:string):any;
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{a,g,battle}=f;
 const wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 // Phaser 3.90 TweenManager reads wall time independently of Scene.update.
 // This fixture explicitly supplies a 60Hz test delta to that native manager;
 // normal preview and production browser checks keep the real native clock.
 a.tweens.getDelta=()=>1000/60;
 const step=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;g.scene.update(now,1000/60);g.scene.processQueue();}};
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const fireVolley=a.fireVolley,spawns=a.spawns.take,special=a.trySpecialSpawn;
 const start=(cat:CatId='CAT01',fx=true)=>{g.loop.wake=()=>{};battle.setPresentation({quality:'standard',f1Art:fx});try{battle.start(normalCourtyardRunConfig(f.config(cat)));}finally{g.loop.wake=wake;}g.loop.sleep();g.scene.processQueue();step();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);position(a.cat,360,720);};
 const target=(hp=1000,x=430)=>{const e=a.placeSliceEnemy('E01',x,720);e.setData('hp',hp);e.body.moves=false;return e;};
 const hit=(critical=false,source='PRIMARY',damage=12,e=target())=>{a.projectileRandom.frac=()=>critical?0:.99;a.projectile({x:360,y:720},0,'bell',source,111,damage,0,600,2);const shot=a.projectiles.getChildren().filter((s:any)=>s.active).at(-1);a.hit(shot,e,'overlap');return e;};
 w.runG5FeedbackChecks=()=>{const checks:any[]=[];const check=(name:string,fn:()=>unknown)=>{try{const value=fn();checks.push({name,pass:!!value});}catch(error){checks.push({name,pass:false,error:String(error)});}};
 for(const cat of ['CAT01','CAT02','CAT03'] as const)check(cat+' ordinary primary contact truthful source and 20u/160ms',()=>{start(cat);hit();const s=battle.snapshot().feedback as any;return s.hits===1&&s.contactDetails[0].kind===({CAT01:'bell',CAT02:'fish',CAT03:'bone'}[cat])&&s.contactDetails[0].size===20&&s.contactDetails[0].duration===160;});
 check('AREA and SUMMON are neutral contacts independent of cat',()=>{start();const e=target();a.abilityHit(e,5,'TEST');hit(false,'SUMMON',6);return (battle.snapshot().feedback as any).contactDetails.every((d:any)=>d.kind==='neutral');});
 check('actual critical is 22u gold exclamation and native scale 0.85 then peak then one',()=>{start();hit(true);let s=battle.snapshot().feedback as any;const n=s.numberDetails[0];if(!n.critical||n.text!=='18!'||n.fontSize!=='22px'||n.color!=='#f4c95d'||n.scale!==.85||s.contactDetails[0].size!==28)return false;step(3);s=battle.snapshot().feedback as any;if(s.numberDetails[0].scale<=1)return false;step(4);return Math.abs((battle.snapshot().feedback as any).numberDetails[0].scale-1)<.01;});
 check('critical native scale peak stays inside left world text bound',()=>{start();hit(true,'PRIMARY',12,target(1000,0));step(3);const n=battle.snapshot().feedback!.numberDetails.find(n=>n.critical)!;w.g5CriticalBounds=n;return n.x-n.width*n.scale/2>=0;});
 check('8 critical slots cannot be evicted by ordinary, player damage can evict critical',()=>{start();for(let i=0;i<8;i++)hit(true);hit();let s=battle.snapshot().feedback!;if(s.numbersActive!==8||s.numberDetails.some(n=>!n.critical))return false;a.feedback.damage({x:360,y:720},7,true);s=battle.snapshot().feedback!;return s.numbersActive===8&&s.numberDetails.filter(n=>n.player).length===1;});
 check('8 important critical contacts survive real critical kill death decoration',()=>{start();for(let i=0;i<8;i++)hit(true);const e=target(1);hit(true,'PRIMARY',12,e);const s=battle.snapshot().feedback as any;return !e.active&&s.allocated===8&&s.active===8&&s.contactDetails.length===8&&s.contactDetails.every((c:any)=>c.critical);});
 check('real incoming full absorb has no HP cue and true break has broken arcs',()=>{start();f.install({C13:1});const d=f.session!.defenseSnapshot();if(d.shield<=0)throw Error('shield fixture rank did not provide shield');a.incomingEnemyDamage(4);let s=battle.snapshot().feedback as any;if(s.hud.hurtEdgeAlpha!==0||s.shieldBreakVisible)return false;step(45);const fact=a.incomingEnemyDamage(100);s=battle.snapshot().feedback as any;return fact.accepted&&fact.shieldBroke&&fact.hpLost>0&&s.shieldBreakVisible&&s.hud.hurtEdgeAlpha>0&&s.hud.hpTrailRatio>f.session!.hp/f.session!.effectiveConfig.maxHp;});
 check('exact remaining shield break without HP loss has blue arcs only',()=>{start();f.install({C13:1});const hp=f.session!.hp,fact=a.incomingEnemyDamage(f.session!.defenseSnapshot().shield),s=battle.snapshot().feedback as any;return fact.accepted&&fact.shieldBroke&&fact.hpLost===0&&f.session!.hp===hp&&s.shieldBreakVisible&&s.hud.hurtEdgeAlpha===0&&!s.hurtVisible&&s.numberDetails.every((n:any)=>!n.player);});
 check('actual Arcade enemy contact generates exactly one player damage number',()=>{start();const e=target();position(e,360,720);step();const s=battle.snapshot();return s.hp<s.maxHp&&s.feedback!.numberDetails.filter(n=>n.player).length===1&&s.feedback!.hurts===1;});
 check('rejected zero damage creates no incoming cue',()=>{start();a.incomingEnemyDamage(0);const s=battle.snapshot().feedback as any;return s.hud.hurtEdgeAlpha===0&&!s.shieldBreakVisible&&!s.hurtVisible;});
 check('actual HP loss 160ms edge and 350ms trailing HP use native Tween',()=>{start();const fact=a.incomingEnemyDamage(10);const before=(battle.snapshot().feedback as any).hud;if(!fact.hpLost||before.hurtEdgeAlpha<=0||before.hpTrailRatio!==1)return false;step(11);let hud=(battle.snapshot().feedback as any).hud;if(hud.hurtEdgeAlpha!==0||hud.hpTrailRatio<=f.session!.hp/f.session!.effectiveConfig.maxHp)return false;step(13);hud=(battle.snapshot().feedback as any).hud;return Math.abs(hud.hpTrailRatio-f.session!.hp/f.session!.effectiveConfig.maxHp)<1e-6;});
 check('XP pulse comes only from actual collected orb, XP amount conserved',()=>{start();target();const before=battle.snapshot().progression!.totalXP;a.pickups.drop(801,'E01',{x:360,y:720});step(2);const s=battle.snapshot();return s.pickups!.collectedXP>0&&s.progression!.totalXP-before===s.pickups!.collectedXP&&(s.feedback as any).hud.xpPulse>0;});
 check('real confirmed HEART maxHP/heal cancels stale HP tail immediately',()=>{start();a.incomingEnemyDamage(10);a.growth.collect(8);step();const offer=a.growth.snapshot();a.growth.offer.choices=['L1_HEART'];const ok=battle.confirmUpgrade(offer.runId,offer.offer.id,'L1_HEART');g.loop.sleep();const s=battle.snapshot();return ok&&s.maxHp===105&&s.hp===95&&Math.abs((s.feedback as any).hud.hpTrailRatio-s.hp/s.maxHp)<1e-8;});
 check('real C21 sustain healing synchronizes tail with actual HP',()=>{start();f.install({C21:1});a.incomingEnemyDamage(10);hit();step();const s=battle.snapshot();return s.hp>80&&Math.abs((s.feedback as any).hud.hpTrailRatio-s.hp/s.maxHp)<1e-8;});
 check('pause freezes actual FX and resume completes remaining native time',()=>{start();hit(true);a.incomingEnemyDamage(10);step(2);battle.pause('menu');const before=JSON.stringify(battle.snapshot().feedback);step(60);if(JSON.stringify(battle.snapshot().feedback)!==before)return false;battle.resume();g.loop.sleep();step(40);const s=battle.snapshot().feedback as any;return !s.hurtVisible&&s.numbersActive===0&&s.hud.hurtEdgeAlpha===0;});
 check('low quality keeps all source critical and HP semantic cues',()=>{start('CAT02');battle.setPresentation({quality:'low'});hit(true);a.incomingEnemyDamage(10);const s=battle.snapshot().feedback as any;return s.quality==='low'&&s.numberDetails[0].critical&&s.contactDetails[0].kind==='fish'&&s.contactDetails[0].critical&&s.hud.hurtEdgeAlpha>0;});
 check('20 stop restart cycles bound native objects events and reset HP trail',()=>{let baseline:any;for(let i=0;i<20;i++){start();hit(true);a.incomingEnemyDamage(10);battle.reset();start();const s=battle.snapshot(),v=s.feedback as any;const counts={objects:a.children.length,timers:s.engine.timers,allocated:v.allocated,numbers:v.numbersAllocated};if(!baseline)baseline=counts;if(JSON.stringify(counts)!==JSON.stringify(baseline)||v.active||v.numbersActive||v.shieldBreakVisible||v.hud.hurtEdgeAlpha||v.hud.hpTrailRatio!==1)return false;}return true;});
 check('26 ordinary plus both special actors keep real native FX Groups bounded',()=>{start();const enemies=Array.from({length:26},(_,i)=>target(1000,200+i*10));for(const id of ['EL01','B01']){const e=a.placeSliceEnemy(id,360,500);e.setData('hp',100000);e.body.moves=false;enemies.push(e);}for(const e of enemies)hit(true,'PRIMARY',12,e);const s=battle.snapshot(),v=s.feedback as any;return s.engine.groups.enemies.active===28&&a.enemies.countActive(true)===28&&v.active===8&&v.numbersActive===8&&v.allocated===8&&v.numbersAllocated===8&&v.independentGraphics===2;});
 check('FX enabled/disabled actual rules match same controlled input and G5 spawns',()=>{const run=(fx:boolean)=>{start('CAT02',fx);f.install({C13:1});target(100,410);target(20,450);hit(true);a.incomingEnemyDamage(25);step(50);hit(false,'SUMMON',6);step(20);const s=battle.snapshot();return {hp:s.hp,shield:s.defense.shield,ammo:s.ammo,hits:[s.engine.overlapHits,s.engine.sweepHits],chill:s.enemyStatuses,kills:s.kills,xp:s.pickups,source:s.sourceCounts,shots:s.shots,spawn:s.spawnPressure,cat:s.engine.bodies.cat.radius,origin:s.player};};const on=run(true),off=run(false);return JSON.stringify(on)===JSON.stringify(off);});
 check('seeded 12s actual G5 spawns native bullets body and rules identical with FX on/off',()=>{
  const random=Math.random,run=(fx:boolean,cat:CatId)=>{let seed=5236;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
   for(const e of a.enemies.getChildren())e.body.moves=true;g.loop.wake=()=>{};battle.setPresentation({quality:'standard',f1Art:fx});battle.start(normalCourtyardRunConfig(f.config(cat)));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
   a.fireVolley=fireVolley;a.spawns.take=spawns;a.trySpecialSpawn=special;a.projectileRandom.sow(['g5-feedback-isolation']);step(720);
   const s=battle.snapshot();return {elapsed:s.elapsed,hp:s.hp,shield:s.defense.shield,ammo:s.ammo,hits:[s.engine.overlapHits,s.engine.sweepHits],chill:s.enemyStatuses,kills:s.kills,xp:s.pickups,source:s.sourceCounts,shots:s.shots,spawn:s.spawnPressure,first:s.firstEncounter,cat:s.engine.bodies.cat,targets:s.targets,traits:s.projectileTraits,origin:s.player};};
  try{const results:any={};for(const cat of ['CAT01','CAT02','CAT03'] as const){const on=run(true,cat),off=run(false,cat);results[cat]={on,off};if(!(on.shots>0&&on.hits[0]+on.hits[1]>0&&JSON.stringify(on)===JSON.stringify(off))){w.g5FeedbackIsolation=results;return false;}}w.g5FeedbackIsolation=results;return true;}finally{Math.random=random;}
 });
 return {status:checks.every(c=>c.pass)?'PASS':'FAIL',scope:'CONTROLLED_ACTUAL_BATTLE_SESSION_NATIVE_SCENE_NOT_NATURAL_BALANCE',checks};};
 w.g5FeedbackFixture={f,a,g,battle,start,step,hit,target,position};w.g5FeedbackReady=true;
 w.runG5FeedbackLifecycleChecks=async()=>{
  const checks:any[]=[],portraits:any={};
  for(const cat of ['CAT01','CAT02','CAT03'])portraits[cat]=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='./assets/ui/'+cat+'.png';});
  const factory=require('phaser/src/gameobjects/GameObjectFactory');
  for(let i=0;i<20;i++){
   const stage=document.createElement('div');stage.style.cssText='position:absolute;left:0;top:0;width:390px;height:844px';document.body.append(stage);
   const graphics=factory.prototype.graphics;let scene:any;
   factory.prototype.graphics=function(...args:any[]){scene=this.scene;return graphics.apply(this,args);};
   let controller:Awaited<ReturnType<typeof createBattle>>;
   try{controller=await createBattle(stage,{onState(){},onInterrupt(){},onFinish(){}},portraits);}finally{factory.prototype.graphics=graphics;}
   const game=scene.game,display=scene.children,tweens=scene.tweens,clock=scene.time,gameEvents=game.events,sceneEvents=scene.sys.events;
   controller.start(normalCourtyardRunConfig(f.config(i%2?'CAT02':'CAT01')));
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   scene.feedback.damage({x:360,y:720},18,false,undefined,true);scene.incomingEnemyDamage(10);scene.feedback.collectXP(2);
   controller.pause('menu');controller.setPresentation({quality:'low'});controller.resume();
   const destroyed=new Promise<void>(resolve=>game.events.once('destroy',()=>resolve()));
   controller.dispose();await destroyed;
   const value={displayObjects:display.length,tweens:tweens.getTweens().length,timers:clock._active.length+clock._pendingInsertion.length,postrender:gameEvents.listenerCount('postrender'),postupdate:sceneEvents.listenerCount('postupdate'),canvases:stage.querySelectorAll('canvas').length};
   const pass=Object.values(value).every(n=>n===0);checks.push({name:'dispose'+i+' native teardown clears visuals callbacks and canvas',pass,value});stage.remove();
   if(!pass)break;
  }
  return {status:checks.length===20&&checks.every(c=>c.pass)?'PASS':'FAIL',scope:'20_FRESH_ACTUAL_BATTLE_NATIVE_GAME_DISPOSE_CYCLES',checks};
 };
}
void boot().catch(e=>w.g5FeedbackBootError=String(e));
