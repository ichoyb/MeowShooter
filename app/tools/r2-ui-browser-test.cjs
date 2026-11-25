'use strict';
// Real player entry and existing buttons only. No injected run, XP or unlock state.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),root=path.dirname(app),dist=path.resolve(process.env.R2_DIST||path.join(root,'.local/checks/r2-ui/preview'));
const out=path.resolve(process.env.R2_CHECK_DIR||path.join(root,'.local/checks/r2-ui/browser')),port=Number(process.env.R2_PORT||8930),checks=[],errors=[];
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
const save=status=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status,atUtc:new Date().toISOString(),mainSHA256:sha(fs.readFileSync(path.join(dist,'assets/main.js'))),cssSHA256:sha(fs.readFileSync(path.join(dist,'assets/style.css'))),checks,errors,scope:'DESKTOP_LOCAL_CSP_HARNESS_NOT_PLATFORM_OR_PHONE'},null,2));
async function check(name,fn){try{const observed=await fn();checks.push({name,status:'PASS',observed});save('RUNNING');console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:String(e),stack:e.stack});throw e;}}
async function geometry(p,selector){return p.locator(selector).evaluate(el=>{
 const bad=[];for(const b of el.querySelectorAll('button:not([disabled])')){const r=b.getBoundingClientRect();if(r.width&&r.height&&(r.width<43.9||r.height<43.9))bad.push({text:b.textContent.trim(),w:r.width,h:r.height});}
 const text=[];for(const t of el.querySelectorAll('p,small,.court-stat,.court-badge,.court-notice')){const r=t.getBoundingClientRect();if(r.width&&r.height&&parseFloat(getComputedStyle(t).fontSize)<14)text.push({text:t.textContent.slice(0,70),size:getComputedStyle(t).fontSize});}
 const r=el.getBoundingClientRect(),footer=el.querySelector('footer'),f=footer?.getBoundingClientRect();
 return {badButtons:bad,smallText:text,horizontalOverflow:el.scrollWidth>el.clientWidth+1,rect:{x:r.x,y:r.y,w:r.width,h:r.height},footer:f?{bottom:f.bottom,height:f.height}:null,nestedButtons:el.querySelectorAll('button button').length};
 });}
