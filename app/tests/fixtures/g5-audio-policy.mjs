// Presentation-only decisions for the isolated audition. Native Sound owns playback/lifecycle.
export const FX_COPIES={slingshot:1,hit:3,defeat:1,hurt:2,'fish-shot':1,'bone-shot':1,critical:2,'shield-break':1,xp:1};
export const DEFAULT_SETTINGS={music:true,effects:true,musicVolume:.65,effectsVolume:.65,muted:false,track:'off',weapon:'W01',comparison:'candidate'};
export const PRIORITY={hurt:4,'shield-break':4,critical:3,hit:2,slingshot:2,'fish-shot':2,'bone-shot':2,defeat:1,xp:1};
export const GATES={hit:80,critical:120,defeat:100,xp:120};
export function eventSound(event,weapon='W01',comparison='candidate'){
 let id=null,rate=1,gain=1;
 if(event.type==='fire')id=comparison==='old'?'slingshot':({W01:'slingshot',W04:'fish-shot',W02:'bone-shot'})[weapon];
 if(event.type==='contact'){id=event.critical&&comparison==='candidate'?'critical':'hit';if(id==='hit'&&comparison==='candidate'){rate=({W01:1,W04:1.06,W02:.94})[weapon];gain=({W01:.8,W04:.7,W02:.78})[weapon];}}
 if(event.type==='damage')id=event.hpLost>0?'hurt':event.shieldBroke&&comparison==='candidate'?'shield-break':null;
 if(event.type==='defeat')id='defeat';
 if(event.type==='xp'&&comparison==='candidate'){id='xp';gain=.7;}
 return id?{id,rate,gain,priority:PRIORITY[id]}:null;
}
export function createRequestGate(){
 const previous=new Map();
 return {accept(id,at){const before=previous.get(id);if(before!==undefined&&at-before<(GATES[id]||0)-.001)return false;previous.set(id,at);return true;},clear(){previous.clear();}};
}
export function voiceDecision(nativeSounds,request){
 const voices=nativeSounds.filter(s=>s.g5),active=voices.filter(s=>s.isPlaying);
 const voice=voices.find(s=>s.g5.id===request.id&&!s.isPlaying);
 if(!voice)return {reason:'kind-busy'};
 if(active.length<8)return {voice};
 const stop=active.filter(s=>s.g5.priority<request.priority).sort((a,b)=>a.g5.priority-b.g5.priority)[0];
 return stop?{voice,stop}:{reason:'priority-full'};
}
