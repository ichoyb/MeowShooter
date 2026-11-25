const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.G5_FEEDBACK_DIR||'../.local/checks/g5-feedback-20261105/green'),port=process.env.G5_FEEDBACK_PORT||'9025';
let browser,server;const errors=[],artifact=JSON.parse(fs.readFileSync(path.join(out,'feedback-build.json'),'utf8'));
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:artifact.fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:'+port+'/feedback-checks.html');await p.waitForFunction(()=>window.g5FeedbackReady||window.g5FeedbackBootError);
 const result=await p.evaluate(()=>window.g5FeedbackBootError?{status:'FAIL',error:window.g5FeedbackBootError}:window.runG5FeedbackChecks());
 fs.writeFileSync(path.join(out,'feedback-scene.json'),JSON.stringify({browser:browser.version(),artifact,...result,pageErrors:errors},null,2));
 fs.writeFileSync(path.join(out,'feedback-isolation.json'),JSON.stringify(await p.evaluate(()=>window.g5FeedbackIsolation),null,2));
 for(const c of result.checks||[])console.log((c.pass?'PASS ':'FAIL ')+c.name+(c.error?' '+c.error:''));assert.deepEqual(errors,[]);assert.equal(result.status,'PASS',result.error);console.log('PASS actual Scene '+result.checks.length);
 const lifecycle=await p.evaluate(()=>window.runG5FeedbackLifecycleChecks());fs.writeFileSync(path.join(out,'feedback-lifecycle.json'),JSON.stringify({artifact,...lifecycle,pageErrors:errors},null,2));assert.equal(lifecycle.status,'PASS');console.log('PASS actual Game dispose '+lifecycle.checks.length);
 await p.close();
 const sampleChecks=[];
 for(const cat of ['CAT01','CAT02','CAT03'])for(const mode of ['normal','critical'])for(const quality of ['standard','low']){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+port+'/feedback-sample.html');await page.waitForFunction(()=>window.g5FeedbackSampleReady||window.g5FeedbackSampleError);
  await page.selectOption('#cat',cat);await page.selectOption('#critical',mode);await page.selectOption('#quality',quality);await page.locator('#shield').check();await page.locator('#start').click();
  await page.waitForFunction(()=>window.g5FeedbackSample.f.battle.snapshot().feedback.contactDetails.length>0);
  const s=await page.evaluate(()=>window.g5FeedbackSample.f.battle.snapshot());assert.equal(s.feedback.enabled,true);assert.equal(s.feedback.quality,quality);assert(s.feedback.contactDetails.some(c=>c.kind===({CAT01:'bell',CAT02:'fish',CAT03:'bone'}[cat])));assert.equal(s.feedback.numberDetails.some(n=>n.critical),mode==='critical');
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons:Array.from(document.querySelectorAll('button,select')).map(n=>({id:n.id,h:n.getBoundingClientRect().height})),edge: getComputedStyle(document.getElementById('battle-hurt-edge')).pointerEvents}));assert.equal(layout.overflow,false);assert(layout.buttons.every(b=>b.h>=44));assert.equal(layout.edge,'none');
  if(quality==='standard')await page.screenshot({path:path.join(out,'sample-'+cat+'-'+mode+'.png')});
  await page.locator('#pause').click();const elapsed=await page.evaluate(()=>window.g5FeedbackSample.f.battle.snapshot().elapsed);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.g5FeedbackSample.f.battle.snapshot().elapsed),elapsed);await page.locator('#resume').click();await page.waitForFunction(t=>window.g5FeedbackSample.f.battle.snapshot().elapsed>t,elapsed);
  await page.locator('#absorb').click();let fact=await page.evaluate(()=>window.g5FeedbackSample.f.battle.snapshot().defense.lastHit);assert.equal(fact.hpLost,0);assert(fact.shieldAbsorbed>0);await page.locator('#break').click();fact=await page.evaluate(()=>window.g5FeedbackSample.f.battle.snapshot().defense.lastHit);assert(fact.shieldBroke&&fact.hpLost>0);
  await page.locator('#xp').click();await page.waitForFunction(()=>window.g5FeedbackSample.f.battle.snapshot().pickups.collectedXP>0);sampleChecks.push({cat,mode,quality,layout,firstContact:s.feedback.contactDetails,shieldBreakFact:fact,mainSHA256:artifact.normalMainSHA256});await page.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'feedback-sample.json'),JSON.stringify({status:'PASS',scope:'CONTROLLED_NATIVE_REALTIME_SAMPLE_NOT_NORMAL_BALANCE',artifact,checks:sampleChecks,pageErrors:errors},null,2));console.log('PASS real-time sample '+sampleChecks.length);
 const layoutChecks=[];
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+port+'/feedback-sample.html');await page.waitForFunction(()=>window.g5FeedbackSampleReady);await page.locator('#start').click();
  for(const quality of ['standard','low']){
   await page.selectOption('#quality',quality);const value=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,stage:document.getElementById('stage').getBoundingClientRect().height,buttons:Array.from(document.querySelectorAll('button,select')).map(e=>({id:e.id,h:e.getBoundingClientRect().height})),engine:window.g5FeedbackSample.f.battle.snapshot().engine}));
   assert.equal(value.overflow,false);assert(value.stage>=90);assert(value.buttons.every(b=>b.h>=44));assert.equal(value.engine.quality,quality);layoutChecks.push({width,height,dpr,quality,...value});
  }await page.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'feedback-sample-layout.json'),JSON.stringify({status:'PASS',artifact,checks:layoutChecks,pageErrors:errors},null,2));console.log('PASS sample viewport/DPR/quality '+layoutChecks.length);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
