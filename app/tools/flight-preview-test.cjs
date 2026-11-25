const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.FLIGHT_CHECK_DIR||'../.local/checks/g4-2b-flight-20261028'),url=process.env.FLIGHT_PREVIEW_URL||'http://127.0.0.1:8915/flight-sample.html';
const checks=[],errors=[];let browser;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('stage').dataset.state));
const check=(name,ok,value)=>{checks.push({name,pass:!!ok,value});assert(ok,name);};
const boot=async p=>{p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.flightReady||window.flightBootError);assert.equal(await p.evaluate(()=>window.flightBootError),undefined);};
async function start(p,cat='CAT01',preset='pressure'){
 await p.selectOption('#cat',cat);await p.selectOption('#scheme',preset);const oldRun=await p.evaluate(()=>window.flightFixture.session?window.flightFixture.a.growth.snapshot().runId:null);
 await p.click('#start');await p.waitForFunction(({cat,preset,oldRun})=>{const e=document.getElementById('stage'),s=e.dataset.state&&JSON.parse(e.dataset.state);return e.dataset.cat===cat&&e.dataset.preset===preset&&s?.catId===cat&&s?.projectileFlight.enabled&&!s.engine.paused&&s.progression.runId!==oldRun;},{cat,preset,oldRun});
 return state(p);
}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3])for(const quality of ['standard','low']){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),p=await ctx.newPage();await boot(p);await p.selectOption('#quality',quality);const cat=['CAT01','CAT02','CAT03'][dpr-1],s=await start(p,cat);
  const label=width+'x'+height+'dpr'+dpr+quality;
  check(label+' 36u separate12u and correct review source',s.catDisplay.width===36&&s.engine.bodies.cat.radius===12&&s.progression.rulesVersion.endsWith('-flight-v2')&&s.engine.quality===quality,{cat,display:s.catDisplay,radius:s.engine.bodies.cat.radius});
  check(label+' selected native B courtyard uses production budget mode without raster cache',s.scenery.visualRevision==='courtyard-continuous-native-v01'&&s.scenery.sourceSize.width===887&&s.scenery.sourceSize.height===1774&&s.scenery.mapCache.persistentRGBAEstimate===0&&s.imageBudget.mode==='advisory', {scenery:s.scenery,budget:s.imageBudget});
  const controls=await p.locator('button,select').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.id,x:r.x,y:r.y,w:r.width,h:r.height};}));check(label+' all controls visible and44px high',controls.every(c=>c.x>=0&&c.y>=0&&c.x+c.w<=width+.5&&c.y+c.h<=height+.5&&c.h>=44),controls);
  await p.keyboard.down('d');await p.waitForTimeout(160);await p.keyboard.up('d');await p.click('#pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('stage').dataset.state).engine.paused);const before=await state(p);
  check(label+' actual move then clean pause',before.player.x>s.player.x&&!before.moveHeld,before.player);
  await p.selectOption('#quality',quality==='low'?'standard':'low');await p.waitForTimeout(80);const after=await state(p);check(label+' paused quality keeps camera and player',after.engine.paused&&Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y)<.00005&&Math.hypot(after.engine.camera.view.x-before.engine.camera.view.x,after.engine.camera.view.y-before.engine.camera.view.y)<.00005,{before:{player:before.player,camera:before.engine.camera,css:before.engine.css},after:{player:after.player,camera:after.engine.camera,css:after.engine.css}});
  await p.click('#resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('stage').dataset.state).engine.paused);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForFunction(()=>JSON.parse(document.getElementById('stage').dataset.state).engine.paused);const restart=await start(p,cat);check(label+' restart clears old movement and flight events',!restart.moveHeld&&restart.projectileFlight.returns===0&&restart.projectileFlight.returnHits===0&&restart.projectiles===0,restart.projectileFlight);
  if(width===320&&dpr===1&&quality==='standard')await p.screenshot({path:path.join(out,'preview-320.png')});await ctx.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});await boot(p);
 for(const cat of ['CAT01','CAT02','CAT03'])for(const preset of ['baseline','speed','returning','pierce','line','pressure','fast','bounce']){
  const s=await start(p,cat,preset),r=s.progression.ranks,baseSpeed=cat==='CAT01'?620:cat==='CAT02'?800:550;
  check(cat+' preset '+preset+' applies exactly disclosed ranks',s.catId===cat&&Math.abs(s.weaponStats.bulletSpeed-baseSpeed*(1+.1*(r.A15||0)))<1e-7&&(preset==='pressure'||preset==='fast'?s.weaponStats.pierceDamageMultiplier===.85:true),{ranks:r,weapon:s.weaponStats});
 }
 for(const cat of ['CAT01','CAT02','CAT03']){
  await start(p,cat,'pressure');const first=await state(p);const end=Date.now()+30000;let i=0;
  while(Date.now()<end){const key=['d','s','a','w'][i++%4];await p.keyboard.down(key);await p.waitForTimeout(200);await p.keyboard.up(key);await p.waitForTimeout(100);}
  const s=await state(p);check(cat+' real30second native-clock movement fire and return',s.elapsed>first.elapsed+27&&s.shots>0&&s.projectileFlight.returns>0&&s.projectileDiagnostics.failedSpawns===0,{elapsed:s.elapsed,hp:s.hp,shots:s.shots,returns:s.projectileFlight,diagnostics:s.projectileDiagnostics,scope:'PRESET_REAL_CLOCK_NOT_NATURAL_GROWTH_OR_PHONE_PERFORMANCE'});await p.screenshot({path:path.join(out,'flight-'+cat+'.png')});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'preview-browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),checks,errors},null,2)+'\n');console.log('PASS flight preview '+checks.length);
}catch(error){fs.writeFileSync(path.join(out,'preview-browser.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,checks,errors},null,2)+'\n');console.error(error);process.exitCode=1;}finally{await browser?.close();}})();
