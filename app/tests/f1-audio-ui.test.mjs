import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {runInNewContext} from 'node:vm';import {readFileSync} from 'node:fs';
test('真实设置给出独立音乐音效开关音量，评审样例仍隔离',async()=>{
 const bundle=await build({define:{__DEVTOOLS__:'false'},stdin:{contents:"export {renderLayer} from './src/ui/layers'; export {NavigationModel} from './src/ui/model';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'UI'});const scope={};runInNewContext(bundle.outputFiles[0].text,scope);const {NavigationModel,renderLayer}=scope.UI;
 const m=new NavigationModel(false,true);m.openLayer('LAYER-01-S02',{runtimeAudio:{settings:{music:true,effects:false,musicVolume:.65,effectsVolume:.25},ready:true,error:''}});const html=renderLayer(m,{}).body;
 assert.match(html,/sound-toggle:music/);assert.match(html,/sound-toggle:effects/);assert.match(html,/data-audio-volume="musicVolume"/);assert.match(html,/data-audio-volume="effectsVolume"/);assert.match(html,/value="65"/);assert.match(html,/value="25"/);
 const review=new NavigationModel(true,false);review.openLayer('LAYER-01-S01',{sample:true});const sample=renderLayer(review,{}).body;assert.match(sample,/sample-audio/);assert.doesNotMatch(sample,/sound-toggle/);
});
test('实际HUD复用固定状态位显示声音原因，健康时还原且不添加布局',async()=>{
 const bundle=await build({define:{__DEVTOOLS__:'false'},entryPoints:['src/ui/hud.ts'],bundle:true,write:false,format:'iife',globalName:'HUD'}),scope={};runInNewContext(bundle.outputFiles[0].text,scope);assert.equal(typeof scope.HUD.setBattleModeStatus,'function','缺少实际HUD声音错误显示');const attrs=new Map(),node={textContent:'',title:'',style:{},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k)};
 scope.HUD.setBattleModeStatus(node,'自动 · 近敌','原生resume失败');assert.equal(node.textContent,'声音暂不可用：原生resume失败');assert.equal(attrs.get('role'),'status');assert.equal(node.title,'原生resume失败');scope.HUD.setBattleModeStatus(node,'自动 · 近敌','');assert.equal(node.textContent,'自动 · 近敌');assert.equal(attrs.has('role'),false);assert.equal(node.title,'');
});
