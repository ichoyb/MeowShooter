// Independent art fixture. Does not modify or package the normal game.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const root=path.resolve('..'), source=path.join(root,'assets/art/low-poly-v1/environment/material-pilot-v01');
const out=path.join(root,'.local/checks/terrain-material-pilot-20261031/preview');
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const inputs={grass:'grass-source-v02.png',sand:'sand-source-v01.png',props:'props-source-v01.png'};
const originals=Object.entries(inputs).map(([name,file])=>({name,data:'data:image/png;base64,'+fs.readFileSync(path.join(source,file)).toString('base64')}));
const browser=await chromium.launch({channel:'chrome',headless:true});
let exported;
try{
 const page=await browser.newPage();
 exported=await page.evaluate(async inputs=>{
  const images=await Promise.all(inputs.map(input=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=input.data;})));
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const terrain=canvas(512,256),ctx=terrain.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  images.slice(0,2).forEach((image,i)=>{
   const x=i*256;ctx.drawImage(image,x+2,2,252,252);
   // Technical atlas extrusion: repeat edge samples into a2px guard, no new art.
   ctx.drawImage(terrain,x+2,2,1,252,x,2,2,252);ctx.drawImage(terrain,x+253,2,1,252,x+254,2,2,252);
   ctx.drawImage(terrain,x,2,256,1,x,0,256,2);ctx.drawImage(terrain,x,253,256,1,x,254,256,2);
  });
  const props=canvas(512,512),pc=props.getContext('2d');pc.imageSmoothingEnabled=true;pc.imageSmoothingQuality='high';pc.drawImage(images[2],0,0,512,512);
  const pixels=pc.getImageData(0,0,512,512).data;let transparent=0,partial=0,opaque=0;const histogram=Array(256).fill(0);
  for(let i=3;i<pixels.length;i+=4){histogram[pixels[i]]++;if(pixels[i]===0)transparent++;else if(pixels[i]===255)opaque++;else partial++;}
  return {files:[{name:'terrain-v01.png',width:512,height:256,data:terrain.toDataURL()},{name:'props-v01.png',width:512,height:512,data:props.toDataURL()}],originals:images.map((image,i)=>({name:inputs[i].name,width:image.naturalWidth,height:image.naturalHeight})),alpha:{transparent,partial,opaque,histogram}};
 },originals);
}finally{await browser.close();}
const files=exported.files.map(file=>{const data=Buffer.from(file.data.split(',')[1],'base64');fs.writeFileSync(path.join(source,file.name),data);fs.writeFileSync(path.join(out,'assets',file.name),data);return {name:file.name,width:file.width,height:file.height,rgba:file.width*file.height*4,bytes:data.length,sha256:sha(data)};});
const oldAssets=['orange-body.png','orange-parts.png','map/map-0-0.png','map/map-0-1.png','map/map-overscan.png','courtyard-detail-v01.png'];
for(const file of oldAssets){const dest=path.join(out,'assets/old',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join('assets/r1-restoration',file),dest);}
const metadata={date:'2026-10-31',status:'LOCAL_SAMPLE_AWAITING_VISUAL_REVIEW',tool:'Codex built-in image_gen',requests:4,model:'NOT_RETURNED',seed:'NOT_RETURNED',originals:exported.originals.map(file=>({...file,sha256:sha(fs.readFileSync(path.join(source,inputs[file.name])))})),files,alpha:exported.alpha,export:{processor:'Chrome Canvas drawImage high smoothing; one uniform downsample per source; no alpha repaint or sharpness filter',terrainPacking:'grass at0,0; sand at256,0; each256 square,252 content and2px extruded guard',nativeTiling:'Phaser native TileSprite with504x504 mirrored CanvasTexture pattern; viewport raster uses final physical render pixels; cache separately inventoried',tileWorldUnits:96,sourcePixelsAcross360u:945},budget:{backgroundSource:files.reduce((n,f)=>n+f.rgba,0),nonBackgroundSource:3020800,reserve:131072,cap:5242880},scope:'Replacement budget only. Comparison old textures, stage, browser caches and audio are not included; no production integration.'};
metadata.budget.projectedTotal=metadata.budget.backgroundSource+metadata.budget.nonBackgroundSource;
metadata.budget.remainingAfterReserve=metadata.budget.cap-metadata.budget.projectedTotal-metadata.budget.reserve;
if(metadata.budget.backgroundSource>1835008||metadata.budget.remainingAfterReserve<0||!exported.alpha.transparent)throw Error('Asset budget/alpha gate');
fs.writeFileSync(path.join(source,'provenance.json'),JSON.stringify(metadata,null,2)+'\n');
await build({entryPoints:['tests/fixtures/terrain-material-sample.ts'],bundle:true,minify:true,format:'iife',platform:'browser',target:['es2017','chrome61'],outfile:path.join(out,'sample.js'),define:{CANVAS_RENDERER:'true',WEBGL_RENDERER:'false',WEBGL_DEBUG:'false',EXPERIMENTAL:'false',PLUGIN_FBINSTANT:'false',FEATURE_SOUND:'false'}});
fs.copyFileSync('tests/fixtures/terrain-material-sample.html',path.join(out,'index.html'));
fs.writeFileSync(path.join(out,'budget.json'),JSON.stringify(metadata,null,2));
console.log(JSON.stringify({out,files:metadata.files,budget:metadata.budget,alpha:metadata.alpha}));
