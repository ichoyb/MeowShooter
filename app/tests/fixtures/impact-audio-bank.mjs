// Isolated A/B adapter. The baseline is the current adopted three-weapon bank.
import {createCombatSampleBank} from '../../src/audio/combat-synthesis.mjs';
import {createSampleBank} from '../../src/audio/synthesis.mjs';
import {createImpactAudioBank,IMPACT_SOUND_SPECS} from '../../../assets/audio/combat-impact-v01/sounds.mjs';
import {eventSound} from './g5-audio-policy.mjs';

export const IMPACT_CRITICAL_IDS={W01:'critical-bell',W04:'critical-fish',W02:'critical-bone'};
const HIT_WEAPONS={thick:'W01',pierce:'W04',blast:'W02'};
export const impactEventSound=(fact,weapon)=>eventSound(fact,weapon,'candidate');
export function createImpactAuditionBank(){
 const adopted=createCombatSampleBank(),candidate=createImpactAudioBank(),legacyHit=createSampleBank();
 const effectId=(id,settings)=>id==='critical'?IMPACT_CRITICAL_IDS[settings.weapon]:id;
 return {
  short:id=>id==='hit'?legacyHit.short('hit'):adopted.short(id),
  hit:variant=>adopted.hit(HIT_WEAPONS[variant]),
  music:()=>adopted.music(),bossLoop:()=>adopted.bossLoop(),bossEntry:()=>adopted.bossEntry(),
  prewarm(){for(const weapon of Object.values(HIT_WEAPONS))adopted.hit(weapon);for(const spec of IMPACT_SOUND_SPECS)candidate.render(spec.id);},
  effect:(id,settings)=>settings.comparison==='old'?adopted.short(id):candidate.render(effectId(id,settings)),
  effectVariant:(id,settings)=>settings.comparison==='old'?'adopted:'+id:'candidate:'+effectId(id,settings),
  info(){const baseline=adopted.info(),next=candidate.info(),legacy=legacyHit.info();return {...baseline,extraPcmBytes:next.pcmBytes,adoptedEffectPcmBytes:baseline.shortPcmBytes+baseline.candidatePcmBytes,legacyVerificationPcmBytes:legacy.shortPcmBytes,newCandidatePcmBytes:next.pcmBytes,persistentPcmBytes:baseline.persistentPcmBytes+next.pcmBytes+legacy.persistentPcmBytes,candidate:next,budgetScope:'New candidate PCM plus all non-original active audition AudioBuffers; adopted source PCM and music reported separately'};}
 };
}
