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
  const battle=await createBattle(document.getElementById('stage')!,{onState(){},onInterrupt(){},onFinish(){}},{CAT01,CAT02,CAT03});
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
  check('Snow has real native held layers and hidden single physical cat',!!(battle.snapshot() as any).heldPresentation?.active&&!a.cat.visible,{held:(battle.snapshot() as any).heldPresentation,visible:a.cat.visible});
  const f=cat01Frames as any;
  check('Orange C keeps approved complete native mapping and rhythm',f.bodySourceUnits===768&&f.bodySourceHeight===480&&f.weaponSourceUnits===384&&f.gripSourceUnits===192&&f.headSourceUnits===768&&f.releaseAngleDeg===-102&&f.fireFPS===42&&Object.keys(f.body).length===24,{...f,body:Object.keys(f.body)});
  check('shared atlas reuses one decoded cat slot and complete map stitches once',a.textures.get('h1-art').source[0].image!==CAT01&&a.textures.get('cat').source[0].image===CAT01&&(battle.snapshot() as any).scenery.mapCache.stitchCount===2&&battle.snapshot().imageBudget.sourceRGBA===4864064,battle.snapshot().imageBudget);
  const art=()=> (battle.snapshot() as any).heldPresentation;
  for(const cat of ['CAT02','CAT03']) {
    start(cat);
    const hero=a.heldArt;
    check(cat+' four fixed native Image layers have no physics or input',hero.objects().length===4&&hero.objects().every((x:any)=>x.type==='Image'&&!x.body&&!x.input)&&a.cat.body.enable&&art().display.width===36&&battle.snapshot().engine.bodies.cat.radius===12,{art:art(),objects:hero.objects().map((x:any)=>({type:x.type,depth:x.depth}))});
    check(cat+' layered art seen only by main camera',hero.objects().every((x:any)=>!(x.cameraFilter&a.cameras.main.id)&&(x.cameraFilter&a.backgroundCamera.id)&&(x.cameraFilter&a.screenCamera.id)),hero.objects().map((x:any)=>x.cameraFilter));
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
      if(w.h1Capture){
        a.cameras.main.preRender();a.syncCourtyardBackground();g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();
        const point=a.cameras.main.matrix.transformPoint(hero.body.x-a.cameras.main.scrollX,hero.body.y-a.cameras.main.scrollY);
        await w.h1Capture(cat+'-'+direction.x+'-'+direction.y,{x:point.x,y:point.y});
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
  battle.dispose();w.h1Result={status:'PASS',checks,scope:'Real Phaser Canvas Arena; controlled fixture, not natural gameplay or phone acceptance'};out.textContent=JSON.stringify(w.h1Result,null,2);document.body.dataset.qa='PASS';
}
run().catch(error=>{w.h1Result={status:'FAIL',error:String(error),stack:error.stack,checks};out.textContent=JSON.stringify(w.h1Result,null,2);document.body.dataset.qa='FAIL';});
