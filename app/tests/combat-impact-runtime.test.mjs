import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';

const IMPACTS = {
 'critical-bell':'7717513d1bbe8e823e02f072c6cec1ac46a8db0d941bf5c5d85074694efa7193',
 'critical-fish':'9ce191195ad0f3ecf204ead55446e41fec7b95c876489e67151bf25ae149c9a3',
 'critical-bone':'91ae0a791cac15f28a955b9c437e20e3c29ab458e09848d1e38d9dab6bb7805d',
 hurt:'61c76575781c5b2edd9d8c1a0ef82c487c55ceea20f94dd2f406057f7daf874d',
 'shield-break':'68a7d5d83101b4448f0955c8f6c170f5c58555d1cafaf12fb2a8810849a406d0'
};
const WEAPONS = {W01:'critical-bell',W04:'critical-fish',W02:'critical-bone'};
const hash = channels => createHash('sha256').update(Buffer.from(channels[0].buffer)).digest('hex');
async function exported(entry, seed=1) {
 const vendors=await loadRuntimeVendors(), result=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'Exports',metafile:true,plugins:[vendors.plugin]});
 let calls=0;const localMath=Object.create(Math);localMath.random=()=>{calls++;seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
 const scope={window:{},performance,Math:localMath,AudioContext(){throw Error('synthesis must not create a Context');}};
 runInNewContext(result.outputFiles[0].text,scope);return {...scope.Exports,randomCalls:()=>calls,inputs:Object.keys(result.metafile.inputs)};
}

test('adopted five PCM match the approved audition and frozen Float32 SHA with eleven cold random calls',async()=>{
 const runtime=await exported('src/audio/combat-synthesis.mjs'),source=await exported('../assets/audio/combat-impact-v01/sounds.mjs'),bank=runtime.createCombatSampleBank({impact:true}),approved=source.createImpactAudioBank();
 assert.equal(runtime.randomCalls(),0);
 for(const [weapon,id] of Object.entries(WEAPONS)){
  const pcm=bank.short('critical',weapon);assert.equal(hash(pcm),IMPACTS[id],id);assert.equal(hash(pcm),hash(approved.render(id)));assert.equal(pcm.length,1);
 }
 for(const id of ['hurt','shield-break']){assert.equal(hash(bank.short(id)),IMPACTS[id],id);assert.equal(hash(bank.short(id)),hash(approved.render(id)));}
 assert.equal(runtime.randomCalls(),11,'only eleven fixed layers generated, source layers are temporary');
 const before=runtime.randomCalls();for(let i=0;i<20;i++)for(const weapon of Object.keys(WEAPONS))bank.short('critical',weapon);
 assert.equal(runtime.randomCalls(),before);assert.equal(bank.info().impact.pcmBytes,142888);assert.equal(bank.info().impact.renderCount,5);assert.equal(bank.info().impact.retainedSourcePcmBytes,0);
 assert.ok(runtime.inputs.every(path=>!path.includes('tests/')&&!path.includes('../assets/')&&!path.includes('docs/')),'production has no audition/source imports');
});

test('new pre-mix is independent of cold random values and leaves all other adopted sounds unchanged',async()=>{
 const a=await exported('src/audio/combat-synthesis.mjs',1),b=await exported('src/audio/combat-synthesis.mjs',4294967295),next=a.createCombatSampleBank({impact:true}),other=b.createCombatSampleBank({impact:true}),legacy=a.createCombatSampleBank();
 for(const weapon of Object.keys(WEAPONS)){assert.equal(hash(next.short('critical',weapon)),hash(other.short('critical',weapon)));assert.equal(hash(next.hit(weapon)),hash(legacy.hit(weapon)));}
 for(const id of ['slingshot','fish-shot','bone-shot','xp','defeat'])assert.equal(hash(next.short(id)),hash(legacy.short(id)),id);
 for(const id of ['music','bossLoop','bossEntry'])assert.equal(hash(next[id]()),hash(legacy[id]()),id);
});

