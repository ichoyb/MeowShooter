// Standalone component fixture: no source rewriting, no new player build profile.
import {build} from 'esbuild';
import {copyFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const out=path.resolve('../.local/checks/r2-ui/components');
mkdirSync(path.join(out,'assets'),{recursive:true});
await build({entryPoints:['tests/fixtures/r2-ui.ts'],bundle:true,format:'iife',platform:'browser',target:['es2017','chrome61'],minify:true,outfile:path.join(out,'assets/main.js')});
copyFileSync('style.css',path.join(out,'assets/style.css'));
writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>R2公共组件 · 示例数据</title><link rel="stylesheet" href="./assets/style.css"><style>.fixture-section{padding:18px;margin-bottom:16px}.fixture-section .court-button{margin:0 8px 12px 0}.fixture-section h2{font-size:18px;margin:0 0 14px}#fixture-message{font-size:14px;padding:12px;line-height:1.6}</style></head><body class="courtyard-preview"><main id="app" data-build-profile="playtest"><section id="pages" class="screen courtyard-ui"><div id="page-scroll" class="scroll"></div><footer id="page-footer"></footer></section></main><script src="./assets/main.js"></script></body></html>');
console.log(JSON.stringify({fixture:out,scope:'COMPONENT_SAMPLE_ONLY_NOT_PLAYER_PACKAGE'}));
