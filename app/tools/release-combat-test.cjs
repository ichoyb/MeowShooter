'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),baseline=false,review=process.argv.includes('--review');
const config=require('./release-test-config.cjs')(root,{baseline,review}),manifest=config.candidate,dist=config.dist;
const contract=require('./release-profile-contract.cjs')(config);
config.verify();
const out=path.join(config.qa,'combat-runs',(baseline?'red-':'')+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});let browser,server;const checks=[],errors=[],consoleErrors=[];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
async function check(name,fn){try{checks.push({name,status:'PASS',observed:await fn()});}catch(e){checks.push({name,status:'FAIL',error:String(e)});errors.push({name,error:String(e)});}fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({checks,errors},null,2));}
async function snap(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function touch(c,type,points){await c.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
async function boot(p){
 await p.goto('http://127.0.0.1:8799/');
 await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');
 await click(p,'start');
 if(await p.locator('button[data-action="chapter-skip"]:visible').count())await click(p,'chapter-skip');
}
function assertGroups(s){
 assert.ok(s.engine,'Arcade engine diagnostics must be available');
 assert.equal(s.engine.physics,'Arcade');
 for(const g of Object.values(s.engine.groups)){assert.equal(g.active,g.enabled);assert.ok(g.active<=g.total);}
 assert.equal(s.enemies,s.engine.groups.enemies.active);assert.equal(s.projectiles,s.engine.groups.projectiles.active);
 assert.ok(s.engine.groups.enemies.total<=10);assert.ok(s.engine.groups.projectiles.total<=24);
}
async function engineChecks(){
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>consoleErrors.push(String(e)));
 p.setDefaultTimeout(5000);try{await boot(p);
  await check('Arcade body velocity drives motion; Group is the live entity source',async()=>{
   await p.waitForTimeout(100);const before=await state(p);assertGroups(before);
   await p.mouse.move(180,420);await p.mouse.down();await p.mouse.move(212,420);await p.waitForTimeout(180);const held=await state(p);
   assert.ok(held.engine.velocity.x>150);assert.ok(held.player.x>before.player.x+10);assert.equal(held.engine.stickVisible,true);assertGroups(held);
   await p.mouse.up();await p.waitForTimeout(90);const released=await state(p);assert.equal(released.engine.velocity.x,0);assert.equal(released.engine.stickVisible,false);return {before,held,released};
  });
  await check('scene/world/Clock and projectile life freeze until explicit resume',async()=>{
   await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).projectiles>0,null,{timeout:15000});await click(p,'pause');const before=await state(p);assert.equal(before.engine.paused,true);
   await click(p,'help');await click(p,'back');await p.waitForTimeout(1800);const after=await state(p);
   for(const key of ['player','targets','ammo','reloadLeft','shots','elapsed','projectiles'])assert.deepEqual(after[key],before[key],key);
   assert.equal(after.engine.timers,before.engine.timers);await click(p,'resume');await p.waitForTimeout(100);const resumed=await state(p);assert.equal(resumed.engine.paused,false);assert.ok(resumed.elapsed-before.elapsed<.5);return {before,after,resumed};
  });
  await check('ten resets do not grow Bodies, Colliders or old projectile timers',async()=>{
   const observations=[];for(let i=0;i<10;i++){await click(p,'pause');await click(p,'end');await click(p,'confirm-end');const reset=await state(p);assertGroups(reset);assert.equal(reset.projectiles,0);assert.equal(reset.engine.timers,0);assert.equal(reset.locked,null);observations.push(reset.engine);await click(p,'start');await p.waitForTimeout(70);}
   assert.ok(observations.every(s=>s.colliders===observations[0].colliders));assert.ok(observations.every(s=>s.groups.enemies.total<=10&&s.groups.projectiles.total<=24));return observations;
  });
  await check('Arcade endpoint area query damages once and recycles disabled Bodies',async()=>{
   const before=await state(p);await p.waitForFunction(before=>{const s=JSON.parse(document.getElementById('app').dataset.state);return s.engine.overlapHits>before.engine.overlapHits&&s.kills>before.kills;},before,{timeout:30000});const after=await state(p);assertGroups(after);assert.ok(after.engine.overlapHits>before.engine.overlapHits,'actual overlapCirc endpoint path must hit');assert.ok(after.kills>before.kills);return {before,after};
  });
 }finally{await ctx.close();}
 for(const [w,h]of [[320,568],[360,640],[390,844],[430,932]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>consoleErrors.push(String(e)));
  try{await boot(p);await check(w+' Scale NONE/Camera rotates and restores world/input bounds',async()=>{
   const observations=[];
   for(const [width,height]of [[w,h],[h,w],[w,h]]){
    await p.setViewportSize({width,height});await p.waitForTimeout(180);const s=await state(p),e=s.engine;assert.equal(e.world.width,contract.courtyard?contract.COURTYARD.width:contract.WORLD_WIDTH);assert.ok(e.world.height>=500);assertGroups(s);
    const r=await p.locator('#stage canvas').boundingBox();assert.ok(Math.abs(r.width*e.scale.displayScale.x-e.buffer.width)<1);
    assert.equal(e.scale.gameWidth,e.buffer.width);assert.equal(e.scale.gameHeight,e.buffer.height);
    assert.ok(Math.abs(e.world.height-(contract.courtyard?contract.COURTYARD.height:r.height/r.width*contract.WORLD_WIDTH))<1e-7);
    assert.ok(Math.abs(e.camera.width/e.camera.zoomX-contract.WORLD_WIDTH)<1e-7&&Math.abs(e.camera.height/e.camera.zoomY-(contract.courtyard?e.bounds.bottom-e.bounds.top:e.world.height))<1e-7);
    assert.ok(Math.abs(e.scale.baseSize.width-e.scale.gameWidth)<1&&Math.abs(e.scale.baseSize.height-e.scale.gameHeight)<1);
    assert.equal(e.scale.displaySize.width,e.buffer.width);assert.equal(e.scale.displaySize.height,e.buffer.height);
    const inset=contract.courtyard?18:29;assert.ok(s.player.x>=inset&&s.player.x<=e.world.width-inset);assert.ok(s.player.y>=(contract.courtyard?inset:e.bounds.top+inset)-1&&s.player.y<=(contract.courtyard?e.world.height-inset:e.bounds.bottom-inset)+1,JSON.stringify({viewport:{width,height},player:s.player,engine:e,layout:JSON.parse(await p.locator('#app').getAttribute('data-layout'))}));
    observations.push({viewport:{width,height},canvas:r,engine:e,layout:JSON.parse(await p.locator('#app').getAttribute('data-layout'))});await snap(p,'scale-'+width+'x'+height);
   }
   await click(p,'pause');const paused=await state(p);await p.setViewportSize({width:h,height:w});await p.waitForTimeout(180);
   const rotated=await state(p),r=await p.locator('#stage canvas').boundingBox();assert.equal(rotated.elapsed,paused.elapsed);assert.equal(rotated.engine.paused,true);
   assert.ok(Math.abs(rotated.engine.scale.gameHeight-r.height*rotated.engine.scale.displayScale.y)<1,'paused resize snapshot must reflect the current Scale');
   assert.ok(Math.abs(rotated.engine.world.height-(contract.courtyard?contract.COURTYARD.height:r.height/r.width*contract.WORLD_WIDTH))<1e-7,'paused resize Camera must reflect actual world height');
   assert.ok(Math.abs(rotated.engine.camera.height-(contract.courtyard?(rotated.engine.bounds.bottom-rotated.engine.bounds.top)*rotated.engine.camera.zoomY:rotated.engine.buffer.height))<1e-7);
   assert.ok(rotated.player.y>=(contract.courtyard?18:rotated.engine.bounds.top+28)&&rotated.player.y<=(contract.courtyard?contract.COURTYARD.height-18:rotated.engine.bounds.bottom-28),'paused resize snapshot must reflect the current Body bounds');
   observations.push({pausedRotation:true,canvas:r,engine:rotated.engine,player:rotated.player});
   return observations;
  });}finally{await ctx.close();}
 }
}
(async()=>{try{
 server=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,PORT:'8799',APP_DIST:dist},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});browser=await chromium.launch({channel:'chrome',headless:true});
 await engineChecks();if(process.argv.includes('--engine-only'))return;
 const hudOnly=process.argv.includes('--hud-only'),coordinatesOnly=process.argv.includes('--coordinates-only');
 if(!baseline&&!hudOnly)for(const [w,h]of [[844,390],[932,430]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true}),p=await ctx.newPage(),c=await ctx.newCDPSession(p);await boot(p);
  await check(w+' centered canvas uses actual CSS scale and excludes HUD',async()=>{
   const geometry=await p.evaluate(()=>{const a=document.getElementById('app').getBoundingClientRect(),r=document.querySelector('canvas').getBoundingClientRect(),l=JSON.parse(document.getElementById('app').dataset.layout);return {app:{x:a.x,y:a.y,width:a.width},canvas:{x:r.x,y:r.y,width:r.width},layout:l};});
   for(const selector of ['#health','#timer']){const r=await p.locator(selector).boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;try{await touch(c,'touchStart',[{id:1,x,y}]);await touch(c,'touchMove',[{id:1,x:x+10,y}]);await p.waitForTimeout(60);assert.equal((await state(p)).moveHeld,false,selector);}finally{await touch(c,'touchEnd',[]);}}
   // The upper HUD gap still overlays the centered, narrow Phaser canvas.
   const x=geometry.canvas.x+geometry.canvas.width/2,y=geometry.layout.battleTop-20;
   await touch(c,'touchStart',[{id:1,x,y}]);await touch(c,'touchMove',[{id:1,x:x+10,y}]);await p.waitForTimeout(60);assert.equal((await state(p)).moveHeld,false,'upper HUD');await touch(c,'touchEnd',[]);
   const startY=geometry.layout.battleTop+20,before=await state(p);
   await touch(c,'touchStart',[{id:1,x,y:startY}]);await touch(c,'touchMove',[{id:1,x:x+5,y:startY}]);await p.waitForTimeout(80);assert.equal((await state(p)).moveHeld,true);assert.ok(Math.abs((await state(p)).player.x-before.player.x)<.1,'5 CSS px remains dead zone');
   await touch(c,'touchMove',[{id:1,x:x+32,y:startY}]);await p.waitForTimeout(100);assert.ok((await state(p)).player.x>before.player.x+5);await touch(c,'touchEnd',[]);return geometry;
  });await ctx.close();
 }
 for(const [w,h]of (coordinatesOnly?[]:baseline||hudOnly?[[390,844]]:[[320,568],[360,640],[390,844],[430,932]])){
  const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:w===430?3:1}),p=await ctx.newPage(),c=await ctx.newCDPSession(p);
  p.on('pageerror',e=>consoleErrors.push(String(e)));await boot(p);
  if(!baseline)await check(w+' actual HUD cannot claim movement',async()=>{for(const selector of ['#health','#timer']){const r=await p.locator(selector).boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;try{await touch(c,'touchStart',[{id:1,x,y}]);await touch(c,'touchMove',[{id:1,x:x+24,y}]);await p.waitForTimeout(70);assert.equal((await state(p)).moveHeld,false,selector);}finally{await touch(c,'touchEnd',[]);}}});
  if(hudOnly){await ctx.close();continue;}
  await check(w+' pure automatic contract',async()=>{const s=await state(p);assert.equal(s.mode,'auto');assert.equal('aimHeld'in s,false);assert.equal(await p.locator('.stick.aim').count(),0);assert.equal(await p.locator('#floating-stick').count(),0);assert.equal(s.engine.stickVisible,false);return s;});
  const y=Math.round(h*.52);
  await check(w+' wide-area movement starts in battlefield',async()=>{const before=await state(p);await touch(c,'touchStart',[{id:1,x:w*.25,y}]);await touch(c,'touchMove',[{id:1,x:w*.25+32,y}]);await p.waitForTimeout(150);const after=await state(p);assert.ok(after.moveHeld);assert.ok(after.player.x>before.player.x+5);await touch(c,'touchEnd',[]);await p.waitForTimeout(60);assert.equal((await state(p)).moveHeld,false);return {before:before.player,after:after.player};});
  if(baseline){await ctx.close();continue;}
  await check(w+' left middle right and former bottom controls',async()=>{
   for(const [x,startY]of [[30,y],[w/2,y],[w-35,y],[w/2,h-30]]){
    // Every start area must drive actual motion, independently of a previous
    // gesture reaching the boundary. Choose the direction with available room.
    const a=await state(p),dy=a.player.y<(a.engine.bounds.top+a.engine.bounds.bottom)/2?24:-24;
    try{await touch(c,'touchStart',[{id:1,x,y:startY}]);await touch(c,'touchMove',[{id:1,x,y:startY+dy}]);await p.waitForTimeout(90);const b=await state(p);assert.equal(b.moveHeld,true);assert.ok((b.player.y-a.player.y)*dy>0,JSON.stringify({x,startY,dy,before:a.player,after:b.player,bounds:b.engine.bounds,velocity:b.engine.velocity}));assert.ok(b.engine.stickVisible);if(x===30)await snap(p,'floating-'+w);}finally{await touch(c,'touchEnd',[]);}await p.waitForTimeout(60);assert.equal((await state(p)).moveHeld,false);assert.equal((await state(p)).engine.stickVisible,false);
   }await snap(p,'battle-'+w);return JSON.parse(await p.locator('#app').getAttribute('data-layout'));
  });
  await check(w+' dead zone, follow and quick reverse',async()=>{
   const x=w/2,base=await state(p);await touch(c,'touchStart',[{id:1,x,y}]);await touch(c,'touchMove',[{id:1,x:x+5,y}]);await p.waitForTimeout(80);assert.ok(Math.abs((await state(p)).player.x-base.player.x)<.1);
   await touch(c,'touchMove',[{id:1,x:x+80,y}]);await p.waitForTimeout(100);const right=await state(p);assert.ok(right.player.x>base.player.x+4);
   await touch(c,'touchMove',[{id:1,x:x+32,y}]);await p.waitForTimeout(100);assert.ok((await state(p)).player.x<right.player.x-3);await touch(c,'touchEnd',[]);
  });
  await check(w+' HUD and host band cannot claim movement',async()=>{
   const before=await state(p);await touch(c,'touchStart',[{id:1,x:30,y:30}]);await touch(c,'touchMove',[{id:1,x:80,y:60}]);await p.waitForTimeout(70);assert.equal((await state(p)).moveHeld,false);await touch(c,'touchEnd',[]);
   assert.ok((await state(p)).shots>=before.shots);assert.equal(await p.locator('body').evaluate(e=>e.scrollTop),0);
  });
  await ctx.close();
 }
 if(!baseline&&!hudOnly&&!coordinatesOnly){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage(),c=await ctx.newCDPSession(p);p.on('pageerror',e=>consoleErrors.push(String(e)));await boot(p);
  await check('second touch never steals and held touch never inherits',async()=>{
   await touch(c,'touchStart',[{id:1,x:90,y:420}]);await touch(c,'touchMove',[{id:1,x:110,y:420}]);const first=(await state(p)).moveOwner;
   await touch(c,'touchStart',[{id:1,x:110,y:420},{id:2,x:310,y:460}]);await touch(c,'touchMove',[{id:1,x:110,y:420},{id:2,x:330,y:460}]);assert.equal((await state(p)).moveOwner,first);
   // CDP partial touchEnd does not represent the remaining-touch list.
   // Feed the real native event shape through Phaser for this partial release;
   // all other touches here are CDP-generated. This remains a synthetic check.
   await p.evaluate(()=>{const el=document.querySelector('canvas'),a=new Touch({identifier:1,target:el,clientX:110,clientY:420,pageX:110,pageY:420}),b=new Touch({identifier:2,target:el,clientX:330,clientY:460,pageX:330,pageY:460});el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,changedTouches:[a],touches:[b],targetTouches:[b]}));});await p.waitForTimeout(60);assert.equal((await state(p)).moveHeld,false);await touch(c,'touchMove',[{id:2,x:280,y:460}]);await p.waitForTimeout(70);assert.equal((await state(p)).moveHeld,false);await touch(c,'touchEnd',[]);
   await touch(c,'touchStart',[{id:2,x:280,y:460}]);await touch(c,'touchMove',[{id:2,x:260,y:460}]);assert.equal((await state(p)).moveHeld,true);await touch(c,'touchEnd',[]);
  });
  await check('unrelated native cancel leaves owner active; owner cancel waits',async()=>{
   await touch(c,'touchStart',[{id:21,x:90,y:420}]);await touch(c,'touchMove',[{id:21,x:115,y:420}]);
   await p.evaluate(()=>{const el=document.querySelector('canvas');const t=new Touch({identifier:999,target:el,clientX:310,clientY:460});el.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,cancelable:true,changedTouches:[t]}));});assert.equal((await state(p)).moveHeld,true);assert.equal((await state(p)).reasons.length,0);
   const owner=(await state(p)).moveOwner;await touch(c,'touchStart',[{id:21,x:115,y:420},{id:22,x:310,y:460}]);assert.equal((await state(p)).moveOwner,owner);
   await p.evaluate(()=>{const el=document.querySelector('#stage canvas'),a=new Touch({identifier:21,target:el,clientX:115,clientY:420,pageX:115,pageY:420}),b=new Touch({identifier:22,target:el,clientX:310,clientY:460,pageX:310,pageY:460});el.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,cancelable:true,changedTouches:[b],touches:[a],targetTouches:[a]}));});
   const before=(await state(p)).elapsed;await p.waitForTimeout(80);assert.equal((await state(p)).moveOwner,owner);assert.equal((await state(p)).moveHeld,true);assert.equal((await state(p)).reasons.length,0);assert.ok((await state(p)).elapsed>before,'registered secondary cancel must not freeze combat');
   await touch(c,'touchCancel',[]);await p.waitForTimeout(70);const paused=await state(p);assert.equal(paused.moveHeld,false);assert.ok(paused.reasons.includes('inputLost'));await p.waitForTimeout(140);assert.equal((await state(p)).elapsed,paused.elapsed);await click(p,'resume');assert.equal((await state(p)).moveHeld,false);
  });
  await check('release stops motion while automatic attacks continue',async()=>{const before=await state(p);await p.waitForFunction(shots=>JSON.parse(document.getElementById('app').dataset.state).shots>shots,before.shots,{timeout:20000});const after=await state(p);assert.deepEqual(after.player,before.player);assert.ok(after.shots>before.shots);assert.equal(after.mode,'auto');});
  await check('mouse drag moves rather than aims; WASD remains',async()=>{const before=await state(p);await p.mouse.move(200,440);await p.mouse.down();await p.mouse.move(230,440);await p.waitForTimeout(100);const after=await state(p);assert.ok(after.player.x>before.player.x);assert.equal(after.mode,'auto');await p.mouse.up();const b=await state(p);await p.keyboard.down('KeyA');await p.waitForTimeout(100);await p.keyboard.up('KeyA');assert.ok((await state(p)).player.x<b.player.x);});
  await check('paused child, upgrade sample, background remain frozen',async()=>{
   await click(p,'pause');const a=await state(p);await click(p,'help');assert.doesNotMatch(await p.locator('#modal-scroll').textContent(),/右拖|鼠标.*瞄准/);await click(p,'back');if(review){await click(p,'upgrade');await click(p,'detail:BALL_01');await click(p,'close');await click(p,'close-upgrade');}await p.waitForTimeout(100);assert.equal((await state(p)).elapsed,a.elapsed);await click(p,'resume');
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});const b=await state(p);await p.waitForTimeout(100);assert.equal((await state(p)).elapsed,b.elapsed);assert.equal((await ui(p)).frame,'LAYER-02-S03');await click(p,'resume');
  });
  await check('viewport change during holding interrupts and clears input',async()=>{await touch(c,'touchStart',[{id:1,x:160,y:440}]);await touch(c,'touchMove',[{id:1,x:185,y:440}]);await p.setViewportSize({width:360,height:640});await p.waitForTimeout(120);assert.equal((await state(p)).moveHeld,false);assert.ok((await state(p)).reasons.includes('inputLost'));await touch(c,'touchEnd',[]);await click(p,'resume');await p.setViewportSize({width:390,height:844});});
  await check('20 restarts keep document, config and clear input/target/projectiles',async()=>{await p.evaluate(()=>window.c1DocumentMarker='same');await click(p,'pause');await click(p,'settings');await p.locator('#quality').selectOption('低');await click(p,'close');await click(p,'resume');for(let i=0;i<20;i++){await click(p,'pause');await click(p,'end');await click(p,'confirm-end');const s=await state(p);assert.equal(s.elapsed,0);assert.equal(s.shots,0);assert.equal(s.moveHeld,false);assert.equal(s.locked,null);assert.equal(s.projectiles,0);await click(p,'start');}assert.equal(await p.evaluate(()=>window.c1DocumentMarker),'same');assert.equal((await ui(p)).settings.quality,'低');});
  await click(p,'pause');await click(p,'end');await click(p,'confirm-end');
  if(review)await check('current review omits manual states and still navigates',async()=>{await click(p,'review');const values=await p.locator('#state-picker option').evaluateAll(es=>es.map(e=>e.value));assert.equal(values.includes('PAGE-06-S10'),false);assert.equal(values.includes('PAGE-06-S12'),false);assert.equal(values.length,60);await p.locator('#state-picker').selectOption('PAGE-06-S05');await click(p,'show-state');assert.match(await p.locator('#hud').textContent(),/自动/);assert.doesNotMatch(await p.locator('#hud').textContent(),/右拖|手动/);});await ctx.close();
  const data=JSON.parse(fs.readFileSync(path.join(root,'app/src/ui/content.generated.json')));
  for(const [w,h]of (review?[[320,568],[360,640],[390,844],[430,932]]:[])){
   const ctx=await browser.newContext({viewport:{width:w,height:h}}),p=await ctx.newPage();await p.goto('http://127.0.0.1:8799/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');
   for(const s of data.states)await check(w+' review '+s.stateId,async()=>{await click(p,'review');await p.locator('#state-picker').selectOption(s.stateId);await click(p,'show-state');const u=await ui(p);assert.ok(u.frame===s.stateId||u.page===s.stateId);assert.ok(await p.evaluate(()=>document.body.scrollWidth<=innerWidth));});await ctx.close();
  }
  await check('file URL offline boot and candidate fingerprint',async()=>{for(const f of manifest.files)assert.equal(sha(fs.readFileSync(path.join(dist,f.file))),f.sha256);const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto('file:///'+path.join(dist,'index.html').replace(/\\/g,'/'));await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await ctx.close();});
 }
}catch(e){errors.push({name:'suite',error:String(e)});}finally{
 if(browser)await browser.close();if(server)server.kill();const screenshots=fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(file=>({file,sha256:sha(fs.readFileSync(path.join(out,file)))}));
 const report={candidate:config.identity,atUtc:new Date().toISOString(),status:errors.length||consoleErrors.length?'FAIL':'PASS',baselineRed:baseline,profile:manifest.profile,artifactKind:config.artifactKind,receipt:config.receipt,zipSha256:config.artifactKind==='archive'?manifest.sha256:null,checks,errors,consoleErrors,screenshots,environment:'Modern Chrome / strict CSP / synthetic CDP touches, not platform or phone',platform:'NOT_TESTED',phone:'NOT_TESTED'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,status:report.status,checks:checks.length,errors:errors.slice(0,12),consoleErrors}));process.exitCode=report.status==='PASS'?0:1;
}})();
