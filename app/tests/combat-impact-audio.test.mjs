import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';

const sourceURL = new URL('../../assets/audio/combat-impact-v01/sounds.mjs', import.meta.url);
const IDS = ['critical-bell', 'critical-fish', 'critical-bone', 'hurt', 'shield-break'];
const hash = channels => createHash('sha256').update(Buffer.from(channels[0].buffer)).digest('hex');

async function loadBank(seed = 1) {
 assert.ok(existsSync(sourceURL), 'missing isolated combat-impact-v01 candidate bank');
 const vendors = await loadRuntimeVendors();
 const result = await build({entryPoints:[fileURLToPath(sourceURL)], bundle:true, write:false, format:'iife', globalName:'Candidate', plugins:[vendors.plugin]});
 let randomCalls = 0;
 const localMath = Object.create(Math);
 localMath.random = () => {randomCalls++; seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296;};
 const scope = {window:{}, performance, Math:localMath, AudioContext(){throw Error('PCM synthesis must not create an AudioContext');}};
 runInNewContext(result.outputFiles[0].text, scope);
 return {...scope.Candidate, randomCalls:() => randomCalls};
}

function stats(pcm) {
 let peak = 0, squares = 0;
 for (const value of pcm) {assert.ok(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); squares += value * value;}
 return {peak, rms:Math.sqrt(squares / pcm.length)};
}

// An independent 4 kHz high-pass energy check catches sharp/noisy regressions.
// This is an engineering bound, not a listener's judgement of material or comfort.
function highBandRatio(pcm, rate) {
 const w = 2 * Math.PI * 4000 / rate, c = Math.cos(w), a = Math.sin(w) / Math.SQRT2;
 const b0 = (1 + c) / 2 / (1 + a), b1 = -(1 + c) / (1 + a), b2 = b0;
 const a1 = -2 * c / (1 + a), a2 = (1 - a) / (1 + a);
 let x1 = 0, x2 = 0, y1 = 0, y2 = 0, high = 0, total = 0;
 for (const x of pcm) {const y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2; x2=x1; x1=x; y2=y1; y1=y; high+=y*y; total+=x*x;}
 return high / total;
}

test('isolated candidate bank exports the five fixed identities and traceable source parameters', async () => {
 const api = await loadBank();
 assert.deepEqual(Array.from(api.IMPACT_SOUND_SPECS, s => s.id), IDS);
 assert.equal(api.IMPACT_AUDIO_FORMAT.sampleRate, 44100);
 assert.equal(api.IMPACT_AUDIO_FORMAT.channels, 1);
 assert.equal(api.IMPACT_AUDIO_FORMAT.pcmByteBudget, 512 * 1024);
 assert.equal(api.IMPACT_AUDIO_SOURCE.status, 'candidate-not-adopted');
 assert.match(api.IMPACT_AUDIO_SOURCE.generator, /ZzFX 1\.4/);
 for (const spec of api.IMPACT_SOUND_SPECS) {
  assert.ok(spec.label && spec.direction && spec.layers.length);
  assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.layers));
  for (const layer of spec.layers) {
   assert.equal(layer.parameters.length, 21);
   assert.equal(layer.parameters[1], 0, 'pitch randomness is disabled');
   assert.ok(layer.parameters.every(Number.isFinite));
   if (!layer.sourceId) assert.equal(layer.parameters[13], 0, 'new layers do not add phase noise');
  }
 }
 assert.ok(api.IMPACT_SOUND_SPECS.find(s => s.id === 'hurt').layers.some(l => l.sourceId === 'hurt'));
 assert.ok(api.IMPACT_SOUND_SPECS.find(s => s.id === 'shield-break').layers.some(l => l.sourceId === 'shield-break'));
});

