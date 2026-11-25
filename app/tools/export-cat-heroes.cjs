// Development-only, deterministic resize of delivered RGBA art. No generation,
// cropping, recoloring or per-part changes. Uses the already installed browser.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceCommit='293f6b645f9469db701399261941d52d4e289ca6';
const inputs=[
 {id:'CAT02',file:'cat02/cat02-hero-v02.png',sha256:'4b1bb2b843815a29ee41ecf20d82aa952a9c4a441f5cad972d3cf0870c63944e'},
 {id:'CAT03',file:'cat03/cat03-hero-front-v02.png',sha256:'a210fb9382a4144ae1d88f6065a8be234c4db90a54f094834771f7bb383f0b8f'}
];
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
 const outputs=[];
 for(const input of inputs){
  const source='assets/art/low-poly-v1/'+input.file,raw=fs.readFileSync(path.join(root,source));assert.equal(sha(raw),input.sha256);
  const result=await page.evaluate(async url=>{
   const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   const scale=368/Math.max(image.naturalWidth,image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
   ctx.drawImage(image,(384-width)/2,(384-height)/2,width,height);
   return {data:canvas.toDataURL('image/png').split(',')[1],sourceWidth:image.naturalWidth,sourceHeight:image.naturalHeight};
  },'data:image/png;base64,'+raw.toString('base64'));
  const file='assets/cat-heroes/'+input.id+'.png',bytes=Buffer.from(result.data,'base64');
  fs.mkdirSync(path.dirname(path.join(root,'app',file)),{recursive:true});fs.writeFileSync(path.join(root,'app',file),bytes);
  outputs.push({id:input.id,source:'../'+source,sourceSha256:input.sha256,sourceCommit,sourceWidth:result.sourceWidth,sourceHeight:result.sourceHeight,
   file,width:384,height:384,bytes:bytes.length,sha256:sha(bytes),runtimePath:'assets/ui/'+input.id+'.png'});
 }
 const file=path.join(root,'app/ASSET_SOURCES.json'),sources=JSON.parse(fs.readFileSync(file,'utf8'));
 sources.courtyardHeroCats={scope:'playtest courtyard only; replaces existing UI / battle decoded CAT02 and CAT03 images',
  adoption:'User authorized latest delivered character art and36u on2026-10-28; local preview, not final production or device acceptance',
  sourceReview:'Original generation receipts preserve draft status; current adoption does not rewrite another window',
  operation:'Full original RGBA image uniformly contained within368x368 on384x384 transparent canvas;8px minimum padding; no crop, face/body change or animation',
  tool:'tools/export-cat-heroes.cjs',toolSha256:sha(fs.readFileSync(__filename)),browser:browser.version(),node:process.version,
  sourceRecordURL:'https://github.com/Jojoabcd/Cat-save-world/tree/'+sourceCommit+'/docs/ui/source/art/low-poly-v1',
  assets:outputs,newAIRequests:0,cat01:'Existing approved cutout animation retained byte-for-byte; only uniform36u presentation scale'};
 fs.writeFileSync(file,JSON.stringify(sources,null,2)+'\n');console.log(JSON.stringify(sources.courtyardHeroCats));
 }finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
