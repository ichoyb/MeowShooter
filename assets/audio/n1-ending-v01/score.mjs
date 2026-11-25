// N1-E1 isolated review source. Bundle only with the existing pinned lazy vendor plugin.
// Direct Node import of the unconverted vendor would eagerly construct AudioContext.
import {ZZFX} from '../../../app/src/audio/vendor/current/ZzFX.js';

export const SAMPLE_RATE = 44100;
export const DURATION = 24;
const FRAMES = SAMPLE_RATE * DURATION;
const TAU = Math.PI * 2;

export const SPEC = {
  id: 'n1-ending-v01',
  title: '那条不记得的街 · 首章通关尾声',
  authorship: '项目原创24秒乐句、音色参数及夜风合成；未作外部CC0授权',
  reviewStatus: '待用户试听',
  useStatus: 'N1-E1独立动态漫画粗剪候选；未接正常游戏、未发布',
  sampleRate: SAMPLE_RATE,
  duration: DURATION,
  channels: {music: 2, world: 1},
  voiceover: false,
  storyBell: false,
  masterGain: 2.4,
  defaultStemGain: 0.8,
  defaultEffectiveGain: 1.92,
  gainBoundary: '以上为独立评审播放器建议；PCM未乘master或滑杆增益，最大2.4混音另验峰值',
  direction: '守院后的温度→门牌收细→认得字却忘了街的停顿→温暖但未决的风炉街目的',
  harmony: 'Cmaj7/add9、Am/F与G悬音；新写自由短句，只延续开场木键与拨音气质',
  instruments: ['柔和三角拨音', '短尾木键', '低三角音支撑'],
  sections: [
    {id: 'home-kept', start: 0, end: 4.5, intent: '院门保住，灯还亮；温暖短句回落'},
    {id: 'nameplate', start: 4.5, end: 10, intent: '读门牌与弯钉，配乐收细，不制造敲击动作'},
    {id: 'forgotten-street', start: 10, end: 18, intent: '听雪认出笔迹，迟疑处留白，再承接失忆对白'},
    {id: 'toward-fenglu', start: 18, end: 24, intent: '下一步去风炉街；温暖动机以悬音留下疑问'},
  ],
  lowField: {start: 14, end: 15, gain: 0.04, ramps: 0.12},
  worldEvents: [{id: 'night-wind', at: 0, source: '画中夜院与雾路环境；仅很轻夜风，无动作拟音'}],
  synthesis: {
    vendor: 'app/src/audio/vendor/current/ZzFX.js；精确SHA由现有锁定vendor插件校验',
    api: '只用ZZFX.buildSamples；不播放、不创建Context、不修改vendor或全局Math.random',
    randomness: 0,
    randomnessCaveat: 'vendor仍调用Math.random；重复PCM已测稳定，不声称没有消费全局随机序列',
    noise: '本源局部LCG种子191；带限夜风，不借用玩法随机源',
    output: '固定24秒Float32 PCM；无压限、削波或自动响度归一化；首尾淡出',
  },
};

// [秒, MIDI, 尾音秒, 力度, 音色, 声像]；为本尾声独立手写，未读取/复刻旧18秒曲。
const NOTES = [
  // 0–4.5：门和灯仍在。起句用高处下行与低音留空，非战斗胜利号角。
  [0.10, 48, 1.65, 0.16, 'bass', 0],
  [0.19, 64, 0.84, 0.16, 'pluck', -0.08],
  [0.55, 55, 0.70, 0.075, 'wood', -0.22],
  [0.92, 67, 0.89, 0.145, 'pluck', 0.04],
  [1.39, 71, 0.70, 0.072, 'wood', 0.20],
  [1.73, 74, 0.86, 0.135, 'pluck', -0.06],
  [2.15, 43, 1.60, 0.14, 'bass', 0],
  [2.28, 71, 0.82, 0.12, 'pluck', 0.06],
  [2.66, 62, 0.72, 0.07, 'wood', -0.20],
  [3.00, 67, 0.82, 0.145, 'pluck', -0.06],
  [3.46, 59, 0.63, 0.065, 'wood', 0.18],
  [3.79, 64, 0.71, 0.12, 'pluck', 0.04],

  // 4.5–10：门牌与弯钉只作信息，不为静止画面配敲击。
  [4.58, 45, 1.60, 0.105, 'bass', 0],
  [4.75, 60, 0.90, 0.085, 'pluck', -0.06],
  [5.29, 64, 0.70, 0.052, 'wood', -0.18],
  [5.84, 71, 0.96, 0.078, 'pluck', 0.07],
  [6.52, 67, 0.76, 0.056, 'wood', 0.18],
  [6.98, 41, 1.61, 0.10, 'bass', 0],
  [7.17, 65, 0.95, 0.082, 'pluck', -0.06],
  [7.81, 60, 0.71, 0.052, 'wood', -0.17],
  [8.36, 69, 0.92, 0.077, 'pluck', 0.05],
  [9.03, 64, 0.75, 0.053, 'wood', 0.17],
  [9.47, 67, 0.60, 0.069, 'pluck', -0.05],

  // 10–18：认出字的上行停在未解的音，14–15无新起音。
  [10.06, 45, 1.62, 0.125, 'bass', 0],
  [10.23, 64, 0.88, 0.13, 'pluck', -0.07],
  [10.73, 69, 0.72, 0.065, 'wood', 0.18],
  [11.16, 72, 0.98, 0.112, 'pluck', 0.05],
  [11.78, 67, 0.72, 0.055, 'wood', -0.18],
  [12.15, 41, 1.12, 0.11, 'bass', 0],
  [12.32, 71, 0.87, 0.105, 'pluck', -0.05],
  [12.84, 65, 0.64, 0.055, 'wood', 0.17],
  [13.18, 68, 0.68, 0.086, 'pluck', 0.04],
  [15.25, 43, 1.60, 0.115, 'bass', 0],
  [15.42, 62, 0.91, 0.102, 'pluck', -0.06],
  [15.96, 57, 0.78, 0.055, 'wood', -0.18],
  [16.39, 64, 0.91, 0.102, 'pluck', 0.05],
  [16.92, 67, 0.75, 0.06, 'wood', 0.18],
  [17.38, 69, 0.76, 0.092, 'pluck', -0.05],

  // 18–24：院灯的动机再次出现，最后保留C上方的D，不作大终止。
  [18.06, 48, 1.64, 0.145, 'bass', 0],
  [18.23, 64, 0.93, 0.14, 'pluck', -0.07],
  [18.72, 55, 0.78, 0.07, 'wood', -0.20],
  [19.10, 67, 0.94, 0.125, 'pluck', 0.05],
  [19.66, 74, 0.80, 0.065, 'wood', 0.18],
  [20.10, 71, 1.04, 0.115, 'pluck', -0.06],
  [20.64, 43, 1.54, 0.12, 'bass', 0],
  [20.79, 69, 0.87, 0.085, 'pluck', 0.05],
  [21.23, 62, 0.86, 0.055, 'wood', -0.18],
  [21.70, 67, 0.98, 0.105, 'pluck', -0.05],
  [22.00, 48, 1.87, 0.10, 'bass', 0],
  [22.14, 64, 1.68, 0.055, 'wood', 0.16],
  [22.29, 74, 1.57, 0.095, 'pluck', 0.04],
];

