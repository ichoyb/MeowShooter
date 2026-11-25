import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{battle,a,g}=f,wake=g.loop.wake.bind(g.loop);
 g.loop.sleep();let now=0,pressure=false,seq=100;const hits:any[]=[];
 const apply=a.applyHitResult;a.applyHitResult=function(target:any,result:any,...rest:any[]){hits.push({...result});return apply.call(a,target,result,...rest);};
 const emitter=a.projectile;a.projectile=function(...args:any[]){const id=a.nextProjectile,result=emitter.apply(a,args);const shot=a.projectiles.getChildren().find((s:any)=>s.active&&s.getData('projectileId')===id);if(shot){shot.body.moves=!pressure;if(pressure)position(shot,650,100);}return result;};
 const step=(frames=1,dt=1000/60)=>{for(let i=0;i<frames;i++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 const start=(ranks:Partial<GrowthRanks>={},cat:CatId='CAT01',automatic=false)=>{
  g.loop.wake=()=>{};battle.start({...f.config(cat),projectileFlight:{enabled:true}});g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();
  a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.growth.collect=()=>{};a.growth.queueElite=()=>false;f.install(ranks);
  (f.session as any).cooldown=automatic?0:999;a.projectileRandom.frac=()=>.99;position(a.cat,360,600);hits.length=0;
 };
 const target=(x:number,y=600,hp=100000)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);e.body.moves=false;return e;};
 const shoot=(source='PRIMARY',origin={x:360,y:600})=>{const c=f.session!.effectiveConfig,id=++seq;a.projectile(origin,0,c.weaponId==='W04'?'fish':c.weaponId==='W02'?'bone':'bell',source,id,c.weapon.damage*c.directDamageMultiplier,source==='PRIMARY'?c.weapon.extraPierce:0,c.weapon.bulletSpeed,c.weapon.bulletLifeSeconds);return a.projectiles.getChildren().find((s:any)=>s.active&&s.getData('volleyId')===id);};
 const until=(predicate:()=>boolean,limit=300)=>{for(let i=0;i<limit&&!predicate();i++)step();if(!predicate())throw Error('condition timeout');};
 const near=(x:number,y:number)=>Math.abs(x-y)<1e-7;
 w.runFlightChecks=()=>{const checks:any[]=[];const check=(name:string,ok:any,value?:any)=>{checks.push({name,pass:!!ok,value});if(!ok)throw Error(name);};
  try{
   start({M05:1});const shot=shoot();
   check('actual M05 Scene creates one outbound projectile with native hard lifetime',shot&&shot.getData('flightPhase')==='outbound'&&shot.getData('returnEnabled')&&shot.getData('lifeTimer').delay===2400);
   start({A15:100},'CAT03');const fastTarget=target(410,600,100);shoot();step(1,50);
   check('short A15 lifetime crossing at20Hz damages before native expiry instead of vanishing',near(fastTarget.getData('hp'),92),{hp:fastTarget.getData('hp'),hits});
   start({A15:300},'CAT03');const farSecondary=target(700,600,100);a.time.delayedCall(1,()=>shoot('SECONDARY'));step(1,50);
   check('Clock-born short secondary cannot gain a free-frame extension beyond frozen straight distance',near(farSecondary.getData('hp'),100),{hp:farSecondary.getData('hp'),hits});
   start({M05:1});const old=target(460,600,100);const back=shoot(),before=battle.snapshot();until(()=>back.getData('flightPhase')==='return');
   check('actual hit begins return early without recycling or re-hitting old birth',back.active&&near(old.getData('hp'),88)&&back.getData('hitIds').has(old.getData('id')));
   position(a.cat,360,680);check('return heading stays on fixed launch line after player moves',near(back.body.velocity.y,0)&&back.body.velocity.x<0);
   const fresh=target(400,600,100);until(()=>!back.active);
   check('return damages one fresh target at70percent and credits no second root',near(fresh.getData('hp'),91.6)&&near(old.getData('hp'),88)&&battle.snapshot().shots===before.shots&&battle.snapshot().ammo===before.ammo&&battle.snapshot().projectileTraits.rolls===before.projectileTraits.rolls,{oldHP:old.getData('hp'),freshHP:fresh.getData('hp'),flight:battle.snapshot().projectileFlight});
   start({M05:1});const empty=shoot();until(()=>empty.getData('flightPhase')==='return');const at={x:empty.body.center.x,y:empty.body.center.y};const noTargetBefore=battle.snapshot();until(()=>!empty.active);
   check('no-hit outbound reaches range and comes home without random direction or a new projectile',Math.abs(at.x-600)<11&&near(at.y,600)&&battle.snapshot().sourceCounts.PRIMARY===noTargetBefore.sourceCounts.PRIMARY,{turn:at,flight:battle.snapshot().projectileFlight});
   for(const enhanced of [false,true]){start(enhanced?{M05:1,M09:1}:{M05:1},'CAT02');const targets=[430,490,550].map(x=>target(x,600,100));const s=shoot();until(()=>s.getData('flightPhase')==='return');const expected=enhanced?[28.8,24.48,20.808]:[28.8,20.16,14.112];
    check('native fish per-target attenuation '+(enhanced?'85':'70'),targets.every((e,i)=>near(100-e.getData('hp'),expected[i])),targets.map(e=>100-e.getData('hp')));
    const credit=battle.snapshot().passiveState.chillCredit;until(()=>!s.active);check('fish return keeps all old hits and chill credit once '+enhanced,targets.every((e,i)=>near(100-e.getData('hp'),expected[i]))&&battle.snapshot().passiveState.chillCredit===credit);
   }
   start({M05:1,L1_PIERCE:1,L1_RICOCHET:1});target(440);target(500);target(550,650);const ricochet=shoot();until(()=>ricochet.getData('flightPhase')==='return');
   check('one native ricochet finishes before return and keeps intrinsic60percent factor',ricochet.getData('ricocheted')&&near(ricochet.getData('returnDamage'),3.528),{damage:ricochet.getData('returnDamage'),hits});
   const p={x:ricochet.body.center.x,y:ricochet.body.center.y},newEnemy=target((p.x+360)/2,(p.y+600)/2,100);until(()=>!ricochet.active);check('ricochet-return never multiplies critical or attenuates twice',near(newEnemy.getData('hp'),96.472));
   start({M05:1,L1_RICOCHET:1});target(460);const noBounce=shoot();until(()=>noBounce.getData('flightPhase')==='return');check('no legal ricochet target falls back to same-body return',noBounce.active&&!noBounce.getData('ricocheted'));
   start({M05:1,L1_RICOCHET:1});target(600);target(650,650);const sameFrameBounce=shoot();step(8,50);
   check('range deadline in the ricochet impact frame never grants an extra outbound frame',sameFrameBounce.getData('flightPhase')==='return'&&sameFrameBounce.getData('ricocheted'),{phase:sameFrameBounce.getData('flightPhase'),turnDue:sameFrameBounce.getData('flightTurnDue')});
   start({M05:1});const frozen=shoot();f.install({M05:1,A15:10,L1_PIERCE:1,M09:1});const newer=shoot();check('A15 M09 preserve old launch shape while new shots read new effective parameters',frozen.getData('flightSpeed')===620&&frozen.getData('pierceDamageMultiplier')===.7&&frozen.getData('lifeTimer').delay===2400&&newer.getData('flightSpeed')===1240&&newer.getData('pierceDamageMultiplier')===.85&&newer.getData('lifeTimer').delay===1200);
   const secondary=shoot('SECONDARY');check('nonprimary lifetime and critical decisions do not gain return',!secondary.getData('returnEnabled')&&secondary.getData('flightPhase')===null&&secondary.getData('extraPierce')===0&&!secondary.getData('critical')&&secondary.getData('lifeTimer').delay===600);
   start({M05:1,L1_RICOCHET:1});target(574);target(620,650);const lateTurn=shoot();step(7,50);
   const beforeTurn={x:lateTurn.body.center.x,y:lateTurn.body.center.y},outTimer=lateTurn.getData('flightTimer'),remaining=outTimer.delay-outTimer.elapsed,v={x:lateTurn.body.velocity.x,y:lateTurn.body.velocity.y};
   check('ricochet occurs in the frame before range timer expiry',lateTurn.getData('ricocheted')&&lateTurn.getData('flightPhase')==='outbound'&&remaining>0&&remaining<50);
   step(1,50);check('native timer elapsed is retained even when the preceding hit turned the path',near(lateTurn.body.center.x,beforeTurn.x+v.x*remaining/1000)&&near(lateTurn.body.center.y,beforeTurn.y+v.y*remaining/1000),{remaining,actual:{x:lateTurn.body.center.x,y:lateTurn.body.center.y},expected:{x:beforeTurn.x+v.x*remaining/1000,y:beforeTurn.y+v.y*remaining/1000}});
   start({M05:1});const closeReturn=shoot();position(closeReturn,391,600);a.beginReturn(closeReturn,{x:363,y:600});
   check('near-origin impact retires at the actual clipped turn instead of stopping at an overshot endpoint',!closeReturn.active);
   start({M05:1,A15:300},'CAT03');const expired=shoot();step(1,50);
   check('outbound turn and hard expiry in one20Hz frame do not grant a later return hit',!expired.active,{active:expired.active,phase:expired.getData('flightPhase'),life:expired.getData('flightLife')});
   for(const reason of ['death','timeout','boss']){start({M05:1});const pending=shoot(),lifeTimer=pending.getData('lifeTimer'),flightTimer=pending.getData('flightTimer');
    if(reason==='death')f.session!.damage(100000);else if(reason==='timeout')(f.session as any).elapsed=599.99;else f.session!.completeBoss();step(1,50);
    check('terminal '+reason+' clears player flight origin ledger native timers and volley reference',!!battle.snapshot().result&&!pending.active&&pending.getData('flightOrigin')===null&&pending.getData('hitIds').size===0&&pending.getData('bellVolley')===null&&pending.getData('lifeTimer')===null&&pending.getData('flightTimer')===null&&lifeTimer.callback===undefined&&flightTimer.callback===undefined,{result:battle.snapshot().result,active:pending.active,origin:pending.getData('flightOrigin')});
   }
   start();const legacy=shoot();f.install({M05:1});check('selecting return never retrofits a flying old primary',!legacy.getData('returnEnabled')&&legacy.getData('lifeTimer').delay===1200);
   start({M05:1});const waiting=shoot();step(5);battle.pause('background');const paused=battle.snapshot(),x=waiting.x;step(90);check('background freezes flight timers and native position',waiting.x===x&&battle.snapshot().elapsed===paused.elapsed&&waiting.getData('flightPhase')==='outbound');battle.resume();g.loop.sleep();step(2);check('explicit resume waits remaining outbound budget',waiting.getData('flightPhase')==='outbound');until(()=>!waiting.active);check('resumed return settles exactly once',battle.snapshot().projectileFlight.returns===1);
   for(let i=0;i<20;i++){start({M05:1});shoot();start();step(90);const s=battle.snapshot();check('restart'+i+' clears native timers flight phase and stale hits',s.projectileFlight.returns===0&&s.projectileFlight.returnHits===0&&s.projectileFlight.outbound===0&&s.projectileFlight.returning===0&&s.projectiles===0&&s.projectileDiagnostics.failedSpawns===0);}
   pressure=true;
   for(const hz of [20,30])for(const cat of ['CAT01','CAT02','CAT03'] as const){
    const oldRanks={M05:1,L1_PIERCE:1,M09:1,C23:1,M31:1,E21:1,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,L1_RATE:12,L1_RANGE:12};
    start(oldRanks,cat,true);target(360,460);a.abilities.state.onVolley=()=>true;
    const deltas=[1000/hz,17,50,8,41];let peak=0;for(let i=0;i<250;i++){step(1,deltas[i%5]);peak=Math.max(peak,a.projectiles.countActive(true));}
    const oldActive=a.projectiles.countActive(true);f.install({...oldRanks,A15:11});
    for(let i=0;i<900;i++){step(1,deltas[i%5]);peak=Math.max(peak,a.projectiles.countActive(true));}
    const s=battle.snapshot();check(hz+'Hz '+cat+' old long life and new short life preserve all real native emissions',oldActive>0&&s.shots>12&&s.projectileDiagnostics.failedSpawns===0&&peak<=s.projectileDiagnostics.capacity,{oldActive,peak,diagnostics:s.projectileDiagnostics,shots:s.shots,fixture:'HOLD_NATIVE_BODIES_AWAY_FROM_ORIGIN_UNTIL_CLOCK_EXPIRY'});
   }
   pressure=false;start({M05:1});shoot();const timer=a.projectiles.getChildren().find((s:any)=>s.active).getData('flightTimer');battle.dispose();check('dispose cancels native outbound callback and old projectile',timer.callback===undefined);
   return {status:'PASS',scope:'ACTUAL_SCENE_CONTROLLED_NOT_NATURAL',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}
 };
 w.flightChecksReady=true;
}
void boot().catch(error=>w.flightChecksBootError=String(error));
