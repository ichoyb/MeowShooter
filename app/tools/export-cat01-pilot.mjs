// Native Blender renders already contain the approved art; Sharp only packs them.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=new URL('../../',import.meta.url),input=new URL('.local/art/battle-animation/export.json',root);
const data=JSON.parse(readFileSync(input,'utf8')),out=new URL('app/assets/cat01-pilot/',root);mkdirSync(out,{recursive:true});
const body=[...data.idle.map(x=>({...x,name:'idle-'+x.index})),...data.walk.map(x=>({...x,name:'walk-'+x.index}))],frames={};
for(let page=0;page<2;page++){
 const items=body.slice(page*16,page*16+16),height=page?160:320;
 await sharp({create:{width:512,height,channels:4,background:'#00000000'}}).composite(items.map((x,i)=>({input:new URL(x.file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),left:i%4*128,top:Math.floor(i/4)*80}))).png({compressionLevel:9,palette:true,colours:256,effort:10,dither:0}).toFile(new URL('body-'+page+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 for(let i=0;i<items.length;i++){const item=items[i];frames[item.name]={texture:'cat01-body-'+page,index:i,gripIndex:page*16+i,grip:item.grip,head:item.head};}
}
await sharp({create:{width:256,height:96,channels:4,background:'#00000000'}}).composite(body.map((x,i)=>({input:new URL(x.gripFile,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),left:i%8*32,top:Math.floor(i/8)*32}))).png({compressionLevel:9}).toFile(new URL('grip.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
await sharp(new URL('.local/art/battle-animation/head.png',root).pathname.replace(/^\/([A-Za-z]:)/,'$1')).png({compressionLevel:9}).toFile(new URL('head.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
await sharp({create:{width:256,height:128,channels:4,background:'#00000000'}}).composite(data.weapon.map((x,i)=>({input:new URL(x.file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),left:i%4*64,top:Math.floor(i/4)*64}))).png({compressionLevel:9,adaptiveFiltering:true}).toFile(new URL('weapon.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const generated={body:frames,weapon:data.weapon.map(x=>({index:x.index,sourceFrame:x.sourceFrame,angle:x.angle})),bodySourceUnits:768,bodySourceHeight:480,bodyOffsetSourceY:-data.bodyCenterSourceUnits[1],weaponSourceUnits:256,displaySize:58,idleFPS:6,walkFPS:12};
writeFileSync(new URL('app/src/cat01-frames.ts',root),'// Generated from approved native Blender data; do not hand-edit.\nexport const cat01Frames = '+JSON.stringify(generated,null,2)+' as const;\n');
const assets=[];for(const name of ['body-0.png','body-1.png','weapon.png','grip.png','head.png']){const file=new URL(name,out),bytes=readFileSync(file),meta=await sharp(bytes).metadata();assets.push({path:'assets/cat01-pilot/'+name,width:meta.width,height:meta.height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
writeFileSync(new URL('.local/art/battle-animation/runtime-assets.json',root),JSON.stringify({sourceSHA256:data.sourceSHA256,assets,newAIRequests:0},null,2)+'\n');console.log(JSON.stringify(assets));
