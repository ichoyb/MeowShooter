import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{battle,a,g}=f,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0,sequence=100;
 const hits:any[]=[],apply=a.applyHitResult;a.applyHitResult=function(target:any,result:any,...rest:any[]){hits.push({...result});return apply.call(a,target,result,...rest);};
 const step=(frames=1,dt=1000/60)=>{for(let i=0;i<frames;i++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 const start=(ranks:Partial<GrowthRanks>={},cat:CatId='CAT01',enabled=true)=>{
  g.loop.wake=()=>{};battle.start({...f.config(cat),projectileFlight:{enabled:true},...(enabled?{huntTargeting:{enabled:true}}:{})} as any);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();
  a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];a.growth.collect=()=>{};a.growth.queueElite=()=>false;f.install(ranks);
  (f.session as any).cooldown=999;position(a.cat,360,600);a.projectileRandom.frac=()=>.99;hits.length=0;
 };
 const target=(x:number,y=600,hp=100000)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);e.body.moves=false;return e;};
 const state=()=> (battle.snapshot() as any).huntingMark;
 const near=(a:number,b:number,epsilon=.04)=>Math.abs(a-b)<epsilon;
 const fire=(source='PRIMARY')=>{const c=f.session!.effectiveConfig,id=++sequence;a.projectile({x:360,y:600},0,c.weaponId==='W04'?'fish':c.weaponId==='W02'?'bone':'bell',source,id,c.weapon.damage*c.directDamageMultiplier,source==='PRIMARY'?c.weapon.extraPierce:0,c.weapon.bulletSpeed,c.weapon.bulletLifeSeconds);return a.projectiles.getChildren().find((s:any)=>s.active&&s.getData('volleyId')===id);};
 w.runHuntChecks=()=>{const checks:any[]=[];const check=(name:string,pass:any,value?:any)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  start({C18:1} as any);const close=target(390,600,40),large=target(500,650,300);step();
  check('native Clock starts one4second mark on highest currentHP',state()?.enabled&&state().targetId===large.getData('id')&&near(state().remainingSeconds,4),state());
  (f.session as any).cooldown=0;step();check('actual automatic primary prioritizes marked highHP over closer enemy',battle.snapshot().locked===large.getData('id'),battle.snapshot().locked);
  (f.session as any).cooldown=999;close.setData('hp',1000);step(60);check('one window does not keep switching after HP changes',state().targetId===large.getData('id'),state());
  position(large,650,650);(f.session as any).cooldown=0;step();check('marked enemy outside range falls back to the nearby enemy',battle.snapshot().locked===close.getData('id')&&state().targetId===large.getData('id'),{locked:battle.snapshot().locked,mark:state()});
  position(large,500,650);(f.session as any).cooldown=0;step();check('returning inside range restores priority within same window',battle.snapshot().locked===large.getData('id'));
  (f.session as any).cooldown=999;step(180);check('next periodic window chooses highest currentHP afresh',state().targetId===close.getData('id')&&state().windows===2,state());

  start({C18:1,M26:1} as any);const marked=target(550,600,1000),recipient=target(640,600,500),nearby=target(390,600,100);step();step(90);const before=state();a.abilityHit(marked,2000,'fixture');const transferred=state();
  check('real marked death transfers once from death position, preserving remainder',transferred.targetId===recipient.getData('id')&&transferred.transferred&&transferred.transfers===1&&near(transferred.remainingSeconds,before.remainingSeconds)&&transferred.remainingSeconds<3,{before,transferred});
  (f.session as any).cooldown=0;step();check('transfer outside player range never causes overrange fire',battle.snapshot().locked===nearby.getData('id'));
  const third=target(630,630,900);a.abilityHit(recipient,2000,'fixture');check('second marked death cannot chain another transfer',state().targetId===null&&state().transfers===1,state());
  check('one actual death fact per target',battle.snapshot().kills===2&&third.active);

  start({C18:1} as any);step();const empty=state();step(60);const late=target(480,600,500);step();check('empty window consumes its interval without accumulating acquisition',state().targetId===null&&state().windows===1,{empty,current:state()});step(180);check('late target can be marked by next scheduled window',state().targetId===late.getData('id')&&state().windows===2,state());
  battle.pause('background');const frozen=state(),elapsed=battle.snapshot().elapsed;step(180);check('native pause freezes mark remainder, selection and effective time',near(state().remainingSeconds,frozen.remainingSeconds,1e-8)&&state().windows===frozen.windows&&battle.snapshot().elapsed===elapsed,state());battle.resume();g.loop.sleep();step(2);check('explicit resume does not replay paused windows',state().windows===frozen.windows&&state().remainingSeconds<frozen.remainingSeconds,state());

  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[]){
   start({C18:1,L1_SHOCK_BELL:1} as any,cat);const enemy=target(460,600,10000);step();const c=f.session!.effectiveConfig,damage=c.weapon.damage*c.directDamageMultiplier;
   const primary=fire();a.hit(primary,enemy,'overlap');check(cat+' actual primary mark damage is15percent and intrinsic base stays clean',near(hits[0].damage,damage*1.15,1e-7)&&near(hits[0].nonCriticalDamage,damage,1e-7),hits[0]);
   for(const source of ['SECONDARY','SUMMON']){const shot=fire(source),before=enemy.getData('hp');a.hit(shot,enemy,'overlap');check(cat+' '+source+' gets no independent mark bonus',near(before-enemy.getData('hp'),damage,1e-7));}
  }

  start({C18:1,L1_SHOCK_BELL:1} as any);const shockMain=target(460,600,1000),shockSide=target(475,600,500);step();
  const shockShot=fire(),sideHP=shockSide.getData('hp');a.hit(shockShot,shockMain,'overlap');
  const direct=hits.find(h=>h.source==='PRIMARY'),area=hits.find(h=>h.source==='AREA');
  check('real shock inherits marked actual direct damage once, with no second15percent',direct&&area&&near(area.damage,direct.damage*.35,1e-7)&&near(sideHP-shockSide.getData('hp'),direct.damage*.35,1e-7),{direct,area});

  start({C18:1} as any);const expiryOld=target(460,600,1000),expiryNew=target(500,650,500);step();step(210);const oldShot=fire();oldShot.body.moves=false;
  expiryOld.setData('hp',200);expiryNew.setData('hp',2000);step(31);hits.length=0;
  check('window expiry rolls target before an already flying primary resolves',state().targetId===expiryNew.getData('id'),state());
  a.hit(oldShot,expiryOld,'overlap');check('old projectile cannot retain an expired mark damage snapshot',near(hits[0]?.damage,12,1e-7)&&hits[0]?.targetMultiplier===1,hits[0]);

  start({C18:1} as any);const dead=target(470,600,500);step();const oldId=dead.getData('id');a.abilityHit(dead,1000,'fixture');const reused=target(470,600,1000);step();check('pooled body new birth never inherits old mark',state().targetId===null&&reused.getData('id')!==oldId,{oldId,newId:reused.getData('id'),state:state()});
  for(let i=0;i<20;i++){start({C18:1,M26:1} as any);target(480);step();const timer=a.hunt?.timer;start();step();check('restart'+i+' clears old target and TimerEvent callback',state().targetId===null&&state().remainingSeconds===0&&state().windows===0&&(!timer||timer.callback===undefined),state());}
  start({C18:1} as any);target(480);step();f.session!.damage(999);step();check('terminal death clears targeting window and visible mark',!!battle.snapshot().result&&state().targetId===null&&state().remainingSeconds===0,state());
  start({C18:1,M26:1} as any,'CAT01',false);const nearest=target(390,600,100),far=target(500,650,1000);(f.session as any).cooldown=0;step();check('normal profile ignores forged pilot ranks and preserves near-target behavior',!state().enabled&&battle.snapshot().locked===nearest.getData('id')&&state().targetId===null,{locked:battle.snapshot().locked,far:far.getData('id'),mark:state()});
  start({C18:1,M26:1} as any);target(480);step();const beforeDispose=a.hunt,disposeTimer=beforeDispose.timer;battle.dispose();
  check('actual controller dispose clears its mark reference and native timer callback before engine destruction',beforeDispose.snapshot().targetId===null&&beforeDispose.snapshot().remainingSeconds===0&&disposeTimer.callback===undefined,beforeDispose.snapshot());
  return {status:'PASS',checks,scope:'CONTROLLED_ACTUAL_ARENA_NOT_NATURAL_GROWTH_OR_PHONE'};
 }catch(error){return {status:'FAIL',checks,error:String(error),scope:'CONTROLLED_ACTUAL_ARENA_NOT_NATURAL_GROWTH_OR_PHONE'};}};
 w.huntChecksReady=true;
}
void boot().catch(error=>w.huntChecksBootError=String(error));
