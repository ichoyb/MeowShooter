// Only build-time lazy substitutions. Never modify the official source files.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../src/audio/vendor/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function loadRuntimeVendors(){
 const names=['current/ZzFX.js','music/zzfx.js','music/zzfxm.js','LICENSE-ZzFX','LICENSE-ZzFXM'];
 const expected=['43f321101a935892c112a291e2e943b4da33159b43fcd4a21f3eae710f4a27ff','69346179040f5c7308bea42e5dae42d61d49d1f48a1ac37bd11df34c9c404fba','540904cd2574af403896bfa6fd552a7431461979e2002d44d16d21a34ea73115'];
 const raw=await Promise.all(names.map(name=>readFile(new URL(name,base))));
 expected.forEach((hash,i)=>{if(sha(raw[i])!==hash)throw Error('Runtime vendor SHA mismatch: '+names[i]);});
 if(sha(raw[3])!=='3cc22a9ed0b1dd02189c1b6f4edb14847623f043589cc78b24ab839ef09b6e36')throw Error('ZzFX MIT SHA mismatch');
 if(sha(raw[4])!=='ce94b9d9ec1f26f2badf6269f6fd5833ab336cf4c3c0ab7743eb2a43122510e4')throw Error('Music MIT SHA mismatch');
 const replace=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Expected exactly one eager context initialization');return text.replace(from,to);};
 const current=replace(raw[0].toString(),'audioContext: new AudioContext,','audioContext: null,');
 const paired=replace(raw[1].toString(),'zzfxX=new(window.AudioContext||webkitAudioContext);','zzfxX=null;');
 const music='let zzfx,zzfxP,zzfxG,zzfxV,zzfxR,zzfxX,zzfxM;\n'+paired+'\n'+raw[2]+'\nexport {zzfxG,zzfxM,zzfxR};\n';
 return {licenses:raw.slice(3).map(b=>b.toString()),sources:expected.map((hash,i)=>({file:names[i],originalSha256:hash})),derived:{current:sha(current),music:sha(music)},plugin:{name:'f1-pinned-lazy-audio',setup(api){api.onLoad({filter:/[\\/]src[\\/]audio[\\/]vendor[\\/]current[\\/]ZzFX\.js$/},()=>({contents:current,loader:'js'}));api.onLoad({filter:/[\\/]src[\\/]audio[\\/]vendor[\\/]music[\\/]zzfxm\.js$/},()=>({contents:music,loader:'js'}));}}};
}
