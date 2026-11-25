'use strict';
// Actual normal builds plus an isolated native Scene fixture; no platform claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app'),version=JSON.parse(fs.readFileSync(path.join(app,'package.json'))).version;
const out=path.join(root,'.local/checks/courtyard-normal-build'),checks=[],errors=[];
fs.mkdirSync(out,{recursive:true});
let browser,server;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,action)=>p.locator('[data-action="'+action+'"]').first().click();
const near=(a,b)=>assert.ok(Math.abs(a-b)<.02,a+' != '+b);
async function startServer(dist){
 if(server){const old=server;await new Promise(resolve=>{old.once('exit',resolve);old.kill();});}
 server=spawn(process.execPath,['tools/serve.mjs'],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:'8872'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server timeout')),5000);server.stdout.once('data',()=>{clearTimeout(timeout);resolve();});server.once('error',reject);});
}
async function check(name,run){try{checks.push({name,status:'PASS',observed:await run()});}catch(error){checks.push({name,status:'FAIL',error:String(error),stack:error.stack});}}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const profile of ['release','review','playtest']){
  const dist=path.join(app,{release:'dist-',review:'dist-review-',playtest:'dist-playtest-'}[profile]+version);
  await startServer(dist);
  for(const [width,height] of [[390,844],[520,568]])for(const dpr of [1,3])for(const quality of ['standard','low']){
   await check(`${profile} ${width}x${height} DPR${dpr} ${quality}`,async()=>{
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:true});
    try{
     const p=await context.newPage();p.on('pageerror',error=>errors.push(String(error)));
     await p.goto('http://127.0.0.1:8872/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');
     await click(p,'settings');await p.locator('#quality').selectOption(quality==='low'?'低':'标准');await click(p,'close');
     await click(p,'start');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);
     const s=await state(p),courtyard=profile==='playtest';
     assert.equal(s.engine.arenaMode,courtyard?'courtyard-preview':'single-screen');assert.equal(s.engine.world.width,courtyard?720:360);
     assert.equal(s.engine.density,quality==='low'?1:Math.min(dpr,2));assert.equal(s.engine.bodies.cat.radius,12);
     if(courtyard){assert.equal(s.engine.world.height,1440);assert.equal(s.presentation.bodyDisplay.width,58);}
     const layout=await p.evaluate(()=>{const a=document.getElementById('app').getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect();return {enabled:document.body.classList.contains('courtyard-preview'),app:a.width,stage:s.width};});
     assert.equal(layout.enabled,courtyard);near(layout.stage,courtyard?layout.app:Math.min(layout.app,height*.72));
     await click(p,'pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);
     const paused=await state(p);await click(p,'settings');await p.locator('#quality').selectOption(quality==='low'?'标准':'低');await click(p,'close');
     const changed=await state(p);
     if(courtyard)assert.deepEqual(changed.engine.camera.view,paused.engine.camera.view);
     else{near(changed.engine.camera.scrollX,paused.engine.camera.scrollX);near(changed.engine.camera.scrollY,paused.engine.camera.scrollY);assert.deepEqual(changed.engine.world,paused.engine.world);}
     assert.deepEqual(changed.player,paused.player);
     await click(p,'resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);
     return {mode:s.engine.arenaMode,world:s.engine.world,layout,quality,density:s.engine.density,catRadius:s.engine.bodies.cat.radius};
    }finally{await context.close();}
   });
  }
 }
 await startServer(path.join(out,'fixture'));
 for(const dpr of [1,1.5,2,3])await check('controlled Scene DPR'+dpr,async()=>{
  const context=await browser.newContext({viewport:{width:1100,height:1050},deviceScaleFactor:dpr});
  try{const p=await context.newPage();p.on('pageerror',error=>errors.push(String(error)));await p.goto('http://127.0.0.1:8872/checks.html');
   await p.locator('#run-checks').waitFor({state:'visible'});await p.waitForFunction(()=>!document.getElementById('run-checks').disabled);await p.locator('#run-checks').click();
   await p.waitForFunction(()=>window.courtyardChecks,{},{timeout:60000});const result=await p.evaluate(()=>window.courtyardChecks);assert.equal(result.status,'PASS',JSON.stringify(result));
   return {count:result.checks.length,checks:result.checks};
  }finally{await context.close();}
 });
}finally{
 if(browser)await browser.close();if(server)server.kill();
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const report={date:'2026-10-20',status:checks.some(c=>c.status==='FAIL')||errors.length?'FAIL':'PASS',checks,errors,sourceState:'UNCOMMITTED',runtimeConfigSha256:sha(path.join(app,'runtime-config.json')),runnerSha256:sha(__filename),scope:'Normal built artifacts and controlled Scene, not platform, device, natural-play or FPS acceptance',platform:'NOT_TESTED',Android:'NOT_TESTED',iOS:'NOT_TESTED'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:checks.length,failures:checks.filter(c=>c.status==='FAIL').map(c=>({name:c.name,error:c.error})),errors,sceneAssertions:checks.filter(c=>c.name.startsWith('controlled')&&c.status==='PASS').reduce((n,c)=>n+c.observed.count,0)}));process.exitCode=report.status==='PASS'?0:1;
}})().catch(error=>{console.error(error);process.exitCode=1;});