async function rig(){
 const api=await exported('src/audio/session.ts'),bankAPI=await exported('src/audio/combat-synthesis.mjs'),bank=bankAPI.createCombatSampleBank({impact:true}),cache=new Map(),sounds=[],removed=[],cacheRemovals=[];
 let created=0,adds=0,failAt=0,bufferCount=0,failBufferAt=0;
 const context={state:'running',currentTime:0,resume:()=>Promise.resolve(),close(){this.state='closed';return Promise.resolve();},createBuffer(n,length){bufferCount++;if(bufferCount===failBufferAt)throw Error('controlled buffer failure');const channels=Array.from({length:n},()=>new Float32Array(length));return {channels,getChannelData:i=>channels[i]};}};
 const manager={sounds,mute:true,volume:1,locked:false,stopAll(){for(const sound of sounds)sound.stop();},add(key){adds++;if(adds===failAt)throw Error('controlled native add failure');const sound=new EventEmitter();Object.assign(sound,{key,isPlaying:false,source:null,loopSource:null,volume:1,rate:1,plays:[],play(config){assert.equal(this.isPlaying,false);this.plays.push(config);Object.assign(this,config);this.isPlaying=true;this.source={};return true;},stop(){this.isPlaying=false;this.source=null;this.loopSource=null;}});sounds.push(sound);return sound;},remove(sound){removed.push(sound);sound.stop();sounds.splice(sounds.indexOf(sound),1);},destroy(){this.stopAll();sounds.length=0;}};
 const audio=api.createAudioSession({makeContext(){created++;return context;},makeManager:()=>manager,cache:{add:(key,value)=>cache.set(key,value),remove(key){cacheRemovals.push(key);return cache.delete(key);}},samples:bank,makeTween:()=>({remove(){}}),makeDelay:()=>({remove(){}})});
 const cachedHash=id=>hash(cache.get('f1-'+id).channels);
 return {audio,bank,cache,sounds,context,manager,removed,cacheRemovals,cachedHash,created:()=>created,randomCalls:bankAPI.randomCalls,failAddIn(n){failAt=adds+n;},failBufferIn(n){failBufferAt=bufferCount+n;}};
}

test('prepare prewarms every weapon and switches replace both native hit and critical only, without more synthesis',async()=>{
 const r=await rig();r.audio.setLocation('battle');await r.audio.enable();const before=r.randomCalls();
 assert.ok(r.bank.info().impact,'adopted bank must report its five pre-mixed sounds');assert.equal(r.bank.info().impact.renderCount,5,'all three criticals and both dangers prewarmed');
 assert.equal(r.bank.info().persistentPcmBytes,13508960);assert.equal(r.bank.info().candidatePcmBytes+r.bank.info().impact.pcmBytes+r.bank.info().maxCandidateBufferBytes,453876,'maximum buffer budget must use one actual weapon hit/critical pair');
 const unchanged=new Map([...r.cache].filter(([key])=>!['f1-hit','f1-critical'].includes(key)));
 for(let i=0;i<21;i++){
  const weapon=Object.keys(WEAPONS)[i%3],oldSounds=r.sounds.filter(s=>['f1-hit','f1-critical'].includes(s.key)),oldBuffers=[r.cache.get('f1-hit'),r.cache.get('f1-critical')];
  const changed=weapon!==r.audio.snapshot().weapon;r.audio.setWeapon(weapon);await r.audio.continue();
  assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.cache.size,12);assert.equal(r.cachedHash('critical'),IMPACTS[WEAPONS[weapon]]);assert.equal(r.audio.snapshot().criticalVariant,WEAPONS[weapon]);
  if(changed){assert.ok(oldSounds.every(s=>r.removed.includes(s)));assert.ok(oldBuffers.every(buffer=>![...r.cache.values()].includes(buffer)));assert.equal(r.cacheRemovals.at(-2),'f1-hit');assert.equal(r.cacheRemovals.at(-1),'f1-critical');}
  for(const [key,buffer] of unchanged)assert.equal(r.cache.get(key),buffer);
  const bytes=[...r.cache.values()].reduce((n,buffer)=>n+buffer.channels.reduce((sum,c)=>sum+c.byteLength,0),0);assert.equal(r.audio.snapshot().audioBufferBytes,bytes);assert.equal(bytes,{W01:13414588,W04:13396064,W02:13425172}[weapon]);assert.equal(Object.values(r.audio.snapshot().audioBufferBytesByTrack).reduce((a,b)=>a+b,0),bytes);
 }
 assert.equal(r.randomCalls(),before);assert.equal(r.created(),1);r.audio.dispose();assert.equal(r.cache.size,0);
});

