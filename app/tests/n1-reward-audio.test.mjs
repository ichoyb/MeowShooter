import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const bundle=await build({entryPoints:['src/audio/session.ts'],bundle:true,write:false,format:'iife',globalName:'Session'}),scope={};
runInNewContext(bundle.outputFiles[0].text,scope);
const createAudioSession=scope.Session.createAudioSession;

// The native manager keeps playback state independent of its shared mute gain.
// This fake preserves that distinction, as well as stop-before-reuse and pending resume.
function rig(){
 const cache=new Map(),sounds=[],calls={contexts:0,buffers:0,sounds:0,resumes:0,tweens:0,delays:0};let resumeNext=null;
 const context={state:'running',currentTime:0,resume(){calls.resumes++;return resumeNext?resumeNext():Promise.resolve();},close(){this.state='closed';return Promise.resolve();},createBuffer(n,length){calls.buffers++;const channels=Array.from({length:n},()=>new Float32Array(length));return {getChannelData:i=>channels[i]};}};
 const manager={sounds,mute:true,volume:1,locked:false,stopAll(){for(const sound of sounds)sound.stop();},add(key){
  calls.sounds++;const sound=new EventEmitter();Object.assign(sound,{key,isPlaying:false,source:null,loopSource:null,volume:1,rate:1,plays:[],stops:0,reject:false,
   play(config){assert.equal(this.isPlaying,false,'the existing native voice must stop before reuse');if(this.reject)return false;this.plays.push({...config});Object.assign(this,config);this.isPlaying=true;this.source={};this.loopSource=config.loop?{}:null;return true;},
   stop(){this.stops++;this.isPlaying=false;this.source=null;this.loopSource=null;},complete(){this.stop();this.emit('complete',this);}
  });sounds.push(sound);return sound;
 },remove(sound){sound.stop();sounds.splice(sounds.indexOf(sound),1);},destroy(){this.stopAll();sounds.length=0;}};
 const samples={short:()=>[new Float32Array(4)],hit:()=>[new Float32Array(6)],music:()=>[new Float32Array(8),new Float32Array(8)],bossLoop:()=>[new Float32Array(12),new Float32Array(12)],bossEntry:()=>[new Float32Array(6),new Float32Array(6)]};
 const audio=createAudioSession({makeContext(){calls.contexts++;return context;},makeManager:()=>manager,cache:{add:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)},samples,makeTween(){calls.tweens++;return {remove(){}};},makeDelay(){calls.delays++;return {remove(){}};}});
 return {audio,cache,sounds,calls,context,manager,track:id=>sounds.find(sound=>sound.key==='f1-'+id),deferResume(){let release;resumeNext=()=>new Promise(resolve=>{release=()=>{resumeNext=null;resolve();};});return ()=>release();}};
}
async function paused(){const r=rig();r.audio.setLocation('battle');await r.audio.enable();r.audio.pause('upgrade');r.audio.setLocation('silent');return r;}
function cue(r){assert.equal(typeof r.audio.rewardCue,'function','AudioSession must expose a synchronous rewardCue');return r.audio.rewardCue();}

test('真实确认短铃在已暂停的silent会话播放，规则/音乐保持暂停且不伪造xp事实',async()=>{
 const r=rig();r.audio.setLocation('battle');await r.audio.enable();r.audio.consume({type:'xp',at:1,amount:2});r.audio.effect('slingshot');r.audio.pause('upgrade');r.audio.setLocation('silent');
 const before=r.audio.snapshot(),musicPlays=r.track('music').plays.length,resumes=r.calls.resumes;
 assert.equal(cue(r),undefined,'confirmation feedback must not await an unlock');
 const after=r.audio.snapshot();assert.equal(after.held,true);assert.equal(after.location,'silent');assert.equal(after.ready,false);assert.equal(after.musicPlaying,false);assert.equal(after.currentTrack,'none');assert.equal(r.track('music').plays.length,musicPlays);assert.equal(r.calls.resumes,resumes);
 assert.deepEqual(after.events,before.events);assert.deepEqual(after.played,before.played);assert.deepEqual(after.recentFacts,before.recentFacts);assert.equal(after.rewardCues,1);assert.equal(after.effectsPlaying,1);assert.equal(after.activeSources,1);assert.equal(r.manager.mute,false,'only the stopped-and-reused xp voice can pass the shared mute gain');assert.deepEqual(r.sounds.filter(sound=>sound.isPlaying),[r.track('xp')]);
 r.audio.dispose();
});

