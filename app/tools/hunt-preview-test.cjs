const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.HUNT_CHECK_DIR||'../.local/checks/hunt-pilot-20261102'),url=process.env.HUNT_PREVIEW_URL||'http://127.0.0.1:8961/hunt-sample.html';
const checks=[],errors=[];let browser;
const check=(name,pass,value)=>{checks.push({name,pass:!!pass,value});assert(pass,name);};
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('stage').dataset.state));
async function boot(p){p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.huntReady||window.huntBootError);assert.equal(await p.evaluate(()=>window.huntBootError),undefined);}
async function start(p,cat='CAT01',preset='relay'){
 await p.selectOption('#cat',cat);await p.selectOption('#scheme',preset);const old=await p.evaluate(()=>window.huntFixture.session&&window.huntFixture.a.growth.snapshot().runId);
 await p.click('#start');await p.waitForFunction(({cat,preset,old})=>{const e=document.getElementById('stage'),s=e.dataset.state&&JSON.parse(e.dataset.state);return e.dataset.cat===cat&&e.dataset.preset===preset&&s?.catId===cat&&s.progression.runId!==old;},{cat,preset,old});return state(p);
}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3])for(const quality of ['standard','low']){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),p=await ctx.newPage();await boot(p);await p.selectOption('#quality',quality);let s=await start(p);
  const label=width+'x'+height+'dpr'+dpr+quality;
  check(label+' original36u and12u body plus explicitly isolated hunt',s.catDisplay.width===36&&s.engine.bodies.cat.radius===12&&s.progression.rulesVersion.endsWith('-hunt-v1')&&s.engine.quality===quality,{cat:s.catId,display:s.catDisplay,body:s.engine.bodies.cat,rules:s.progression.rulesVersion});
  check(label+' original native B courtyard and advisory source budget',s.scenery.visualRevision==='courtyard-continuous-native-v01'&&s.scenery.sourceSize.width===887&&s.scenery.sourceSize.height===1774&&s.scenery.mapCache.persistentRGBAEstimate===0&&s.imageBudget.mode==='advisory',s.scenery);
  const controls=await p.locator('button,select').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};}));check(label+' controls are visible44px without page scroll',controls.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+.5&&r.y+r.h<=height+.5&&r.h>=44),controls);
  await p.waitForFunction(()=>JSON.parse(document.getElementById('stage').dataset.state).huntingMark.targetId!==null);await p.keyboard.down('d');await p.waitForTimeout(140);await p.keyboard.up('d');await p.click('#pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('stage').dataset.state).engine.paused);const before=await state(p);
  check(label+' native movement then clean input at pause',before.player.x>s.player.x&&!before.moveHeld,before.player);
  await p.selectOption('#quality',quality==='low'?'standard':'low');const after=await state(p);check(label+' paused quality preserves camera mark and remaining time',after.engine.paused&&Math.hypot(after.engine.camera.view.x-before.engine.camera.view.x,after.engine.camera.view.y-before.engine.camera.view.y)<1e-5&&after.huntingMark.targetId===before.huntingMark.targetId&&Math.abs(after.huntingMark.remainingSeconds-before.huntingMark.remainingSeconds)<1e-6,{before:before.huntingMark,after:after.huntingMark});
  await p.click('#resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('stage').dataset.state).engine.paused);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForFunction(()=>JSON.parse(document.getElementById('stage').dataset.state).engine.paused);s=await start(p);check(label+' restart clears held input, old marks and counters',!s.moveHeld&&s.elapsed<.5&&s.huntingMark.windows<=1&&s.huntingMark.transfers===0&&s.huntingMark.boostedHits<=1,s.huntingMark);
  if(width===320&&dpr===1&&quality==='standard')await p.screenshot({path:path.join(root,'preview-320.png')});await ctx.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});await boot(p);
 for(const cat of ['CAT01','CAT02','CAT03'])for(const preset of ['baseline','mark','relay','pierce','ricochet','critical',...(cat==='CAT03'?['focus']:[])]){
  let s=await start(p,cat,preset);await p.waitForTimeout(250);s=await state(p);
  check(cat+' '+preset+' exact disclosed ranks and target convention',s.catId===cat&&s.huntingMark.enabled===(preset!=='baseline')&&(preset==='baseline'?s.huntingMark.targetId===null:s.huntingMark.targetId!==null)&&(preset==='critical'?Math.abs(s.projectileTraits.criticalChance-.15)<1e-8&&s.projectileTraits.criticalMultiplier===2.5:true),{ranks:s.progression.ranks,hunt:s.huntingMark,critical:s.projectileTraits.criticalChance});
 }
 for(const cat of ['CAT01','CAT02','CAT03']){
  const first=await start(p,cat,'relay');await p.waitForTimeout(700);await p.screenshot({path:path.join(root,'hunt-'+cat+'.png')});const end=Date.now()+10000;let i=0,peakHits=0,peakWindows=0;
  while(Date.now()<end){const key=['d','s','a','w'][i++%4];await p.keyboard.down(key);await p.waitForTimeout(700);await p.keyboard.up(key);const live=await state(p);peakHits=Math.max(peakHits,live.huntingMark.boostedHits);peakWindows=Math.max(peakWindows,live.huntingMark.windows);if(live.result)break;}
  const s=await state(p);check(cat+' actual native-clock movement, marked hits and ordinary death if caught',s.elapsed>first.elapsed+5&&s.shots>0&&peakWindows>=2&&peakHits>0&&s.projectileDiagnostics.failedSpawns===0,{scope:'CONTROLLED_OPENING_REAL_CLOCK_NOT_NATURAL_GROWTH_OR_PHONE',elapsed:s.elapsed,hp:s.hp,result:s.result,peakWindows,peakHits,mark:s.huntingMark,diagnostics:s.projectileDiagnostics});
 }
 check('sample clearly discloses target HP, preset rewards and no natural growth',await p.locator('section').innerText().then(s=>s.includes('受控开场')&&s.includes('48／180／120／72／96')&&s.includes('不领经验')));
 assert.deepEqual(errors,[]);console.log('PASS hunt clickable preview '+checks.length);
 fs.writeFileSync(path.join(root,'preview-browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),artifact:JSON.parse(fs.readFileSync(path.join(root,'preview-build.json'),'utf8')),checks,errors},null,2)+'\n');
}catch(error){fs.writeFileSync(path.join(root,'preview-browser.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,checks,errors},null,2)+'\n');console.error(error);process.exitCode=1;}finally{await browser?.close();}})();
