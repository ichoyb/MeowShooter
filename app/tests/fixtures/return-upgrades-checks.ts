import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{battle,a,g}=f,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0,seq=500,pressure=false;
 const hits:any[]=[],apply=a.applyHitResult;a.applyHitResult=function(t:any,h:any,...r:any[]){hits.push({...h});return apply.call(a,t,h,...r);};
 const emit=a.projectile;a.projectile=function(...args:any[]){const id=a.nextProjectile,ok=emit.apply(a,args),p=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===id);if(p&&pressure){p.body.moves=false;position(p,650,100);}return ok;};
 const step=(frames=1,dt=1000/60)=>{for(let i=0;i<frames;i++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const start=(ranks:Partial<GrowthRanks>={},cat:CatId='CAT01',automatic=false,enabled=true)=>{
  g.loop.wake=()=>{};battle.start({...f.config(cat),...(enabled?{projectileFlight:{enabled:true as const},huntTargeting:{enabled:true as const}}:{})});g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();
  a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];a.growth.collect=()=>{};a.growth.queueElite=()=>false;f.install(ranks);(f.session as any).cooldown=automatic?0:999;
  a.projectileRandom.frac=()=>.99;position(a.cat,360,600);hits.length=0;
 };
 const target=(x:number,y=600,hp=100000)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);e.body.moves=false;return e;};
 const shoot=()=>{const c=f.session!.effectiveConfig,id=++seq;a.projectile({x:360,y:600},0,c.weaponId==='W04'?'fish':c.weaponId==='W02'?'bone':'bell','PRIMARY',id,c.weapon.damage*c.directDamageMultiplier,c.weapon.extraPierce,c.weapon.bulletSpeed,c.weapon.bulletLifeSeconds);return a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('volleyId')===id);};
 const until=(fn:()=>boolean,max=1200)=>{for(let n=0;n<max&&!fn();n++)step();if(!fn())throw Error('condition timeout');};
 const near=(x:number,y:number,e=1e-7)=>Math.abs(x-y)<e;
 w.runReturnUpgradesChecks=()=>{const checks:any[]=[];const check=(name:string,ok:any,value?:any)=>{checks.push({name,pass:!!ok,value});if(!ok)throw Error(name);};try{
  start({M05:1,L1_PIERCE:1,E23:1});const one=target(430,600,1000),two=target(500,600,1000),s=shoot();until(()=>!s.active);
  check('actual mirror Body damages outbound old enemies exactly once per leg with12/8.4 then5.88/4.116',hits.length===4&&[12,8.4,5.88,4.116].every((d,i)=>near(hits[i].damage,d))&&near(one.getData('hp'),983.884)&&near(two.getData('hp'),985.72),hits);
  check('same projectile returns without new root, ammo use or critical roll',battle.snapshot().sourceCounts.PRIMARY===1&&battle.snapshot().shots===0&&battle.snapshot().ammo===12&&battle.snapshot().projectileTraits.rolls===1&&hits.filter(h=>h.firstEnemyHit).length===1,battle.snapshot().projectileFlight);
  for(const boosted of [false,true]){
   start({M05:1,L1_PIERCE:1,E23:1,...(boosted?{M09:1}:{})},'CAT02');const enemies=[416,459,502,545].map(x=>target(x,600,10000)),p=shoot();until(()=>!p.active);const factor=boosted?.85:.7,base=28.8,expected=[0,1,2,3].map(i=>base*factor**i);expected.push(...[0,1,2,3].map(i=>base*factor**3*.7*factor**i));
   check('native fish mirror four outbound plus four return targets '+factor,hits.length===8&&expected.every((d,i)=>near(hits[i].damage,d))&&new Set(hits.map(h=>h.targetId)).size===4,hits.map(h=>h.damage));
   check('fish cold credit occurs once per actual primary, not on mirror second leg '+factor,near(battle.snapshot().passiveState.chillCredit,4/(1.2*1))&&hits.filter(h=>h.firstEnemyHit).length===1,battle.snapshot().passiveState);
  }
  start({M05:1,E23:1},'CAT02');[430,490,550].forEach(x=>target(x));const forged=shoot();check('native fish piercing never replaces purchased core at projectile birth',!forged.getData('mirrorReturn'));until(()=>!forged.active);check('forged mirror without purchased core keeps original one-way ledger',hits.length===3,hits);
  start({M05:1,L1_PIERCE:1,E23:1,L1_SHOCK_BELL:1},'CAT02');const emptyOut=shoot();until(()=>emptyOut.getData('flightPhase')==='return');target(520);target(460);until(()=>!emptyOut.active);
  check('empty outbound allows the first real return enemy hit to credit cold and one shock, without duplicate credit',hits.filter(h=>h.source==='PRIMARY').length===2&&hits.filter(h=>h.firstEnemyHit).length===1&&near(battle.snapshot().passiveState.chillCredit,4/1.2)&&a.bells.snapshot().shocks===1,{hits,passive:battle.snapshot().passiveState,bells:a.bells.snapshot()});
  start({M05:1,L1_PIERCE:1});const old=shoot();f.install({M05:1,L1_PIERCE:1,E23:1});const newer=shoot();check('selecting mirror never retrofits an old flying projectile',!old.getData('mirrorReturn')&&old.getData('returnAllowance')===1&&newer.getData('mirrorReturn')&&newer.getData('returnAllowance')===2);
  f.install({M05:1,L1_PIERCE:1,L1_EVO_PIERCE:1,E23:1});const expanded=shoot();check('existing mirror freezes its birth target allowance after further piercing growth',newer.getData('returnAllowance')===2&&expanded.getData('returnAllowance')===3);
  start({M05:1,L1_PIERCE:1,E23:1,C18:1});const marked=target(430,600,1000);target(500,600,800);step();a.projectileRandom.frac=()=>0;const critical=shoot(),rolls=battle.snapshot().projectileTraits.rolls;until(()=>!critical.active);
  check('actual critical and current mark apply once per mirror hit without contaminating base',hits.length===4&&[12*1.5*1.15,8.4*1.5,5.88*1.5,4.116*1.5*1.15].every((d,i)=>near(hits[i].damage,d))&&battle.snapshot().projectileTraits.rolls===rolls,hits);
  start({M05:1,L1_PIERCE:1,E23:1,L1_RICOCHET:1});[440,500].forEach(x=>target(x));target(550,650);const bounce=shoot();until(()=>bounce.getData('flightPhase')==='return');check('completed outbound ricochet retains60percent intrinsic base but not extra return allowance',bounce.getData('ricocheted')&&near(bounce.getData('returnDamage'),3.528)&&bounce.getData('returnAllowance')===2,{returnDamage:bounce.getData('returnDamage'),allowance:bounce.getData('returnAllowance')});until(()=>!bounce.active);check('return never bounces again',a.bells.snapshot().bounces===1,a.bells.snapshot());

  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[]){
   start({M12:1},cat,true);target(500,600,1e9);const times:{at:number;reloads:number;remaining:number}[]=[];let last=0,pausedHot=false;
   for(let i=0;i<1800&&times.length<f.session!.effectiveConfig.weapon.ammoCapacity+4;i++){step();const snap=battle.snapshot();if(snap.shots!==last){last=snap.shots;times.push({at:snap.elapsed,reloads:snap.reloadCompletions,remaining:snap.hotStartRemaining});}
    if(!pausedHot&&snap.reloadCompletions===1&&snap.hotStartRemaining===1){battle.pause('background');step(60);const frozen=battle.snapshot();check(cat+'actual pending hot charge and cooldown freeze in background',frozen.elapsed===snap.elapsed&&frozen.hotStartRemaining===1&&frozen.cooldown===snap.cooldown,{before:{elapsed:snap.elapsed,cooldown:snap.cooldown},after:{elapsed:frozen.elapsed,cooldown:frozen.cooldown}});battle.resume();g.loop.sleep();pausedHot=true;}
   }
   const c=f.session!.effectiveConfig,idx=times.findIndex(t=>t.reloads===1),first=times[idx],second=times[idx+1],third=times[idx+2],fourth=times[idx+3];
   check(cat+' native real reload before first hot root, then exactly two shorter following waits',idx===c.weapon.ammoCapacity&&first&&second&&third&&fourth&&first.at-times[idx-1].at>=c.weapon.reloadSeconds-.02&&near(second.at-first.at,c.weapon.intervalSeconds*.75,.025)&&near(third.at-second.at,c.weapon.intervalSeconds*.75,.025)&&near(fourth.at-third.at,c.weapon.intervalSeconds,.025),{weapon:c.weaponId,times});
   check(cat+' native roots consume hot allowance once regardless pellet count',[first.remaining,second.remaining,third.remaining].join(',')==='1,0,0'&&battle.snapshot().sourceCounts.PRIMARY===battle.snapshot().shots*c.weapon.pellets,{times:times.slice(idx),sourceCounts:battle.snapshot().sourceCounts});
  }
  start({M12:1},'CAT01',true);until(()=>f.session!.elapsed>1);check('native empty target cannot spend or grant a hot opening',battle.snapshot().shots===0&&battle.snapshot().hotStartRemaining===0);
  for(let i=0;i<20;i++){
   start({M05:1,L1_PIERCE:1,E23:1,M12:1});const p=shoot(),life=p.getData('lifeTimer'),flight=p.getData('flightTimer'),ledger=p.getData('returnHitIds');ledger.add(999);start();step();
   check('restart'+i+' clears native timers both ledgers mirror flag and hot state',!p.active&&p.getData('returnHitIds')===null&&ledger.size===0&&!p.getData('mirrorReturn')&&life.callback===undefined&&flight.callback===undefined&&battle.snapshot().hotStartRemaining===0&&!battle.snapshot().hotStartEnabled);
  }
  start({M05:1,L1_PIERCE:1,E23:1,M12:1});const frozen=shoot();step(8);battle.pause('background');const x=frozen.x,t=frozen.getData('lifeTimer').elapsed;step(120);check('native background freezes mirror Body and Clock',frozen.x===x&&frozen.getData('lifeTimer').elapsed===t&&battle.snapshot().engine.paused);battle.resume();g.loop.sleep();step(2);check('explicit continue resumes remaining native window',frozen.x!==x&&frozen.getData('lifeTimer').elapsed>t);
  pressure=true;
  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[])for(const hz of [20,30]){
   const ranks={M05:1,L1_PIERCE:1,L1_EVO_PIERCE:1,E23:1,M12:1,C23:1,M31:1,E21:1,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,L1_RATE:16,L1_RANGE:14,L1_RELOAD:8};
   start(ranks,cat,true);target(360,460,1e12);a.abilities.state.onVolley=()=>true;let peak=0;const deltas=[1000/hz,17,50,8,41];for(let n=0;n<260;n++){step(1,deltas[n%5]);peak=Math.max(peak,a.projectiles.countActive(true));}const oldActive=a.projectiles.countActive(true);f.install({...ranks,A15:11});for(let n=0;n<750;n++){step(1,deltas[n%5]);peak=Math.max(peak,a.projectiles.countActive(true));}
   const snap=battle.snapshot();check(cat+' '+hz+'Hz mixed frames keep hot, mirrors, old long shots and new short shots within native Group',oldActive>0&&snap.shots>25&&snap.reloadCompletions>2&&snap.projectileDiagnostics.failedSpawns===0&&peak<=snap.projectileDiagnostics.capacity,{scope:'CONTROLLED_CAPACITY_PRESSURE_NOT_NATURAL_RANKS_OR_PHONE_PERFORMANCE',oldActive,peak,shots:snap.shots,reloads:snap.reloadCompletions,diagnostics:snap.projectileDiagnostics});
  }
  pressure=false;start({M05:1,L1_PIERCE:1,E23:1,M12:1});const ending=shoot(),endingTimer=ending.getData('lifeTimer');f.session!.damage(999);step();check('real terminal clears mirror and heat before result',!!battle.snapshot().result&&!ending.active&&ending.getData('returnHitIds')===null&&!battle.snapshot().hotStartEnabled&&battle.snapshot().hotStartRemaining===0&&endingTimer.callback===undefined);
  start({M05:1,L1_PIERCE:1,E23:1,M12:1});const disposed=shoot(),disposeTimer=disposed.getData('flightTimer');battle.dispose();check('actual controller disposal destroys mirror callbacks',disposeTimer.callback===undefined);
  return {status:'PASS',scope:'CONTROLLED_ACTUAL_ARENA_NOT_NATURAL_GROWTH_OR_PHONE',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.returnUpgradesChecksReady=true;
}
void boot().catch(error=>w.returnUpgradesChecksBootError=String(error));
