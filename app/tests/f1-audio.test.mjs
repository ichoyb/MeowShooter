import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Frozen from the committed Z1 source at 229a71808621da4ee057027966a5e75509b9cf37.
// Test-only identity and acoustic baselines; this is not another production bank.
const F1_APPROVED = {
  "slingshot": {
    "parameters": [
      0.5,
      0,
      170,
      0.003,
      0.008,
      0.12,
      1,
      1.8,
      -2,
      0,
      0,
      0,
      0,
      0.08,
      0,
      0,
      0,
      0.7,
      0.015,
      0,
      -1800
    ],
    "pcmSHA256": "508263a3198e8cdcf8d4fd242caa21860b88c62bfb94bf3c0af2e8015056d697"
  },
  "hit": {
    "parameters": [
      0.36,
      0,
      880,
      0.002,
      0.006,
      0.22,
      0,
      1.7,
      0,
      0,
      480,
      0.015,
      0,
      0,
      7,
      0,
      0.035,
      0.7,
      0.012,
      0,
      0
    ],
    "pcmSHA256": "96a1eee791923601cfd8aac2e577247830033aeb86040df0fb00ffb1129536f8"
  },
  "defeat": {
    "parameters": [
      0.34,
      0,
      560,
      0.01,
      0.015,
      0.28,
      2,
      1.4,
      -0.7,
      0,
      -200,
      0.05,
      0,
      0.025,
      0,
      0,
      0,
      0.5,
      0.015,
      0,
      -1400
    ],
    "pcmSHA256": "bd893cc38a3d2dd184a59b54354e7992b5bb0d02b068028ef8189de96699318c"
  },
  "hurt": {
    "parameters": [
      0.5,
      0,
      125,
      0.008,
      0.018,
      0.11,
      1,
      2,
      -0.4,
      0,
      0,
      0,
      0,
      0.02,
      0,
      0,
      0,
      0.6,
      0.008,
      0,
      -850
    ],
    "pcmSHA256": "00b6cd6e9f0086436c5e16ca93abcab26d618af62276ab549f76d9bc07e4b399"
  }
};
const F1_COURTYARD = {
 sourceSHA256: 'db5802c35fb744e2d9fa99824a07992257cfda1e9173eafc07af51030277b02a',
 pcmSHA256: 'e62f14e17626f36e6b4809f1068f4d260fb7fb3402147896c40680642eca51a2',
 frames: 881920
};
const pcmHash=channels=>{const hash=createHash('sha256');for(const channel of channels)hash.update(Buffer.from(channel.buffer,channel.byteOffset,channel.byteLength));return hash.digest('hex');};
function pcmStats(channels){let peak=0,squares=0,count=0;for(const channel of channels)for(const value of channel){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));squares+=value*value;count++;}return {peak,rms:Math.sqrt(squares/count),duration:channels[0].length/44100};}

