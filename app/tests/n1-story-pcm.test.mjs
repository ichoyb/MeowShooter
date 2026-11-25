import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {loadRuntimeVendors} from '../tools/audio-vendors.mjs';
const hash=channels=>{const h=createHash('sha256');for(const c of channels)h.update(Buffer.from(c.buffer,c.byteOffset,c.byteLength));return h.digest('hex');};
const APPROVED={opening:{music:'32d776918056e6828d3f998bb72c83e50fc4c42b05bd94d022329f7fac4ac27f',world:'b9f538a2d70594e089f27d5604773634afd58e0751d752fb24bc06339ab334d1'},ending:{music:'28cf54125ddebd90611274c74a6e5457db43624a6c6f2c821f4920b489615a9a',world:'12e733a68fa1c70fe0b737ae27c6558e53ea2649dfeb1546fb24b528e15ae74e'}};
async function exported(entry){const vendors=await loadRuntimeVendors(),out=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'Chapter',plugins:[vendors.plugin]});const scope={performance};runInNewContext(out.outputFiles[0].text,scope);return scope.Chapter;}
test('正常chapter仅返回原认可music stereo/world mono，惰性vendor无Context；原PCM不乘增益',async()=>{
 const runtime=await exported('src/audio/chapter-synthesis.mjs');
 for(const kind of ['opening','ending']){
  const original=await exported('../assets/audio/n1-'+kind+'-v01/score.mjs'),expected=original.renderStems(),actual=runtime.renderChapterStems(kind),duration=kind==='opening'?18:24;
  assert.deepEqual(Object.keys(actual),['music','world']);assert.equal(actual.music.length,2);assert.equal(actual.world.length,1);
  for(const id of ['music','world']){assert.equal(actual[id][0].length,duration*44100);assert.equal(hash(actual[id]),hash(expected[id]));assert.equal(hash(actual[id]),APPROVED[kind][id]);}
  let peak=0;for(let i=0;i<actual.music[0].length;i++)for(const channel of actual.music)peak=Math.max(peak,Math.abs((channel[i]+actual.world[0][i])*2.4));assert.ok(peak<1,kind+' maximum 2.4 effective mix must not clip');console.log(JSON.stringify({kind,maxMixPeak:peak,audioBufferBytes:duration*44100*3*4}));
 }
});