test('real synthesis returns one bounded mono PCM per candidate with separate identities and short quiet tails', async () => {
 const {createImpactAudioBank, IMPACT_AUDIO_FORMAT} = await loadBank(), bank = createImpactAudioBank();
 const hashes = [], maxHigh = {'critical-bell':.12, 'critical-fish':.3, 'critical-bone':.1, hurt:.06, 'shield-break':.1};
 for (const id of IDS) {
  const channels = bank.render(id), pcm = channels[0], s = stats(pcm);
  assert.equal(channels.length, 1, id + ': pre-mixed mono, one native request');
  assert.equal(Object.prototype.toString.call(pcm), '[object Float32Array]');
  assert.ok(pcm.length / 44100 >= .07 && pcm.length / 44100 <= .25, id + ': short sound');
  assert.ok(s.peak > .05 && s.peak < .75, id + ': headroom');
  assert.ok(s.rms > .012 && s.rms < .25, id + ': finite useful signal');
  assert.ok(Math.abs(pcm[0]) < .001 && Math.abs(pcm.at(-1)) < .001, id + ': smooth ends');
  const window = Math.round(IMPACT_AUDIO_FORMAT.sampleRate * .01);
  let loudest = 0;
  for (let at = 0; at + window <= pcm.length; at += window) loudest = Math.max(loudest, stats(pcm.subarray(at, at + window)).rms);
  assert.ok(stats(pcm.subarray(pcm.length - window)).rms < loudest * .25, id + ': restrained tail');
  assert.ok(highBandRatio(pcm, 44100) < maxHigh[id], id + ': bounded 4 kHz high-band energy');
  hashes.push(hash(channels));
 }
 assert.equal(new Set(hashes).size, IDS.length);
 const info = bank.info();
 assert.ok(info.pcmBytes <= IMPACT_AUDIO_FORMAT.pcmByteBudget);
 assert.ok(info.maxColdRenderPeakPcmBytes <= IMPACT_AUDIO_FORMAT.pcmByteBudget);
});

test('cold synthesis is seed-independent and cached rendering does not synthesize or consume more random values', async () => {
 const a = await loadBank(1), b = await loadBank(4294967295), bank = a.createImpactAudioBank(), other = b.createImpactAudioBank();
 assert.equal(a.randomCalls(), 0);
 assert.equal(bank.info().cachedSounds, 0);
 const cached = IDS.map(id => bank.render(id));
 const coldCalls = a.randomCalls();
 assert.ok(coldCalls > 0, 'pinned ZzFX still calls Math.random even when pitch randomness is zero');
 for (let i = 0; i < IDS.length; i++) {
  assert.equal(hash(cached[i]), hash(other.render(IDS[i])), IDS[i] + ': independent of random values');
  for (let repeat = 0; repeat < 50; repeat++) assert.equal(bank.render(IDS[i]), cached[i]);
 }
 assert.equal(a.randomCalls(), coldCalls);
 assert.equal(bank.info().renderCount, 5);
 assert.equal(bank.info().cachedSounds, 5);
 assert.throws(() => bank.render('critical'), /未知/);
 assert.throws(() => bank.render('music'), /未知/);
 assert.equal(bank.info().cachedSounds, 5);
});

test('candidate info reports the actual cached PCM sizes, duration, peak and rms without mutable bookkeeping', async () => {
 const {createImpactAudioBank} = await loadBank(), bank = createImpactAudioBank();
 let bytes = 0;
 for (const id of IDS) {
  const pcm = bank.render(id)[0], s = stats(pcm), entry = bank.info().sounds.find(sound => sound.id === id);
  assert.equal(entry.frames, pcm.length);
  assert.equal(entry.pcmBytes, pcm.byteLength);
  assert.equal(entry.durationSeconds, pcm.length / 44100);
  assert.equal(entry.peak, s.peak);
  assert.equal(entry.rms, s.rms);
  bytes += pcm.byteLength;
 }
 const info = bank.info();
 assert.equal(info.pcmBytes, bytes);
 assert.equal(info.retainedSourcePcmBytes, 0);
 assert.ok(info.maxColdRenderScratchPcmBytes > 0);
 assert.equal(info.pcmPlusAudioBufferBytes, bytes * 2);
 assert.ok(info.pcmPlusAudioBufferBytes <= 512 * 1024);
 info.sounds[0].peak = 999;
 assert.notEqual(bank.info().sounds[0].peak, 999);
});
