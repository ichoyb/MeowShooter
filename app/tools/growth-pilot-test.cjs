const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.GROWTH_CHECK_DIR||path.join(root,'.local/checks/progression-pilot-20261024'));
const servers=[],errors=[],checks=[];let browser;
async function serve(folder,port){const s=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,APP_DIST:folder,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});servers.push(s);await new Promise((r,j)=>{s.stdout.once('data',r);s.once('error',j);s.once('exit',c=>j(Error('server '+c)));});}
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
async function check(name,fn){const value=await fn();checks.push({name,status:'PASS',value});console.log('PASS '+name);}
async function boot(p,url){p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true'||document.getElementById('app').dataset.loadError);assert.equal(await p.locator('#app').getAttribute('data-load-error'),null);if(await p.locator('[data-action="sound-enable"]').count()){await click(p,'sound-enable');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.audio).ready);}await click(p,'start');}
(async()=>{try{
 await serve(path.join(out,'fixture'),8814);await serve(path.join(root,'app/dist-playtest-0.4.2'),8815);
 browser=await chromium.launch({channel:'chrome',headless:true});
 const scene=await browser.newPage();await scene.goto('http://127.0.0.1:8814/checks.html');await scene.waitForFunction(()=>window.growthSceneReady||window.growthBootError);
 const result=await scene.evaluate(()=>window.growthBootError||window.runGrowthChecks());fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify(result,null,2));assert.equal(result.status,'PASS',JSON.stringify(result));await scene.close();
 for(const [width,height,dpr] of [[320,568],[360,640],[390,844],[430,932]].flatMap(([w,h])=>[1,2,3].map(d=>[w,h,d]))){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:true});const p=await ctx.newPage();await boot(p,'http://127.0.0.1:8814/ui.html');
  await p.evaluate(()=>{window.growthTestArena.growth.random=()=>0;window.growthTestArena.growth.collect(25);});await p.waitForSelector('.growth-choice');
  await check(width+' DPR'+dpr+' real three-choice menu and disabled confirmation',async()=>{assert.equal(await p.locator('.growth-choice').count(),3);assert(await p.locator('.growth-confirm button').isDisabled());const s=await state(p);assert(s.reasons.includes('upgrade'));assert.equal(await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio).musicPlaying),false);return {level:s.progression.level,pending:s.progression.pending};});
  const choice=p.locator('[data-action^="growth-select:"][data-action$="L1_RATE"]');await choice.click();const before=await state(p);assert.equal(before.progression.ranks.L1_RATE,0);
  await click(p,'growth-detail:L1_RATE');assert(await p.getByText('装填时间不变', {exact:false}).count());await click(p,'close');
  await check(width+' DPR'+dpr+' details and settings preserve selected card and freeze battle',async()=>{
   await click(p,'settings');await p.selectOption('#quality','低');await click(p,'close');assert(await p.locator('[data-action$="L1_RATE"].growth-choice').getAttribute('aria-pressed')==='true');
   const s=await state(p);assert.deepEqual(s.progression.offer,before.progression.offer);assert.equal(s.elapsed,before.elapsed);return s.progression.offer;
  });
  await p.keyboard.press('Escape');await click(p,'resume');assert.deepEqual((await state(p)).reasons,['upgrade']);assert.equal(await p.locator('[data-action$="L1_RATE"].growth-choice').getAttribute('aria-pressed'),'true');
  await p.screenshot({path:path.join(out,'upgrade-'+width+'-dpr'+dpr+'.png')});
  await check(width+' DPR'+dpr+' confirmation applies once and requires new selection for queued level',async()=>{
   const action=await p.locator('.growth-confirm button').getAttribute('data-action');await click(p,action);
   assert(await p.locator('.growth-confirm button').isDisabled());const s=await state(p);assert.equal(s.progression.ranks.L1_RATE,1);assert.equal(s.progression.pending,1);assert(s.reasons.includes('upgrade'));return s.progression;
  });
  await check(width+' DPR'+dpr+' background returns to same unresolved menu',async()=>{
   const before=await state(p);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.getByText('等待明确继续',{exact:true}).waitFor();await click(p,'resume');
   assert.deepEqual((await state(p)).progression.offer,before.progression.offer);assert.deepEqual((await state(p)).reasons,['upgrade']);return (await state(p)).reasons;
  });
  await p.locator('[data-action^="growth-select:"][data-action$="L1_DAMAGE"]').click();await p.locator('.growth-confirm button').click();await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).reasons.length===0);
  await check(width+' DPR'+dpr+' stats really apply; pause build and restart reset run',async()=>{
   await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.audio).musicPlaying);const s=await state(p);assert.equal(s.maxHp,90);assert.equal(s.hp,90);assert(Math.abs(s.weaponInterval-.8/1.15)<1e-8);assert(!s.moveHeld);
   await click(p,'pause');await click(p,'build');assert(await p.getByText('轻巧皮筋 已选1次',{exact:true}).count());await click(p,'close');assert((await state(p)).reasons.includes('menu'));
   await click(p,'end');await click(p,'confirm-end');await click(p,'start');const next=await state(p);assert.equal(next.progression.level,1);assert.equal(next.pickups.active,0);assert.equal(next.maxHp,90);assert.equal(next.weaponInterval,.8);return {runId:next.progression.runId,quality:next.engine.quality};
  });await ctx.close();
 }
 // Natural normal-entry run: no injected kills/XP/state, only real keys and buttons.
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await ctx.newPage();await boot(p,'http://127.0.0.1:8815/');let held=[];const deadline=Date.now()+70000;
 while(Date.now()<deadline){const s=await state(p);if(s.progression.offer||s.result)break;const orb=s.pickups.orbs.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];const keys=[];
  if(orb){const dx=orb.x-s.player.x,dy=orb.y-s.player.y;if(Math.abs(dx)>6)keys.push(dx>0?'d':'a');if(Math.abs(dy)>6)keys.push(dy>0?'s':'w');}
  for(const key of held.filter(k=>!keys.includes(k)))await p.keyboard.up(key);for(const key of keys.filter(k=>!held.includes(k)))await p.keyboard.down(key);held=keys;await p.waitForTimeout(100);
 }
 for(const key of held)await p.keyboard.up(key);
 await check('normal player build: real deaths → move to XP → actual level-up',async()=>{const s=await state(p);assert(s.kills>=3);assert(s.progression.offer);assert(s.progression.totalXP>=8);assert.equal(s.progression.totalXP,s.pickups.collectedXP);assert.equal(s.pickups.droppedXP,s.pickups.collectedXP+s.pickups.groundXP);assert.equal(await p.evaluate(()=>typeof window.growthTestArena),'undefined');await p.screenshot({path:path.join(out,'natural-level-up.png')});return s;});
 const available=(await state(p)).progression.offer.choices;
 const naturalChoice=['L1_DAMAGE','L1_RATE','L1_SPLIT','L1_HEART'].find(id=>available.includes(id));assert(naturalChoice);
 await p.locator('[data-action^="growth-select:"][data-action$="'+naturalChoice+'"]').click();await p.locator('.growth-confirm button').click();await p.waitForTimeout(250);await click(p,'pause');await p.screenshot({path:path.join(out,'natural-paused.png')});await ctx.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),checks,pageErrors:errors},null,2));console.log('PASS scene '+result.checks.length+'; browser '+checks.length);
}catch(error){fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,checks,pageErrors:errors},null,2));console.error(error);process.exitCode=1;}finally{await browser?.close();for(const s of servers)s.kill();}})();
