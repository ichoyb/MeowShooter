// Controlled admission fixture reuses the existing actual Arena/Phaser host.
// Only ranks, targets and input times are controlled; Group, Clock, hit/death,
// pickups, reward transactions and restart remain production implementations.
import {createTraitFixture} from '../tests/fixtures/projectile-traits-sample';
import {normalCourtyardRunConfig} from '../src/level-config';
import {makeRunConfig,type CatId} from '../src/combat-config';
import {projectileCapacityForGrowth} from '../src/progression-capacity';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{battle,a,g}=f,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0,pressure=false;
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const step=(count=1,dt=1000/60)=>{for(let n=0;n<count;n++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const start=(cat:CatId='CAT01',ranks:any={},automatic=false)=>{g.loop.wake=()=>{};battle.start(normalCourtyardRunConfig(makeRunConfig(cat,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic')));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];f.install(ranks);(f.session as any).cooldown=automatic?0:999;position(a.cat,360,600);attempts={PRIMARY:0,SECONDARY:0,SUMMON:0};};
 const target=(x=500,y=600,hp=1e12)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);e.body.moves=false;return e;};
 const choose=(id:string)=>{const s=battle.snapshot().progression!;g.loop.wake=()=>{};const ok=battle.confirmUpgrade(s.runId,s.offer!.id,id);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();return ok;};
 const emit=a.projectile;let attempts={PRIMARY:0,SECONDARY:0,SUMMON:0};
 a.projectile=function(...args:any[]){const source=args[3] as keyof typeof attempts;attempts[source]++;const id=a.nextProjectile,ok=emit.apply(a,args),p=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===id);if(p&&pressure){p.body.moves=false;position(p,650,100);}return ok;};
 w.runG4bAdmission=(cases:any[])=>{const checks:any[]=[];const check=(name:string,pass:any,detail?:any)=>{checks.push({name,status:pass?'Pass':'Fail',detail:detail===undefined?undefined:JSON.parse(JSON.stringify(detail))});if(!pass)throw Error(name);};try{
  pressure=true;
  for(const c of cases)for(const mode of ['20Hz','30Hz','irregular']){
   start(c.cat,c.before,true);target();a.abilities.state.onVolley=()=>!!a.growth.snapshot().ranks.L1_PICKUP_CHIME;
   const deltas=mode==='20Hz'?[50]:mode==='30Hz'?[1000/30]:[50,17,8,41,1000/30,23];let peak=0,transitions=0,oldActive=0,pendingBefore=0,shortestNewLife=Infinity,oldestLife=0,latestCapacity=24;
   const beforeLife=f.session!.effectiveConfig.weapon.bulletLifeSeconds;
   for(let n=0;n<1500;n++){
    if(c.after&&transitions===0&&f.session!.elapsed>=8&&(a.rhythmTimers.size>0||!c.before.C23)){
     oldActive=a.projectiles.countActive(true);pendingBefore=a.rhythmTimers.size;oldestLife=Math.max(0,...a.projectiles.getChildren().filter((p:any)=>p.active).map((p:any)=>p.getData('flightLife')));f.install(c.after);shortestNewLife=f.session!.effectiveConfig.weapon.bulletLifeSeconds;transitions++;
    }
    step(1,deltas[n%deltas.length]);const active=a.projectiles.countActive(true),ranks=a.growth.snapshot().ranks,expected=projectileCapacityForGrowth(f.session!.runConfig,f.session!.effectiveConfig,ranks);latestCapacity=a.projectiles.maxSize;peak=Math.max(peak,active);if(active>expected)throw Error(c.id+' occupancy exceeds current proof '+active+'/'+expected);
   }
   const s=battle.snapshot();check(c.cat+' '+c.id+' '+mode+' native full-life source admission',s.projectileDiagnostics.failedSpawns===0&&JSON.stringify(attempts)===JSON.stringify(s.sourceCounts)&&s.shots>20&&s.reloadCompletions>2&&peak<=latestCapacity,{scope:'CONTROLLED_LEGAL_BUDGET_FULL_LIFETIME_PRESSURE_NOT_NATURAL_GROWTH_OR_PHONE',ranksBefore:c.before,ranksAfter:c.after??null,budgetBefore:Object.values(c.before).reduce((s:any,v:any)=>s+v,0),budgetAfter:c.after?Object.values(c.after).reduce((s:any,v:any)=>s+v,0):null,peak,capacity:latestCapacity,attempts,sourceCounts:s.sourceCounts,roots:s.shots,reloads:s.reloadCompletions,hotStartEnabled:s.hotStartEnabled,returns:s.projectileFlight.returns,rhythm:s.rhythm,elapsed:s.elapsed,beforeLife,shortestNewLife,oldestLife,oldActive,pendingBefore});
   if(c.after)check(c.cat+' '+c.id+' '+mode+' old shots and frozen delayed intents survive speed change',transitions===1&&oldActive>0&&shortestNewLife<beforeLife&&(!c.before.C23||pendingBefore>0),{transitions,oldActive,pendingBefore,beforeLife,shortestNewLife,oldestLife});
   if(c.before.C23)check(c.cat+' '+c.id+' '+mode+' native rhythm actually emitted',s.rhythm.emitted>0,s.rhythm);
   if(c.cat==='CAT03')check(c.cat+' '+c.id+' '+mode+' native spirit shares same Group',s.sourceCounts.SUMMON>0,s.sourceCounts);
  }
  pressure=false;
  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[]){
   start(cat);const initial=battle.snapshot();check(cat+' actual normal config startsA28 with exact normal identity',initial.progression!.rulesVersion==='courtyard-growth-flight-hunt-v12'&&initial.progression!.xpTarget===28&&initial.progression!.attributePlan==='A'&&initial.progression!.totalXP===0&&initial.projectileFlight.enabled&&initial.projectileTraits.enabled,{config:f.session!.runConfig,progression:initial.progression});
   const receipts:any[]=[];
   for(const [index,time] of [150,300].entries()){
    (f.session as any).elapsed=time;f.session!.hp=20;const e=a.enterSpecial('EL01',{x:100,y:100});if(!e)throw Error('elite spawn');step(80);check(cat+' elite'+index+' native arrival finishes',e.body.enable,{phase:e.getData('behavior').phase});
    const birth=e.getData('id'),encounter=e.getData('encounterId');a.abilityHit(e,10000,'admission');a.abilityHit(e,10000,'admission-duplicate');
    // Four real ordinary deaths produce8XP in native pickup Group; first
    // checkpoint opens XP and elite simultaneously. No direct growth.collect.
    if(index===0)for(let n=0;n<4;n++){const enemy=target(360,600,1);a.abilityHit(enemy,10,'admission');a.abilityHit(enemy,10,'admission-duplicate');}
    step();let s=battle.snapshot(),offer=s.progression!.offer!;check(cat+' elite'+index+' actual death queues one elite receipt',offer.source==='elite'&&!a.growth.queueElite(encounter,birth),{offer,level:s.level,progression:s.progression,pickups:s.pickups});
    if(index===0)check(cat+' same-frame real8XP plus elite stay independent',s.progression!.totalXP===8&&s.progression!.level===2&&s.progression!.pending===2&&s.pickups!.collectedXP===8&&s.pickups!.droppedXP===8,s.progression);
    const frozen={elapsed:s.elapsed,offer:s.progression!.offer,hp:s.hp,ranks:s.progression!.ranks};step(120);s=battle.snapshot();check(cat+' elite'+index+' selection freezes Clock offer and reward',s.elapsed===frozen.elapsed&&s.hp===frozen.hp&&JSON.stringify(s.progression!.offer)===JSON.stringify(frozen.offer)&&JSON.stringify(s.progression!.ranks)===JSON.stringify(frozen.ranks),frozen);
    battle.pause('background');step(90);check(cat+' background with pending selection refuses confirmation',!battle.confirmUpgrade(s.progression!.runId,offer.id,offer.choices[0])&&battle.snapshot().progression!.eliteRewards.length===index);battle.resume();g.loop.sleep();g.scene.processQueue();
    check(cat+' elite'+index+' actual confirm commits once and heals',choose(offer.choices[0])&&battle.snapshot().progression!.eliteRewards.length===index+1&&f.session!.hp>20,battle.snapshot().progression);
    check(cat+' elite'+index+' stale duplicate confirmation refused',!battle.confirmUpgrade(s.progression!.runId,offer.id,offer.choices[0]));receipts.push(battle.snapshot().progression!.eliteRewards.at(-1));
    while(battle.snapshot().progression!.offer){const o=battle.snapshot().progression!.offer!;if(!choose(o.choices[0]))throw Error('XP confirmation');}
   }
   check(cat+' both actual elites plus realXP preserve level and one receipt each',battle.snapshot().progression!.level===2&&battle.snapshot().progression!.totalXP===8&&receipts.length===2&&new Set(receipts.map(r=>r.birthId)).size===2,{receipts,progression:battle.snapshot().progression});
  }
  const lifecycle:any[]=[];
  for(let n=0;n<20;n++){
   pressure=true;start(n%2?'CAT03':'CAT01',{L1_PIERCE:1,M05:1,E23:1,M12:1,C18:1,M26:1,C23:1,M31:1,L1_SPLIT:1,E21:1,L1_ECHO:1,L1_LIGHT_MAG:1,L1_RATE:4},true);target();
   for(let i=0;i<1000&&(f.session!.reloadCompletions<1||a.rhythmTimers.size===0||a.hunt.snapshot().targetId===null);i++)step();
   const before=battle.snapshot(),shots=a.projectiles.getChildren().filter((p:any)=>p.active),timers=shots.flatMap((p:any)=>[p.getData('lifeTimer'),p.getData('flightTimer')]).filter(Boolean),ledgers=shots.map((p:any)=>p.getData('returnHitIds')).filter(Boolean);
   check('restart'+n+' setup has real hot reload return bodies mark and pending rhythm',before.reloadCompletions>0&&before.hotStartEnabled&&shots.some((p:any)=>p.getData('returnEnabled'))&&before.huntingMark.targetId!==null&&before.rhythm.pending>0,{reloads:before.reloadCompletions,hot:before.hotStartRemaining,flight:before.projectileFlight,hunt:before.huntingMark,rhythm:before.rhythm});
   start();step();const after=battle.snapshot();check('restart'+n+' clears old native callbacks ledgers growth hot and marks',after.projectiles===0&&after.progression!.totalXP===0&&after.progression!.eliteRewards.length===0&&!after.hotStartEnabled&&after.hotStartRemaining===0&&!after.huntingMark.enabled&&after.huntingMark.targetId===null&&after.rhythm.pending===0&&timers.every((t:any)=>t.callback===undefined)&&ledgers.every((x:any)=>x.size===0),{timersDestroyed:timers.length,ledgersCleared:ledgers.length,engine:after.engine,bells:after.bellModifiers});lifecycle.push({timers:after.engine.timers,objects:after.engine,refs:after.bellModifiers});
  }
  const firstGroups=JSON.stringify(lifecycle[0].objects.groups);check('twenty restarts have stable native Group allocation and zero residual Clock or volley references',lifecycle.every(row=>row.timers===0&&row.refs.activeVolleys===0&&JSON.stringify(row.objects.groups)===firstGroups),{runs:lifecycle.length,groups:lifecycle[0].objects.groups,timers:lifecycle.map(row=>row.timers),references:lifecycle.map(row=>row.refs.activeVolleys)});
  pressure=false;battle.dispose();return {status:'PASS',checks,lifecycle,scope:'Actual normal-config Arena with controlled legal ranks, stationary full-lifetime pressure and controlled special spawn times. Real hits/pickups/receipts; no natural or phone-performance claim.'};
 }catch(error){return {status:'FAIL',error:String(error),stack:(error as Error).stack,checks};}};
 w.g4bAdmissionReady=true;
}
void boot().catch(error=>w.g4bAdmissionBootError=String(error));
