import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE);
const root=path.resolve('..'),out=path.resolve('assets/battle-feedback');
const sha=x=>createHash('sha256').update(x).digest('hex');
const inputs=[
  ['bell-hit.png','assets/art/animation-pilot/bell-hit-v1/clean.png','7b3f3dcb66b96aaa107586ae0fd6d03e680a8fb9b4626bd069941b2805e772ae'],
  ['ground.png','assets/art/battle-feedback/ground-tile.svg','8134deb730cbd7a6f1aec108d258c60a4fade2e6fc8beff69b1f1324adb1bba0']
];
mkdirSync(out,{recursive:true});const records=[];
for(const [name,source,expected] of inputs){
  const bytes=readFileSync(path.join(root,source));if(sha(bytes)!==expected)throw Error('F1 source changed: '+source);
  const png=await sharp(bytes).resize(64,64,{kernel:'lanczos3'}).ensureAlpha().png({compressionLevel:9}).toBuffer();
  writeFileSync(path.join(out,name),png);records.push({file:'assets/battle-feedback/'+name,source,sourceSha256:expected,sha256:sha(png),bytes:png.length,width:64,height:64,rgbaBytes:16384});
}
const file=path.resolve('ASSET_SOURCES.json'),previous=readFileSync(file,'utf8'),sources=JSON.parse(previous);
sources.f1Pilot={scope:'F1-1 CAT01 hit/scenery preview only; chill deferred to F1-2',tool:'tools/export-battle-feedback.mjs',toolSha256:sha(readFileSync('tools/export-battle-feedback.mjs')),versions:{node:process.version,sharp:sharp.versions.sharp,vips:sharp.versions.vips},parameters:{size:64,resampler:'lanczos3',pngCompression:9},files:records,totalNewRGBA:32768};
writeFileSync(file,(JSON.stringify(sources,null,2)+'\n').replace(/\n/g,previous.includes('\r\n')?'\r\n':'\n'));console.log(JSON.stringify(sources.f1Pilot));