async function assertGeometry(p,selector){const v=await geometry(p,selector);assert.deepEqual(v.badButtons,[],'all interactive targets at least44 CSSpx');assert.deepEqual(v.smallText,[],'body/key text at least14 CSSpx');assert.equal(v.horizontalOverflow,false);assert.equal(v.nestedButtons,0);if(v.footer)assert(v.footer.bottom<=v.rect.y+v.rect.h+1,'footer reachable');return v;}
async function boot(p){p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');assert.equal(await p.evaluate(()=>typeof window.qaArena),'undefined');}
async function frozen(p){const a=await state(p);await p.waitForTimeout(180);const b=await state(p);assert(a.engine.paused);assert.equal(a.elapsed,b.elapsed);assert.deepEqual(a.player,b.player);return b;}
async function toHome(p){await click(p,'end');await click(p,'confirm-end');assert.match((await ui(p)).page,/PAGE-02/);}
let server,browser;
(async()=>{try{
 server=spawn(process.execPath,[path.join(app,'tools/serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.once('exit',c=>reject(Error('server exit '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),p=await context.newPage();
 await boot(p);
 await check('real draft/cancel/confirm and six source-backed details',async()=>{
  const original=(await ui(p)).committed;await click(p,'select');assert(await p.locator('#pages').evaluate(e=>e.classList.contains('courtyard-ui')));
  await click(p,'choose:CAT02');assert.deepEqual((await ui(p)).committed,original);assert.deepEqual((await ui(p)).draft,{cat:'CAT02',weapon:'W04'});
  await click(p,'detail:W04');assert(await p.locator('#modal').evaluate(e=>e.classList.contains('courtyard-detail')));assert.deepEqual((await ui(p)).draft,{cat:'CAT02',weapon:'W04'});await click(p,'close');
  await click(p,'cancel-select');assert.deepEqual((await ui(p)).committed,original);assert.deepEqual((await ui(p)).draft,original);
  const details=[];
  await click(p,'book');
  for(const cat of ['CAT01','CAT02','CAT03']){
   await click(p,'detail:'+cat);await assertGeometry(p,'#modal .panel');
   details.push({cat,text:await p.locator('#modal-scroll').innerText()});await click(p,'close');
  }
  await click(p,'back');
  for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
   await click(p,'select');await click(p,'choose:'+cat);const draft=(await ui(p)).draft;
   assert.equal(await p.locator('#pages button[data-action^="detail:"]').count(),1);await click(p,'detail:'+weapon);
   const text=await p.locator('#modal-scroll').innerText();assert.match(text,/射程|索敌/);assert.match(text,/装填/);assert.match(text,/弹匣/);assert.doesNotMatch(text,/P2试玩/);assert.deepEqual((await ui(p)).draft,draft);
   details.push({cat,weapon,text});await assertGeometry(p,'#modal .panel');await p.screenshot({path:path.join(out,'detail-'+weapon+'.png')});await click(p,'close');await click(p,'confirm-select');assert.deepEqual((await ui(p)).committed,{cat,weapon});
   await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused===false);const s=await state(p);assert.equal(s.catId,cat);assert.equal(s.weaponId,weapon);assert.equal(s.durationSeconds,600);
   await click(p,'pause');await click(p,'settings');await frozen(p);await click(p,'close');await frozen(p);await toHome(p);
  }
  return {details,pairs:3};
 });
 await check('fifty detail openings and twenty run restarts retain bounded resources',async()=>{
  await click(p,'book');await click(p,'category:武器');await click(p,'detail:W01');await click(p,'close');
  const measure=()=>p.evaluate(()=>{const a=document.getElementById('app'),s=JSON.parse(a.dataset.state);return {source:s.imageBudget,ui:JSON.parse(a.dataset.uiCanvasBudget),nodes:a.querySelectorAll('*').length};});
  const before=await measure();for(let i=0;i<50;i++){await click(p,'detail:W01');await click(p,'close');}const after=await measure();assert.deepEqual(after,before);await click(p,'back');
  await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused===false);await click(p,'pause');const source=(await state(p)).imageBudget;await toHome(p);
  for(let i=0;i<20;i++){await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused===false);await click(p,'pause');const s=await frozen(p);assert.equal(s.moveHeld,false);assert.equal(s.progression.level,1);assert.equal(s.catId,'CAT03');assert.deepEqual(s.imageBudget,source);await toHome(p);}
  return {detailCycles:50,restarts:20,before,after,source};
 });
 await check('book category, scroll, focus and committed loadout survive details',async()=>{
  const before=(await ui(p)).committed;await click(p,'book');await click(p,'category:武器');
  await p.locator('#page-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);const beforeScroll=await p.locator('#page-scroll').evaluate(e=>e.scrollTop);
  await click(p,'detail:W02');await assertGeometry(p,'#modal .panel');await p.keyboard.press('Tab');assert(await p.locator('#modal').evaluate(e=>e.contains(document.activeElement)));await click(p,'close');
  assert.deepEqual((await ui(p)).committed,before);assert(await p.locator('#page-scroll').evaluate((e,s)=>Math.abs(e.scrollTop-s)<2,beforeScroll));assert.equal((await ui(p)).frame,'PAGE-04-S01');
  assert.equal(await p.locator('#pages button[data-action="category:武器"]').getAttribute('aria-pressed'),'true');await click(p,'back');return {beforeScroll,category:'武器'};
 });
 await context.close();
 const sizes=[[320,568],[360,640],[390,844],[430,932]],matrix=process.env.R2_QUICK==='1'?[[390,844,1,'标准']]:[...sizes.flatMap(([w,h])=>[1,2,3].flatMap(dpr=>['标准','低'].map(q=>[w,h,dpr,q]))),[1024,768,1,'标准'],[1440,900,2,'低']];
 for(const [w,h,dpr,quality] of matrix)await check('layout '+[w,h,dpr,quality].join('x'),async()=>{
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr}),page=await ctx.newPage();await boot(page);
  const sourceBefore=(await state(page)).imageBudget;
  if(quality==='低'){await click(page,'settings');await page.locator('#quality').selectOption('低');await click(page,'close');}
  await click(page,'select');const selected=await assertGeometry(page,'#pages');await page.screenshot({path:path.join(out,'select-'+w+'-'+h+'-'+dpr+'-'+quality+'.png')});
  await click(page,'choose:CAT02');await click(page,'detail:W04');const detail=await assertGeometry(page,'#modal .panel');await click(page,'close');await click(page,'cancel-select');await click(page,'book');await click(page,'category:武器');const book=await assertGeometry(page,'#pages');
  await page.screenshot({path:path.join(out,'weapons-'+w+'-'+h+'-'+dpr+'-'+quality+'.png')});const budget=(await state(page)).imageBudget;assert.deepEqual(budget,sourceBefore,'selection and details must not decode additional image sources');await ctx.close();return {selected,detail,book,budget};
 });
 assert.deepEqual(errors,[]);save('PASS');console.log('PASS all '+checks.length+' checks');
 }catch(e){console.error(e);save('FAIL');process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
