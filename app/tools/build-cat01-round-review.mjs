import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';

if(process.env.BUILD_PROFILE!=='playtest')throw Error('Standalone playtest review only');
const config=buildConfig();
const out=path.resolve('../.local/checks/cat01-round-motion-20261117/preview');
const candidate=path.resolve('../assets/art/low-poly-v1/cat01/review/round-body-motion-v01');
const baseline=path.resolve('../.local/checks/n1-m3-runtime-20261117/normal/assets');
if(!existsSync(path.join(baseline,'g6-cat/body.png')))throw Error('Reviewed normal artifact is required');
mkdirSync(path.join(out,'assets/round-cat'),{recursive:true});
cpSync(baseline,path.join(out,'assets'),{recursive:true,filter:source=>!['main.js','boot.js'].includes(path.basename(source))});
for(const name of ['body','weapon','grip','head']){
 if(!readFileSync(path.join(baseline,'g6-cat/'+name+'.png')).equals(readFileSync('assets/g6-cat/'+name+'.png')))throw Error('Baseline source mismatch: '+name);
}
for(const name of ['body','head','grip'])cpSync(path.join(candidate,'runtime/'+name+'.png'),path.join(out,'assets/round-cat/'+name+'.png'));
cpSync(path.join(candidate,'cat01-neutral-round-body-v01.png'),path.join(out,'neutral-reference.png'));
const {buildOptions,versions}=await createBuildOptions(config,{testInputDiagnostics:true});
const result=await build({...buildOptions,plugins:[...(buildOptions.plugins||[]),{
 name:'isolated-round-cat-frame-data',setup(builder){
  builder.onResolve({filter:/presence-v01\/runtime\/(?:frames|packed-body)\.json$/},args=>{
   if(args.importer.replaceAll('\\','/').endsWith('/tests/fixtures/player-presence-presentation.ts'))return {path:path.join(candidate,'runtime',path.basename(args.path))};
  });
 }}],entryPoints:['tests/fixtures/cat01-round-body-sample.ts'],outfile:path.join(out,'assets/round-review.js')});
writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>小满 · 圆胖动作对照</title><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#e9e9d8;color:#294d3e;font:14px/1.4 system-ui}body{max-width:560px;margin:auto;display:flex;flex-direction:column}header,footer{flex:none;background:#fffbed;padding:10px 12px}header{border-bottom:1px solid #d5d9bd}h1{font-size:18px;margin:0 0 5px}header p,footer p{font-size:11px;margin:5px 0}.facts,.row{display:flex;gap:6px;margin-top:6px}.facts{justify-content:space-between;font-weight:600}button,select{font:inherit;color:inherit;border:1px solid #a9bd9b;border-radius:9px;background:#f3f6df;min-height:44px;padding:5px 8px;cursor:pointer}.row>*{flex:1;min-width:0}#mode{background:#37634d;color:#fff9db}#stage{position:relative;width:100%;flex:1;min-height:120px;overflow:hidden}canvas{display:block}label{display:flex;align-items:center;justify-content:center;gap:5px}input{width:18px;height:18px}#status{font-size:12px}#upgrade{position:absolute;inset:20% 10% auto;background:#fffbed;z-index:4;padding:16px;border:2px solid #a9bd9b;border-radius:16px;box-shadow:0 8px 32px #2338}#upgrade button{display:block;width:100%;margin-top:8px}#upgrade[hidden]{display:none}a{color:#457963}footer{padding-bottom:max(8px,env(safe-area-inset-bottom))}@media(max-height:650px){header,footer{padding:5px 8px}h1{font-size:15px}header p,footer p{margin:2px 0;font-size:10px}button,select{min-height:44px}.row,.facts{margin-top:4px}}
</style><script defer src="assets/round-review.js"></script></head><body><header><h1>小满 · 圆胖动作对照</h1><p>当前／圆胖造型切换 · 同一真实战斗 · <a href="neutral-reference.png" target="_blank">中性母图</a></p><div class="facts"><span id="health">生命</span><span id="ammo">弹匣</span><span id="time">0秒</span></div></header><main id="stage"><div id="upgrade" hidden></div></main><footer><div class="row"><button id="mode" disabled>圆胖小满</button><select id="size" aria-label="角色显示尺寸" disabled><option value="36">36u</option><option value="42" selected>42u</option><option value="48">48u</option></select><button id="pause" disabled>暂停</button><button id="start" disabled>重开</button></div><div class="row"><select id="quality" aria-label="画质" disabled><option value="standard">标准画质</option><option value="low">低档画质</option></select><label><input id="zoom" type="checkbox" disabled>3倍局部放大</label><button id="sound" disabled>开启声音</button></div><p id="display">42u 显示 · 12u 接触</p><strong id="status">加载中…</strong><p>拖动／WASD走位，自动攻击。查看待机、短腿迈步、披风和移动开火；物理、移速、弹源和数值保持。此为独立动作小样，未替换正常游戏。</p></footer></body></html>`);
const receipt={scope:'CAT01_ROUND_BODY_MOTION_ISOLATED_REVIEW',versions,
 sampleSHA256:createHash('sha256').update(readFileSync(path.join(out,'assets/round-review.js'))).digest('hex'),
 packing:JSON.parse(readFileSync(path.join(candidate,'packing-receipt.json'),'utf8')),
 sourceModules:Object.keys(result.metafile.inputs),normalReplaced:false,newPhysicalBodies:0,
 environments:{desktop:'NOT_TESTED_HERE',phone:'NOT_TESTED',platform:'NOT_TESTED'}};
writeFileSync(path.join(out,'review-build.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({out,mainSHA256:receipt.sampleSHA256}));
