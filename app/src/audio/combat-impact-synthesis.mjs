import {ZZFX} from './vendor/current/ZzFX.js';
import {ADOPTED_IMPACT_SOUND_SPECS} from './combat-impact-data.mjs';

// Each fixed layer is temporary. Keep only one final mono pre-mix per identity.
export function createAdoptedImpactBank(){
 const cache=new Map(),measurements=new Map();
 let renderCount=0,synthesisMs=0,maxColdRenderScratchPcmBytes=0,maxColdRenderPeakPcmBytes=0;
 const cachedBytes=()=>[...cache.values()].reduce((bytes,channels)=>bytes+channels[0].byteLength,0);
 return {
  render(id){
   const spec=ADOPTED_IMPACT_SOUND_SPECS.find(sound=>sound.id===id);if(!spec)throw Error('未知已采用打击音色：'+id);
   if(cache.has(id))return cache.get(id);if(ZZFX.sampleRate!==44100)throw Error('打击音色采样率与固定生成器不一致');
   const start=performance.now(),layers=spec.layers.map(layer=>({...layer,samples:ZZFX.buildSamples(...layer.parameters)}));
   const pcm=new Float32Array(Math.round(spec.durationSeconds*44100));
   for(const layer of layers){const offset=Math.round(layer.atSeconds*44100);for(let index=0;index<layer.samples.length&&offset+index<pcm.length;index++)pcm[offset+index]+=layer.samples[index]*layer.gain;}
   const fadeFrames=Math.round(.008*44100);let peak=0,squares=0;
   for(let index=0;index<pcm.length;index++){pcm[index]*=spec.mixGain*Math.min(1,(pcm.length-1-index)/fadeFrames);peak=Math.max(peak,Math.abs(pcm[index]));squares+=pcm[index]**2;}
   const scratchBytes=layers.reduce((bytes,layer)=>bytes+layer.samples.byteLength,0);
   maxColdRenderScratchPcmBytes=Math.max(maxColdRenderScratchPcmBytes,scratchBytes);
   maxColdRenderPeakPcmBytes=Math.max(maxColdRenderPeakPcmBytes,cachedBytes()+pcm.byteLength+scratchBytes);
   measurements.set(id,{id,label:spec.label,frames:pcm.length,durationSeconds:pcm.length/44100,pcmBytes:pcm.byteLength,peak,rms:Math.sqrt(squares/pcm.length)});
   const channels=[pcm];cache.set(id,channels);renderCount++;synthesisMs+=performance.now()-start;return channels;
  },
  info(){const pcmBytes=cachedBytes();return {sampleRate:44100,channels:1,cachedSounds:cache.size,renderCount,pcmBytes,retainedSourcePcmBytes:0,pcmPlusAudioBufferBytes:pcmBytes*2,maxColdRenderScratchPcmBytes,maxColdRenderPeakPcmBytes,synthesisMs,sounds:[...measurements.values()].map(sound=>({...sound}))};}
 };
}
