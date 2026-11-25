import './courtyard-ordinary-combat';
import {runAudioChecks} from './f1-audio-checks';
declare function require(path:string):any;
const w=window as any;
const withBossRoll=(value:number,callback:()=>void)=>{const math=require('../../src/phaser-entry.cjs').Math,old=math.FloatBetween;math.FloatBetween=()=>value;try{callback();}finally{math.FloatBetween=old;}};
w.runIntegratedAudioChecks=()=>{const {a,battle,position}=w.sliceFixture;return runAudioChecks(battle,a,position,document.getElementById('result')!);};
w.runBossTuningChecks=async()=>{
 const {a,battle,start,step,position}=w.sliceFixture,checks:any[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});
 start();a.spawns.take=()=>null;const b=a.placeSliceEnemy('B01',430,720);b.setData('hp',10000);position(a.cat,350,720);const st=b.getData('behavior');st.until=0;withBossRoll(.9,()=>step());const entered=battle.snapshot().elapsed,deadline=st.until;
 check('actual new windup is 1.05 seconds',st.phase==='warning'&&Math.abs(deadline-entered-1.05)<.0001,st);
 while(battle.snapshot().elapsed<deadline-.04)step();check('warning remains readable before its deadline',st.phase==='warning',st);step(4);
 check('native Boss rush is 240u/s with unchanged 32u body',st.phase==='dash'&&Math.abs(b.body.velocity.length()-240)<.0001&&b.body.halfWidth===32,{state:st,speed:b.body.velocity.length(),radius:b.body.halfWidth});
 start();a.spawns.take=()=>null;const slam=a.placeSliceEnemy('B01',360,720);slam.setData('hp',10000);position(a.cat,480,720);a.cameras.main.stopFollow();Object.assign(slam.getData('behavior'),{phase:'slam-warning',until:.1});step(8);
 check('new outer band at 120u actually takes one 20 damage hit',battle.snapshot().hp===70&&a.bossEffects.snapshot().slams===1,{hp:battle.snapshot().hp,effects:a.bossEffects.snapshot()});for(let n=0;n<75&&a.bossEffects.snapshot().impactRadius!==112;n++){await new Promise(resolve=>setTimeout(resolve,16));step();}
 check('ground expansion matches configured 112u and retains bounded dust',a.bossEffects.snapshot().impactRadius===112&&a.bossEffects.snapshot().pooledParticles<=8,a.bossEffects.snapshot());
 return {status:checks.every(x=>x.pass)?'PASS':'FAIL',checks};
};
w.runBossTacticsChecks=()=>{
 const {a,battle,g,start,step,position}=w.sliceFixture,checks:any[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>{checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});if(!pass)throw Error(name);};
 try{
  start();a.spawns.take=()=>null;const b=a.placeSliceEnemy('B01',410,720);b.setData('hp',10000);position(a.cat,340,680);b.getData('behavior').until=0;withBossRoll(.2,()=>step());
  check('near visible start can choose slam from native RNG',b.getData('behavior').phase==='slam-warning',{state:b.getData('behavior'),distance:80});
  const origin={x:b.body.center.x,y:b.body.center.y},deadline=b.getData('behavior').until;position(a.cat,560,720);step(2);
  check('leaving range and camera cannot cancel or move a started slam',b.getData('behavior').phase==='slam-warning'&&!a.readableSlam(b)&&b.body.center.x===origin.x,{state:b.getData('behavior'),readable:a.readableSlam(b),origin});
  battle.pause('background');g.scene.processQueue();const elapsed=battle.snapshot().elapsed;step(100);check('committed warning still freezes on background',battle.snapshot().elapsed===elapsed&&b.getData('behavior').phase==='slam-warning',battle.snapshot().elapsed);
  const wake=g.loop.wake;g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();while(battle.snapshot().elapsed<deadline+.04)step();
  check('missed slam completes once at its original center, without remote damage',a.bossEffects.snapshot().slams===1&&battle.snapshot().hp===90&&b.body.center.x===origin.x&&b.body.center.y===origin.y,{hp:battle.snapshot().hp,effects:a.bossEffects.snapshot(),center:b.body.center});
  start();a.spawns.take=()=>null;const near=a.placeSliceEnemy('B01',410,720);near.setData('hp',10000);position(a.cat,340,680);near.getData('behavior').until=0;withBossRoll(.8,()=>step());check('near visible start can also choose charge',near.getData('behavior').phase==='warning',near.getData('behavior'));
  start();a.spawns.take=()=>null;const far=a.placeSliceEnemy('B01',430,720);far.setData('hp',10000);position(a.cat,160,720);a.cameras.main.stopFollow();far.getData('behavior').until=0;withBossRoll(.1,()=>step());check('far start charges even when the same roll would select slam nearby',far.getData('behavior').phase==='warning',far.getData('behavior'));
  a.cameras.main.stopFollow();const originX=far.body.center.x;let dashAt=0;while(far.getData('behavior').phase==='warning'){step();if(far.getData('behavior').phase==='dash')dashAt=battle.snapshot().elapsed;}
  while(far.getData('behavior').phase==='dash')step();const travel=originX-far.body.center.x;
  check('native Arcade charge travels264u at240u/s over1.1 seconds',Math.abs(travel-264)<.1&&Math.abs(battle.snapshot().elapsed-dashAt-1.1)<.02,{travel,duration:battle.snapshot().elapsed-dashAt,phase:far.getData('behavior').phase});
  start();a.spawns.take=()=>null;const killed=a.placeSliceEnemy('B01',360,720);killed.setData('hp',12);position(a.cat,450,720);Object.assign(killed.getData('behavior'),{phase:'slam-warning',until:.7});step(2);a.projectile(killed.body.center,0,'bell','PRIMARY',999,12,0,0,1);step(2);step(60);
  check('armor still takes damage and death cancels pending attack and effects',!killed.active&&a.bossEffects.snapshot().slams===0&&a.bossEffects.snapshot().activeParticles===0,{active:killed.active,effects:a.bossEffects.snapshot()});
  return {status:'PASS',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}
};
w.runBossBoundaryChecks=()=>{
 const {a,battle,start,step,position}=w.sliceFixture,checks:any[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});
 start();a.spawns.take=()=>null;const off=a.placeSliceEnemy('B01',20,720);off.setData('hp',10000);step();
 check('off-camera birth does not spend the visual entrance',a.bossEffects.snapshot().entries===0,a.bossEffects.snapshot());
 position(off,360,720);step();check('first camera entry plays its visual once',a.bossEffects.snapshot().entries===1,a.bossEffects.snapshot());
 position(off,20,720);step();position(off,360,720);step();check('camera return cannot replay the entrance',a.bossEffects.snapshot().entries===1,a.bossEffects.snapshot());
 start();a.spawns.take=()=>null;const b=a.placeSliceEnemy('B01',360,720);b.setData('hp',10000);Object.assign(b.getData('behavior'),{phase:'slam-warning',until:1.2});step(2);const committedHP=battle.snapshot().hp;position(b,195,720);step();
 check('committed slam keeps its full warning after leaving the camera',b.getData('behavior').phase==='slam-warning'&&a.bossEffects.snapshot().slams===0,{phase:b.getData('behavior').phase,slams:a.bossEffects.snapshot().slams});step(72);check('off-camera committed slam completes without hurting an out-of-range cat',a.bossEffects.snapshot().slams===1&&battle.snapshot().hp===committedHP,{slams:a.bossEffects.snapshot().slams,hp:battle.snapshot().hp,beforeHp:committedHP});
 return {status:checks.every(x=>x.pass)?'PASS':'FAIL',checks};
};
w.runBossPresenceChecks=()=>{
 const {a,battle,step,start,position}=w.sliceFixture,checks:any[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>{checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});if(!pass)throw Error(name);};
 try{
  start();a.spawns.take=()=>null;const b=a.placeSliceEnemy('B01',360,720);b.setData('hp',10000);position(a.cat,450,720);
  let art=b.getData('art').snapshot();
  check('real Boss uses approved A cutout pivots and motion revision',art.bossRevision==='charge-motion-v2+ dust-plume-96-v3'&&Math.abs(art.partX+79.317697228145)<.0001,art);
  check('only the approved 48 square dust source increases battle image ledger',battle.snapshot().imageBudget.sourceRGBA===4864064,battle.snapshot().imageBudget);
  check('Boss effects use a native bounded eight-stone group and two emitters',a.bossEffects?.snapshot().allocatedStones===8&&a.bossEffects.snapshot().emitters===2,a.bossEffects?.snapshot()??null);
  position(b,430,720);position(a.cat,350,720);const state=b.getData('behavior');Object.assign(state,{phase:'warning',until:1.2,direction:{x:-1,y:0}});step();
  art=b.getData('art').snapshot();check('warning preserves unit layer scales and original physical center',art.phase==='warning'&&art.bossFace===-1&&art.bodyScale.x===1&&art.bodyScale.y===1&&b.body.halfWidth===32,{art,radius:b.body.halfWidth});
  Object.assign(state,{phase:'dash',until:battle.snapshot().elapsed+.15});step();
  check('actual dash starts the approved native dust trail',a.bossEffects.snapshot().phase==='dash'&&a.bossEffects.snapshot().pending, a.bossEffects.snapshot());step(10);
  check('actual dash recovery starts dust only once',a.bossEffects.snapshot().stops===1,a.bossEffects.snapshot());
  start();a.spawns.take=()=>null;const slam=a.placeSliceEnemy('B01',360,720);slam.setData('hp',10000);position(a.cat,450,720);Object.assign(slam.getData('behavior'),{phase:'slam-warning',until:.1});step(8);
  check('actual slam uses the approved full-radius fracture and plume effect, with one damage',battle.snapshot().hp===70&&a.bossEffects.snapshot().slams===1&&a.bossEffects.snapshot().slamRadius===112,a.bossEffects.snapshot());
  step(30);check('slam recovery cannot deal duplicate damage',battle.snapshot().hp===70,battle.snapshot().hp);
  const warm=a.children.length;for(let i=0;i<20;i++){start();a.spawns.take=()=>null;const e=a.placeSliceEnemy('B01',360,720);e.setData('hp',10000);position(a.cat,450,720);Object.assign(e.getData('behavior'),{phase:'slam-warning',until:.1});step(8);}
  check('twenty real restarts reuse Boss effect objects',a.children.length===warm,{warm,after:a.children.length});
  start();const fx=a.bossEffects.snapshot();check('restart clears Boss particles, pending effects and presentation',fx.activeParticles===0&&fx.activeStones===0&&!fx.pending&&fx.slams===0&&fx.stops===0,fx);
  return {status:'PASS',scope:'ACTUAL_CONTROLLED_SCENE_NOT_NATURAL_PLAY',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}
};
w.runBossEffectsChecks=()=>{
 const {a,battle,g,step,start,position}=w.sliceFixture,checks:any[]=[],rules:any[]=[];
 const check=(name:string,pass:unknown,actual:unknown)=>{checks.push({name,pass:!!pass,actual:JSON.parse(JSON.stringify(actual))});if(!pass)throw Error(name);};
 const resume=()=>{const wake=g.loop.wake;g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();};
 const quiet=()=>{start();a.spawns.take=()=>null;a.reinforcements.begin=()=>false;};
 try{
  for(const quality of ['standard','low']){
   battle.setPresentation({quality});quiet();const charge=a.placeSliceEnemy('B01',300,720);charge.setData('hp',10000);Object.assign(charge.getData('behavior'),{phase:'dash',until:.15,direction:{x:1,y:0}});step();
   check(quality+' Boss dash has visible native trail without extra physical bodies',a.bossDashTrail?.commandBuffer.length>0&&!a.bossDashTrail.body&&!a.bossDashTrail.input,{commands:a.bossDashTrail?.commandBuffer.length??0,physical:!!a.bossDashTrail?.body});
   step(10);check(quality+' real dash completion produces one ground burst',charge.getData('behavior').phase==='recover'&&a.bossEffects.snapshot().stops===1&&a.bossEffects.snapshot().activeParticles>0,{phase:charge.getData('behavior').phase,alpha:a.bossDashImpact?.alpha??0});
   quiet();const boss=a.placeSliceEnemy('B01',360,720);boss.setData('hp',10000);position(a.cat,450,720);Object.assign(boss.getData('behavior'),{phase:'slam-warning',until:.1});step(8);
   check(quality+' actual slam retains one 20 damage hit with expanding native impact',battle.snapshot().hp===70&&a.slamImpact.commandBuffer.length>30&&a.bossEffects.snapshot().fx.ringLife>0&&a.bossEffects.snapshot().slams===1,{hp:battle.snapshot().hp,commands:a.slamImpact.commandBuffer.length,scale:a.slamImpact.scaleX});
   battle.pause('menu');g.scene.processQueue();const before=JSON.stringify({elapsed:battle.snapshot().elapsed,alpha:a.slamImpact.alpha,scale:a.slamImpact.scaleX,hp:battle.snapshot().hp});step(60);
   check(quality+' pause freezes native impact and damage',JSON.stringify({elapsed:battle.snapshot().elapsed,alpha:a.slamImpact.alpha,scale:a.slamImpact.scaleX,hp:battle.snapshot().hp})===before,before);resume();
   check(quality+' explicit continue does not replay old slam',a.bossEffects.snapshot().fx.ringLife===0,a.bossEffects.snapshot());step(30);
   const s=battle.snapshot();check(quality+' recovery causes no second slam hit',s.hp===70,s.hp);
   rules.push({elapsed:s.elapsed,hp:s.hp,ammo:s.ammo,shots:s.shots,phase:boss.getData('behavior').phase,bossHp:boss.getData('hp'),result:s.result});
  }
  check('standard and low effects produce identical combat outcomes',JSON.stringify(rules[0])===JSON.stringify(rules[1]),rules);
  const warm=()=>{quiet();const b=a.placeSliceEnemy('B01',360,720);b.setData('hp',10000);position(a.cat,500,850);a.showBossDashImpact(b);a.resolveSlam(b);step();};warm();const nodes=a.children.length;
  for(let i=0;i<20;i++)warm();check('20 restarts reuse fixed effect Graphics and native tweens',a.children.length===nodes,{warm:nodes,after:a.children.length});
  quiet();check('restart clears old trails, bursts and impact tweens',a.bossDashTrail.commandBuffer.length===0&&a.bossEffects.snapshot().activeParticles===0&&a.bossEffects.snapshot().fx.ringLife===0&&!a.bossEffects.snapshot().pending,{trail:a.bossDashTrail.commandBuffer.length,burst:a.bossDashImpact.alpha,slam:a.slamImpact.alpha});
  return {status:'PASS',scope:'CONTROLLED_SCENE_RULE_ISOLATION_NOT_NATURAL_PLAY',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}
};
w.runBossChecks=()=>{
 const {a,battle,g,step,tick,start,position}=w.sliceFixture,checks:any[]=[];
 const check=(name:string,condition:unknown,actual:unknown)=>{checks.push({name,pass:!!condition,actual:JSON.parse(JSON.stringify(actual))});if(!condition)throw Error(name);};
 const near=(x:number,y:number)=>Math.abs(x-y)<.001;
 const quiet=()=>{start();a.spawns.take=()=>null;a.reinforcements.begin=()=>false;};
 const resume=()=>{const wake=g.loop.wake;g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();};
 const until=(time:number)=>{while(battle.snapshot().elapsed<time&&!battle.snapshot().result)step();};
 const shotsOff=()=>{for(const s of a.projectiles.getChildren())a.recycle(s,a.projectiles);};
 const terminalShot=(target:any,damage:number)=>{a.projectile(target.body.center,0,'bell','PRIMARY',999,damage,0,0,1);return a.projectiles.getFirstAlive();};
 const bossRun=()=>{quiet();shotsOff();tick(450000);while(!battle.snapshot().boss&&!battle.snapshot().result&&battle.snapshot().elapsed<455)step();if(!battle.snapshot().boss)throw Error('No actual Boss encounter');const b=a.enemies.getChildren().find((e:any)=>e.active&&e.getData('enemyId')==='B01');while(b.getData('behavior').phase==='arriving')step();for(const e of a.enemies.getChildren())if(e.active&&e.getData('enemyId')==='EL01')a.recycle(e,a.enemies);return b;};
 try{
  start();const s=battle.snapshot();
  check('normal CAT01 first level uses 600s and slower .8s fire',s.durationSeconds===600&&s.weaponInterval===.8,{duration:s.durationSeconds,interval:s.weaponInterval,content:s.contentId});
  check('all approved enemy parts stay in unchanged battle source budget',s.imageBudget.sourceRGBA===4864064,s.imageBudget);
  const boss=a.placeSliceEnemy('B01',430,720);
  check('Boss has real 96u display and 32u independent body',boss.displayWidth===96&&boss.body.halfWidth===32,{display:boss.displayWidth,radius:boss.body.halfWidth});
  quiet();a.cameras.main.setViewport(0,0,720,1440).setZoom(1).centerOn(360,720).preRender();until(151.1);
  check('no-safe-point birth remains pending with a native 1s retry event',battle.snapshot().level.eliteAt===null&&!!a.specialRetry,{level:battle.snapshot().level,retry:a.specialRetry?.delay,view:a.cameras.main.worldView});
  battle.pause('menu');g.scene.processQueue();const retryTime=a.specialRetry.elapsed;step(90);check('pause freezes the pending birth retry',a.specialRetry.elapsed===retryTime,{elapsed:a.specialRetry.elapsed});
  a.configureCourtyardCamera(true);resume();until(battle.snapshot().elapsed+5);
  check('restored safe viewport produces one elite without queued duplicates',battle.snapshot().level.eliteAt!==null&&a.enemies.getChildren().filter((e:any)=>e.active&&e.getData('enemyId')==='EL01').length===1,{level:battle.snapshot().level,groups:battle.snapshot().engine.groups});
  quiet();until(149.9);check('no special before 150s',battle.snapshot().level.eliteAt===null,battle.snapshot().level);while(battle.snapshot().level.eliteAt===null&&battle.snapshot().elapsed<156)step();
  let elite=a.enemies.getChildren().find((e:any)=>e.active&&e.getData('enemyId')==='EL01');
  check('actual director creates exactly one harmless 1.2s elite entry',!!elite&&elite.getData('behavior').phase==='arriving'&&!elite.body.enable&&a.targets().length===0,{level:battle.snapshot().level,state:elite?.getData('behavior'),targets:a.targets()});
  battle.pause('menu');g.scene.processQueue();const arrival=JSON.stringify({elapsed:battle.snapshot().elapsed,state:elite.getData('behavior'),timer:elite.getData('lifeTimer').elapsed});step(120);
  check('pause freezes native entry Clock and effective time',arrival===JSON.stringify({elapsed:battle.snapshot().elapsed,state:elite.getData('behavior'),timer:elite.getData('lifeTimer').elapsed}),arrival);resume();
  while(!elite.body.enable&&battle.snapshot().elapsed<elite.getData('behavior').until+.15)step();
  check('entry completion enables real body once',elite.body.enable&&elite.getData('behavior').phase!=='arriving',{bodyEnabled:elite.body.enable,level:battle.snapshot().level});
  position(elite,430,720);elite.setData('hp',10000);step();let state=elite.getData('behavior'),deadline=state.until;
  check('elite has a full 1s readable warning and approved split arms',state.phase==='warning'&&near(deadline-battle.snapshot().elapsed,1)&&elite.getData('art').snapshot().second?.visible,{state,art:elite.getData('art').snapshot()});
  const locked={...state.direction};position(a.cat,470,780);step(20);
  check('elite warning commits direction before player sidesteps',state.phase==='warning'&&JSON.stringify(state.direction)===JSON.stringify(locked),state);
  until(deadline+.02);position(a.cat,470,780);step(2);
  check('real elite dash locks direction at 200u/s',state.phase==='dash'&&near(elite.body.velocity.length(),200)&&JSON.stringify(state.direction)===JSON.stringify(locked),{state,velocity:elite.body.velocity});
  until(state.until+.02);check('single elite dash immediately enters recovery without a second segment',state.phase==='recover',state);
  position(a.cat,360,720);position(elite,430,720);until(state.until+.02);check('recovery returns to chase, not another warning',state.phase==='chase',state);
  until(state.nextAttack-.02);check('elite respects the full 3.6s starting interval',state.phase==='chase',state);until(state.nextAttack+.02);check('next single attack has a fresh complete warning',state.phase==='warning'&&state.until-battle.snapshot().elapsed>.95,state);
  // Controlled lethal projectile / real director facts; not a natural duel or balance claim.
  const realBoss=bossRun();check('Boss enters independently at450 without an elite death requirement',battle.snapshot().level.eliteDefeatedAt===null&&battle.snapshot().level.bossAt>=450&&battle.snapshot().level.bossAt<450.1&&battle.snapshot().level.encounters.every((e:any)=>e.spawnedAt!==null),battle.snapshot().level);
  check('real Boss HP is exposed to HUD snapshot',battle.snapshot().boss.maxHp===1500&&battle.snapshot().boss.hp>0,battle.snapshot().boss);
  quiet();const slamBoss=a.placeSliceEnemy('B01',360,720);slamBoss.setData('hp',10000);position(a.cat,480,720);a.cameras.main.stopFollow();state=slamBoss.getData('behavior');Object.assign(state,{phase:'slam-warning',until:.4});step(23);
  check('slam cannot damage before warning deadline',battle.snapshot().hp===90,battle.snapshot().hp);step(2);
  check('slam circle hits a cat whose center is outside 112u but body overlaps',battle.snapshot().hp===70&&state.phase==='recover',{hp:battle.snapshot().hp,state});step(30);check('one slam never repeats damage during recovery',battle.snapshot().hp===70,battle.snapshot().hp);
  quiet();const outside=a.placeSliceEnemy('B01',360,720);position(a.cat,484.1,720);a.cameras.main.stopFollow();outside.setData('hp',10000);Object.assign(outside.getData('behavior'),{phase:'slam-warning',until:.1});step(8);
  check('outside combined 124u slam radius is safe',battle.snapshot().hp===90,{hp:battle.snapshot().hp,distance:124.1});
  quiet();const unreadable=a.placeSliceEnemy('B01',195,720);unreadable.setData('hp',10000);Object.assign(unreadable.getData('behavior'),{phase:'slam-warning',until:.1});step(8);
  check('committed off-viewport slam finishes in place without remote damage',unreadable.getData('behavior').phase==='recover'&&battle.snapshot().hp===90&&a.bossEffects.snapshot().slams===1,{hp:battle.snapshot().hp,state:unreadable.getData('behavior'),effects:a.bossEffects.snapshot()});
  quiet();const charge=a.placeSliceEnemy('B01',300,720);charge.setData('hp',10000);Object.assign(charge.getData('behavior'),{phase:'dash',until:1,direction:{x:1,y:0}});tick(600);
  check('Boss long-frame charge uses native sweep and deals 18',battle.snapshot().hp===72,{hp:battle.snapshot().hp,position:charge.body.center});
  quiet();const armor=a.placeSliceEnemy('EL01',320,720);armor.setData('hp',10000);Object.assign(armor.getData('behavior'),{phase:'dash',until:1,direction:{x:1,y:0}});tick(300);
  check('elite charge damage is 16',battle.snapshot().hp===74,battle.snapshot().hp);
  quiet();const half=a.placeSliceEnemy('B01',430,720);half.setData('hp',750);Object.assign(half.getData('behavior'),{phase:'dash',until:.2,direction:{x:1,y:0}});step(14);
  check('Boss half-health shortens recovery to .96s without changing body',half.getData('behavior').enraged&&half.getData('behavior').phase==='recover'&&half.getData('behavior').until-battle.snapshot().elapsed<=.96&&half.body.halfWidth===32,{state:half.getData('behavior'),radius:half.body.halfWidth});
  quiet();const icy=a.placeSliceEnemy('EL01',430,720);Object.assign(icy.getData('behavior'),{phase:'dash',until:2,direction:{x:-1,y:0}});icy.getData('chill').frozenUntil=1;step();
  check('elite freeze interrupts its committed dash',icy.getData('behavior').phase==='recover'&&icy.body.velocity.length()===0,icy.getData('behavior'));
  quiet();const slowBoss=a.placeSliceEnemy('B01',500,720);slowBoss.getData('chill').frozenUntil=1;step();
  check('Boss frost becomes 15 percent slow, never hard freeze',near(slowBoss.body.velocity.length(),45*.85)&&!battle.snapshot().enemyStatuses[0].frozen,{velocity:slowBoss.body.velocity,status:battle.snapshot().enemyStatuses[0]});
  quiet();const pausedBoss=a.placeSliceEnemy('B01',360,720);pausedBoss.setData('hp',10000);position(a.cat,450,720);Object.assign(pausedBoss.getData('behavior'),{phase:'slam-warning',until:1.2});step(20);battle.pause('background');g.scene.processQueue();const frozen=JSON.stringify({elapsed:battle.snapshot().elapsed,state:pausedBoss.getData('behavior'),hp:battle.snapshot().hp,art:pausedBoss.getData('art').snapshot()});step(180);
  check('background freezes Boss warning and split-paw presentation',frozen===JSON.stringify({elapsed:battle.snapshot().elapsed,state:pausedBoss.getData('behavior'),hp:battle.snapshot().hp,art:pausedBoss.getData('art').snapshot()}),frozen);resume();step();check('continue does not skip ahead or retain input',!battle.snapshot().moveHeld&&battle.snapshot().elapsed<.4,battle.snapshot().elapsed);
  const endBoss=bossRun();shotsOff();endBoss.setData('hp',10000);position(endBoss,500,800);Object.assign(endBoss.getData('behavior'),{phase:'recover',until:1000});tick((599.98-battle.snapshot().elapsed)*1000);shotsOff();endBoss.setData('hp',12);terminalShot(endBoss,12);tick(30);
  check('actual deadline step resolves Boss defeat before timeout',battle.snapshot().result==='cleared'&&battle.snapshot().elapsed===600&&battle.snapshot().level.bossDefeated,{result:battle.snapshot().result,elapsed:battle.snapshot().elapsed,level:battle.snapshot().level});
  const tieBoss=bossRun();tieBoss.setData('hp',100000);Object.assign(tieBoss.getData('behavior'),{phase:'recover',until:1000});position(tieBoss,360,720);while(battle.snapshot().hp>12&&!battle.snapshot().result)step();shotsOff();tieBoss.setData('hp',12);terminalShot(tieBoss,12);tick(710);
  check('same-frame lethal contact and Boss defeat returns death',battle.snapshot().result==='death'&&battle.snapshot().level.bossDefeated,{hp:battle.snapshot().hp,result:battle.snapshot().result,level:battle.snapshot().level});
  quiet();tick(600000);check('timeout is a failure when Boss is not defeated',battle.snapshot().result==='timeout',battle.snapshot().result);
  const warm=()=>{quiet();for(const id of ['EL01','B01']){const e=a.placeSliceEnemy(id,430,720);e.setData('hp',10000);}step();};warm();const children=a.children.length;
  for(let i=0;i<20;i++){start(i%2?'CAT02':'CAT03');warm();}
  check('20 restarts reuse special limbs and leave no old encounter events',a.children.length===children,{warm:children,after:a.children.length,groups:battle.snapshot().engine.groups});
  start();check('new run clears Boss, encounter flags, touch and transient effects',battle.snapshot().boss===null&&battle.snapshot().level.eliteAt===null&&battle.snapshot().level.bossAt===null&&!battle.snapshot().moveHeld&&battle.snapshot().engine.timers===0,battle.snapshot().level);
  return w.bossResults={status:'PASS',checks};
 }catch(error){return w.bossResults={status:'FAIL',error:String(error),checks};}
};
