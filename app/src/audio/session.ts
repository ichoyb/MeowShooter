import type {WeaponId} from '../combat-config';
// @ts-expect-error Fixed adopted JS parameter data is checked independently against the audition.
import {WEAPON_AUDIO,WEAPON_CRITICAL_AUDIO} from './combat-data.mjs';
export type EffectId = 'slingshot' | 'fish-shot' | 'bone-shot' | 'hit' | 'critical' | 'defeat' | 'hurt' | 'shield-break' | 'xp';
export type AudioFact = {type:'fire';at:number;volleyId:number}|{type:'hit';at:number;critical:boolean;targetId:number;killed:boolean;targetKind:string}|{type:'incoming';at:number;accepted:boolean;hpLost:number;shieldBroke:boolean}|{type:'xp';at:number;amount:number};
export type StoryKind = 'opening' | 'ending';
type StoryStems = {music:Float32Array[];world:Float32Array[]};
type Location = 'silent' | 'courtyard' | 'battle';
type MusicId = 'music' | 'boss-loop' | 'boss-entry';
type CurrentTrack = 'none' | 'courtyard' | 'boss-loop' | 'boss-entry';
type NativeSound = {isPlaying:boolean;isPaused:boolean;seek:number;source:unknown;loopSource:unknown;volume:number;rate?:number;listenerCount?(event:string):number;play(config:{volume:number;loop:boolean;rate?:number;seek?:number}):boolean;pause():boolean;resume():boolean;stop():unknown;once(event:'complete',listener:()=>void):unknown;off(event:'complete',listener:()=>void):unknown};
type NativeManager = {mute:boolean;volume:number;locked?:boolean;sounds:NativeSound[];stopAll():void;add(key:string):NativeSound;remove(sound:NativeSound):unknown;destroy():void};
type Fade = {gain:number};
type TweenConfig = {targets:Fade;gain:number;duration:number;onUpdate():void;onComplete():void};
type Dependencies = {
 makeContext():AudioContext;makeManager(context:AudioContext):NativeManager;
 cache:{add(key:string,buffer:AudioBuffer):unknown;remove(key:string):unknown};
 samples:{short(id:EffectId,weapon?:WeaponId):Float32Array[];hit(weapon:WeaponId):Float32Array[];music():Float32Array[];bossLoop():Float32Array[];bossEntry():Float32Array[];story?(kind:StoryKind):StoryStems|Promise<StoryStems>};
 makeTween(config:TweenConfig):{remove():unknown};makeDelay(ms:number,callback:()=>void):{remove():unknown};
};
const COPIES:Record<EffectId,number>={slingshot:1,'fish-shot':1,'bone-shot':1,hit:3,critical:2,hurt:2,'shield-break':1,xp:1,defeat:1};
const PRIORITY:Record<EffectId,number>={hurt:4,'shield-break':4,critical:3,hit:2,slingshot:2,'fish-shot':2,'bone-shot':2,xp:1,defeat:1};
const GATES:Partial<Record<EffectId,number>>={hit:80,critical:120,defeat:100,xp:120};
export function createAudioSession({makeContext,makeManager,cache,samples,makeTween,makeDelay}:Dependencies) {
 const ids=Object.keys(COPIES) as EffectId[],sounds=new Map<string,NativeSound>(),voices:{id:EffectId;sound:NativeSound;gain:number}[]=[],cached=new Set<string>();
 const musicIds:MusicId[]=['music','boss-loop','boss-entry'];
 const gains:Record<MusicId,Fade>={music:{gain:1},'boss-loop':{gain:1},'boss-entry':{gain:1}},duckGain:Fade={gain:1};
 let context:AudioContext|null=null,manager:NativeManager|null=null,pending:Promise<void>|null=null,pendingGeneration=-1,generation=0,disposed=false,ready=false,held=false,location:Location='silent',error='',bufferBytes=0,weapon:WeaponId='W01';
 let bossActive=false,currentTrack:CurrentTrack='none',entryPlayedCount=0,musicGeneration=0,tween:ReturnType<Dependencies['makeTween']>|null=null,entryComplete:(()=>void)|null=null;
 let duckGeneration=0,duckTween:ReturnType<Dependencies['makeTween']>|null=null,duckHold:ReturnType<Dependencies['makeDelay']>|null=null,maxEffectsPlaying=0,maxActiveSources=0,preempted=0,rewardCues=0;
 const bufferBytesByTrack:Record<string,number>={},previous=new Map<EffectId,number>(),recentFacts:(AudioFact&{weapon:WeaponId})[]=[];
 const settings={music:true,effects:true,musicVolume:.65,effectsVolume:.65};
 const storySounds=new Map<'music'|'world',NativeSound>(),storyComplete=new Map<NativeSound,()=>void>();
 let storyKind:StoryKind|null=null,storyGeneration=0,storyWanted=false,storyPosition=0,storyDuration=0,storyError='';
 let storyLoad:{kind:StoryKind;pcm:Promise<StoryStems>}|null=null;
 const events=ids.reduce((result,id)=>{result[id]=0;return result;},{} as Record<EffectId,number>),played={...events},dropped={...events},dropReasons:Record<string,number>={};
 function cancelTransition(){musicGeneration++;tween?.remove();tween=null;if(entryComplete)sounds.get('boss-entry')?.off('complete',entryComplete);entryComplete=null;}
 function stopMusic(){cancelTransition();for(const id of musicIds)sounds.get(id)?.stop();currentTrack='none';}
 function musicVolumes(){for(const id of musicIds){const sound=sounds.get(id);if(sound)sound.volume=settings.musicVolume*gains[id].gain*duckGain.gain;}}
 function cancelDuck(){duckGeneration++;duckTween?.remove();duckTween=null;duckHold?.remove();duckHold=null;duckGain.gain=1;musicVolumes();}
 function silence(){try{cancelDuck();previous.clear();stopMusic();if(manager){manager.mute=true;manager.stopAll();}}catch(e){error=e instanceof Error?e.message:String(e);ready=false;held=true;}}
 function fail(reason:unknown){error=reason instanceof Error?reason.message:String(reason);ready=false;held=true;silence();}
 function audible(){return ready&&!disposed&&!held&&!storyWanted&&location!=='silent'&&context?.state==='running'&&!manager?.locked;}
 function musicAllowed(){return audible()&&settings.music;}
 function playMusic(id:MusicId,gain=1){const sound=sounds.get(id)!;gains[id].gain=gain;currentTrack=id==='music'?'courtyard':id;if(!sound.play({loop:id!=='boss-entry',volume:settings.musicVolume*gain*duckGain.gain})){currentTrack='none';return false;}return true;}
 function fade(id:MusicId,to:number,duration:number,token:number,complete:()=>void){tween=makeTween({targets:gains[id],gain:to,duration,onUpdate(){if(token===musicGeneration&&musicAllowed())try{musicVolumes();}catch(e){fail(e);}},onComplete(){if(token!==musicGeneration||!musicAllowed())return;tween=null;try{complete();}catch(e){fail(e);}}});}
 function bossEntry(){
  const token=musicGeneration,begin=()=>{
   if(token!==musicGeneration||!musicAllowed()||!bossActive)return;sounds.get('music')!.stop();currentTrack='none';const entry=sounds.get('boss-entry')!;
   entryComplete=()=>{if(token!==musicGeneration||!musicAllowed()||!bossActive)return;entryComplete=null;currentTrack='none';try{if(playMusic('boss-loop',0))fade('boss-loop',1,300,token,()=>{});}catch(e){fail(e);}};
   entry.once('complete',entryComplete);if(playMusic('boss-entry'))entryPlayedCount++;else{entry.off('complete',entryComplete);entryComplete=null;}
  };if(sounds.get('music')!.isPlaying)fade('music',0,200,token,begin);else begin();
 }
 function duck(){
  cancelDuck();if(!musicAllowed())return;const token=duckGeneration;
  const valid=()=>token===duckGeneration&&musicAllowed();
  duckTween=makeTween({targets:duckGain,gain:.7,duration:50,onUpdate(){if(valid())musicVolumes();},onComplete(){
   if(!valid())return;duckTween=null;duckHold=makeDelay(100,()=>{if(!valid())return;duckHold=null;duckTween=makeTween({targets:duckGain,gain:1,duration:250,onUpdate(){if(valid())musicVolumes();},onComplete(){if(valid()){duckTween=null;musicVolumes();}}});});
  }});
 }
 function sync(){
  if(!manager)return;if(storyWanted)return;const active=audible();manager.mute=!active;
  for(const v of voices){v.sound.volume=settings.effectsVolume*v.gain;if(!active||!settings.effects)v.sound.stop();}
  if(!active||!settings.music){cancelDuck();stopMusic();return;}musicVolumes();if(currentTrack==='none')playMusic(bossActive?'boss-loop':'music');
 }
 function cacheBuffer(ctx:AudioContext,id:string,channels:Float32Array[]){
  const buffer=ctx.createBuffer(channels.length,channels[0].length,44100);channels.forEach((channel,index)=>buffer.getChannelData(index).set(channel));const key='f1-'+id;
  cached.add(key);cache.add(key,buffer);const bytes=channels.length*channels[0].length*4;bufferBytesByTrack[id]=bytes;bufferBytes+=bytes;return key;
 }
 function addVoices(native:NativeManager,id:EffectId,key:string){for(let i=0;i<COPIES[id];i++)voices.push({id,sound:native.add(key),gain:1});}
 function releasePrepared(native=manager){
  let failure:unknown;try{native?.destroy();}catch(e){failure=e;}
  manager=null;for(const key of cached)try{cache.remove(key);}catch(e){failure??=e;}
  cached.clear();voices.length=0;sounds.clear();storySounds.clear();storyComplete.clear();storyLoad=null;storyWanted=false;storyKind=null;storyPosition=0;storyDuration=0;bufferBytes=0;for(const id of Object.keys(bufferBytesByTrack))delete bufferBytesByTrack[id];
  if(failure)throw failure;
 }
 function prepare(ctx:AudioContext){
  if(manager)return;let candidate:NativeManager|null=null;
  try{candidate=makeManager(ctx);candidate.volume=.3;candidate.mute=true;
   // All weapon-dependent PCM is prepared at the original explicit unlock boundary.
   // A later paused weapon swap only replaces native buffers; requests never synthesize.
   for(const value of ['W01','W04','W02'] as const){samples.hit(value);samples.short('critical',value);}
   for(const id of ids){const key=cacheBuffer(ctx,id,id==='hit'?samples.hit(weapon):samples.short(id,weapon));addVoices(candidate,id,key);}
   for(const id of musicIds){const key=cacheBuffer(ctx,id,id==='music'?samples.music():id==='boss-loop'?samples.bossLoop():samples.bossEntry());sounds.set(id,candidate.add(key));}
   manager=candidate;
  }catch(e){try{releasePrepared(candidate);}catch{}throw e;}
 }
 function unlock():Promise<void>{
  if(disposed)return Promise.resolve();if(pending){if(pendingGeneration===generation)return pending;const request=generation;return pending.then(()=>{if(!disposed&&!held&&request===generation)return unlock();});}
  const token=generation;try{if(!context)context=makeContext();}catch(e){fail(e);return Promise.resolve();}const ctx=context;
  let resumed:Promise<void>;try{resumed=ctx.resume();}catch(e){fail(e);return Promise.resolve();}pendingGeneration=token;
  pending=(async()=>{let preparedNow=false;try{await resumed;if(disposed||token!==generation||held)return;if(ctx.state!=='running')throw Error('AudioContext.resume 完成但状态为 '+ctx.state);const needsPreparation=!manager;prepare(ctx);preparedNow=needsPreparation;ready=true;error='';sync();}catch(e){if(!disposed&&token===generation){if(preparedNow)try{releasePrepared();}catch{}fail(e);}}finally{pending=null;}})();return pending;
 }
 function counts(){const active=voices.filter(v=>v.sound.isPlaying).length,sourceCount=[...voices.map(v=>v.sound),...sounds.values(),...storySounds.values()].reduce((n,s)=>n+Number(!!s.source)+Number(!!s.loopSource),0);maxEffectsPlaying=Math.max(maxEffectsPlaying,active);maxActiveSources=Math.max(maxActiveSources,sourceCount);return {effectsPlaying:active,activeSources:sourceCount};}
 function storyNow(){return Math.min(storyDuration,Math.max(0,[...storySounds.values()].find(s=>s.isPlaying)?.seek??storyPosition));}
 function releaseStory(){
  storyGeneration++;storyWanted=false;storyLoad=null;let failure:unknown;
  for(const sound of storySounds.values())try{const listener=storyComplete.get(sound);if(listener)sound.off('complete',listener);manager?.remove(sound);}catch(e){failure??=e;}
  storySounds.clear();storyComplete.clear();storyKind=null;storyPosition=0;storyDuration=0;
  for(const id of ['story-music','story-world']){const key='f1-'+id;if(!cached.has(key))continue;try{cache.remove(key);cached.delete(key);bufferBytes-=bufferBytesByTrack[id]??0;delete bufferBytesByTrack[id];}catch(e){failure??=e;}}
  if(failure){try{releasePrepared();}catch{}throw failure;}
 }
 function stopStory(){
  generation++;held=true;try{releaseStory();silence();}catch(e){try{releasePrepared();}catch{}fail(e);storyError=e instanceof Error?e.message:String(e);}
 }
 function pauseStory(){
  generation++;storyGeneration++;held=true;storyPosition=storyNow();
  if(!storyKind){releaseStory();if(manager)manager.mute=true;return 0;}
  try{for(const sound of storySounds.values())if(sound.isPlaying&&!sound.pause())throw Error('故事声音暂停失败');if(manager)manager.mute=true;}catch(e){storyError=e instanceof Error?e.message:String(e);stopStory();}
  return storyPosition;
 }
 async function playStory(kind:StoryKind,offsetSeconds:number):Promise<boolean>{
  if(disposed)return false;
  let token:number|null=null;
  try{
   if(storyKind!==kind&&storyLoad?.kind!==kind)releaseStory();
   token=++storyGeneration;storyWanted=true;storyError='';held=false;
   cancelDuck();previous.clear();stopMusic();for(const voice of voices)voice.sound.stop();if(manager)manager.mute=true;
   await unlock();if(disposed||token!==storyGeneration)return false;
   if(held)throw Error(error||'故事声音已暂停');
   if(!ready||!manager||!context||context.state!=='running'||manager.locked)throw Error(error||'故事声音尚未解锁');
   if(!storyKind){
    if(!samples.story)throw Error('故事声音未配置');
    // Only this kind is rendered. PCM is copied once into native buffers, then
    // this local source reference (including M1 review-only stems) is released.
    if(!storyLoad)storyLoad={kind,pcm:Promise.resolve(samples.story(kind))};
    const stems=await storyLoad.pcm;if(disposed||token!==storyGeneration||held)return false;storyLoad=null;
    storyKind=kind;storyDuration=stems.music[0].length/44100;
    for(const id of ['music','world'] as const){
     const key=cacheBuffer(context,'story-'+id,stems[id]),sound=manager.add(key);storySounds.set(id,sound);
    }
   }
   storyPosition=Math.min(storyDuration,Math.max(0,Number.isFinite(offsetSeconds)?offsetSeconds:0));
   for(const [id,sound] of storySounds){
    const old=storyComplete.get(sound);if(old)sound.off('complete',old);
    const complete=()=>{if(!storyWanted||storySounds.get(id)!==sound)return;storyPosition=storyDuration;if(![...storySounds.values()].some(s=>s.isPlaying)&&manager)manager.mute=true;};
    storyComplete.set(sound,complete);sound.once('complete',complete);
    const intent=id==='music'?settings.music:settings.effects;
    // Phaser's WebAudioSound.volume writes its GainNode without clamping.
    // .3 existing master × 8 local gain = the approved gallery master 2.4.
    const volume=8*(id==='music'?settings.musicVolume:settings.effectsVolume);sound.volume=volume;
    if(sound.isPlaying&&!sound.pause())throw Error('故事声音暂停失败');
    if(!intent||storyPosition>=storyDuration)continue;
    if(sound.isPaused){sound.seek=storyPosition;if(!sound.resume())throw Error('故事声音继续播放失败');}
    else if(!sound.play({loop:false,rate:1,seek:storyPosition,volume}))throw Error('故事声音播放失败');
   }
   manager.mute=![...storySounds.values()].some(s=>s.isPlaying);counts();return true;
  }catch(e){if(disposed||token!==null&&token!==storyGeneration)return false;storyError=e instanceof Error?e.message:String(e);const reason=storyError;stopStory();storyError=reason;return false;}
 }
 function request(id:EffectId,rate=1,gain=1){
  const at=(context?.currentTime??0)*1000;
  events[id]++;const drop=(reason:string)=>{dropped[id]++;dropReasons[reason]=(dropReasons[reason]??0)+1;};
  if(!audible()||location!=='battle'||!settings.effects){drop('inaudible');return;}
  const before=previous.get(id);if(before!==undefined&&at-before<(GATES[id]??0)-.001){drop('gate');return;}previous.set(id,at);
  const voice=voices.find(v=>v.id===id&&!v.sound.isPlaying);if(!voice){drop('kind-busy');return;}
  const active=voices.filter(v=>v.sound.isPlaying);
  if(active.length>=8){const lower=active.filter(v=>PRIORITY[v.id]<PRIORITY[id]).sort((a,b)=>PRIORITY[a.id]-PRIORITY[b.id])[0];if(!lower){drop('priority-full');return;}lower.sound.stop();preempted++;}
  try{voice.gain=gain;if(voice.sound.play({loop:false,rate,volume:settings.effectsVolume*gain})){played[id]++;if(id==='hurt'||id==='shield-break')duck();}else drop('native-rejected');counts();}catch(e){drop('native-error');fail(e);}
 }
 return {
  playStory,pauseStory,stopStory,
  enable(){held=false;return unlock();},
  setWeapon(value:WeaponId){if(value===weapon||disposed)return;stopStory();generation++;held=true;silence();weapon=value;recentFacts.length=0;
   if(!manager||!context)return;try{
    for(const id of ['hit','critical'] as const){
     for(const v of voices.filter(v=>v.id===id))manager.remove(v.sound);
     for(let i=voices.length-1;i>=0;i--)if(voices[i].id===id)voices.splice(i,1);
     const key='f1-'+id;cache.remove(key);cached.delete(key);bufferBytes-=bufferBytesByTrack[id];delete bufferBytesByTrack[id];
     addVoices(manager,id,cacheBuffer(context,id,id==='hit'?samples.hit(weapon):samples.short(id,weapon)));
    }
   }catch(e){try{releasePrepared();}catch{}fail(e);}
  },
  setLocation(value:Location){const clearBoss=value==='courtyard'&&bossActive;if(value===location&&!clearBoss)return;try{if(storyWanted){releaseStory();held=false;}if(clearBoss){bossActive=false;stopMusic();}location=value;if(value==='silent'){generation++;silence();}else sync();}catch(e){fail(e);}},
  setBossActive(value:boolean){if(disposed||value===bossActive)return;bossActive=value;try{cancelTransition();if(value&&location==='battle'&&musicAllowed())bossEntry();else{stopMusic();sync();}}catch(e){fail(e);}},
  pause(reason:string){stopStory();generation++;held=true;silence();if(reason==='restart'||reason==='reset')recentFacts.length=0;},
  continue(){if(disposed)return Promise.resolve();held=false;return unlock();},
  effect(id:EffectId){const policy=WEAPON_AUDIO[weapon];request(id,id==='hit'?policy.rate:1,id==='hit'?policy.gain:id==='xp'?.7:1);},
  rewardCue():void{
   if(!ready||disposed||pending||storyWanted||!settings.effects||!manager||manager.locked||context?.state!=='running')return;
   const voice=voices.find(v=>v.id==='xp');if(!voice)return;
   try{
    // Confirmation belongs to the paused UI: stop every old source before opening the shared mute gain.
    silence();if(!ready)return;voice.gain=.7;manager.mute=false;
    if(voice.sound.play({loop:false,rate:1,volume:settings.effectsVolume*voice.gain}))rewardCues++;else manager.mute=true;
    counts();
   }catch(e){fail(e);}
  },
  consume(fact:AudioFact){
   recentFacts.push({...fact,weapon});if(recentFacts.length>16)recentFacts.shift();const policy=WEAPON_AUDIO[weapon];
   if(fact.type==='fire')request(policy.fire);
   else if(fact.type==='hit'){request(fact.critical?'critical':'hit',fact.critical?1:policy.rate,fact.critical?1:policy.gain);if(fact.killed&&fact.targetKind==='enemy')request('defeat');}
   else if(fact.type==='incoming'&&fact.accepted){if(fact.hpLost>0)request('hurt');else if(fact.shieldBroke)request('shield-break');}
   else if(fact.type==='xp'&&fact.amount>0)request('xp',1,.7);
  },
  configure(value:Partial<typeof settings>){const before={...settings};Object.assign(settings,value);for(const key of ['musicVolume','effectsVolume'] as const)settings[key]=Math.min(1,Math.max(0,settings[key]));if(storyWanted&&(Object.keys(settings) as (keyof typeof settings)[]).some(key=>before[key]!==settings[key]))stopStory();try{sync();}catch(e){fail(e);}},
  snapshot(){const c=counts(),id=currentTrack==='courtyard'?'music':currentTrack,base=id==='none'?1:gains[id].gain;return {story:{kind:storyKind,position:storyNow(),playing:[...storySounds.values()].some(s=>s.isPlaying),bufferBytes:(bufferBytesByTrack['story-music']??0)+(bufferBytesByTrack['story-world']??0),buffers:storySounds.size,error:storyError},ready:ready&&!held&&!disposed&&context?.state==='running',error,disposed,held,location,weapon,hitVariant:WEAPON_AUDIO[weapon].hit,criticalVariant:WEAPON_CRITICAL_AUDIO[weapon],musicIntent:bossActive?'boss':'normal',currentTrack,entryPlayedCount,contextState:context?.state??'not-created',pending:!!pending,settings:{...settings},events:{...events},played:{...played},dropped:{...dropped},dropReasons:{...dropReasons},preempted,rewardCues,recentFacts:recentFacts.map(f=>({...f})),nativeSounds:manager?.sounds.length??0,audioBuffers:cached.size,audioBufferBytes:bufferBytes,audioBufferBytesByTrack:{...bufferBytesByTrack},musicPlaying:musicIds.some(id=>sounds.get(id)?.isPlaying),...c,maxEffectsPlaying,maxActiveSources,musicBaseGain:base,duckGain:duckGain.gain,duckPending:!!duckTween||!!duckHold,musicEffectiveGain:.3*settings.musicVolume*base*duckGain.gain,nativeSoundDetails:[...voices.map(v=>({id:v.id,sound:v.sound})),...Array.from(sounds,([id,sound])=>({id,sound})),...Array.from(storySounds,([id,sound])=>({id:'story-'+id,sound}))].map(({id,sound:s})=>({id,playing:s.isPlaying,rate:s.rate,volume:s.volume,hasSource:!!s.source,hasLoopSource:!!s.loopSource,completeListeners:s.listenerCount?.('complete')??0}))};},
  dispose(){if(disposed)return;disposed=true;generation++;ready=false;silence();try{releasePrepared();}catch(e){error=e instanceof Error?e.message:String(e);}recentFacts.length=0;if(context&&context.state!=='closed')void context.close().catch(e=>{error=e.message||String(e);});},
 };
}
export type AudioSession = ReturnType<typeof createAudioSession>;
