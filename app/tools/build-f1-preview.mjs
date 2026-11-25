import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const folder=path.resolve('../.local/f1-damage/preview'),record=path.resolve('../.local/f1-damage/build');
mkdirSync(folder,{recursive:true});
for(const sample of [false,true]){
  let source=readFileSync('tools/build.mjs','utf8');
  function replace(from,to){if(source.split(from).length!==2)throw Error('F1 build marker changed: '+from);source=source.replace(from,to);}
  replace('const config=buildConfig();','const config={...buildConfig(),dist:'+JSON.stringify(folder)+',qa:'+JSON.stringify(record)+'};');
  if(sample){
    replace("entryPoints: ['src/main.ts']","entryPoints: ['tests/fixtures/f1-pilot.ts']");
    replace("outfile: config.dist+'/assets/main.js'","outfile: config.dist+'/assets/f1-sample.js'");
    const hook=`builder.onLoad({filter:/[\\\\/]src[\\\\/]battle\\.ts$/},args=>{const text=readFileSync(args.path,'utf8'),marker='const arena = new Arena();';if(text.split(marker).length!==2)throw Error('Arena fixture marker changed');return {contents:text.replace(marker,marker+' (window as any).qaArena=arena; (window as any).qaPosition=resetBody;'),loader:'ts',resolveDir:path.dirname(args.path)};});`;
    replace('builder.onLoad({ filter:',hook+'\n    builder.onLoad({ filter:');
  }
  const temporary=path.resolve('tools/.f1-preview-build.mjs');
  try{writeFileSync(temporary,source);const result=spawnSync(process.execPath,[temporary],{env:{...process.env,BUILD_PROFILE:'playtest'},stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('F1 build failed');}finally{unlinkSync(temporary);}
}
writeFileSync(path.join(folder,'sample.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>橘团 · 命中与庭院小样</title><link rel="stylesheet" href="./assets/f1-sample.css"><script defer src="./assets/f1-sample.js"></script></head><body><main><header><h1>橘团的庭院守护</h1><p>命中特效与真实伤害数字 · 庭院小样</p><nav><button id="play">重播10秒小样</button><button id="pause">暂停／继续</button><label>画质 <select id="quality"><option value="standard">标准</option><option value="low">低档</option></select></label><a href="./index.html">自由试玩</a></nav></header><div id="stage"></div><section><p id="status">正在准备橘团…</p><p id="events"></p><p class="note">受控靶子与走位，读取真实命中、击败和受伤。数字为当次计算伤害，可超过剩余生命；小数最多显示两位。原角色与战斗数值保持。</p><p class="note">本版暂无声音：最新平台文件白名单仍未列音频格式，音乐与音效接入等待核实。</p><h2>实际关键相位</h2><div class="frames"><figure><img id="frame-hit" alt="命中实际帧"><figcaption>命中与真实伤害</figcaption></figure><figure><img id="frame-defeat" alt="击败实际帧"><figcaption>雾团消散</figcaption></figure><figure><img id="frame-hurt" alt="受伤实际帧"><figcaption>受伤环与HP损失</figcaption></figure></div><p id="capture-note" class="note">关键相位在播放时由实际画面截取；不是设计画板。</p></section></main></body></html>`);
writeFileSync(path.join(folder,'assets/f1-sample.css'),`*{box-sizing:border-box}body{margin:0;background:#fff4dd;color:#4f3728;font:14px system-ui,"Microsoft YaHei",sans-serif}main{max-width:430px;margin:auto;background:#fffcf4}header{padding:14px 14px 10px}h1{font-size:22px;margin:0 0 4px}p{margin:6px 0;line-height:1.5}h2{font-size:16px}nav{display:flex;flex-wrap:wrap;align-items:center;margin:10px -3px 0}button,select,a{font:inherit;color:inherit;border:1px solid #b89168;background:#fff4dd;border-radius:10px;min-height:40px;padding:8px;margin:3px;text-decoration:none}button:first-child{background:#ffc878}label{white-space:nowrap}#stage{position:relative;width:100%;height:calc(100vh - 190px);min-height:420px;background:#dbe7c0;touch-action:none}#stage canvas{display:block}section{padding:10px 14px 20px}.note{font-size:12px;color:#795b43}.frames{display:flex;margin:0 -3px}figure{width:33.333%;margin:3px}figure img{display:block;width:100%;min-height:130px;background:#e5edda;border-radius:8px}figcaption{font-size:12px;margin-top:4px;text-align:center}`);
console.log(JSON.stringify({preview:folder,entry:'sample.html',scope:'F1 damage-number review only; audio blocked by platform package formats; not a ZIP directory'}));
