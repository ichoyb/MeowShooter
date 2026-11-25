'use strict';
// Real UI/input/lifecycle only. Tutorial state is read, never assigned.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app'),dist=path.resolve(process.env.G5_DIST||path.join(root,'.local/checks/g5-opening-20261105/preview'));
const out=path.resolve(process.env.G5_FLOW_DIR||path.join(root,'.local/checks/g5-opening-20261105/flows')),port=Number(process.env.G5_PORT||9024);
fs.mkdirSync(out,{recursive:true});const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mainSHA256=sha(path.join(dist,'assets/main.js')),checks=[],errors=[];let browser,server;
const s=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
const save=extra=>fs.writeFileSync(path.join(out,'flows.json'),JSON.stringify({mainSHA256,runnerSHA256:sha(__filename),checks,errors,...extra},null,2)+'\n');
async function record(name,fn){const observed=await fn();checks.push({name,status:'PASS',observed});save({status:'RUNNING'});console.log('PASS '+name);}
async function boot(p){p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true');await click(p,'start');}
async function pause(p){await click(p,'pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);}
async function resume(p){await click(p,'resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);}
async function returnHome(p){await pause(p);await click(p,'end');await click(p,'confirm-end');}
(async()=>{try{
 server=spawn(process.execPath,[path.join(app,'tools/serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),p=await c.newPage();await boot(p);
 await record('real mouse drag completes movement hint and release stops',async()=>{
  const before=await s(p);assert.equal(before.onboarding.hint.kind,'move');await p.screenshot({path:path.join(out,'opening-hint.png')});
  const layout=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.layout)),stage=await p.locator('#stage').boundingBox();
  const x=stage.x+stage.width*.5,y=stage.y+layout.touchArea.bottom-70;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+42,y,{steps:4});await p.waitForTimeout(160);await p.mouse.up();await p.waitForTimeout(100);
  const after=await s(p);assert(after.onboarding.completed.move);assert(after.onboarding.travel>=12);assert.equal(after.moveHeld,false);
  await p.waitForTimeout(130);const stopped=await s(p);assert(Math.hypot(stopped.player.x-after.player.x,stopped.player.y-after.player.y)<.1);return {before:before.onboarding,after:after.onboarding};
 });
 await record('pause/settings and explicit resume do not replay stale hints',async()=>{
  await pause(p);const before=await s(p);assert.equal(before.onboarding.hint,null);await p.waitForTimeout(350);const paused=await s(p);assert.equal(paused.elapsed,before.elapsed);
  await click(p,'settings');await p.locator('#quality').selectOption('低');await click(p,'close');assert((await ui(p)).frame.startsWith('LAYER-02'));assert((await s(p)).engine.paused);
  await resume(p);const after=await s(p);assert(after.onboarding.completed.move);assert.notEqual(after.onboarding.hint?.kind,'move');assert.equal(after.moveHeld,false);return {before:before.onboarding,after:after.onboarding};
 });
 await record('twenty same-session new runs preserve completed tutorial and clear first-encounter/input state',async()=>{
  const timeOrigin=await p.evaluate(()=>performance.timeOrigin),rows=[];
  for(let i=0;i<20;i++){await returnHome(p);await click(p,'start');await p.waitForFunction(()=>!!JSON.parse(document.getElementById('app').dataset.state).firstEncounter);const v=await s(p);
   assert.equal(v.moveHeld,false);assert(v.onboarding.completed.move);assert.notEqual(v.onboarding.hint?.kind,'move');assert(v.firstEncounter.bornAt<.15);assert.equal(v.firstEncounter.fullVisibleAt,null);assert.equal(v.firstEncounter.firstPrimaryShotAt,null);assert.equal(v.progression.confirmedPicks,0);rows.push({i,elapsed:v.elapsed,first:v.firstEncounter,onboarding:v.onboarding,timers:v.engine.timers});
  }assert.equal(await p.evaluate(()=>performance.timeOrigin),timeOrigin);return rows;
 });
 await c.close();assert.deepEqual(errors,[]);save({status:'PASS',browser:browser.version(),environment:'Desktop Chrome normal entry, real mouse/buttons; no battle mutation',platform:'NOT_TESTED',phone:'NOT_TESTED'});
}catch(e){save({status:'FAIL',error:String(e),stack:e.stack});console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
