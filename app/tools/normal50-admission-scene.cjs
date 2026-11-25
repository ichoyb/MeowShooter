// Execute the standalone P4 Scene harness. Output is bound to this run only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.NORMAL50_SCENE_DIR||'../.local/checks/normal50-admission-20261105/scene'),port=process.env.NORMAL50_SCENE_PORT||'9016';
if(!out.endsWith(path.normalize('normal50-admission-20261105/scene')))throw Error('Run-specific output required');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),runnerSHA256=sha(__filename),errors=[],parts=[];
const artifact=JSON.parse(fs.readFileSync(path.join(out,'scene-build.json'),'utf8')),inputs=JSON.parse(fs.readFileSync(path.join(out,'scene-inputs.json'),'utf8'));
assert.equal(inputs.status,'PASS');assert.equal(artifact.mainSHA256,'ee7c4c41557d375595e65be2d09f0e3955a6d74297b26afd66f5c599fa434cfa');
assert.equal(sha(path.join(artifact.dist,'assets/main.js')),artifact.mainSHA256);assert.equal(sha(path.join(artifact.dist,'assets/normal50-admission-checks.js')),artifact.checksSHA256);
for(const [file,hash]of Object.entries(artifact.sourceHashes))assert.equal(sha(file),hash,'source changed before Scene: '+file);
let browser,server;
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:artifact.dist,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server exit '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/normal50-admission-checks.html');await page.waitForFunction(()=>window.normal50AdmissionReady||window.normal50AdmissionBootError);
 for(const part of ['witnesses','capacity','lifecycle']){
  const result=await page.evaluate(({inputs,part})=>window.normal50AdmissionBootError?{status:'FAIL',error:window.normal50AdmissionBootError}:window.runNormal50Admission(inputs,part),{inputs,part});parts.push(result);
  assert.equal(result.status,'PASS',result.error);assert(result.checks.length>0);assert(result.checks.every(c=>c.status==='Pass'));assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,part+'.json'),JSON.stringify({atUTC:new Date().toISOString(),browser:browser.version(),artifact,runnerSHA256,...result,pageErrors:errors},null,2)+'\n');console.log('PASS P4 '+part+' '+result.checks.length);
 }
 for(const[file,hash]of Object.entries(artifact.sourceHashes))assert.equal(sha(file),hash,'source changed during Scene: '+file);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'scene-report.json'),JSON.stringify({status:'PASS',atUTC:new Date().toISOString(),browser:browser.version(),node:process.version,artifact,runnerSHA256,inputsSHA256:sha(path.join(out,'scene-inputs.json')),checks:parts.reduce((n,p)=>n+p.checks.length,0),parts:parts.map(p=>({part:p.part,checks:p.checks.length,status:p.status})),scenarios:inputs.scenarios.length,pressureRuns:inputs.scenarios.length*3,witnessRuns:inputs.witnesses.length,pageErrors:errors,scope:'Controlled actual normal50 Arena, fixed RNG legal offered acquisition, real XP/elite transactions, native full-lifetime pressure and lifecycle; NOT natural growth, wall-clock animation or FPS.',platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',phonePerformance:'NOT_TESTED'},null,2)+'\n');console.log('PASS P4 total '+parts.reduce((n,p)=>n+p.checks.length,0));
}catch(error){fs.writeFileSync(path.join(out,'scene-report.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,runnerSHA256,artifact,parts,pageErrors:errors},null,2)+'\n');console.error(error);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
