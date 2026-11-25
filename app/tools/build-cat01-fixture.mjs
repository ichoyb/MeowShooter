// Build a separate actual-Scene fixture; never add QA entry points to a ZIP.
// Run from app/, serve the printed folder with tools/serve.mjs and open index.html.
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const folder=path.resolve('../.local/checks',version,'cat01-fixture');
const dist=path.join(folder,'dist'),record=path.join(folder,'build');
mkdirSync(folder,{recursive:true});
let source=readFileSync('tools/build.mjs','utf8');
function replace(from,to){if(source.split(from).length!==2)throw Error('Fixture build marker changed: '+from);source=source.replace(from,to);}
replace('const config=buildConfig();','const config={...buildConfig(),dist:'+JSON.stringify(dist)+',qa:'+JSON.stringify(record)+'};');
replace("entryPoints: ['src/main.ts']","entryPoints: ['tests/fixtures/cat01-presentation.ts']");
const hook=`builder.onLoad({filter:/[\\\\/]src[\\\\/]battle\\.ts$/},args=>{const text=readFileSync(args.path,'utf8'),marker='const arena = new Arena();';if(text.split(marker).length!==2)throw Error('Arena fixture marker changed');return {contents:text.replace(marker,marker+' (window as any).qaArena=arena; (window as any).qaPosition=resetBody;'),loader:'ts',resolveDir:path.dirname(args.path)};});`;
replace('builder.onLoad({ filter:',hook+'\n    builder.onLoad({ filter:');
const temporary=path.resolve('tools/.cat01-fixture-build.mjs');
try{
  writeFileSync(temporary,source);
  const result=spawnSync(process.execPath,[temporary],{env:{...process.env,BUILD_PROFILE:'playtest'},stdio:'inherit',windowsHide:true});
  if(result.status!==0)throw Error('Fixture build failed');
}finally{unlinkSync(temporary);}
writeFileSync(path.join(dist,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>橘团实际场景检查</title><link rel="stylesheet" href="assets/style.css"><script defer src="assets/main.js"></script></head><body><div id="stage" style="position:relative;width:360px;height:700px"></div><details><summary>完整检查记录</summary><pre id="qa-result">RUNNING</pre></details></body></html>');
console.log(JSON.stringify({fixtureDist:dist,tests:'Actual Scene assertions; read #qa-result after browser execution'}));
