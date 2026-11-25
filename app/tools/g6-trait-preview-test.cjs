const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const url=process.env.G6_URL;
const output=path.resolve(process.env.G6_CHECK_DIR||'../.local/checks/g6-trait-browser');
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
 const wait=fn=>page.waitForFunction(fn,undefined,{timeout:14000});
 const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
 const ready=()=>wait(()=>window.g6Ready||window.g6Error);
 const select=async id=>{
  await page.locator('#build').selectOption(id);
  await page.waitForFunction(id=>document.querySelector('#build').value===id&&!document.querySelector('#build').disabled,id);
 };
 const chooseCat=async id=>{
  await page.locator('#cat').selectOption(id);
  await page.waitForFunction(id=>window.g6.f.session.runConfig.catId===id&&!document.querySelector('#cat').disabled,id);
 };
 const changeTargets=(points,markFirst=false)=>page.evaluate(({points,markFirst})=>{
  const {a}=window.g6.f;
  for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);
  const p=a.cat.body.center;
  const enemies=points.map(([dx,dy,hp])=>{
   const e=a.placeSliceEnemy('E01',p.x+dx,p.y+dy);
   e.setData('hp',hp);e.body.moves=false;
   return e;
  });
  if(markFirst){
   a.hunt?.clear();a.syncHunt();
   enemies[1].setData('hp',5000);
  }
  return enemies.map(e=>e.getData('id'));
 },{points,markFirst});
 const summary=()=>page.evaluate(()=>{
  const g=window.g6;
  return {flight:g.flight.snapshot(),hunt:g.huntContracts.snapshot(),battle:g.f.battle.snapshot()};
 });

 try{
  await page.goto(url);await ready();
  assert.equal(await page.evaluate(()=>window.g6Error),undefined);
  await wait(()=>window.g6.flight.snapshot().activeTrails>0);
  const returned=await summary();
  check('橘团返航短尾读真实存活回程弹',returned.flight.activeTrails===returned.battle.projectileFlight.returning&&returned.flight.returns>0&&!returned.flight.lastReturn.mirror);
  await shot('cat01-return');

  await select('ricochet');
  await changeTargets([[95,0,400],[112,39,400]]);
  await wait(()=>window.g6.flight.snapshot().ricochets>0);
  check('真实折射点和新方向',await page.evaluate(()=>{
   const {flight,f}=window.g6,m=flight.snapshot().lastRicochet;
   const native=f.a.projectiles.getChildren().find(p=>p.active&&p.getData('projectileId')===m.projectileId);
   return m.point.x>f.a.cat.body.center.x&&m.angle>0&&m.angle<Math.PI/2&&native?.getData('ricocheted');
  }));
  await shot('ricochet-turn');

  await chooseCat('CAT02');await select('mirror');
  await changeTargets([[70,0,500],[96,0,500],[122,0,500],[148,0,500]]);
  await wait(()=>window.g6.flight.snapshot().mirrorReturns>0);
  const mirror=await page.evaluate(()=>{
   const g=window.g6;
   return {flight:g.flight.snapshot(),battle:g.f.battle.snapshot(),catX:g.f.a.cat.body.center.x};
  });
  check('雪团实际镜面回程切换',mirror.flight.lastReturn.mirror&&mirror.battle.projectileFlight.returns>0&&mirror.flight.activeShortEffects>0
   &&Math.abs(mirror.flight.lastReturn.point.x-mirror.catX)<160,mirror.flight.lastReturn);
  await shot('cat02-mirror');
  await wait(()=>window.g6.f.battle.snapshot().projectileFlight.returnHits>0);
  check('镜片与原生返程命中并存',true);

  await chooseCat('CAT03');await select('barrage');await changeTargets([[170,0,10000]]);
  await wait(()=>window.g6.flight.snapshot().lastRhythm?.step===3);
  const rhythm=await summary();
  check('墨团节律弹幕三个实际节拍',rhythm.flight.lastRhythm.steps===3&&rhythm.flight.rhythmShots===rhythm.battle.rhythm.emitted);
  await shot('cat03-rhythm');

  await select('rhythm');await changeTargets([[170,0,10000]]);
  await wait(()=>window.g6.flight.snapshot().rhythmShots>0);
  const simple=await summary();
  check('双击只消费一颗真实副弹',simple.flight.lastRhythm.steps===1&&!simple.flight.lastRhythm.retarget&&simple.flight.rhythmShots===simple.battle.rhythm.emitted);
  await select('offbeat');await changeTargets([[170,0,10000]]);
  await wait(()=>window.g6.f.battle.snapshot().rhythm.pending>0);
  await changeTargets([]);
  await wait(()=>window.g6.f.battle.snapshot().rhythm.pending===0);
  const silent=await summary();
  check('错峰重选无目标不播放',silent.battle.rhythm.triggers===1&&silent.battle.rhythm.emitted===0&&silent.flight.rhythmShots===0);
  await changeTargets([[150,0,10000]]);
  await wait(()=>window.g6.flight.snapshot().lastRhythm?.retarget===true);
  check('错峰在真正重选后播放',true);

  await chooseCat('CAT01');await select('tail');await changeTargets([[160,0,10000]]);
  await wait(()=>window.g6.flight.snapshot().tailRoots>0);
  const tail=await summary();
  check('尾弹本体与真实副弹分层',tail.flight.tailRoots===1&&tail.flight.echoShots===2&&tail.flight.lastEcho.volleyId===tail.flight.lastTail.volleyId);
  await select('cadence');await changeTargets([[160,0,10000]]);
  await wait(()=>window.g6.flight.snapshot().lastOpening?.step===3);
  const cadence=await summary();
  check('连奏在实际装填后的三次齐射展开',cadence.flight.openingVolleys===3&&cadence.flight.openingShots===9);

  await select('transfer');
  const ids=await changeTargets([[94,0,25],[135,20,20]],true);
  await wait(()=>window.g6.huntContracts.snapshot().markedId!==null);
  await page.waitForFunction(id=>window.g6.huntContracts.snapshot().markedId===id,ids[0],{timeout:10000});
  await shot('hunt-mark');
  await wait(()=>window.g6.huntContracts.snapshot().counts.transfers>0);
  const transfer=await summary();
  check('真实死亡传承且只留实际剩余时间',transfer.hunt.counts.transfers===transfer.battle.huntingMark.transfers&&transfer.battle.huntingMark.transferred&&transfer.battle.huntingMark.targetId===ids[1]&&transfer.battle.huntingMark.remainingSeconds<4);
  await shot('hunt-transfer');
  await page.locator('#pause').click();
  check('同局暂停切回原标记，清除短效且规则状态不动',await page.evaluate(()=>{
   const g=window.g6,a=g.f.a;
   const before=JSON.stringify(g.f.battle.snapshot());
   g.setMode(false);
   const old=a.hunt.graphic.visible;
   g.setMode(true);
   return old&&!a.hunt.graphic.visible&&g.huntContracts.snapshot().activeTransients===0&&before===JSON.stringify(g.f.battle.snapshot());
  }));

  await select('spell');await changeTargets([[95,0,10000]]);
  await wait(()=>window.g6.huntContracts.snapshot().counts.skill>0);
  const spell=await summary();
  check('术式强调读实际脉冲记录',spell.hunt.counts.skill===spell.battle.areaAbilities.casts&&spell.hunt.counts.weapon===0);
  await shot('spell-pulse');
  await select('weapon');await changeTargets([[95,0,10000]]);
  await wait(()=>window.g6.huntContracts.snapshot().counts.weapon>0);
  const weapon=await summary();
  check('纯粹火力仅强调已出膛主弹',weapon.hunt.counts.skill===0&&weapon.hunt.counts.weapon<=weapon.battle.sourceCounts.PRIMARY);
  await shot('weapon-accent');

  await select('root');await changeTargets([]);
  await wait(()=>window.g6.huntContracts.snapshot().stance==='rooted');
  check('扎根刻度满时实际倍率1.4',await page.evaluate(()=>window.g6.f.session.contractSnapshot().stance===1.4));
  await shot('root-ready');
  await page.keyboard.down('d');
  await wait(()=>window.g6.f.session.contractSnapshot().moving&&window.g6.huntContracts.snapshot().stance===null);
  check('扎根移动立刻收起',await page.evaluate(()=>window.g6.f.session.contractSnapshot().stance===.8));
  await page.keyboard.up('d');
  await wait(()=>window.g6.huntContracts.snapshot().stance==='charging');
  check('停下先蓄势再扎根',await page.evaluate(()=>window.g6.f.session.contractSnapshot().stance===1));
  await select('dash');await changeTargets([]);
  await page.keyboard.down('d');
  await wait(()=>window.g6.huntContracts.snapshot().stance==='dash');
  check('疾驰仅跟实际自主位移',await page.evaluate(()=>window.g6.f.session.contractSnapshot().stance===1.25));
  await shot('dash-active');
  await wait(()=>window.g6.f.session.elapsed>2&&!window.g6.f.session.contractSnapshot().moving&&window.g6.huntContracts.snapshot().stance===null);
  check('顶墙无实际位移时取消疾驰',await page.evaluate(()=>window.g6.f.session.contractSnapshot().stance===.8));
  await page.keyboard.up('d');

  await select('return');await wait(()=>window.g6.flight.snapshot().activeTrails>0);
  await page.locator('#pause').click();
  check('旧版无新增尾迹；同局切回只显示当前飞行',await page.evaluate(()=>{
   const g=window.g6,before=JSON.stringify(g.f.battle.snapshot());
   g.setMode(false);const hidden=g.flight.snapshot().activeTrails===0;
   g.setMode(true);
   return hidden&&g.flight.snapshot().activeTrails===g.f.battle.snapshot().projectileFlight.returning&&g.flight.snapshot().activeShortEffects===0&&before===JSON.stringify(g.f.battle.snapshot());
  }));
  await page.locator('#quality').selectOption('low');
  check('低档保留短尾',await page.evaluate(()=>window.g6.flight.snapshot().quality==='low'&&window.g6.flight.snapshot().activeTrails>0));
  await page.locator('#start').click();
  await wait(()=>!document.querySelector('#cat').disabled);
  check('重开清效果计数并复用图层',await page.evaluate(()=>{
   const g=window.g6,f=g.flight.snapshot(),h=g.huntContracts.snapshot();
   return f.activeTrails===0&&f.returns===0&&f.activeShortEffects===0&&f.physicalBodies===0&&f.objects===17&&h.activeTransients===0;
  }));
  check('浏览器无脚本异常',errors.length===0,errors);
 }catch(error){
  errors.push(String(error));await shot('failure').catch(()=>{});throw error;
 }finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({url,browser:browser.version(),passed:results.filter(r=>r.pass).length,results,errors},null,2)+'\n');
  await browser.close();
 }
 console.log(JSON.stringify({passed:results.length,output}));
})().catch(error=>{console.error(error);process.exitCode=1;});
