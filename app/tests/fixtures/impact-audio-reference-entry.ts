// Build-time references only; never creates a playback context or imports the DOM player.
// @ts-expect-error Pure JS candidate with direct PCM/native tests.
export {createImpactAuditionBank,impactEventSound,IMPACT_CRITICAL_IDS} from './impact-audio-bank.mjs';
// @ts-expect-error Canonical candidate source parameters.
export {createImpactAudioBank,IMPACT_SOUND_SPECS,IMPACT_AUDIO_FORMAT,IMPACT_AUDIO_SOURCE} from '../../../assets/audio/combat-impact-v01/sounds.mjs';
// @ts-expect-error Existing policy with direct Node tests.
export {FX_COPIES,createRequestGate,voiceDecision} from './g5-audio-policy.mjs';
export {impactAudioTimeline} from './impact-audio-timeline';
