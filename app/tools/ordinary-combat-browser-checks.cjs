// Execute this function with the browser tool against the normal local player
// build. Only DOM diagnostics are read; no Scene, position or time mutation.
async (page) => {
 const browser=page.context().browser(),checks=[],errors=[];
 const assert=(value,label)=>{if(!value)throw Error(label);};
 const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
 const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
 const click=async(p,action)=>{const b=p.locator('button[data-action="'+action+'"]:visible').last();await b.scrollIntoViewIfNeeded();assert(await b.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&(hit===e||e.contains(hit));}),'Unreachable button '+action);await b.click();};
 const boot=async p=>{p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:8875/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');assert(await p.evaluate(()=>typeof window.sliceFixture==='undefined'&&typeof window.qaArena==='undefined'),'No fixture in normal entry');};
 const freeze=async p=>{await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);const a=await state(p);await p.waitForTimeout(110);const b=await state(p);assert(JSON.stringify([a.elapsed,a.hp,a.player,a.enemyProjectiles,a.targets])===JSON.stringify([b.elapsed,b.hp,b.player,b.enemyProjectiles,b.targets]),'Paused state changed');return b;};
 try{
  for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3])for(const quality of ['standard','low']){
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:true});
   try{
    const p=await ctx.newPage();await boot(p);assert((await p.locator('button[data-action="start"]').textContent()).includes('庭院首关'),'Homepage duration');
    await click(p,'settings');await p.locator('#quality').selectOption(quality==='low'?'低':'标准');await click(p,'close');await click(p,'start');
    const s=await state(p),rect=await p.locator('#stage').boundingBox(),density=quality==='low'?1:Math.min(dpr,2);
    assert(await p.locator('.exp-meter').getAttribute('aria-valuemax')==='300','Actual duration accessibility');
    assert(s.durationSeconds===300&&s.weaponInterval===.8&&s.presentation.bodyDisplay.width===30&&s.engine.bodies.cat.radius===12,'Actual cat contract');
    assert((await ui(p)).runLoadout.rulesVersion===s.rulesVersion,'One frozen run configuration in navigation and battle');
    assert(s.imageBudget.sourceRGBA===5107904&&s.imageBudget.sources.length===26&&s.imageBudget.headroom>=131072,'Complete UI and battle budget');
    assert(s.engine.buffer.width===Math.round(rect.width*density)&&s.engine.buffer.height===Math.round(rect.height*density),'Buffer density');
    assert(Math.abs(rect.width-width)<1&&Math.abs(rect.height-height)<1,'Full screen background');
    const layout=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.layout)),cdp=await ctx.newCDPSession(p),x=width*.5,y=layout.touchArea.bottom-14;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x+32,y}]});await p.waitForTimeout(80);
    const moved=await state(p);assert(moved.moveHeld&&moved.engine.velocity.x>0,'Native touch movement');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await click(p,'pause');const paused=await freeze(p);assert(!paused.moveHeld&&paused.engine.velocity.x===0,'Pause clears input');
    checks.push({name:width+'x'+height+' DPR'+dpr+' '+quality,status:'PASS',buffer:s.engine.buffer,sourceRGBA:s.imageBudget.sourceRGBA,headroom:s.imageBudget.headroom,player:paused.player});
   }finally{await ctx.close();}
  }
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  try{
   const p=await ctx.newPage();await boot(p);const origin=await p.evaluate(()=>performance.timeOrigin);await click(p,'sound-enable');await p.waitForFunction(()=>{const a=JSON.parse(document.getElementById('app').dataset.audio);return a.ready&&!a.pending;});
   await click(p,'detail:W01');assert((await p.locator('#modal-scroll').textContent()).includes('间隔0.8秒'),'Actual slower weapon detail');await click(p,'close');
   await click(p,'start');await p.keyboard.down('KeyD');await p.keyboard.down('KeyS');await p.waitForTimeout(850);await p.keyboard.up('KeyD');await p.keyboard.up('KeyS');await click(p,'pause');
   const before=await freeze(p);assert(before.player.x>430&&before.player.y>790&&before.engine.camera.view.x>190,'Camera follows actual motion');
   for(const quality of ['低','标准']){await click(p,'settings');await p.locator('#quality').selectOption(quality);await click(p,'close');const s=await freeze(p);assert((await ui(p)).frame.startsWith('LAYER-02'),'Settings returns to pause');for(const k of ['x','y','width','height'])assert(Math.abs(s.engine.camera.view[k]-before.engine.camera.view[k])<.00005,'Camera jumped on quality change '+k);}
   await click(p,'help');assert((await p.locator('#modal-scroll').textContent()).includes('300秒'),'Help duration');await click(p,'back');await freeze(p);
   await click(p,'end');await click(p,'close');await freeze(p);await click(p,'resume');await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).engine.paused);assert(!(await state(p)).moveHeld,'No held input on resume');
   await p.waitForTimeout(700);const audio=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));assert(audio.ready&&audio.location==='battle'&&audio.musicPlaying,'Runtime audio resumed');
   await click(p,'pause');await click(p,'end');await click(p,'confirm-end');await click(p,'start');const restart=await state(p);
   assert(await p.evaluate(()=>performance.timeOrigin)===origin,'No page reload');assert(restart.elapsed<.5&&restart.hp===90&&restart.enemyProjectiles.length===0&&restart.enemies===0&&restart.kills===0&&!restart.moveHeld&&restart.weaponInterval===.8,'Restart clears run and retains .8s interval');
   await p.screenshot({path:'D:/Projects/Cat-save-world/.local/worktrees/courtyard-combat-local/.local/checks/boss-role-v4/normal-entry.png'});
   checks.push({name:'normal touch/navigation camera/quality/audio/end/restart flow',status:'PASS',before:{player:before.player,view:before.engine.camera.view},restart:{duration:restart.durationSeconds,player:restart.player,enemies:restart.enemies},audio:{ready:audio.ready,location:audio.location,musicPlaying:audio.musicPlaying},audioScope:'Browser state only; no phone or listening claim'});
  }finally{await ctx.close();}
  for(const file of ['parts.png','bubble.png','b01-dust.png']){
   const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
   try{
    const p=await ctx.newPage(),pattern='**/assets/first-combat/'+file;await p.route(pattern,r=>r.abort());await p.goto('http://127.0.0.1:8875/');await p.locator('button[data-action="reload"]').waitFor();assert((await p.locator('#page-scroll').textContent()).includes('失败'),'Visible loading error');await p.unroute(pattern);const retry=p.locator('#retry');assert(await retry.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&(h===e||e.contains(h));}),'Visible boot recovery button');await retry.click();await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await click(p,'start');const s=await state(p);assert(s.imageBudget.sourceRGBA===5107904&&s.imageBudget.sources.length===26,'Retry leaked decoded source');checks.push({name:'actual missing '+file+' and retry button',status:'PASS',sourceRGBA:s.imageBudget.sourceRGBA,sources:s.imageBudget.sources.length});
   }finally{await ctx.close();}
  }
  assert(errors.length===0,'Page errors: '+errors.join(';'));
  return {status:'PASS',browser:browser.version(),checks,errors,environment:'Desktop Chromium / normal entry / native browser touch and keyboard; no platform or phone claim'};
 }catch(error){return {status:'FAIL',error:String(error),checks,errors};}
}