const frame = seconds => Math.round(seconds * SAMPLE_RATE);
const smooth = value => {const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x);};
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

function add(target, pcm, at, gain) {
  const offset = frame(at);
  for (let i = 0; i < pcm.length && i + offset < target.length; i++) target[i + offset] += pcm[i] * gain;
}

function tone(frequency, duration, curve, sustain, filter) {
  return ZZFX.buildSamples(1, 0, frequency, 0.007, 0.016, duration,
    1, curve, 0, 0, 0, 0, 0, 0, 0, 0, 0, sustain, 0.035, 0, filter);
}

function instrument(midi, duration, voice) {
  const frequency = hz(midi);
  if (voice === 'bass') return tone(frequency, duration, 1.6, 0.32, -760);
  const wood = voice === 'wood';
  const body = tone(frequency, duration, wood ? 1.25 : 1.7, wood ? 0.25 : 0.38, -1450);
  // Very short struck partial for wood grain, no bell oscillator or ringing cue.
  const partial = ZZFX.buildSamples(1, 0, frequency * (wood ? 2.76 : 2.004),
    0.005, 0.008, Math.min(duration * 0.35, 0.16),
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.16, 0.025, 0, -1900);
  add(body, partial, 0, wood ? 0.14 : 0.065);
  return body;
}

function musicStem() {
  const left = new Float32Array(FRAMES), right = new Float32Array(FRAMES);
  for (const [at, midi, duration, gain, voice, pan] of NOTES) {
    const pcm = instrument(midi, duration, voice);
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    add(left, pcm, at, gain * l); add(right, pcm, at, gain * r);
    if (voice !== 'bass') {
      add(left, pcm, at + 0.083, gain * 0.07 * r);
      add(right, pcm, at + 0.127, gain * 0.07 * l);
    }
  }
  for (let i = 0; i < FRAMES; i++) {
    const t = i / SAMPLE_RATE;
    const hush = t < 14 ? 1 - 0.96 * smooth((t - 13.88) / 0.12)
      : t < 15 ? 0.04 : 0.04 + 0.96 * smooth((t - 15) / 0.12);
    const envelope = smooth(t / 0.08) * smooth((DURATION - t) / 1.10) * hush;
    left[i] *= envelope; right[i] *= envelope;
  }
  return [left, right];
}

function nightWind() {
  const out = new Float32Array(FRAMES);
  // Cascaded one-pole low-pass plus a slow high-pass removes rumble and hiss.
  const slow = 1 - Math.exp(-TAU * 65 / SAMPLE_RATE);
  const low = 1 - Math.exp(-TAU * 340 / SAMPLE_RATE);
  let state = 191, floor = 0, low1 = 0, low2 = 0;
  for (let i = 0; i < FRAMES; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = state / 4294967296 * 2 - 1;
    floor += slow * (noise - floor);
    low1 += low * (noise - floor - low1);
    low2 += low * (low1 - low2);
    const t = i / SAMPLE_RATE;
    const breath = 0.0075 + 0.0025 * Math.sin(TAU * 0.13 * t) ** 2;
    out[i] = low2 * breath * smooth(t / 0.9) * smooth((DURATION - t) / 1.6);
  }
  return [out];
}

export function renderStems() {
  return {music: musicStem(), world: nightWind()};
}
