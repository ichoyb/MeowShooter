import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {runInNewContext} from 'node:vm';import {createRequire} from 'node:module';import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';
import {performance} from 'node:perf_hooks';
test('实际Phaser原生manager不保留VISIBLE定时恢复，visible后销毁无旧回调拒绝',async()=>{
 const require=createRequire(import.meta.url),Manager=require('phaser/src/sound/webaudio/WebAudioSoundManager'),Emitter=require('eventemitter3'),timers=[],unhandled=[],previousWindow=globalThis.window;
 const rejection=e=>unhandled.push(String(e));process.on('unhandledRejection',rejection);
 class Context {state='running';currentTime=0;destination={};resume(){return this.state==='closed'?Promise.reject(Error('resume on closed')):Promise.resolve();}suspend(){if(this.state==='closed')return Promise.reject(Error('suspend on closed'));this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}createGain(){return {gain:{value:1,setValueAtTime(){}},connect(){},disconnect(){}};}createBuffer(n,length,rate){const channels=Array.from({length:n},()=>new Float32Array(length));return {duration:length/rate,length,numberOfChannels:n,getChannelData:i=>channels[i]};}}
 const window={AudioContext:Context,setTimeout(fn){timers.push(fn);}};globalThis.window=window;
 try{
  const vendors=await loadRuntimeVendors(),result=await build({entryPoints:['src/audio/runtime.ts'],bundle:true,write:false,format:'iife',globalName:'Audio',plugins:[vendors.plugin]}),scope={window,AudioContext:Context,performance};runInNewContext(result.outputFiles[0].text,scope);
  const map=new Map(),game={config:{audio:{noAudio:true}},events:new Emitter(),cache:{json:{},audio:{add:(k,b)=>map.set(k,b),get:k=>map.get(k),remove:k=>map.delete(k)}},isBooted:true},audio=scope.Audio.createRuntimeAudio(game,Manager);await audio.enable();
  assert.equal(game.events.listenerCount('visible'),0,'业务明确继续，原生VISIBLE自动恢复监听应移除');game.events.emit('visible');audio.dispose();assert.equal(timers.length,0);for(const timer of timers)timer();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(unhandled,[]);assert.equal(map.size,0);assert.equal(audio.snapshot().nativeSounds,0);assert.equal(game.events.listenerCount('destroy'),0);
 }finally{globalThis.window=previousWindow;process.off('unhandledRejection',rejection);}
});
test('实际Phaser Sound complete和Scene Tween转场，20次Boss死亡/重开及20次销毁有界',async()=>{
 const require=createRequire(import.meta.url),Manager=require('phaser/src/sound/webaudio/WebAudioSoundManager'),TweenManager=require('phaser/src/tweens/TweenManager'),Emitter=require('eventemitter3'),previousWindow=globalThis.window;
 let created=0,closed=0;
 class Context {
  state='running';currentTime=0;destination={};sources=new Set();
  constructor(){created++;}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){if(this.state!=='closed')closed++;this.state='closed';return Promise.resolve();}
  createGain(){return {gain:{value:1,setValueAtTime(value){this.value=value;}},connect(){},disconnect(){}};}
  createBuffer(n,length,rate){const channels=Array.from({length:n},()=>new Float32Array(length));return {duration:length/rate,length,numberOfChannels:n,getChannelData:i=>channels[i]};}
  createBufferSource(){const owner=this,source={playbackRate:{setValueAtTime(){}},detune:{setValueAtTime(){}},connect(){},disconnect(){owner.sources.delete(source);},start(){owner.sources.add(source);},stop(){owner.sources.delete(source);}};return source;}
 }
 const window={AudioContext:Context,setTimeout(){throw Error('禁止后台自动恢复计时器');}};globalThis.window=window;
 try{
  const vendors=await loadRuntimeVendors(),result=await build({entryPoints:['src/audio/runtime.ts'],bundle:true,write:false,format:'iife',globalName:'Audio',plugins:[vendors.plugin]}),scope={window,AudioContext:Context,performance};runInNewContext(result.outputFiles[0].text,scope);
  const map=new Map(),game={config:{audio:{noAudio:true}},events:new Emitter(),cache:{json:{},audio:{add:(k,b)=>map.set(k,b),get:k=>map.get(k),remove:k=>map.delete(k)}},isBooted:true},scene={sys:{events:new Emitter()}};scene.tweens=new TweenManager(scene);scene.sys.events.emit('boot');scene.sys.events.emit('start');
  let native;function CaptureManager(game){native=new Manager(game);return native;}
  const audio=scope.Audio.createRuntimeAudio(game,CaptureManager,()=>scene);audio.setLocation('battle');const before=performance.now();await audio.enable();const firstPrepareMs=performance.now()-before;
  assert.equal(audio.snapshot().nativeSounds,16);assert.equal(audio.snapshot().audioBuffers,12);assert.equal(audio.snapshot().error,'');assert.equal(audio.snapshot().ready,true);const buffers=audio.snapshot().audioBufferBytes;assert.equal(buffers,[...map.values()].reduce((bytes,buffer)=>bytes+buffer.length*buffer.numberOfChannels*4,0));assert.equal(buffers,Object.values(audio.snapshot().audioBufferBytesByTrack).reduce((a,b)=>a+b,0));assert.equal(audio.snapshot().pcm.persistentPcmBytes,13508960);assert.equal(buffers,13414588);assert.equal(audio.snapshot().pcm.impact.renderCount,5);assert.equal(audio.snapshot().pcm.bossPcmBytes,6102568);
  const step=(ms=50)=>{scene.tweens.startTime-=ms;scene.tweens.tick();game.events.emit('prestep',0,ms);};
  const until=(predicate)=>{for(let i=0;i<20&&!predicate();i++)step();assert.equal(predicate(),true,audio.snapshot().error||JSON.stringify(audio.snapshot()));};
  const entry=()=>native.sounds.find(s=>s.key==='f1-boss-entry'),normal=()=>native.sounds.find(s=>s.key==='f1-music');
  for(let i=0;i<20;i++){
   audio.setBossActive(true);assert.equal(scene.tweens.getTweens().length,1);step();step();assert.ok(normal().volume<.65&&normal().volume>0);until(()=>audio.snapshot().currentTrack==='boss-entry');assert.equal(audio.snapshot().entryPlayedCount,i+1);assert.equal(entry().listenerCount('complete'),1);assert.equal(normal().isPlaying,false);
   const source=entry().source,staleComplete=entry().listeners('complete')[0];
   if(i%2===0){audio.pause('background');source.onended({target:source});staleComplete();game.events.emit('prestep',0,33);assert.equal(audio.snapshot().activeSources,0);game.events.emit('visible');assert.equal(audio.snapshot().activeSources,0);await audio.continue();assert.equal(audio.snapshot().currentTrack,'boss-loop');}
   else {source.onended({target:source});game.events.emit('prestep',0,33);assert.equal(audio.snapshot().currentTrack,'boss-loop');assert.equal(entry().listenerCount('complete'),0);assert.equal(native.sounds.find(s=>s.key==='f1-boss-loop').volume,0);until(()=>scene.tweens.getTweens().length===0);}
   audio.setBossActive(false);audio.pause('restart');audio.setLocation('courtyard');await audio.continue();assert.equal(audio.snapshot().currentTrack,'courtyard');assert.equal(audio.snapshot().audioBufferBytes,buffers);assert.equal(map.size,12);assert.equal(native.sounds.length,16);assert.equal(entry().listenerCount('complete'),0);assert.ok(audio.snapshot().activeSources<=2);assert.ok(native.context.sources.size<=2);step();assert.equal(scene.tweens.getTweens().length,0);audio.setLocation('battle');
  }
  for(let i=0;i<21;i++){
   const weapon=['W04','W02','W01'][i%3],oldSounds=native.sounds.filter(s=>['f1-hit','f1-critical'].includes(s.key)),oldBuffers=[map.get('f1-hit'),map.get('f1-critical')];
   audio.setWeapon(weapon);await audio.continue();assert.equal(native.sounds.length,16);assert.equal(map.size,12);
   assert.ok(oldSounds.every(s=>s.audioBuffer===null),'native remove must release both old weapon buffers');assert.ok(oldBuffers.every(buffer=>![...map.values()].includes(buffer)));
   for(const key of ['f1-hit','f1-critical'])assert.ok(native.sounds.filter(s=>s.key===key).every(s=>s.audioBuffer===map.get(key)),'native voices share only the current weapon buffer');
   const actual=[...map.values()].reduce((bytes,buffer)=>bytes+buffer.length*buffer.numberOfChannels*4,0);assert.equal(audio.snapshot().audioBufferBytes,actual);assert.equal(actual,{W01:13414588,W04:13396064,W02:13425172}[weapon]);assert.equal(audio.snapshot().pcm.persistentPcmBytes,13508960);assert.equal(native.context.sources.size,2);
  }
  console.log(JSON.stringify({nativeBossFirstPrepareMs:firstPrepareMs,diagnostics:audio.snapshot()}));audio.dispose();assert.equal(map.size,0);assert.equal(native.context.state,'closed');assert.equal(native.context.sources.size,0);assert.equal(scene.tweens.getTweens().length,0);assert.equal(game.events.listenerCount('prestep'),0);assert.equal(game.events.listenerCount('destroy'),0);
  for(let i=0;i<20;i++){const next=scope.Audio.createRuntimeAudio(game,CaptureManager,()=>scene);next.setLocation('battle');await next.enable();next.setBossActive(true);next.dispose();step();assert.equal(next.snapshot().nativeSounds,0);assert.equal(map.size,0);assert.equal(game.events.listenerCount('prestep'),0);assert.equal(game.events.listenerCount('destroy'),0);assert.equal(scene.tweens.getTweens().length,0);}
  assert.equal(created,21);assert.equal(closed,21);scene.tweens.destroy();
 }finally{globalThis.window=previousWindow;}
});
