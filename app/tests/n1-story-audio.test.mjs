import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const bundle=await build({entryPoints:['src/audio/session.ts'],bundle:true,write:false,format:'iife',globalName:'Session'}),scope={};
runInNewContext(bundle.outputFiles[0].text,scope);
const {createAudioSession}=scope.Session;
function rig(){
 const cache=new Map(),sounds=[],calls={contexts:0,managers:0,buffers:0,story:[],base:0};let resumeNext=null,storyNext=null;
 const context={state:'running',currentTime:0,resume(){return resumeNext?resumeNext():Promise.resolve();},close(){this.state='closed';return Promise.resolve();},createBuffer(n,length){calls.buffers++;const channels=Array.from({length:n},()=>new Float32Array(length));return {duration:length/44100,getChannelData:i=>channels[i]};}};
 const manager={sounds,mute:true,volume:1,locked:false,stopAll(){for(const sound of sounds)sound.stop();},add(key){
  const sound=new EventEmitter();let position=0,started=0;Object.assign(sound,{key,isPlaying:false,isPaused:false,source:null,loopSource:null,volume:1,plays:0,pauses:0,resumes:0,duration:cache.get(key).duration,reject:false,
   play(config){assert.equal(this.isPlaying,false);if(this.reject)return false;Object.assign(this,config);position=config.seek??0;started=context.currentTime;this.plays++;this.isPlaying=true;this.isPaused=false;this.source={};this.loopSource=config.loop?{}:null;return true;},
   pause(){if(!this.isPlaying)return false;position=this.seek;this.pauses++;this.isPlaying=false;this.isPaused=true;this.source=null;return true;},
   resume(){if(!this.isPaused)return false;started=context.currentTime;this.resumes++;this.isPlaying=true;this.isPaused=false;this.source={};return true;},
   stop(){this.isPlaying=false;this.isPaused=false;this.source=null;this.loopSource=null;position=0;},complete(){this.stop();this.emit('complete',this);}
  });Object.defineProperty(sound,'seek',{get(){return this.isPlaying?position+context.currentTime-started:this.isPaused?position:0;},set(value){position=value;started=context.currentTime;}});sounds.push(sound);return sound;
 },remove(sound){sound.stop();sounds.splice(sounds.indexOf(sound),1);},destroy(){this.stopAll();sounds.length=0;}};
 const storyPcm=kind=>({music:[new Float32Array(44100*(kind==='opening'?18:24)),new Float32Array(44100*(kind==='opening'?18:24))],world:[new Float32Array(44100*(kind==='opening'?18:24))]});
 const audio=createAudioSession({makeContext(){calls.contexts++;return context;},makeManager(){calls.managers++;return manager;},cache:{add:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)},samples:{short:()=>[new Float32Array(4)],hit:()=>[new Float32Array(6)],music(){calls.base++;return [new Float32Array(8),new Float32Array(8)];},bossLoop:()=>[new Float32Array(12),new Float32Array(12)],bossEntry:()=>[new Float32Array(6),new Float32Array(6)],story(kind){calls.story.push(kind);return storyNext?storyNext(kind):storyPcm(kind);}},makeTween(){return {remove(){}};},makeDelay(){return {remove(){}};}});
 return {audio,cache,sounds,calls,context,manager,story:()=>sounds.filter(s=>s.key.startsWith('f1-story-')),deferResume(){let release;resumeNext=()=>new Promise(resolve=>{release=()=>{resumeNext=null;resolve();};});return ()=>release();},deferStory(){let release;storyNext=kind=>new Promise(resolve=>{release=()=>{storyNext=null;resolve(storyPcm(kind));};});return ()=>release();},rejectStory(){let reject;storyNext=()=>new Promise((_,no)=>{reject=()=>{storyNext=null;no(Error('stale generation failed'));};});return ()=>reject();}};
}
test('故事按当前kind惰性准备并在silent播放：同Context/manager、两原生Sound和两Buffer',async()=>{
 const r=rig();assert.equal(typeof r.audio.playStory,'function');await r.audio.enable();assert.deepEqual(r.calls.story,[]);r.audio.setLocation('battle');r.audio.effect('hit');r.audio.setBossActive(true);
 assert.equal(await r.audio.playStory('opening',2),true);const s=r.audio.snapshot();assert.equal(s.story.kind,'opening');assert.equal(s.story.position,2);assert.equal(s.story.playing,true);assert.equal(s.story.buffers,2);assert.equal(s.story.bufferBytes,9525600);assert.equal(s.musicPlaying,false);assert.equal(s.effectsPlaying,0);assert.equal(s.nativeSounds,18);assert.equal(s.audioBuffers,14);assert.equal(s.activeSources,2);assert.equal(r.manager.mute,false);assert.equal(r.manager.volume,.3);assert.deepEqual(r.calls.story,['opening']);assert.equal(r.calls.contexts,1);assert.equal(r.calls.managers,1);assert.equal(r.calls.base,1);
 r.audio.setLocation('silent');assert.equal(r.audio.snapshot().story.kind,null);assert.equal(await r.audio.playStory('ending',0),true);assert.equal(r.audio.snapshot().story.bufferBytes,12700800);assert.equal(r.audio.snapshot().location,'silent');assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.dispose();
});
test('pauseStory保留seek与缓存，显式playStory复用Sound.pause/resume/seek且不合成或补短声',async()=>{
 const r=rig();assert.equal(typeof r.audio.pauseStory,'function');await r.audio.playStory('opening',3);const original=[...r.story()],buffers=[...r.cache.values()],before={...r.calls,story:[...r.calls.story]};r.context.currentTime=1.25;
 assert.equal(r.audio.pauseStory(),4.25);assert.equal(r.audio.snapshot().story.position,4.25);assert.equal(r.audio.snapshot().story.playing,false);assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.audio.snapshot().story.buffers,2);assert.equal(r.manager.mute,true);
 assert.equal(await r.audio.playStory('opening',4.25),true);assert.deepEqual(r.story(),original);assert.deepEqual([...r.cache.values()],buffers);assert.deepEqual(r.calls,before);assert.ok(original.every(s=>s.pauses===1&&s.resumes===1&&s.plays===1));r.audio.pauseStory();await r.audio.playStory('opening',8);assert.equal(r.audio.snapshot().story.position,8);r.audio.effect('hit');assert.equal(r.audio.snapshot().effectsPlaying,0);r.audio.dispose();
});
test('两个设置意图各控制一个stem，局部8倍增益保留原master并在configure取消故事',async()=>{
 for(const [music,effects] of [[true,true],[false,true],[true,false],[false,false]]){
  const r=rig();assert.equal(typeof r.audio.playStory,'function');r.audio.configure({music,effects,musicVolume:.8,effectsVolume:.4});await r.audio.playStory('opening',1);const [score,world]=r.story();assert.equal(score.volume,6.4);assert.equal(world.volume,3.2);assert.equal(score.volume*r.manager.volume,1.92);assert.equal(score.isPlaying,music);assert.equal(world.isPlaying,effects);r.audio.configure({musicVolume:.3});assert.equal(r.audio.snapshot().story.kind,null);assert.equal(r.cache.size,12);assert.equal(r.sounds.length,16);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.dispose();
 }
});
test('stop/settings/background/restart/reset/dispose取消未完成解锁，不晚建故事资源或自动恢复音乐',async()=>{
 for(const reason of ['stop','pauseStory','settings','background','restart','reset','dispose']){
  const r=rig();assert.equal(typeof r.audio.stopStory,'function');const release=r.deferResume(),pending=r.audio.playStory('opening',0);if(reason==='stop')r.audio.stopStory();else if(reason==='pauseStory')r.audio.pauseStory();else if(reason==='dispose')r.audio.dispose();else r.audio.pause(reason);release();assert.equal(await pending,false,reason);assert.equal(r.audio.snapshot().story.kind,null);assert.equal(r.audio.snapshot().story.buffers,0);assert.equal(r.audio.snapshot().activeSources,0);assert.deepEqual(r.calls.story,[]);if(reason!=='dispose')r.audio.dispose();
 }
});
test('迟到的故事PCM不污染新世代；新kind只留当前2 Buffer，重入不重复准备base',async()=>{
 const r=rig();assert.equal(typeof r.audio.playStory,'function');await r.audio.enable();const release=r.deferStory(),pending=r.audio.playStory('opening',0);await new Promise(resolve=>setImmediate(resolve));r.audio.stopStory();release();assert.equal(await pending,false);assert.equal(r.cache.size,12);assert.equal(await r.audio.playStory('ending',1),true);assert.deepEqual(r.calls.story,['opening','ending']);assert.equal(r.audio.snapshot().story.kind,'ending');assert.equal(r.sounds.length,18);assert.equal(r.cache.size,14);assert.equal(r.calls.base,1);r.audio.stopStory();assert.equal(r.sounds.length,16);assert.equal(r.cache.size,12);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.dispose();
});
test('部分缓存/原生play失败释放当批故事并报告原因，保留base供同Context明确重试',async()=>{
 for(const mode of ['add','play']){
  const r=rig();assert.equal(typeof r.audio.playStory,'function');await r.audio.enable();const original=r.manager.add.bind(r.manager);r.manager.add=key=>{if(key.endsWith('story-world')&&mode==='add')throw Error('controlled story cache failure');const sound=original(key);if(key.endsWith('story-world')&&mode==='play')sound.reject=true;return sound;};assert.equal(await r.audio.playStory('opening',0),false);assert.match(r.audio.snapshot().story.error,/controlled story cache failure|播放/);assert.equal(r.audio.snapshot().story.buffers,0);assert.equal(r.cache.size,12);assert.equal(r.sounds.length,16);assert.equal(r.audio.snapshot().activeSources,0);r.manager.add=original;assert.equal(await r.audio.playStory('opening',0),true);assert.equal(r.calls.contexts,1);assert.equal(r.calls.base,1);r.audio.dispose();
 }
});
test('complete只结束故事，不自动播放庭院；stop清两Sound/Buffer和complete订阅',async()=>{
 const r=rig();assert.equal(typeof r.audio.playStory,'function');r.audio.setLocation('courtyard');await r.audio.playStory('opening',0);const original=[...r.story()];for(const s of original)s.complete();assert.equal(r.audio.snapshot().story.playing,false);assert.equal(r.audio.snapshot().story.position,18);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.stopStory();assert.ok(original.every(s=>s.listenerCount('complete')===0));assert.equal(r.audio.snapshot().story.buffers,0);r.audio.setLocation('battle');await r.audio.continue();assert.equal(r.audio.snapshot().musicPlaying,true);r.audio.dispose();
});
test('同一kind异步准备并发只取一次PCM，使用最后一次显式seek',async()=>{
 const r=rig();await r.audio.enable();const release=r.deferStory(),first=r.audio.playStory('opening',1);await new Promise(resolve=>setImmediate(resolve));const latest=r.audio.playStory('opening',5);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(r.calls.story,['opening']);release();assert.equal(await first,false);assert.equal(await latest,true);assert.equal(r.audio.snapshot().story.position,5);assert.equal(r.cache.size,14);r.audio.dispose();
});
test('旧kind的迟到错误不会取消已开始的新kind或覆盖当前error',async()=>{
 const r=rig();await r.audio.enable();const reject=r.rejectStory(),first=r.audio.playStory('opening',0);await new Promise(resolve=>setImmediate(resolve));r.audio.stopStory();reject();const latest=r.audio.playStory('ending',2);assert.equal(await first,false);assert.equal(await latest,true);assert.equal(r.audio.snapshot().story.kind,'ending');assert.equal(r.audio.snapshot().story.error,'');r.audio.dispose();
});
test('pause/resume后原生complete仍结束当前位置且不会重启音乐',async()=>{
 const r=rig();await r.audio.playStory('opening',0);r.audio.pauseStory();await r.audio.playStory('opening',8);for(const s of r.story())s.complete();assert.equal(r.audio.snapshot().story.position,18);assert.equal(r.audio.snapshot().musicPlaying,false);r.audio.dispose();
});
test('重复同步相同location/settings保持当前故事，解锁失败如实报告并清请求供明确重试',async()=>{
 const r=rig();await r.audio.playStory('opening',1);r.audio.setLocation('silent');r.audio.configure({music:true,effects:true,musicVolume:.65,effectsVolume:.65});assert.equal(r.audio.snapshot().story.kind,'opening');assert.equal(r.audio.snapshot().story.playing,true);r.audio.stopStory();r.context.resume=()=>Promise.reject(Error('controlled context resume failure'));assert.equal(await r.audio.playStory('opening',0),false);assert.match(r.audio.snapshot().story.error,/controlled context resume failure/);assert.equal(r.audio.snapshot().story.buffers,0);r.context.resume=()=>Promise.resolve();assert.equal(await r.audio.playStory('opening',2),true);r.audio.dispose();
});
test('GainNode调度后的getter可仍返回上一量子值，play配置必须使用计算增益',async()=>{
 const r=rig(),add=r.manager.add.bind(r.manager),configs=[];r.manager.add=key=>{const sound=add(key);if(key.startsWith('f1-story-')){Object.defineProperty(sound,'volume',{get:()=>1,set(){}});const play=sound.play.bind(sound);sound.play=config=>{configs.push(config);return play(config);};}return sound;};r.audio.configure({musicVolume:.8,effectsVolume:.4});await r.audio.playStory('opening',1);assert.deepEqual(configs.map(c=>c.volume),[6.4,3.2]);r.audio.dispose();
});
test('故事期间不允许奖励短铃插入；AudioCache.add中断释放故事本批后可重试',async()=>{
 const r=rig();await r.audio.playStory('opening',1);r.audio.rewardCue();assert.equal(r.audio.snapshot().rewardCues,0);assert.equal(r.audio.snapshot().story.playing,true);r.audio.stopStory();const set=r.cache.set.bind(r.cache);r.cache.set=(key,value)=>{if(key==='f1-story-world')throw Error('controlled AudioCache.add failure');return set(key,value);};assert.equal(await r.audio.playStory('ending',1),false);assert.match(r.audio.snapshot().story.error,/controlled AudioCache.add failure/);assert.equal(r.cache.size,12);assert.equal(r.sounds.length,16);assert.equal(r.audio.snapshot().story.bufferBytes,0);r.cache.set=set;assert.equal(await r.audio.playStory('ending',1),true);r.audio.dispose();
});
test('切kind时native remove或AudioCache.remove失败不能遗留旧Sound/Buffer，并可同Context重试',async()=>{
 for(const mode of ['sound','cache']){const r=rig();await r.audio.playStory('opening',1);const remove=r.manager.remove.bind(r.manager),drop=r.cache.delete.bind(r.cache);let failed=false;
  r.manager.remove=sound=>{if(mode==='sound'&&!failed){failed=true;throw Error('controlled story Sound.remove failure');}return remove(sound);};r.cache.delete=key=>{if(mode==='cache'&&key==='f1-story-music'&&!failed){failed=true;throw Error('controlled story AudioCache.remove failure');}return drop(key);};
  assert.equal(await r.audio.playStory('ending',0),false);assert.match(r.audio.snapshot().story.error,/controlled story/);assert.equal(r.sounds.length,0);assert.equal(r.cache.size,0);assert.equal(r.audio.snapshot().story.buffers,0);assert.equal(await r.audio.playStory('ending',0),true);assert.equal(r.calls.contexts,1);r.audio.dispose();
 }
});
