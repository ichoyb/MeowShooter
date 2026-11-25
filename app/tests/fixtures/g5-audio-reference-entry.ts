// @ts-expect-error Isolated JS bank is checked by PCM references and native tests.
export {createAuditionBank,ALL_SOUND_SPECS,CANDIDATE_SOUND_SPECS,HIT_VARIANTS,WEAPON_HITS} from './g5-audio-bank.mjs';
// @ts-expect-error Existing JavaScript synthesis is pinned and byte-preserved.
export {createSampleBank} from '../../src/audio/synthesis.mjs';
export {auditionTimeline} from './g5-audio-timeline';
// @ts-expect-error Isolated JavaScript policy has direct Node behavior tests.
export {eventSound,FX_COPIES,createRequestGate,voiceDecision} from './g5-audio-policy.mjs';
