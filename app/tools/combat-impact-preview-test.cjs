'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.env.IMPACT_DIR||'../.local/checks/combat-impact-pilot-20261112/preview');
const url=process.env.IMPACT_URL||'http://127.0.0.1:9051/.local/checks/combat-impact-pilot-20261112/preview/';
const out=path.resolve(process.env.IMPACT_QA_OUT||'../.local/checks/combat-impact-pilot-20261112/qa-'+Date.now());
fs.mkdirSync(out,{recursive:true});
const build=JSON.parse(fs.readFileSync(path.join(dir,'impact-build.json'),'utf8'));
const r={status:'RUNNING',url,build,runnerSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),checks:[],errors:[],notTested:['Platform','Android','iOS','Chrome61','Natural ten-minute run','Phone performance']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2)+'\n');
async function check(name,fn){try{const detail=await fn();r.checks.push({name,status:'PASS',detail});console.log('PASS '+name);save();}catch(e){r.checks.push({name,status:'FAIL',error:e.stack});save();throw e;}}
async function open(browser,viewport={width:390,height:844}){
 const p=await browser.newPage({viewport,deviceScaleFactor:2});p.on('pageerror',e=>r.errors.push(String(e)));
 p.on('response',res=>{if(res.status()>=400)r.errors.push(res.status()+' '+res.url());});
 const [js]=await Promise.all([p.waitForResponse(res=>res.url().endsWith('/assets/combat-impact-sample.js')),p.goto(url)]);
 assert.equal(crypto.createHash('sha256').update(await js.body()).digest('hex'),build.fixtureSHA256);
 await p.waitForFunction(()=>window.impactSampleReady||window.impactSampleError);assert.equal(await p.evaluate(()=>window.impactSampleError),undefined);return p;
}
async function fresh(p,cat='CAT01',scenario='plain',mode='strong',quality='standard',reduce=false){
 return p.evaluate(async({cat,scenario,mode,quality,reduce})=>{
  const x=window.impactSample;x.uncontrolled();document.querySelector('#cat').value=cat;document.querySelector('#mode').value=mode;document.querySelector('#quality').value=quality;document.querySelector('#reduce').checked=reduce;
  x.f.a.fireVolley=Object.getPrototypeOf(x.f.a).fireVolley;
  await x.start(scenario);x.controlled();x.f.a.fireVolley=()=>{};
  for(const s of x.f.a.projectiles.getChildren())if(s.active)x.f.a.recycle(s,x.f.a.projectiles);
  return x.snapshot();
 },{cat,scenario,mode,quality,reduce});
}
async function actualHit(p,critical=false,source='PRIMARY',enemyId='E01'){
 return p.evaluate(({critical,source,enemyId})=>{
  const x=window.impactSample,{a}=x.f;const e=a.placeSliceEnemy(enemyId,430,720);e.body.moves=false;e.setData('hp',10000);a.syncEnemyArt();x.impact.prepare(x.enemyParts(e));
  a.projectileRandom.frac=()=>critical?0:.99;const weapon=x.f.session.effectiveConfig.weapon,id=x.f.session.runConfig.weaponId;
  a.projectile({x:360,y:720},0,id==='W04'?'fish':id==='W02'?'bone':'bell',source,901,weapon.damage,weapon.extraPierce,weapon.bulletSpeed,weapon.bulletLifeSeconds);
  const shot=a.projectiles.getChildren().filter(s=>s.active).at(-1);const hpBefore=e.getData('hp');a.hit(shot,e,'overlap');const hit=e.getData('hp')<hpBefore;x.step(2);
  const s=x.snapshot();return {hit,impact:s.impact,feedback:s.battle.feedback,physical:{x:e.body.center.x,y:e.body.center.y},root:{x:e.getData('art').root.x,y:e.getData('art').root.y}};
 },{critical,source,enemyId});
}
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});r.browser=browser.version();
 const p=await open(browser);
 await check('original comparison preserves legacy contact curve and disables adopted route',async()=>{
  await fresh(p,'CAT01','plain','original');await actualHit(p,false);
  const detail=await p.evaluate(()=>{const x=window.impactSample,a=x.f.a;
   const effect=a.feedback.effects.getChildren().find(s=>s.active&&s.getData('effect')==='contact');
   const data=a.tweens.getTweensOf(effect)[0]?.data.find(d=>d.key==='alpha');
   return {runtimeEnabled:a.impact.snapshot().enabled,pilotEnabled:x.impact.snapshot().enabled,refined:a.feedback.refinedContacts,easeAt60ms:data?.ease(60/160)};
  });
  assert.equal(detail.runtimeEnabled,false);assert.equal(detail.pilotEnabled,false);assert.equal(detail.refined,false);assert.equal(detail.easeAt60ms,.609375);return detail;
 });
 for(const cat of ['CAT01','CAT02','CAT03']){
  for(const scenario of ['plain','absorb','break','overflow'])await check(cat+' real incoming '+scenario,async()=>{
   const before=await fresh(p,cat,scenario);assert.equal(before.battle.catDisplay.width,36);assert.equal(before.battle.engine.bodies.cat.radius,12);assert(before.battle.g6Art);
   const result=await p.evaluate(scenario=>{const x=window.impactSample,d=x.f.session.defenseSnapshot(),fact=x.f.a.incomingEnemyDamage(scenario==='plain'?10:scenario==='absorb'?4:scenario==='break'?d.shield:d.shield+10);x.step(2);return {fact,...x.snapshot()};},scenario);
   assert.equal(result.fact.accepted,true);assert.equal(result.fact.hpLost>0,scenario==='plain'||scenario==='overflow');assert.equal(result.impact.playerActive>0,result.fact.hpLost>0);
   assert.equal(result.fact.shieldBroke,scenario==='break'||scenario==='overflow');assert.equal(result.battle.hp,before.battle.hp-result.fact.hpLost);
   if(scenario==='break'||scenario==='overflow')assert.equal(result.battle.g6Art.rewards.shieldBreaks,1);
   assert.equal(result.impact.unpreparedPartsSkipped,0);
   if(scenario==='plain'||scenario==='overflow')await p.screenshot({path:path.join(out,`${cat}-${scenario}.png`)});
   await p.evaluate(()=>window.impactSample.step(12));assert.equal(await p.evaluate(()=>window.impactSample.impact.snapshot().playerActive),0);
   return {fact:result.fact,impact:result.impact};
  });
  for(const critical of [false,true])await check(cat+' actual '+(critical?'critical':'ordinary')+' projectile',async()=>{
   await fresh(p,cat);const hit=await actualHit(p,critical);assert(hit.hit);assert(hit.impact.targetActive>0);assert.equal(hit.feedback.contactDetails.at(-1).critical,critical);
   assert.equal(hit.feedback.numberDetails.some(n=>n.critical),critical);assert.equal(hit.physical.x,430);assert(Math.abs(hit.root.x-hit.physical.x)<=1);
   await p.screenshot({path:path.join(out,`${cat}-${critical?'critical':'ordinary'}.png`)});return hit;
  });
  await check(cat+' moving damage preserves real animation and hitbox',async()=>{
   await fresh(p,cat);await p.evaluate(()=>{const x=window.impactSample;x.f.a.fireVolley=Object.getPrototypeOf(x.f.a).fireVolley;});await p.keyboard.down('d');await p.evaluate(()=>window.impactSample.step(10));await p.keyboard.up('d');
   const result=await p.evaluate(()=>{const x=window.impactSample,before=x.f.battle.snapshot();const fact=x.f.a.incomingEnemyDamage(10);x.step(2);const after=x.f.battle.snapshot();
    return {before:{player:before.player,body:before.engine.bodies.cat,art:before.g6Art,shots:before.shots},after:{player:after.player,body:after.engine.bodies.cat,art:after.g6Art,shots:after.shots},fact,impact:x.impact.snapshot(),parts:x.playerParts().map(s=>({visible:s.visible,frame:s.frame.name,display:{w:s.displayWidth,h:s.displayHeight}}))};});
   assert(result.before.player.x>360);assert.equal(result.after.body.radius,12);assert(result.impact.playerActive>0);assert(result.after.shots>0);
   const motion=cat==='CAT01'?result.before.art.cat:result.before.art.held;assert.equal(motion.motion,'walk');return result;
  });
 }
 for(const mode of ['original','soft','strong'])for(const quality of ['standard','low'])for(const reduce of [false,true])await check(mode+'/'+quality+'/reduce='+reduce,async()=>{
  await fresh(p,'CAT01','plain',mode,quality,reduce);const value=await p.evaluate(()=>{const x=window.impactSample,fact=x.f.a.incomingEnemyDamage(10);x.step(2);return {fact,impact:x.impact.snapshot(),alpha:x.f.a.children.list.filter(o=>o.getData?.('impact-source')).map(o=>o.alpha)};});
  assert.equal(value.fact.hpLost,10);assert.equal(value.impact.playerActive>0,mode!=='original');
  if(quality==='low'||reduce)assert(value.alpha.every(a=>a<=.160001));return value;
 });
 for(const enemy of ['E01','E03','E04','EL01','B01'])await check('native target Container '+enemy,async()=>{
  await fresh(p);const hit=await actualHit(p,true,'PRIMARY',enemy);assert(hit.hit&&hit.impact.targetActive>0);assert.equal(hit.impact.unpreparedPartsSkipped,0);return {impact:hit.impact,physical:hit.physical,root:hit.root};
 });
 for(const source of ['SECONDARY','SUMMON'])await check('actual '+source+' stays noncritical',async()=>{
  await fresh(p);const hit=await actualHit(p,true,source);assert(hit.hit);assert(hit.feedback.numberDetails.every(n=>!n.critical));assert(hit.feedback.contactDetails.every(n=>n.kind==='neutral'||source==='SECONDARY'&&n.kind==='bell'));return {source,feedback:hit.feedback,impact:hit.impact};
 });
 await check('native enemy projectile collision triggers real HP flash',async()=>{
  await fresh(p);const v=await p.evaluate(()=>{const x=window.impactSample,before=x.f.battle.snapshot();x.f.a.enemyBubble(before.player,{x:0,y:0},{size:12,radius:4,speed:0,life:2.5,damage:10});x.step(2);return {beforeHP:before.hp,...x.snapshot()};});
  assert.equal(v.battle.hp,v.beforeHP-10);assert(v.impact.playerActive>0);return {hpLost:v.beforeHP-v.battle.hp,impact:v.impact};
 });
 for(const cat of ['CAT01','CAT02','CAT03'])await check(cat+' presentation off/on rule equality',async()=>{
  const values=[];for(const mode of ['original','strong']){
   await fresh(p,cat,'overflow',mode);await actualHit(p,true);const v=await p.evaluate(()=>{const x=window.impactSample,before=x.f.battle.snapshot();const fact=x.f.a.incomingEnemyDamage(40);x.step(12);const s=x.f.battle.snapshot();return {hp:s.hp,shield:s.defense.shield,ammo:s.ammo,shots:s.shots-before.shots,sourceCounts:s.sourceCounts,criticalHits:s.projectileTraits.criticalHits,passive:s.passiveState,enemies:s.enemyBehaviors.map(e=>({id:e.enemyId,hp:e.hp})),positions:s.engine.bodies.enemies.map(e=>e.center),xp:s.progression.totalXP,picks:s.progression.confirmedPicks,result:s.result,fact};});values.push(v);
  }assert.deepEqual(values[0],values[1]);return values;
 });
 await check('in-place comparison and quality switch keep paused run/camera',async()=>{
  await fresh(p);const v=await p.evaluate(()=>{const x=window.impactSample;x.f.a.incomingEnemyDamage(10);x.step(2);x.f.battle.pause('menu');x.step(1);const before=x.f.battle.snapshot();document.querySelector('#mode').value='original';document.querySelector('#quality').value='low';x.configure();const after=x.f.battle.snapshot();return {before:{hp:before.hp,player:before.player,run:before.progression.runId,elapsed:before.elapsed,camera:before.engine.camera.view},after:{hp:after.hp,player:after.player,run:after.progression.runId,elapsed:after.elapsed,camera:after.engine.camera.view},impact:x.impact.snapshot()};});
  assert.deepEqual(v.before,v.after);assert.equal(v.impact.playerActive,0);return v;
 });
 await check('zero, pause rejection, resume clear and death clear',async()=>{
  await fresh(p);const zero=await p.evaluate(()=>{const x=window.impactSample;return {fact:x.f.a.incomingEnemyDamage(0),impact:x.impact.snapshot()};});assert.equal(zero.impact.playerActive,0);
  const paused=await p.evaluate(()=>{const x=window.impactSample;x.f.a.incomingEnemyDamage(10);x.step(2);x.f.battle.pause('menu');x.step(1);return {fact:x.f.a.incomingEnemyDamage(10),snapshot:x.snapshot()};});assert.equal(paused.fact.accepted,false);assert.equal(paused.snapshot.impact.playerActive,0);assert.equal(paused.snapshot.battle.feedback.active,0);assert.equal(paused.snapshot.battle.feedback.numbersActive,0);assert.equal(paused.snapshot.battle.feedback.hurtVisible,false);
  await p.evaluate(()=>{const x=window.impactSample;x.f.battle.resume();x.step(12);});assert.equal(await p.evaluate(()=>window.impactSample.impact.snapshot().playerActive),0);
  await fresh(p);const dead=await p.evaluate(()=>{const x=window.impactSample;x.f.a.incomingEnemyDamage(10000);x.step(2);return x.snapshot();});assert(dead.battle.result);assert.equal(dead.impact.playerActive,0);return {zero:zero.fact,rejected:paused.fact,result:dead.battle.result};
 });
 await check('twenty restarts bound caches, overlays and no old pulse',async()=>{
  const values=[];for(let i=0;i<20;i++){await fresh(p,'CAT01');await actualHit(p);const v=await p.evaluate(()=>{const x=window.impactSample;x.f.a.incomingEnemyDamage(10);x.step(12);const s=x.f.battle.snapshot();return {impact:x.impact.snapshot(),timers:s.engine.timers,groups:s.engine.groups};});assert.equal(v.impact.playerActive,0);assert(v.impact.allocated<=38);values.push(v);}
  const tail=values.slice(1).map(v=>[v.impact.cacheSources,v.impact.derivedTotalBytes,v.impact.allocated]);assert(tail.every(v=>JSON.stringify(v)===JSON.stringify(tail[0])));return {first:values[0],last:values.at(-1)};
 });
 await p.close();
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])await check('viewport '+width,async()=>{
  const q=await open(browser,{width,height});const v=await q.evaluate(()=>({scroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},stage:document.querySelector('#stage').getBoundingClientRect().height,controls:[...document.querySelectorAll('button,select,label')].map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y};})}));assert(v.scroll.w<=width&&v.scroll.h<=height);assert(v.stage>=100);assert(v.controls.every(c=>c.h>=44&&c.x>=0&&c.x+c.w<=width+.5&&c.y>=0&&c.y+c.h<=height+.5));await q.screenshot({path:path.join(out,`layout-${width}.png`)});await q.close();return v;
 });
 assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;console.error(e);process.exitCode=1;}finally{await browser?.close();save();console.log(JSON.stringify({status:r.status,checks:r.checks.length,errors:r.errors,output:out}));}})();
