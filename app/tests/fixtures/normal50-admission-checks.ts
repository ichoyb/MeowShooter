// P4 actual normal50 Arena. Fixed RNG, fixture drops, special-spawn times,
// ranks/targets and manual Scene steps are controlled, never natural/FPS data.
import {createTraitFixture} from './projectile-traits-sample';
import {makeRunConfig,type CatId} from '../../src/combat-config';
import {normalCourtyardRunConfig,ENEMY_BUBBLE} from '../../src/level-config';
import {NORMAL_GROWTH_RULES_VERSION,growthCards,growthCardEligible,growthNumbers,companionFrequency,type GrowthId} from '../../src/progression';
import {projectileCapacityForGrowth} from '../../src/progression-capacity';
const w=window as any;
const rng=(seed:number)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let x=Math.imul(seed^seed>>>15,1|seed);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{a,g,battle}=f,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0,pressure=false;
 const s=()=>battle.snapshot() as any,near=(x:number,y:number,e=1e-6)=>Math.abs(x-y)<e;
 const position=(o:any,x:number,y:number)=>{o.body.reset(x,y);o.body.updateFromGameObject();o.body.prev.copy(o.body.position);o.body.prevFrame.copy(o.body.position);};
 const park=(o:any,x=o.body.center.x,y=o.body.center.y)=>{o.setData('normal50QaPark',{x,y});o.setVelocity(0,0);position(o,x,y);};
 const nativeUpdate=a.physics.world.update;
 a.physics.world.update=function(...args:any[]){for(const group of [a.enemies,a.projectiles])for(const o of group.getChildren())if(o.active&&o.getData('normal50QaPark')){const p=o.getData('normal50QaPark');o.setVelocity(0,0);position(o,p.x,p.y);}return nativeUpdate.apply(this,args);};
 const step=(count=1,dt=50)=>{for(let n=0;n<count;n++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const move=(x=0,y=0)=>{a.keys.A.isDown=x<0;a.keys.D.isDown=x>0;a.keys.W.isDown=y<0;a.keys.S.isDown=y>0;};
 let attempts:any={PRIMARY:0,SECONDARY:0,SUMMON:0},emissions:any[]=[];
 const emit=a.projectile;
 a.projectile=function(...args:any[]){attempts[args[3]]++;const id=a.nextProjectile,ok=emit.apply(a,args),p=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===id);if(p){if(pressure)park(p,650,100);emissions.push({id,source:args[3],damage:args[5],effect:args[9],at:f.session!.elapsed});if(emissions.length>200)emissions.shift();}return ok;};
 const install=(ranks:any)=>{f.install(ranks);a.areas.ensure(a.growth.snapshot().ranks);a.sentries.ensure(a.growth.snapshot().ranks);a.passives.setSpiritFrequency(companionFrequency(a.growth.snapshot().ranks),f.session!.elapsed);};
 const start=(cat:CatId='CAT01',ranks:any={},automatic=false)=>{g.loop.wake=()=>{};battle.start(normalCourtyardRunConfig(makeRunConfig(cat,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic')));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];if(Object.keys(ranks).length)install(ranks);(f.session as any).cooldown=automatic?0:999;position(a.cat,360,600);attempts={PRIMARY:0,SECONDARY:0,SUMMON:0};emissions=[];};
 const target=(x=500,y=600,hp=1e6)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);park(e,x,y);return e;};
 const until=(predicate:()=>boolean,max=800)=>{for(let n=0;n<max&&!predicate();n++)step();if(!predicate())throw Error('P4 timeout '+JSON.stringify({elapsed:s().elapsed,sentry:s().sentry,sustain:s().sustain,rhythm:s().rhythm}));};
 const choose=(offer:any,id:string)=>{g.loop.wake=()=>{};const ok=battle.confirmUpgrade(s().progression.runId,offer.id,id);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();return ok;};
 const resume=()=>{g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();};
 const bubble=(damage=5)=>{a.enemyBubble({...a.cat.body.center},{x:0,y:1},{...ENEMY_BUBBLE,damage});step();};
 const root=()=>{if(f.session!.reloadLeft>0)until(()=>f.session!.reloadLeft===0);(f.session as any).cooldown=0;step();(f.session as any).cooldown=999;return a.projectiles.getChildren().filter((p:any)=>p.active&&p.getData('volleyId')===s().shots);};
 const middle=(ps:any[])=>ps.filter(p=>p.getData('source')==='PRIMARY').sort((x,y)=>Math.abs(x.rotation)-Math.abs(y.rotation))[0];
 const clearFriendly=()=>{for(const p of a.projectiles.getChildren())if(p.active)a.recycle(p,a.projectiles);};
 w.runNormal50Admission=(inputs:any,part:string)=>{const checks:any[]=[];const check=(name:string,pass:any,detail?:any)=>{checks.push({name,status:pass?'Pass':'Fail',detail:detail===undefined?undefined:JSON.parse(JSON.stringify(detail))});if(!pass)throw Error(name);};try{
 if(part==='witnesses'){
  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[]){start(cat);const z=s(),base=f.session!.runConfig;check(cat+' real zero-rank normal50 start has exact v18 identity and no free new rewards',z.progression.rulesVersion===NORMAL_GROWTH_RULES_VERSION&&growthCards(base).length===50&&z.progression.confirmedPicks===0&&z.progression.totalXP===0&&Object.values(z.progression.ranks).every(v=>v===0)&&z.hp===base.maxHp&&z.defense.maxShield===0&&!z.sustain.lifeCircuitOwned&&!z.sustain.reloadShieldOwned&&z.sustain.hpRecoveredTotal===0&&z.sustain.shieldRecoveredTotal===0&&z.contracts.stance===1&&z.sentry.timers===0&&z.catDisplay.width===36&&z.engine.bodies.cat.radius===12&&z.durationSeconds===600,{config:base,progression:z.progression,sustain:z.sustain});}
  for(const plan of inputs.witnesses){
   start(plan.cat);a.growth.random=rng(plan.seed);let expectedXP=0,xpId=100000,eliteIndex=0;const eliteReceipts:any[]=[];
   for(const [index,pick] of plan.steps.entries()){
    let elite:any=null,birth:number|undefined,encounter:string|undefined;
    if(pick.source==='experience'){for(let n=0;n<pick.amount/2;n++)a.pickups.drop(xpId++,'E01',{...a.cat.body.center});expectedXP+=pick.amount;step();}
    else {
     (f.session as any).elapsed=[150,300][eliteIndex++];elite=a.enterSpecial('EL01',{x:500,y:600});if(!elite)throw Error('P4 elite fixture spawn');step(26);birth=elite.getData('id');encounter=elite.getData('encounterId');
     check(plan.cat+'/'+plan.pair+' elite '+eliteIndex+' actual native arrival enables born body',elite.body.enable&&!elite.getData('entering'),{birth,encounter,phase:elite.getData('behavior').phase});park(elite);elite.setData('hp',1);const kills=s().kills;a.abilityHit(elite,1,'P4_ELITE_CONTROLLED_LETHAL');a.abilityHit(elite,1,'P4_DUPLICATE');step();
     check(plan.cat+'/'+plan.pair+' elite '+eliteIndex+' real death queues unique receipt',s().kills===kills+1&&!a.growth.queueElite(encounter,birth),{birth,encounter,kills:s().kills,offer:s().progression.offer});
    }
    const before=s(),o=before.progression.offer;
    check(plan.cat+'/'+plan.pair+' pick'+index+' native XP/elite opens exact pure-rule witness offer',!!o&&o.id===pick.offer.id&&o.source===pick.source&&JSON.stringify(o.choices)===JSON.stringify(pick.offer.choices)&&before.progression.confirmedPicks===index&&before.progression.totalXP===expectedXP,{seed:plan.seed,pick,actual:o,pickups:before.pickups});
    check(plan.cat+'/'+plan.pair+' pick'+index+' candidate qualifications use actual confirmed history',o.choices.every((id:any)=>growthCardEligible(id,before.progression.ranks,f.session!.runConfig,index))&&(index>=4||!o.choices.some((id:string)=>/^R0[4-7]$/.test(id))),{confirmed:index,choices:o.choices});
    const frozen=JSON.stringify({offer:o,ranks:before.progression.ranks,elapsed:before.elapsed,sustain:before.sustain,contracts:before.contracts,pickups:before.pickups});step(7);
    check(plan.cat+'/'+plan.pair+' pick'+index+' upgrade freezes offer quotas and stationary time',frozen===JSON.stringify({offer:s().progression.offer,ranks:s().progression.ranks,elapsed:s().elapsed,sustain:s().sustain,contracts:s().contracts,pickups:s().pickups}));
    const notOffered=growthCards(f.session!.runConfig).find(c=>!o.choices.includes(c.id))!.id;
    check(plan.cat+'/'+plan.pair+' pick'+index+' failed confirmation grants no rank or recovery',!battle.confirmUpgrade(before.progression.runId,o.id,notOffered)&&JSON.stringify(s().progression.ranks)===JSON.stringify(before.progression.ranks)&&s().hp===before.hp&&s().sustain.shieldRecoveredTotal===before.sustain.shieldRecoveredTotal);
    const previousHP=before.hp,previousShield=before.defense.shield;
    check(plan.cat+'/'+plan.pair+' pick'+index+' actual confirmation commits once and duplicate fails',choose(o,pick.id)&&!battle.confirmUpgrade(before.progression.runId,o.id,pick.id)&&s().progression.confirmedPicks===index+1,{id:pick.id,rank:s().progression.ranks[pick.id]});
    if(['C21','M10','R04','R05','R06','R07'].includes(pick.id))check(plan.cat+'/'+pick.id+' selection never pays free sustain shield or HP',s().hp===(pick.source==='elite'?Math.min(s().maxHp,previousHP+s().maxHp*.2):previousHP)&&s().defense.shield===previousShield&&s().sustain.hpRecoveredTotal===before.sustain.hpRecoveredTotal&&s().sustain.shieldRecoveredTotal===before.sustain.shieldRecoveredTotal,{hp:s().hp,shield:s().defense.shield,sustain:s().sustain});
    if(pick.id==='R07')check(plan.cat+' real R07 acquisition starts fresh stationary charge',near(s().contracts.stationarySeconds,0)&&near(s().contracts.stance,1),s().contracts);
    if(elite){const receipt=s().progression.eliteRewards.at(-1);check(plan.cat+'/'+pick.id+' actual elite commits requested new card exactly once',receipt.cardId===pick.id&&receipt.birthId===birth&&receipt.encounterId===encounter&&s().progression.eliteRewards.length===eliteIndex,receipt);eliteReceipts.push(receipt);}
    check(plan.cat+'/'+plan.pair+' pick'+index+' pickup XP remains conserved',s().pickups.droppedXP===s().pickups.collectedXP+s().pickups.groundXP&&s().progression.totalXP===s().pickups.collectedXP,s().pickups);
   }
   const owned=s().progression.ranks,opposites:GrowthId[]=plan.pair[0]==='R04'?['R05','R07']:['R04','R06'];check(plan.cat+'/'+plan.pair+' <=36 real transactions acquire both sustain cards and legal cross-group tradeoffs',plan.steps.length<=36&&['C21','C13','M10','C12',...plan.pair].every(id=>owned[id]===1)&&opposites.every(id=>!owned[id]&&!growthCardEligible(id,owned,f.session!.runConfig,plan.steps.length))&&eliteReceipts.length===2,{seed:plan.seed,actualConfirmations:s().progression.confirmedPicks,ranks:owned,eliteReceipts});
   // Actual roots are acquired through the preceding normal offers. Only the
   // target, noncritical outcome and cooldown between test volleys are fixed.
   for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);clearFriendly();position(a.cat,360,600);move(0,1);step();const moving=s().contracts.stance,t=target(460,600),p=middle(root());if(!p)throw Error('P4 real root absent');p.setData('critical',false);const raw=p.getData('nonCriticalDamage');for(const q of a.projectiles.getChildren())if(q.active&&q!==p)a.recycle(q,a.projectiles);f.session!.hp=60;a.hit(p,t,'overlap');
   const base=f.session!.runConfig,expectedPrimary=base.weapon.damage*(1+growthNumbers(base.growthTuning?.attributePlan).damage*owned.L1_DAMAGE)*(owned.L1_SPLIT?Math.max(.8,base.weapon.pellets/(base.weapon.pellets+1)):1)*(owned.R04?.8:1.35)*moving*base.directDamageMultiplier;
   check(plan.cat+'/'+plan.pair+' real acquired C21 heals from actual primary loss once',near(raw,expectedPrimary)&&near(1e6-t.getData('hp'),raw)&&near(s().sustain.hpRecoveredTotal,Math.min(raw*.02,s().maxHp*.02)),{expectedPrimary,actualDamage:1e6-t.getData('hp'),raw,sustain:s().sustain});
   move();step(25);const stopped=s().contracts.stance;
   check(plan.cat+'/'+plan.pair+' native move and effective stop apply acquired stance',near(moving,owned.R06?1.25:.8)&&near(stopped,owned.R06?.8:1.4),{moving,stopped,contracts:s().contracts});
   clearFriendly();const old=middle(root());old.setData('critical',false);park(old,650,100);const oldDamage=old.getData('nonCriticalDamage');move(0,1);step();const fresh=middle(root());
   check(plan.cat+'/'+plan.pair+' old native shot keeps old stance while new shot reads moving',near(old.getData('nonCriticalDamage'),oldDamage)&&near(fresh.getData('nonCriticalDamage')/oldDamage,moving/stopped),{old:oldDamage,fresh:fresh.getData('nonCriticalDamage')});
   move();position(a.cat,360,600);clearFriendly();const emitted=s().sentry.emitted;until(()=>s().sentry.emitted>emitted);const shot=s().sentry.lastShot,expected=12*(1+growthNumbers(base.growthTuning?.attributePlan).damage*owned.L1_DAMAGE)*(1+.25*(owned.A07??0))*(owned.R04?1.35:.8)*s().contracts.stance*.6*(s().sentry.station?.attached?.8:1);
   check(plan.cat+'/'+plan.pair+' actual sentry firing applies acquired source and current stance exactly once',near(shot.damage,expected),{shot,expected});
   // The sentry's projectile takes the production hit path and cannot heal.
   const sp=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===shot.projectileId);if(!sp)throw Error('P4 actual sentry projectile absent');const priorHeal=s().sustain.hpRecoveredTotal,hp=t.getData('hp');a.hit(sp,t,'overlap');check(plan.cat+'/'+plan.pair+' actual independent hit damages without C21 recovery',near(hp-t.getData('hp'),shot.damage)&&s().sustain.hpRecoveredTotal===priorHeal,{actualDamage:hp-t.getData('hp'),sustain:s().sustain});
   // Consume the actual remaining magazine; never assign ammo or reloadLeft.
   clearFriendly();while(f.session!.ammo>1)root();(f.session as any).cooldown=999;bubble(5);const reloadBefore=s();root();
   check(plan.cat+'/'+plan.pair+' genuine last consumed round pays M10 once with unchanged enemy wait',reloadBefore.ammo===1&&s().ammo===0&&s().reloadLeft>0&&s().sustain.reloadStarts===reloadBefore.sustain.reloadStarts+1&&near(s().sustain.shieldRecoveredTotal-reloadBefore.sustain.shieldRecoveredTotal,Math.min(reloadBefore.defense.maxShield*.15,reloadBefore.defense.maxShield-reloadBefore.defense.shield))&&s().defense.lastEnemyAt===reloadBefore.defense.lastEnemyAt,{before:reloadBefore.sustain,after:s().sustain,defense:s().defense});
   clearFriendly();const paused=s();battle.pause('background');step(100);check(plan.cat+'/'+plan.pair+' background freezes acquired recovery intervals and stationary history',s().elapsed===paused.elapsed&&JSON.stringify(s().sustain)===JSON.stringify(paused.sustain)&&JSON.stringify(s().contracts)===JSON.stringify(paused.contracts));resume();step();check(plan.cat+'/'+plan.pair+' continue has no sustain catch-up',s().sustain.shieldRecoveredTotal===paused.sustain.shieldRecoveredTotal&&s().sustain.hpRecoveredTotal===paused.sustain.hpRecoveredTotal);
  }
 }
 if(part==='capacity'){
  pressure=true;
  for(const c of inputs.scenarios)for(const mode of ['20Hz','30Hz','irregular']){
   start(c.cat,c.before,true);target(500,600,1e12);a.abilities.state.onVolley=()=>!!a.growth.snapshot().ranks.L1_PICKUP_CHIME;
   if(c.crowded){for(let n=1;n<32;n++)target(450+(n%6)*3,600+Math.floor(n/6)*3,1e12);for(let n=0;n<97;n++)a.pickups.drop(900000+n,'E01',{x:70+n%8,y:100+Math.floor(n/8)});for(let n=0;n<9;n++)a.abilities.place({x:70+n*20,y:300},12,9,1.05);}
   const deltas=mode==='20Hz'?[50]:mode==='30Hz'?[1000/30]:[50,17,8,41,1000/30,23];let peak=0,transitions=0,oldActive=0,pendingBefore=0,anchorSeen=false,maxAreaTimers=0,maxAreaTweens=0;
   const beforeLife=f.session!.effectiveConfig.weapon.bulletLifeSeconds;let afterLife=beforeLife;
   for(let n=0;n<1500;n++){
    if(c.after&&!transitions&&f.session!.elapsed>=8&&(a.rhythmTimers.size>0||!c.before.C23)){oldActive=a.projectiles.countActive(true);pendingBefore=a.rhythmTimers.size;install(c.after);afterLife=f.session!.effectiveConfig.weapon.bulletLifeSeconds;transitions++;}
    step(1,deltas[n%deltas.length]);const active=a.projectiles.countActive(true),cap=projectileCapacityForGrowth(f.session!.runConfig,f.session!.effectiveConfig,a.growth.snapshot().ranks);peak=Math.max(peak,active);if(active>cap)throw Error(c.id+' active exceeds current capacity proof '+active+'/'+cap);
    const area=a.areas.snapshot();anchorSeen||=!!area.anchor;maxAreaTimers=Math.max(maxAreaTimers,area.timers);maxAreaTweens=Math.max(maxAreaTweens,area.tweens);
    if(c.crowded){const p=a.pickups.snapshot();if(p.active!==96||p.droppedXP!==194||p.groundXP+p.collectedXP!==p.droppedXP)throw Error('P4 crowded XP conservation');if(a.enemies.countActive(true)!==32||a.abilities.trails.countActive(true)!==9||a.abilities.orbits.countActive(true)!==4)throw Error('P4 crowded native group occupancy');}
   }
   const z=s();check(c.cat+'/'+c.id+'/'+mode+' native full-lifetime pressure admits all sources at retained capacity',z.projectileDiagnostics.failedSpawns===0&&peak<=z.projectileDiagnostics.capacity&&JSON.stringify(attempts)===JSON.stringify(z.sourceCounts)&&z.shots>20&&z.reloadCompletions>2,{scope:c.diagnostic?'CONTROLLED_47_DIAGNOSTIC_NOT_NORMAL_SUPPLY':'CONTROLLED_LEGAL_36_NOT_NATURAL_OR_DEVICE_FPS',before:c.before,after:c.after,legalRankPaths:c.legalRankPaths,peak,capacity:z.projectileDiagnostics.capacity,attempts,sourceCounts:z.sourceCounts,roots:z.shots,reloads:z.reloadCompletions,returns:z.projectileFlight.returns,rhythm:z.rhythm,elapsed:z.elapsed});
   check(c.cat+'/'+c.id+'/'+mode+' native reusable bodies keep movement enabled after fixture parking',a.projectiles.getChildren().every((p:any)=>p.body.moves)&&a.enemies.getChildren().every((p:any)=>p.body.moves));
   if(c.after)check(c.cat+'/'+c.id+'/'+mode+' old long-life shots and pending native rhythm coexist with shorter new shots',transitions===1&&oldActive>0&&afterLife<beforeLife&&pendingBefore>0,{oldActive,pendingBefore,beforeLife,afterLife});
   if(c.before.C23)check(c.cat+'/'+c.id+'/'+mode+' native delayed rhythm really emits',z.rhythm.emitted>0,z.rhythm);
   if(c.cat==='CAT03')check(c.cat+'/'+c.id+'/'+mode+' native spirit shares projectile Group',z.sourceCounts.SUMMON>0,z.companionDiagnostics);
   if(c.crowded)check(c.cat+'/'+c.id+'/'+mode+'32enemy96XP9trail4orbit pulse anchor and dual companions coexist',anchorSeen&&maxAreaTimers===3&&maxAreaTweens<=2&&z.areaAbilities.casts>0&&z.areaAbilities.bursts>0&&z.areaAbilities.hits>0&&z.sentry.emitted>0&&(c.cat!=='CAT03'||z.companionDiagnostics.spirit.emitted>0),{enemies:z.enemies,pickups:z.pickups,bells:z.bellAbilities.groups,area:z.areaAbilities,sentry:z.sentry,companions:z.companionDiagnostics,maxAreaTimers,maxAreaTweens});
  }
  pressure=false;
 }
 if(part==='lifecycle'){
  const lifecycle:any[]=[];
  for(let n=0;n<20;n++){
   pressure=true;start(n%2?'CAT03':'CAT01',{L1_PIERCE:1,M05:1,E23:1,M12:1,C18:1,M26:1,C23:1,M31:1,L1_SPLIT:1,E21:1,L1_ECHO:1,L1_LIGHT_MAG:1,L1_RATE:4,C15:1,C16:1,E16:1,A07:1,A08:1,A10:1,C12:1,C13:1,C21:1,M10:1,R07:1},true);target();bubble(5);f.session!.hp=60;
   for(let i=0;i<1000&&(f.session!.reloadCompletions<1||!a.rhythmTimers.size||a.hunt.snapshot().targetId===null||!a.areas.snapshot().anchor||!s().sentry.station);i++)step();
   const hurt=target(480,620),id=a.nextProjectile;a.projectile({...hurt.body.center},0,'bell','PRIMARY',90000+n,10,0,600,1);const hpShot=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===id);hpShot.setData('critical',false);a.hit(hpShot,hurt,'overlap');a.sticks.beginTouch(700+n,100,100,{left:0,right:720,top:0,bottom:1440});
   const before=s(),shots=a.projectiles.getChildren().filter((p:any)=>p.active),timers=[...shots.flatMap((p:any)=>[p.getData('lifeTimer'),p.getData('flightTimer')]),...a.rhythmTimers,a.areas.timer,a.areas.anchorTimer,a.areas.anchor.getData('expiry')].filter(Boolean),ledgers=shots.map((p:any)=>p.getData('returnHitIds')).filter(Boolean);
   check('restart'+n+' setup has true recovery rooted charge marks old shots and native delayed work',before.reloadCompletions>0&&before.sustain.hpRecoveredTotal>0&&before.sustain.shieldRecoveredTotal>0&&before.contracts.stationarySeconds>=1&&before.huntingMark.targetId!==null&&before.rhythm.pending>0&&before.areaAbilities.anchor!==null&&before.sentry.station!==null&&before.moveHeld,{sustain:before.sustain,contracts:before.contracts,rhythm:before.rhythm,sentry:before.sentry});
   start();step();const after=s();
   check('restart'+n+' clears input target old bullets clocks ledgers recovery budgets and rooted history',!after.moveHeld&&after.locked===null&&after.targetKind===null&&after.targets.every((t:any)=>t.kind!=='enemy')&&after.projectiles===0&&after.progression.confirmedPicks===0&&after.progression.totalXP===0&&after.progression.eliteRewards.length===0&&!after.hotStartEnabled&&after.huntingMark.targetId===null&&after.rhythm.pending===0&&timers.every((t:any)=>t.callback===undefined)&&ledgers.every((l:any)=>l.size===0)&&after.areaAbilities.timers===0&&after.areaAbilities.tweens===0&&after.sentry.timers===0&&!after.sustain.lifeCircuitOwned&&!after.sustain.reloadShieldOwned&&after.sustain.hpRecoveredTotal===0&&after.sustain.shieldRecoveredTotal===0&&after.sustain.lifeUsedThisSecond===0&&after.sustain.reloadShieldLastAt===null&&!after.progression.ranks.R07&&after.contracts.stationarySince===0&&after.contracts.stationarySeconds<=after.elapsed&&after.elapsed<.11&&after.contracts.stance===1,{timersDestroyed:timers.length,ledgersCleared:ledgers.length,engine:after.engine,sustain:after.sustain,contracts:after.contracts});
   lifecycle.push({groups:after.engine.groups,timers:after.engine.timers,volleyRefs:after.bellModifiers.activeVolleys,area:after.areaAbilities.total,sentry:after.sentry.total});
  }
  check('twenty restarts preserve bounded native groups and zero callbacks',lifecycle.every(z=>JSON.stringify(z.groups)===JSON.stringify(lifecycle[0].groups)&&z.timers===0&&z.volleyRefs===0&&z.area===2),lifecycle);
  pressure=false;start('CAT01',{C21:1,C13:1,M10:1,R07:1});(f.session as any).shield=0;f.session!.hp=1;const boss=a.placeSliceEnemy('B01',440,600);park(boss);boss.setData('hp',1);boss.getData('behavior').phase='slam-warning';boss.getData('behavior').until=f.session!.elapsed;for(let n=0;n<4;n++)a.pickups.drop(99900+n,'E01',{...a.cat.body.center});a.projectile({x:440,y:600},0,'bell','PRIMARY',99999,999,0,1,1);step();
  check('same-frame lethal enemy hit wins over old boss-killing shot and touchingXP',s().result==='death'&&s().hp===0&&s().sustain.hpRecoveredTotal===0&&s().sustain.shieldRecoveredTotal===0&&!s().progression.offer&&s().progression.totalXP===0,{result:s().result,sustain:s().sustain,pickups:s().pickups});const terminal=s();step(100);check('terminal state never later heals or opens rewards',JSON.stringify(s().sustain)===JSON.stringify(terminal.sustain)&&s().progression.totalXP===0);
 }
 return {status:'PASS',part,checks,scope:'Actual normal50 Arena; controlled fixed RNG, legal ranks/targets, pickups and encounter times, manually stepped Scene/native Clock/Physics/Group. No natural formation rate, wall-clock animation or device FPS claim.'};
 }catch(error){return {status:'FAIL',part,error:String(error),stack:(error as Error).stack,checks};}};
 w.normal50AdmissionReady=true;
}
void boot().catch(e=>w.normal50AdmissionBootError=String(e));
