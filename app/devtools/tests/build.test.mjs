// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {createBuildOptions} from '../../tools/build-options.mjs';
import {buildConfig} from '../../tools/build-config.mjs';

for(const profile of ['release','review','playtest'])test(profile+' deletes devtools and all runtime hooks',async()=>{
 const config=buildConfig({profile});
 process.env.DEVTOOLS='true';
 let buildOptions;try{({buildOptions}=await createBuildOptions(config));}finally{delete process.env.DEVTOOLS;}

 assert.equal(buildOptions.define.__DEVTOOLS__,'false');
 const result=await build({...buildOptions,write:false});
 assert.equal(Object.keys(result.metafile.inputs).some(file=>file.includes('devtools/')),false);
 const output=result.outputFiles[0].text;
 for(const marker of ['CAT_DEVTOOLS_V1','本机调试面板','devtools','devtoolsGrant','devtoolsMaxHP','devtoolsDamage','__DEVTOOLS__'])assert.equal(output.includes(marker),false,marker);
});

test('only the explicit independent entry includes the panel and active hooks',async()=>{
 const {buildOptions}=await createBuildOptions(buildConfig({profile:'playtest'}),{devtools:true});
 const result=await build({...buildOptions,entryPoints:['devtools/entry.ts'],write:false});
 assert.ok(result.metafile.inputs['src/main.ts']);assert.ok(result.metafile.inputs['devtools/panel.ts']);
 for(const marker of ['CAT_DEVTOOLS_V1','devtools','devtoolsGrant','devtoolsMaxHP','devtoolsDamage'])assert.ok(result.outputFiles[0].text.includes(marker),marker);
});

test('omitting the devtools compile flag fails instead of silently disabling hooks',async()=>{
 const result=await build({entryPoints:['src/rules.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const module={exports:{}};
 runInNewContext(result.outputFiles[0].text,{module,exports:module.exports});
 assert.throws(()=>new module.exports.Session(),/__DEVTOOLS__ is not defined/);
});

test('tool output root is an explicit absolute argument and never an environment override',()=>{
 const before=buildConfig({profile:'playtest'});process.env.DEVTOOLS_OUTPUT_ROOT='/tmp/unrequested';
 try{assert.deepEqual(buildConfig({profile:'playtest'}),before);}finally{delete process.env.DEVTOOLS_OUTPUT_ROOT;}
 assert.throws(()=>buildConfig({outputRoot:'relative'}),/absolute/);
 assert.throws(()=>buildConfig({outputRoot:''}),/absolute/);
 const outputRoot=path.resolve('devtools-test');
 const isolated=buildConfig({profile:'playtest',outputRoot});
 assert.equal(isolated.dist,path.join(outputRoot,'base'));
 assert.equal(isolated.qa,path.join(outputRoot,'records'));
});


test('browser launch blocked by sandbox reports NOT_RUN and exits with a distinct nonzero code',t=>{
 const parent=path.resolve('../.local/devtools/tmp');mkdirSync(parent,{recursive:true});
 const folder=mkdtempSync(path.join(parent,'devtools-browser-exit-')),module=path.join(folder,'playwright.cjs');
 t.after(()=>rmSync(folder,{recursive:true,force:true}));
 writeFileSync(module,"exports.chromium={launch:async()=>{throw new Error('Operation not permitted: test sandbox')}};\n");
 const result=spawnSync(process.execPath,['devtools/browser-test.cjs'],{encoding:'utf8',env:{...process.env,DEVTOOLS_URL:'http://127.0.0.1:55001',DEVTOOLS_CHECK_DIR:folder,PLAYWRIGHT_MODULE:module}});
 assert.equal(result.status,2,result.stderr+result.stdout);
 const report=JSON.parse(readFileSync(path.join(folder,'report.json'),'utf8'));
 assert.equal(report.status,'NOT_RUN');assert.deepEqual(report.checks,[]);assert.match(report.originalError,/Operation not permitted/);
});
