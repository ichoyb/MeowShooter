import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('G6 sample requires playtest');
const out=path.resolve(process.env.G6_PREVIEW_DIR||'../.local/checks/g6-pilot-20261108/preview');
if(existsSync(path.join(out,'g6-build.json')))throw Error('Use a new G6_PREVIEW_DIR; preserve existing evidence');
const {buildOptions}=await import('./build.mjs');
const normal=buildConfig().dist;
mkdirSync(out,{recursive:true});cpSync(normal,out,{recursive:true});cpSync(normal,path.join(out,'normal'),{recursive:true});
// Keep the actual current runtime exports copied from the normal candidate.
// Their trim descriptors are compiled into the fixture; old source sheets use
// different coordinates and must never overwrite these packed PNGs.
const cat=path.join(out,'assets/g6-cat'),held=path.join(out,'assets/g6-held');
const heldNames=['cat02-walk','cat03-walk'];
const packedFrames=JSON.parse(readFileSync('src/r1-art/g6-packed-frames.json','utf8'));
const packedReceipt=JSON.parse(readFileSync('../assets/art/low-poly-v1/g8-lossless-runtime.source.json','utf8'));
const packedFrameSources=[];
for(const [relative,key] of [['assets/g6-cat/body.png','body'],['assets/g6-cat/weapon.png','weapon'],['assets/g6-held/cat02-walk.png','CAT02'],['assets/g6-held/cat03-walk.png','CAT03']]){
 const bytes=readFileSync(path.join(out,relative)),normalBytes=readFileSync(path.join(normal,relative));
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),expected=packedFrames[key].meta.size;
 const record=packedReceipt.sheets.find(sheet=>sheet.runtime==='app/'+relative);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(!record||sha256!==record.sha256||!bytes.equals(normalBytes)||width!==expected.w||height!==expected.h)throw Error('G6 preview packed source mismatch: '+relative);
 packedFrameSources.push({path:relative,width,height,sha256});
}
const artRoot=path.resolve('../assets/art');
const asset=path.join(artRoot,'reward-g6-v03');
const sourceVersions={guard:'v02',cannon:'v02',leaf:'v01',shard:'v02',spirit:'v03'};
const rewardOutput=path.join(out,'assets/g6-reward');
mkdirSync(rewardOutput,{recursive:true});
const textures=Object.entries(sourceVersions).map(([name,version])=>{
  const source=path.join(artRoot,'reward-g6-'+version);
  const bytes=readFileSync(path.join(source,'runtime',name+'.png'));
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  writeFileSync(path.join(rewardOutput,name+'.png'),bytes);
  return {name,source:path.relative(asset,path.join(source,name+'.svg')).replaceAll('\\','/'),width,height,pngBytes:bytes.length,rgbaBytes:width*height*4,sha256:createHash('sha256').update(bytes).digest('hex')};
});
await build({...buildOptions,entryPoints:['tests/fixtures/g6-sample.ts'],outfile:path.join(out,'assets/g6-sample.js')});
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>猫咪开火啦 · G6动作与奖励表现</title><link rel="stylesheet" href="assets/style.css"><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#e9e9d8;color:#294d3e;font:14px/1.45 system-ui}body{max-width:640px;margin:auto;display:flex;flex-direction:column}header{padding:12px 16px 8px;background:#fffbed;flex:none;border-bottom:1px solid #d9dabc}h1{font-size:19px;line-height:1.2;margin:0 0 7px}small{font-size:11px;color:#617464}#version{background:#deeedc;border-radius:12px;padding:3px 8px;font-weight:bold}.facts{display:flex;justify-content:space-between;gap:6px;margin-top:7px;font-weight:600}.facts span{background:#f1f0d7;border-radius:8px;padding:4px 8px}#stage{position:relative;left:auto;transform:none;visibility:visible;width:100%;max-width:none;flex:1;height:auto;min-height:100px;overflow:hidden}footer{background:#fffbed;padding:9px 12px max(9px,env(safe-area-inset-bottom));flex:none}.row{display:flex;gap:6px;margin-bottom:6px}.row>*{flex:1;min-width:0}button,select{font:inherit;color:inherit;border:1px solid #adc2a7;background:#f3f6df;border-radius:10px;min-height:44px;padding:4px 8px;cursor:pointer}button:active{transform:translateY(1px)}#mode{background:#37634d;color:#fff9db;border-color:#37634d}label{display:flex;align-items:center;gap:6px;justify-content:center}input{width:19px;height:19px}p{font-size:11px;margin:5px 0;line-height:1.4}#status{display:block;font-size:12px}a{color:#457963}@media(max-height:670px){header{padding:6px 10px}h1{font-size:16px;margin-bottom:3px}footer{padding:5px 8px}.row{gap:4px;margin-bottom:4px}p{margin:3px 0}.facts{margin-top:3px}#readout{display:none}small{font-size:10px}}
</style><script defer src="assets/g6-sample.js"></script></head><body><header><h1>三猫并肩守庭院</h1><small><span id="version">新版 · G6-2</span>　三猫36u · 实际尺寸＋局部放大</small><div class="facts"><span id="health">生命</span><span id="shield">护盾</span><span id="ammo">弹匣</span></div></header><main id="stage"></main><footer><div class="row"><button id="mode" disabled>查看旧版</button><button id="pause" disabled>暂停</button><button id="start" disabled>重开</button></div><div class="row"><button id="damage" disabled>护盾吸收 · 4</button><button id="break" disabled>破盾／受伤</button><button id="sound" disabled>开启声音</button></div><div class="row"><select id="cat" aria-label="选择猫咪" disabled><option value="CAT01">橘团</option><option value="CAT02">雪团</option><option value="CAT03">墨团</option></select><select id="quality" aria-label="画质" disabled><option value="standard">标准画质</option><option value="low">低档画质</option></select><label><input id="zoom" type="checkbox" disabled>3倍放大</label></div><strong id="status">加载中…</strong><p id="readout"></p><p>受控美术小样，预置回血、护盾、哨卫及两项进阶，靶子静止。换猫重开；旧／新切换沿用同一场战斗。</p></footer></body></html>`;
const attack=html.replace('<h1>三猫并肩守庭院</h1>','<h1>庭院攻防 · 攻击特效对照</h1>')
 .replace('新版 · G6-2','精修特效')
 .replace('<button id="damage" disabled>护盾吸收 · 4</button><button id="break" disabled>破盾／受伤</button><button id="sound" disabled>开启声音</button>',
  '<select id="build" aria-label="选择攻击构筑" style="flex:2" disabled></select><button id="wave" disabled>补一波怪</button><button id="xp" disabled>放经验</button>')
 .replace('受控美术小样，预置回血、护盾、哨卫及两项进阶，靶子静止。换猫重开；旧／新切换沿用同一场战斗。',
  '拖动或用 WASD 走位。换猫、换构筑会重开。切换特效可在同一局对照。');
writeFileSync(path.join(out,'index.html'),attack);
writeFileSync(path.join(out,'g6-sample.html'),html);
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const pngRecord=(dir,name)=>({name,pngBytes:statSync(path.join(dir,name+'.png')).size,sha256:sha(path.join(dir,name+'.png'))});
writeFileSync(path.join(out,'g6-build.json'),JSON.stringify({scope:'G6_3_ATTACK_CONTROLLED_LOCAL_NOT_RELEASE',baseline:'ba4caddbd091468891a6ec9b82698a117fe082b1',out,normalSHA256:sha(path.join(out,'normal/assets/main.js')),sampleSHA256:sha(path.join(out,'assets/g6-sample.js')),packedFrameSources,rewardTextures:textures,catTextures:['body','weapon','grip','head'].map(name=>pngRecord(cat,name)),heldTextures:heldNames.map(name=>pngRecord(held,name)),normalReplaced:false},null,2)+'\n');
console.log(JSON.stringify({out,normalSHA:sha(path.join(out,'normal/assets/main.js')),textures}));
