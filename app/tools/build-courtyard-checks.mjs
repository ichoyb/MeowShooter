// Local controlled Scene only. Normal player builds and packages use build.mjs.
import {build} from 'esbuild';
import {cpSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('Scene checks require BUILD_PROFILE=playtest');
const {buildOptions}=await import('./build.mjs');
const config=buildConfig(),folder=path.resolve('../.local/checks/courtyard-normal-build/fixture');
mkdirSync(folder,{recursive:true});
cpSync(config.dist,folder,{recursive:true});
await build({...buildOptions,entryPoints:['tests/fixtures/courtyard-camera.ts'],outfile:path.join(folder,'assets/courtyard-checks.js')});
writeFileSync(path.join(folder,'checks.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>庭院实际场景检查</title><link rel="stylesheet" href="./assets/courtyard-checks.css"><script defer src="./assets/courtyard-checks.js"></script></head><body><h1>庭院实际场景检查</h1><p>独立受控检查，不进入扫码包。</p><button id="run-checks" disabled>运行场景检查</button><div id="stage"></div><pre id="checks-result">正在准备…</pre></body></html>`);
writeFileSync(path.join(folder,'assets/courtyard-checks.css'),'body{margin:16px;background:#fff5e2;color:#4f3728;font:14px system-ui}button{min-height:44px}#stage{position:relative;width:390px;height:844px;touch-action:none}canvas{display:block}pre{white-space:pre-wrap}');
console.log(JSON.stringify({fixture:folder,profile:config.profile,courtyardEnabled:config.courtyardEnabled,scope:'CONTROLLED_SCENE_ONLY_NOT_A_PACKAGE'}));
