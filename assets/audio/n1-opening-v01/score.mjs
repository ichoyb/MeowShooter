// N1-M1 review source only. Build with app/tools/audio-vendors.mjs's lazy plugin.
// Importing the official vendor directly in Node would eagerly create a Context.
import {ZZFX} from '../../../app/src/audio/vendor/current/ZzFX.js';

export const SAMPLE_RATE = 44100;
export const DURATION = 18;
const FRAMES = SAMPLE_RATE * DURATION;
const TAU = Math.PI * 2;

export const SPEC = {
  id: 'n1-opening-v01',
  title: '留一盏灯 · N1剧情短配乐',
  authorship: '项目原创乐句、音色参数与拟音合成；未作外部CC0授权',
  reviewStatus: '待用户试听',
  useStatus: 'N1-M1隔离小样；未接正常游戏、未发布',
  sampleRate: SAMPLE_RATE,
  duration: DURATION,
  channels: {music: 2, world: 1, legacy: 1},
  musicGain: 1,
  direction: '温情→异常→守护决心；无人物或机器配音',
  harmony: '参考庭院C/Am/F/G音色语言；新写自由短句，无整曲复刻',
  instruments: ['三角拨弦与低音', '带短非整数泛音的木键', '极轻的钟色和窄幅房间回声'],
  sections: [
    {id: 'warmth', start: 0, end: 4.2, intent: '递鱼温情，留白的木键与拨音'},
    {id: 'anomaly', start: 4.2, end: 9.4, intent: 'Am中的悬音与反应；6.7–7.2秒压低'},
    {id: 'resolve', start: 9.4, end: 14.5, intent: 'F/G到C，步点更稳但保持克制'},
    {id: 'handoff', start: 14.5, end: 18, intent: '回到C与低音支撑，尾部淡出'},
  ],
  lowField: {start: 6.7, end: 7.2, gain: 0.055, ramps: 0.08},
  worldEvents: [
    {id: 'paper', at: 0.15, source: '画内阿婆递鱼的纸包；候选paper同源、0.55倍增益'},
    {id: 'wind', at: 8.9, source: '庭院雾与空院环境；切镜前0.5秒轻入，非动作拟音'},
  ],
  legacyEvents: [
    {id: 'paper', at: 0.15}, {id: 'silence', at: 4.2}, {id: 'wind', at: 9.5},
    {id: 'bell', at: 11.4}, {id: 'handoff', at: 14.6},
  ],
  legacy: {
    source: 'docs/ui/preview/n1-opening-motion-v01/sound.js',
    noiseSeed: 71,
    amplitude: '沿原值：paper0.06、wind0.055、bell0.075/0.018/0.008、handoff0.025/0.02；不归一化',
    approximation: '44.1kHz离线重建默认biquad和gain曲线；原设备采样率及内部计算可能不同，非逐样本同一产物',
  },
  candidates: {
    paper: {label: '纸包', status: '未采用；独立试听', sceneUse: '仅纸包同源衍生版进入本次world', source: '固定种子噪声与短摩擦包络'},
    wood: {label: '木摊', status: '未采用；独立试听', sceneUse: '当前没有明确敲击动作', source: 'ZzFX短木质模态'},
    steps: {label: '脚步', status: '未采用；独立试听', sceneUse: '当前桥段没有完整落脚动作', source: 'ZzFX低频落脚与固定噪声，两个步点'},
    cloth: {label: '布料', status: '未采用；独立试听', sceneUse: '当前没有明确布料动作', source: '固定种子带限摩擦'},
    door: {label: '收门', status: '未采用；独立试听', sceneUse: '静态门框没有收门动作', source: 'ZzFX低木轴与闷合声'},
    bell: {label: '摇铃', status: '未采用；独立试听', strikes: 1, sceneUse: '没有画内摇铃动作；不做双铃应答', source: '单次ZzFX基音与同步非整数泛音'},
  },
  synthesis: {
    vendor: 'app/src/audio/vendor/current/ZzFX.js；版本与SHA以现有锁定vendor/构建账为准',
    api: '只调用ZZFX.buildSamples；不播放、不创建Context、不修改vendor或全局Math.random',
    randomness: 0,
    randomnessCaveat: 'ZzFX即使randomness=0仍调用Math.random；本源重复PCM已测稳定，不声称全局随机流不被消费',
    noise: '本源局部LCG；不借用玩法随机源',
    output: 'Float32 PCM；无压限/削波或自动响度归一化；新两模式共用同一配乐增益',
  },
};

