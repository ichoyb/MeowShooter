'use strict';
// Normal player entry, real effective time and input. No Arena access, seed,
// HP, XP, spawn, rank or clock mutation. Separate from controlled Scene checks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app');
const dist=path.resolve(process.env.G5_DIST||path.join(root,'.local/checks/g5-opening-20261105/preview'));
const out=path.resolve(process.env.G5_CHECK_DIR||path.join(root,'.local/checks/g5-opening-20261105/browser'));
const port=Number(process.env.G5_PORT||9023),repeats=Number(process.env.G5_REPEATS||5);
const inputVariant=process.env.G5_INPUT_VARIANT||'stationary',dpr=Number(process.env.G5_DPR||3),quality=process.env.G5_QUALITY||'standard';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mainSHA256=sha(path.join(dist,'assets/main.js')),checks=[],errors=[];let browser,server;
fs.mkdirSync(out,{recursive:true});
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
const save=extra=>fs.writeFileSync(path.join(out,'opening.json'),JSON.stringify({mainSHA256,runnerSHA256:sha(__filename),checks,errors,...extra},null,2)+'\n');
async function boot(p,cat){p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+port+'/?cat='+cat);await p.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true');await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.05);}
async function runOpening(cat,viewport,repeat){const context=await browser.newContext({viewport,deviceScaleFactor:dpr}),p=await context.newPage();try{
 await boot(p,cat);let s=await state(p),first=s.firstEncounter;assert(first,'first enemy must be born and identified on first effective frame');
 assert.equal(s.catId,cat);assert.equal(s.catDisplay.width,36);assert.equal(s.engine.bodies.cat.radius,12);
 assert.equal(s.progression.rulesVersion,'courtyard-growth-normal50-v18');assert.equal(s.progression.confirmedPicks,0);
 assert(s.onboarding.hint);assert(!/盾0\/0|甲0%/.test(await p.locator('#ammo').innerText()));
 assert(first.bornAt<.15,'first effective frame birth');assert.equal(first.enemyId,'E01');
 assert(first.birth.x===-48||first.birth.x===768);assert.equal(first.birth.y,720);
 if(quality==='low'){await click(p,'pause');await click(p,'settings');await p.locator('#quality').selectOption('低');await click(p,'close');await click(p,'resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);assert.equal((await state(p)).engine.quality,'low');}
 let shortTravel=0;if(inputVariant==='short'){const from=(await state(p)).player;await p.keyboard.press('d',{delay:40});const to=(await state(p)).player;shortTravel=Math.hypot(to.x-from.x,to.y-from.y);assert(shortTravel>0&&shortTravel<=24,'actual short-movement setup must stay within24u');}
 const observations=[];const wall=Date.now();
 while(Date.now()-wall<15000){s=await state(p);first=s.firstEncounter;
  observations.push({elapsed:s.elapsed,eligible:first.eligible,visible:first.fullVisibleAt,shots:s.shots,hint:s.onboarding.hint?.kind});
  if(first.fullVisibleAt!==null)break;
  assert.equal(first.eligible,false);assert.equal(first.firstPrimaryShotAt,null);assert.equal(first.firstSpiritShotAt,null);
  assert(s.elapsed<5.2,'first actor did not enter by5s');await p.waitForTimeout(45);
 }
 assert(first.fullVisibleAt!==null,'first actor must enter');assert(first.fullVisibleAt<=5,'full sprite5s contract');assert(first.eligible);
 const v=s.engine.camera.view,b=first.artBounds;assert(b,'actual art bounds recorded');
 assert(b.x>=v.x-.1&&b.y>=v.y-.1&&b.x+b.width<=v.x+v.width+.1&&b.y+b.height<=v.y+v.height+.1,'actual full art inside Camera');
 const hud=await p.locator('#hud').boundingBox(),stage=await p.locator('#stage').boundingBox();
 const top=stage.y+(b.y-v.y)/v.height*stage.height;
 assert(top>=hud.y+hud.height,'first actor clear of HUD');
 if(repeat===0)await p.screenshot({path:path.join(out,cat+'-'+viewport.width+'-first.png')});
 const result={cat,viewport,dpr,quality,inputVariant,shortTravel,repeat,firstEncounter:first,observations,elapsed:s.elapsed};
 checks.push({name:cat+' '+viewport.width+'x'+viewport.height+' opening '+(repeat+1),status:'PASS',...result});save({status:'RUNNING'});
 console.log('PASS '+cat+' '+viewport.width+' #'+(repeat+1)+' fullVisible='+first.fullVisibleAt.toFixed(3));
}finally{await context.close();}}
(async()=>{try{
 server=spawn(process.execPath,[path.join(app,'tools/serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('serve timeout')),6000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('error',reject);});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const tasks=[];for(const cat of ['CAT01','CAT02','CAT03'])for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:430,height:932}])for(let r=0;r<repeats;r++)tasks.push(()=>runOpening(cat,viewport,r));
 // Bounded browser concurrency; no game-time acceleration or render pausing.
 let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<tasks.length){const i=cursor++;await tasks[i]();}}));
 assert.deepEqual(errors,[]);assert.equal(sha(path.join(dist,'assets/main.js')),mainSHA256);
 save({status:'PASS',browser:browser.version(),environment:'Desktop real-time normal player entry',method:'Threecats x fourCSSsizes x '+repeats+' fresh unseeded sessions, DPR'+dpr+' quality='+quality+' input='+inputVariant+'. Other combinations recorded separately.',platform:'NOT_TESTED',phone:'NOT_TESTED'});
}catch(e){save({status:'FAIL',error:String(e),stack:e.stack});console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