test('critical requests one native premix and danger precedence keeps absorb/rejected silent',async()=>{
 const r=await rig();r.audio.setLocation('battle');await r.audio.enable();
 for(const weapon of Object.keys(WEAPONS)){
  r.audio.setWeapon(weapon);await r.audio.continue();r.context.currentTime+=1;const before=r.audio.snapshot();
  r.audio.consume({type:'hit',at:1,critical:true,targetId:1,killed:false,targetKind:'enemy'});const after=r.audio.snapshot();
  assert.equal(after.events.critical-before.events.critical,1);assert.equal(after.events.hit,before.events.hit);assert.equal(after.effectsPlaying,1);assert.equal(r.sounds.filter(s=>s.isPlaying&&s.key==='f1-critical').length,1);assert.equal(r.cachedHash('critical'),IMPACTS[WEAPONS[weapon]]);
  r.audio.pause('test');await r.audio.continue();
 }
 const before=r.audio.snapshot();for(const fact of [{accepted:true,hpLost:0,shieldBroke:false},{accepted:false,hpLost:10,shieldBroke:true},{accepted:false,hpLost:0,shieldBroke:true}])r.audio.consume({type:'incoming',at:2,...fact});assert.deepEqual(r.audio.snapshot().events,before.events);
 r.audio.consume({type:'incoming',at:2,accepted:true,hpLost:4,shieldBroke:true});r.audio.consume({type:'incoming',at:2,accepted:true,hpLost:0,shieldBroke:true});const after=r.audio.snapshot();assert.equal(after.events.hurt-before.events.hurt,1);assert.equal(after.events['shield-break']-before.events['shield-break'],1);r.audio.dispose();
});

test('every hit/critical swap add failure releases the complete batch and a later explicit gesture retries',async()=>{
 for(const failure of [1,2,3,4,5]){
  const r=await rig();r.audio.setLocation('battle');await r.audio.enable();r.failAddIn(failure);r.audio.setWeapon('W02');const failed=r.audio.snapshot();
  assert.equal(failed.ready,false);assert.match(failed.error,/controlled native add failure/);assert.equal(r.cache.size,0);assert.equal(r.sounds.length,0);assert.equal(failed.audioBufferBytes,0);assert.deepEqual(Object.keys(failed.audioBufferBytesByTrack),[]);
  const calls=r.randomCalls();await r.audio.enable();assert.equal(r.audio.snapshot().ready,true);assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.cache.size,12);assert.equal(r.cachedHash('critical'),IMPACTS['critical-bone']);assert.equal(r.randomCalls(),calls);assert.equal(r.created(),1);r.audio.dispose();
 }
});

test('preparation or either swapped Buffer failure releases all resources before retry',async()=>{
 for(const phase of ['prepare','hit','critical']){
  const r=await rig();r.audio.setLocation('battle');if(phase==='prepare')r.failBufferIn(5);else{await r.audio.enable();r.failBufferIn(phase==='hit'?1:2);}
  if(phase==='prepare')await r.audio.enable();else r.audio.setWeapon('W04');
  assert.match(r.audio.snapshot().error,/controlled buffer failure/);assert.equal(r.cache.size,0);assert.equal(r.sounds.length,0);assert.equal(r.audio.snapshot().ready,false);
  await r.audio.enable();assert.equal(r.audio.snapshot().ready,true);assert.equal(r.cache.size,12);assert.equal(r.sounds.length,16);r.audio.dispose();
 }
});
