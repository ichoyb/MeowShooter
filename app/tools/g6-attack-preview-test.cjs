const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const url=process.env.G6_URL;
const output=path.resolve(process.env.G6_CHECK_DIR||'../.local/checks/g6-attack-browser');
if(!url)throw Error('G6_URL required');
fs.mkdirSync(output,{recursive:true});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-renderer-backgrounding']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const check=(name,pass,detail)=>{
  results.push({name,pass,detail});
  assert.ok(pass,name);
 };
 const wait=fn=>page.waitForFunction(fn,undefined,{timeout:11000});
 const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
 const select=async id=>{
  await page.locator('#build').selectOption(id);
  await page.waitForFunction(id=>document.querySelector('#build').value===id&&!document.querySelector('#build').disabled,id);
 };
 const clearEnemies=()=>page.evaluate(()=>{
  const {a}=window.g6.f;
  for(const enemy of a.enemies.getChildren())if(enemy.active)a.recycle(enemy,a.enemies);
 });
 try{
  await page.goto(url);
  await wait(()=>window.g6Ready||window.g6Error);
  assert.equal(await page.evaluate(()=>window.g6Error),undefined);
  for(const [preset,count] of [['orbit1',2],['orbit2',3],['orbit3',4]]){
   await select(preset);
   await page.waitForFunction(count=>window.g6.bells.snapshot().orbitCount===count,count);
   const state=await page.evaluate(()=>{const g=window.g6;return {fx:g.bells.snapshot(),real:g.f.a.abilities.snapshot(),width:g.cat.snapshot().bodyDisplay.width,radius:g.f.a.cat.body.halfWidth};});
   check(preset+' 真实枚数、基础半径和36u角色',state.fx.orbitCount===count&&state.real.orbits.length===count&&state.fx.orbitRadius===60&&state.width===36&&state.radius===12);
  }
  await wait(()=>window.g6.bells.snapshot().orbitFlashes>0);
  check('真实环铃命中才触发局部闪光',await page.evaluate(()=>{const g=window.g6;return g.bells.snapshot().orbitFlashes===g.f.a.abilities.state.orbitHits;}));
  await shot('orbit-four');
  await select('star');
  await page.locator('#xp').click();
  await wait(()=>window.g6.bells.snapshot().orbitRadius>=79.99);
  check('实际收集经验扩出星环并保留4枚',await page.evaluate(()=>{const g=window.g6,b=g.bells.snapshot();return g.f.a.pickups.snapshot().collectedXP>=8&&b.starActive&&b.orbitCount===4&&b.orbitRadius===g.f.a.abilities.snapshot().orbitRadius;}));
  await shot('star-ring');
  await wait(()=>{const b=window.g6.bells.snapshot();return !b.starActive&&b.orbitRadius===60;});
  check('星环到期收回实际60u轨迹',true);
  await page.locator('#pause').click();
  check('同局切版保留原环铃与规则相位',await page.evaluate(()=>{
   const g=window.g6, before=JSON.stringify(g.f.a.abilities.snapshot());
   g.setMode(false);
   const original=g.f.a.abilities.orbits.getChildren().filter(b=>b.active).every(b=>b.visible);
   g.setMode(true);
   return original&&before===JSON.stringify(g.f.a.abilities.snapshot())&&g.bells.snapshot().activeEffects===0;
  }));
  await select('trail');
  await clearEnemies();
  await page.keyboard.down('d');
  await wait(()=>window.g6.bells.snapshot().landings===1);
  await page.keyboard.up('d');
  await wait(()=>window.g6.bells.snapshot().armedTrails===1);
  check('真实走位布置且原生计时布防',await page.evaluate(()=>{const g=window.g6,t=g.f.a.abilities.snapshot().trails[0],b=g.bells.snapshot();return b.landings===1&&t.armed&&b.lastLanding.birth===t.birth;}));
  await shot('trail-armed');
  await page.evaluate(()=>{
   const {a}=window.g6.f;
   const t=a.abilities.snapshot().trails[0];
   a.placeSliceEnemy('E01',t.x+13,t.y);
  });
  await wait(()=>window.g6.bells.snapshot().trailBlasts===1);
  check('实际引爆位置与42u范围',await page.evaluate(()=>{const g=window.g6,b=g.bells.snapshot();return b.lastBlast.birth===b.lastLanding.birth&&b.lastBlast.blastRadius===42&&b.lastBlast.x===b.lastLanding.x&&g.f.a.abilities.state.explosions===1;}));
  await shot('trail-blast');
  await clearEnemies();
  check('满6替换只淡出',await page.evaluate(()=>{
   const g=window.g6,a=g.f.a.abilities,before=g.bells.snapshot().trailBlasts;
   for(let i=0;i<7;i++)a.place({x:300+i*18,y:650},12);
   const b=g.bells.snapshot();
   return a.snapshot().trails.length===6&&b.replacements===1&&b.trailBlasts===before;
  }));
  await select('sprint');
  await wait(()=>window.g6.f.session.reloadLeft>0&&window.g6.f.a.abilities.snapshot().trailThreshold===60);
  check('疾走铃阵读真实装填距离',true);
  await select('area');
  await wait(()=>window.g6.areas.snapshot().played.pulse>0);
  check('普通脉冲即时48u',await page.evaluate(()=>{const g=window.g6,p=g.areas.snapshot().last,r=g.f.a.areas.snapshot().lastPulse;return p.style==='pulse'&&p.radius===48&&p.x===r.x&&p.y===r.y;}));
  check('切回旧版不露出已过的原生短效',await page.evaluate(()=>{
   const g=window.g6,a=g.f.a.areas,last=JSON.stringify(a.snapshot().lastPulse);
   const hadInk=a.pulse.commandBuffer.length>0;
   g.setMode(false);
   const clear=!a.pulse.visible&&a.pulse.commandBuffer.length===0;
   g.setMode(true);
   return hadInk&&clear&&JSON.stringify(a.snapshot().lastPulse)===last&&g.areas.snapshot().shortEffects===0;
  }));
  await select('fusion');
  await wait(()=>window.g6.f.session.elapsed>=4.45);
  await page.locator('#wave').click();
  await wait(()=>window.g6.areas.snapshot().anchorId!==null);
  await shot('anchor');
  await wait(()=>window.g6.areas.snapshot().played.fused>0);
  check('融合脉冲落在真实锚点',await page.evaluate(()=>{const g=window.g6,s=g.f.a.areas.snapshot(),p=g.areas.snapshot().last;return p.style==='fused'&&p.x===s.anchor.x&&p.y===s.anchor.y&&p.radius===s.lastPulse.radius;}));
  await shot('fused-pulse');
  await wait(()=>window.g6.areas.snapshot().played.collapse>0);
  check('锚点到期真实60u爆发',await page.evaluate(()=>{const g=window.g6,p=g.areas.snapshot().last;return p.style==='collapse'&&p.radius===60&&g.f.a.areas.snapshot().lastBurst.radius===p.radius;}));
  await select('shock');
  await wait(()=>window.g6.areas.snapshot().played.shock>0);
  check('主弹真实触发32u震荡',await page.evaluate(()=>{const p=window.g6.areas.snapshot().last;return p.style==='shock'&&p.radius===32;}));
  await shot('shock');
  const beforeDouble=await page.evaluate(()=>{
   const g=window.g6,{a,session}=g.f;
   for(const mob of a.enemies.getChildren())if(mob.active)a.recycle(mob,a.enemies);
   for(const shot of a.projectiles.getChildren())if(shot.active)a.recycle(shot,a.projectiles);
   const weapon=session.effectiveConfig.weapon,p=a.cat.body.center;
   // Two distinct root volleys with symmetric short flights hit in one physics step.
   for(const sign of [-1,1]){
    const mob=a.placeSliceEnemy('E01',p.x+sign*78,p.y);
    mob.body.moves=false;
    const center=mob.body.center;
    a.projectile({x:center.x-sign*13,y:center.y},sign>0?0:Math.PI,'bell','PRIMARY',200000+sign,weapon.damage,0,weapon.bulletSpeed,weapon.bulletLifeSeconds);
   }
   return g.areas.snapshot().played.shock;
  });
  await page.waitForFunction(n=>window.g6.areas.snapshot().played.shock>=n+2,beforeDouble);
  check('两颗真实主弹同帧震荡保留两处边界',await page.evaluate(()=>window.g6.areas.snapshot().activeShocks>=2));
  for(const id of ['CAT02','CAT03']){
   await page.locator('#cat').selectOption(id);
   await page.waitForFunction(id=>window.g6.f.session.runConfig.catId===id&&!document.querySelector('#cat').disabled,id);
   check(id+' 保留36u造型与12u实际判定',await page.evaluate(()=>{const g=window.g6;return g.f.a.heldArt.snapshot().display.width===36&&g.f.a.cat.body.halfWidth===12;}));
  }
  await select('mixed');
  await page.locator('#quality').selectOption('low');
  await wait(()=>window.g6.f.session.elapsed>=1);
  await page.locator('#xp').click();
  await wait(()=>window.g6.bells.snapshot().starActive&&window.g6.areas.snapshot().played.pulse>0);
  check('低档保留星环和实际脉冲',await page.evaluate(()=>window.g6.bells.snapshot().orbitCount===4&&window.g6.f.a.areas.snapshot().lastPulse.radius===48));
  await page.locator('#pause').click();
  check('暂停收起攻击短效',await page.evaluate(()=>window.g6.bells.snapshot().activeEffects===0&&window.g6.areas.snapshot().shortEffects===0));
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]){
   await page.setViewportSize({width,height});
   for(const quality of ['standard','low']){
    await page.locator('#quality').selectOption(quality);
    check(width+'×'+height+' '+quality+' 控件可达',await page.evaluate(()=>[...document.querySelectorAll('select,button')].every(el=>{
     const r=el.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
    })));
   }
  }
  await page.evaluate(()=>window.g6.start());
  const objects=await page.evaluate(()=>window.g6.f.a.children.getChildren().length);
  for(let i=0;i<20;i++)await page.evaluate(()=>window.g6.start());
  check('20次重开短效归零且表现对象数固定',await page.evaluate(objects=>{
   const g=window.g6,b=g.bells.snapshot(),a=g.areas.snapshot();
   return g.f.a.children.getChildren().length===objects&&b.activeEffects===0&&a.shortEffects===0&&b.physicalBodies+a.physicalBodies===0;
  },objects));
  await wait(()=>window.g6.f.session.elapsed>=4.45);
  await page.locator('#wave').click();
  await wait(()=>window.g6.areas.snapshot().anchorId!==null&&window.g6.bells.snapshot().orbitCount===4);
  await page.evaluate(()=>{const s=window.g6.f.session;s.advance(s.runConfig.durationSeconds);});
  await wait(()=>window.g6.f.battle.snapshot().result==='timeout');
  check('真实终局清空在场环铃、锚点及短效',await page.evaluate(()=>{
   const g=window.g6,b=g.bells.snapshot(),a=g.areas.snapshot();
   return b.orbitCount===0&&b.trailCount===0&&b.activeEffects===0&&a.anchorId===null&&a.shortEffects===0;
  }));
  check('无页面异常',errors.length===0,errors);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({url,environment:'Windows desktop Chrome, DPR 2',results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,output}));
 }catch(error){
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),results,errors},null,2));
  throw error;
 }finally{await browser.close();}
})();