// [秒, MIDI, 尾音秒, 力度, 音色, 声像]。所有短句在此独立手写，未读取庭院整曲。
const NOTES = [
  [0.08, 48, 1.15, 0.16, 'bass', 0],
  [0.12, 60, 0.64, 0.085, 'wood', -0.24],
  [0.38, 64, 0.68, 0.165, 'pluck', -0.10],
  [0.78, 67, 0.52, 0.085, 'wood', 0.22],
  [1.16, 67, 0.76, 0.155, 'pluck', -0.08],
  [1.62, 64, 0.58, 0.065, 'wood', -0.20],
  [2.06, 45, 1.32, 0.15, 'bass', 0],
  [2.10, 60, 0.74, 0.075, 'wood', 0.18],
  [2.18, 69, 0.83, 0.145, 'pluck', -0.08],
  [2.72, 64, 0.58, 0.065, 'wood', -0.18],
  [3.02, 67, 0.75, 0.135, 'pluck', -0.06],
  [3.38, 64, 0.56, 0.07, 'wood', 0.18],
  [3.53, 76, 0.63, 0.018, 'tint', 0.16],
  [3.68, 64, 0.62, 0.105, 'pluck', -0.06],

  [4.24, 45, 1.44, 0.12, 'bass', 0],
  [4.31, 57, 0.95, 0.072, 'wood', -0.22],
  [4.55, 64, 0.92, 0.12, 'pluck', -0.08],
  [4.98, 69, 0.83, 0.065, 'wood', 0.19],
  [5.30, 71, 0.98, 0.105, 'pluck', 0.08],
  [5.62, 60, 0.86, 0.06, 'wood', -0.19],
  [5.91, 70, 0.73, 0.082, 'pluck', -0.07],
  [6.20, 64, 0.48, 0.045, 'wood', 0.17],
  // 6.7–7.2留给角色反应，包络继续下行，没有新敲击。
  [7.27, 41, 1.48, 0.11, 'bass', 0],
  [7.34, 60, 0.92, 0.07, 'wood', -0.20],
  [7.67, 65, 1.02, 0.115, 'pluck', -0.07],
  [8.21, 64, 0.85, 0.10, 'pluck', 0.06],
  [8.52, 67, 0.68, 0.052, 'wood', 0.18],
  [8.90, 62, 0.74, 0.082, 'pluck', -0.05],

  [9.44, 41, 1.45, 0.17, 'bass', 0],
  [9.49, 53, 0.73, 0.09, 'wood', -0.21],
  [9.64, 60, 0.74, 0.165, 'pluck', -0.09],
  [10.08, 60, 0.68, 0.072, 'wood', 0.20],
  [10.35, 64, 0.76, 0.15, 'pluck', -0.08],
  [10.80, 65, 0.70, 0.14, 'pluck', -0.06],
  [11.08, 57, 0.68, 0.075, 'wood', 0.18],
  [11.34, 43, 1.28, 0.17, 'bass', 0],
  [11.48, 67, 0.78, 0.15, 'pluck', -0.09],
  [11.72, 59, 0.68, 0.075, 'wood', -0.19],
  [12.08, 69, 0.73, 0.145, 'pluck', -0.05],
  [12.43, 62, 0.64, 0.065, 'wood', 0.19],
  [12.68, 67, 0.74, 0.14, 'pluck', -0.08],
  [13.00, 48, 1.45, 0.17, 'bass', 0],
  [13.13, 60, 0.72, 0.08, 'wood', -0.19],
  [13.36, 64, 0.92, 0.15, 'pluck', -0.07],
  [13.72, 67, 0.68, 0.07, 'wood', 0.18],
  [14.02, 72, 0.91, 0.12, 'pluck', -0.04],

  [14.58, 48, 1.80, 0.15, 'bass', 0],
  [14.68, 60, 0.95, 0.085, 'wood', -0.20],
  [14.86, 67, 0.96, 0.125, 'pluck', -0.08],
  [15.28, 64, 0.92, 0.075, 'wood', 0.18],
  [15.50, 64, 1.12, 0.115, 'pluck', -0.05],
  [15.96, 55, 1.35, 0.10, 'bass', 0],
  [16.08, 60, 1.45, 0.115, 'pluck', -0.04],
  [16.12, 64, 1.34, 0.058, 'wood', -0.18],
  [16.18, 67, 1.28, 0.052, 'wood', 0.18],
  [16.22, 72, 1.05, 0.015, 'tint', 0.13],
];

