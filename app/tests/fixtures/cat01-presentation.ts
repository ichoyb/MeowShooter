import {createBattle} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
const checks:any[]=[];const w=window as any;
const out=document.getElementById('qa-result')!;
function check(name:string,value:unknown,observed:unknown){checks.push({name,status:value?'PASS':'FAIL',observed});out.textContent=JSON.stringify({status:'RUNNING',checks});if(!value)throw Error(name);}
function img(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
async function run(){
 const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>img('./assets/ui/'+id+'.png')));
 const battle=await createBattle(document.getElementById('stage')!,{onState(){},onInterrupt(){},onFinish(){}},{CAT01,CAT02,CAT03});
 const a=w.qaArena,g=a.game,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const observeTween=async(ms:number)=>{const begin=performance.now();do{await new Promise(resolve=>window.setTimeout(resolve,10));a.tweens.update();}while(performance.now()-begin<ms);};
 const step=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;g.scene.update(now,1000/60);}};
 function start(cat='CAT01',art=true){g.loop.wake=()=>{};battle.setPresentation({quality:'standard',cat01Art:art});const base=makeRunConfig(cat as any,({CAT01:'W01',CAT02:'W04',CAT03:'W02'} as any)[cat],'p2-basic');battle.start(Object.freeze({...base,scenario:Object.freeze({...base.scenario,spawnIntervalSeconds:10000})}));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
  for(const group of [a.enemies,a.objects,a.projectiles])for(const actor of group.getChildren())a.recycle(actor,group);
  const target=a.place(a.enemies,280,.2,'enemy');w.qaPosition(target,280,a.cat.body.center.y-90);target.body.moves=false;target.setData('hp',999999);
 }
 start();check('CAT01 native presentation active',battle.snapshot().presentation?.active,battle.snapshot().presentation);
 check('F1 preview feedback and scenery are active',!!(battle.snapshot() as any).feedback?.enabled&&(battle.snapshot() as any).scenery?.enabled,(battle.snapshot() as any).feedback);
 const target=a.enemies.getChildren().find((x:any)=>x.active);
 a.fire({x:1,y:0,id:9001});let shot=a.projectiles.getChildren().find((x:any)=>x.active);w.qaPosition(shot,target.body.center.x,target.body.center.y);
 const hp=target.getData('hp');a.hit(shot,target,'overlap');a.hit(shot,target,'overlap');
 check('real hit emits once and duplicate recycled shot does not replay',a.feedback.snapshot().hits===1&&target.getData('hp')===hp-12,a.feedback.snapshot());
 check('real hit creates exactly one native damage number',a.feedback.snapshot().numbersTotal===1&&a.feedback.snapshot().numbersActive===1&&a.feedback.snapshot().numberDetails?.[0]?.text==='12',a.feedback.snapshot());
 target.setData('hp',1);a.fire({x:1,y:0,id:9002});shot=a.projectiles.getChildren().find((x:any)=>x.active);w.qaPosition(shot,target.body.center.x,target.body.center.y);a.hit(shot,target,'overlap');
 check('real defeat immediately recycles Body and keeps only nonphysical fade',!target.body.enable&&a.feedback.snapshot().defeats===1&&a.feedback.snapshot().active>0,a.feedback.snapshot());
 check('overkill displays calculated hit damage rather than remaining HP',a.feedback.snapshot().numberDetails.at(-1)?.text==='12'&&a.feedback.snapshot().numbersTotal===2,a.feedback.snapshot());
 start();const box=a.place(a.objects,270,.4,'object');box.setData('hp',1);a.fire({x:1,y:0,id:9003});const boxShot=a.projectiles.getChildren().find((x:any)=>x.active);a.hit(boxShot,box,'overlap');check('actual box hit also displays calculated damage once',a.feedback.snapshot().numbersTotal===1&&a.feedback.snapshot().numberDetails[0]?.text==='12',a.feedback.snapshot());
 start();const contact=a.enemies.getChildren().find((x:any)=>x.active);w.qaPosition(contact,a.cat.body.center.x,a.cat.body.center.y);step(1);
 check('actual contact HP loss triggers one foot ring and true HP number',battle.snapshot().hp===80&&a.feedback.snapshot().hurts===1&&a.feedback.snapshot().hurtVisible&&a.feedback.snapshot().numberDetails[0]?.text==='10'&&a.feedback.snapshot().numberDetails[0]?.player,a.feedback.snapshot());step(2);
 check('contact cooldown does not replay hurt ring',a.feedback.snapshot().hurts===1,a.feedback.snapshot());
 battle.pause('menu');g.scene.processQueue();const feedbackPaused=JSON.stringify(a.feedback.snapshot());step(30);
 check('pause preserves current feedback without updating it',JSON.stringify(a.feedback.snapshot())===feedbackPaused,a.feedback.snapshot());
 g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
 check('resume clears old transient visuals before native tick',a.feedback.snapshot().numbersActive===0&&a.feedback.snapshot().active===0&&!a.feedback.snapshot().hurtVisible,a.feedback.snapshot());start();
 const mirrored=()=>[a.catArt.body,a.catArt.weapon,a.catArt.grip,a.catArt.head].map((part:any)=>part.flipX);
 a.keys.A.isDown=true;step(8);check('leftward actual movement faces left on all four approved layers',mirrored().every((v:boolean)=>!v),mirrored());
 a.clearInput();a.keys.D.isDown=true;step(8);check('rightward reversal faces right on all four layers',mirrored().every((v:boolean)=>v),mirrored());
 a.clearInput();step(3);check('release preserves last horizontal facing',mirrored().every((v:boolean)=>v),mirrored());
 a.keys.W.isDown=true;step(8);check('vertical movement preserves last horizontal facing',mirrored().every((v:boolean)=>v),mirrored());
 a.clearInput();battle.pause('menu');g.scene.processQueue();battle.setBounds({top:80,bottom:385});check('paused layout keeps facing',mirrored().every((v:boolean)=>v),mirrored());
 start();check('restart restores approved neutral facing',mirrored().every((v:boolean)=>!v),mirrored());
 a.keys.D.isDown=true;step(25);const moving=battle.snapshot();
 check('actual Arcade movement chooses native walk and fires without restarting gait',moving.player.x>180&&moving.presentation?.motion==='walk'&&moving.presentation.walkFrames>0&&moving.presentation.movingVolleys>0,moving);
 a.clearInput();step(3);const stopped=battle.snapshot();check('released input returns idle while automatic fire remains independent',!stopped.moveHeld&&stopped.presentation?.motion==='idle',stopped.presentation);
 battle.pause('menu');g.scene.processQueue();const paused=battle.snapshot();step(90);const frozen=battle.snapshot();
 check('native scene pause freezes body/weapon/elapsed/projectiles',JSON.stringify([paused.presentation,paused.elapsed,paused.projectiles])===JSON.stringify([frozen.presentation,frozen.elapsed,frozen.projectiles]),{paused:paused.presentation,frozen:frozen.presentation});
 battle.setBounds({top:80,bottom:200});const bounded=battle.snapshot();check('paused boundary adjustment keeps all art at physical center without advancing animation',Math.hypot(bounded.player.x-bounded.presentation!.bodyPosition.x,bounded.player.y-bounded.presentation!.bodyPosition.y)<.0001&&bounded.presentation!.bodyFrame===frozen.presentation!.bodyFrame,{body:bounded.player,art:bounded.presentation});battle.setBounds({top:80,bottom:385});
 battle.setPresentation({quality:'low'});check('quality changes preserve active run and presentation',battle.snapshot().presentation?.active&&battle.snapshot().engine.quality==='low',battle.snapshot().engine.quality);
 battle.resume();g.loop.sleep();g.scene.processQueue();step(2);check('resume clears input without losing art',!battle.snapshot().moveHeld&&battle.snapshot().presentation?.motion==='idle',battle.snapshot().presentation);
 battle.pause('background');g.scene.processQueue();const bg=battle.snapshot();step(120);check('background wait freezes native animation and effective time',JSON.stringify([bg.presentation,bg.elapsed])===JSON.stringify([battle.snapshot().presentation,battle.snapshot().elapsed]),battle.snapshot().reasons);g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step(2);
 step(300);check('automatic reload and real volleys drive bounded presentation',battle.snapshot().reloadCompletions>0&&battle.snapshot().presentation!.volleys===battle.snapshot().shots,battle.snapshot());
 a.keys.D.isDown=true;step(100);const edge=battle.snapshot();check('holding into boundary returns idle from actual zero displacement',edge.presentation!.motion==='idle'&&edge.engine.velocity.x>=0,edge.presentation);a.clearInput();
 function ruleRun(art:boolean){start('CAT01',art);a.keys.A.isDown=true;step(50);a.clearInput();step(180);const s=battle.snapshot();return {ammo:s.ammo,shots:s.shots,hp:s.hp,elapsed:s.elapsed,reloads:s.reloadCompletions,kills:s.kills,passive:s.passiveState,sources:s.sourceCounts,player:s.player,bodies:s.engine.bodies,groups:s.engine.groups};}
 const off=ruleRun(false),on=ruleRun(true);check('presentation on/off leaves real rules and physical bodies identical',JSON.stringify(off)===JSON.stringify(on),{off,on});
 start();const count=a.children.length,listeners=a.catArt?true:false;const restarts=[];
 for(let i=0;i<20;i++){start();step(1);restarts.push({objects:a.children.length,visuals:battle.snapshot().presentation!.visualObjects,volleys:battle.snapshot().presentation!.volleys,shots:battle.snapshot().shots});}
 check('20 restarts retain four layered visual objects with no duplicate firing listeners',listeners&&restarts.every(x=>x.objects===count&&x.visuals===4&&x.volleys===x.shots),restarts);
 for(const cat of ['CAT02','CAT03']){start(cat);step(3);const s=battle.snapshot();check(cat+' retains original static presentation and pairing',!s.presentation!.active&&!s.feedback?.enabled&&s.feedback?.numbersActive===0&&s.catTexture==='cat-'+cat&&a.cat.visible,{cat:s.catId,weapon:s.weaponId,texture:s.catTexture,presentation:s.presentation});}
 start();for(const group of [a.enemies,a.objects])for(const actor of group.getChildren())a.recycle(actor,group);step(30);const empty=battle.snapshot();step(90);check('no targets produces no spurious fire animation',empty.shots===battle.snapshot().shots&&empty.presentation!.volleys===battle.snapshot().presentation!.volleys,battle.snapshot().presentation);
 check('source-independent physics footprint stays 58u/12u',battle.snapshot().engine.bodies.cat.radius===12&&battle.snapshot().presentation!.bodyDisplay.width===58,battle.snapshot().engine.bodies.cat);
 start();a.feedback.clear();
 for(const [damage,label] of [[12,'12'],[28.8,'28.8'],[14.112,'14.11'],[.125,'0.13'],[.009,'<0.01']] as const){a.feedback.clear();a.feedback.damage({x:180,y:150},damage);check('native number formats '+damage,a.feedback.snapshot().numberDetails[0]?.text===label,a.feedback.snapshot());}
 a.feedback.clear();a.feedback.damage({x:180,y:110},12,false,{x:180,y:110});const faceNumber=a.feedback.snapshot().numberDetails[0];check('close enemy number avoids protagonist face even at upper boundary',faceNumber.y+faceNumber.height/2<71||Math.abs(faceNumber.x-180)>=faceNumber.width/2+30,faceNumber);
 start();const volleyTarget=a.enemies.getChildren().find((x:any)=>x.active);w.qaPosition(volleyTarget,220,a.cat.body.center.y-90);a.fireVolley({x:1,y:0,id:9004});for(const projectile of a.projectiles.getChildren().filter((x:any)=>x.active))a.hit(projectile,volleyTarget,'overlap');const volleyNumbers=a.feedback.snapshot().numberDetails;
 check('same actual primary and secondary volley numbers are separately readable',volleyNumbers.length===2&&volleyNumbers[0].text==='12'&&volleyNumbers[1].text==='9'&&(Math.abs(volleyNumbers[0].x-volleyNumbers[1].x)>=(volleyNumbers[0].width+volleyNumbers[1].width)/2||Math.abs(volleyNumbers[0].y-volleyNumbers[1].y)>=(volleyNumbers[0].height+volleyNumbers[1].height)/2),volleyNumbers);
 a.feedback.clear();a.feedback.damage({x:180,y:150},10,true);const protectedId=a.feedback.snapshot().numberDetails[0].order;
 for(let i=0;i<30;i++)a.feedback.damage({x:0,y:0},12+i);
 check('number pool stays bounded and preserves player priority',a.feedback.snapshot().numbersActive===8&&a.feedback.snapshot().numbersAllocated===8&&a.feedback.snapshot().numberDetails.some((n:any)=>n.order===protectedId),a.feedback.snapshot());
 check('numbers clamp inside world and track native render density',a.feedback.snapshot().numberDetails.every((n:any)=>n.x>=n.width/2&&n.y>=n.height/2&&n.resolution===a.cameras.main.zoom),a.feedback.snapshot());
 battle.setPresentation({quality:'low'});a.feedback.damage({x:180,y:150},.5);check('low quality retains damage numbers',a.feedback.snapshot().numbersActive===1&&a.feedback.snapshot().numberDetails[0].text==='0.5',a.feedback.snapshot());battle.setPresentation({quality:'standard'});
 const qaStage=document.getElementById('stage')!;const stageWidth=qaStage.style.width;qaStage.style.width='400px';a.syncPresentation(false);
 for(const quality of ['standard','low'] as const){battle.setPresentation({quality});a.feedback.clear();a.feedback.damage({x:180,y:150},12);const rasterNumber=a.feedback.numbers.getChildren().find((x:any)=>x.active);
 check('native Text source resolution matches canvas after resize and '+quality,rasterNumber.frame.source.resolution===rasterNumber.style.resolution&&rasterNumber.style.resolution===a.cameras.main.zoom,{source:rasterNumber.frame.source.resolution,style:rasterNumber.style.resolution,zoom:a.cameras.main.zoom});
 const ctx=g.renderer.currentContext,drawImage=ctx.drawImage,draws:any[]=[];try{ctx.drawImage=function(...args:any[]){if(args[0]===rasterNumber.canvas)draws.push({width:args[7],height:args[8]});return drawImage.apply(this,args);};rasterNumber.renderCanvas(g.renderer,rasterNumber,a.cameras.main);}finally{ctx.drawImage=drawImage;}
 check('actual Canvas drawImage destination matches native Text size '+quality,draws.length===1&&Math.abs(draws[0].width-rasterNumber.width)<1&&Math.abs(draws[0].height-rasterNumber.height)<1,{draws,width:rasterNumber.width,height:rasterNumber.height});
 }
 qaStage.style.width=stageWidth;battle.setPresentation({quality:'standard'});a.syncPresentation(false);
 a.feedback.clear();a.feedback.damage({x:180,y:150},12);a.tweens.update();const number=a.feedback.numbers.getChildren().find((x:any)=>x.active),numberStart=[number.y,number.alpha];
 await observeTween(160);check('native number rises and fades',number.y<numberStart[0]&&number.alpha<numberStart[1]&&number.active,{start:numberStart,y:number.y,alpha:number.alpha});
 battle.pause('background');g.scene.processQueue();const numberPause=[number.y,number.alpha];await new Promise(resolve=>window.setTimeout(resolve,100));step(20);check('background freezes native number Tween',number.y===numberPause[0]&&number.alpha===numberPause[1],numberPause);
 g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();check('continue clears numbers and their Tweens',a.feedback.snapshot().numbersActive===0&&a.tweens.getTweensOf(number).length===0,a.feedback.snapshot());
 a.feedback.damage({x:180,y:150},12);a.tweens.update();await observeTween(600);check('number completes within 600ms',a.feedback.snapshot().numbersActive===0,a.feedback.snapshot());
 start();a.feedback.clear();a.feedback.hit({x:180,y:150});a.tweens.update();
 const visual=a.feedback.effects.getChildren().find((x:any)=>x.active);
 await observeTween(120);
 const tween=a.tweens.getTweensOf(visual)[0];
 check('native wall-clock Tween advances visible alpha and progress',visual.alpha>0&&visual.alpha<1&&tween.progress>0&&tween.progress<1,{alpha:visual.alpha,progress:tween.progress});
 battle.pause('menu');g.scene.processQueue();const frozenTween=[visual.alpha,tween.progress];
 await new Promise(resolve=>window.setTimeout(resolve,100));step(30);
 check('native Scene pause freezes actual alpha and Tween progress',visual.alpha===frozenTween[0]&&tween.progress===frozenTween[1],{before:frozenTween,after:[visual.alpha,tween.progress]});
 g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
 check('resume removes frozen Tween target without catch-up',a.feedback.snapshot().active===0&&!visual.visible,a.feedback.snapshot());
 a.feedback.hit({x:180,y:150});a.tweens.update();const durationStart=performance.now();
 await observeTween(250);
 check('native approximately 200ms feedback completes and returns Group slot',a.feedback.snapshot().active===0,{wallMs:performance.now()-durationStart,active:a.feedback.snapshot().active});
 battle.dispose();out.textContent=JSON.stringify({status:'PASS',checks,environment:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},deviceAcceptance:'NOT_EXECUTED'});document.body.dataset.qa='PASS';
}
run().catch(e=>{out.textContent=JSON.stringify({status:'FAIL',error:String(e),stack:e.stack,checks});document.body.dataset.qa='FAIL';});
