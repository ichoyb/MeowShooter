const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.RHYTHM_CHECK_DIR||'../.local/checks/g4-2a-rhythm-20261028'),port=process.env.PREVIEW_PORT||'8907';
const artifact=JSON.parse(fs.readFileSync(path.join(out,'preview-build.json'),'utf8')),checks=[],errors=[];
let browser,server;
async function ready(page){await page.waitForFunction(()=>window.rhythmReady||window.rhythmBootError);assert.equal(await page.evaluate(()=>window.rhythmBootError||null),null);}
async function preset(page,cat,scheme){await page.selectOption('#cat',cat);await page.selectOption('#scheme',scheme);const id=await page.evaluate(()=>window.rhythmFixture.battle.snapshot().progression?.runId);await page.locator('#start').click();await page.waitForFunction(({id,scheme,cat})=>window.rhythmFixture.battle.snapshot().progression?.runId!==id&&document.getElementById('stage').dataset.preset===scheme&&document.getElementById('stage').dataset.cat===cat,{id,scheme,cat});}
const state=page=>page.evaluate(()=>window.rhythmFixture.battle.snapshot());
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:artifact.fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+port+'/rhythm-sample.html');await ready(page);await preset(page,'CAT01','double');
  for(const quality of ['standard','low']){
   await page.selectOption('#quality',quality);await page.waitForFunction(q=>window.rhythmFixture.battle.snapshot().engine.quality===q,quality);
   const sample=await page.evaluate(()=>({state:window.rhythmFixture.battle.snapshot(),overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,controls:Array.from(document.querySelectorAll('button,select')).map(e=>({id:e.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
   assert.equal(sample.overflow,false);assert(sample.controls.every(c=>c.width>=44&&c.height>=44));assert.equal(sample.state.progression.ranks.C23,1);assert.equal(sample.state.projectileTraits.enabled,true);assert.equal(sample.state.projectileDiagnostics.failedSpawns,0);
   checks.push({scope:'VIEWPORT_LAYOUT',viewport:{width,height},dpr,quality,...sample});
   if(width===320&&dpr===1&&quality==='standard')await page.screenshot({path:path.join(out,'rhythm-visible-320.png')});
  }
  await page.locator('#pause').click();const paused=await state(page);await page.waitForTimeout(150);assert.equal((await state(page)).elapsed,paused.elapsed);await page.selectOption('#quality','standard');assert.equal((await state(page)).engine.paused,true);
  await page.locator('#resume').click();await page.waitForFunction(t=>window.rhythmFixture.battle.snapshot().elapsed>t,paused.elapsed);
  await preset(page,'CAT01','staggerTriplet');const restart=await state(page);assert.equal(restart.rhythm.pending,0);assert.equal(restart.rhythm.emitted,0);assert.equal(restart.rhythm.triggers,0);assert.equal(restart.progression.ranks.E21,1);
  checks.push({scope:'PAUSE_RESUME_QUALITY_RESTART',viewport:{width,height},dpr,state:restart});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/rhythm-sample.html');await ready(page);
 const expected={baseline:{},double:{C23:1},stagger:{C23:1,M31:1},triplet:{C23:1,L1_SPLIT:1,E21:1},staggerTriplet:{C23:1,L1_SPLIT:1,E21:1,M31:1},tail:{L1_ECHO:1,L1_LIGHT_MAG:1,C23:1},mixed:{C23:1,L1_SPLIT:1,E21:1,M31:1,M06:1,A11:2,A12:2}};
 for(const cat of ['CAT01','CAT02','CAT03']){
  for(const [scheme,ranks]of Object.entries(expected)){
   await preset(page,cat,scheme);const s=await state(page);for(const [id,rank]of Object.entries(ranks))assert.equal(s.progression.ranks[id],rank);assert.equal(s.progression.totalXP,0);assert.equal(s.progression.offer,null);assert.equal(s.rhythm.pending,0);assert.equal(s.projectileDiagnostics.failedSpawns,0);
   if(scheme==='mixed'){assert.equal(s.projectileTraits.criticalChance,.25);assert.equal(s.projectileTraits.criticalMultiplier,3.5);assert.equal(s.weaponStats.spreadDegrees,cat==='CAT03'?11:2);}
   checks.push({scope:'PRESET_RESTART',cat,scheme,state:s});
  }
  // Without retarget, a dead original target must not suppress the sequence.
  // M31's valid empty-target skip is covered by deterministic Scene checks.
  await preset(page,cat,'triplet');await page.waitForFunction(()=>window.rhythmFixture.battle.snapshot().elapsed>=15,null,{timeout:25000});const s=await state(page);
  assert(s.rhythm.triggers>=1);assert(s.rhythm.emitted>=3);assert.equal(s.projectileDiagnostics.failedSpawns,0);assert.equal(s.progression.totalXP,0);assert(s.hp>0);checks.push({scope:'NATIVE_15_SECONDS_PRESET_NOT_NATURAL_GROWTH',cat,state:s});await page.screenshot({path:path.join(out,'rhythm-native-'+cat+'.png')});
  console.log('PASS preset native15s '+cat+' roots='+s.shots+' triggers='+s.rhythm.triggers+' emitted='+s.rhythm.emitted);
 }
 await page.locator('#pause').click();await page.screenshot({path:path.join(out,'rhythm-preview-390.png')});await context.close();assert.deepEqual(errors,[]);
 const report={status:'PASS',scope:'DESKTOP_LOCAL_PRESET_NOT_PLATFORM_PHONE',atUtc:new Date().toISOString(),browser:browser.version(),artifact,checks,pageErrors:errors};fs.writeFileSync(path.join(out,'rhythm-browser.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+checks.length+' browser cases; 24 viewport/quality cases, 21 preset restarts, native15s x3');
 }catch(error){fs.writeFileSync(path.join(out,'rhythm-browser.json'),JSON.stringify({status:'FAIL',artifact,error:String(error),checks,pageErrors:errors},null,2)+'\n');console.error(error);process.exitCode=1;}
 finally{await browser?.close();server?.kill();}
})();