const frame = seconds => Math.round(seconds * SAMPLE_RATE);
const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function add(target, pcm, at, gain = 1) {
  const offset = frame(at);
  for (let i = 0; i < pcm.length && i + offset < target.length; i++) target[i + offset] += pcm[i] * gain;
}

function zz(frequencyHz, duration, shape, curve, sustainVolume, filter) {
  // randomness=0仍会由vendor调用Math.random；不覆盖它。
  return ZZFX.buildSamples(1, 0, frequencyHz, 0.005, 0.012, duration,
    shape, curve, 0, 0, 0, 0, 0, 0, 0, 0, 0, sustainVolume, 0.045, 0, filter);
}

function instrument(midi, duration, voice) {
  const hz = frequency(midi);
  if (voice === 'bass') return zz(hz, duration, 1, 1.6, 0.34, -800);
  const wood = voice === 'wood', tint = voice === 'tint';
  const body = zz(hz, duration, tint ? 0 : 1, wood ? 1.25 : 1.7, wood ? 0.25 : 0.38, -1500);
  // A struck partial decays quickly; no long high-pitched oscillator layer.
  const partial = zz(hz * (wood ? 2.76 : 2.004), Math.min(duration * 0.4, 0.19), 0, 1, 0.18, -2100);
  add(body, partial, 0, wood ? 0.16 : tint ? 0.21 : 0.075);
  return body;
}

function musicStem() {
  const left = new Float32Array(FRAMES), right = new Float32Array(FRAMES);
  for (const [at, midi, duration, gain, voice, pan] of NOTES) {
    const pcm = instrument(midi, duration, voice);
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    add(left, pcm, at, gain * l); add(right, pcm, at, gain * r);
    if (voice !== 'bass') {
      add(left, pcm, at + 0.071, gain * 0.075 * r);
      add(right, pcm, at + 0.113, gain * 0.075 * l);
    }
  }
  for (let i = 0; i < FRAMES; i++) {
    const t = i / SAMPLE_RATE;
    const reaction = t < 6.7 ? 1 - 0.945 * smooth((t - 6.62) / 0.08)
      : t < 7.2 ? 0.055 : 0.055 + 0.945 * smooth((t - 7.2) / 0.08);
    const fade = smooth(t / 0.045) * smooth((DURATION - t) / 0.55) * reaction;
    left[i] *= fade; right[i] *= fade;
  }
  return [left, right];
}

function noise(duration, seed) {
  const pcm = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  let state = seed >>> 0;
  for (let i = 0; i < pcm.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    pcm[i] = state / 4294967296 * 2 - 1;
  }
  return pcm;
}

// Offline RBJ biquad. New textures use Butterworth Q; legacy passes WebAudio's 1dB Q.
function filter(pcm, cutoff, highpass = false, q = Math.SQRT1_2) {
  const w = TAU * cutoff / SAMPLE_RATE, c = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha, a1 = -2 * c / a0, a2 = (1 - alpha) / a0;
  const b0 = (highpass ? 1 + c : 1 - c) / (2 * a0);
  const b1 = (highpass ? -(1 + c) : 1 - c) / a0, b2 = b0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}

function paperCandidate() {
  const pcm = filter(filter(noise(0.5, 31), 330, true), 2300);
  for (let i = 0; i < pcm.length; i++) {
    const t = i / SAMPLE_RATE;
    const folds = 0.58 * Math.exp(-(((t - 0.055) / 0.026) ** 2))
      + 0.85 * Math.exp(-(((t - 0.18) / 0.05) ** 2))
      + 0.48 * Math.exp(-(((t - 0.34) / 0.044) ** 2));
    pcm[i] *= 0.21 * folds * smooth(t / 0.012) * smooth((0.5 - t) / 0.06);
  }
  return pcm;
}

