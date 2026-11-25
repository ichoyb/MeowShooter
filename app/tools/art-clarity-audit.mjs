// Read-only source-density inventory. A large source does not prove visual QA;
// these rows identify where a real-size, same-camera comparison is required.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const out=path.resolve(process.env.ART_CLARITY_DIR||'../.local/checks/art-clarity-20261031');
mkdirSync(out,{recursive:true});
const entries=[];
function atlas(label,file,metadata,frames,units){
 const data=JSON.parse(readFileSync('src/r1-art/'+metadata+'.json'));
 for(const frame of data.frames.filter(f=>frames===null||frames.includes(f.filename))){
  entries.push({label:label+' / '+frame.filename,file,rect:frame.frame,logical:frame.sourceSize,offset:frame.spriteSourceSize,worldWidth:units,kind:'sprite'});
 }
}
atlas('橘团脸','assets/r1-restoration/orange-parts.png','cat01-head',null,36);
atlas('橘团身体动作','assets/r1-restoration/orange-body.png','cat01-body-0',null,36);
atlas('橘团身体动作','assets/r1-restoration/orange-body.png','cat01-body-1',null,36);
atlas('橘团弹弓','assets/r1-restoration/orange-parts.png','cat01-weapon',null,18);
atlas('橘团握持爪','assets/r1-restoration/orange-parts.png','cat01-grip',null,9);
for(const id of ['CAT02','CAT03'])atlas(id,'assets/r1-restoration/ui-'+id+'.png','cat-'+id,['body','h1-head'],36);
atlas('小鱼干','assets/r1-restoration/held-weapons.png','h1-art',['h1-weapon-W04'],36*.3678742310321258);
atlas('鱼骨','assets/r1-restoration/held-weapons.png','h1-art',['h1-weapon-W02'],36*.3233180564870705);
for(const [frame,units] of [['enemy-0',26],['enemy-e03',32],['enemy-e04',36],['elite-el01',52],['boss-b01',96],['bell',18],['fish',18],['bone',18],['spirit',28],['spirit-shot',12]])atlas(frame,'assets/r1-restoration/enemies.png','atlas',[frame],units);
for(const [label,file,size,units,kind] of [['命中闪光','assets/battle-feedback/bell-hit.png',64,24,'brief-soft-effect'],['敌方弹丸','assets/first-combat/bubble.png',32,14,'sprite'],['Boss尘浪最大纵向','assets/first-combat/b01-dust.png',64,140,'soft-volume']]){
 const b=readFileSync(file),edge=b.readUInt32BE(16);const frame=label==='敌方弹丸'?edge:size;
 entries.push({label,file,rect:{x:0,y:0,w:frame,h:frame},logical:{w:frame,h:frame},offset:{x:0,y:0,w:frame,h:frame},worldWidth:units,kind});
}
for(const e of entries){
 const bytes=readFileSync(e.file);e.sha256=createHash('sha256').update(bytes).digest('hex');
 e.sourceSize=[bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 e.maxStandardBufferWidth=e.worldWidth*430/360*2;
 e.sourceSamplesPerBufferPixel=e.logical.w/e.maxStandardBufferWidth;
 e.finding=e.kind==='soft-volume'?'INTENTIONAL_SOFT_VOLUME_REEXPORTED_24_TO_64':e.sourceSamplesPerBufferPixel>=1?'NO_SOURCE_UPSCALE_AT_STANDARD_MAX':'REQUIRES_VISUAL_REVIEW';
}
const receipt={environment:'static source audit; worst configured 430 CSS width / density2 / 360u camera',scope:'Not a GPU/phone test; trim pixels remain in their authored logical windows; texture samples do not equal perceived detail',entries};
writeFileSync(path.join(out,'asset-inventory.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({frames:entries.length,findings:[...new Set(entries.map(e=>e.finding))]}));
