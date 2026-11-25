import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
test('实际三profile构建及审计：仅playtest包含声音和原生manager，运行图不依赖tests',()=>{
 const version=JSON.parse(readFileSync('package.json')).version;
 for(const profile of ['release','review','playtest']){
  const env={...process.env,BUILD_PROFILE:profile};const build=spawnSync(process.execPath,['tools/build.mjs'],{env,encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stderr+build.stdout);
  const record=JSON.parse(readFileSync(`../.local/builds/${version}/${profile}/${profile}-build-record.json`));const audioModules=record.modules.filter(p=>p.replaceAll('\\','/').includes('/audio/')||p.includes('WebAudioSoundManager'));
  assert.equal(record.courtyardEnabled,profile==='playtest');
  if(profile==='playtest'){assert.ok(audioModules.some(p=>p.includes('WebAudioSoundManager')));assert.ok(audioModules.some(p=>p.includes('synthesis.mjs')));assert.ok(record.audio);assert.equal(record.audio.sources.length,3);}else {assert.deepEqual(audioModules,[]);assert.equal(record.audio,undefined);}
  assert.ok(!record.modules.some(p=>p.replaceAll('\\','/').includes('tests/')),'运行源码不可依赖测试夹具');
  const audit=spawnSync(process.execPath,['tools/audit.mjs'],{env,encoding:'utf8',windowsHide:true});assert.equal(audit.status,0,audit.stderr+audit.stdout);assert.equal(JSON.parse(audit.stdout).status,'PASS');
 }
});
test('实际新预览HTML在资源就绪前禁用全部片段操作',()=>{
 const result=spawnSync(process.execPath,['tools/build-f1-audio-preview.mjs'],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr+result.stdout);const html=readFileSync('../.local/checks/g5-audio-integration-20261105/legacy-fixture/sample.html','utf8'),controls=[...html.matchAll(/<(button|input|select)\b[^>]*>/g)];assert.equal(controls.length,7);for(const [tag] of controls)assert.match(tag,/\bdisabled\b/);
});

test('legacy audio builder uses independent fixture without rewriting runtime or build source',()=>{const source=readFileSync('tools/build-f1-audio-preview.mjs','utf8');assert.doesNotMatch(source,/text\.replace|source\.replace|writeFileSync\(temporary|onLoad/);assert.match(source,/entryPoints:\['tests\/fixtures\/f1-audio-pilot.ts'\]/);});
