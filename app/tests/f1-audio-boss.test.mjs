import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import {performance} from 'node:perf_hooks';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';

async function factory(){
 const result=await build({entryPoints:['src/audio/session.ts'],bundle:true,write:false,format:'iife',globalName:'Session'}),scope={};runInNewContext(result.outputFiles[0].text,scope);return scope.Session.createAudioSession;
}
function rig(create,{defer=false}={}){
 let release,contexts=0;const cache=new Map(),sounds=[],tweens=[];
 const context={state:'suspended',resume(){return defer&&this.state!=='running'?new Promise(resolve=>release=()=>{this.state='running';resolve();}):(this.state='running',Promise.resolve());},close(){this.state='closed';return Promise.resolve();},createBuffer(n,length){return {getChannelData:()=>new Float32Array(length)};}};
 const manager={sounds,mute:true,volume:1,locked:false,stopAll(){sounds.forEach(s=>s.stop());},add(key){const s=new EventEmitter();Object.assign(s,{key,volume:1,isPlaying:false,source:null,loopSource:null,plays:[],play(config){this.plays.push(config);this.volume=config.volume;this.isPlaying=true;this.source={};this.loopSource=config.loop?{}:null;return true;},stop(){this.isPlaying=false;this.source=null;this.loopSource=null;},complete(){this.stop();this.emit('complete',this);}});sounds.push(s);return s;},destroy(){this.stopAll();sounds.length=0;}};
 const samples={hit:()=>[new Float32Array(4)],short:()=>[new Float32Array(4)],music:()=>[new Float32Array(8),new Float32Array(8)],bossLoop:()=>[new Float32Array(12),new Float32Array(12)],bossEntry:()=>[new Float32Array(6),new Float32Array(6)]};
 const audio=create({makeContext(){contexts++;return context;},makeManager:()=>manager,cache:{add:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)},samples,makeTween(config){const tween={config,removed:false,remove(){this.removed=true;},progress(value){config.targets.gain=value;config.onUpdate();},complete(){config.targets.gain=config.gain;config.onUpdate();config.onComplete();}};tweens.push(tween);return tween;}});
 return {audio,cache,sounds,tweens,context,release:()=>release(),contexts:()=>contexts,track:id=>sounds.find(s=>s.key==='f1-'+id)};
}
test('Boss首次出生：庭院200ms淡出→单次入场→Boss循环300ms渐入，音量调整不重播',async()=>{
 const r=rig(await factory());r.audio.setLocation('battle');await r.audio.enable();
 assert.equal(typeof r.audio.setBossActive,'function','缺少真实Boss音乐意图入口');
 r.audio.setBossActive(true);assert.equal(r.audio.snapshot().musicIntent,'boss');assert.equal(r.tweens[0].config.duration,200);assert.equal(r.audio.snapshot().currentTrack,'courtyard');
 r.tweens[0].progress(.5);assert.equal(r.track('music').volume,.325);r.audio.configure({musicVolume:.4});assert.equal(r.track('music').volume,.2);
 r.tweens[0].complete();assert.equal(r.audio.snapshot().currentTrack,'boss-entry');assert.equal(r.audio.snapshot().entryPlayedCount,1);assert.equal(r.track('music').isPlaying,false);assert.equal(r.track('boss-entry').plays[0].loop,false);
 r.audio.setBossActive(true);assert.equal(r.audio.snapshot().entryPlayedCount,1);r.track('boss-entry').complete();assert.equal(r.audio.snapshot().currentTrack,'boss-loop');assert.equal(r.track('boss-loop').volume,0);assert.equal(r.tweens[1].config.duration,300);r.tweens[1].complete();assert.equal(r.track('boss-loop').volume,.4);
 assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.audio.snapshot().audioBuffers,12);assert.equal(r.cache.size,12);assert.equal(r.contexts(),1);assert.equal(r.audio.snapshot().audioBufferBytes,352);r.audio.dispose();
});
test('静音/未解锁/暂停时入场不补播；迟到解锁只进入Boss循环',async()=>{
 const create=await factory();for(const mode of ['muted','locked','paused','late-unlock']){
  const r=rig(create,{defer:mode==='late-unlock'});r.audio.setLocation('battle');assert.equal(typeof r.audio.setBossActive,'function');
  let old;if(mode==='muted'){await r.audio.enable();r.audio.configure({music:false});}else if(mode==='paused'){await r.audio.enable();r.audio.pause('menu');}else if(mode==='late-unlock')old=r.audio.enable();
  r.audio.setBossActive(true);if(mode==='muted')r.audio.configure({music:true});else if(mode==='late-unlock'){r.release();await old;}else if(mode==='paused')await r.audio.continue();else await r.audio.enable();
  assert.equal(r.audio.snapshot().currentTrack,'boss-loop',mode);assert.equal(r.audio.snapshot().entryPlayedCount,0,mode);assert.equal(r.tweens.length,0,mode);r.audio.dispose();
 }
});
test('暂停/后台/死亡/停止/重开/销毁后迟到complete与Tween不能复活音乐',async()=>{
 const create=await factory();for(const phase of ['fade-out','entry','fade-in'])for(const end of ['pause','background','finish','death','silent','restart','dispose']){
  const r=rig(create);r.audio.setLocation('battle');await r.audio.enable();r.audio.setBossActive(true);const staleFade=r.tweens[0];
  if(phase!=='fade-out')staleFade.complete();const staleComplete=r.track('boss-entry').listeners('complete')[0];if(phase==='fade-in')r.track('boss-entry').complete();const staleIn=r.tweens[1];
  if(end==='death')r.audio.setBossActive(false);else if(end==='silent')r.audio.setLocation('silent');else if(end==='restart'){r.audio.pause('restart');r.audio.setBossActive(false);}else if(end==='dispose')r.audio.dispose();else r.audio.pause(end==='pause'?'menu':end);
  const before=r.audio.snapshot();staleFade.complete();staleIn?.complete();staleComplete?.();assert.equal(r.audio.snapshot().currentTrack,before.currentTrack,phase+'/'+end);assert.equal(r.audio.snapshot().activeSources,before.activeSources,phase+'/'+end);
  if(['pause','background'].includes(end)){assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.track('boss-entry').listenerCount('complete'),0);await r.audio.continue();assert.equal(r.audio.snapshot().currentTrack,'boss-loop');assert.equal(r.audio.snapshot().entryPlayedCount,phase==='fade-out'?0:1);}
  r.audio.dispose();assert.equal(r.cache.size,0);
 }
});
test('回庭院清Boss意图；20次死亡/重开/继续Sound、Cache和监听数稳定',async()=>{
 const r=rig(await factory());r.audio.setLocation('battle');await r.audio.enable();
 for(let i=0;i<20;i++){
  r.audio.setBossActive(true);r.tweens.at(-1).complete();r.track('boss-entry').complete();r.tweens.at(-1).complete();r.audio.pause('background');await r.audio.continue();r.audio.setBossActive(false);r.audio.pause('restart');r.audio.setLocation('courtyard');await r.audio.continue();
  assert.equal(r.audio.snapshot().musicIntent,'normal');assert.equal(r.audio.snapshot().currentTrack,'courtyard');assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.cache.size,12);assert.equal(r.track('boss-entry').listenerCount('complete'),0);assert.ok(r.audio.snapshot().activeSources<=2);r.audio.setLocation('battle');
 }
 assert.equal(r.audio.snapshot().entryPlayedCount,20);r.audio.setBossActive(true);r.audio.setLocation('courtyard');assert.equal(r.audio.snapshot().musicIntent,'normal');r.audio.dispose();r.audio.dispose();assert.equal(r.cache.size,0);
});
test('庭院重复同步也清Boss意图并立即恢复庭院曲',async()=>{
 const r=rig(await factory());r.audio.setLocation('courtyard');await r.audio.enable();r.audio.setBossActive(true);r.audio.setLocation('courtyard');assert.equal(r.audio.snapshot().musicIntent,'normal');assert.equal(r.audio.snapshot().currentTrack,'courtyard');assert.equal(r.track('music').isPlaying,true);r.audio.dispose();
});
test('Boss入场期间的迟到解锁不能越过结算或销毁',async()=>{
 const create=await factory();for(const end of ['finish','dispose']){const r=rig(create,{defer:true});r.audio.setLocation('battle');const pending=r.audio.enable();r.audio.setBossActive(true);if(end==='dispose')r.audio.dispose();else r.audio.pause('finish');r.release();await pending;assert.equal(r.audio.snapshot().ready,false);assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.audio.snapshot().entryPlayedCount,0);assert.equal(r.cache.size,0);r.audio.dispose();}
});
test('运行Boss乐谱与认可A逐字节/逐PCM一致，各只合成一次，PCM和Buffer新增预算≤6.5MiB',async()=>{
 const approved=readFileSync('../assets/art/courtyard-enemies/boss-presence/b01-music-heavy-v01.json');
 assert.equal(readFileSync('src/audio/boss-score.json','utf8'),approved.toString());
 const vendors=await loadRuntimeVendors(),result=await build({entryPoints:['src/audio/synthesis.mjs'],bundle:true,write:false,format:'iife',globalName:'Audio',plugins:[vendors.plugin]}),scope={window:{},AudioContext(){throw Error('合成不能创建Context');}};runInNewContext(result.outputFiles[0].text,scope);
 const original=await build({entryPoints:['../assets/art/courtyard-enemies/boss-presence/render-audio.mjs'],bundle:true,write:false,format:'iife',globalName:'Approved',plugins:[vendors.plugin]}),other={window:{},AudioContext(){throw Error('合成不能创建Context');}};runInNewContext(original.outputFiles[0].text,other);
 const hash=channels=>Array.from(channels,c=>createHash('sha256').update(Buffer.from(c.buffer,c.byteOffset,c.byteLength)).digest('hex')).join(',');
 const bank=scope.Audio.createSampleBank(),before=performance.now(),loop=bank.bossLoop(),entry=bank.bossEntry(),prepareMs=performance.now()-before,expected=other.Approved.renderDrafts().find(d=>d.id==='heavy');
 assert.ok(expected,'明确选择已批准heavy A');assert.equal(hash(loop),hash(expected.loop));assert.equal(hash(entry),hash(expected.entry));assert.equal(bank.bossLoop(),loop);assert.equal(bank.bossEntry(),entry);
 const info=bank.info();assert.equal(info.bossLoopRenders,1);assert.equal(info.bossEntryRenders,1);assert.equal(info.bossPcmBytes,loop[0].byteLength*2+entry[0].byteLength*2);assert.ok(info.bossPcmBytes<=6.5*1024*1024);console.log(JSON.stringify({bossPcm:info,firstBossPrepareMs:prepareMs,loopPcmSHA256:hash(loop),entryPcmSHA256:hash(entry)}));
});
