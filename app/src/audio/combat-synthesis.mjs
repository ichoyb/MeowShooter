import {ZZFX} from './vendor/current/ZzFX.js';
import {createSampleBank} from './synthesis.mjs';
import {COMBAT_SOUND_SPECS,WEAPON_AUDIO,WEAPON_CRITICAL_AUDIO} from './combat-data.mjs';
import {createAdoptedImpactBank} from './combat-impact-synthesis.mjs';
export {COMBAT_SOUND_SPECS};
// Default preserves the historical source-bank contract used by immutable auditions.
// The normal runtime explicitly enables the adopted pre-mixes.
export function createCombatSampleBank({impact=false}={}){
 const original=createSampleBank(),extra=new Map(),impacts=impact?createAdoptedImpactBank():null;let synthesisMs=0;
 const render=id=>{if(!extra.has(id)){const spec=COMBAT_SOUND_SPECS.find(s=>s.id===id);if(!spec)throw Error('未知采用音色：'+id);const start=performance.now();extra.set(id,[ZZFX.buildSamples(...spec.parameters)]);synthesisMs+=performance.now()-start;}return extra.get(id);};
 return {short(id,weapon='W01'){if(impacts&&['critical','hurt','shield-break'].includes(id))return impacts.render(id==='critical'?WEAPON_CRITICAL_AUDIO[weapon]:id);return ['slingshot','hurt','defeat'].includes(id)?original.short(id):render(id);},hit(weapon){return render(WEAPON_AUDIO[weapon].hit);},music:()=>original.music(),bossLoop:()=>original.bossLoop(),bossEntry:()=>original.bossEntry(),info(){
  const info=original.info();let candidatePcmBytes=0,newIdentityBytes=0,maxHitBytes=0;
  for(const [id,channels] of extra){const bytes=channels[0].byteLength;candidatePcmBytes+=bytes;if(['thick','pierce','blast'].includes(id))maxHitBytes=Math.max(maxHitBytes,bytes);else newIdentityBytes+=bytes;}
  const adopted=impacts?.info(),impactPcmBytes=adopted?.pcmBytes??0;
  const maxWeaponBytes=adopted?Math.max(0,...Object.keys(WEAPON_AUDIO).map(weapon=>(extra.get(WEAPON_AUDIO[weapon].hit)?.[0].byteLength??0)+(adopted.sounds.find(s=>s.id===WEAPON_CRITICAL_AUDIO[weapon])?.pcmBytes??0))):maxHitBytes;
  const dangerBytes=(adopted?.sounds??[]).filter(s=>!s.id.startsWith('critical-')).reduce((n,s)=>n+s.pcmBytes,0);
  return {...info,candidatePcmBytes,maxCandidateBufferBytes:newIdentityBytes+maxWeaponBytes+dangerBytes,extraSynthesisMs:synthesisMs,impact:adopted,persistentPcmBytes:info.persistentPcmBytes+candidatePcmBytes+impactPcmBytes};
 }};
}
