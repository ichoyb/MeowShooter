// Controlled real Arena checks, intentionally isolated from the normal entry.
import {createTraitFixture} from './projectile-traits-sample';
import {normalCourtyardRunConfig} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{a,g,battle}=f,audio=battle.audio!;
 g.loop.sleep();const wake=g.loop.wake.bind(g.loop);let now=0;
 a.tweens.getDelta=()=>1000/60;
 const step=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;g.events.emit('prestep',now,1000/60);g.scene.update(now,1000/60);g.scene.processQueue();}};
 const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const fireVolley=a.fireVolley,spawns=a.spawns.take,special=a.trySpecialSpawn;
 const start=async(cat:CatId='CAT01',effects=true)=>{
  g.loop.wake=()=>{};try{battle.start(normalCourtyardRunConfig(f.config(cat)));}finally{g.loop.wake=wake;}g.loop.sleep();g.scene.processQueue();step();
  a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);position(a.cat,360,720);a.fireVolley=fireVolley;audio.configure({effects});await audio.continue();
 };
 const target=(hp=1000,x=430,id='E01')=>{const e=a.placeSliceEnemy(id,x,720);e.setData('hp',hp);e.body.moves=false;return e;};
 const hit=(critical=false,e=target())=>{a.projectileRandom.frac=()=>critical?0:.99;a.projectile({x:360,y:720},0,'bell','PRIMARY',111,12,0,600,2);const shot=a.projectiles.getChildren().filter((s:any)=>s.active).at(-1);a.hit(shot,e,'overlap');return {e,shot};};
 w.runG5CombatAudioChecks=async()=>{
  const checks:any[]=[],evidence:any={},check=async(name:string,fn:()=>unknown)=>{try{const value=await fn();checks.push({name,pass:!!value});}catch(error){checks.push({name,pass:false,error:String(error)});}};
  const prepareAt=performance.now();await audio.enable();evidence.prepareMs=performance.now()-prepareAt;
  await check('real native manager 16Sound and 12Buffer with one Context',()=>audio.snapshot().ready&&audio.snapshot().nativeSounds===16&&audio.snapshot().audioBuffers===12&&g.cache.audio.getKeys().length===12&&(w.nativeAudioProbe?.contexts??1)===1);
  for(const cat of ['CAT01','CAT02','CAT03'] as const){
   await check(cat+' actual Session root volley fires exactly once, no pellet/subshot replay',async()=>{await start(cat);const before=audio.snapshot().events;target();step();const s=battle.snapshot(),v=audio.snapshot(),id=cat==='CAT01'?'slingshot':cat==='CAT02'?'fish-shot':'bone-shot';evidence[cat]={root:s.shots,sources:s.sourceCounts,audio:v};a.fireVolley=()=>{};return s.shots===1&&v.events[id]-before[id]===1&&v.recentFacts.filter(q=>q.type==='fire').length===1;});
   await check(cat+' actual accepted normal hit then critical replaces ordinary, kill only once',async()=>{await start(cat);a.fireVolley=()=>{};const before=audio.snapshot().events;const normal=hit();await delay(130);g.events.emit('prestep',now,0);const killed=hit(true,target(1,470));a.hit(killed.shot,killed.e,'overlap');const v=audio.snapshot();evidence[cat].hits=v;return v.events.hit-before.hit===1&&v.events.critical-before.critical===1&&v.events.defeat-before.defeat===1&&!killed.e.active&&normal.e.active&&v.played.hit>0&&v.played.critical>0;});
  }
  for(const mode of ['fullshield','noHPbreak','HPbreak','hp','noaccept','zero','death'])await check('actual IncomingDamageFact '+mode+' exclusive hurt/break and same-frame commit',async()=>{
   await start();a.fireVolley=()=>{};if(['fullshield','noHPbreak','HPbreak'].includes(mode))f.install({C13:1});
   if(mode==='noaccept')battle.pause('menu');const before=audio.snapshot().events,shield=f.session!.defenseSnapshot().shield;
   const fact=a.incomingEnemyDamage(mode==='zero'?0:mode==='fullshield'?4:mode==='noHPbreak'?shield:mode==='HPbreak'?shield+10:mode==='death'?9999:10),v=audio.snapshot();
   evidence[mode]={fact,elapsed:f.session!.elapsed,hp:f.session!.hp,audio:v};
   const hurt=fact.accepted&&fact.hpLost>0?1:0,broken=fact.accepted&&fact.hpLost===0&&fact.shieldBroke?1:0;
   return v.events.hurt-before.hurt===hurt&&v.events['shield-break']-before['shield-break']===broken&&v.recentFacts.some(q=>q.type==='incoming'&&q.at===f.session!.elapsed&&q.hpLost===fact.hpLost);
  });
  await check('actual zero damage primary normal/critical and area resolve without hit critical or defeat requests',async()=>{
   await start();a.fireVolley=()=>{};const enemy=target(),before=audio.snapshot().events,hp=enemy.getData('hp'),hits=battle.snapshot().engine.overlapHits;
   for(const critical of [false,true]){a.projectileRandom.frac=()=>critical?0:.99;a.projectile({x:360,y:720},0,'bell','PRIMARY',121,0,0,600,2);const shot=a.projectiles.getChildren().filter((s:any)=>s.active).at(-1);a.hit(shot,enemy,'overlap');}
   const area=a.abilityHit(enemy,0,'TEST'),v=audio.snapshot();evidence.zeroOutgoing={before,after:v.events,hpBefore:hp,hpAfter:enemy.getData('hp'),area,overlapDelta:battle.snapshot().engine.overlapHits-hits};
   return enemy.getData('hp')===hp&&area===0&&battle.snapshot().engine.overlapHits-hits===2&&v.events.hit===before.hit&&v.events.critical===before.critical&&v.events.defeat===before.defeat;
  });
  await check('actual Arcade enemy contact causes one hurt per accepted damage',async()=>{await start();a.fireVolley=()=>{};const before=audio.snapshot().events;position(target(),360,720);step();const v=audio.snapshot();return battle.snapshot().hp<battle.snapshot().maxHp&&v.events.hurt-before.hurt===1&&v.events['shield-break']===before['shield-break'];});
  await check('actual collected positive XP only; dropped orb alone is silent',async()=>{await start();a.fireVolley=()=>{};const before=audio.snapshot().events.xp;a.pickups.drop(900,'E01',{x:560,y:720});if(audio.snapshot().events.xp!==before)return false;a.pickups.drop(901,'E01',{x:360,y:720});step(2);const s=battle.snapshot();return s.pickups!.collectedXP>0&&audio.snapshot().events.xp-before===1;});
  await check('native Clock/Tween duck 50/100/250 multiplies configured user music and pause cancels',async()=>{await start();a.fireVolley=()=>{};a.incomingEnemyDamage(10);step(4);const down=audio.snapshot();audio.configure({musicVolume:.4});const configured=audio.snapshot();step(7);const held=audio.snapshot();step(17);const restored=audio.snapshot();evidence.duck={down,configured,held,restored};a.incomingEnemyDamage(10);battle.pause('background');step(60);const paused=audio.snapshot();await audio.continue();return Math.abs(down.duckGain-.7)<.001&&Math.abs(configured.musicEffectiveGain-.3*.4*.7)<1e-8&&held.duckGain<1&&Math.abs(restored.duckGain-1)<.001&&paused.activeSources===0&&!paused.duckPending&&audio.snapshot().effectsPlaying===0;});
  await check('26 ordinary + elite + Boss legitimate accepted hit stress stays 8FX/16Sound/12Buffer',async()=>{await start('CAT03');a.fireVolley=()=>{};const enemies=Array.from({length:26},(_,i)=>target(1000,200+i*10));for(const id of ['EL01','B01'])enemies.push(target(100000,480,id));for(const e of enemies)hit(true,e);const v=audio.snapshot();evidence.stress=v;return a.enemies.countActive(true)===28&&v.effectsPlaying<=8&&v.nativeSounds===16&&v.audioBuffers===12&&v.activeSources<=10&&v.recentFacts.length<=16&&v.dropped.critical>0;});
  await check('real native eight FX plus two loop sources, busy-kind ninth request drops without restart',async()=>{
   await start('CAT03');a.fireVolley=()=>{};a.incomingEnemyDamage(10);a.incomingEnemyDamage(10);hit();await delay(85);g.events.emit('prestep',now,0);hit();hit(true);hit(false,target(1,470));a.pickups.drop(902,'E01',{x:360,y:720});step(2);
   const full=audio.snapshot();audio.effect('hurt');const capped=audio.snapshot();evidence.fullNative={full,capped,native:w.nativeAudioProbe?.snapshot?.()};
   return full.effectsPlaying===8&&full.activeSources===10&&capped.effectsPlaying===8&&capped.activeSources===10&&capped.nativeSounds===16&&capped.dropReasons['kind-busy']>0;
  });
  await check('20 restarts and cat switches clear sources duck timers entry listeners, one Context',async()=>{const cycles:any[]=[];for(let i=0;i<20;i++){await start((['CAT01','CAT02','CAT03'] as const)[i%3]);a.fireVolley=()=>{};hit();a.incomingEnemyDamage(10);battle.pause('restart');battle.reset();const stopped=audio.snapshot(),nativeStopped=w.nativeAudioProbe?.snapshot?.();await start((['CAT01','CAT02','CAT03'] as const)[(i+1)%3]);a.fireVolley=()=>{};step(2);const v=audio.snapshot(),timers=battle.snapshot().engine.timers;cycles.push({i,stopped,nativeStopped,v,timers});if(stopped.activeSources!==0||stopped.duckPending||nativeStopped?.activeSources!==0||v.effectsPlaying!==0||v.nativeSounds!==16||v.audioBuffers!==12||v.activeSources>2||timers!==cycles[0].timers||v.nativeSoundDetails.some(s=>s.completeListeners!==0))return false;}evidence.cycles=cycles;return (w.nativeAudioProbe?.contexts??1)===1;});
  await check('prewarmed audio ON/OFF same seeded 12s actual rules and input all three cats',async()=>{
   // Audio synthesis legitimately uses vendor Math.random during explicit
   // preparation; both sides prewarm first. This does not claim cold-unlock RNG equality.
   const random=Math.random,frac=a.projectileRandom.frac;delete a.projectileRandom.frac;const run=async(cat:CatId,effects:boolean)=>{
    for(const e of a.enemies.getChildren())e.body.moves=true;
    await start(cat,effects);a.spawns.take=spawns;a.trySpecialSpawn=special;a.fireVolley=fireVolley;for(const e of a.enemies.getChildren())e.body.moves=true;
    let seed=5236;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};a.projectileRandom.sow(['g5-combat-audio-isolation']);step(720);
    const s=battle.snapshot();return {elapsed:s.elapsed,hp:s.hp,shield:s.defense.shield,ammo:s.ammo,hits:[s.engine.overlapHits,s.engine.sweepHits],kills:s.kills,xp:s.pickups,shots:s.shots,spawn:s.spawnPressure,first:s.firstEncounter,cat:s.engine.bodies.cat,targets:s.targets,traits:s.projectileTraits,origin:s.player};
   };
   try{const results:any={};for(const cat of ['CAT01','CAT02','CAT03'] as const){const on=await run(cat,true),off=await run(cat,false);results[cat]={on,off};if(!(on.shots>0&&on.hits[0]+on.hits[1]>0&&JSON.stringify(on)===JSON.stringify(off))){evidence.isolation=results;return false;}}evidence.isolation=results;return true;}finally{Math.random=random;a.projectileRandom.frac=frac;}
  });
  battle.pause('menu');const result={status:checks.every(c=>c.pass)?'PASS':'FAIL',scope:'CONTROLLED_REAL_ARENA_NATIVE_WEB_AUDIO_NOT_DEVICE_LISTEN_OR_BALANCE',checks,evidence,audio:audio.snapshot(),native:w.nativeAudioProbe?.snapshot?.()};w.g5CombatAudioResult=result;return result;
 };
 w.g5CombatAudioFixture={f,a,g,battle,start,step,hit,target,position};w.g5CombatAudioReady=true;
}
void boot().catch(e=>w.g5CombatAudioBootError=String(e));
