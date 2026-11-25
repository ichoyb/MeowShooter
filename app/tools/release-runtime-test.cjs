'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const runtimeDpr=Number(process.env.RUNTIME_DPR??1),runtimeQuality=process.env.RUNTIME_QUALITY??'standard';
assert.ok(Number.isFinite(runtimeDpr)&&runtimeDpr>0,'RUNTIME_DPR must be a finite positive number');
assert.ok(['standard','low'].includes(runtimeQuality),'RUNTIME_QUALITY must be standard or low');
const contextOptions={viewport:{width:390,height:844},deviceScaleFactor:runtimeDpr};
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),config=require('./release-test-config.cjs')(root),manifest=config.candidate,dist=config.dist;
config.verify();
const contract=require('./release-profile-contract.cjs')(config);
const out=path.join(config.qa,'runtime-runs',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),runnerSha256=sha(fs.readFileSync(__filename)),checks=[],errors=[],traces={};let browser,server,browserVersion;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
const pairs={CAT01:'W01',CAT02:'W04',CAT03:'W02'},cats=manifest.profile==='playtest'?Object.keys(pairs):['CAT01'];
const resultNames=contract.courtyard?contract.chapterNames:{CAT01:'橘团',CAT02:'雪团',CAT03:'墨团'};
async function selectCat(p,cat){await click(p,'select');await click(p,'choose:'+cat);await click(p,'confirm-select');assert.deepEqual((await ui(p)).committed,{cat,weapon:pairs[cat]});}
async function selectQuality(p){await click(p,'settings');await p.locator('#quality').selectOption(runtimeQuality==='low'?'低':'标准');assert.equal((await ui(p)).settings.quality,runtimeQuality==='low'?'低':'标准');await click(p,'close');}
function assertPresentation(s){assert.equal(s.engine.quality,runtimeQuality);assert.equal(s.engine.dpr,runtimeDpr);assert.equal(s.engine.density,runtimeQuality==='low'?1:Math.min(Math.max(runtimeDpr,1),2));}
async function check(name,fn){try{checks.push({name,status:'PASS',observed:await fn()});}catch(e){checks.push({name,status:'FAIL',error:String(e),stack:e.stack});errors.push({name,error:String(e),stack:e.stack});}save();}
function save(){fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({checks,errors,traces},null,2));}
async function natural(name,chase,cat){const ctx=await browser.newContext(contextOptions),p=await ctx.newPage();p.setDefaultTimeout(5000);try{
 await p.goto('http://127.0.0.1:8798/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await selectQuality(p);await selectCat(p,cat);await click(p,'start');
 if(await p.locator('button[data-action="chapter-skip"]:visible').count())await click(p,'chapter-skip');
 const started=Date.now();let s=await state(p),lastRecord=-1;traces[name]=[];
 assert.equal(s.catId,cat);assert.equal(s.weaponId,pairs[cat]);assertPresentation(s);const run={maxHp:s.maxHp,ammoCapacity:s.ammoCapacity};assert.equal(s.durationSeconds,contract.normalRun(cat).durationSeconds);
 const canvas=await p.locator('#stage canvas').boundingBox(),scale=canvas.width/contract.WORLD_WIDTH;const deadline=(s.durationSeconds+90)*1000;
 if(chase){await p.mouse.move(195,440);await p.mouse.down();await p.waitForTimeout(50);s=await state(p);}
 while(!s.result&&Date.now()-started<deadline){
  if(chase){
   const target=s.targets.filter(t=>t.kind==='enemy').sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
   const dx=target?target.x-s.player.x:0,dy=target?target.y-s.player.y:0,length=Math.hypot(dx,dy),stick=s.moveStick;
   if(stick)await p.mouse.move(canvas.x+stick.x*scale+(length>3?dx/length*32:0),canvas.y+stick.y*scale+(length>3?dy/length*32:0));
  }
  if(s.progression?.offer){const choice=p.locator('button[data-action^="growth-select:"]:visible').first();await choice.click();await p.locator('button[data-action^="growth-confirm:"]:visible').click();}
  const receipt=p.locator('button[data-action^="receipt-skip:"]:visible');if(await receipt.count())await receipt.click();
  const hint=p.locator('button[data-action="dismiss-onboarding"]:visible');if(await hint.count())await hint.click();
  await p.waitForTimeout(chase?80:350);s=await state(p);if(Math.floor(s.elapsed)!==lastRecord){lastRecord=Math.floor(s.elapsed);traces[name].push({elapsed:s.elapsed,hp:s.hp,kills:s.kills,shots:s.shots,ammo:s.ammo,reload:s.reloadLeft,targetKind:s.targetKind,objectsHit:s.objectsHit,player:s.player,passiveState:s.passiveState,sourceCounts:s.sourceCounts,companions:s.companions,enemyStatuses:s.enemyStatuses});save();}
 }
 if(chase)await p.mouse.up();if(chase||!contract.courtyard)assert.equal(s.result,chase?'death':'survived',JSON.stringify(s));else assert.ok(['death','cleared','timeout'].includes(s.result),JSON.stringify(s));
 if(s.result==='cleared'&&await p.locator('button[data-action="chapter-skip"]:visible').count())await click(p,'chapter-skip');
 assertPresentation(s);assert.ok(s.engine.renderFrames.sampleCount>0&&s.engine.renderFrames.intervalCount>0,'Actual Phaser postrender samples must be observed');
 if(!chase&&!contract.courtyard){assert.equal(s.elapsed,s.durationSeconds);assert.ok(Date.now()-started>=(s.durationSeconds-1)*1000,'Natural duration must advance in real wall time');}assert.ok(Date.now()-started>=s.elapsed*1000-1000,'Effective time must be real elapsed time');
 assert.equal((await ui(p)).frame,['survived','cleared'].includes(s.result)?'PAGE-08-S02':'PAGE-08-S03');assert.equal((await ui(p)).source,'actual');assert.equal(s.moveHeld,false);assert.deepEqual((await ui(p)).unlocked,cats);assert.equal((await ui(p)).runLoadout.cat,cat);assert.match(await p.locator('#page-scroll').textContent(),new RegExp(resultNames[cat]));await p.screenshot({path:path.join(out,name+'.png')});
 await p.waitForTimeout(200);assert.equal((await state(p)).shots,s.shots);assert.equal(await p.locator('button[data-action="build"]:visible').count(),contract.courtyard?1:0);if(chase){
  // Snapshot the real restart click synchronously, before the next allowed
  // automatic shot. Playwright's post-click wait may already include a frame.
  const reset=await p.evaluate(()=>{document.querySelector('button[data-action="restart"]').click();return JSON.parse(document.getElementById('app').dataset.state);});
  assertPresentation(reset);assert.ok(reset.shots<=1);assert.ok(reset.elapsed<.1);assert.equal(reset.moveHeld,false);assert.equal(reset.hp,run.maxHp);assert.equal(reset.ammo,run.ammoCapacity-reset.shots);assert.equal(reset.catId,cat);assert.equal(reset.weaponId,pairs[cat]);assert.equal(reset.kills,0);assert.equal(reset.companions,cat==='CAT03'?1:0);assert.equal(reset.sourceCounts.SUMMON,0);assert.equal(reset.passiveState.chillCredit,0);assert.ok(reset.enemyStatuses.every(e=>e.layers===0&&!e.frozen&&!e.protected));
  await p.waitForTimeout(100);assert.equal((await state(p)).moveHeld,false);
 }
 return {catId:cat,weaponId:s.weaponId,rulesVersion:s.rulesVersion,effectiveSeconds:s.elapsed,wallSeconds:(Date.now()-started)/1000,hp:s.hp,kills:s.kills,objectsHit:s.objectsHit,engine:s.engine,actualRenderFrames:s.engine.renderFrames,result:s.result,configuredDurationSeconds:s.durationSeconds,durationReached:s.elapsed>=s.durationSeconds,method:chase?'Real elapsed Phaser; native mouse movement toward existing enemies, no HP/time/spawn mutation':'Real elapsed Phaser; stationary automatic shooting; actual offered upgrade chosen through UI, no HP/time/spawn mutation',balanceConclusion:'NONE'};
}finally{await ctx.close();}}
(async()=>{try{
 for(const f of manifest.sourceFiles)assert.equal(sha(fs.readFileSync(path.join(root,'app',f.file))),f.sha256,'Build/package before runtime checks: '+f.file);
 server=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,PORT:'8798',APP_DIST:dist},stdio:['ignore','pipe','pipe'],windowsHide:true});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});browser=await chromium.launch({channel:'chrome',headless:true});browserVersion=browser.version();
 await Promise.all(cats.flatMap(cat=>[check(cat+' natural death and actual result',()=>natural(cat+'-death',true,cat)),...process.argv.includes('--death-only')?[]:[check(cat+(contract.courtyard?' natural courtyard result (600s cap; death, boss clear or timeout recorded)':' natural 120s survival and actual result'),()=>natural(cat+'-survived',false,cat))]]));
 await check('20 alternating runs reset pooled entities, timers and input without reloading',async()=>{
  const ctx=await browser.newContext(contextOptions),p=await ctx.newPage();const observations=[];
  try{await p.goto('http://127.0.0.1:8798/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await selectQuality(p);await p.evaluate(()=>window.p2DocumentMarker='same');
   for(let i=0;i<20;i++){const cat=cats[i%cats.length];await selectCat(p,cat);const started=await p.evaluate(()=>{document.querySelector('button[data-action="start"]').click();document.querySelector('button[data-action="chapter-skip"]')?.click();return JSON.parse(document.getElementById('app').dataset.state);});await p.waitForTimeout(100);assert.equal(started.catId,cat);assert.equal(started.weaponId,pairs[cat]);assert.equal(started.catTexture,'cat-'+cat);assert.equal(started.moveHeld,false);assert.equal(started.hp,started.maxHp);assert.ok(started.elapsed<1);assert.equal(started.companions,cat==='CAT03'?1:0);assert.equal(started.sourceCounts.SUMMON,0);assert.equal(started.passiveState.chillCredit,0);assert.ok(started.enemyStatuses.every(e=>e.layers===0&&!e.frozen&&!e.protected));assert.ok(started.engine.groups.projectiles.total<=24);await click(p,'pause');await click(p,'end');await click(p,'confirm-end');const ended=await state(p);assert.equal(ended.projectiles,0);assert.equal(ended.engine.timers,0);assert.equal(ended.companions,0);assert.deepEqual(ended.sourceCounts,{PRIMARY:0,SECONDARY:0,SUMMON:0});assert.equal(ended.moveHeld,false);assert.equal(ended.locked,null);assert.equal((await ui(p)).runLoadout,null);observations.push({cat,engine:ended.engine});}
   assert.equal(await p.evaluate(()=>window.p2DocumentMarker),'same');assert.ok(observations.every(o=>o.engine.colliders===observations[0].engine.colliders));for(const o of observations)assertPresentation(o);return observations;
  }finally{await ctx.close();}
 });
 await check('loading failures retain recovery UI',async()=>{for(const file of ['CAT02.webp','main.js']){const ctx=await browser.newContext(contextOptions),p=await ctx.newPage();await p.route('**/'+file,r=>r.abort());await p.goto('http://127.0.0.1:8798/');await p.locator('#error').waitFor({state:'visible'});assert.ok(await p.locator('#retry').isVisible());await ctx.close();}});
 await check('same candidate fingerprint throughout real-time checks',async()=>{for(const f of manifest.files)assert.equal(sha(fs.readFileSync(path.join(dist,f.file))),f.sha256);for(const f of manifest.sourceFiles)assert.equal(sha(fs.readFileSync(path.join(root,'app',f.file))),f.sha256);assert.equal(manifest.sourceFiles.find(f=>f.file==='tools/release-runtime-test.cjs')?.sha256,runnerSha256);return {files:manifest.files.length,sourceFiles:manifest.sourceFiles.length,runnerSha256};});
}catch(e){errors.push({name:'suite',error:String(e)});}finally{if(browser)await browser.close();if(server)server.kill();const screenshots=fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(file=>({file,sha256:sha(fs.readFileSync(path.join(out,file)))}));const report={candidate:config.identity,atUtc:new Date().toISOString(),status:errors.length?'FAIL':'PASS',profile:manifest.profile,artifactKind:config.artifactKind,receipt:config.receipt,zipSha256:config.artifactKind==='archive'?manifest.sha256:null,sourceBaseCommit:manifest.sourceBaseCommit,sourceFiles:manifest.sourceFiles,runnerSha256,browserVersion,runtimeDpr,runtimeQuality,checks,errors,traces,screenshots,environment:'Windows / desktop Chrome; strict local CSP; real elapsed time; Phaser postrender samples; not platform, device or balance result',platform:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',minimumKernel:'NOT_TESTED',phonePerformance:'NOT_TESTED'};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,status:report.status,checks:checks.length,errors}));process.exitCode=errors.length?1:0;}})();
