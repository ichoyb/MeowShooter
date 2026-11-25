import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';
import {CANDIDATE_SOUND_SPECS} from '../../assets/audio/g5-combat-v01/sound-specs.mjs';
import {HIT_VARIANTS} from '../../assets/audio/g5-impact-v02/sound-specs.mjs';
import {WEAPON_FIRE_SPECS,WEAPON_HIT_VARIANTS} from '../../assets/audio/g5-weapon-audio-v03/sound-specs.mjs';
async function exported(entry,plugins=[]){const result=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'Exports',plugins});const scope={window:{},performance};runInNewContext(result.outputFiles[0].text,scope);return scope.Exports;}
const hash=channels=>Array.from(channels,c=>createHash('sha256').update(Buffer.from(c.buffer,c.byteOffset,c.byteLength)).digest('hex')).join(',');
// Frozen raw Float32 PCM from the approved 9044 audio-reference.json.
// These constants make simultaneous design-source/runtime edits fail as well.
const APPROVED_PCM={
 slingshot:'508263a3198e8cdcf8d4fd242caa21860b88c62bfb94bf3c0af2e8015056d697',
 defeat:'bd893cc38a3d2dd184a59b54354e7992b5bb0d02b068028ef8189de96699318c',
 hurt:'00b6cd6e9f0086436c5e16ca93abcab26d618af62276ab549f76d9bc07e4b399',
 'fish-shot':'6d165c8168dfad6625864920bbd3b7ff58a2377372d43728564d4b1ce6d83047',
 'bone-shot':'2dff3c299a50435dda0212390e66384485004e98ec2576ea554d15cc58f5fcb5',
 critical:'709a07ee20603fc374c8b77acdbc659e519a5b77a71c2b76d100b911c286e0e8',
 'shield-break':'c643acd2c08b757a2f84ce5f188e4d2c121333e13d71a5578770ab4d3a2f5d0d',
 xp:'bc5e56df1c60c77f2da871270c3d04debc251935ba7452e878406dcc6d4ee9bd',
 thick:'bc484c5841eb7e9d47efaf160fdb469b9a80aabb93bf6961dde8371661e0036e',
 pierce:'5e6d0afbe544645b2b743563e5f2798ede0a35758332711f84728fb72897ffc3',
 blast:'b44b562f9dbbbdf83defd3419dfab2b0ff4166312c1a796e1c00d86206cbc9b1',
 music:'e62f14e17626f36e6b4809f1068f4d260fb7fb3402147896c40680642eca51a2',
 bossLoop:'796834595d576ec3edb749d216c368cd1772ad1b2f238220fd88701ef8e6ad11',
 bossEntry:'feed2e1c74dee03d58f813bb01bef47fdd1648a58034484fbad4273a8fb10501'
};
test('G5 adopted runtime parameters and PCM independently match 9044 approved bank; candidate memory within 512KiB',async()=>{
 const vendors=await loadRuntimeVendors(),runtime=await exported('src/audio/combat-synthesis.mjs',[vendors.plugin]),approved=await exported('tests/fixtures/g5-audio-bank.mjs',[vendors.plugin]);
 const bank=runtime.createCombatSampleBank(),original=approved.createAuditionBank();
 const expected=[...CANDIDATE_SOUND_SPECS.map(s=>WEAPON_FIRE_SPECS.find(n=>n.id===s.id)||s),HIT_VARIANTS.find(s=>s.id==='thick'),...WEAPON_HIT_VARIANTS];
 assert.equal(JSON.stringify(runtime.COMBAT_SOUND_SPECS),JSON.stringify(expected));
 for(const id of ['slingshot','defeat','hurt','critical','shield-break','xp','fish-shot','bone-shot'])assert.equal(hash(bank.short(id)),hash(original.short(id)),id);
 for(const [weapon,variant] of [['W01','thick'],['W04','pierce'],['W02','blast']])assert.equal(hash(bank.hit(weapon)),hash(original.hit(variant)),weapon);
 for(const method of ['music','bossLoop','bossEntry'])assert.equal(hash(bank[method]()),hash(original[method]()));
 const joined=channels=>{const h=createHash('sha256');for(const c of channels)h.update(Buffer.from(c.buffer,c.byteOffset,c.byteLength));return h.digest('hex');};
 for(const [id,expectedHash] of Object.entries(APPROVED_PCM)){const weapon={thick:'W01',pierce:'W04',blast:'W02'}[id],pcm=weapon?bank.hit(weapon):['music','bossLoop','bossEntry'].includes(id)?bank[id]():bank.short(id);assert.equal(joined(pcm),expectedHash,'frozen 9044 PCM '+id);}
 const info=bank.info();assert.ok(info.candidatePcmBytes+info.maxCandidateBufferBytes<=512*1024);assert.equal(info.musicRenders,1);assert.equal(info.bossLoopRenders,1);assert.equal(info.bossEntryRenders,1);
});
export async function makeRig(){
 const {createAudioSession}=await exported('src/audio/session.ts'),cache=new Map(),sounds=[],tweens=[],timers=[];
 const context={state:'running',currentTime:0,resume(){return Promise.resolve();},close(){this.state='closed';return Promise.resolve();},createBuffer(n,length){return {getChannelData(){return new Float32Array(length);}};}};
 const manager={sounds,mute:true,volume:1,stopAll(){sounds.forEach(s=>s.stop());},remove(sound){sound.stop();sounds.splice(sounds.indexOf(sound),1);return true;},add(key){const sound=new EventEmitter();Object.assign(sound,{key,isPlaying:false,source:null,loopSource:null,volume:1,rate:1,play(config){assert.equal(this.isPlaying,false,'busy native voice must not restart');Object.assign(this,config);this.isPlaying=true;this.source={};this.loopSource=config.loop?{}:null;return true;},stop(){this.isPlaying=false;this.source=null;this.loopSource=null;}});sounds.push(sound);return sound;},destroy(){this.stopAll();sounds.length=0;}};
 const audio=createAudioSession({makeContext:()=>context,makeManager:()=>manager,cache:{add:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)},samples:{short:()=>[new Float32Array(4)],hit:()=>[new Float32Array(6)],music:()=>[new Float32Array(8),new Float32Array(8)],bossLoop:()=>[new Float32Array(12),new Float32Array(12)],bossEntry:()=>[new Float32Array(6),new Float32Array(6)]},makeTween(config){const t={config,remove(){t.removed=true;},complete(){config.targets.gain=config.gain;config.onUpdate();config.onComplete();}};tweens.push(t);return t;},makeDelay(ms,fn){const t={ms,fn,remove(){t.removed=true;}};timers.push(t);return t;}});
 audio.setLocation('battle');await audio.enable();return {audio,cache,sounds,tweens,timers,context,manager};
}
test('real accepted facts select weapon fire/hit, critical replaces hit and incoming hurt replaces break',async()=>{
 const r=await makeRig();assert.equal(typeof r.audio.consume,'function');assert.equal(r.sounds.length,16);assert.equal(r.cache.size,12);
 r.audio.setWeapon('W04');await r.audio.continue();
 r.audio.consume({type:'fire',at:1,volleyId:31});r.audio.consume({type:'hit',at:1,critical:false,targetId:1,killed:false,targetKind:'enemy'});r.audio.consume({type:'hit',at:1.2,critical:true,targetId:2,killed:true,targetKind:'enemy'});
 r.audio.consume({type:'incoming',at:1.3,accepted:true,hpLost:4,shieldBroke:true});r.audio.consume({type:'incoming',at:1.4,accepted:true,hpLost:0,shieldBroke:true});
 for(const fact of [{accepted:true,hpLost:0,shieldBroke:false},{accepted:false,hpLost:12,shieldBroke:true}])r.audio.consume({type:'incoming',at:2,...fact});
 r.audio.consume({type:'xp',at:2,amount:0});r.audio.consume({type:'xp',at:2,amount:2});
 const s=r.audio.snapshot();assert.equal(s.events['fish-shot'],1);assert.equal(s.events.hit,1);assert.equal(s.events.critical,1);assert.equal(s.events.defeat,1);assert.equal(s.events.hurt,1);assert.equal(s.events['shield-break'],1);assert.equal(s.events.xp,1);assert.equal(s.weapon,'W04');assert.equal(s.hitVariant,'pierce');assert.equal(r.sounds.find(s=>s.key==='f1-hit'&&s.isPlaying).rate,1.06);
 r.audio.dispose();assert.equal(r.cache.size,0);
});
test('native idle voices, gates, 8FX priority and duck multiply music volume; pause cancels native callbacks',async()=>{
 const r=await makeRig();assert.equal(typeof r.audio.consume,'function');r.audio.effect('hit');r.audio.effect('hit');assert.equal(r.audio.snapshot().played.hit,1);assert.equal(r.audio.snapshot().dropped.hit,1);
 r.context.currentTime=.1;r.audio.effect('hit');assert.equal(r.audio.snapshot().played.hit,2);r.context.currentTime=.2;r.audio.effect('hit');r.context.currentTime=.3;r.audio.effect('hit');assert.equal(r.audio.snapshot().played.hit,3);
 for(const id of ['slingshot','fish-shot','bone-shot','xp','defeat'])r.audio.effect(id);assert.equal(r.audio.snapshot().effectsPlaying,8);r.audio.effect('hurt');assert.equal(r.audio.snapshot().effectsPlaying,8);assert.equal(r.audio.snapshot().played.hurt,1);assert.equal(r.audio.snapshot().preempted,1);assert.equal(r.tweens.at(-1).config.duration,50);
 r.tweens.at(-1).complete();assert.equal(r.audio.snapshot().duckGain,.7);assert.equal(r.timers.at(-1).ms,100);r.audio.configure({musicVolume:.4});assert.equal(r.sounds.find(s=>s.key==='f1-music').volume,.4*.7);r.timers.at(-1).fn();assert.equal(r.tweens.at(-1).config.duration,250);
 const late=r.tweens.at(-1);r.audio.pause('background');late.complete();assert.equal(r.audio.snapshot().activeSources,0);assert.equal(r.audio.snapshot().duckGain,1);assert.equal(r.audio.snapshot().duckPending,false);await r.audio.continue();assert.equal(r.audio.snapshot().effectsPlaying,0);assert.equal(r.audio.snapshot().musicPlaying,true);r.audio.dispose();
});
test('legacy effect and real facts share native Context gate clock even when Session elapsed differs',async()=>{
 const r=await makeRig();r.context.currentTime=10;r.audio.effect('hit');r.context.currentTime=10.09;
 r.audio.consume({type:'hit',at:.001,critical:false,targetId:1,killed:false,targetKind:'enemy'});
 assert.equal(r.audio.snapshot().played.hit,2,'fact timestamp is evidence, not a second gate clock');
 r.context.currentTime=10.18;r.audio.consume({type:'hit',at:900,critical:false,targetId:2,killed:false,targetKind:'enemy'});
 r.context.currentTime=10.27;r.audio.effect('hit');assert.equal(r.audio.snapshot().dropReasons['kind-busy'],1);r.audio.dispose();
});
test('weapon hit cache swap failure releases whole native batch and next gesture retries once',async()=>{
 const r=await makeRig(),add=r.manager.add.bind(r.manager);let calls=0;r.manager.add=(key)=>{if(++calls===2)throw Error('controlled swap failure');return add(key);};
 r.audio.setWeapon('W02');assert.equal(r.audio.snapshot().ready,false);assert.match(r.audio.snapshot().error,/controlled swap failure/);assert.equal(r.cache.size,0);assert.equal(r.sounds.length,0);
 await r.audio.enable();assert.equal(r.audio.snapshot().ready,true);assert.equal(r.audio.snapshot().nativeSounds,16);assert.equal(r.cache.size,12);r.audio.dispose();
});
test('weapon swap reports original failure even when native destruction also throws',async()=>{
 const r=await makeRig(),destroy=r.manager.destroy.bind(r.manager),add=r.manager.add.bind(r.manager);r.manager.add=()=>{throw Error('controlled swap failure');};r.manager.destroy=()=>{destroy();throw Error('controlled cleanup failure');};
 assert.doesNotThrow(()=>r.audio.setWeapon('W02'));assert.match(r.audio.snapshot().error,/controlled swap failure/);assert.equal(r.cache.size,0);assert.equal(r.audio.snapshot().nativeSounds,0);r.manager.add=add;r.manager.destroy=destroy;await r.audio.enable();assert.equal(r.audio.snapshot().ready,true);r.audio.dispose();
});
