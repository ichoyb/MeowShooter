import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';

test('真实Chrome/Phaser单会话故事缓存、seek、8倍GainNode与释放；OfflineAudioContext测实际有效增益',async()=>{
 const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
 const vendors=await loadRuntimeVendors(),bundle=await build({stdin:{contents:`import Manager from 'phaser/src/sound/webaudio/WebAudioSoundManager';import Sound from 'phaser/src/sound/webaudio/WebAudioSound';window.NativeStorySound=Sound;
import Cache from 'phaser/src/cache/BaseCache';import Emitter from 'eventemitter3';import {createRuntimeAudio} from './src/audio/runtime';
window.makeNativeStory=()=>{const game={config:{audio:{noAudio:true}},events:new Emitter(),cache:{audio:new Cache()},isBooted:true};let native;function Capture(game){native=new Manager(game);return native;}const audio=createRuntimeAudio(game,Capture);return {audio,game,get native(){return native;}};};
window.checkOfflineGain=async kind=>{const duration=kind==='opening'?18:24,context=new OfflineAudioContext(2,duration*44100,44100),game={config:{audio:{noAudio:true}},events:new Emitter(),cache:{audio:new Cache()},isBooted:true};let native;
// Offline rendering owns scheduling; only resume/suspend lifecycle calls are adapted. All native audio nodes and the Phaser graph are real.
context.resume=()=>Promise.resolve();context.suspend=()=>Promise.resolve();
function Capture(game){const previous=game.config.audio.context;try{game.config.audio.context=context;native=new Manager(game);native.locked=false;return native;}finally{game.config.audio.context=previous;}}
const audio=createRuntimeAudio(game,Capture);audio.configure({musicVolume:1,effectsVolume:1});if(!await audio.playStory(kind,0))throw Error(JSON.stringify(audio.snapshot()));const sounds=native.sounds.filter(s=>s.key.startsWith('f1-story-')),rendered=await context.startRendering(),peaks=[0,1].map(c=>{let peak=0;for(const value of rendered.getChannelData(c))peak=Math.max(peak,Math.abs(value));return peak;}),gains=sounds.map(s=>s.volume);audio.dispose();return {kind,gains,peaks};};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife',plugins:[vendors.plugin]});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>{const Original=window.AudioContext;window.contextsCreated=0;window.AudioContext=class extends Original{constructor(...args){super(...args);window.contextsCreated++;}};});
  await page.goto('about:blank');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const result=await page.evaluate(async()=>{
   const check=(condition,message)=>{if(!condition)throw Error(message);},r=window.makeNativeStory(),a=r.audio;
   a.configure({musicVolume:.8,effectsVolume:.4});a.setLocation('silent');await a.enable();check(a.snapshot().audioBuffers===12,'base only before story');
   check(await a.playStory('opening',1),'opening play');await new Promise(resolve=>setTimeout(resolve,30));const original=r.native.sounds.filter(s=>s.key.startsWith('f1-story-')),buffers=original.map(s=>s.audioBuffer),first=a.snapshot();
   check(original.length===2&&original.every(s=>s instanceof window.NativeStorySound),'two actual native Sounds');check(first.activeSources===2&&original.every(s=>s.source instanceof AudioBufferSourceNode),'two actual native Sources');check(Math.abs(original[0].volumeNode.gain.value-6.4)<1e-6,'native gain is not clamped: '+original[0].volumeNode.gain.value+' '+JSON.stringify(first.nativeSoundDetails));check(Math.abs(r.native.masterVolumeNode.gain.value-.3)<1e-6,'battle master preserved');
   const position=a.pauseStory();check(position>=1&&position<2,'native seek');check(original.every(s=>s.isPaused&&s.source===null),'native pause stops source and retains state');check(await a.playStory('opening',position),'native resume');check(original.every((s,i)=>r.native.sounds.includes(s)&&s.audioBuffer===buffers[i]&&s.isPlaying),'native Sound/Buffer reused');
   a.stopStory();check(original.every(s=>s.audioBuffer===null&&s.source===null&&s.listenerCount('complete')===0),'native remove releases Buffer and listener');check(a.snapshot().nativeSounds===16&&a.snapshot().audioBuffers===12,'only base remains');check(a.snapshot().activeSources===0&&!a.snapshot().musicPlaying,'no automatic courtyard restore');
   check(await a.playStory('ending',23.5),'ending seek');const ending=a.snapshot();check(ending.story.bufferBytes===12700800,'ending 3-channel bytes');a.pause('background');check(a.snapshot().story.buffers===0&&a.snapshot().activeSources===0,'background releases story');check(window.contextsCreated===1,'one Context for session');const beforeDispose=a.snapshot();a.dispose();check(a.snapshot().audioBuffers===0&&a.snapshot().nativeSounds===0,'dispose releases all');
   const contextsCreated=window.contextsCreated,offline=[];for(const kind of ['opening','ending']){const rendered=await window.checkOfflineGain(kind);check(rendered.gains.every(g=>Math.abs(g-8)<1e-6),'offline native gain not clamped');check(rendered.peaks.every(v=>v>.1&&v<1),'actual native max-slider mix has headroom: '+JSON.stringify(rendered));offline.push(rendered);}return {userAgent:navigator.userAgent,contextsCreated,opening:first.story,pausedPosition:position,ending:ending.story,remaining:beforeDispose.audioBuffers,offline};
  });
  assert.deepEqual(errors,[]);assert.equal(result.contextsCreated,1);console.log(JSON.stringify(result));
 }finally{await browser.close();}
});
