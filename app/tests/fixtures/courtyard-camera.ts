import {createBattle} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
declare function require(path:string):any;
const factory=require('phaser/src/gameobjects/GameObjectFactory');
const w=window as any,stage=document.getElementById('stage')!,button=document.getElementById('run-checks') as HTMLButtonElement,out=document.getElementById('checks-result')!;
const checks:any[]=[];
function check(name:string,ok:unknown,observed:unknown){checks.push({name,status:ok?'PASS':'FAIL',observed:JSON.parse(JSON.stringify(observed))});out.textContent=JSON.stringify({status:'RUNNING',checks},null,2);if(!ok)throw Error(name);}
const img=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function boot(){
 const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>img('assets/ui/'+id+'.png')));
 // Test-only native factory observation; never rewrite the application source.
 const original=factory.prototype.graphics;
 factory.prototype.graphics=function(...args:any[]){w.qaArena=this.scene;return original.apply(this,args);};
 let battle:Awaited<ReturnType<typeof createBattle>>;
 try{battle=await createBattle(stage,{onState(){},onInterrupt(){},onFinish(){}},{CAT01,CAT02,CAT03});}
 finally{factory.prototype.graphics=original;}
 const a=w.qaArena,g=a.game,wake=g.loop.wake.bind(g.loop),originalMain=a.cameras.main,originalDefault=a.cameras.default;g.loop.sleep();let now=0;
 w.qaPosition=(sprite:any,x:number,y:number)=>{const body=sprite.body;body.reset(x,y);body.updateFromGameObject();body.prev.copy(body.position);body.prevFrame.copy(body.position);};
 const step=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;g.scene.update(now,1000/60);}};
 const render=()=>{g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();};
 const projection=(camera:any,x:number,y:number)=>camera.matrix.transformPoint(x-camera.scrollX,y-camera.scrollY);
 const pixelsCoverBackground=(pixels:any[])=>pixels.length===5&&pixels.every(pixel=>pixel.rgba[3]===255&&
  !(pixel.rgba[0]===229&&pixel.rgba[1]===237&&pixel.rgba[2]===218));
 function backgroundPixels(){
  const visibility=a.cameras.cameras.map((camera:any)=>({camera,visible:camera.visible}));
  try{
   for(const {camera} of visibility)if(camera!==a.backgroundCamera)camera.setVisible(false);
   render();const context=g.canvas.getContext('2d');
   return [[1,1],[g.canvas.width-2,1],[1,g.canvas.height-2],[g.canvas.width-2,g.canvas.height-2],[Math.floor(g.canvas.width/2),Math.floor(g.canvas.height/2)]]
    .map(([x,y])=>({x,y,rgba:Array.from(context.getImageData(x,y,1,1).data)}));
  }finally{
   for(const {camera,visible} of visibility)camera.setVisible(visible);
   render();
  }
 }
 function backgroundState(){
  const main=a.cameras.main,bg=a.backgroundCamera,map=a.scenery.map;
  const points=[[0,0],[g.canvas.width,0],[0,g.canvas.height],[g.canvas.width,g.canvas.height],[g.canvas.width/2,g.canvas.height/2]];
  const errors=points.map(([x,y])=>{const world=main.getWorldPoint(x,y),other=bg.getWorldPoint(x,y),p=projection(bg,world.x,world.y);return Math.max(Math.abs(world.x-other.x),Math.abs(world.y-other.y),Math.abs(p.x-x),Math.abs(p.y-y));});
  const first=bg.getWorldPoint(0,0),last=bg.getWorldPoint(g.canvas.width,g.canvas.height);
  const pixels=backgroundPixels();
  return {viewport:{x:bg.x,y:bg.y,width:bg.width,height:bg.height},zoom:bg.zoom,errors,pixels,
   covered:map.x<=first.x&&map.y<=first.y&&map.x+map.displayWidth>=last.x&&map.y+map.displayHeight>=last.y,
   art:{x:map.x,y:map.y,width:map.displayWidth,height:map.displayHeight},
   patchCanvas:{width:map.texture.source[0].width,height:map.texture.source[0].height},
   layers:{background:bg.renderList.map((object:any)=>object.type),main:main.renderList.map((object:any)=>object.type),screen:a.screenCamera.renderList.map((object:any)=>object.type)}};
 }
 function checkBackground(name:string){
  render();const state=backgroundState(),bg=a.backgroundCamera,main=a.cameras.main,art=state.art;
  check(name,state.viewport.x===0&&state.viewport.y===0&&state.viewport.width===g.canvas.width&&state.viewport.height===g.canvas.height&&bg.zoom===main.zoom&&state.errors.every((error:number)=>error<.001)&&state.covered&&pixelsCoverBackground(state.pixels)&&state.patchCanvas.width===512&&state.patchCanvas.height===1024,state);
 }
 function start(cat='CAT01'){
  const run=makeRunConfig(cat as any,({CAT01:'W01',CAT02:'W04',CAT03:'W02'} as any)[cat],'p2-basic');
  g.loop.wake=()=>{};battle.start(Object.freeze({...run,scenario:Object.freeze({...run.scenario,spawnIntervalSeconds:10000})}));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
  battle.setBounds({top:110,bottom:720});battle.setInputArea({left:0,right:360,top:110,bottom:760},battle.cssPixelsPerLogicalUnit,[]);
  for(const group of [a.enemies,a.objects,a.projectiles])for(const actor of group.getChildren())a.recycle(actor,group);
  a.cameras.main.preRender();a.screenCamera.preRender();
 }
 button.disabled=false;out.textContent='已准备，点击运行检查。';
 button.addEventListener('click',()=>{button.disabled=true;checks.length=0;try{
  start();check('fixed 720x1440 world and unchanged physical radius',battle.snapshot().engine.world.width===720&&battle.snapshot().engine.world.height===1440&&battle.snapshot().engine.bodies.cat.radius===12,battle.snapshot().engine);
  check('background, unchanged native main, screen cameras in render order',a.backgroundCamera&&a.cameras.main===originalMain&&a.cameras.default===originalDefault&&a.cameras.main._follow===a.cat&&a.cameras.cameras.length===3&&a.cameras.cameras[0]===a.backgroundCamera&&a.cameras.cameras[1]===a.cameras.main&&a.cameras.cameras[2]===a.screenCamera&&!a.backgroundCamera.inputEnabled&&!a.backgroundCamera._follow,{follow:a.cameras.main._follow===a.cat,cameras:a.cameras.cameras.map((camera:any)=>camera.name),background:!!a.backgroundCamera});
  checkBackground('full buffer background covers top and bottom at identical world phase');
  let uncovered:any[]=[];const backgroundVisible=a.backgroundCamera.visible;
  try{a.backgroundCamera.setVisible(false);uncovered=backgroundPixels();}finally{a.backgroundCamera.setVisible(backgroundVisible);render();}
  const recovered=backgroundPixels();
  check('five point pixel coverage rejects native clear without background and accepts restored background',!pixelsCoverBackground(uncovered)&&uncovered.every(pixel=>pixel.rgba[0]===229&&pixel.rgba[1]===237&&pixel.rgba[2]===218&&pixel.rgba[3]===255)&&pixelsCoverBackground(recovered),{uncovered,recovered,rejectsMissingBackground:!pixelsCoverBackground(uncovered),acceptsRestoredBackground:pixelsCoverBackground(recovered)});
  check('approved 58u character and native body centered',a.cat.displayWidth===58&&Math.abs(a.cat.body.center.x-360)<.001&&Math.abs(a.cat.body.center.y-720)<.001,battle.snapshot().player);
  const hudPointer={id:77,wasTouch:true,wasCanceled:false,isDown:true,x:180*a.cameras.main.zoom,y:50*a.cameras.main.zoom};
  a.onPointerDown(hudPointer);check('screen HUD band cannot acquire movement ownership',!a.sticks.owner,battle.snapshot().moveStick);a.onPointerUp(hudPointer);
  const bottomPointer={...hudPointer,id:78,y:740*a.cameras.main.zoom};a.onPointerDown(bottomPointer);step();
  const screenPoint=a.screenCamera.getWorldPoint(bottomPointer.x,bottomPointer.y);
  check('bottom input strip owns a screen-fixed joystick, absent from world camera',a.sticks.owner?.id===78&&a.stickVisible&&(a.stick.cameraFilter&a.cameras.main.id)!==0&&(a.stick.cameraFilter&a.screenCamera.id)===0&&!a.screenCamera.inputEnabled&&Math.abs(screenPoint.x-180)<.001&&Math.abs(screenPoint.y-740)<.001,{owner:a.sticks.owner,screenPoint,mainFilter:a.stick.cameraFilter,screenCamera:a.screenCamera.id});
  a.onPointerUp(bottomPointer);
  const p={id:1,wasTouch:true,wasCanceled:false,isDown:true,x:180*a.cameras.main.zoom,y:400*a.cameras.main.zoom};
  a.onPointerDown(p);p.x+=15*a.scale.gameSize.width/390;a.onPointerMove(p);const before=a.sticks.movementVector(),oldView=a.cameras.main.worldView.x;step(180);a.onPointerMove(p);const after=a.sticks.movementVector();
  check('same held finger keeps slow speed as the world scrolls',a.cameras.main.worldView.x>oldView+10&&Math.abs(before.x-after.x)<1e-7&&Math.abs(after.y)<1e-7,{before,after,oldView,newView:a.cameras.main.worldView.x});
  const stillScreenPoint=a.screenCamera.getWorldPoint(p.x,p.y);
  check('joystick screen projection does not inherit camera scroll',Math.abs(stillScreenPoint.x-p.x/a.cameras.main.zoom)<.001&&Math.abs(stillScreenPoint.y-p.y/a.cameras.main.zoom)<.001,{stillScreenPoint,view:a.cameras.main.worldView});
  a.onPointerDown({...p,id:2,x:60*a.cameras.main.zoom});check('second finger cannot steal movement',a.sticks.owner?.id===1,a.sticks.owner);
  a.onPointerUp(p);step();check('release stops, held second finger does not take over',!battle.snapshot().moveHeld&&a.cat.body.velocity.length()===0,battle.snapshot().moveStick);
  a.onPointerUp({...p,id:2});
  a.keys.D.isDown=true;step(400);a.keys.D.isDown=false;step();
  check('right edge uses real map boundary, not screen edge',Math.abs(a.cat.body.center.x-691)<.01&&a.cameras.main.worldView.right<=721,{player:battle.snapshot().player,view:a.cameras.main.worldView});
  a.keys.S.isDown=true;step(500);a.keys.S.isDown=false;step();
  check('bottom corner is reachable and camera shows no outside space',Math.abs(a.cat.body.center.y-1411)<.01&&a.cameras.main.worldView.bottom<=1441,{player:battle.snapshot().player,view:a.cameras.main.worldView});
  a.keys.A.isDown=true;step(500);a.keys.A.isDown=false;a.keys.W.isDown=true;step(600);a.keys.W.isDown=false;step();
  check('top left corner reachable without changing world or character size',Math.abs(a.cat.body.center.x-29)<.01&&Math.abs(a.cat.body.center.y-29)<.01&&a.cameras.main.worldView.x>=-1&&a.cameras.main.worldView.y>=-1,{player:battle.snapshot().player,view:a.cameras.main.worldView});
  const paused=JSON.stringify(battle.snapshot().player);battle.pause('menu');g.scene.processQueue();step(30);check('pause freezes physics and clears owner',JSON.stringify(battle.snapshot().player)===paused&&!a.sticks.owner,{player:battle.snapshot().player});
  g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();check('continue does not restore old input',a.cat.body.velocity.length()===0&&!a.sticks.owner,battle.snapshot().moveStick);
  // A real native-follow deadzone offset is essential: a centered or clamped
  // camera hides the quality-change recentering defect.
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const direction of [1,-1]){
   stage.style.width=width+'px';stage.style.height=height+'px';battle.setPresentation({quality:'standard'});start();
   battle.setBounds({top:110,bottom:360*height/width-128});
   const horizontal=direction===1?'D':'A',vertical=direction===1?'S':'W';
   a.keys[horizontal].isDown=true;a.keys[vertical].isDown=true;step(60);a.keys[horizontal].isDown=false;a.keys[vertical].isDown=false;step();render();
   battle.pause('menu');g.scene.processQueue();render();
   const reference=battle.snapshot(),camera=a.cameras.main,mid={x:camera.midPoint.x,y:camera.midPoint.y},view={...reference.engine.camera.view};
   const offset={x:reference.player.x-mid.x,y:reference.player.y-mid.y};
   check('quality regression starts off center '+width+'x'+height+' '+direction,Math.abs(offset.x)>8&&Math.abs(offset.y)>8,{offset,player:reference.player,mid,view});
   for(const quality of ['low','standard'] as const){
    battle.setPresentation({quality});render();const current=battle.snapshot(),point=projection(camera,reference.player.x,reference.player.y);
    check('quality preserves off center native view '+width+'x'+height+' '+direction+' '+quality,
     current.engine.paused&&JSON.stringify(current.player)===JSON.stringify(reference.player)&&current.elapsed===reference.elapsed&&
     Math.abs(camera.midPoint.x-mid.x)<.00001&&Math.abs(camera.midPoint.y-mid.y)<.00001&&JSON.stringify(current.engine.camera.view)===JSON.stringify(view),
     {quality,player:current.player,mid:{x:camera.midPoint.x,y:camera.midPoint.y},view:current.engine.camera.view,expectedMid:mid,expectedView:view,screenPoint:point});
    checkBackground('quality background aligned off center '+width+'x'+height+' '+direction+' '+quality);
   }
   g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();render();
   const resumed=battle.snapshot();check('quality continue retains view without old input '+width+'x'+height+' '+direction,
    !resumed.moveHeld&&a.cat.body.velocity.length()===0&&JSON.stringify(resumed.engine.camera.view)===JSON.stringify(view),{view:resumed.engine.camera.view,expectedView:view,player:resumed.player});
  }
  const matrices:any[]=[];
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['standard','low'] as const){
   battle.pause('menu');g.scene.processQueue();const position=JSON.stringify(battle.snapshot().player);stage.style.width=width+'px';stage.style.height=height+'px';battle.setPresentation({quality});const top=90,bottom=360*height/width-40;battle.setBounds({top,bottom});const s=battle.snapshot();
   const valid=s.engine.world.width===720&&s.engine.world.height===1440&&s.engine.buffer.width===Math.round(width*(quality==='low'?1:Math.min(Math.max(devicePixelRatio,1),2)))&&a.cameras.main.worldView.left>=-1&&a.cameras.main.worldView.right<=721;
   matrices.push({width,height,quality,dpr:devicePixelRatio,density:s.engine.density,world:s.engine.world,buffer:s.engine.buffer,zoom:s.engine.camera.zoomX,viewport:{x:a.cameras.main.x,y:a.cameras.main.y,width:a.cameras.main.width,height:a.cameras.main.height},view:s.engine.camera.view});check('actual resize and quality '+width+'x'+height+' '+quality,valid&&s.engine.paused&&JSON.stringify(s.player)===position&&a.cameras.main.y===top*a.cameras.main.zoom&&a.cameras.main.height===(bottom-top)*a.cameras.main.zoom,matrices.at(-1));
   checkBackground('paused full background after resize '+width+'x'+height+' '+quality);
   for(const [x,y] of [[360,720],[29,720],[691,720],[360,29],[360,1411],[29,29],[691,29],[29,1411],[691,1411]]){
    w.qaPosition(a.cat,x,y);a.applyBounds();checkBackground('paused matrix projection '+width+'x'+height+' '+quality+' '+x+','+y);
   }
   w.qaPosition(a.cat,s.player.x,s.player.y);a.applyBounds();
   const before=backgroundState();g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();render();const after=backgroundState();
   check('continue keeps background phase '+width+'x'+height+' '+quality,JSON.stringify(before.art)===JSON.stringify(after.art)&&after.errors.every((error:number)=>error<.001),{before:before.art,after:after.art});
  }
  start();w.qaPosition(a.cat,500,720);a.syncCatArt(true);a.cameras.main.preRender();const target=a.place(a.enemies,600,.5,'enemy');target.setData('hp',9999);target.body.moves=false;a.fire({x:1,y:0,id:9001});const shot=a.projectiles.getChildren().find((s:any)=>s.active);const hp=target.getData('hp');a.hit(shot,target,'overlap');
  check('real hit damage and number remain at world x beyond 360',target.getData('hp')===hp-12&&a.feedback.snapshot().numberDetails.some((n:any)=>Number(n.text)===12&&n.x>400),a.feedback.snapshot());
  render();const hitNumbers=a.feedback.numbers.getChildren().filter((actor:any)=>actor.active);
  check('actual damage numbers render only in main camera',hitNumbers.length>0&&hitNumbers.every((actor:any)=>a.cameras.main.renderList.includes(actor)&&!a.backgroundCamera.renderList.includes(actor)&&!a.screenCamera.renderList.includes(actor)),{numbers:hitNumbers.map((actor:any)=>({text:actor.text,filter:actor.cameraFilter,x:actor.x,y:actor.y}))});
  start();const stable={children:a.children.length,cameras:a.cameras.cameras.length,addedListeners:a.events.listenerCount('addedtoscene'),groups:battle.snapshot().engine.groups};
  for(let i=0;i<20;i++){start();render();}
  const repeated={children:a.children.length,cameras:a.cameras.cameras.length,addedListeners:a.events.listenerCount('addedtoscene'),groups:battle.snapshot().engine.groups};
  check('20 restarts retain three native cameras, stable objects and centered spawn without old projectiles',a.cameras.cameras.length===3&&JSON.stringify(stable)===JSON.stringify(repeated)&&battle.snapshot().projectiles===0&&Math.abs(a.cat.body.center.x-360)<.001&&Math.abs(a.cat.body.center.y-720)<.001,{stable,repeated,player:battle.snapshot().player});
  for(const cat of ['CAT02','CAT03']){start(cat);step(3);check(cat+' retains its real configuration and native map',battle.snapshot().catId===cat&&battle.snapshot().engine.world.width===720&&a.cat.body.halfWidth===12,{cat:battle.snapshot().catId,hp:battle.snapshot().hp,world:battle.snapshot().engine.world});}
  check('all three cats retain visible courtyard landmarks and boundary',a.scenery.snapshot().enabled&&a.scenery.snapshot().landmarkGroups===3,a.scenery.snapshot());
  const birthCases:any[]=[];
  for(const [x,y] of [[360,720],[29,720],[691,720],[360,29],[360,1411],[29,29],[691,29],[29,1411],[691,1411]]){
   start();w.qaPosition(a.cat,x,y);step();checkBackground('center edge corner world projection '+x+','+y);const v=a.cameras.main.worldView,points:any[]=[];
   for(let i=0;i<20;i++){
    a.spawnCourtyardEnemy();
    for(const enemy of a.enemies.getChildren().filter((actor:any)=>actor.active)){
     const c={x:enemy.body.center.x,y:enemy.body.center.y};points.push(c);a.recycle(enemy,a.enemies);
    }
   }
   const valid=points.length>0&&points.every(p=>p.x>=24&&p.x<=696&&p.y>=24&&p.y<=1416&&Math.hypot(p.x-x,p.y-y)>=180&&!(p.x>v.left-48&&p.x<v.right+48&&p.y>v.top-48&&p.y<v.bottom+48));
   birthCases.push({player:{x,y},view:{x:v.x,y:v.y,width:v.width,height:v.height},points});check('actual birth band at '+x+','+y,valid,birthCases.at(-1));
  }
  const worldActors=a.children.getChildren().filter((actor:any)=>actor!==a.stick);
  check('screen camera excludes scenery, character and dynamic actors',worldActors.every((actor:any)=>(actor.cameraFilter&a.screenCamera.id)!==0),{objects:worldActors.length});
  const scenery=[a.background,...a.scenery.backgroundObjects()],actors=a.children.getChildren().filter((actor:any)=>!scenery.includes(actor));
  check('background excludes every battle object; main alone draws shadows',actors.every((actor:any)=>(actor.cameraFilter&a.backgroundCamera.id)!==0)&&scenery.every((actor:any)=>(actor.cameraFilter&a.cameras.main.id)!==0)&&(a.scenery.shadows.cameraFilter&a.cameras.main.id)===0,{backgroundObjects:scenery.length,battleObjects:actors.length,shadowFilter:a.scenery.shadows.cameraFilter});
  start('CAT03');const enemy=a.place(a.enemies,410,.5,'enemy');a.fire({x:1,y:0,id:9002});a.feedback.damage({x:420,y:720},12);a.scenery.drawShadows({x:360,y:720},a.targets());
  const dynamic=a.add.text(360,720,'late dynamic'),lateShot=a.projectiles.getChildren().find((actor:any)=>actor.active);render();
  const battleObjects=[a.cat,a.spirit,enemy,lateShot,dynamic,a.scenery.shadows,...a.feedback.numbers.getChildren().filter((actor:any)=>actor.active)];
  check('real render lists isolate later companion enemy shot and text',battleObjects.every((actor:any)=>(actor.cameraFilter&a.backgroundCamera.id)!==0&&(actor.cameraFilter&a.screenCamera.id)!==0&&(actor.cameraFilter&a.cameras.main.id)===0)&&!a.backgroundCamera.renderList.some((actor:any)=>battleObjects.includes(actor))&&!a.screenCamera.renderList.some((actor:any)=>battleObjects.includes(actor))&&a.cameras.main.renderList.includes(dynamic)&&a.cameras.main.renderList.includes(a.scenery.shadows),{filters:battleObjects.map((actor:any)=>({type:actor.type,filter:actor.cameraFilter})),layers:backgroundState().layers});dynamic.destroy();
  // Controlled comparison, not a natural 120-second or balance result. Keep
  // RunConfig identical on both sides; only the presentation Camera is hidden.
  function ruleTrace(cat:string,showBackground:boolean){
   start(cat);a.backgroundCamera.setVisible(showBackground);
   const target=a.place(a.enemies,430,.5,'enemy');target.setData('hp',10000);target.body.moves=false;
   const trace:any[]=[];let renderPasses=0;
   for(let frame=0;frame<7202;frame++){
    step();
    if(frame%30===0||frame===7201){render();renderPasses++;const s=battle.snapshot();trace.push({elapsed:s.elapsed,hp:s.hp,ammo:s.ammo,reloadLeft:s.reloadLeft,shots:s.shots,kills:s.kills,objectsHit:s.objectsHit,locked:s.locked,targetKind:s.targetKind,player:s.player,spawnView:s.engine.camera.view,contactBody:s.engine.bodies.cat,targets:s.targets,passiveState:s.passiveState,sourceCounts:s.sourceCounts,enemyStatuses:s.enemyStatuses,result:s.result,targetHp:target.getData('hp')});}
   }
   return {trace,renderPasses};
  }
  for(const cat of ['CAT01','CAT02','CAT03']){
   const shown=ruleTrace(cat,true),hidden=ruleTrace(cat,false);
   check(cat+' identical gameplay with background rendered or hidden through configured end',JSON.stringify(shown)===JSON.stringify(hidden)&&shown.renderPasses===242&&shown.trace.at(-1).result==='survived'&&shown.trace.at(-1).elapsed===120,{samples:shown.trace.length,renderPasses:shown.renderPasses,fixedUpdates:7202,first:shown.trace[0],last:shown.trace.at(-1),identical:JSON.stringify(shown)===JSON.stringify(hidden),scope:'Controlled fixed-delta Scene; native render before each 30-update sample and final sample, not natural time, 60FPS rendering, phone performance or balance'});
  }
  a.backgroundCamera.setVisible(true);
  start();battle.pause('menu');g.scene.processQueue();
  out.textContent=JSON.stringify({status:'PASS',environment:{viewportMatrices:matrices,dpr:devicePixelRatio,scope:'Actual Scene controlled fixture, not natural gameplay, browser touch hardware or phone performance'},checks},null,2);w.courtyardChecks={status:'PASS',checks};
 }catch(error){out.textContent=JSON.stringify({status:'FAIL',error:String(error),checks},null,2);w.courtyardChecks={status:'FAIL',checks};}finally{button.disabled=false;}});
}
boot().catch(error=>{out.textContent=String(error);});
