const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.G6_URL,output=path.resolve(process.env.G6_CHECK_DIR||'../.local/checks/g6-pilot-20261108/browser');
if(!base)throw Error('G6_URL required');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const errors=[],results=[];const check=(name,pass,detail)=>{results.push({name,pass,detail});assert.ok(pass,name);};
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base);await page.waitForFunction(()=>window.g6Ready||window.g6Error);assert.equal(await page.evaluate(()=>window.g6Error),undefined);
  const contracts=await page.evaluate(()=>window.g6.checks());results.push(...contracts);
  await page.waitForFunction(()=>window.g6.f.battle.snapshot().engine.paused===false);
  await page.keyboard.down('d');await page.waitForTimeout(550);
  const walking=await page.evaluate(()=>({cat:window.g6.cat.snapshot(),battle:window.g6.f.battle.snapshot()}));
  check('真实物理移动切行走与速度',walking.cat.motion==='walk'&&walking.cat.actualSpeed>0&&walking.cat.bodyDisplay.width===36,walking.cat);
  await page.keyboard.up('d');await page.waitForTimeout(250);
  check('松手回待机',await page.evaluate(()=>window.g6.cat.snapshot().motion==='idle'));
  await page.keyboard.down('a');await page.waitForTimeout(500);await page.keyboard.up('a');
  await page.waitForTimeout(6500);await page.keyboard.down('s');await page.waitForTimeout(350);await page.keyboard.up('s');await page.waitForTimeout(200);
  check('猫耳守卫真实部署与发射',await page.evaluate(()=>{const {f,fx}=window.g6;return f.a.sentries.snapshot().emitted>0&&fx.snapshot().stationId===f.a.sentries.snapshot().station.id&&fx.snapshot().guardedShots>0;}));
  await page.locator('#zoom').check();await page.screenshot({path:path.join(output,'new-390.png')});
  await page.locator('#pause').click();await page.waitForFunction(()=>window.g6.f.battle.snapshot().engine.paused);
  const frozen=await page.evaluate(()=>({elapsed:window.g6.f.session.elapsed,frame:window.g6.cat.snapshot().bodyFrame,hp:window.g6.f.session.hp}));
  await page.waitForTimeout(350);
  check('暂停动画和规则冻结',await page.evaluate(old=>{const g=window.g6;return old.elapsed===g.f.session.elapsed&&old.frame===g.cat.snapshot().bodyFrame&&old.hp===g.f.session.hp;},frozen));
  await page.locator('#mode').click();
  check('暂停时切旧版完整显示',await page.evaluate(()=>{const g=window.g6;return !g.cat.snapshot().visible&&!g.fx.snapshot().guardVisible&&g.f.a.sentries.group.getChildren()[0].alpha===1&&g.f.a.defenseGraphic.visible;}));
  await page.screenshot({path:path.join(output,'old-390.png')});
  await page.locator('#mode').click();
  check('暂停时切新版完整显示',await page.evaluate(()=>{const g=window.g6;return g.cat.snapshot().visible&&g.fx.snapshot().guardVisible&&g.f.a.sentries.group.getChildren()[0].alpha===0&&!g.f.a.defenseGraphic.visible;}));
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]){
   await page.setViewportSize({width,height});
   for(const quality of ['standard','low']){
    await page.locator('#quality').selectOption(quality);await page.waitForTimeout(100);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollHeight>innerHeight,buttons:[...document.querySelectorAll('button,select')].map(el=>{const r=el.getBoundingClientRect();return {h:r.height,left:r.left,right:r.right,bottom:r.bottom};}),canvas:document.querySelector('canvas').width,stage:document.querySelector('#stage').clientWidth,zoom:window.g6.f.a.cameras.getCamera('g6-close-up').width}));
    const density=quality==='standard'?2:1;
    check(`${width}×${height} ${quality}布局与密度`,!layout.overflow&&layout.buttons.every(b=>b.h>=44&&b.left>=0&&b.right<=width&&b.bottom<=height)&&layout.canvas===Math.round(layout.stage*density)&&Math.abs(layout.zoom-Math.min(132,layout.stage*.34)*density)<1,layout);
    await page.screenshot({path:path.join(output,`${width}-${quality}.png`)});
   }
  }
  await page.locator('#pause').click();await page.waitForFunction(()=>!window.g6.f.battle.snapshot().engine.paused);
  await page.evaluate(()=>window.g6.f.a.incomingEnemyDamage(1000));
  await page.waitForFunction(()=>window.g6.f.battle.snapshot().result==='death');await page.waitForTimeout(300);
  check('真实终局清待播反馈并停止动作',await page.evaluate(()=>{const g=window.g6,s=g.fx.snapshot();return s.pendingTimers===0&&s.pendingHealing===0&&s.activeEffects===0&&g.cat.snapshot().paused&&document.querySelector('#pause').disabled&&document.querySelector('#status').textContent.includes('已结束');}));
  const counts=[];
  for(let i=0;i<20;i++){
   await page.evaluate(()=>window.g6.start());await page.waitForTimeout(40);
   counts.push(await page.evaluate(()=>{const g=window.g6;return {children:g.f.a.children.length,fx:g.fx.snapshot().objects,body:g.f.a.physics.world.bodies.size,cat:g.cat.snapshot().visualObjects};}));
  }
  check('真实Arena重开20次对象有界',counts.every(c=>c.children===counts[0].children&&c.body===counts[0].body&&c.fx===counts[0].fx&&c.cat===4),counts);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#quality').selectOption('standard');
  for(const [id,weapon] of [['CAT02','W04'],['CAT03','W02']]){
   await page.locator('#cat').selectOption(id);
   await page.waitForFunction(id=>window.g6.f.session.runConfig.catId===id&&!document.querySelector('#cat').disabled,id);
   const before=await page.evaluate(()=>window.g6.f.battle.snapshot().player);
   await page.keyboard.down('s');
   await page.waitForFunction(()=>window.g6.heldWalk.snapshot().walkVisible);
   await page.waitForTimeout(140);
   const moving=await page.evaluate(()=>{const g=window.g6;return {
    held:g.heldWalk.snapshot(),original:g.f.a.heldArt.snapshot(),player:g.f.battle.snapshot().player,
    radius:g.f.a.cat.body.halfWidth,spirit:g.fx.snapshot().spiritVisible
   };});
   check(`${id} 使用36u原角色、固定武器及独立步态`,
    moving.held.walkVisible&&moving.held.walkFrames>0&&moving.original.catId===id&&moving.original.weaponId===weapon&&moving.original.display.width===36&&moving.radius===12&&moving.player.y>before.y,moving);
   check(`${id} 原生星灵归属`,moving.spirit===(id==='CAT03'));
   await page.screenshot({path:path.join(output,`${id}-walk.png`)});
   await page.keyboard.up('s');
   await page.waitForFunction(()=>!window.g6.heldWalk.snapshot().walkVisible);
   check(`${id} 松手还原站姿`,true);
  }
  await page.waitForFunction(()=>window.g6.f.session.sustainSnapshot().reloadStarts>0);
  check('满盾装填没有补盾表现',await page.evaluate(()=>window.g6.fx.snapshot().reloadBursts===0&&window.g6.f.session.sustainSnapshot().shieldRecoveredTotal===0));
  await page.waitForFunction(()=>{const g=window.g6;return g.f.a.sentries.snapshot().station?.attached&&g.f.session.ammo>=2&&g.fx.snapshot().spiritShots>0;});
  const deployment=await page.evaluate(()=>window.g6.f.a.sentries.snapshot().station.id);
  check('墨团星灵与堡垒同时存在',await page.evaluate(()=>{const fx=window.g6.fx.snapshot();return fx.spiritVisible&&fx.guardAttached;}));
  await page.locator('#break').click();
  await page.waitForFunction(id=>{const g=window.g6,s=g.f.a.sentries.snapshot().station;return s?.id===id&&!s.attached&&g.fx.snapshot().guardVisible&&!g.fx.snapshot().guardAttached;},deployment);
  const landed=await page.evaluate(()=>window.g6.f.a.sentries.snapshot().station);
  await page.keyboard.down('w');await page.waitForTimeout(220);await page.keyboard.up('w');
  check('破盾后同一座堡垒留在落地点',await page.evaluate(landed=>{const g=window.g6,s=g.f.a.sentries.snapshot().station;return s?.id===landed.id&&!s.attached&&s.x===landed.x&&s.y===landed.y&&Math.hypot(s.x-g.f.a.cat.body.center.x,s.y-g.f.a.cat.body.center.y)>10;},landed));
  await page.screenshot({path:path.join(output,'CAT03-landed.png')});
  await page.waitForFunction(()=>window.g6.fx.snapshot().reloadBursts===1);
  check('末发实际补盾与同座再附着',await page.evaluate(id=>{const g=window.g6,fx=g.fx.snapshot(),s=g.f.session,station=g.f.a.sentries.snapshot().station;
   return s.reloadLeft>0&&fx.lastReloadAmount===s.sustainSnapshot().shieldRecoveredTotal&&Math.abs(fx.lastReloadAmount-3.6)<1e-8&&fx.guardAttached&&station?.id===id&&station.attached;
  },deployment));
  await page.screenshot({path:path.join(output,'CAT03-reload.png')});
  check('实时切回新版不重播已有护盾和守卫入场',await page.evaluate(()=>{
   const g=window.g6;
   g.setMode(false);g.setMode(true);
   return g.fx.shield.scaleX===1&&g.fx.hull.alpha===1&&g.fx.snapshot().guardAttached;
  }));
  await page.locator('#pause').click();
  const frozenEffects=await page.evaluate(()=>window.g6.fx.snapshot());
  await page.locator('#mode').click();
  check('墨团暂停切旧版保留原星灵',await page.evaluate(()=>window.g6.f.a.spirit.visible&&!window.g6.fx.snapshot().spiritVisible));
  await page.locator('#mode').click();
  check('墨团暂停切回精修版不补播',await page.evaluate(frozen=>{const g=window.g6,fx=g.fx.snapshot();return fx.spiritVisible&&!g.f.a.spirit.visible&&fx.spiritShots===frozen.spiritShots&&fx.reloadBursts===frozen.reloadBursts&&fx.activeEffects===0;},frozenEffects));
  await page.screenshot({path:path.join(output,'CAT03-fortress.png')});
  await page.locator('#pause').click();await page.waitForFunction(()=>!window.g6.f.battle.snapshot().engine.paused);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>window.g6.f.battle.snapshot().engine.paused);
  check('失焦清未播治疗',await page.evaluate(()=>window.g6.fx.snapshot().pendingHealing===0));
  await page.locator('#pause').click();await page.waitForFunction(()=>!window.g6.f.battle.snapshot().engine.paused);
  await page.evaluate(()=>{const s=window.g6.f.session;s.advance(s.runConfig.durationSeconds);});
  await page.waitForFunction(()=>window.g6.f.battle.snapshot().result==='timeout');
  check('正盾超时终局收起盾与伙伴',await page.evaluate(()=>{
   const g=window.g6,fx=g.fx.snapshot();
   return g.f.session.defenseSnapshot().shield>0&&!fx.shieldVisible&&!fx.guardVisible&&!fx.spiritVisible&&!g.f.a.spirit.visible&&fx.activeEffects===0;
  }));
  check('无页面异常',errors.length===0,errors);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({environment:'Windows native Chrome headless, DPR2; controlled Scene, NOT phone',url:base,results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,output}));
 }catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),results,errors},null,2));throw error;}
 finally{await browser.close();}
})();
