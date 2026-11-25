// Deterministic offline reference, not a recording of native browser/audio-device output.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.env.G5_AUDIO_DIR||'../.local/checks/g5-weapon-audition-20261105/green-v01'),out=path.join(root,'wav');
mkdirSync(out,{recursive:true});
const {createAuditionBank,createSampleBank,ALL_SOUND_SPECS,CANDIDATE_SOUND_SPECS,HIT_VARIANTS,WEAPON_HITS,auditionTimeline,eventSound,FX_COPIES,createRequestGate,voiceDecision}=await import(pathToFileURL(path.join(root,'reference-api.mjs')));
const rate=44100,bank=createAuditionBank(),original=createSampleBank(),pcm=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const metrics=channels=>{let peak=0,sum=0,clipping=0,nonFinite=0,n=0;for(const c of channels)for(const v of c){if(!Number.isFinite(v)){nonFinite++;continue;}peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clipping++;n++;}return {peak,rms:Math.sqrt(sum/n),clipSamples:clipping,nonFinite,sampleCount:n,duration:channels[0].length/rate,channels:channels.length};};
const pcmHash=channels=>{const h=createHash('sha256');for(const c of channels)h.update(Buffer.from(c.buffer,c.byteOffset,c.byteLength));return h.digest('hex');};
for(const spec of ALL_SOUND_SPECS)pcm.set(spec.id,bank.short(spec.id));
for(const spec of HIT_VARIANTS)bank.hit(spec.id);
pcm.set('courtyard',bank.music());pcm.set('boss-loop',bank.bossLoop());pcm.set('boss-entry',bank.bossEntry());
const originalPCM={};for(const id of ['slingshot','hit','defeat','hurt','courtyard','boss-loop','boss-entry']){
 const current=pcm.get(id),before=id==='courtyard'?original.music():id==='boss-loop'?original.bossLoop():id==='boss-entry'?original.bossEntry():original.short(id);
 const beforeHash=pcmHash(before),afterHash=pcmHash(current);if(beforeHash!==afterHash)throw Error('Original PCM changed '+id);originalPCM[id]={beforeSHA256:beforeHash,afterSHA256:afterHash,equal:true,bytes:current.reduce((n,c)=>n+c.byteLength,0),...metrics(current)};
}
function wav(name,channels,extra={}){
 const measured=metrics(channels);if(measured.peak>=1||measured.nonFinite)throw Error('Unclipped float reference is invalid: '+name+' '+JSON.stringify(measured));
 // Quantize only after measuring the unbounded float mix; no limiter or clamp.
 const data=Buffer.alloc(channels[0].length*channels.length*2),header=Buffer.alloc(44);
 for(let i=0;i<channels[0].length;i++)for(let c=0;c<channels.length;c++)data.writeInt16LE(Math.round(channels[c][i]*32767),(i*channels.length+c)*2);
 header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels.length,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*channels.length*2,28);header.writeUInt16LE(channels.length*2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 const bytes=Buffer.concat([header,data]);writeFileSync(path.join(out,name+'.wav'),bytes);return {file:'wav/'+name+'.wav',SHA256:sha(bytes),floatPCM:measured,hardClippingOrNormalization:false,...extra};
}
const references=[];
for(const spec of ALL_SOUND_SPECS){const samples=pcm.get(spec.id),gain=.3*.65*(spec.id==='xp'?.7:1);references.push(wav('single-'+spec.id,samples.map(c=>Float32Array.from(c,v=>v*gain)),{kind:'single',id:spec.id,gain,rawPCM:{SHA256:pcmHash(samples),...metrics(samples)}}));}
for(const spec of HIT_VARIANTS){const samples=bank.hit(spec.id),gain=.3*.65;references.push(wav('single-hit-'+spec.id,samples.map(c=>Float32Array.from(c,v=>v*gain)),{kind:'single',id:'hit',variant:spec.id,gain,rawPCM:{SHA256:pcmHash(samples),...metrics(samples)}}));}
for(const weapon of ['W01','W04','W02'])for(const phase of ['fire','hit']){
 const req=eventSound({type:phase==='fire'?'fire':'contact'},weapon,'candidate'),samples=req.id==='hit'?bank.hit(WEAPON_HITS[weapon]):bank.short(req.id),gain=.3*.65*req.gain;
 const channels=samples.map(source=>Float32Array.from({length:Math.ceil(source.length/req.rate)},(_,i)=>{const p=i*req.rate,j=Math.floor(p),frac=p-j;return ((source[j]||0)*(1-frac)+(source[j+1]||0)*frac)*gain;}));
 references.push(wav('weapon-'+weapon+'-'+phase,channels,{kind:'weapon-single',weapon,phase,id:req.id,impact:WEAPON_HITS[weapon],rate:req.rate,gain,rawPCM_SHA256:pcmHash(samples)}));
}
function render(weapon,density,comparison,music='off',impact='original'){
 const getPCM=id=>id==='hit'?bank.hit(comparison==='old'?'original':impact==='weapon'?WEAPON_HITS[weapon]:impact):pcm.get(id);
 const timeline=auditionTimeline(weapon,density),voices=Object.entries(FX_COPIES).flatMap(([id,n])=>Array.from({length:n},()=>({isPlaying:false,end:-1,g5:{id,priority:0},record:null}))),gate=createRequestGate(),accepted=[],requests=[];let peakVoices=0,preemptions=0;
 for(const fact of timeline.events){const req=eventSound(fact,weapon,comparison);if(!req)continue;for(const voice of voices)voice.isPlaying=voice.end>fact.at;
  if(!gate.accept(req.id,fact.at)){requests.push({at:fact.at,id:req.id,status:'gate'});continue;}
  const choice=voiceDecision(voices,req);if(!choice.voice){requests.push({at:fact.at,id:req.id,status:choice.reason});continue;}
  if(choice.stop){choice.stop.record.end=fact.at;choice.stop.isPlaying=false;preemptions++;}
  const record={...req,at:fact.at,end:Math.min(timeline.duration,fact.at+getPCM(req.id)[0].length/rate/req.rate*1000)};accepted.push(record);choice.voice.isPlaying=true;choice.voice.g5.priority=req.priority;choice.voice.end=record.end;choice.voice.record=record;requests.push({at:fact.at,id:req.id,status:'played'});peakVoices=Math.max(peakVoices,voices.filter(v=>v.isPlaying).length);
 }
 const length=Math.round(timeline.duration/1000*rate),channels=[new Float32Array(length),new Float32Array(length)],ducks=accepted.filter(a=>a.id==='hurt'||a.id==='shield-break').map(a=>a.at);
 for(const a of accepted){const source=getPCM(a.id)[0],start=Math.round(a.at/1000*rate),end=Math.min(length,Math.round(a.end/1000*rate)),gain=.3*.65*a.gain;
  for(let i=start;i<end;i++){const p=(i-start)*a.rate,j=Math.floor(p),frac=p-j,value=((source[j]||0)*(1-frac)+(source[j+1]||0)*frac)*gain;channels[0][i]+=value;channels[1][i]+=value;}
 }
 const duckAt=ms=>{let g=1;for(const at of ducks){const d=ms-at;if(d>=0&&d<50)g=1-.3*d/50;else if(d>=50&&d<150)g=.7;else if(d>=150&&d<400)g=.7+.3*(d-150)/250;}return g;};
 if(music!=='off')for(let i=0;i<length;i++){
  const ms=i/rate*1000,entry=pcm.get('boss-entry'),entryLength=entry[0].length;
  const source=music==='courtyard'?pcm.get('courtyard'):i<entryLength?entry:pcm.get('boss-loop'),j=music==='boss'&&i>=entryLength?(i-entryLength)%source[0].length:i%source[0].length;
  const fade=music==='boss'&&i>=entryLength?Math.min(1,(i-entryLength)/rate/.3):1,gain=.3*.65*duckAt(ms)*fade;
  channels[0][i]+=source[0][j]*gain;channels[1][i]+=source[1][j]*gain;
 }
 return wav([comparison,weapon,density,music,...(impact==='original'?[]:[impact])].join('-'),channels,{kind:'mix',weapon,density,comparison,music,impact:comparison==='old'?'original':impact,requested:requests.length,played:accepted.length,dropped:requests.length-accepted.length,peakVoices,preemptions,rootSource:timeline.rootSource,fixedFacts:true,requests,accepted});
}
for(const weapon of ['W01','W04','W02'])for(const density of ['sparse','crowded'])for(const comparison of ['old','candidate'])for(const music of ['off','courtyard','boss'])references.push(render(weapon,density,comparison,music));
for(const impact of ['thick','crisp','weapon'])for(const weapon of ['W01','W04','W02'])for(const density of ['sparse','crowded'])for(const music of ['off','courtyard','boss'])references.push(render(weapon,density,'candidate',music,impact));
const report={scope:'DETERMINISTIC_OFFLINE_REFERENCE_NOT_NATIVE_LIVE_CAPTURE',sampleRate:rate,format:'PCM16 after unclipped Float32 metrics; no clamp, limiter, normalization, or old-music PCM processing',randomness:'No seed override; all used frequency-randomness parameters are zero. Original and audition bank independently re-rendered then SHA-compared. Runtime AB shares one original bank.',at:new Date().toISOString(),sourceBuild:JSON.parse(readFileSync(path.join(root,'audio-build.json'),'utf8')),originalPCM,candidates:CANDIDATE_SOUND_SPECS.map(s=>({...s,PCM_SHA256:pcmHash(pcm.get(s.id)),...metrics(pcm.get(s.id))})),hitVariants:HIT_VARIANTS.map(s=>({...s,PCM_SHA256:pcmHash(bank.hit(s.id)),...metrics(bank.hit(s.id))})),weaponHitMapping:WEAPON_HITS,budget:{...bank.info(),maximumActiveCandidateAudioBufferBytes:bank.info().candidateEffectPcmBytes+Math.max(...HIT_VARIANTS.map(s=>bank.hit(s.id)[0].byteLength)),candidatePcmPlusActiveAudioBufferBytes:bank.info().extraPcmPlusAudioBufferBytes},references};
if(report.budget.extraPcmPlusAudioBufferBytes>524288)throw Error('Candidate PCM budget');
writeFileSync(path.join(root,'audio-reference.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',references:references.length,out,extraPcmPlusAudioBufferBytes:report.budget.extraPcmPlusAudioBufferBytes,originalPCMEqual:true}));
