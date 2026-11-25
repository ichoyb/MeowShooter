'use strict';
// Real player entry and input only. Controlled damage/shield/critical proofs
// live in the separate Scene fixture, never in this normal-page observation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app');
const dist=path.resolve(process.env.G5_FEEDBACK_DIST||path.join(root,'.local/checks/g5-feedback-20261105/preview'));
const out=path.resolve(process.env.G5_FEEDBACK_NORMAL_DIR||path.join(root,'.local/checks/g5-feedback-20261105/normal'));
const port=Number(process.env.G5_FEEDBACK_PORT||9032),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mainSHA256=sha(path.join(dist,'assets/main.js')),runnerSHA256=sha(__filename),runs=[],errors=[];let browser,server;
fs.mkdirSync(out,{recursive:true});
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
const save=extra=>fs.writeFileSync(path.join(out,'normal.json'),JSON.stringify({mainSHA256,runnerSHA256,runs,errors,...extra},null,2)+'\n');
async function run(cat){const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),p=await ctx.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(String(e)));const rows=[],choices=[],observed={hurtEdge:false,hpTrail:false,critical:false,ordinary:false,xpPulse:false};let before,held=[];
const keys=async next=>{for(const k of held.filter(k=>!next.includes(k)))await p.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await p.keyboard.down(k);held=next;};
try{
 await p.goto('http://127.0.0.1:'+port+'/?cat='+cat);await p.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true');await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.05);before=await state(p);
 assert.equal(before.catId,cat);assert.equal(before.catDisplay.width,36);assert.equal(before.engine.bodies.cat.radius,12);assert.equal(before.progression.rulesVersion,'courtyard-growth-normal50-v18');assert.equal(before.progression.confirmedPicks,0);assert(Object.values(before.progression.ranks).every(v=>v===0));
 const wall=Date.now();let s=before,wasHP=before.hp,proofHurt=false;
 while(Date.now()-wall<150000){s=await state(p);const f=s.feedback,h=f?.hud;assert(h,'normal page receives native feedback HUD facts');assert(f.active<=8&&f.numbersActive<=8);assert(h.hpTrailRatio>=0&&h.hpTrailRatio<=1);
  const hp=s.hp/s.maxHp;assert(h.hpTrailRatio+1e-5>=hp,'trailing HP must not undercut actual bar');
  if(f.hits>0)observed.ordinary=true;if(f.criticalNumbersTotal>0)observed.critical=true;if(h.hurtEdgeAlpha>0)observed.hurtEdge=true;if(h.hpTrailRatio>hp+.001)observed.hpTrail=true;if(h.xpPulse>0)observed.xpPulse=true;
  if(s.hp<wasHP&&!s.result){if(h.hurtEdgeAlpha>0)await p.screenshot({path:path.join(out,cat+'-hurt.png')});proofHurt=true;}wasHP=s.hp;
  if(!rows.length||s.elapsed-rows.at(-1).elapsed>=.25)rows.push({elapsed:s.elapsed,hp:s.hp,maxHp:s.maxHp,shots:s.shots,kills:s.kills,hud:h,numbers:f.numberDetails,firstEncounter:s.firstEncounter,level:s.progression.level,xp:s.progression.totalXP});
  if(s.result)break;
  if(s.progression.offer){await keys([]);const o=s.progression.offer,id=['L1_HEART','L1_MOVE','L1_DAMAGE','L1_RANGE'].find(id=>o.choices.includes(id))||o.choices[0];await click(p,'growth-select:'+s.progression.runId+'.'+o.id+'.'+id);await p.locator('.growth-confirm button:visible').click();choices.push({id,offer:o,elapsed:s.elapsed});await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).progression.offer);continue;}
  if(proofHurt){const orb=s.pickups.orbs.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];const next=[];if(orb){const dx=orb.x-s.player.x,dy=orb.y-s.player.y;if(dx>6)next.push('d');if(dx<-6)next.push('a');if(dy>6)next.push('s');if(dy<-6)next.push('w');}await keys(next);}
  if(s.elapsed>=45&&proofHurt&&observed.ordinary)break;await p.waitForTimeout(25);
 }
 await keys([]);assert(observed.ordinary&&proofHurt&&observed.hurtEdge&&observed.hpTrail,'normal actual hits and HP feedback witnessed');assert(s.firstEncounter.fullVisibleAt<=5);
 if(!s.result){await click(p,'pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);const paused=await state(p);await p.waitForTimeout(220);const still=await state(p);for(const key of ['elapsed','hp','ammo','reloadLeft','player','progression'])assert.deepEqual(still[key],paused[key],key+' paused');assert.deepEqual(still.feedback.hud,paused.feedback.hud,'native HUD tween freeze');await click(p,'settings');await p.locator('#quality').selectOption('低');await click(p,'close');assert((await state(p)).engine.paused);await click(p,'resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);const after=await state(p);assert.equal(after.feedback.hud.hurtEdgeAlpha,0);assert.equal(after.moveHeld,false);await click(p,'pause');await click(p,'end');await click(p,'confirm-end');}
 else await click(p,'home');
 await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.05);const restart=await state(p);assert.equal(restart.feedback.hits,0);assert.equal(restart.feedback.hurts,0);assert.equal(restart.feedback.numbersActive,0);assert.equal(restart.feedback.hud.hurtEdgeAlpha,0);assert.equal(restart.progression.confirmedPicks,0);assert.equal(restart.moveHeld,false);
 const result={cat,observed,choices,rows,restart:{feedback:restart.feedback,progression:restart.progression,first:restart.firstEncounter},method:'Unseeded normal player entry and real keyboard/button input, real offered confirmation. No Arena/state injection; finite partial encounter, not balance or full10minute acceptance.'};runs.push(result);save({status:'RUNNING'});console.log('PASS normal '+cat+' '+JSON.stringify(observed));
}finally{await keys([]);await ctx.close();}}
(async()=>{try{server=spawn(process.execPath,[path.join(app,'tools/serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});await Promise.all(['CAT01','CAT02','CAT03'].map(run));assert.deepEqual(errors,[]);assert.equal(sha(path.join(dist,'assets/main.js')),mainSHA256);save({status:'PASS',browser:browser.version(),platform:'NOT_TESTED',phone:'NOT_TESTED'});}catch(e){save({status:'FAIL',error:String(e),stack:e.stack});console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
