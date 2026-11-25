import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';

test('courtyard native aliases consume each current CAT01 image exactly once',async()=>{
 const built=await build({entryPoints:['src/r1-art/index.ts'],bundle:true,write:false,format:'iife',globalName:'Art'});
 const context={};runInNewContext(built.outputFiles[0].text,context);
 const paths=Array.from(context.Art.r1BattlePaths);
 for(const part of ['body','weapon','grip','head'])assert.equal(paths.filter(p=>p==='./assets/g6-cat/'+part+'.png').length,1);
 assert.ok(!paths.some(p=>/orange-(body|parts)/.test(p)));
 const sources=new Map(paths.map(p=>[p,{canonical:p}])),cats={CAT01:{},CAT02:{},CAT03:{}},registered=new Map();
 context.Art.installR1Atlases({textures:{addAtlasJSONArray:(key,image,data)=>registered.set(key,{image,data})}},sources,cats);
 for(const [key,part] of [['cat01-body-0','body'],['cat01-body-1','body'],['cat01-weapon','weapon'],['cat01-grip','grip'],['cat01-head','head']]){
  assert.equal(registered.get(key).image,sources.get('./assets/g6-cat/'+part+'.png'));
 }
 assert.equal(registered.get('cat01-body-0').data.frames.length+registered.get('cat01-body-1').data.frames.length,24);
});

test('current round adoption binds actual exports and preserves the full package reserve',()=>{
 const receipt=JSON.parse(readFileSync('ASSET_SOURCES.json')).cat01RoundBodyAdoption;
 assert.ok(receipt,'approved round-body adoption needs an explicit source/usage record');
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 for(const file of receipt.runtimeFiles){
  assert.equal(sha(file.runtimePath),file.sha256);
  assert.equal(sha('../'+file.sourcePath),file.sourceSHA256);
  assert.ok(file.width<=512&&file.height<=512);
 }
 for(const file of receipt.descriptors)assert.equal(sha(file.path),file.sha256);
 assert.equal(receipt.nonBackgroundSourceRGBA+receipt.sourceHeadroom,5242880);
 assert.ok(receipt.sourceHeadroom>=131072);
 assert.equal(receipt.displayU,42);assert.equal(receipt.contactU,12);
});
