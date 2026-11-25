// Isolated listen-first audition. No battle imports, source replacement hooks, or normal entry wiring.
import Phaser from 'phaser';
// @ts-expect-error Phaser's explicit native manager has no separate declaration; pinned official JS.
import WebAudioSoundManager from 'phaser/src/sound/webaudio/WebAudioSoundManager.js';
// @ts-expect-error Isolated JavaScript bank, validated by Node PCM and native browser checks.
import {createAuditionBank,ALL_SOUND_SPECS,HIT_VARIANTS,WEAPON_HITS} from './g5-audio-bank.mjs';
// @ts-expect-error Existing checked-by-SHA JavaScript synthesis.
import {createSampleBank} from '../../src/audio/synthesis.mjs';
// @ts-expect-error Isolated JavaScript policy, validated by independent Node tests.
import {FX_COPIES,DEFAULT_SETTINGS,eventSound,voiceDecision,createRequestGate} from './g5-audio-policy.mjs';
import {auditionTimeline,type AuditionEvent} from './g5-audio-timeline';
import type {WeaponId} from '../../src/combat-config';
type Request={id:string;rate:number;gain:number;priority:number};
type AuditionOptions={bank?:any;eventPolicy?:typeof eventSound;timeline?:typeof auditionTimeline;defaultSettings?:Record<string,any>;globalName?:string;onReady?:()=>void};
export function mountAudioAudition(options:AuditionOptions={}){
const w=window as any,el=(id:string)=>document.getElementById(id)!;
const settings={...DEFAULT_SETTINGS,impact:'weapon',...options.defaultSettings},eventPolicy=options.eventPolicy??eventSound,timelineFor=options.timeline??auditionTimeline;
const globalName=options.globalName??'g5AudioAudition',readyName=globalName.replace(/Audition$/,'Ready'),errorName=globalName.replace(/Audition$/,'Error');
let game:Phaser.Game,scene:Phaser.Scene,manager:any=null,context:AudioContext|null=null,bank:any=options.bank??createAuditionBank();
let disposed=false,ready=false,held=true,pending:Promise<void>|null=null,generation=0,error='',prepareMs=0,oldPcmDoubleRenderEqual=false;
let mode:'sparse'|'crowded'='sparse',playing=false,track='none',entryPlayedCount=0,musicToken=0,elapsedFrozen=0;
let endTimer:Phaser.Time.TimerEvent|null=null,entryComplete:(()=>void)|null=null;
let musicTween:Phaser.Tweens.Tween|null=null,duckTween:Phaser.Tweens.Tween|null=null,duckHold:Phaser.Time.TimerEvent|null=null;
const musicGain={base:1,duck:1},cached=new Set<string>(),timers=new Set<Phaser.Time.TimerEvent>(),gate=createRequestGate();
const trace:any[]=[],stats={requested:0,played:0,dropped:0,preemptions:0,maxEffectsPlaying:0,maxActiveSources:0,maxMusicSources:0};
let buffersBytes=0,extraBufferBytes=0,currentEvent='点击开启试听后才会发声',plannedAt:number|null=null;
let activeImpact='none',hitBufferBytes=0,retiredHitSources=0;
const activeEffects=new Map<string,{variant:string;bytes:number}>();let retiredEffectSources=0;
const musics=['courtyard','boss-entry','boss-loop'];
function sounds():any[]{return manager?.sounds||[];}
function musicSound(id:string){return sounds().find(s=>s.g5Music===id);}
function selectedHit(){return settings.impact==='adopted'?WEAPON_HITS[settings.weapon]:settings.comparison==='old'?'original':settings.impact==='weapon'?WEAPON_HITS[settings.weapon]:settings.impact;}
function bufferFingerprint(id:string){const buffer=sounds().find(s=>s.g5?.id===id)?.audioBuffer;if(!buffer)return '';let h=2166136261;for(let i=0;i<buffer.numberOfChannels;i++){const c=buffer.getChannelData(i);for(const b of new Uint8Array(c.buffer,c.byteOffset,c.byteLength)){h^=b;h=Math.imul(h,16777619);}}return (h>>>0).toString(16).padStart(8,'0');}
function replaceHitBuffer(variant:string){
 if(!manager||!context||activeImpact===variant)return;
 const previous=sounds().filter(s=>s.g5?.id==='hit');retiredHitSources=0;
 for(const sound of previous){manager.remove(sound);retiredHitSources+=Number(!!sound.source)+Number(!!sound.loopSource);}
 const key='g5-audition-hit';game.cache.audio.remove(key);buffersBytes-=hitBufferBytes;if(activeImpact!=='original')extraBufferBytes-=hitBufferBytes;
 const channels=bank.hit(variant),buffer=context.createBuffer(channels.length,channels[0].length,44100);channels.forEach((c:Float32Array,i:number)=>buffer.getChannelData(i).set(c));game.cache.audio.add(key,buffer);
 hitBufferBytes=channels[0].byteLength*channels.length;buffersBytes+=hitBufferBytes;if(variant!=='original')extraBufferBytes+=hitBufferBytes;activeImpact=variant;
 for(let i=0;i<FX_COPIES.hit;i++){const sound=manager.add(key);sound.g5={id:'hit',priority:0,impact:variant};}
}
function effectChannels(id:string){return bank.effect?bank.effect(id,settings):bank.short(id);}
function effectVariant(id:string){return bank.effectVariant?bank.effectVariant(id,settings):id;}
function replaceEffects(){
 if(!manager||!context||!bank.effect)return;
 retiredEffectSources=0;
 for(const id of ['critical','hurt','shield-break']){
  const variant=effectVariant(id),previous=activeEffects.get(id);if(previous?.variant===variant)continue;
  const channels=effectChannels(id),buffer=context.createBuffer(channels.length,channels[0].length,44100);channels.forEach((c:Float32Array,i:number)=>buffer.getChannelData(i).set(c));
  for(const sound of sounds().filter(s=>s.g5?.id===id)){manager.remove(sound);retiredEffectSources+=Number(!!sound.source)+Number(!!sound.loopSource);}
  const key='g5-audition-'+id;game.cache.audio.remove(key);buffersBytes-=previous?.bytes??0;extraBufferBytes-=previous?.bytes??0;game.cache.audio.add(key,buffer);
  const bytes=channels.reduce((n:number,c:Float32Array)=>n+c.byteLength,0);buffersBytes+=bytes;extraBufferBytes+=bytes;activeEffects.set(id,{variant,bytes});
  for(let i=0;i<(FX_COPIES as any)[id];i++){const sound=manager.add(key);sound.g5={id,priority:0,variant};}
 }
}
function releasePrepared(){
 ready=false;game.events.off('destroy',manager?.destroy,manager);
 if(manager){const previous=game.config.audio.context;try{game.config.audio.context=context??undefined;manager.destroy();}finally{game.config.audio.context=previous;}manager=null;}
 for(const key of cached)game.cache.audio.remove(key);cached.clear();activeEffects.clear();buffersBytes=0;extraBufferBytes=0;hitBufferBytes=0;activeImpact='none';
}
function updateBuffers(){try{replaceHitBuffer(selectedHit());replaceEffects();if(bank.info().extraPcmBytes+extraBufferBytes>512*1024)throw Error('候选声音超过独立试听内存预算');return true;}catch(e){error=String(e);w[errorName]=error;held=true;silence();releasePrepared();return false;}}
function log(item:any){trace.push({...item,plannedAt,contextTime:context?.currentTime??0,elapsed:endTimer?.getElapsed()??elapsedFrozen});if(trace.length>2048)trace.shift();}
function counts(){const all=sounds(),fx=all.filter(s=>s.g5&&s.isPlaying),music=all.filter(s=>s.g5Music);const musicSources=music.reduce((n,s)=>n+Number(!!s.source)+Number(!!s.loopSource),0),activeSources=all.reduce((n,s)=>n+Number(!!s.source)+Number(!!s.loopSource),0);stats.maxEffectsPlaying=Math.max(stats.maxEffectsPlaying,fx.length);stats.maxActiveSources=Math.max(stats.maxActiveSources,activeSources);stats.maxMusicSources=Math.max(stats.maxMusicSources,musicSources);return {effectsPlaying:fx.length,activeSources,musicSources};}
function audible(){return ready&&!disposed&&!held&&!settings.muted&&context?.state==='running'&&!manager?.locked;}
function musicVolumes(){for(const id of musics){const s=musicSound(id);if(s){s.g5TargetVolume=settings.musicVolume*musicGain.base*musicGain.duck;s.volume=s.g5TargetVolume;}}}
function cancelDuck(){duckTween?.remove();duckTween=null;if(duckHold){scene.time.removeEvent(duckHold);timers.delete(duckHold);duckHold.destroy();duckHold=null;}musicGain.duck=1;musicVolumes();}
function stopMusic(){musicToken++;musicTween?.remove();musicTween=null;if(entryComplete)musicSound('boss-entry')?.off('complete',entryComplete);entryComplete=null;for(const id of musics)musicSound(id)?.stop();track='none';musicGain.base=1;}
function startLoop(id:string,fade=false){const s=musicSound(id);if(!s)return;musicGain.base=fade?0:1;track=id;s.play({loop:true,volume:settings.musicVolume*musicGain.base*musicGain.duck});musicVolumes();if(fade)musicTween=scene.tweens.add({targets:musicGain,base:1,duration:300,onUpdate:musicVolumes,onComplete(){musicTween=null;}});}
function syncMusic(allowEntry=false){
 if(manager)manager.mute=!audible();
 if(!audible()||!settings.music||settings.track==='off'){stopMusic();return;}
 const intended=settings.track==='boss'?'boss-loop':'courtyard';
 if(track===intended||(track==='boss-entry'&&intended==='boss-loop')){musicVolumes();return;}
 stopMusic();
 if(intended==='boss-loop'&&allowEntry){
  track='boss-entry';entryPlayedCount++;const token=musicToken,entry=musicSound('boss-entry');
  entryComplete=()=>{entryComplete=null;if(token===musicToken&&audible()&&settings.music&&settings.track==='boss')startLoop('boss-loop',true);};
  entry.once('complete',entryComplete);entry.play({loop:false,volume:settings.musicVolume*musicGain.duck});musicVolumes();
 }else startLoop(intended);
}
function duck(){
 if(!audible()||!settings.music)return;cancelDuck();
 duckTween=scene.tweens.add({targets:musicGain,duck:.7,duration:50,onUpdate:musicVolumes,onComplete(){duckTween=null;duckHold=scene.time.delayedCall(100,()=>{if(duckHold)timers.delete(duckHold);duckHold=null;duckTween=scene.tweens.add({targets:musicGain,duck:1,duration:250,onUpdate:musicVolumes,onComplete(){duckTween=null;}});});timers.add(duckHold);}});
}
function prepare(){
 if(manager||!context)return;const start=performance.now(),ctx=context;
 const oldConfig=game.config.audio.context;
 try{game.config.audio.context=ctx;manager=new (WebAudioSoundManager as any)(game);}finally{game.config.audio.context=oldConfig;}
 game.events.off('visible',manager.onGameVisible,manager);manager.pauseOnBlur=false;manager.volume=.3;manager.mute=true;
 // Canonical original PCM is shared by both comparison modes. Verify the independent original generator too.
 const verification=createSampleBank();oldPcmDoubleRenderEqual=true;
 if(bank.prewarm)bank.prewarm();else for(const spec of HIT_VARIANTS)bank.hit(spec.id);
 function equal(a:Float32Array[],b:Float32Array[]){return a.length===b.length&&a.every((c,j)=>c.length===b[j].length&&c.every((v,i)=>Object.is(v,b[j][i])));}
 for(const spec of ALL_SOUND_SPECS){
  const originalChannels=bank.short(spec.id);if(['slingshot','hit','defeat','hurt'].includes(spec.id)&&!equal(originalChannels,verification.short(spec.id)))oldPcmDoubleRenderEqual=false;
  const channels=spec.id==='hit'?bank.hit(selectedHit()):bank.effect&&['critical','hurt','shield-break'].includes(spec.id)?effectChannels(spec.id):originalChannels;
  const key='g5-audition-'+spec.id,buffer=ctx.createBuffer(channels.length,channels[0].length,44100);channels.forEach((c:Float32Array,i:number)=>buffer.getChannelData(i).set(c));
  game.cache.audio.add(key,buffer);cached.add(key);buffersBytes+=channels[0].byteLength*channels.length;if(!['slingshot','hit','defeat','hurt'].includes(spec.id)||(spec.id==='hit'&&selectedHit()!=='original'))extraBufferBytes+=channels[0].byteLength*channels.length;
  if(spec.id==='hit'){activeImpact=selectedHit();hitBufferBytes=channels[0].byteLength*channels.length;}
  if(bank.effect&&['critical','hurt','shield-break'].includes(spec.id)){const bytes=channels.reduce((n:number,c:Float32Array)=>n+c.byteLength,0);activeEffects.set(spec.id,{variant:effectVariant(spec.id),bytes});if(spec.id==='hurt')extraBufferBytes+=bytes;}
  for(let i=0;i<(FX_COPIES as any)[spec.id];i++){const sound=manager.add(key);sound.g5={id:spec.id,priority:0,...(spec.id==='hit'?{impact:activeImpact}:{}),...(activeEffects.has(spec.id)?{variant:effectVariant(spec.id)}:{})};}
 }
 for(const id of musics){
  const channels=id==='courtyard'?bank.music():id==='boss-loop'?bank.bossLoop():bank.bossEntry();
  if(!equal(channels,id==='courtyard'?verification.music():id==='boss-loop'?verification.bossLoop():verification.bossEntry()))oldPcmDoubleRenderEqual=false;
  const key='g5-audition-'+id,buffer=ctx.createBuffer(channels.length,channels[0].length,44100);channels.forEach((c:Float32Array,i:number)=>buffer.getChannelData(i).set(c));game.cache.audio.add(key,buffer);cached.add(key);buffersBytes+=channels[0].byteLength*channels.length;manager.add(key).g5Music=id;
 }
 if(bank.info().extraPcmBytes+extraBufferBytes>512*1024)throw Error('候选声音超过独立试听内存预算');prepareMs=performance.now()-start;
}
function silence(){if(manager){manager.mute=true;manager.stopAll();}stopMusic();cancelDuck();gate.clear();}
async function enable(){
 if(disposed)return;held=false;
 const token=generation;
 if(pending){await pending;if(!disposed&&!held&&token===generation&&!ready)return enable();return;}
 try{if(!context)context=new AudioContext();}catch(e){error=String(e);w[errorName]=error;held=true;return;}
 if(manager&&context.state==='running')syncMusic(settings.track==='boss'&&entryPlayedCount===0);
 const ctx=context;
 pending=(async()=>{try{await ctx.resume();if(disposed||held||token!==generation)return;if(ctx.state!=='running')throw Error('声音没有成功开启');prepare();replaceEffects();ready=true;error='';delete w[errorName];syncMusic(settings.track==='boss'&&entryPlayedCount===0);}catch(e){if(!disposed){error=String(e);w[errorName]=error;held=true;silence();releasePrepared();}}finally{pending=null;}})();return pending;
}
function request(request:Request,bypassGate=false){
 stats.requested++;
 if(!audible()||!settings.effects){stats.dropped++;log({...request,status:'dropped',reason:'silent'});return false;}
 if(!bypassGate&&!gate.accept(request.id,context!.currentTime*1000)){stats.dropped++;log({...request,status:'dropped',reason:'gate'});return false;}
 const choice=voiceDecision(sounds(),request);
 if(!choice.voice){stats.dropped++;log({...request,status:'dropped',reason:choice.reason});return false;}
 if(choice.stop){choice.stop.stop();stats.preemptions++;}
 const sound=choice.voice;sound.g5.priority=request.priority;sound.g5.playGain=request.gain;
 if(sound.play({loop:false,rate:request.rate,volume:settings.effectsVolume*request.gain})){
  stats.played++;log({...request,...(request.id==='hit'?{impact:activeImpact}:{}),...(activeEffects.has(request.id)?{variant:activeEffects.get(request.id)!.variant}:{}),status:'played',nativeRate:sound.rate,effectiveVolume:sound.volume,sourcePresent:!!sound.source});
  if(request.id==='hurt'||request.id==='shield-break')duck();counts();return true;
 }
 stats.dropped++;log({...request,status:'dropped',reason:'native-play-rejected'});return false;
}
function event(fact:Partial<AuditionEvent>){const sound=eventPolicy(fact,settings.weapon,settings.comparison);currentEvent=fact.label||({fire:'主武器发射',contact:fact.critical?'暴击示意':'普通命中示意',damage:fact.hpLost?'生命下降示意':fact.shieldBroke?'破盾示意':'护盾吸收 · 无短声',xp:'经验拾取示意',defeat:'击败示意'} as any)[fact.type!]||'单声试听';plannedAt=fact.at??null;try{if(sound)request(sound);else log({status:'silent-fact',type:fact.type});}finally{plannedAt=null;}}
function removeTimers(){for(const t of timers){scene.time.removeEvent(t);t.destroy();}timers.clear();endTimer=null;}
function stop(){generation++;held=true;playing=false;elapsedFrozen=0;removeTimers();scene.time.paused=false;scene.tweens.resumeAll();silence();trace.length=0;Object.keys(stats).forEach(k=>(stats as any)[k]=0);currentEvent='已停止，可重新试听';render();}
function pause(){if(disposed)return;generation++;held=true;if(endTimer)elapsedFrozen=endTimer.getElapsed();scene.time.paused=true;scene.tweens.pauseAll();silence();currentEvent='已暂停，点击继续后恢复后续示意';render();}
async function resume(){if(disposed)return;await enable();if(!audible())return;scene.time.paused=false;scene.tweens.resumeAll();syncMusic();currentEvent=playing?'继续后续示意 · 不补播旧短声':'可以单听或重播';render();}
async function play(density:'sparse'|'crowded'=mode){
 stop();mode=density;const token=generation;await enable();if(disposed||token!==generation||!audible())return;
 playing=true;scene.time.paused=false;scene.tweens.resumeAll();const timeline=timelineFor(settings.weapon as WeaponId,density);
 for(const fact of timeline.events){const timer=scene.time.delayedCall(fact.at,()=>{timers.delete(timer);event(fact);});timers.add(timer);}
 const finish=scene.time.delayedCall(timeline.duration,()=>{timers.delete(finish);playing=false;elapsedFrozen=timeline.duration;silence();held=true;currentEvent='本段结束，可切换旧／候选再重播';render();});timers.add(finish);endTimer=finish;render();
}
async function selectImpact(variant:'original'|'thick'|'crisp'|'weapon',listen=true){
 if(disposed||!['original','thick','crisp','weapon'].includes(variant))return;stop();const token=generation;settings.impact=variant;settings.comparison='candidate';(el('comparison') as HTMLSelectElement).value='candidate';replaceHitBuffer(selectedHit());if(settings.muted){currentEvent='已选择命中版本，取消静音后点击继续';render();return;}
 await enable();if(token!==generation||disposed)return;if(!ready)await enable();if(token!==generation||!audible())return;replaceHitBuffer(selectedHit());
 currentEvent=({original:'原版命中',thick:'厚实短击A',crisp:'清脆弹击B',weapon:'随武器命中'})[variant];if(listen)request(variant==='weapon'?eventSound({type:'contact'},settings.weapon,'candidate'):{id:'hit',rate:1,gain:1,priority:2});render();
}
async function singleWeapon(weapon:WeaponId,phase:'fire'|'hit'='fire'){
 if(disposed||!['W01','W04','W02'].includes(weapon)||!['fire','hit'].includes(phase))return;stop();const token=generation;settings.weapon=weapon;if(settings.impact!=='adopted'){settings.impact='weapon';settings.comparison='candidate';}(el('weapon') as HTMLSelectElement).value=weapon;(el('comparison') as HTMLSelectElement).value=settings.comparison;if(!updateBuffers())return;
 if(settings.muted){currentEvent='已选择武器声音，取消静音后点击继续';render();return;}await enable();if(token!==generation||disposed)return;if(!ready)await enable();if(token!==generation||!audible())return;replaceHitBuffer(selectedHit());
 currentEvent=({W01:{fire:'铃铛 · 弹弓发射',hit:'铃铛 · 短促弹击'},W04:{fire:'小鱼干 · 短飞掠',hit:'小鱼干 · 干脆穿刺'},W02:{fire:'鱼骨 · 短闷炮',hit:'鱼骨 · 小爆破'}})[weapon][phase];const sound=eventPolicy({type:phase==='fire'?'fire':'contact'},weapon,settings.comparison);if(sound)request(sound);render();
}
async function single(id:string){if(id==='hit')return settings.impact==='adopted'?singleWeapon(settings.weapon,'hit'):selectImpact('original');if(playing||settings.impact==='adopted')stop();const token=generation;await enable();if(token!==generation||disposed)return;if(!ready)await enable();if(token!==generation||!audible())return;scene.time.paused=false;scene.tweens.resumeAll();currentEvent=ALL_SOUND_SPECS.find((s:any)=>s.id===id)?.label||id;request({id,rate:1,gain:id==='xp'?.7:1,priority:({hurt:4,'shield-break':4,critical:3,xp:1,defeat:1} as any)[id]||2});render();}
async function singleCritical(weapon:WeaponId=settings.weapon){if(disposed||!['W01','W04','W02'].includes(weapon))return;configure({weapon});(el('weapon') as HTMLSelectElement).value=weapon;return single('critical');}
async function singleImportant(id:'hurt'|'shield-break'){if(id==='hurt'||id==='shield-break')return single(id);}
function configure(value:Partial<typeof settings>){
 if((value.comparison!==undefined&&value.comparison!==settings.comparison)||(value.weapon!==undefined&&value.weapon!==settings.weapon))stop();
 const previous=settings.track;Object.assign(settings,value);settings.musicVolume=Math.max(0,Math.min(1,settings.musicVolume));settings.effectsVolume=Math.max(0,Math.min(1,settings.effectsVolume));
 if(settings.muted){pause();currentEvent='已静音，取消勾选后点击继续';}
 if(!settings.effects){for(const s of sounds().filter(s=>s.g5))s.stop();gate.clear();}
 else for(const s of sounds().filter(s=>s.g5&&s.isPlaying))s.volume=settings.effectsVolume*(s.g5.playGain??1);
 if(!updateBuffers()){render();return;}if(previous!==settings.track)stopMusic();syncMusic(previous!==settings.track&&settings.track==='boss');musicVolumes();render();
}
function snapshot(){
 const all=sounds(),c=counts(),music=musicSound(track),nativeClock:any=scene?.time;
 return {ready:audible(),prepared:ready,disposed,held,pending:!!pending,error,contextState:context?.state??'not-created',nativeSounds:all.length,audioBuffers:cached.size,audioBufferBytes:buffersBytes,extraAudioBufferBytes:extraBufferBytes,uniqueNativeBufferCount:new Set(all.map(s=>s.audioBuffer)).size,actualNativeBufferBytes:[...new Set(all.map(s=>s.audioBuffer))].reduce((bytes,buffer)=>bytes+(buffer?buffer.length*buffer.numberOfChannels*4:0),0),hitBufferCount:new Set(all.filter(s=>s.g5?.id==='hit').map(s=>s.audioBuffer)).size,
  selectedImpact:settings.impact,activeImpact,hitBufferBytes,hitBufferFingerprint:bufferFingerprint('hit'),fireBufferFingerprint:bufferFingerprint(eventPolicy({type:'fire'},settings.weapon,settings.comparison).id),retiredHitSources,retiredEffectSources,criticalBufferCount:new Set(all.filter(s=>s.g5?.id==='critical').map(s=>s.audioBuffer)).size,effectBufferFingerprints:['critical','hurt','shield-break'].reduce((value:any,id)=>(value[id]=bufferFingerprint(id),value),{}),activeEffectVariants:[...activeEffects].reduce((value:any,[id,effect])=>(value[id]=effect.variant,value),{}),candidatePcmPlusActiveAudioBufferBytes:(bank?.info().extraPcmBytes??0)+extraBufferBytes,
  ...c,...stats,settings:{...settings},mode,playing,elapsed:endTimer?.getElapsed()??elapsedFrozen,timerEvents:timers.size,nativeClockPaused:nativeClock?.paused??false,track,currentTrack:track,entryPlayedCount,musicBaseGain:musicGain.base,duckGain:musicGain.duck,musicTargetVolume:music?.g5TargetVolume??0,musicActualVolume:music?.volume??0,musicEffectiveGain:.3*settings.musicVolume*musicGain.base*musicGain.duck,masterVolume:manager?.volume??.3,prepareMs,oldPcmDoubleRenderEqual,pcm:bank?.info()??null,currentEvent,trace:trace.map(t=>({...t})),nativeSoundDetails:all.map(s=>({id:s.g5?.id||s.g5Music,playing:s.isPlaying,rate:s.rate,volume:s.volume,hasSource:!!s.source,hasLoopSource:!!s.loopSource})),source:'independent fixed audition; no actual battle, damage or probability'};
}
function dispose(){if(disposed)return;stop();disposed=true;releasePrepared();bank=null;if(context&&context.state!=='closed')void context.close();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',onBlur);game.destroy(true);}
function onVisibility(){if(document.hidden)pause();}
function onBlur(){pause();}
let pulse:Phaser.GameObjects.Arc|null=null;
function render(){
 if(!scene)return;const s=snapshot();el('status').textContent=error?'声音不可用：'+error:currentEvent;el('progress').textContent=`${(s.elapsed/1000).toFixed(1)} / 14秒 · ${s.held?'等待明确操作':s.playing?'示意播放中':'单听已准备'}`;
 el('event').textContent=currentEvent;el('meter').textContent=`本段已响 ${s.played} 次 · 已省略 ${s.dropped} 次`;const impactLabel=({original:'原版命中',thick:'厚实短击A',crisp:'清脆弹击B',weapon:'随武器：铃铛短击／小鱼干穿刺／鱼骨爆破'} as Record<string,string>)[settings.impact];el('impact-current').textContent=settings.impact==='adopted'?`${settings.comparison==='old'?'当前已采用':'本批候选'} · 普通命中与音乐A保持当前采用版`:settings.comparison==='old'?`原四音色对照使用原版命中 · 候选已选：${impactLabel}`:`候选普通命中：${impactLabel}`;for(const button of Array.from(document.querySelectorAll<HTMLElement>('[data-impact]')))button.setAttribute('aria-pressed',String(button.dataset.impact===settings.impact));if(pulse)pulse.setFillStyle(held?0xc8cdb6:s.effectsPlaying?0xe7ae54:0x8aab80);
}
const api={enable,play,pause,resume,continue:resume,stop,single,selectImpact,singleWeapon,singleCritical,singleImportant,event,request,configure,snapshot,dispose};
class AuditionScene extends Phaser.Scene{constructor(){super(globalName);}create(){scene=this;pulse=this.add.circle(180,35,16,0xc8cdb6);this.add.text(180,65,'声音节奏示意',{fontSize:'14px',color:'#526044'}).setOrigin(.5);w[globalName]=api;
 for(const [id,fn] of Object.entries({enable:()=>enable().then(render),sparse:()=>play('sparse'),crowded:()=>play('crowded'),pause,continue:resume,stop,replay:()=>play(mode)}))el(id).addEventListener('click',fn as EventListener);
 for(const button of Array.from(document.querySelectorAll<HTMLElement>('[data-sound]')))button.addEventListener('click',()=>single(button.dataset.sound!));
 for(const button of Array.from(document.querySelectorAll<HTMLElement>('[data-impact]')))button.addEventListener('click',()=>selectImpact(button.dataset.impact as 'original'|'thick'|'crisp'|'weapon'));
 for(const button of Array.from(document.querySelectorAll<HTMLElement>('[data-weapon][data-phase]')))button.addEventListener('click',()=>singleWeapon(button.dataset.weapon as WeaponId,button.dataset.phase as 'fire'|'hit'));
 for(const id of ['weapon','comparison','music'])el(id).addEventListener('change',()=>{const key=id==='music'?'track':id;configure({[key]:(el(id) as HTMLSelectElement).value});if(playing){pause();currentEvent='已切换，点击重播听完整对照';}});
 for(const [id,key] of [['music-enabled','music'],['effects-enabled','effects'],['muted','muted']])el(id).addEventListener('change',()=>configure({[key]:(el(id) as HTMLInputElement).checked}));
 for(const [id,key] of [['music-volume','musicVolume'],['effects-volume','effectsVolume']])el(id).addEventListener('input',()=>configure({[key]:Number((el(id) as HTMLInputElement).value)}));
 document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',onBlur);render();options.onReady?.();w[readyName]=true;}update(){render();}}
try{game=new Phaser.Game({type:Phaser.CANVAS,width:360,height:88,parent:'stage',backgroundColor:'#f0f2df',audio:{noAudio:true},fps:{min:20,target:60},scene:AuditionScene,banner:false,input:{keyboard:false,mouse:false,touch:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});}catch(e){w[errorName]=String(e);el('status').textContent='试听页加载失败：'+String(e);}
return api;
}
if(document.querySelector('script[src*="g5-audio-audition.js"]'))mountAudioAudition();
