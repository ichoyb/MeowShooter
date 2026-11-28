// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const app=path.resolve(__dirname,'..'),out=path.resolve(process.env.DEVTOOLS_CHECK_DIR||'../.local/devtools/checks');
const dist=path.resolve(process.env.DEVTOOLS_DIST||'../.local/devtools/preview');
const port=process.env.DEVTOOLS_PORT||'8790',url=process.env.DEVTOOLS_URL||'http://127.0.0.1:'+port;
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],report={status:'FAIL',url,node:process.version,runnerSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),checks,errors,platform:'NOT_TESTED',phone:'NOT_TESTED'};
let browser,server;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,action)=>p.locator('button[data-action="'+action+'"]:visible').last().click();
const record=(name,detail)=>checks.push({name,detail});
async function apply(p,values){
 for(const [key,value] of Object.entries(values)){
  const field=p.locator('#devtools-settings [name="'+key+'"]');
  if(key==='inv')await field.setChecked(value);else await field.fill(String(value));
 }
 await p.locator('#devtools-settings button[type=submit]').click();
 assert.equal(await p.locator('#devtools-settings-error').innerText(),'');
}
async function confirm(p){
 await p.locator('button[data-action^="growth-select:"]:visible').first().click();
 await p.locator('button[data-action^="growth-confirm:"]:visible').click();
 await p.waitForFunction(()=>{
  const app=document.getElementById('app'),s=JSON.parse(app.dataset.state),ui=JSON.parse(app.dataset.ui);
  return !s.progression.offer&&ui.frame!=='N1-RECEIPT'&&s.reasons.length===0;
 });
}
async function boot(p){
 await p.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true');
 await click(p,'start');
 await p.evaluate(()=>{
  const app=document.getElementById('app');
  if(JSON.parse(app.dataset.ui).frame==='N1-OPEN')app.querySelector('button[data-action="chapter-skip"]').click();
 });
 await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.01);
}
(async()=>{
 try{
  if(!process.env.DEVTOOLS_URL){
   await new Promise((resolve,reject)=>{
    server=spawn(process.execPath,['tools/serve.mjs'],{cwd:app,env:{...process.env,APP_DIST:dist,PORT:port},stdio:['ignore','pipe','pipe']});
    let output='';server.stdout.on('data',chunk=>{output+=chunk;if(output.includes(url))resolve();});server.stderr.on('data',chunk=>errors.push(String(chunk)));
    server.once('error',reject);server.once('exit',code=>reject(new Error('Preview server exited: '+code)));
   });
  }
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
  try{browser=await chromium.launch({channel:'chrome',headless:true});}
  catch(error){
   if(/Operation not permitted|EPERM|bootstrap_check_in|Mach port|not authorized|signal=SIGABRT/i.test(String(error))){report.status='NOT_RUN';report.reason='Chrome launch failed inside the current sandbox; page checks did not run';report.originalError=String(error);report.stack=error.stack;process.exitCode=2;return;}
   throw error;
  }
  report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),p=await context.newPage();
  p.setDefaultTimeout(12000);p.on('pageerror',error=>errors.push(String(error)));
  const response=await p.goto(url+'/?cat=CAT01&xp=36&inv=1&dmg=0&hp=1&spawn=2&xpm=1');
  assert.ok(response.headers()['content-security-policy'].includes("connect-src 'none'"));
  await boot(p);assert.equal(await p.locator('html').getAttribute('data-devtools'),'CAT_DEVTOOLS_V1');
  const bounds=await p.evaluate(()=>({app:document.getElementById('app').getBoundingClientRect().toJSON(),panel:document.getElementById('devtools').getBoundingClientRect().toJSON()}));
  assert.ok(bounds.app.width<=520);assert.ok(bounds.panel.left>=bounds.app.right);assert.ok(Math.abs((bounds.app.left+bounds.app.right)/2-720)<2);
  await p.keyboard.press('Backquote');assert.equal(await p.locator('#devtools').isVisible(),false);await p.locator('#devtools-badge').click();
  await p.locator('#devtools-xp-amount').focus();const active=await state(p);await p.keyboard.type('wasd');await p.keyboard.down('w');await p.waitForTimeout(200);await p.keyboard.up('w');assert.deepEqual((await state(p)).player,active.player);await p.keyboard.press('Escape');await p.keyboard.press('Backquote');
  assert.equal(await p.locator('#devtools').isVisible(),true);assert.deepEqual((await state(p)).reasons,active.reasons);await p.locator('#devtools header strong').click();
  record('layout, badge, Backquote and focused keyboard isolation',bounds);
  await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>=12,{},{timeout:22000});
  let s=await state(p);assert.equal(s.hp,s.maxHp);assert.ok(s.enemies>0);assert.equal(s.defense.hpLostTotal,0);
  record('B inv preserves real HP and damage facts',{hp:s.hp,enemies:s.enemies});
  await apply(p,{inv:false});await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).hp<JSON.parse(document.getElementById('app').dataset.state).maxHp,{},{timeout:12000});
  await apply(p,{inv:true});s=await state(p);record('B disabling inv permits actual damage',s.defense.lastHit);
  assert.equal(await p.locator('.devtools-reward').count(),50);
  const evo=p.locator('[data-reward="E14"]');assert.equal(await evo.locator('button').isDisabled(),true);assert.match(await evo.innerText(),/需要/);
  const before=s.progression.confirmedPicks;
  await p.locator('[data-reward="L1_DAMAGE"] button').click();s=await state(p);assert.equal(s.progression.ranks.L1_DAMAGE,1);assert.equal(s.progression.confirmedPicks,before+1);assert.equal(s.progression.level,1);
  await p.locator('[data-reward="C13"] button').click();assert.equal(await p.locator('[data-reward="C13"] button').isDisabled(),true);
  record('C normal50, real transaction, prerequisite and max rank');
  await p.locator('#devtools-level-up').click();s=await state(p);assert.equal(s.progression.level,2);assert.ok(s.progression.offer);assert.equal(await p.locator('[data-reward="L1_DAMAGE"] button').isDisabled(),true);
  await confirm(p);const xp=(await state(p)).progression.totalXP;await p.locator('#devtools-xp-amount').fill('1');await p.locator('#devtools-add-xp').click();assert.equal((await state(p)).progression.totalXP,xp+1);
  await click(p,'pause');await p.locator('#devtools-level-up').click();assert.deepEqual((await state(p)).reasons,['upgrade']);await confirm(p);
  record('D real XP and normal upgrade selection, including from menu pause');
  await apply(p,{dmg:2,hp:3,spawn:0,xpm:2});s=await state(p);assert.ok(s.weaponStats.damage>0);
  const born=s.spawnPressure.reduce((sum,row)=>sum+row.spawned,0);await p.waitForTimeout(3300);assert.equal((await state(p)).spawnPressure.reduce((sum,row)=>sum+row.spawned,0),born);
  const zeroDamage=s.weaponStats.damage/2;await apply(p,{dmg:3});assert.ok(Math.abs((await state(p)).weaponStats.damage-zeroDamage*3)<1e-8);
  record('E live damage and zero ordinary birth requests');
  await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.renderFrames.sampleCount>3);
  s=await state(p);const info=await p.locator('#devtools-info').innerText();assert.ok(s.engine.renderFrames.avgFPS>0);assert.match(info,/FPS.*怪物.*普通.*玩家弹.*敌弹/);record('F existing postrender FPS and group counts',info);
  await p.reload();await boot(p);assert.equal(new URL(p.url()).searchParams.get('cat'),'CAT01');assert.equal(new URL(p.url()).searchParams.get('xp'),'36');assert.equal(await p.locator('[name=xpm]').inputValue(),'2');assert.equal(await p.locator('[name=spawn]').inputValue(),'0');
  await click(p,'pause');await click(p,'end');await click(p,'confirm-end');await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.01);assert.equal((await state(p)).weaponStats.damage,16*3);record('URL refresh and new-run settings retention');
  await apply(p,{dmg:0,hp:1,spawn:1,xpm:2});
  await click(p,'pause');await click(p,'end');await click(p,'confirm-end');await click(p,'start');
  await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).enemyBehaviors.length>0);
  s=await state(p);const oldEnemy=s.enemyBehaviors[0];assert.equal(oldEnemy.hp,48);
  await apply(p,{hp:3,spawn:2});
  await p.waitForFunction(id=>JSON.parse(document.getElementById('app').dataset.state).enemyBehaviors.some(enemy=>enemy.id!==id),oldEnemy.id,{timeout:12000});
  s=await state(p);assert.equal(s.enemyBehaviors.find(enemy=>enemy.id===oldEnemy.id).hp,48);
  assert.ok(s.enemyBehaviors.filter(enemy=>enemy.id!==oldEnemy.id).every(enemy=>enemy.hp===144));
  assert.ok(s.enemies<=8);record('E future enemy HP changes, existing HP remains and ordinary cap holds',s.enemyBehaviors);
  await p.locator('[data-reward="L1_TRAIL_BELL"] button').click();await p.locator('[data-reward="L1_PICKUP_CHIME"] button').click();
  await apply(p,{spawn:0,dmg:100});await p.locator('#devtools header strong').click();
  const pickupDeadline=Date.now()+16000;let held=[];
  while(Date.now()<pickupDeadline){
   s=await state(p);if(s.progression.totalXP>0)break;
   const orb=s.pickups.orbs.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0],next=[];
   if(orb){const dx=orb.x-s.player.x,dy=orb.y-s.player.y;if(dx>6)next.push('d');if(dx<-6)next.push('a');if(dy>6)next.push('s');if(dy<-6)next.push('w');}
   for(const key of held.filter(key=>!next.includes(key)))await p.keyboard.up(key);
   for(const key of next.filter(key=>!held.includes(key)))await p.keyboard.down(key);
   held=next;await p.waitForTimeout(30);
  }
  for(const key of held)await p.keyboard.up(key);
  s=await state(p);assert.ok(s.pickups.collectedXP>0);assert.equal(s.progression.totalXP,s.pickups.collectedXP*2);
  assert.equal(s.bellAbilities.charge+s.bellAbilities.chimes*8,Math.min(s.progression.totalXP,8));
  record('E real pickup XP and pickup-chime charging use xpm',{rawXP:s.pickups.collectedXP,totalXP:s.progression.totalXP,charge:s.bellAbilities.charge});
  await p.setViewportSize({width:390,height:844});await p.locator('#devtools').waitFor({state:'hidden'});await p.locator('#devtools-badge').click();assert.equal(await p.locator('#devtools').isVisible(),true);await p.screenshot({path:path.join(out,'narrow.png')});record('narrow collapsible drawer');
  assert.deepEqual(errors,[]);report.mainSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'assets/main.js'))).digest('hex');report.status='PASS';await context.close();
 }catch(error){report.error=String(error);report.stack=error.stack;process.exitCode=1;}
 finally{
  await browser?.close();server?.kill('SIGTERM');fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
})();
