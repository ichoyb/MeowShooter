import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const modelURL=new URL('./fixtures/g5-audio-policy.mjs',import.meta.url);
const model=existsSync(modelURL)?await import(modelURL):null;
test('G5 independent audition has an event selection policy',()=>assert.ok(model,'missing isolated audition policy'));
test('critical replaces ordinary hit; HP loss replaces break; absorption stays silent',()=>{
 assert.ok(model,'missing isolated audition policy');
 assert.equal(model.eventSound({type:'contact',critical:true},'W04','candidate').id,'critical');
 assert.equal(model.eventSound({type:'contact',critical:false},'W04','candidate').id,'hit');
 assert.equal(model.eventSound({type:'damage',hpLost:4,shieldBroke:true},'W01','candidate').id,'hurt');
 assert.equal(model.eventSound({type:'damage',hpLost:0,shieldBroke:true},'W01','candidate').id,'shield-break');
 assert.equal(model.eventSound({type:'damage',hpLost:0,shieldBroke:false},'W01','candidate'),null);
});
test('three candidate root volleys have separate identity and subtle hit rates',()=>{
 assert.ok(model,'missing isolated audition policy');
 assert.deepEqual(['W01','W04','W02'].map(w=>model.eventSound({type:'fire'},w,'candidate').id),['slingshot','fish-shot','bone-shot']);
 assert.deepEqual(['W01','W04','W02'].map(w=>model.eventSound({type:'contact'},w,'candidate').rate),[1,1.06,.94]);
 assert.equal(model.eventSound({type:'fire'},'W04','old').id,'slingshot');
 assert.equal(model.eventSound({type:'contact',critical:true},'W04','old').id,'hit');
});
test('requests at gate boundary pass; rejected requests never extend or queue the gate',()=>{
 assert.ok(model,'missing isolated audition policy');
 for(const [id,gap] of [['hit',80],['critical',120],['defeat',100],['xp',120]]){
  const gate=model.createRequestGate(); assert.equal(gate.accept(id,0),true);
  assert.equal(gate.accept(id,gap-1),false);assert.equal(gate.accept(id,gap),true);
  gate.clear();assert.equal(gate.accept(id,0),true);
 }
});
test('native availability avoids busy same-kind restart; priority only preempts a lower sound',()=>{
 assert.ok(model,'missing isolated audition policy');
 const sound=(id,busy,p=2)=>({isPlaying:busy,g5:{id,priority:p}});
 const busy=sound('hit',true),free=sound('hit',false);
 assert.equal(model.voiceDecision([busy,free],{id:'hit',priority:2}).voice,free);
 assert.equal(model.voiceDecision([busy],{id:'hit',priority:2}).reason,'kind-busy');
 const voices=Array.from({length:8},()=>sound('hit',true));voices.push(sound('xp',false,1),sound('hurt',false,4));
 assert.equal(model.voiceDecision(voices,{id:'xp',priority:1}).reason,'priority-full');
 const choice=model.voiceDecision(voices,{id:'hurt',priority:4});assert.equal(choice.voice.g5.id,'hurt');assert(choice.stop);assert.equal(choice.stop.g5.priority,2);
});
test('candidate PCM canonical spec has exactly five short, deterministic, gentle sketches',async()=>{
 const url=new URL('../../assets/audio/g5-combat-v01/sound-specs.mjs',import.meta.url);
 assert.ok(existsSync(url),'missing canonical candidate sound specs');
 const {CANDIDATE_SOUND_SPECS}=await import(url);
 assert.deepEqual(CANDIDATE_SOUND_SPECS.map(s=>s.id),['fish-shot','bone-shot','critical','shield-break','xp']);
 for(const s of CANDIDATE_SOUND_SPECS){assert.equal(s.parameters[1],0);assert(s.parameters[3]>=.003);assert(s.parameters[5]<=.24);assert.equal(s.parameters[10],0);}
});
