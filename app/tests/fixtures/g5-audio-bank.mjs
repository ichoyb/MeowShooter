import {ZZFX} from '../../src/audio/vendor/current/ZzFX.js';
import {createSampleBank,SOUND_SPECS} from '../../src/audio/synthesis.mjs';
import {CANDIDATE_SOUND_SPECS as FIRST_CANDIDATES} from '../../../assets/audio/g5-combat-v01/sound-specs.mjs';
import {HIT_VARIANTS as MANUAL_HITS} from '../../../assets/audio/g5-impact-v02/sound-specs.mjs';
import {WEAPON_FIRE_SPECS,WEAPON_HIT_VARIANTS,WEAPON_HITS} from '../../../assets/audio/g5-weapon-audio-v03/sound-specs.mjs';
export {WEAPON_HITS};
export const CANDIDATE_SOUND_SPECS=FIRST_CANDIDATES.map(spec=>WEAPON_FIRE_SPECS.find(next=>next.id===spec.id)||spec);
export const HIT_VARIANTS=[...MANUAL_HITS,...WEAPON_HIT_VARIANTS];
export const ALL_SOUND_SPECS=[...SOUND_SPECS,...CANDIDATE_SOUND_SPECS];
export function createAuditionBank(){
 const original=createSampleBank(),extra=new Map(),hits=new Map();let synthesisMs=0;
 return {short(id){if(SOUND_SPECS.some(s=>s.id===id))return original.short(id);const spec=CANDIDATE_SOUND_SPECS.find(s=>s.id===id);if(!spec)throw Error('Unknown isolated audition sound '+id);if(!extra.has(id)){const start=performance.now();extra.set(id,[ZZFX.buildSamples(...spec.parameters)]);synthesisMs+=performance.now()-start;}return extra.get(id);},hit(variant){if(variant==='original')return original.short('hit');const spec=HIT_VARIANTS.find(s=>s.id===variant);if(!spec)throw Error('Unknown hit variant '+variant);if(!hits.has(variant)){const start=performance.now();hits.set(variant,[ZZFX.buildSamples(...spec.parameters)]);synthesisMs+=performance.now()-start;}return hits.get(variant);},music:()=>original.music(),bossLoop:()=>original.bossLoop(),bossEntry:()=>original.bossEntry(),info(){const candidateEffectPcmBytes=[...extra.values()].reduce((n,c)=>n+c[0].byteLength,0),hitVariantPcmBytes=[...hits.values()].reduce((n,c)=>n+c[0].byteLength,0),extraPcmBytes=candidateEffectPcmBytes+hitVariantPcmBytes;return {...original.info(),candidateEffectPcmBytes,hitVariantPcmBytes,extraPcmBytes,extraPcmPlusAudioBufferBytes:extraPcmBytes+candidateEffectPcmBytes+Math.max(0,...[...hits.values()].map(c=>c[0].byteLength)),extraSynthesisMs:synthesisMs,extraIdentities:extra.size,hitVariants:hits.size};}};
}
