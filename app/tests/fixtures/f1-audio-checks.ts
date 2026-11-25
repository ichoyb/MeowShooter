import type {BattleController} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import Runtime from '../../src/phaser-entry.cjs';
import {createRuntimeAudio} from '../../src/audio/runtime';
import {setBattleModeStatus} from '../../src/ui/hud';
// Explicit local QA choreography. Exercises actual Arena/Arcade/Session/native
// Sound methods; never included in any normal build profile or package.
export async function runAudioChecks(battle:BattleController,a:any,position:(actor:any,x:number,y:number)=>void,output:HTMLElement){
 const checks:{name:string;pass:boolean;details?:unknown}[]=[];
 const audio=battle.audio!;
 const check=(name:string,pass:boolean,details?:unknown)=>{checks.push({name,pass,details});output.textContent=JSON.stringify({status:checks.every(c=>c.pass)?'RUNNING':'FAIL',checks},null,2);};
 const base=makeRunConfig('CAT01','W01','p2-basic'),run=Object.freeze({...base,scenario:Object.freeze({...base.scenario,spawnIntervalSeconds:10000,enemySpeed:0})});
 const clear=()=>{for(const g of [a.enemies,a.objects,a.projectiles])for(const actor of g.getChildren())a.recycle(actor,g);};
 const start=()=>{const wake=a.game.loop.wake;a.game.loop.wake=()=>{};try{battle.start(run);}finally{a.game.loop.wake=wake;}a.game.loop.sleep();a.game.scene.processQueue();};
 const target=(kind='enemy',x=a.cat.x+80,y=a.cat.y)=>{const actor=kind==='enemy'?a.placeSliceEnemy('E01',x,y):a.place(a.objects,x,.3,kind);position(actor,x,y);actor.body.moves=false;return actor;};
 function exercise(){
  if(a.projectileRandom)a.projectileRandom.frac=()=>.99;
  clear();const before=audio.snapshot().events;a.update(0,0);check('无目标不发声',audio.snapshot().events.slingshot===before.slingshot);
  const enemy=target();enemy.setData('hp',1);a.update(33,33);
  const fired=audio.snapshot().events.slingshot-before.slingshot;check('一次实际齐射只发一声（含副弹）',fired===1,{fired,sourceCounts:battle.snapshot().sourceCounts});
  const shot=a.projectiles.getChildren().find((s:any)=>s.active&&s.getData('source')==='PRIMARY');
  a.hit(shot,enemy,'overlap');const after=audio.snapshot().events;a.hit(shot,enemy,'overlap');
  check('有效命中及敌人击败各一次，重复裁决不重播',after.hit-before.hit===1&&after.defeat-before.defeat===1&&audio.snapshot().events.hit===after.hit);
  const box=target('object');box.setData('hp',1);a.fire({x:1,y:0,id:91});const bullet=a.projectiles.getChildren().find((s:any)=>s.active&&s.getData('source')==='PRIMARY');a.hit(bullet,box,'overlap');check('箱子不播放敌人击败声',audio.snapshot().events.defeat===after.defeat);
  clear();const hp=battle.snapshot().hp;target('enemy',a.cat.x,a.cat.y);a.update(66,33);const now=battle.snapshot();check('实际HP下降才触发受伤',now.hp<hp&&audio.snapshot().events.hurt-before.hurt===1,{hpBefore:hp,hpAfter:now.hp});
  return {hp:now.hp,ammo:now.ammo,kills:now.kills,objectsHit:now.objectsHit,sourceCounts:now.sourceCounts,passiveState:now.passiveState,elapsed:now.elapsed};
 }
 try{
  audio.setLocation('courtyard');const prepareStart=performance.now();await audio.enable();check('手势解锁原生音频（16个Sound一次准备）',audio.snapshot().ready,{prepareMs:performance.now()-prepareStart,snapshot:audio.snapshot()});
  start();await audio.continue();a.game.loop.sleep();audio.configure({effects:true,music:true});const audible=exercise();
  check('最多8FX上限+原生循环预排两源',audio.snapshot().effectsPlaying<=8&&audio.snapshot().activeSources<=10,audio.snapshot());
  battle.pause('menu');check('暂停立即停止全部源',audio.snapshot().activeSources===0);battle.resume();await audio.continue();a.game.loop.sleep();check('明确继续只恢复音乐',audio.snapshot().musicPlaying&&audio.snapshot().effectsPlaying===0);
  battle.pause('background');check('后台立即止音',audio.snapshot().activeSources===0);a.game.events.emit('visible');check('重新可见仍等待明确继续',audio.snapshot().activeSources===0&&audio.snapshot().held);
  // Boss音乐A新增entry和loop，批准的原生Sound/AudioCache上限由5变7。
  for(let i=0;i<20;i++){start();await audio.continue();a.game.loop.sleep();if(audio.snapshot().nativeSounds!==16||audio.snapshot().audioBuffers!==12)throw Error('重开声音或缓存数量变化');}
  check('20次重开16个Sound/AudioCache有界',a.game.cache.audio.getKeys().filter((key:string)=>key.startsWith('f1-')).length===12,audio.snapshot());
  audio.configure({effects:false,music:false});const silent=exercise();check('有声/静音实际规则对照一致',JSON.stringify(audible)===JSON.stringify(silent),{audible,silent});
  // Only the test advances native TweenManager/PRE_STEP while Arena simulation
  // is asleep. Real playback still uses the browser Context and native Sound.
  const advanceAudio=async(ms:number)=>{const until=performance.now()+ms;do{await new Promise(resolve=>setTimeout(resolve,20));a.tweens.tick();a.game.events.emit('prestep',performance.now(),20);}while(performance.now()<until);};
  // Native Tween startup is observed, rather than assuming a wall-time sleep
  // proves the deferred first update has occurred while this Scene is asleep.
  const untilAudio=async(predicate:()=>boolean,timeout:number)=>{const end=performance.now()+timeout;while(!predicate()&&performance.now()<end)await advanceAudio(20);};
  audio.configure({music:true});const entryBefore=audio.snapshot().entryPlayedCount;audio.setBossActive(true);audio.setBossActive(true);await untilAudio(()=>audio.snapshot().currentTrack==='boss-entry',1000);
  check('Boss音乐意图只触发一次原生出场Sound',audio.snapshot().currentTrack==='boss-entry'&&audio.snapshot().entryPlayedCount===entryBefore+1,audio.snapshot());
  await untilAudio(()=>audio.snapshot().currentTrack==='boss-loop'&&audio.snapshot().musicBaseGain===1,2200);check('原生complete接Boss循环与渐入',audio.snapshot().currentTrack==='boss-loop'&&audio.snapshot().activeSources===2,audio.snapshot());
  audio.setBossActive(false);audio.setBossActive(true);await untilAudio(()=>audio.snapshot().currentTrack==='boss-entry',1000);battle.pause('background');const pausedCount=audio.snapshot().entryPlayedCount;await advanceAudio(1450);check('出场期间后台阻止迟到完成重启声音',audio.snapshot().activeSources===0&&audio.snapshot().held,audio.snapshot());
  battle.resume();await audio.continue();a.game.loop.sleep();check('后台明确继续只恢复Boss循环',audio.snapshot().currentTrack==='boss-loop'&&audio.snapshot().entryPlayedCount===pausedCount,audio.snapshot());
  audio.configure({music:false});audio.setBossActive(false);audio.setBossActive(true);audio.configure({music:true});check('静音入场后开启不补播提示乐',audio.snapshot().currentTrack==='boss-loop'&&audio.snapshot().entryPlayedCount===pausedCount,audio.snapshot());
  audio.setLocation('courtyard');check('回庭院清Boss意图',audio.snapshot().musicIntent==='normal'&&audio.snapshot().currentTrack==='courtyard',audio.snapshot());audio.setLocation('battle');
  battle.pause('menu');check('停止清旧声',audio.snapshot().activeSources===0);audio.configure({effects:true,music:true});
  check('引擎PRE_STEP订阅独立于Scene暂停',a.game.events.listeners('prestep').some((fn:Function)=>fn.name==='update'));
  const P=Runtime as any,holder=document.createElement('div');holder.style.cssText='position:absolute;left:-100px;top:0;width:8px;height:8px;overflow:hidden';document.body.appendChild(holder);
  let finishBoot:(game:any)=>void;const booted=new Promise<any>(resolve=>finishBoot=resolve);
  new P.Game({type:P.CANVAS,width:8,height:8,parent:holder,banner:false,scene:[],audio:{noAudio:true},callbacks:{postBoot(game:any){finishBoot(game);}}});
  const qaGame=await booted,Original=window.AudioContext,unhandled:string[]=[];
  const rejection=(event:PromiseRejectionEvent)=>unhandled.push(String(event.reason));window.addEventListener('unhandledrejection',rejection);
  try{
   for(const mode of ['pause-continue','dispose','failure','visible-dispose']){
    const ctx=new Original(),resume=ctx.resume.bind(ctx);await resume();let release:()=>void;
    ctx.resume=mode==='failure'?()=>Promise.reject(new Error('QA受控resume失败')):mode==='visible-dispose'?resume:()=>new Promise<void>(resolve=>{release=()=>{ctx.resume=resume;resolve();};});
    let temporary:ReturnType<typeof createRuntimeAudio>;
    try{(window as any).AudioContext=function(){return ctx;};temporary=createRuntimeAudio(qaGame,P.Sound.WebAudioSoundManager);temporary.setLocation('courtyard');const old=temporary.enable();
     if(mode==='pause-continue'){temporary.pause('background');const continued=temporary.continue();release!();await Promise.all([old,continued]);check('原生Context旧解锁之后一次明确继续生效',temporary.snapshot().ready&&temporary.snapshot().nativeSounds===16,temporary.snapshot());}
     else if(mode==='dispose'){temporary.dispose();release!();await old;check('销毁越过原生Context旧解锁，无Sound或缓存',temporary.snapshot().activeSources===0&&temporary.snapshot().nativeSounds===0&&qaGame.cache.audio.getKeys().length===0,temporary.snapshot());}
     else if(mode==='visible-dispose'){await old;check('原生VISIBLE自动恢复监听已移除',!qaGame.events.listeners('visible').includes(P.Sound.WebAudioSoundManager.prototype.onGameVisible));qaGame.events.emit('visible');temporary.dispose();await new Promise(resolve=>setTimeout(resolve,150));check('visible后立即销毁无旧回调拒绝或残留',unhandled.length===0&&temporary.snapshot().nativeSounds===0&&qaGame.cache.audio.getKeys().length===0,{unhandled,snapshot:temporary.snapshot()});}
     else {await old;const error=temporary.snapshot().error;check('原生resume失败如实报告，无声音',error.includes('QA受控resume失败')&&temporary.snapshot().activeSources===0,temporary.snapshot());const status=document.createElement('span');holder.appendChild(status);setBattleModeStatus(status,'自动 · 等待目标',error);battle.start(run);a.game.loop.sleep();clear();const before=battle.snapshot();a.keys.D.isDown=true;a.update(33,33);const after=battle.snapshot();check('声音错误可见，实际Arena时间和移动照常',status.textContent?.includes(error)&&status.getAttribute('role')==='status'&&after.elapsed>before.elapsed&&after.player.x>before.player.x,{status:status.textContent,before:{elapsed:before.elapsed,x:before.player.x},after:{elapsed:after.elapsed,x:after.player.x}});battle.pause('menu');status.remove();}
     temporary.dispose();
    }finally{(window as any).AudioContext=Original;}
    await new Promise(resolve=>setTimeout(resolve,0));check('原生Context由会话关闭',ctx.state==='closed',{mode,state:ctx.state});
   }
   await new Promise(resolve=>setTimeout(resolve,130));check('原生销毁/旧异步回调无未处理拒绝',unhandled.length===0,unhandled);
  }finally{window.removeEventListener('unhandledrejection',rejection);(window as any).AudioContext=Original;qaGame.destroy(true,false);holder.remove();}
  output.textContent=JSON.stringify({status:checks.every(c=>c.pass)?'PASS':'FAIL',environment:navigator.userAgent,checks,audio:audio.snapshot(),note:'受控实际Arena步骤；手机、最低内核和实听由对应环境另验。'},null,2);
 }catch(error){check('自检异常',false,String(error));output.textContent=JSON.stringify({status:'FAIL',checks,audio:audio.snapshot()},null,2);battle.pause('menu');}
 finally{a.game.loop.wake();}
}
