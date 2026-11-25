// Synthetic page-transition boundaries in real Chrome; not a mobile/BFCache
// eligibility claim. Real keyboard movement verifies explicit resume afterwards.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const assert=require('node:assert/strict');
const url=process.env.PRESENCE_URL||'http://127.0.0.1:9073/motion.html';
const out=process.env.PRESENCE_CHECK_DIR||'../.local/checks/player-presence-lifecycle';
mkdirSync(out,{recursive:true});
const checks=[],errors=[];
let browser,page;
const check=(name,condition,details)=>{checks.push({name,pass:!!condition,details});assert.ok(condition,name+' '+JSON.stringify(details));};
const state=()=>page.evaluate(()=>window.presence.snapshot());
(async()=>{
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(url);await page.waitForFunction(()=>window.presenceReady||window.presenceError);
  check('boot succeeds',!await page.evaluate(()=>window.presenceError),await page.evaluate(()=>window.presenceError));
  const postCount=await page.evaluate(()=>window.presence.f.a.events.listenerCount('postupdate'));
  await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');
  const active=await state();
  check('real keyboard movement before cached navigation',active.physical.center.x>390&&active.candidate.walkFrames>0,{center:active.physical.center,walkFrames:active.candidate.walkFrames});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  const hidden=await state();
  check('persisted pagehide retains four candidate objects',hidden.candidate.visualObjects===4&&hidden.candidate.active,hidden.candidate);
  check('persisted pagehide retains owned postupdate listener',await page.evaluate(()=>window.presence.f.a.events.listenerCount('postupdate'))===postCount,postCount);
  check('persisted pagehide explicitly pauses scene and candidate',hidden.battle.engine.paused&&hidden.candidate.paused,hidden.candidate);
  check('persisted pagehide restores temporary Session hook',hidden.prototypeRestored,hidden.prototypeRestored);
  await page.waitForTimeout(250);
  const stillHidden=await state();
  check('cached navigation freezes time and native gait',stillHidden.battle.elapsed===hidden.battle.elapsed&&stillHidden.candidate.bodyFrame===hidden.candidate.bodyFrame&&stillHidden.candidate.weaponFrame===hidden.candidate.weaponFrame,{before:hidden.candidate,after:stillHidden.candidate});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForTimeout(150);
  const shown=await state();
  check('persisted pageshow waits for explicit continue',shown.battle.engine.paused&&shown.candidate.paused&&shown.battle.elapsed===hidden.battle.elapsed&&shown.candidate.visualObjects===4,shown.candidate);
  await page.click('#pause');
  // Scene pause/resume operations are processed at the next native game frame.
  // Let their input-reset events finish before sending a new held key.
  await page.waitForFunction(()=>window.presence.f.a.scene.isActive()&&window.presence.f.a.input.keyboard.isActive());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.keyboard.down('a');await page.waitForTimeout(300);await page.keyboard.up('a');
  const resumed=await state();
  check('explicit resume permits real movement and intact native gait',!resumed.battle.engine.paused&&!resumed.candidate.paused&&resumed.physical.center.x<shown.physical.center.x-35&&resumed.candidate.walkFrames>shown.candidate.walkFrames,{before:shown.physical.center,after:resumed.physical.center,candidate:resumed.candidate});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
  const disposed=await state();
  check('non-persisted pagehide destroys candidate once',disposed.candidate.visualObjects===0&&!disposed.candidate.active,disposed.candidate);
  const afterPostCount=await page.evaluate(()=>window.presence.f.a.events.listenerCount('postupdate'));
  check('non-persisted pagehide removes owned postupdate listener',afterPostCount===postCount-1,{before:postCount,after:afterPostCount});
  check('no page errors',errors.length===0,errors);
  const build=JSON.parse(readFileSync(path.join(path.dirname(out),'preview/presence-build.json'),'utf8'));
  const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
  writeFileSync(path.join(out,'report.json'),JSON.stringify({url,browser:await browser.version(),sampleSHA256:build.sampleSHA256,sourceSHA256:sha('tests/fixtures/player-presence-sample.ts'),checkSHA256:sha(__filename),scope:'Synthetic PageTransitionEvent in desktop Chrome; actual navigation BFCache eligibility not tested',checks,errors,notTested:['real back/forward navigation BFCache eligibility','Android','iOS','Xiaohongshu container','Chrome61']},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,report:path.join(out,'report.json')}));
 }catch(error){
  writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,state:page?await state().catch(()=>null):null},null,2)+'\n');throw error;
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
