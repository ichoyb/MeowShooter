import { ZZFX } from './vendor/current/ZzFX.js';
import { zzfxM, zzfxR } from './vendor/music/zzfxm.js';
import score from './courtyard-score.json';
import bossScore from './boss-score.json';
import { SOUND_SPECS } from './sound-data.mjs';
export { SOUND_SPECS };
export const COURTYARD_SCORE = score;
export function createSampleBank() {
 const shorts = new Map(); let music = null, musicRenders = 0, bossLoop = null, bossEntry = null, bossLoopRenders = 0, bossEntryRenders = 0;
 return {
  short(id) {
   const spec = SOUND_SPECS.find(sound => sound.id === id);
   if (!spec) throw Error('未知运行声音：' + id);
   if (!shorts.has(id)) shorts.set(id, [ZZFX.buildSamples(...spec.parameters)]);
   return shorts.get(id);
  },
  music() {
   if (!music) {
    if (zzfxR !== 44100) throw Error('配套音乐采样率不一致');
    music = zzfxM(score.instruments, score.patterns, score.sequence, score.BPM).map(channel => new Float32Array(channel)); musicRenders++;
   }
   return music;
  },
  bossLoop() {
   if (!bossLoop) {
    if (zzfxR !== 44100) throw Error('配套音乐采样率不一致');
    bossLoop = zzfxM(bossScore.instruments, bossScore.patterns, bossScore.sequence, bossScore.BPM).map(channel => new Float32Array(channel)); bossLoopRenders++;
   }
   return bossLoop;
  },
  bossEntry() {
   if (!bossEntry) {
    const parts = bossScore.entrance.events.map(event => ({...event, samples:ZZFX.buildSamples(...event.parameters)}));
    const length = Math.max(...parts.map(part => Math.round(part.at * zzfxR) + part.samples.length));
    bossEntry = [new Float32Array(length),new Float32Array(length)];
    for (const part of parts) {const at = Math.round(part.at * zzfxR);for (let i = 0;i < part.samples.length;i++) {bossEntry[0][at+i] += part.samples[i]*(1-part.pan)/2;bossEntry[1][at+i] += part.samples[i]*(1+part.pan)/2;}}
    bossEntryRenders++;
   }
   return bossEntry;
  },
  info() {
   const shortPcmBytes = Array.from(shorts.values()).reduce((n, channels) => n + channels[0].byteLength, 0);
   const musicPcmBytes = music ? music.reduce((n, channel) => n + channel.byteLength, 0) : 0;
   const bossLoopPcmBytes = bossLoop ? bossLoop.reduce((n,channel) => n + channel.byteLength,0) : 0;
   const bossEntryPcmBytes = bossEntry ? bossEntry.reduce((n,channel) => n + channel.byteLength,0) : 0;
   const bossPcmBytes = bossLoopPcmBytes + bossEntryPcmBytes;
   return { shortPcmBytes, musicPcmBytes, bossLoopPcmBytes, bossEntryPcmBytes, bossPcmBytes, persistentPcmBytes: shortPcmBytes + musicPcmBytes + bossPcmBytes, musicRenders, bossLoopRenders, bossEntryRenders,
    bossLoopDuration: bossLoop ? bossLoop[0].length / zzfxR : 0, bossEntryDuration: bossEntry ? bossEntry[0].length / zzfxR : 0,
    musicDuration: music ? music[0].length / zzfxR : 0, pcmProcessing: 'none: native ZzFXM output converted to Float32 only' };
  }
 };
}