function candidates() {
  const wood = new Float32Array(frame(0.43));
  add(wood, zz(178, 0.21, 1, 1.8, 0.18, -1000), 0, 0.20);
  add(wood, zz(487, 0.10, 0, 1.2, 0.12, -1600), 0, 0.055);
  const steps = new Float32Array(frame(0.68));
  for (const [at, hz, gain] of [[0.02, 97, 0.21], [0.32, 113, 0.18]]) {
    add(steps, zz(hz, 0.16, 1, 2, 0.2, -600), at, gain);
    const grit = filter(noise(0.14, 83), 680);
    for (let i = 0; i < grit.length; i++) grit[i] *= Math.sin(Math.PI * i / grit.length) ** 2;
    add(steps, grit, at, 0.10);
  }
  const cloth = filter(filter(noise(0.53, 47), 300, true), 1500);
  for (let i = 0; i < cloth.length; i++) cloth[i] *= 0.18 * Math.sin(Math.PI * i / cloth.length) ** 2
    * (0.64 + 0.36 * Math.cos(TAU * i / SAMPLE_RATE * 5));
  const door = new Float32Array(frame(0.78));
  add(door, zz(153, 0.31, 1, 1.8, 0.25, -700), 0.02, 0.085);
  add(door, zz(79, 0.23, 1, 2, 0.2, -650), 0.36, 0.21);
  add(door, zz(231, 0.12, 0, 1, 0.18, -900), 0.36, 0.038);
  const bell = new Float32Array(frame(1.28));
  for (const [hz, duration, gain] of [[784, 1.12, 0.15], [1656, 0.58, 0.033], [2177, 0.24, 0.012]]) {
    add(bell, zz(hz, duration, 0, 1, 0.40, -2200), 0.015, gain);
  }
  return {paper: [paperCandidate()], wood: [wood], steps: [steps], cloth: [cloth], door: [door], bell: [bell]};
}

function worldStem(paper) {
  const out = new Float32Array(FRAMES);
  add(out, paper, 0.15, 0.55);
  const wind = filter(filter(noise(9.1, 107), 75, true), 420);
  for (let i = 0; i < wind.length; i++) {
    const t = i / SAMPLE_RATE;
    wind[i] *= (0.027 + 0.012 * Math.sin(TAU * t * 0.19) ** 2)
      * smooth(t / 0.8) * smooth((9.1 - t) / 0.9);
  }
  add(out, wind, 8.9);
  return [out];
}

function legacyStem() {
  const out = new Float32Array(FRAMES);
  for (const [at, duration, gain, highpass] of [[0.15, 0.55, 0.06, true], [9.5, 1.9, 0.055, false]]) {
    const raw = noise(duration, 71);
    for (let i = 0; i < raw.length; i++) raw[i] *= Math.sin(Math.PI * i / raw.length);
    add(out, filter(raw, highpass ? 900 : 500, highpass, 10 ** (1 / 20)), at, gain);
  }
  // v01 silence@4.2 stops all active sources; the paper has already ended.
  for (const [at, hz, duration, volume] of [[11.4, 784, 0.65, 0.075], [11.4, 1568, 0.3, 0.018],
    [11.4, 2337, 0.16, 0.008], [14.6, 392, 0.45, 0.025], [14.7, 587, 0.5, 0.02]]) {
    const pcm = new Float32Array(frame(duration + 0.02));
    for (let i = 0; i < pcm.length; i++) {
      const t = i / SAMPLE_RATE;
      const gain = t < 0.009 ? volume * t / 0.009
        : t < duration ? volume * (0.0001 / volume) ** ((t - 0.009) / (duration - 0.009)) : 0.0001;
      pcm[i] = Math.sin(TAU * hz * t) * gain;
    }
    add(out, pcm, at);
  }
  return [out];
}

export function renderStems() {
  const short = candidates();
  return {music: musicStem(), world: worldStem(short.paper[0]), legacy: legacyStem(), candidates: short};
}