test('重复确认只重用同一个xp短铃，不新建Context/Buffer/Sound/Tween/Clock或叠播',async()=>{
 const r=await paused(),before={...r.calls},originalSounds=[...r.sounds],originalBuffers=[...r.cache.values()],xp=r.track('xp');
 cue(r);const firstSource=xp.source;cue(r);assert.notEqual(xp.source,firstSource,'native play may create its own one-shot source');assert.equal(xp.plays.length,2);assert.equal(xp.plays[0].loop,false);assert.equal(xp.plays[0].rate,1);assert.equal(r.audio.snapshot().rewardCues,2);assert.equal(r.audio.snapshot().effectsPlaying,1);assert.equal(r.audio.snapshot().activeSources,1);
 assert.deepEqual(r.calls,before);assert.deepEqual(r.sounds,originalSounds);assert.deepEqual([...r.cache.values()],originalBuffers);assert.equal(r.sounds.length,16);assert.equal(r.cache.size,12);r.audio.dispose();
});

test('音效关闭时跳过，重新开启和继续不会补播获得提示',async()=>{
 const r=await paused();r.audio.configure({effects:false});const before={...r.calls};cue(r);assert.equal(r.track('xp').plays.length,0);assert.equal(r.audio.snapshot().rewardCues,0);assert.deepEqual(r.calls,before);assert.equal(r.manager.mute,true);
 r.audio.configure({effects:true});await r.audio.continue();r.audio.setLocation('battle');assert.equal(r.track('xp').plays.length,0);assert.equal(r.audio.snapshot().rewardCues,0);r.audio.dispose();
});

test('未创建/未准备/manager locked/非running/销毁状态即时跳过且不排队',async()=>{
 for(const mode of ['no-context','not-prepared','locked','suspended','closed','disposed']){
  const r=mode==='no-context'||mode==='not-prepared'?rig():await paused();let release,pending;
  if(mode==='not-prepared'){release=r.deferResume();pending=r.audio.enable();r.audio.pause('upgrade');}
  if(mode==='locked')r.manager.locked=true;
  if(mode==='suspended'||mode==='closed')r.context.state=mode;
  if(mode==='disposed')r.audio.dispose();
  const before={...r.calls};assert.doesNotThrow(()=>cue(r),mode);assert.equal(r.audio.snapshot().rewardCues,0,mode);assert.equal(r.audio.snapshot().effectsPlaying,0,mode);assert.deepEqual(r.calls,before,mode);
  if(pending){release();await pending;}
  if(mode!=='disposed'&&mode!=='closed'){r.manager.locked=false;r.context.state='running';await r.audio.continue();assert.equal(r.track('xp').plays.length,0,mode+' must not replay on a later gesture');}
  r.audio.dispose();
 }
});

test('已有缓存但resume仍pending时跳过，running也不能晚播',async()=>{
 const r=await paused(),release=r.deferResume(),pending=r.audio.continue();r.audio.pause('upgrade');assert.equal(r.context.state,'running');assert.equal(r.audio.snapshot().pending,true);const before={...r.calls};cue(r);assert.equal(r.audio.snapshot().rewardCues,0);assert.deepEqual(r.calls,before);release();await pending;assert.equal(r.track('xp').plays.length,0);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.dispose();
});

test('短铃遵循effectsVolume与既有xp增益，配置和每次pause/settings/restart/dispose均可停止',async()=>{
 const r=await paused();for(const volume of [0,.2,.8,1]){r.audio.configure({effectsVolume:volume});cue(r);assert.equal(r.track('xp').volume,volume*.7);assert.equal(r.manager.volume,.3);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.configure({musicVolume:.4});assert.equal(r.audio.snapshot().effectsPlaying,0);assert.equal(r.manager.mute,true);}
 for(const reason of ['upgrade','settings','background','restart','reset']){cue(r);assert.equal(r.audio.snapshot().effectsPlaying,1);r.audio.pause(reason);r.audio.pause(reason);assert.equal(r.audio.snapshot().effectsPlaying,0,reason);assert.equal(r.manager.mute,true,reason);}
 cue(r);r.audio.configure({effects:false});assert.equal(r.audio.snapshot().effectsPlaying,0);r.audio.configure({effects:true});cue(r);r.audio.dispose();assert.equal(r.audio.snapshot().effectsPlaying,0);assert.equal(r.cache.size,0);assert.equal(r.sounds.length,0);const calls={...r.calls};cue(r);assert.deepEqual(r.calls,calls);
});

test('原生播放拒绝不会记成获得提示成功，也不会影响xp事实统计',async()=>{
 const r=await paused();r.track('xp').reject=true;const before=r.audio.snapshot();cue(r);const after=r.audio.snapshot();assert.equal(after.rewardCues,0);assert.equal(after.effectsPlaying,0);assert.deepEqual(after.events,before.events);assert.deepEqual(after.played,before.played);r.audio.dispose();
});
