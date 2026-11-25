// Actual Chrome/Arena review checks. Does not start a server or alter src.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const assert=require('node:assert/strict');
const url=process.env.PRESENCE_URL||'http://127.0.0.1:9073/motion.html';
const initialSize=Number(process.env.PRESENCE_INITIAL_SIZE||36);
const out=process.env.PRESENCE_CHECK_DIR||'../.local/checks/player-presence-browser';
mkdirSync(out,{recursive:true});
const checks=[],errors=[];
let browser,page;
const check=(name,condition,details)=>{checks.push({name,pass:!!condition,details});assert.ok(condition,name+' '+JSON.stringify(details));};
const state=()=>page.evaluate(()=>window.presence.snapshot());
const sleep=ms=>page.waitForTimeout(ms);
const position=async(x,y)=>page.evaluate(({x,y})=>{
 const {a}=window.presence.f,b=a.cat.body;b.reset(x,y);b.updateFromGameObject();b.prev.copy(b.position);b.prevFrame.copy(b.position);
 a.syncCatArt(false,true);
},{x,y});
(async()=>{
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.waitForFunction(()=>window.presenceReady||window.presenceError);
  check('boot',!await page.evaluate(()=>window.presenceError),await page.evaluate(()=>window.presenceError));
  let s=await state();check('actual G7 config',s.battle.moveSpeed===185&&s.battle.maxHp===95&&s.battle.durationSeconds===600,{moveSpeed:s.battle.moveSpeed,hp:s.battle.maxHp,duration:s.battle.durationSeconds});
  check('12u physics / '+initialSize+'u initial display',s.physical.radius===12&&s.size===initialSize&&s.candidate.bodyDisplay.width===initialSize,s.physical);
  check('temporary Session prototype restored',s.prototypeRestored,s.prototypeRestored);
  await page.evaluate(()=>window.presence.pause());
  const base=await state();
  for(const size of [42,48,36]){
   await page.selectOption('#size',String(size));s=await state();
   check('size '+size+' keeps physics',JSON.stringify(s.physical)===JSON.stringify(base.physical),s.physical);
   check('size '+size+' preserves phase / time / shots',s.candidate.bodyFrame===base.candidate.bodyFrame&&s.candidate.gaitProgress===base.candidate.gaitProgress&&s.candidate.volleys===base.candidate.volleys&&s.battle.elapsed===base.battle.elapsed,s.candidate);
   check('size '+size+' resizes only visuals',s.candidate.bodyDisplay.width===size&&s.baseline.bodyDisplay.width===size&&s.candidate.physicalBodies===0,{candidate:s.candidate.bodyDisplay,baseline:s.baseline.bodyDisplay});
  }
  for(const mode of [false,true]){
   await page.evaluate(value=>window.presence.setMode(value),mode);s=await state();
   check('mode '+mode+' keeps run and phase',s.battle.progression.runId===base.battle.progression.runId&&s.battle.elapsed===base.battle.elapsed&&s.candidate.bodyFrame===base.candidate.bodyFrame,s.battle.progression.runId);
  }
  const frozen=await state();await sleep(350);s=await state();
  check('pause freezes body/weapon/time',s.candidate.bodyFrame===frozen.candidate.bodyFrame&&s.candidate.weaponFrame===frozen.candidate.weaponFrame&&s.battle.elapsed===frozen.battle.elapsed,s.candidate);
  await page.evaluate(()=>window.presence.resume());
  await position(360,720);
  await page.evaluate(()=>{
   const p=window.presence,{a}=p.f;
   const target=a.placeSliceEnemy('E01',480,720);target.setData('hp',1000000);target.body.moves=false;
   window.presenceShots=[];const emit=a.projectile.bind(a);
   a.projectile=(origin,angle,frame,source,...rest)=>{
    if(source==='PRIMARY')window.presenceShots.push({origin:{x:origin.x,y:origin.y},center:{x:a.cat.body.center.x,y:a.cat.body.center.y},size:p.snapshot().size});
    return emit(origin,angle,frame,source,...rest);
   };
  });
  // After interacting with the size selector, explicitly return keyboard focus
  // to the actual play surface, as a player would.
  await page.locator('#stage canvas').click({position:{x:180,y:180}});
  await page.keyboard.down('d');await sleep(450);
  s=await state();check('real keyboard moves and native gait starts',s.physical.center.x>420&&s.candidate.motion==='walk'&&s.candidate.transition==='steady',s.candidate);
  const reversal=await page.evaluate(()=>{
   const p=window.presence,b=p.f.a.cat.body,s=p.candidate.snapshot();
   // An immediate opposing actual-motion fact isolates phase preservation;
   // real reverse keyboard movement is measured immediately afterwards.
   p.candidate.sync(b.center,{moved:true,horizontalDisplacement:-1,actualSpeed:185},p.f.a.lastAim);
   return {before:s,after:p.candidate.snapshot()};
  });
  check('reversal preserves exact native phase',reversal.before.gaitProgress===reversal.after.gaitProgress&&reversal.before.bodyFrame===reversal.after.bodyFrame,reversal);
  await page.keyboard.up('d');await page.keyboard.down('a');await sleep(280);await page.keyboard.up('a');
  s=await state();check('real reverse input changes facing',s.candidate.facing==='left'&&s.physical.center.x<445,{facing:s.candidate.facing,center:s.physical.center});
  await sleep(140);s=await state();check('release stops within transition',s.candidate.motion==='idle'&&s.candidate.transition==='idle',s.candidate);
  for(const size of [36,42,48]){
   await page.evaluate(value=>window.presence.setSize(value),size);
   await position(360,720);await page.keyboard.down('w');await sleep(720);await page.keyboard.up('w');
   await page.evaluate(()=>window.presence.pause());
   for(const mode of [false,true]){
    await page.evaluate(value=>window.presence.setMode(value),mode);
    await page.screenshot({path:path.join(out,`motion-${size}u-${mode?'refined':'current'}.png`)});
   }
   await page.evaluate(()=>window.presence.resume());
  }
  const shots=await page.evaluate(()=>window.presenceShots);
  check('real emitted PRIMARY uses physical center at every size',[36,42,48].every(size=>shots.some(shot=>shot.size===size))&&shots.every(shot=>shot.origin.x===shot.center.x&&shot.origin.y===shot.center.y),shots);
  s=await state();check('actual moving volleys preserve ongoing gait',s.candidate.movingVolleys>0&&s.candidate.walkFrames>3,{movingVolleys:s.candidate.movingVolleys,walkFrames:s.candidate.walkFrames});
  await position(360,720);
  const stageBox=await page.locator('#stage').boundingBox();
  const touchOrigin={x:stageBox.x+stageBox.width*.45,y:stageBox.y+stageBox.height*.7};
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...touchOrigin}]});
  await sleep(30);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:touchOrigin.x+60,y:touchOrigin.y}]});
  await sleep(350);s=await state();
  check('native touch drag holds movement in real Arena',s.battle.moveHeld&&s.physical.center.x>390&&s.candidate.motion==='walk',{moveHeld:s.battle.moveHeld,center:s.physical.center,candidate:s.candidate});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(150);s=await state();
  check('native touch release clears owner and reaches idle',!s.battle.moveHeld&&s.battle.moveOwner===null&&s.candidate.motion==='idle',{moveHeld:s.battle.moveHeld,moveOwner:s.battle.moveOwner,candidate:s.candidate});
  await cdp.detach();
  await position(701,720);await page.keyboard.down('d');await sleep(500);s=await state();await page.keyboard.up('d');
  check('real wall input produces idle without boundary drift',s.candidate.motion==='idle'&&s.candidate.actualSpeed<.01&&s.physical.center.x<=702.01,{candidate:s.candidate,physical:s.physical});
  await page.evaluate(()=>window.presence.pause());
  await page.check('#zoom');
  await page.screenshot({path:path.join(out,'motion-48u-close-up.png')});
  const modes=[{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:430,height:932},{width:768,height:1024}];
  for(const viewport of modes){
   await page.setViewportSize(viewport);
   for(const quality of ['standard','low']){
    await page.selectOption('#quality',quality);await sleep(100);
    const layout=await page.evaluate(()=>{
     const stage=document.getElementById('stage').getBoundingClientRect(),canvas=document.querySelector('canvas').getBoundingClientRect();
     return {stage:{x:stage.x,y:stage.y,width:stage.width,height:stage.height},canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
    });
    check(`${viewport.width}x${viewport.height} ${quality} layout`,!layout.overflow&&layout.stage.height>=120&&Math.abs(layout.canvas.width-layout.stage.width)<1,layout);
    const closeUp=await page.evaluate(()=>{
     const p=window.presence,c=p.f.a.cameras.getCamera('presence-close-up'),v=c.worldView;
     const parts=p.candidate.objects().map(part=>part.getBounds());
     return {worldView:{x:v.x,y:v.y,right:v.right,bottom:v.bottom},parts:parts.map(b=>({x:b.x,y:b.y,right:b.right,bottom:b.bottom})),fits:parts.every(b=>b.x>=v.x&&b.right<=v.right&&b.y>=v.y&&b.bottom<=v.bottom)};
    });
    check(`${viewport.width}x${viewport.height} ${quality} full 48u close-up`,closeUp.fits,closeUp);
    await page.screenshot({path:path.join(out,`motion-${viewport.width}x${viewport.height}-${quality}.png`)});
   }
  }
  await page.setViewportSize({width:390,height:844});await page.uncheck('#zoom');
  const restartCounts=[];
  for(let i=0;i<20;i++){
   await page.evaluate(()=>window.presence.start());await sleep(30);await page.evaluate(()=>window.presence.pause());
   s=await state();restartCounts.push(s.objects);
   check('restart '+(i+1)+' resets actions and restores prototype',s.candidate.volleys===0&&s.candidate.motion==='idle'&&s.prototypeRestored&&s.physical.radius===12,s.objects);
  }
  const stable=restartCounts.slice(1);
  check('20 restarts keep visual/cache/animation counts stable',stable.every(c=>c.scene===stable[0].scene&&c.textures===stable[0].textures&&c.animations===stable[0].animations&&c.candidate===4),restartCounts);
  check('no page errors',errors.length===0,errors);
  const build=JSON.parse(readFileSync(path.join(path.dirname(out),'preview/presence-build.json'),'utf8'));
  writeFileSync(path.join(out,'report.json'),JSON.stringify({url,browser:await browser.version(),viewport:{width:390,height:844,dpr:2},sampleSHA256:build.sampleSHA256,checks,errors,shots,restartCounts,final:await state(),notTested:['Android','iOS','Xiaohongshu container','Chrome61','natural 10-minute play','visual acceptance']},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,report:path.join(out,'report.json')}));
 }catch(error){
  writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,state:page?await state().catch(()=>null):null},null,2));throw error;
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