test('历史F1四声和原庭院固定参数、源码SHA、PCM及声学特征保持，合成不创建Context',async()=>{
 assert.ok(existsSync('src/audio/synthesis.mjs'),'尚未提升已确认声音到运行源码');
 const {loadRuntimeVendors}=await import('../tools/audio-vendors.mjs');
 // This verifies the three canonical upstream sources, both licenses and the
 // unique lazy substitutions; the removed probe held byte-identical copies.
 const vendors=await loadRuntimeVendors();
 assert.equal(sha(readFileSync('src/audio/courtyard-score.json')),F1_COURTYARD.sourceSHA256);
 const result=await build({entryPoints:['src/audio/synthesis.mjs'],bundle:true,write:false,format:'iife',globalName:'Audio',plugins:[vendors.plugin]});
 const scope={AudioContext(){throw Error('合成不应创建Context');},window:{}};runInNewContext(result.outputFiles[0].text,scope);
 const {createSampleBank,SOUND_SPECS,COURTYARD_SCORE}=scope.Audio,bank=createSampleBank();
 assert.equal(Array.from(SOUND_SPECS,s=>s.id).join(','),'slingshot,hit,defeat,hurt');
 for(const spec of SOUND_SPECS){
  const approved=F1_APPROVED[spec.id],channels=bank.short(spec.id),metrics=pcmStats(channels);
  assert.equal(JSON.stringify(spec.parameters),JSON.stringify(approved.parameters),'固定F1参数 '+spec.id);
  assert.equal(pcmHash(channels),approved.pcmSHA256,'固定F1 Float32 PCM '+spec.id);
  assert.equal(bank.short(spec.id),channels);assert.equal(channels.length,1);
  assert.ok(metrics.duration>=.08&&metrics.duration<=.35);assert.ok(metrics.peak>.02&&metrics.peak<.95);assert.ok(metrics.rms>.008);
 }
 const music=bank.music(),metrics=pcmStats(music);
 assert.equal(COURTYARD_SCORE.BPM,96);assert.equal(COURTYARD_SCORE.sequence.length,8);assert.equal(COURTYARD_SCORE.instruments.length,3);
 assert.equal(music.length,2);assert.equal(music[0].length,F1_COURTYARD.frames);assert.equal(music[1].length,F1_COURTYARD.frames);
 assert.equal(pcmHash(music),F1_COURTYARD.pcmSHA256,'固定原庭院 Float32 PCM');assert.equal(bank.music(),music);
 assert.ok(metrics.peak>.03&&metrics.peak<.95);assert.ok(metrics.rms>.015);assert.ok(Math.abs(metrics.duration-20)<.01);
 for(const channel of music){assert.ok(Math.abs(channel[0]-channel[channel.length-1])<.002,'首尾单样本接缝');assert.ok(channel.subarray(0,4410).some(value=>value!==0),'无多余前导静音');assert.ok(channel.subarray(channel.length-4410).some(value=>value!==0),'无多余尾部静音');}
 assert.throws(()=>bank.short('critical'));assert.equal(bank.info().musicRenders,1);
 assert.equal(bank.info().musicPcmBytes,F1_COURTYARD.frames*8);assert.equal(bank.info().pcmProcessing,'none: native ZzFXM output converted to Float32 only');
});
async function sessionFactory(){
 assert.ok(existsSync('src/audio/session.ts'),'尚未实现原生声音生命周期');
 const result=await build({entryPoints:['src/audio/session.ts'],bundle:true,write:false,format:'iife',globalName:'Session'});const scope={};runInNewContext(result.outputFiles[0].text,scope);return scope.Session.createAudioSession;
}
function rig(factory,{defer=false,fail=false}={}){
 let resolve,created=0,closed=0;const sounds=[];const cache=new Map();
 const context={state:'suspended',resume(){return fail?Promise.reject(Error('拒绝声音')):defer&&context.state!=='running'?new Promise(r=>resolve=()=>{context.state='running';r();}):(context.state='running',Promise.resolve());},close(){closed++;context.state='closed';return Promise.resolve();},createBuffer(n,length){return {getChannelData(){return new Float32Array(length);}};}};
 const manager={sounds,mute:true,volume:1,stopAll(){sounds.forEach(s=>s.stop());},add(key){const sound={key,isPlaying:false,source:null,loopSource:null,volume:1,play(config){this.isPlaying=true;this.source={};this.loopSource=config.loop?{}:null;return true;},stop(){this.isPlaying=false;this.source=null;this.loopSource=null;}};sounds.push(sound);return sound;},destroy(){this.stopAll();sounds.length=0;}};
 const audio=factory({makeContext(){created++;return context;},makeManager(){return manager;},cache:{add:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)},samples:{hit(){return [new Float32Array(4410)];},short(){return [new Float32Array(4410)];},music(){return [new Float32Array(4410),new Float32Array(4410)];},bossLoop(){return [new Float32Array(4410),new Float32Array(4410)];},bossEntry(){return [new Float32Array(4410),new Float32Array(4410)];}},makeTween(){return {remove(){}};},makeDelay(){return {remove(){}};}});
 return {audio,manager,cache,context,resolve:()=>resolve(),created:()=>created,closed:()=>closed};
}
test('手势惰性解锁合并，G5采用16个原生声音和12缓存有界；暂停/后台/停止清短声，不补播',async()=>{
 const factory=await sessionFactory(),r=rig(factory,{defer:true});assert.equal(r.created(),0);r.audio.setLocation('courtyard');const a=r.audio.enable(),b=r.audio.enable();assert.equal(r.created(),1);r.resolve();await Promise.all([a,b]);assert.equal(r.manager.sounds.length,16);assert.equal(r.cache.size,12);assert.equal(r.manager.volume,.3);assert.equal(r.audio.snapshot().musicPlaying,true);
 for(let i=0;i<20;i++){r.audio.effect('slingshot');r.audio.effect('hit');r.audio.effect('defeat');r.audio.effect('hurt');r.audio.pause('restart');r.audio.setLocation('battle');await r.audio.continue();assert.equal(r.manager.sounds.length,16);assert.equal(r.cache.size,12);assert.equal(r.audio.snapshot().effectsPlaying,0);}
 r.audio.pause('background');assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.manager.mute,true);r.audio.effect('hit');assert.equal(r.audio.snapshot().activeSources,0);r.audio.dispose();assert.equal(r.cache.size,0);assert.equal(r.closed(),1);
});
test('旧resume不能越过暂停或销毁，失败可见而不抛给战斗',async()=>{
 const factory=await sessionFactory();for(const dispose of [false,true]){const r=rig(factory,{defer:true});r.audio.setLocation('courtyard');const pending=r.audio.enable();dispose?r.audio.dispose():r.audio.pause('background');r.resolve();await pending;assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.audio.snapshot().ready,false);}
 const r=rig(factory,{fail:true});await r.audio.enable();assert.match(r.audio.snapshot().error,/拒绝声音/);assert.equal(r.audio.snapshot().activeSources,0);
});
test('暂停后的首次明确继续等待旧解锁结束后恢复；系统中断时短声丢弃',async()=>{
 const r=rig(await sessionFactory(),{defer:true});r.audio.setLocation('battle');const old=r.audio.enable();r.audio.pause('background');const resumed=r.audio.continue();r.resolve();await Promise.all([old,resumed]);assert.equal(r.audio.snapshot().ready,true);r.context.state='suspended';r.audio.effect('hit');assert.equal(r.audio.snapshot().effectsPlaying,0);assert.equal(r.audio.snapshot().played.hit,0);
});
test('原生播放错误与关闭错误仅报告声音状态，不阻断页面/战斗',async()=>{
 const r=rig(await sessionFactory());r.audio.setLocation('courtyard');await r.audio.enable();r.audio.setLocation('silent');r.manager.sounds.find(s=>s.key==='f1-music').play=()=>{throw Error('原生播放失败');};assert.doesNotThrow(()=>r.audio.setLocation('courtyard'));assert.match(r.audio.snapshot().error,/原生播放失败/);r.manager.destroy=()=>{throw Error('原生关闭失败');};assert.doesNotThrow(()=>r.audio.dispose());assert.equal(r.closed(),1);
});
test('任一初始化步骤中途失败回收整批Sound和缓存，再次手势完整初始化',async()=>{
 const factory=await sessionFactory();for(const step of ['buffer','cache','sound']){
  const r=rig(factory);let count=0;const owner=step==='buffer'?r.context:step==='cache'?r.cache:r.manager,key=step==='buffer'?'createBuffer':step==='cache'?'set':'add',original=owner[key].bind(owner);owner[key]=(...args)=>{if(++count===2)throw Error('受控初始化失败 '+step);return original(...args);};
  r.audio.setLocation('courtyard');await r.audio.enable();assert.equal(r.audio.snapshot().ready,false);assert.match(r.audio.snapshot().error,/受控初始化失败/);assert.equal(r.audio.snapshot().nativeSounds,0,step);assert.equal(r.audio.snapshot().audioBufferBytes,0);assert.equal(r.cache.size,0,step);
  await r.audio.enable();assert.equal(r.audio.snapshot().ready,true,step);assert.equal(r.audio.snapshot().musicPlaying,true);assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.cache.size,12);r.audio.dispose();
 }
});
test('resume同步异常可报告并再次手势重试，不留下已完成的pending',async()=>{
 const r=rig(await sessionFactory()),resume=r.context.resume.bind(r.context);r.context.resume=()=>{throw Error('同步resume失败');};await r.audio.enable();assert.equal(r.audio.snapshot().pending,false);r.context.resume=resume;r.audio.setLocation('courtyard');await r.audio.enable();assert.equal(r.audio.snapshot().ready,true);
});
for(const failure of ['music-play','fx-volume','music-volume'])for(const cleanupThrows of [false,true])test('首次prepare事务 '+failure+' 失败整批回收，清理抛错='+cleanupThrows+'，同Context明确手势重新准备',async()=>{
 const r=rig(await sessionFactory()),add=r.manager.add.bind(r.manager),destroy=r.manager.destroy.bind(r.manager),firstBatch=[];let failed=false,additions=0,destroyed=0;
 r.manager.add=key=>{
  const sound=add(key);if(additions++<16)firstBatch.push(sound);
  const selected=key===(failure==='fx-volume'?'f1-slingshot':'f1-music');
  if(selected&&failure==='music-play'){const play=sound.play.bind(sound);sound.play=config=>{if(!failed){failed=true;throw Error('first sync '+failure);}return play(config);};}
  else if(selected){let volume=sound.volume;Object.defineProperty(sound,'volume',{get:()=>volume,set(value){if(!failed){failed=true;throw Error('first sync '+failure);}volume=value;}});}
  return sound;
 };
 r.manager.destroy=()=>{destroyed++;destroy();if(cleanupThrows)throw Error('secondary native destroy failure');};
 r.audio.configure({musicVolume:.37,effectsVolume:.29});r.audio.setLocation('courtyard');
 await assert.doesNotReject(()=>r.audio.enable());const after=r.audio.snapshot();
 assert.equal(failed,true);assert.equal(firstBatch.length,16);assert.match(after.error,new RegExp('^(Error: )?first sync '+failure+'$'));assert.equal(after.ready,false);assert.equal(after.held,true);assert.equal(after.pending,false);
 assert.equal(after.nativeSounds,0);assert.equal(after.audioBuffers,0);assert.equal(after.audioBufferBytes,0);assert.equal(after.activeSources,0);assert.equal(r.cache.size,0);assert.equal(destroyed,1);assert.equal(r.created(),1);assert.equal(r.closed(),0);
 await Promise.resolve();assert.equal(additions,16,'failure must wait for a fresh explicit gesture');
 await assert.doesNotReject(()=>r.audio.enable());const retry=r.audio.snapshot();
 assert.equal(retry.ready,true);assert.equal(retry.error,'');assert.equal(retry.nativeSounds,16);assert.equal(retry.audioBuffers,12);assert.equal(r.cache.size,12);assert.equal(additions,32);assert.equal(r.manager.sounds.some(sound=>firstBatch.includes(sound)),false,'retry must not reuse failed Sound instances');
 assert.equal(r.created(),1);assert.equal(r.closed(),0);assert.equal(retry.settings.musicVolume,.37);assert.equal(retry.settings.effectsVolume,.29);assert.equal(retry.musicPlaying,true);assert.doesNotThrow(()=>r.audio.dispose());assert.equal(r.closed(),1);
});
