// Second-batch listen-first entry. No normal game or production audio wiring.
import {mountAudioAudition} from './g5-audio-audition';
// @ts-expect-error Isolated JS adapter checked by PCM and native browser tests.
import {createImpactAuditionBank,impactEventSound} from './impact-audio-bank.mjs';
import {impactAudioTimeline} from './impact-audio-timeline';
import type {WeaponId} from '../../src/combat-config';

const criticalButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-critical-weapon]'));
for(const button of criticalButtons)button.disabled=true;
const api=mountAudioAudition({bank:createImpactAuditionBank(),eventPolicy:impactEventSound,timeline:impactAudioTimeline,defaultSettings:{impact:'adopted',comparison:'candidate',track:'courtyard'},globalName:'impactAudioAudition',onReady(){for(const button of criticalButtons)button.disabled=false;}});
for(const button of criticalButtons)button.addEventListener('click',()=>api.singleCritical(button.dataset.criticalWeapon as WeaponId));
for(const button of Array.from(document.querySelectorAll<HTMLElement>('[data-important-sound]')))button.addEventListener('click',()=>api.singleImportant(button.dataset.importantSound as 'hurt'|'shield-break'));
