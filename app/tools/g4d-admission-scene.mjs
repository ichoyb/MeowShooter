import {build} from 'esbuild';
import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
if(process.env.BUILD_PROFILE!=='playtest')throw Error('BUILD_PROFILE=playtest required');
const out=path.resolve(process.env.G4D_ADMISSION_DIR||'../.local/checks/g4d-normal-pool-20261104/admission'),fixture=path.join(out,'scene-dist');
const {buildOptions}=await import('./build.mjs');
mkdirSync(fixture,{recursive:true});cpSync(path.dirname(path.dirname(buildOptions.outfile)),fixture,{recursive:true});
await build({...buildOptions,entryPoints:['tools/g4c-admission-scene.ts'],outfile:path.join(fixture,'assets/g4c-admission.js')});
writeFileSync(path.join(fixture,'g4c-admission.html'),'<!doctype html><html><head><meta charset="utf-8"><script defer src="./assets/g4c-admission.js"></script></head><body style="margin:0"><div id="stage" style="position:relative;width:390px;height:844px"></div></body></html>');
const rules=JSON.parse(readFileSync(path.join(out,'rules-report.json'),'utf8'));assert.equal(rules.status,'PASS');
const budget=rules.checks[0].detail.maximumInvestments,capacity=JSON.parse(readFileSync(path.resolve('../.local/checks/g4d-normal-pool-20261104/capacity/capacity-search.json'),'utf8'));assert.equal(capacity.status,'PASS');
const scenarios=[];
for(const row of capacity.rows.filter(r=>r.flight)){
 scenarios.push({id:'maximum-36-observed',cat:row.cat,before:row.maxRanks36});
 const mixed={L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_PICKUP_CHIME:1,C23:1,M31:1,E21:1,L1_PIERCE:1,M05:1,E23:1,M12:1,C15:1,C16:1,E16:1,L1_TRAIL_BELL:1,L1_DUO_TRAIL_CADENCE:1,L1_ORBIT_BELL:3,A07:1,A08:1,A10:1,C12:1,C13:1,E14:1,A16:2,L1_RATE:2,L1_RANGE:1,L1_RELOAD:1};
 scenarios.push({id:'all-native-groups-companions-and-areas',cat:row.cat,crowded:true,before:mixed,after:{...mixed,A15:1}});
 scenarios.push({id:'maximum-47-diagnostic',cat:row.cat,before:row.maxRanks47,diagnostic:true});
}
const R=await import(pathToFileURL(path.join(out,'admission-rules.mjs')));
for(const s of scenarios){s.legalRankPaths=[];for(const ranks of [s.before,s.after].filter(Boolean)){
 assert(Object.values(ranks).reduce((a,b)=>a+b,0)<=(s.diagnostic?47:budget));const actual={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0},base=R.normalCourtyardRunConfig(R.makeRunConfig(s.cat,s.cat==='CAT01'?'W01':s.cat==='CAT02'?'W04':'W02','p2-basic')),route=[];
 while(Object.entries(ranks).some(([id,n])=>(actual[id]||0)<n)){const id=Object.keys(ranks).find(id=>(actual[id]||0)<ranks[id]&&R.growthCardEligible(id,actual,base));assert(id,'Scenario rank path must have actual legal qualifications');actual[id]=(actual[id]||0)+1;route.push(id);}s.legalRankPaths.push(route);
}}
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=process.env.G4D_ADMISSION_PORT||'8998',errors=[];let browser,server,result;
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
try{
 server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,APP_DIST:fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server exit '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/g4c-admission.html');await page.waitForFunction(()=>window.g4cAdmissionReady||window.g4cAdmissionBootError);result=await page.evaluate(cases=>window.g4cAdmissionBootError?{status:'FAIL',error:window.g4cAdmissionBootError}:window.runG4cAdmission(cases),scenarios);
 const report={atUTC:new Date().toISOString(),browser:browser.version(),node:process.version,mainSHA256:sha(path.join(fixture,'assets/main.js')),fixtureSHA256:sha(path.join(fixture,'assets/g4c-admission.js')),rulesSourceHashes:rules.sourceHashes,maximumInvestments:budget,scenarios,...result,pageErrors:errors,platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',phonePerformance:'NOT_TESTED'};assert.equal(result.status,'PASS',result.error);assert.deepEqual(errors,[]);writeFileSync(path.join(out,'scene-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:result.checks.length,scenarios:scenarios.length,mainSHA256:report.mainSHA256,out}));
}catch(error){writeFileSync(path.join(out,'scene-report.json'),JSON.stringify({status:'FAIL',error:String(error),pageErrors:errors,actualSceneResult:result??null},null,2)+'\n');throw error;}finally{await browser?.close();server?.kill();}
