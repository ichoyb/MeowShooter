import {build} from 'esbuild';
import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('BUILD_PROFILE=playtest required');
const out=path.resolve(process.env.G4B_ADMISSION_DIR||'../.local/checks/g4b-normal-pool-20261104/admission'),fixture=path.join(out,'scene-dist');
const {buildOptions}=await import('./build.mjs');
mkdirSync(fixture,{recursive:true});cpSync(path.dirname(path.dirname(buildOptions.outfile)),fixture,{recursive:true});
await build({...buildOptions,entryPoints:['tools/g4b-admission-scene.ts'],outfile:path.join(fixture,'assets/g4b-admission.js')});
writeFileSync(path.join(fixture,'g4b-admission.html'),'<!doctype html><html><head><meta charset="utf-8"><script defer src="./assets/g4b-admission.js"></script></head><body style="margin:0"><div id="stage" style="position:relative;width:390px;height:844px"></div></body></html>');
const rules=JSON.parse(readFileSync(path.join(out,'rules-report.json'),'utf8'));assert.equal(rules.status,'PASS');
const budget=rules.checks[0].detail.maximumInvestments,projections=rules.checks.at(-1).detail.cases;
const scenarios=[];const common={L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,C23:1,M31:1,E21:1,L1_PIERCE:1,M05:1,E23:1,M12:1};
for(const row of projections){scenarios.push({id:'maximum-projection',cat:row.cat,before:row.maximum.ranks});const mixed={...common,L1_RATE:10,L1_RANGE:8,L1_RELOAD:4};scenarios.push({id:'old-long-new-short-mirror-rhythm',cat:row.cat,before:mixed,after:{...mixed,A15:1}});const shortest={L1_SPLIT:1,L1_ECHO:1,L1_LIGHT_MAG:1,C23:1,M31:1,E21:1,L1_PIERCE:1,M05:1,E23:1,M12:1};scenarios.push({id:'short-life-history-and-delayed-intents',cat:row.cat,before:shortest,after:{...shortest,A15:26}});}
for(const s of scenarios)for(const ranks of [s.before,s.after].filter(Boolean))assert(Object.values(ranks).reduce((a,b)=>a+b,0)<=budget);
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=process.env.G4B_ADMISSION_PORT||'8970',errors=[];let browser,server,result;
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
try{
 server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,APP_DIST:fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server exit '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/g4b-admission.html');await page.waitForFunction(()=>window.g4bAdmissionReady||window.g4bAdmissionBootError);result=await page.evaluate(cases=>window.g4bAdmissionBootError?{status:'FAIL',error:window.g4bAdmissionBootError}:window.runG4bAdmission(cases),scenarios);
 const report={atUTC:new Date().toISOString(),browser:browser.version(),node:process.version,mainSHA256:sha(path.join(fixture,'assets/main.js')),fixtureSHA256:sha(path.join(fixture,'assets/g4b-admission.js')),rulesSourceHashes:rules.sourceHashes,maximumInvestments:budget,scenarios,...result,pageErrors:errors,platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',phonePerformance:'NOT_TESTED'};writeFileSync(path.join(out,'scene-report.json'),JSON.stringify(report,null,2)+'\n');assert.equal(result.status,'PASS',result.error);assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',checks:result.checks.length,scenarios:scenarios.length,mainSHA256:report.mainSHA256,out}));
}catch(error){if(!result)writeFileSync(path.join(out,'scene-report.json'),JSON.stringify({status:'FAIL',error:String(error),pageErrors:errors},null,2)+'\n');throw error;}finally{await browser?.close();server?.kill();}
