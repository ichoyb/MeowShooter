// Controlled native Canvas/Arcade checks via the existing isolated flight fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.ENTRY_CHECK_DIR||'../.local/checks/enemy-boundary-20261102'),url=process.env.ENTRY_PREVIEW_URL||'http://127.0.0.1:8956/flight-sample.html';
const checks=[],errors=[];let browser;
fs.mkdirSync(out,{recursive:true});
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height]of (process.env.ENTRY_RED?[[390,844]]:[[320,568],[360,640],[390,844],[430,932]]))for(const dpr of (process.env.ENTRY_RED?[2]:[1,2,3]))for(const quality of (process.env.ENTRY_RED?['standard']:['standard','low'])){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.flightReady||window.flightBootError);assert.equal(await p.evaluate(()=>window.flightBootError),undefined);await p.selectOption('#quality',quality);await p.selectOption('#scheme','baseline');await p.click('#start');await p.waitForFunction(()=>!!document.getElementById('stage').dataset.state);await p.click('#pause');
  const result=await p.evaluate(({width,height,dpr,quality})=>{
   const f=window.flightFixture,a=f.a,g=f.g,rows=[];g.loop.sleep();
   const check=(name,pass,value)=>rows.push({name:`${width}x${height}dpr${dpr}${quality} ${name}`,pass:!!pass,value});
   const originalCameras=a.cameras.cameras.slice(),cam=a.cameras.main;cam.preRender();a.syncCourtyardBackground();
   const corner=cam.getWorldPoint(0,0),full=a.cameras.add(0,0,g.canvas.width,g.canvas.height,false,'reference-full-world').setOrigin(0,0).setZoom(cam.zoomX,cam.zoomY).setScroll(corner.x,corner.y).setBackgroundColor(a.backgroundCamera.backgroundColor.rgba);full.preRender();
   const renderer=g.renderer,context=g.context,w=g.canvas.width,h=g.canvas.height;
   const pixels=(root,reference)=>{const render=list=>{context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,w,h);for(const camera of reference?[full]:originalCameras)renderer.render(a,list.filter(object=>object.willRender(camera)),camera);return context.getImageData(0,0,w,h).data;};const empty=render([]),actual=render([root]);let count=0;for(let i=0;i<actual.length;i+=4)if(actual[i]!==empty[i]||actual[i+1]!==empty[i+1]||actual[i+2]!==empty[i+2])count++;return count;};
   const points=[[w/2,3*cam.zoomY],[w/2,h-3*cam.zoomY],[3*cam.zoomX,h/2],[w-3*cam.zoomX,h/2],[3*cam.zoomX,3*cam.zoomY],[w-3*cam.zoomX,h-3*cam.zoomY],[w/2,h/2]];
   for(const id of ['E01','E03','E04','EL01','B01'])for(const [x,y]of points){
    for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);
    const point=cam.getWorldPoint(x,y),enemy=a.placeSliceEnemy(id,point.x,point.y),art=enemy.getData('art');art.sync(enemy.body.center.x,enemy.body.center.y,enemy.getData('behavior'));const root=art.root,actual=pixels(root,false),reference=pixels(root,true);
    check(id+' remains rendered to physical canvas edge '+x.toFixed(1)+','+y.toFixed(1),enemy.active&&enemy.getData('hp')>0&&root.visible&&reference>0&&Math.abs(actual-reference)<=2,{actual,reference,point});
   }
   a.cameras.remove(full);
   return rows;
  },{width,height,dpr,quality});checks.push(...result);await ctx.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.flightReady);await p.selectOption('#scheme','baseline');await p.click('#start');await p.waitForFunction(()=>!!window.flightFixture.session);await p.click('#pause');
 const entry=await p.evaluate(()=>{
  const f=window.flightFixture,a=f.a,g=f.g,wake=g.loop.wake.bind(g.loop),special=a.trySpecialSpawn,rows=[];g.loop.sleep();let time=0;
  const check=(name,pass,value)=>rows.push({name,pass:!!pass,value});
  const step=(n=1)=>{for(let i=0;i<n;i++){time+=1000/60;g.scene.update(time,1000/60);g.scene.processQueue();}};
  const start=()=>{g.loop.wake=()=>{};f.battle.start({...f.config('CAT01'),projectileFlight:{enabled:true}});g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];step();f.session.cooldown=99999;};
  for(const point of [{x:-48,y:720},{x:768,y:720},{x:360,y:-48},{x:360,y:1488}]){
   start();const enemy=a.placeSliceEnemy('E01',point.x,point.y);enemy.setData('hp',100000);const initial={x:enemy.body.center.x,y:enemy.body.center.y};check('exterior birth is not clamped '+JSON.stringify(point),Math.hypot(initial.x-point.x,initial.y-point.y)<.0001&&!enemy.body.collideWorldBounds&&enemy.getData('entering'),initial);
   step(5);const early={x:enemy.body.center.x,y:enemy.body.center.y};check('native entry walks without teleport '+JSON.stringify(point),Math.hypot(early.x-initial.x,early.y-initial.y)>0&&Math.hypot(early.x-initial.x,early.y-initial.y)<6&&enemy.active,early);
   step(160);check('full entry restores world collision '+JSON.stringify(point),!enemy.getData('entering')&&enemy.body.collideWorldBounds&&enemy.body.left>=0&&enemy.body.right<=720&&enemy.body.top>=0&&enemy.body.bottom<=1440,{x:enemy.body.center.x,y:enemy.body.center.y,collide:enemy.body.collideWorldBounds});
  }
  start();f.session.elapsed=400;const born=[];
  const random=Math.random;try{for(const seed of [.05,.3,.55,.8]){Math.random=()=>seed;if(a.spawnCourtyardEnemy('E01',born.length%2===0)){const enemy=a.enemies.getChildren().find(e=>e.active&&e.getData('id')===a.nextMob-1);born.push({x:enemy.body.center.x,y:enemy.body.center.y,entering:enemy.getData('entering')});}}}finally{Math.random=random;}
  check('ordinary and reinforcements originate outside the garden',born.length>0&&born.every(p=>(p.x<0||p.x>720||p.y<0||p.y>1440)&&p.entering),born);
  check('perimeter sampling can enter from all four courtyard sides',born.some(p=>p.x<0)&&born.some(p=>p.x>720)&&born.some(p=>p.y<0)&&born.some(p=>p.y>1440),born);
  for(const [at,id]of [[150,'EL01'],[450,'B01']]){
   start();f.session.elapsed=at;if(id==='B01'){a.level.markSpawned('EL01',150,900);a.level.defeated('EL01',151,undefined,900);a.level.markSpawned('EL01',300,901);a.level.defeated('EL01',301,undefined,901);}
   special.call(a);const e=a.enemies.getChildren().find(e=>e.active&&e.getData('enemyId')===id);check(id+' arrival starts beyond world without body clamp',e&&(e.body.center.x<0||e.body.center.x>720||e.body.center.y<0||e.body.center.y>1440)&&!e.body.enable&&e.getData('entering'),e&&{x:e.body.center.x,y:e.body.center.y,phase:e.getData('behavior').phase});
   if(e){const initial={x:e.body.center.x,y:e.body.center.y};step(30);check(id+' original arrival preparation stays frozen',!e.body.enable&&Math.hypot(initial.x-e.body.center.x,initial.y-e.body.center.y)<.0001,{phase:e.getData('behavior').phase});step(60);check(id+' exits preparation without teleport',e.body.enable&&e.getData('entering')&&Math.hypot(initial.x-e.body.center.x,initial.y-e.body.center.y)<30,{x:e.body.center.x,y:e.body.center.y});}
  }
  for(let i=0;i<20;i++){start();const e=a.placeSliceEnemy('E01',-48,720);start();check('restart'+i+' no entering body or stale presentation',a.enemies.countActive(true)===0&&a.enemies.getChildren().every(e=>!e.active),a.enemies.countActive(true));}
  return rows;
 });checks.push(...entry);assert.deepEqual(errors,[]);const failed=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'enemy-entry-scene.json'),JSON.stringify({status:failed.length?'FAIL':'PASS',browser:browser.version(),checks,errors,failed:failed.length,scope:'Controlled real Camera/Canvas/Arcade/Clock; not natural encounter balance or phone performance'},null,2));assert.equal(failed.length,0,JSON.stringify(failed.slice(0,3)));console.log('PASS enemy boundary/entry '+checks.length);
 }catch(error){fs.writeFileSync(path.join(out,'enemy-entry-failure.json'),JSON.stringify({error:String(error),stack:error.stack,checks,errors},null,2));console.error(error);process.exitCode=1;}finally{await browser?.close();}})();
