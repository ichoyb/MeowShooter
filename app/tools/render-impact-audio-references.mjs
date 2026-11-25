// Offline audition WAVs. No limiter, normalization, playback or battle simulation.
// The same candidate bank, selection, gate and voice policy as the native fixture.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.env.IMPACT_AUDIO_DIR||'../.local/checks/combat-impact-audio-20261112/candidate-v1'),out=path.join(root,'wav');
mkdirSync(out,{recursive:true});
const {createImpactAuditionBank,IMPACT_SOUND_SPECS,impactEventSound,impactAudioTimeline,FX_COPIES,createRequestGate,voiceDecision}=await import(pathToFileURL(path.join(root,'reference-api.mjs')));
const bank=createImpactAuditionBank(),rate=44100,sha=b=>createHash('sha256').update(b).digest('hex'),references=[];
bank.prewarm();
const metrics=channels=>{let peak=0,sum=0,n=0,clipping=0;for(const c of channels)for(const v of c){if(!Number.isFinite(v))throw Error('Non-finite PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;n++;if(Math.abs(v)>=1)clipping++;}return {peak,rms:Math.sqrt(sum/n),clipping,samples:n,channels:channels.length,duration:channels[0].length/rate};};
const pcmHash=channels=>{const h=createHash('sha256');for(const c of channels)h.update(Buffer.from(c.buffer,c.byteOffset,c.byteLength));return h.digest('hex');};
const pcm=(id,settings)=>['critical','hurt','shield-break'].includes(id)?bank.effect(id,settings):id==='hit'?bank.hit(({W01:'thick',W04:'pierce',W02:'blast'})[settings.weapon]):bank.short(id);
function wav(name,channels,detail){
 const measured=metrics(channels);if(measured.clipping)throw Error('Unbounded float mix clips '+name);
 const data=Buffer.alloc(channels[0].length*channels.length*2),header=Buffer.alloc(44);
 for(let i=0;i<channels[0].length;i++)for(let c=0;c<channels.length;c++)data.writeInt16LE(Math.round(channels[c][i]*32767),(i*channels.length+c)*2);
 header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels.length,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*channels.length*2,28);header.writeUInt16LE(channels.length*2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 const bytes=Buffer.concat([header,data]);writeFileSync(path.join(out,name+'.wav'),bytes);
 const record={file:'wav/'+name+'.wav',SHA256:sha(bytes),...measured,...detail};references.push(record);return record;
}
for(const weapon of ['W01','W04','W02'])for(const comparison of ['old','candidate']){
 const source=pcm('critical',{weapon,comparison});wav(comparison+'-'+weapon+'-critical',source.map(c=>Float32Array.from(c,v=>v*.3*.65)),{kind:'single',id:'critical',weapon,comparison,rawPCM_SHA256:pcmHash(source)});
}
for(const id of ['hurt','shield-break'])for(const comparison of ['old','candidate']){
 const source=pcm(id,{weapon:'W01',comparison});wav(comparison+'-'+id,source.map(c=>Float32Array.from(c,v=>v*.3*.65)),{kind:'single',id,comparison,rawPCM_SHA256:pcmHash(source)});
}
const musicPCM={courtyard:bank.music(),entry:bank.bossEntry(),boss:bank.bossLoop()};
function mix(weapon,density,comparison,music){
 const settings={weapon,comparison},timeline=impactAudioTimeline(weapon,density),accepted=[],requests=[],gate=createRequestGate();let peakVoices=0;
 const voices=Object.entries(FX_COPIES).flatMap(([id,n])=>Array.from({length:n},()=>({isPlaying:false,end:-1,g5:{id,priority:0},record:null})));
 for(const fact of timeline.events){const req=impactEventSound(fact,weapon);if(!req)continue;for(const v of voices)v.isPlaying=v.end>fact.at;
  if(!gate.accept(req.id,fact.at)){requests.push({...req,at:fact.at,status:'gate'});continue;}
  const choice=voiceDecision(voices,req);if(!choice.voice){requests.push({...req,at:fact.at,status:choice.reason});continue;}
  if(choice.stop){choice.stop.record.end=fact.at;choice.stop.isPlaying=false;}
  const record={...req,at:fact.at,end:Math.min(timeline.duration,fact.at+pcm(req.id,settings)[0].length/rate/req.rate*1000)};
  accepted.push(record);Object.assign(choice.voice,{isPlaying:true,end:record.end,record});choice.voice.g5.priority=req.priority;
  requests.push({...req,at:fact.at,status:'played'});peakVoices=Math.max(peakVoices,voices.filter(v=>v.isPlaying).length);
 }
 const length=Math.round(timeline.duration*rate/1000),channels=[new Float32Array(length),new Float32Array(length)];
 for(const a of accepted){const source=pcm(a.id,settings)[0],start=Math.round(a.at*rate/1000),end=Math.min(length,Math.round(a.end*rate/1000));
  for(let i=start;i<end;i++){const p=(i-start)*a.rate,j=Math.floor(p),f=p-j,v=((source[j]||0)*(1-f)+(source[j+1]||0)*f)*.3*.65*a.gain;channels[0][i]+=v;channels[1][i]+=v;}
 }
 const ducks=accepted.filter(a=>['hurt','shield-break'].includes(a.id)).map(a=>a.at);
 const duckAt=ms=>{let gain=1;for(const at of ducks){const d=ms-at;if(d>=0&&d<50)gain=1-.3*d/50;else if(d>=50&&d<150)gain=.7;else if(d>=150&&d<400)gain=.7+.3*(d-150)/250;}return gain;};
 if(music!=='off')for(let i=0;i<length;i++){
  const entryLength=musicPCM.entry[0].length,source=music==='courtyard'?musicPCM.courtyard:i<entryLength?musicPCM.entry:musicPCM.boss;
  const j=music==='boss'&&i>=entryLength?(i-entryLength)%source[0].length:i%source[0].length;
  const fade=music==='boss'&&i>=entryLength?Math.min(1,(i-entryLength)/rate/.3):1,gain=.3*.65*duckAt(i/rate*1000)*fade;
  for(let c=0;c<2;c++)channels[c][i]+=source[c][j]*gain;
 }
 return wav([comparison,weapon,density,music].join('-'),channels,{kind:'mix',weapon,density,comparison,music,peakVoices,requests,accepted,rootSource:timeline.rootSource,fixedFacts:true});
}
for(const weapon of ['W01','W04','W02'])for(const density of ['sparse','crowded'])for(const comparison of ['old','candidate'])for(const music of ['off','courtyard','boss'])mix(weapon,density,comparison,music);
const report={scope:'OFFLINE_FLOAT_REFERENCE_NOT_NATIVE_DEVICE_RECORDING',atUtc:new Date().toISOString(),sampleRate:rate,
 rawCandidateSpecs:IMPACT_SOUND_SPECS,bank:bank.info(),musicSHA256:Object.fromEntries(Object.entries(musicPCM).map(([id,channels])=>[id,pcmHash(channels)])),
 normalization:false,limiter:false,hardClipping:false,duckCurve:'50ms to .7, hold100ms,250ms recovery; existing curve',
 caveat:'No subjective listening, platform or phone claims. First fixed-generator cold synthesis consumes Math.random; all audition playback uses cached PCM.',
 references};
writeFileSync(path.join(root,'audio-reference.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({references:references.length,out,maxPeak:Math.max(...references.map(r=>r.peak)),maxConcurrent:Math.max(...references.filter(r=>r.kind==='mix').map(r=>r.peakVoices)),newCandidatePcmBytes:report.bank.newCandidatePcmBytes}));
