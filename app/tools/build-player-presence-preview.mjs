import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';

if(process.env.BUILD_PROFILE!=='playtest')throw Error('Presence review requires playtest');
const config=buildConfig();
const out=path.resolve(process.env.PRESENCE_PREVIEW_DIR||'../.local/checks/player-first-session-20261116/preview');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const strideCape=process.argv.includes('--stride-cape-v02');
const candidate=path.resolve('../assets/art/low-poly-v1/cat01/presence-v01'+(strideCape?'/review/stride-cape-v02':''));
if(strideCape&&existsSync(path.join(out,'motion.html')))throw Error('Use a new PRESENCE_PREVIEW_DIR; preserve previous review artifacts');
mkdirSync(path.join(out,'assets/player-presence'),{recursive:true});
// Reuse the current baseline runtime assets. In particular, do not overwrite
// packed body/weapon sheets with the historical unpacked source export.
const baseline=path.resolve(config.dist,'assets');
if(!existsSync(path.join(baseline,'g6-cat/body.png')))throw Error('Build the current normal playtest first');
cpSync(baseline,path.join(out,'assets'),{recursive:true});
for(const name of ['body','weapon','grip','head']){
 const relative='g6-cat/'+name+'.png';
 if(!readFileSync(path.join(out,'assets',relative)).equals(readFileSync('assets/'+relative)))throw Error('Baseline runtime mismatch: '+relative);
}
cpSync(path.join(candidate,'runtime/body.png'),path.join(out,'assets/player-presence/body.png'));
const {buildOptions,versions}=await createBuildOptions(config,{testInputDiagnostics:true});
const result=await build({...buildOptions,define:{...buildOptions.define,PRESENCE_STRIDE_CAPE_REVIEW:JSON.stringify(strideCape)},
 plugins:[...(buildOptions.plugins||[]),...(strideCape?[{name:'stride-cape-review-json',setup(builder){
  builder.onResolve({filter:/presence-v01\/runtime\/(?:frames|packed-body)\.json$/},args=>{
   if(args.importer.replaceAll('\\','/').endsWith('/tests/fixtures/player-presence-presentation.ts'))return {path:path.join(candidate,'runtime',path.basename(args.path))};
  });
 }}]:[])],entryPoints:['tests/fixtures/player-presence-sample.ts'],outfile:path.join(out,'assets/player-presence.js')});
writeFileSync(path.join(out,'motion.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>小满 · 尺寸与动作对照</title><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#e9e9d8;color:#294d3e;font:14px/1.4 system-ui}body{max-width:560px;margin:auto;display:flex;flex-direction:column}header,footer{flex:none;background:#fffbed;padding:10px 12px}header{border-bottom:1px solid #d5d9bd}h1{font-size:18px;margin:0 0 5px}header p,footer p{font-size:11px;margin:5px 0}.facts,.row{display:flex;gap:6px;margin-top:6px}.facts{justify-content:space-between;font-weight:600}button,select{font:inherit;color:inherit;border:1px solid #a9bd9b;border-radius:9px;background:#f3f6df;min-height:44px;padding:5px 8px;cursor:pointer}.row>*{flex:1;min-width:0}#mode{background:#37634d;color:#fff9db}#stage{position:relative;width:100%;flex:1;min-height:120px;overflow:hidden}canvas{display:block}label{display:flex;align-items:center;justify-content:center;gap:5px}input{width:18px;height:18px}#status{font-size:12px}#upgrade{position:absolute;inset:20% 10% auto;background:#fffbed;z-index:4;padding:16px;border:2px solid #a9bd9b;border-radius:16px;box-shadow:0 8px 32px #2338}#upgrade button{display:block;width:100%;margin-top:8px}#upgrade[hidden]{display:none}a{color:#457963}footer{padding-bottom:max(8px,env(safe-area-inset-bottom))}@media(max-height:650px){header,footer{padding:5px 8px}h1{font-size:15px}header p,footer p{margin:2px 0;font-size:10px}button,select{min-height:44px}.row,.facts{margin-top:4px}}
</style><script defer src="assets/player-presence.js"></script></head><body><header><h1>小满 · 动作与尺寸对照</h1><p>同一真实战斗 · 切换沿用当前相位 · <a href="index.html">返回画廊</a></p><div class="facts"><span id="health">生命</span><span id="ammo">弹匣</span><span id="time">0秒</span></div></header><main id="stage"><div id="upgrade" hidden></div></main><footer><div class="row"><button id="mode" disabled>精修动作</button><select id="size" aria-label="角色显示尺寸" disabled><option value="36">36u</option><option value="42">42u</option><option value="48">48u</option></select><button id="pause" disabled>暂停</button><button id="start" disabled>重开</button></div><div class="row"><select id="quality" aria-label="画质" disabled><option value="standard">标准画质</option><option value="low">低档画质</option></select><label><input id="zoom" type="checkbox" disabled>3倍局部放大</label><button id="sound" disabled>开启声音</button></div><p id="display">36u 显示 · 12u 接触</p><strong id="status">加载中…</strong><p>拖动／WASD走位；遇敌自动射击。当前动作与精修动作共用物理、边界、移速和弹源。此为独立小样，未替换正常游戏。</p></footer></body></html>`);
if(strideCape){
 const file=path.join(out,'motion.html');
 writeFileSync(file,readFileSync(file,'utf8').replaceAll('小满 · 尺寸与动作对照','小满 · 迈步与披风加强对照').replaceAll('小满 · 动作与尺寸对照','小满 · 迈步与披风加强对照')
  .replace('<a href="index.html">返回画廊</a>','<a href="http://127.0.0.1:9074/normal-v02/">返回完整试玩</a>')
  .replace('同一真实战斗 · 切换沿用当前相位','42u实际显示 · 同一真实战斗 · 切换沿用当前相位')
  .replace('36u 显示 · 12u 接触','42u 显示 · 12u 接触')
  .replace('当前动作与精修动作共用物理、边界、移速和弹源。此为独立小样，未替换正常游戏。','“加强动作”加大迈步、抬脚及披风中段／下摆，“现版动作”保留已确认版本。两侧共用物理、边界、移速和弹源；仅小满候选，未替换完整试玩。'));
}
const packing=JSON.parse(readFileSync(path.join(candidate,'packing-receipt.json'),'utf8'));
const receipt={scope:'PLAYER_FIRST_SESSION_MOTION_LOCAL_REVIEW_NOT_RELEASE',out,versions,
 sampleSHA256:sha(readFileSync(path.join(out,'assets/player-presence.js'))),
 baselinePacked: ['body','weapon','grip','head'].map(name=>({file:'assets/g6-cat/'+name+'.png',sha256:sha(readFileSync('assets/g6-cat/'+name+'.png'))})),
 candidateBody:packing.body,newDecodedSources:1,newTextureEntries:4,newAnimationEntries:3,newVisualObjects:4,newPhysicalBodies:0,
 maximumTransitionTweens:1,newCameras:1,sourceBytesUnchanged:true,normalReplaced:false,candidateSource:candidate,strideCapeReview:strideCape,initialDisplaySize:strideCape?42:36,
 modules:Object.keys(result.metafile.inputs),environments:{desktop:'NOT_TESTED_HERE',platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',chrome61:'NOT_TESTED'}};
writeFileSync(path.join(out,'presence-build.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({out,mainSHA256:receipt.sampleSHA256,candidateBody:receipt.candidateBody}));

