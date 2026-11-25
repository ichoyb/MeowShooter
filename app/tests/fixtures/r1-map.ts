import {ImageBudget} from '../../src/image-budget';
import {createBattle} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import {cat01Frames} from '../../src/cat01-frames';
import h1Art from '../../src/h1-art.json';

const w=window as any, checks:any[]=[];
const out=document.getElementById('qa-result')!;
function check(name:string,ok:unknown,observed:unknown):void {checks.push({name,status:ok?'PASS':'FAIL',observed});if(!ok)throw Error(name);}
function image(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
async function run():Promise<void>{
  const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('./assets/ui/'+id+'.png')));
  const releaseCounts=new Map<object,number>();
  class ObservedBudget extends ImageBudget {override release(image:Parameters<ImageBudget['release']>[0]):void {releaseCounts.set(image,(releaseCounts.get(image)??0)+1);super.release(image);}}
  const budget=new ObservedBudget(5242880,{mode:'advisory'});
  const icons=await Promise.all(['W01','W02','W04','BALL','MAG','GUARD','MOVE'].map(id=>image('./assets/ui/'+id+'.svg')));
  icons.forEach((image,i)=>budget.register('ui/icon'+i,image));
  const battle=await createBattle(document.getElementById('stage')!,{onState(){},onInterrupt(){},onFinish(){}},{CAT01,CAT02,CAT03},budget);
  const a=w.qaArena,g=a.game,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
  const step=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;g.scene.update(now,1000/60);}};
  const observeTween=async(ms:number)=>{const begin=performance.now();do{await new Promise(resolve=>setTimeout(resolve,10));a.tweens.update();}while(performance.now()-begin<ms);};
  function start(cat='CAT02',art=true):void {
    g.loop.wake=()=>{};battle.setPresentation({quality:'standard',cat01Art:art});
    const config=makeRunConfig(cat as any,({CAT01:'W01',CAT02:'W04',CAT03:'W02'} as any)[cat],'p2-basic');
    battle.start(Object.freeze({...config,scenario:Object.freeze({...config.scenario,spawnIntervalSeconds:10000})}));
    g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
    for(const group of [a.enemies,a.objects,a.projectiles])for(const actor of group.getChildren())a.recycle(actor,group);
  }
  start();
  const dustFrame=a.textures.getFrame('boss-dust',0),plume=a.bossEffects.emitterConfig('plume',6),trail=a.bossEffects.emitterConfig('trail',6);
  check('64px dust re-export retains authored world plume and trail sizes',dustFrame.realWidth===64&&dustFrame.realHeight===64&&Math.abs(plume.scaleX.end*64-24*4*112/96)<.00001&&Math.abs(plume.scaleY.end*64-24*5*112/96)<.00001&&Math.abs(trail.scaleX.end*64-24*2.6)<.00001,{frame:[dustFrame.realWidth,dustFrame.realHeight],plume,trail});
  check('Snow has real native held layers and hidden single physical cat',!!(battle.snapshot() as any).heldPresentation?.active&&!a.cat.visible,{held:(battle.snapshot() as any).heldPresentation,visible:a.cat.visible});
  const f=cat01Frames as any;
  check('Orange C keeps approved complete native mapping and rhythm',f.bodySourceUnits===768&&f.bodySourceHeight===480&&f.weaponSourceUnits===384&&f.gripSourceUnits===192&&f.headSourceUnits===768&&f.releaseAngleDeg===-102&&f.fireFPS===42&&Object.keys(f.body).length===24,{...f,body:Object.keys(f.body)});
  check('material background uses20-source shared ledger',(battle.snapshot() as any).scenery.visualRevision==='courtyard-continuous-native-v01'&&budget.snapshot().sourceRGBA===9314952&&budget.snapshot().sources.length===19,{scenery:(battle.snapshot() as any).scenery,budget:budget.snapshot()});
  check('native aliases share physical decoded sources',a.textures.get('cat01-body-0').source[0].image===a.textures.get('cat01-body-1').source[0].image&&a.textures.get('cat01-head').source[0].image===a.textures.get('cat01-weapon').source[0].image&&a.textures.get('cat01-grip').source[0].image===a.textures.get('cat01-weapon').source[0].image&&a.textures.get('atlas').source[0].image===a.textures.get('enemy-parts').source[0].image&&a.textures.get('cat-CAT02').source[0].image===CAT02,budget.snapshot());
  const parts=[a.catArt.body,a.catArt.weapon,a.catArt.grip,a.catArt.head];
  check('native trim restores logical windows and numeric Frame.name',parts[0].width===128&&parts[0].height===80&&parts[1].width===64&&parts[2].width===32&&parts[3].width===128&&typeof parts[0].frame.name==='number'&&a.textures.getFrame('cat-CAT02','body').realWidth===384&&a.textures.getFrame('cat-CAT02','h1-head').realWidth===384,parts.map((p:any)=>({key:p.texture.key,frame:p.frame.name,width:p.width,height:p.height,trim:p.frame.trimmed})));
  const art=()=> (battle.snapshot() as any).heldPresentation;
  for(const cat of ['CAT02','CAT03']) {
    start(cat);
    const hero=a.heldArt;
    check(cat+' four fixed native Image layers have no physics or input',hero.objects().length===4&&hero.objects().every((x:any)=>x.type==='Image'&&!x.body&&!x.input)&&a.cat.body.enable&&art().display.width===36&&battle.snapshot().engine.bodies.cat.radius===12,{art:art(),objects:hero.objects().map((x:any)=>({type:x.type,depth:x.depth}))});
    check(cat+' layered art seen only by full-canvas world camera',hero.objects().every((x:any)=>(x.cameraFilter&a.cameras.main.id)&&!(x.cameraFilter&a.backgroundCamera.id)&&(x.cameraFilter&a.screenCamera.id)),hero.objects().map((x:any)=>x.cameraFilter));
    a.keys.D.isDown=true;step(8);a.clearInput();step(2);
    check(cat+' real horizontal movement changes facing and stop retains it',art().facing==='right'&&art().motion==='idle',art());
    a.keys.W.isDown=true;step(4);a.clearInput();step(2);
    check(cat+' vertical movement retains facing without fake body animation',art().facing==='right'&&hero.body.rotation===0&&hero.body.scaleX===hero.body.scaleY,art());
    for(const direction of [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]) {
      a.lastAim=direction;a.syncCatArt(false,true);const before=art();
      const mapping=h1Art.actors[cat as keyof typeof h1Art.actors],ctx=g.renderer.currentContext,drawImage=ctx.drawImage;
      let renderedPivot:any=null;
      ctx.drawImage=function(...args:any[]){
        const matrix=ctx.getTransform();renderedPivot={x:matrix.a*(args[5]+mapping.weaponOrigin[0]*hero.weapon.frame.realWidth-hero.weapon.frame.x)+matrix.c*(args[6]+mapping.weaponOrigin[1]*hero.weapon.frame.realHeight-hero.weapon.frame.y)+matrix.e,
          y:matrix.b*(args[5]+mapping.weaponOrigin[0]*hero.weapon.frame.realWidth-hero.weapon.frame.x)+matrix.d*(args[6]+mapping.weaponOrigin[1]*hero.weapon.frame.realHeight-hero.weapon.frame.y)+matrix.f};
        return drawImage.apply(this,args);
      };
      try {a.cameras.main.preRender();hero.weapon.renderCanvas(g.renderer,hero.weapon,a.cameras.main);}finally{ctx.drawImage=drawImage;}
      const nativeGrip=a.cameras.main.matrix.transformPoint(hero.weapon.x-a.cameras.main.scrollX,hero.weapon.y-a.cameras.main.scrollY);
      check(cat+' native Canvas mirrored weapon pivot remains on real grip '+JSON.stringify(direction),renderedPivot&&Math.hypot(renderedPivot.x-nativeGrip.x,renderedPivot.y-nativeGrip.y)<.001,{renderedPivot,nativeGrip});
      a.fireVolley({...direction,id:500+checks.length});a.syncCatArt(false,true);a.tweens.update();
      const motionDeadline=performance.now()+500;
      do {await observeTween(12);a.syncCatArt(false,true);} while(art().pose.distance===0&&performance.now()<motionDeadline);
      const during=art();
      check(cat+' actual volley animates held weapon toward '+JSON.stringify(direction),during.volleys===before.volleys+1&&during.state==='fire'&&during.pose.distance!==0&&Math.abs(Math.atan2(Math.sin(during.aimAngle-Math.atan2(direction.y,direction.x)),Math.cos(during.aimAngle-Math.atan2(direction.y,direction.x))))<.00001,{before,during});
      if(w.r1Capture){
        a.cameras.main.preRender();a.syncCourtyardBackground();g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();
        const point=a.cameras.main.matrix.transformPoint(hero.body.x-a.cameras.main.scrollX,hero.body.y-a.cameras.main.scrollY);
        await w.r1Capture(cat+'-'+direction.x+'-'+direction.y,{x:point.x,y:point.y});
      }
      const frozen=JSON.stringify(during);battle.pause('menu');g.scene.processQueue();await new Promise(resolve=>setTimeout(resolve,75));step(10);
      check(cat+' Scene pause freezes the actual held Tween',JSON.stringify(art())===frozen,art());
      g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
      await observeTween(300);a.syncCatArt(false,true);
      check(cat+' native Tween completes and returns exactly to grip',art().state==='idle'&&art().pose.distance===0&&art().pose.alpha===1&&a.tweens.getTweensOf(hero.pose).length===0,art());
    }
    a.fireVolley({x:0,y:-1,id:999});a.tweens.update();await observeTween(30);a.fireVolley({x:1,y:0,id:1000});a.tweens.update();
    check(cat+' fast retrigger replaces existing native Tween',a.tweens.getTweensOf(hero.pose).length===1,art());
    // Native Arcade Groups lazily allocate projectile slots. Compare restarts
    // after those real volleys have warmed the existing pool.
    start(cat);const baseObjects=a.children.length,baseBodies=a.physics.world.bodies.size;
    const restarts=[];
    for(let i=0;i<20;i++){start(cat);step();restarts.push({objects:a.children.length,bodies:a.physics.world.bodies.size,art:art(),tweens:a.tweens.getTweensOf(hero.pose).length});}
    check(cat+'20 restarts clear old input/pose and retain fixed objects',restarts.every(x=>x.objects===baseObjects&&x.bodies===baseBodies&&x.art.volleys===0&&x.art.pose.distance===0&&x.art.pose.alpha===1&&x.tweens===0)&&!battle.snapshot().moveHeld,restarts);
    a.fireVolley({x:1,y:0,id:1001});a.tweens.update();battle.setPresentation({quality:'standard',cat01Art:false});
    check(cat+' hiding art kills old Tweens and restores single physics display',!art().active&&a.cat.visible&&a.tweens.getTweensOf(hero.pose).length===0,art());
    start(cat);const target=a.placeSliceEnemy('E01',a.cat.body.center.x+75,a.cat.body.center.y-90);target.body.moves=false;target.setData('hp',999999);
    step(480);const automatic=battle.snapshot();
    check(cat+' real automatic volleys and reload drive held presentation once per volley',automatic.shots>4&&automatic.reloadCompletions>0&&art().volleys===automatic.shots,{shots:automatic.shots,reloads:automatic.reloadCompletions,held:art()});
    a.keys.D.isDown=true;step(1);battle.pause('background');g.scene.processQueue();const background=JSON.stringify(art()),elapsed=battle.snapshot().elapsed;
    await new Promise(resolve=>setTimeout(resolve,80));step(30);
    check(cat+' background freezes held pose and effective time while clearing input',JSON.stringify(art())===background&&battle.snapshot().elapsed===elapsed&&!battle.snapshot().moveHeld&&!a.keys.D.isDown,art());
  }
  start('CAT01');check('Orange C native animation remains active with36u uniform display',battle.snapshot().presentation?.active&&battle.snapshot().presentation?.bodyDisplay.width===36&&!art().active,battle.snapshot().presentation);
  check('Orange uses authored body/weapon/grip/head scales without stretching face',a.catArt.body.displayWidth===36&&a.catArt.body.displayHeight===22.5&&a.catArt.weapon.displayWidth===18&&a.catArt.grip.displayWidth===9&&a.catArt.head.scaleX===a.catArt.head.scaleY,{body:[a.catArt.body.displayWidth,a.catArt.body.displayHeight],weapon:a.catArt.weapon.displayWidth,grip:a.catArt.grip.displayWidth,head:[a.catArt.head.scaleX,a.catArt.head.scaleY]});
  a.fireVolley({x:1,y:0,id:1900});const weaponFrames=[Number(a.catArt.weapon.frame.name)];
  for(let i=0;i<15;i++){step();weaponFrames.push(Number(a.catArt.weapon.frame.name));}
  check('Orange real volley plays all seven native fire frames and returns to neutral',[1,2,3,4,5,6,7].every(frame=>weaponFrames.includes(frame))&&weaponFrames[weaponFrames.length-1]===0,{weaponFrames,art:battle.snapshot().presentation});
  start('CAT01');
  const target=a.placeSliceEnemy('E01',a.cat.body.center.x+60,a.cat.body.center.y-80);target.body.moves=false;target.setData('hp',999999);
  a.keys.D.isDown=true;step(20);a.clearInput();step(3);
  check('Orange actual walk and automatic fire keep native frame animations',battle.snapshot().presentation!.walkFrames>0&&battle.snapshot().presentation!.volleys===battle.snapshot().shots,battle.snapshot().presentation);
  a.keys.D.isDown=true;step(200);const boundary=battle.snapshot();
  check('Orange holding a real Arcade boundary selects idle from final displacement',boundary.presentation!.motion==='idle'&&boundary.presentation!.facing==='right'&&a.cat.body.deltaXFinal()===0,boundary.presentation);
  for(const cat of ['CAT01','CAT02','CAT03']){
    start(cat);const t=a.placeSliceEnemy('E01',a.cat.body.center.x+75,a.cat.body.center.y-90);t.body.moves=false;t.setData('hp',999999);
    step(840);const automatic=battle.snapshot(),body=automatic.engine.bodies.cat;
    check(cat+' natural Scene cadence reloads, damages target and preserves centered12u Body',automatic.shots>4&&automatic.reloadCompletions>0&&t.getData('hp')<999999&&body.radius===12&&Math.abs(body.center.x-body.visual.x)<.00001&&Math.abs(body.center.y-body.visual.y)<.00001&&automatic.catDisplay.width===36,{shots:automatic.shots,reloads:automatic.reloadCompletions,hp:t.getData('hp'),body});
    for(const facing of ['left','right'])for(const direction of [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]){
      start(cat);a.keys[facing==='left'?'A':'D'].isDown=true;step(2);a.clearInput();step();
      a.lastAim=direction;a.syncCatArt(false,true);a.fireVolley({...direction,id:5000+checks.length});step(2);a.syncCatArt(false,true);
      const objects=cat==='CAT01'?[a.catArt.body,a.catArt.weapon,a.catArt.grip,a.catArt.head]:a.heldArt.objects();
      check(cat+' actual trimmed layers keep origin and facing '+facing+'/'+direction.x+'/'+direction.y,objects.every((object:any)=>object.flipX===(facing==='right'))&&objects.every((object:any)=>!object.body)&&a.cat.body.halfWidth===12,objects.map((object:any)=>({frame:object.frame.name,origin:[object.originX,object.originY],flip:object.flipX,size:[object.width,object.height],position:[object.x,object.y]})));
      if(w.r1Capture){a.cameras.main.preRender();a.syncCourtyardBackground();g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();await w.r1Capture(cat+'-'+facing+'-'+direction.x+'-'+direction.y);}
    }
  }
  async function mapChecks():Promise<void>{
    const backgrounds=a.scenery.backgroundObjects(),painting=a.scenery.map,source=a.textures.get('courtyard-native-painting').source[0].image;
    check('one native unmodified full-size image is background only',backgrounds.length===1&&painting.type==='Image'&&!painting.body&&!painting.input&&painting.texture.source[0].image===source&&source.naturalWidth===887&&source.naturalHeight===1774,{source:[source.naturalWidth,source.naturalHeight],objects:backgrounds.length});
    const reference=a.add.image(-152,-304,'courtyard-native-painting').setOrigin(0).setDisplaySize(1024,2048).setVisible(false);
    const render=()=>{a.cameras.main.preRender();a.syncCourtyardBackground();g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();};
    const draw=(image:any)=>{const ctx=g.canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,g.canvas.width,g.canvas.height);image.renderCanvas(g.renderer,image,a.backgroundCamera);return ctx.getImageData(0,0,g.canvas.width,g.canvas.height).data;};
    for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['standard','low']as const){
      const stage=document.getElementById('stage')!;stage.style.width=width+'px';stage.style.height=height+'px';start('CAT01');battle.setPresentation({quality});battle.setBounds({top:154*360/width,bottom:360*height/width-20});
      for(const [name,x,y]of [['center',360,720],['top',360,18],['bottom',360,1422],['left',18,720],['right',702,720],['tl',18,18],['tr',702,18],['bl',18,1422],['br',702,1422]]as const){
        w.qaPosition(a.cat,x,y);a.catBounds();a.correctBounds(a.cat);render();
        const A=draw(reference),B=draw(painting);let different=0;for(let i=0;i<A.length;i++)if(A[i]!==B[i])different++;
        const state=battle.snapshot();
        check('full-size painting matches independent registration '+[width,quality,name].join('/'),different===0&&state.scenery.mapCache.persistentRGBAEstimate===0&&state.imageBudget.sourceRGBA===9314952&&state.imageBudget.mode==='advisory',{different,scenery:state.scenery,buffer:state.engine.buffer});
        render();if(w.r1CaptureMap)await w.r1CaptureMap([width,quality,name].join('-'));
      }
    }
    reference.destroy();const texture=painting.texture,keys=a.textures.getTextureKeys();
    for(let i=0;i<20;i++){battle.setPresentation({quality:i%2?'low':'standard'});start(['CAT01','CAT02','CAT03'][i%3]);render();}
    check('20 restarts keep one native image and no new map textures/caches',a.scenery.map===painting&&painting.texture===texture&&JSON.stringify(a.textures.getTextureKeys())===JSON.stringify(keys)&&budget.snapshot().sourceRGBA===9314952&&budget.snapshot().sources.length===19,{scenery:a.scenery.snapshot(),budget:budget.snapshot()});
    const cam=a.backgroundCamera;cam.setViewport(0,0,g.canvas.width,g.canvas.height).setZoom(Math.min(g.canvas.width/1024,g.canvas.height/2048)).setScroll(-152,-304).preRender();
    g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();if(w.r1CaptureMap)await w.r1CaptureMap('whole-map-composition-only');
  }
  async function lifecycleChecks():Promise<void>{
    const uiOnly=()=>budget.snapshot().sourceRGBA===1423640&&budget.snapshot().sources.length===10;
    const waitFor=async(test:()=>boolean)=>{const end=performance.now()+3000;while(!test()){if(performance.now()>end)throw Error('destroy timeout');await new Promise(r=>setTimeout(r,10));}};
    const texture=a.textures.get('courtyard-native-painting'),source=texture.source[0];
    const done=new Promise<void>(resolve=>g.events.once('destroy',resolve));battle.dispose();battle.dispose();await done;
    check('destroy releases full-size image and9 owned sources exactly once',uiOnly()&&texture.source.length===0&&source.image===null&&releaseCounts.size===9&&Array.from(releaseCounts.values()).every(v=>v===1),{budget:budget.snapshot(),released:releaseCounts.size});
    const create=()=>createBattle(document.getElementById('stage')!,{onState(){},onInterrupt(){},onFinish(){}},{CAT01,CAT02,CAT03},budget);
    w.r1FailCreate=true;w.r1FailedDestroyed=false;let failure='';try{await create();}catch(error){failure=String(error);}await waitFor(()=>w.r1FailedDestroyed);
    check('failure releases the large picture before retry',failure.includes('R1 fixture initialization failure')&&uiOnly()&&w.r1FailedDetail.source.length===0&&releaseCounts.size===18,{failure,budget:budget.snapshot(),released:releaseCounts.size});
    const retry=await create(),retryGame=w.qaArena.game,retryTexture=w.qaArena.textures.get('courtyard-native-painting');
    check('retry tracks real9MiB source total without enforcing demo reference',budget.snapshot().sourceRGBA===9314952&&budget.snapshot().sources.length===19&&budget.snapshot().warnings.length>=2,budget.snapshot());
    const retryDone=new Promise<void>(resolve=>retryGame.events.once('destroy',resolve));retry.dispose();await retryDone;
    check('retry releases all owned images and keeps shared UI',uiOnly()&&retryTexture.source.length===0&&releaseCounts.size===27&&Array.from(releaseCounts.values()).every(v=>v===1)&&![CAT01,CAT02,CAT03,...icons].some(image=>releaseCounts.has(image)),{budget:budget.snapshot(),released:releaseCounts.size});
  }
  await mapChecks();
  // Controlled visual overlap, not a natural Boss encounter or balance check.
  start('CAT01');const center=battle.snapshot().player;
  const boss=a.placeSliceEnemy('B01',center.x+70,center.y-95),elite=a.placeSliceEnemy('EL01',center.x-95,center.y-35);
  step(90);a.syncEnemyArt();a.cameras.main.preRender();a.syncCourtyardBackground();g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();
  check('BossA and elite remain real shared native actors over material',boss?.active&&elite?.active&&boss.displayWidth===96&&boss.body&&a.scenery.snapshot().physicalBodies===0,{boss:{width:boss?.displayWidth,hp:boss?.getData('hp')},elite:{width:elite?.displayWidth,hp:elite?.getData('hp')}});
  if(w.r1CaptureMap)await w.r1CaptureMap('boss-elite-controlled-visual');
  await lifecycleChecks();w.r1Result={status:'PASS',checks,scope:'Real Phaser Canvas Arena; controlled fixture, not natural gameplay or phone acceptance'};out.textContent=JSON.stringify(w.r1Result,null,2);document.body.dataset.qa='PASS';
}
run().catch(error=>{w.r1Result={status:'FAIL',error:String(error),stack:error.stack,checks};out.textContent=JSON.stringify(w.r1Result,null,2);document.body.dataset.qa='FAIL';});
