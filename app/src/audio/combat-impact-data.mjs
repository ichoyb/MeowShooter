// Adopted 2026-11-12 combat-impact-v01. Source SHA-256:
// 16e7b55894764fc7227cb746ce6e5350eec60c7053105e2722e8eeeffce32dea.
// App owns the adopted parameters; the immutable audition remains a source record.
import {SOUND_SPECS} from './sound-data.mjs';
import {COMBAT_SOUND_SPECS} from './combat-data.mjs';

const adoptedParameters = id => (id === 'hurt' ? SOUND_SPECS : COMBAT_SOUND_SPECS).find(spec => spec.id === id).parameters.slice();
const freezeSpec = spec => Object.freeze({...spec, layers:Object.freeze(spec.layers.map(layer => Object.freeze({...layer, parameters:Object.freeze(layer.parameters)})))});

// ZzFX parameter order: volume, randomness, frequency, attack, sustain, release,
// shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
// noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter.
// New layers use no phase noise. Shape 4 is ZzFX's deterministic sin(t**3) crack.
export const ADOPTED_IMPACT_SOUND_SPECS = Object.freeze([
 freezeSpec({id:'critical-bell', label:'铃铛暴击 · 木弹厚铛', direction:'先短木弹，再厚金属铃；保留铛的身份，以瞬态和尾音对比增加重量。', durationSeconds:.19, mixGain:.88, layers:[
  {label:'木弹接触', atSeconds:0, gain:.66, parameters:[.25,0,205,.002,.004,.055,1,1.4,-.35,0,0,0,0,0,0,0,0,.65,.006,0,-1100]},
  {label:'低中频铃体', atSeconds:.004, gain:.92, parameters:[.28,0,470,.002,.008,.155,0,1.25,-.06,0,0,0,0,0,1.6,0,.006,.58,.008,0,-1800]},
  {label:'克制金属泛音', atSeconds:.004, gain:.2, parameters:[.16,0,940,.002,.004,.11,0,1.2,-.08,0,0,0,0,0,2.2,0,0,.5,.005,0,-2100]}
 ]}),
 freezeSpec({id:'critical-fish', label:'小鱼干暴击 · 飞掠切入', direction:'干脆飞掠和穿刺，不加低频炮体，不拉长为尖啸。', durationSeconds:.1, mixGain:.9, layers:[
  {label:'短切碎点', atSeconds:0, gain:.8, parameters:[.28,0,1100,.002,.002,.055,4,1.9,-.7,0,0,0,0,0,0,0,0,.6,.006,0,-1500]},
  {label:'结实穿刺', atSeconds:.004, gain:.7, parameters:[.21,0,790,.002,.002,.07,1,1.2,-.7,0,0,0,0,0,0,0,0,.58,.006,0,-1700]}
 ]}),
 freezeSpec({id:'critical-bone', label:'鱼骨暴击 · 闷裂短爆', direction:'低中频闷击附短碎裂，避免长噪声和刺耳碎片。', durationSeconds:.16, mixGain:.92, layers:[
  {label:'低中频炮体', atSeconds:0, gain:.9, parameters:[.32,0,120,.004,.005,.12,1,1.5,-.6,0,0,0,0,0,0,0,0,.62,.009,0,-900]},
  {label:'短碎裂', atSeconds:.003, gain:.5, parameters:[.23,0,260,.002,.002,.055,4,2,-.45,0,0,0,0,0,0,0,0,.55,.005,0,-850]}
 ]}),
 freezeSpec({id:'hurt', label:'受伤 · 低沉短警示', direction:'保留当前低沉软钝主体，补一记短下行警示，不伪装成武器炮声。', durationSeconds:.145, mixGain:.94, layers:[
  {label:'当前已采用hurt主体', sourceId:'hurt', atSeconds:0, gain:.96, parameters:adoptedParameters('hurt')},
  {label:'短警示下行', atSeconds:.008, gain:.35, parameters:[.13,0,178,.004,.003,.064,0,1.3,-.6,0,0,0,0,0,0,0,0,.55,.005,0,-850]}
 ]}),
 freezeSpec({id:'shield-break', label:'破盾 · 短碎弧回落', direction:'沿当前碎弧，音高高于hurt；缩短收尾，避免尖啸。', durationSeconds:.215, mixGain:.86, layers:[
  {label:'当前已采用碎弧主体', sourceId:'shield-break', atSeconds:0, gain:.86, parameters:adoptedParameters('shield-break')},
  {label:'短弧裂点', atSeconds:.003, gain:.22, parameters:[.17,0,510,.003,.002,.055,1,1.6,-1,0,0,0,0,0,0,0,0,.5,.006,0,-1300]}
 ]})
]);
