const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.TRAITS_CHECK_DIR||'../.local/checks/g4-2a-traits-20261028'),port=process.env.SCENE_PORT||'8905';
let browser,server;const errors=[],checks=[],artifact=JSON.parse(fs.readFileSync(path.join(out,'traits-build.json'),'utf8'));
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:path.join(out,'fixture'),PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port+'/traits-checks.html');await page.waitForFunction(()=>window.traitsChecksReady||window.traitsChecksBootError);
 const result=await page.evaluate(()=>window.traitsChecksBootError?{status:'FAIL',error:window.traitsChecksBootError}:window.runProjectileTraitsChecks());
 checks.push(result);fs.writeFileSync(path.join(out,'traits-scene.json'),JSON.stringify({browser:browser.version(),artifact,...result,pageErrors:errors},null,2));assert.equal(result.status,'PASS',result.error);console.log('PASS actual Scene '+result.checks.length);
 await page.close();
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:'+port+'/traits-sample.html');await p.waitForFunction(()=>window.traitsReady||window.traitsBootError);
  await p.locator('#start').click();await p.waitForFunction(()=>document.getElementById('stage').dataset.preset==='spread');
  for(const quality of ['standard','low']){
   await p.selectOption('#quality',quality);await p.waitForFunction(q=>window.traitsFixture.battle.snapshot().engine.quality===q,quality);
   const state=await p.evaluate(()=>({state:window.traitsFixture.battle.snapshot(),overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons:Array.from(document.querySelectorAll('button,select')).map(e=>({id:e.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),hud:document.getElementById('hud').textContent}));
   assert.equal(state.overflow,false);assert(state.buttons.every(b=>b.height>=44));assert.equal(state.state.projectileTraits.enabled,true);assert.equal(state.state.weaponStats.spreadDegrees,36);
   checks.push({viewport:{width,height},dpr,quality,...state});
   if(width===390&&dpr===2&&quality==='standard')await p.screenshot({path:path.join(out,'traits-scatter-390-dpr2.png')});
  }
  await p.selectOption('#scheme','focus');await p.locator('#start').click();await p.waitForFunction(()=>document.getElementById('stage').dataset.preset==='focus');
  const focus=await p.evaluate(()=>window.traitsFixture.battle.snapshot());assert.equal(focus.weaponStats.spreadDegrees,9);assert.equal(focus.weaponStats.pellets,5);assert.equal(focus.progression.totalXP,0);
  if(width===390&&dpr===2)await p.screenshot({path:path.join(out,'traits-focus-390-dpr2.png')});
  await p.locator('#pause').click();const before=await p.evaluate(()=>window.traitsFixture.battle.snapshot().elapsed);await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>window.traitsFixture.battle.snapshot().elapsed),before);
  await p.selectOption('#quality','standard');assert.equal(await p.evaluate(()=>window.traitsFixture.battle.snapshot().engine.paused),true);await p.locator('#resume').click();await p.waitForFunction(t=>window.traitsFixture.battle.snapshot().elapsed>t,before);
  await context.close();
 }
 const naturalContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),natural=await naturalContext.newPage();natural.on('pageerror',e=>errors.push(String(e)));
 await natural.goto('http://127.0.0.1:'+port+'/traits-sample.html');await natural.waitForFunction(()=>window.traitsReady||window.traitsBootError);
 for(const cat of ['CAT01','CAT02','CAT03']){
  await natural.selectOption('#cat',cat);await natural.selectOption('#scheme','growth');
  const previous=await natural.evaluate(()=>window.traitsFixture.battle.snapshot().progression?.runId);
  await natural.locator('#start').click();await natural.waitForFunction(id=>window.traitsFixture.battle.snapshot().progression?.runId!==id&&window.traitsFixture.battle.snapshot().projectileTraits.criticalChance===.25,previous);
  await natural.waitForFunction(()=>window.traitsFixture.battle.snapshot().elapsed>=15,null,{timeout:25000});
  const state=await natural.evaluate(()=>window.traitsFixture.battle.snapshot());
  assert(state.shots>0);assert(state.projectileTraits.rolls>0);assert.equal(state.projectileTraits.rolls,state.sourceCounts.PRIMARY);assert.equal(state.progression.totalXP,0);assert.equal(state.progression.offer,null);assert.equal(state.projectileTraits.criticalMultiplier,3.5);assert.equal(state.projectileDiagnostics.failedSpawns,0);
  checks.push({scope:'NATIVE_REAL_TIME_WITH_PRESET_NO_REWARDS',cat,state});
  await natural.screenshot({path:path.join(out,'traits-natural-'+cat+'.png')});
  console.log('PASS native15s '+cat+' shots='+state.shots+' rolls='+state.projectileTraits.rolls+' critHits='+state.projectileTraits.criticalHits);
  await natural.selectOption('#scheme','mixed');await natural.locator('#start').click();await natural.waitForFunction(()=>document.getElementById('stage').dataset.preset==='mixed');
  const mixed=await natural.evaluate(()=>window.traitsFixture.battle.snapshot());assert.equal(mixed.weaponStats.spreadDegrees,cat==='CAT03'?11:2);assert.equal(mixed.projectileTraits.criticalChance,.25);assert.equal(mixed.projectileTraits.criticalMultiplier,3.5);assert.equal(mixed.progression.ranks.L1_SPLIT,1);assert.equal(mixed.progression.ranks.M06,1);
  checks.push({scope:'PRESET_RESTART_MIXED',cat,state:mixed});
  await natural.selectOption('#scheme','legacy');await natural.locator('#start').click();await natural.waitForFunction(()=>document.getElementById('stage').dataset.preset==='legacy');
  const legacy=await natural.evaluate(()=>window.traitsFixture.battle.snapshot());assert.equal(legacy.projectileTraits.enabled,false);assert.equal(legacy.projectileTraits.criticalChance,0);assert.equal(legacy.projectileTraits.criticalMultiplier,1);assert.equal(legacy.progression.ranks.A11,undefined);assert.equal(legacy.progression.ranks.M06,undefined);assert.equal(legacy.weaponStats.spreadDegrees,cat==='CAT03'?36:0);
  checks.push({scope:'PRESET_RESTART_LEGACY',cat,state:legacy});
 }
 await naturalContext.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'traits-browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),artifact,scope:'DESKTOP_BROWSER_VIEWPORT_EMULATION_NOT_PHONE',checks,pageErrors:errors},null,2));console.log('PASS four sizes x three DPR x two qualities; native pause/restart');
}catch(error){fs.writeFileSync(path.join(out,'traits-browser.json'),JSON.stringify({status:'FAIL',artifact,error:String(error),checks,pageErrors:errors},null,2));console.error(error);process.exitCode=1;}
finally{await browser?.close();server?.kill();}})();
