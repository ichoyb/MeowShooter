import {createBattle} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import {RunGrowth,experienceNeeded} from '../../src/progression';
import {tenMinuteChecks} from './ten-minute-checks';
declare function require(path:string):any;
const w=window as any;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function boot(){
 const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('assets/ui/'+id+'.png')));
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),original=factory.prototype.graphics;
 let arena:any;factory.prototype.graphics=function(...args:any[]){arena=this.scene;return original.apply(this,args);};
 let battle:Awaited<ReturnType<typeof createBattle>>;
 try{battle=await createBattle(document.getElementById('stage')!,{onState(){},onInterrupt:r=>battle.pause(r),onFinish(){}},{CAT01,CAT02,CAT03});}
 finally{factory.prototype.graphics=original;}
 const a=arena,g=a.game,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;const checks:any[]=[];
 const check=(name:string,ok:unknown,value:unknown)=>{checks.push({name,pass:!!ok,value});if(!ok)throw Error(name);};
 const step=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;g.scene.update(now,1000/60);}};
 const start=(cat='CAT01')=>{g.loop.wake=()=>{};battle.start(makeRunConfig(cat as any,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic'));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();if(a.growth)a.growth=new RunGrowth(battle.snapshot().progression!.runId,()=>0);};
 const choose=(id:string)=>{const s=battle.snapshot().progression!;g.loop.wake=()=>{};const ok=battle.confirmUpgrade(s.runId,s.offer!.id,id);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();return ok;};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 tenMinuteChecks(a,g,battle,start,choose,position,(ms:number)=>{now+=ms;g.scene.update(now,ms);g.scene.processQueue();});
 w.runOrbitMainBuildChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const state=()=>battle.snapshot().bellAbilities!,wait=(ms:number)=>new Promise(r=>setTimeout(r,ms)),tick=(ms:number)=>{now+=ms;g.scene.update(now,ms);};
  const configure=(rank:number,rate:number,star=false)=>{a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:rate,L1_HEART:0,L1_ORBIT_BELL:rank,...(star?{L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1}:{})};if(!choose('L1_SPLIT'))throw Error('main build actual confirmation');a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
  const update=()=>{a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,12*(1+.2*a.growth.snapshot().ranks.L1_DAMAGE),battle.snapshot().elapsed);};
  for(const rank of [1,2,3])for(const rate of [0,1,3,8,...(rank===3?[11]:[])]){
   configure(rank,rate);const h=1+.15*rate,damage=12*[.75,1,1.4][rank-1],s=state() as any,tween=a.abilities.orbitTween;
   verify('main rank '+rank+' RATE '+rate+' actual native Tween and diagnostics use H without Scene haste',s.orbitHaste===h&&Math.abs(s.orbitPeriod-2.4/h)<1e-8&&s.orbitDamageCoefficient===[.75,1,1.4][rank-1]&&tween.timeScale===h&&a.time.timeScale===1&&a.tweens.timeScale===1&&rank+rate+1<=15,s);
   await wait(20);tick(20);const before=state().orbitAngle;await wait(90);tick(90);let delta=state().orbitAngle-before;if(delta<0)delta+=2*Math.PI;
   verify('main rank '+rank+' RATE '+rate+' real native rotation advances proportionally',delta>0&&Math.abs(delta-2*Math.PI*.09*h/2.4)<.11,{delta,h});
   const p=state().orbits[0],e=a.placeSliceEnemy('E01',p.x,p.y);e.setData('hp',1000);update();verify('main rank '+rank+' RATE '+rate+' actual endpoint collision uses unsplit level coefficient',Math.abs(e.getData('hp')-(1000-damage))<1e-7,{hp:e.getData('hp'),damage});
   position(e,600,1300);const cd=[.8,.7,.5][rank-1]/h;tick((cd-.001)*1000);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('main rank '+rank+' RATE '+rate+' cannot hit before effective shared CD',Math.abs(e.getData('hp')-(1000-damage))<1e-7,state());position(e,600,1300);tick(1);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('main rank '+rank+' RATE '+rate+' hits at effective CD',Math.abs(e.getData('hp')-(1000-2*damage))<1e-7,state());a.recycle(e,a.enemies);
  }
  configure(1,0,true);a.abilities.collect(8,a.growth.snapshot().ranks);await wait(90);tick(90);const p=state().orbits[0],e=a.placeSliceEnemy('E01',p.x,p.y);e.setData('hp',1000);update();position(e,600,1300);tick(180);
  a.growth.collect(14);step();g.scene.processQueue();const before=state(),at=battle.snapshot().elapsed,hitAt=e.getData('orbitHitAt'),rotation=a.abilities.orbitTween,end=a.abilities.starEnd,expected=at-(at-hitAt)/.8*(.8/1.15);
  verify('RATE-only confirmation keeps native rotation phase, relative phases, current star radius/window/charge and no bonus hit',choose('L1_RATE')&&a.abilities.orbitTween===rotation&&state().orbitAngle===before.orbitAngle&&JSON.stringify(state().orbits.map(b=>b.phase))===JSON.stringify(before.orbits.map(b=>b.phase))&&state().orbitRadius===before.orbitRadius&&a.abilities.starEnd===end&&state().charge===before.charge&&state().orbitHits===before.orbitHits,state());
  verify('RATE-only confirmation remaps an off-contact enemy immediately at unchanged session elapsed',Math.abs(e.getData('orbitHitAt')-expected)<1e-8&&battle.snapshot().elapsed===at,{expected,actual:e.getData('orbitHitAt'),at});a.recycle(e,a.enemies);
  const endAt=battle.snapshot().elapsed+a.abilities.starEnd.getRemaining()/1000;while(a.abilities.starEnd&&a.abilities.starEnd.getRemaining()>0)tick(Math.min(20,a.abilities.starEnd.getRemaining()));verify('RATE haste never accelerates three-second native star window',!state().starActive&&Math.abs(battle.snapshot().elapsed-endAt)<1e-7,{elapsed:battle.snapshot().elapsed,endAt});
  for(const cap of [6,9]){
   configure(0,0);a.growth.ranks.L1_TRAIL_BELL=1;if(cap===9)a.growth.ranks.L1_DUO_TRAIL_CADENCE=1;
   for(let i=0;i<cap;i++)a.abilities.place({x:100+i*45,y:200},12,cap);const group=a.abilities.trails,first=group.getFirstAlive(),arm=first.getData('armTimer');
   a.abilities.place({x:100+cap*45,y:200},12,cap);verify('long-lived cap '+cap+' replaces oldest before arming without explosion and cancels native callback',state().trails.length===cap&&state().replaced===1&&state().explosions===0&&state().trails.every(b=>b.birth>1)&&arm.callback===undefined&&group.maxSize===9,state());
   for(const seconds of [9,12,60]){while(battle.snapshot().elapsed<seconds)tick(Math.min(1000/60,(seconds-battle.snapshot().elapsed)*1000));verify('long-lived cap '+cap+' retains every armed bell after '+seconds+' effective seconds',state().trails.length===cap&&state().trails.every(b=>b.armed)&&state().replaced===1&&state().explosions===0,state());}
   position(a.cat,684,1300);step();const retained=JSON.stringify(state().trails);for(const reason of ['menu','background']){battle.pause(reason as any);g.scene.processQueue();await wait(40);tick(1000);verify('long-lived cap '+cap+' '+reason+' and off-camera travel preserve bells',JSON.stringify(state().trails)===retained,state());g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();}
   a.growth.ranks.L1_DAMAGE=8;const point=state().trails[0],victim=a.placeSliceEnemy('E01',point.x,point.y);victim.setData('hp',100);update();verify('long-lived cap '+cap+' old deployment keeps frozen D after later damage growth and triggers only once',Math.abs(victim.getData('hp')-89.2)<1e-8&&state().explosions===1&&state().trails.length===cap-1,state());update();verify('long-lived cap '+cap+' exploded bell cannot repeat damage',Math.abs(victim.getData('hp')-89.2)<1e-8&&state().explosions===1,state());a.recycle(victim,a.enemies);
   for(let i=0;i<20;i++){start();a.growth.ranks.L1_TRAIL_BELL=1;for(let j=0;j<cap;j++)a.abilities.place({x:100+j*45,y:200},12,cap);const timers=group.getChildren().filter((b:any)=>b.active).map((b:any)=>b.getData('armTimer'));start();verify('long-lived cap '+cap+' restart '+i+' clears pending callbacks and reuses bounded native Group',state().trails.length===0&&group===a.abilities.trails&&group.getLength()<=9&&timers.every((t:any)=>t.callback===undefined),state());}
  }
  a.fireVolley=fire;start();return {status:'PASS',scope:'G3_MAIN_DAMAGE_HASTE_NATIVE_TWEEN_REAL_CONFIRMATION_FINITE_LONG_LIVED_TRAILS',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitHasteMovementChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const Phaser=require('../../src/phaser-entry.cjs'),circleToCircle=require('phaser/src/geom/intersects/CircleToCircle'),state=()=>battle.snapshot().bellAbilities!;
  for(const fps of [30,60])for(const rate of [0,1,3,8,11]){
   a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:rate,L1_HEART:0,L1_ORBIT_BELL:3};if(!choose('L1_SPLIT'))throw Error('haste moving confirmation');a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};position(a.cat,200,720);const e=a.placeSliceEnemy('E01',280,720);e.setData('hp',1000);e.body.moves=false;a.physics.world.step(0);a.keys.D.isDown=true;
   const trace:any[]=[],events:any[]=[],cd=.5/(1+.15*rate);let previous=1000,last=-Infinity,missed=0;
   for(let frame=0;frame<fps;frame++){await new Promise(r=>setTimeout(r,1000/fps));now+=1000/fps;g.scene.update(now,1000/fps);const s=state(),time=battle.snapshot().elapsed,hp=e.getData('hp'),point={x:e.body.center.x,y:e.body.center.y},touch=s.orbits.some(b=>circleToCircle(new Phaser.Geom.Circle(b.x,b.y,8),new Phaser.Geom.Circle(point.x,point.y,12))),eligible=time+1e-8>=last+cd,damage=previous-hp,row={frame,time,cat:{x:a.cat.body.center.x,y:a.cat.body.center.y},enemy:point,angle:s.orbitAngle,bells:s.orbits.map(b=>({...b})),touch,eligible,damage};
    trace.push(row);if(damage){events.push(row);last=time;}else if(touch&&eligible)missed++;previous=hp;
   }
   a.clearInput();const value={fps,rate,picks:rate+4,cd,damage:1000-e.getData('hp'),events,missed,trace,scope:'ACTUAL_NATIVE_TWEEN_AND_ARCADE_BODY_DELTA_NOT_RENDER_FPS'};
   verify(fps+'Hz RATE '+rate+' moving native circle contacts produce damage without missed eligible endpoints',events.length>0&&missed===0&&events.every((event,i)=>event.touch&&Math.abs(event.damage-16.8)<1e-7&&(!i||event.time-events[i-1].time+1e-8>=cd))&&trace[trace.length-1].cat.x-trace[0].cat.x>150&&rate+4<=15,value);
   e.body.moves=true;a.recycle(e,a.enemies);
  }
  a.fireVolley=fire;start();return {status:'PASS',scope:'HASTE_ZERO_ONE_THREE_EIGHT_AND_LEGAL15_PICK_NATIVE_MOVING30_60HZ',checks};
 }catch(error){for(const e of a.enemies.getChildren())if(e.body)e.body.moves=true;a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitMainBuildDamageChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley,apply=a.applyHitResult;try{
  const cases=[
   {name:'orbit-main-five',ranks:{L1_ORBIT_BELL:3,L1_DAMAGE:1,L1_RATE:1},confirm:'L1_RATE'},
   {name:'barrage-shock-five',ranks:{L1_SPLIT:1,L1_DAMAGE:1,L1_RATE:1,L1_EVO_BARRAGE:1,L1_SHOCK_BELL:1},confirm:'L1_RATE'},
   {name:'pierce-ricochet-five',ranks:{L1_PIERCE:1,L1_DAMAGE:1,L1_RANGE:1,L1_EVO_PIERCE:1,L1_RICOCHET:1},confirm:'L1_DAMAGE'},
   {name:'cadence-light-five',ranks:{L1_ECHO:1,L1_RATE:1,L1_RELOAD:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1},confirm:'L1_RATE'}
  ];
  for(const mode of ['single','group'])for(const entry of cases){
   a.applyHitResult=apply;a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...entry.ranks,[entry.confirm]:0};verify(entry.name+' '+mode+' exact five-pick controlled build uses actual confirmation',choose(entry.confirm)&&Object.values(a.growth.snapshot().ranks).reduce((sum:number,v:any)=>sum+v,0)===5,a.growth.snapshot().ranks);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};position(a.cat,360,720);
   const positions=mode==='single'?[[420,720]]:[[420,720],[420,700],[420,740],[444,720],[444,700],[444,740]],targets=positions.map(([x,y])=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',1000000);e.body.moves=false;return e;});a.physics.world.step(0);
   const damage:Record<string,number>={},events:Record<string,number>={};a.applyHitResult=function(target:any,result:any,...rest:any[]){if(result.targetKind==='enemy'){const key=result.effect||result.source;damage[key]=(damage[key]||0)+result.damage;events[key]=(events[key]||0)+1;}return apply.call(this,target,result,...rest);};
   const begin=battle.snapshot().elapsed,angle=battle.snapshot().bellAbilities!.orbitAngle;for(let frame=0;frame<720;frame++){if(entry.name==='orbit-main-five')await new Promise(r=>setTimeout(r,1000/30));now+=1000/30;g.scene.update(now,1000/30);}
   const s=battle.snapshot(),total=Object.values(damage).reduce((sum,v)=>sum+v,0),orbit=damage.ORBIT_BELL||0,share=total?orbit/total:0,value={mode,ranks:s.progression!.ranks,elapsed:s.elapsed-begin,damage,events,total,orbitShare:share,shots:s.shots,reloads:s.reloadCompletions,targetHP:targets.map(e=>e.getData('hp')),geometry:positions,nativeOrbitAngle:{from:angle,to:s.bellAbilities!.orbitAngle},scope:'CONTROLLED_FIXED_HIGH_HP_TARGETS_24_EFFECTIVE_SECONDS_REAL_ARENA_PRIMARY_RETAINED_NOT_BALANCE_OR_NATURAL_RUN'};
   verify(entry.name+' '+mode+' measures actual hit-result damage over24 effective seconds with primary retained',Math.abs(s.elapsed-begin-24)<1e-7&&s.shots>0&&(damage.PRIMARY||0)>0&&targets.every(e=>e.getData('hp')>900000)&&s.kills===0,value);
   if(entry.name==='orbit-main-five')verify(entry.name+' '+mode+' orbit contributes at least half actual total damage',share>=.5,value);
   targets.forEach(e=>{e.body.moves=true;a.recycle(e,a.enemies);});
  }
  a.applyHitResult=apply;a.fireVolley=fire;start();return {status:'PASS',scope:'EXACT_FIVE_PICK_FIXED_SINGLE_AND_GROUP_ACTUAL_DAMAGE_REFERENCE_NOT_BALANCE',checks};
 }catch(error){a.applyHitResult=apply;for(const e of a.enemies.getChildren())if(e.body)e.body.moves=true;a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitRankChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const N=require('../../src/progression').GROWTH_NUMBERS,state=()=>battle.snapshot().bellAbilities!,wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const update=()=>{a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,12,battle.snapshot().elapsed);};
  const tick=(ms:number)=>{now+=ms;g.scene.update(now,ms);};
  const configure=(rank:number,star=false)=>{a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:rank,...(star?{L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1}:{})};verify('actual confirmation configures orbit rank '+rank,choose('L1_RATE'),a.growth.snapshot().ranks);a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
  const victim=(index=0)=>{const b=state().orbits[index],e=a.placeSliceEnemy('E01',b.x,b.y);e.setData('hp',1000);a.physics.world.step(0);return e;};
  for(const rank of [1,2,3]){
   configure(rank);const st=state(),count=rank+1,cd=[.8,.7,.5][rank-1]/1.15,damage=12*[.75,1,1.4][rank-1];
   verify('rank '+rank+' owns '+count+' actual16u bells on60u orbit in reusable native max4 Group',st.orbits.length===count&&a.abilities.orbits.maxSize===4&&a.abilities.orbits.getChildren().filter((b:any)=>b.active).every((b:any)=>b.displayWidth===16)&&st.orbitRadius===60&&a.abilities.orbitTween.data[0].duration===2400,st);
   verify('rank '+rank+' distributes bells at equal angle from unchanged base phase',st.orbits.every((b,i)=>Math.abs(b.phase-i*2*Math.PI/count)<1e-8&&Math.abs(Math.hypot(b.x-a.cat.body.center.x,b.y-a.cat.body.center.y)-60)<1e-8),st);
   const e=victim();update();verify('rank '+rank+' actual first contact deals current-rank D',e.getData('hp')===1000-damage&&state().orbitHits===1,state());
   for(let i=1;i<count;i++){position(e,state().orbits[i].x,state().orbits[i].y);update();}
   verify('rank '+rank+' all bells share one enemy ledger',e.getData('hp')===1000-damage&&state().orbitHits===1,state());
   position(e,600,1300);tick((cd-.001)*1000);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('rank '+rank+' does not hit before '+cd+'s',e.getData('hp')===1000-damage,{hp:e.getData('hp'),time:battle.snapshot().elapsed});
   position(e,600,1300);tick(1);position(e,state().orbits[count-1].x,state().orbits[count-1].y);update();verify('rank '+rank+' hits at exact shared '+cd+'s',Math.abs(e.getData('hp')-(1000-2*damage))<1e-7&&state().orbitHits===2,state());a.recycle(e,a.enemies);
   const b=state().orbits[0],outside=a.placeSliceEnemy('E01',b.x+20.01,b.y);outside.setData('hp',1000);update();verify('rank '+rank+' true overlap excludes radius8+enemy12 beyond tangent',outside.getData('hp')===1000,{hp:outside.getData('hp'),bell:b,enemyRadius:outside.body.halfWidth});position(outside,b.x+19.99,b.y);update();verify('rank '+rank+' true overlap includes inside radius8+enemy12',outside.getData('hp')===1000-damage,{hp:outside.getData('hp')});a.recycle(outside,a.enemies);
  }
  for(const from of [1,2]){
   configure(from,true);a.abilities.state.collect(3,true);const e=victim();update();position(e,600,1300);tick(200);
   a.growth.random=()=>.999;a.growth.collect(experienceNeeded(a.growth.snapshot().level)-a.growth.snapshot().xp);step();g.scene.processQueue();
   verify('rank '+from+' next real offer contains its related orbit upgrade',a.growth.snapshot().offer.choices.includes('L1_ORBIT_BELL'),a.growth.snapshot().offer);
   const at=battle.snapshot().elapsed,old=e.getData('orbitHitAt'),hp=e.getData('hp'),hits=state().orbitHits,phase=state().orbitAngle,tween=a.abilities.orbitTween,oldCD=[.8,.7][from-1]/1.15,newCD=[.7,.5][from-1]/1.15,expected=at-(at-old)/oldCD*newCD;
   verify('real rank '+from+'→'+(from+1)+' confirmation keeps phase/Tween/charge and causes no contact',choose('L1_ORBIT_BELL')&&state().orbitRank===from+1&&state().orbits.length===from+2&&state().orbitAngle===phase&&a.abilities.orbitTween===tween&&state().charge===3&&e.getData('hp')===hp&&state().orbitHits===hits,state());
   verify('rank '+from+' upgrade immediately remaps off-orbit enemy shared cooldown fraction at unique effective time',Math.abs(e.getData('orbitHitAt')-expected)<1e-8&&battle.snapshot().elapsed===at,{at,old,actual:e.getData('orbitHitAt'),expected});
   const ready=expected+newCD,remain=ready-battle.snapshot().elapsed;position(e,600,1300);tick((remain-.001)*1000);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('rank upgrade does not wait until later contact to remap',e.getData('hp')===hp,{hp:e.getData('hp'),elapsed:battle.snapshot().elapsed,ready});position(e,600,1300);tick(1);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('remapped cooldown permits one hit exactly when preserved fraction completes',Math.abs(e.getData('hp')-(hp-12*[1,1.4][from-1]))<1e-7,{hp:e.getData('hp'),elapsed:battle.snapshot().elapsed,ready});a.recycle(e,a.enemies);
  }
  // A newly added bell is positioned during confirmation, then joins contacts
  // only in the next running Scene update. Existing cooldowns are untouched.
  configure(1);a.growth.random=()=>.999;a.growth.collect(14);step();g.scene.processQueue();const phase=state().orbitAngle,point={x:a.cat.body.center.x+60,y:a.cat.body.center.y};require('../../src/phaser-entry.cjs').Math.RotateAroundDistance(point,a.cat.body.center.x,a.cat.body.center.y,phase+4*Math.PI/3,60);const fresh=a.placeSliceEnemy('E01',point.x,point.y);fresh.setData('hp',1000);a.physics.world.step(0);verify('adding third bell confirms without immediate damage',choose('L1_ORBIT_BELL')&&fresh.getData('hp')===1000,{hp:fresh.getData('hp'),state:state()});step();verify('new third bell participates on next normal Scene update',fresh.getData('hp')===988,{hp:fresh.getData('hp'),state:state()});a.recycle(fresh,a.enemies);
  // Real native movement at both deltas, including a camera/world edge; these
  // are simulation frame cases, not measured rendering FPS.
  for(const fps of [30,60])for(const edge of [false,true]){
   configure(3);position(a.cat,edge?684:360,edge?1300:720);a.keys.D.isDown=true;
   for(let i=0;i<fps;i++)tick(1000/fps);a.clearInput();const st=state(),p=battle.snapshot().player;
   verify(fps+'Hz native moving orbit follows actual Body at '+(edge?'world/camera edge':'middle'),st.orbits.length===4&&st.orbits.every(b=>Math.abs(Math.hypot(b.x-p.x,b.y-p.y)-60)<1e-6)&&p.x<=(edge?702:540)+1e-6,{player:p,view:{...a.cameras.main.worldView},state:st});
  }
  for(const rank of [1,2,3])for(const reason of ['menu','background','upgrade']){
   configure(rank,true);await wait(35);step();
   if(reason==='upgrade'){a.growth.collect(14);step();g.scene.processQueue();}else{battle.pause(reason as any);g.scene.processQueue();}
   const before=JSON.stringify(state()),elapsed=battle.snapshot().elapsed;await wait(150);tick(150);verify('rank '+rank+' '+reason+' actual150ms wall time freezes entities and effective time',JSON.stringify(state())===before&&battle.snapshot().elapsed===elapsed,state());
   if(reason==='upgrade')choose('L1_DAMAGE');else{g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();}
   const angle=state().orbitAngle;step();let delta=state().orbitAngle-angle;if(delta<0)delta+=2*Math.PI;verify('rank '+rank+' '+reason+' resumes without skipped arc or damage debt',delta<=.06&&Math.abs(battle.snapshot().elapsed-elapsed-1/60)<1e-8&&state().orbitHits===0,{delta,state:state()});
  }
  configure(3,true);const nativeGroup=a.abilities.orbits;const nodes=a.children.length;
  for(let i=0;i<20;i++){configure(3,true);a.abilities.collect(8,a.growth.snapshot().ranks);const abilities=a.abilities,rotation=abilities.orbitTween,radius=abilities.radiusTween,timers=[abilities.starReturn,abilities.starEnd];start();verify('rank3 restart '+i+' reuses native Group and clears all old Clock/Tween/charge/entities',abilities.orbits===nativeGroup&&state().orbits.length===0&&state().charge===0&&!state().starActive&&timers.every(t=>t.callback===undefined)&&!a.tweens.getTweens().includes(rotation)&&!a.tweens.getTweens().includes(radius)&&a.children.length===nodes,{nodes:a.children.length,state:state()});}
  const moving=await w.runOrbitMovingContactChecks();checks.push(...moving.checks);if(moving.status!=='PASS')throw Error('moving-contact matrix: '+moving.error);
  a.fireVolley=fire;start();return {status:'PASS',scope:'G3_NATIVE_ORBIT_RANKS_EFFECTIVE_TIME_NATIVE_MOVEMENT_NOT_RENDER_FPS',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitMovingContactChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley,moveToObject=a.physics.moveToObject;try{
  const Phaser=require('../../src/phaser-entry.cjs'),circleToCircle=require('phaser/src/geom/intersects/CircleToCircle'),lineToLine=require('phaser/src/geom/intersects/LineToLine'),state=()=>battle.snapshot().bellAbilities!,wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const tick=async(ms:number)=>{await wait(ms);now+=ms;g.scene.update(now,ms);};
  const configure=(rank:number,star=false)=>{a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:rank,...(star?{L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1}:{})};if(!choose('L1_RATE'))throw Error('moving-contact setup confirmation');a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
  let pickupId=970000;
  for(const fps of [30,60])for(const mode of ['fixed','relative','edge','near-miss','mistimed','expanding','contracting']){
   const enhanced=mode==='expanding'||mode==='contracting',rank=mode==='relative'||mode==='contracting'?2:mode==='edge'||mode==='expanding'?3:1;
   configure(rank,enhanced);position(a.cat,mode==='edge'?640:200,mode==='edge'?1300:720);
   if(enhanced){a.pickups.drop(pickupId++,'E01',{...a.cat.body.center});a.pickups.group.getFirstAlive().setData('xp',8);step();if(!state().starActive)throw Error('actual pickup did not start moving star');}
   if(mode==='contracting')while(a.abilities.starEnd.getRemaining()>180)await tick(Math.min(20,a.abilities.starEnd.getRemaining()-180));
   a.abilities.update(a.growth.snapshot().ranks,12,battle.snapshot().elapsed);
   if(mode==='mistimed')a.abilities.orbitTween.pause();
   const first=mode==='contracting'?state().orbits.reduce((best,b)=>b.y<best.y?b:best):state().orbits[0],target=mode==='edge'?{x:708,y:1325}:mode==='near-miss'?{x:280,y:699}:mode==='mistimed'?{x:360,y:717.3}:mode==='contracting'?{x:first.x+21.5,y:first.y}:mode==='expanding'?{x:290,y:730}:{x:285,y:720};
   const e=a.placeSliceEnemy('E01',target.x,target.y);e.setData('hp',1000);if(mode!=='relative'&&mode!=='mistimed')e.body.moves=false;
   if(mode==='mistimed')a.physics.moveToObject=function(actor:any,target:any,speed:number){return moveToObject.call(this,actor,actor===e?{x:e.body.center.x,y:1440}:target,actor===e?54:speed);};
   a.physics.world.step(0);a.keys.D.isDown=true;
   const trace:any[]=[],duration=mode==='mistimed'?.8:mode==='edge'?.5:mode==='contracting'?.18:.35;
   const capture=()=>{const st=state(),enemy={x:e.body.center.x,y:e.body.center.y},bells=st.orbits.map(b=>({...b})),touching=bells.map(b=>circleToCircle(new Phaser.Geom.Circle(b.x,b.y,8),new Phaser.Geom.Circle(enemy.x,enemy.y,e.body.halfWidth)));
    return {time:battle.snapshot().elapsed,cat:{x:a.cat.body.center.x,y:a.cat.body.center.y},catPrev:{x:a.cat.body.prev.x+a.cat.body.halfWidth,y:a.cat.body.prev.y+a.cat.body.halfHeight},enemy,enemyPrev:{x:e.body.prev.x+e.body.halfWidth,y:e.body.prev.y+e.body.halfHeight},hp:e.getData('hp'),hitAt:Number.isFinite(e.getData('orbitHitAt'))?e.getData('orbitHitAt'):null,bells,touching,nativeQueryContains:bells.some(b=>a.physics.overlapCirc(b.x,b.y,8,true,false).some((body:any)=>body.gameObject===e)),radius:st.orbitRadius,angle:st.orbitAngle,starActive:st.starActive,view:{x:a.cameras.main.worldView.x,y:a.cameras.main.worldView.y,width:a.cameras.main.worldView.width,height:a.cameras.main.worldView.height}};};
   trace.push(capture());for(let frame=0;frame<Math.ceil(duration*fps);frame++){
    // Native Body movement and the complete Arena update own these traces;
    // no actor is teleported or moved by a copied integration formula.
    await tick(1000/fps);trace.push(capture());
   }
   a.clearInput();const damageEvents=trace.slice(1).flatMap((row,i)=>row.hp<trace[i].hp?[{frame:i+1,time:row.time,damage:trace[i].hp-row.hp,radius:row.radius,starActive:row.starActive,enemy:row.enemy,bells:row.bells,touching:row.touching,nativeQueryContains:row.nativeQueryContains}]:[]),expected=mode==='near-miss'||mode==='mistimed'?0:12*[.75,1,1.4][rank-1]*(enhanced?1.5:1);
   const value={fps,mode,rank,expectedDamage:expected,damageEvents,totalDamage:1000-e.getData('hp'),actualOrbitHits:state().orbitHits,contactFrames:trace.filter(row=>row.touching.some(Boolean)).length,nativeOrbitIntent:mode==='mistimed'?'native Counter Tween.pause() atphase0 isolates relative-motion timing; all other cases keep live native rotation':'live native2.4s Counter Tween',minimumCenterDistance:Math.min(...trace.flatMap(row=>row.bells.map(b=>Phaser.Math.Distance.BetweenPoints(b,row.enemy)))),nativeEnemyIntent:mode==='relative'?'existing E01 chase':mode==='mistimed'?'controlled native Arcade.moveToObject intent(0,54), no per-frame position writes':'native Body.moves=false for fixed target',trace};
   verify(fps+'Hz '+mode+' actual native trajectory produces '+expected+' damage exactly once or zero as specified',Math.abs((1000-e.getData('hp'))-expected)<1e-7&&damageEvents.length===(expected?1:0)&&state().orbitHits===(expected?1:0)&&damageEvents.every(event=>event.touching.some(Boolean)&&event.nativeQueryContains&&Math.abs(event.damage-expected)<1e-7),value);
   const firstFrame=trace[0],last=trace[trace.length-1];verify(fps+'Hz '+mode+' records actual moving player and intended fixed/relative enemy',last.cat.x-firstFrame.cat.x>10&&(mode==='relative'||mode==='mistimed'?Phaser.Math.Distance.BetweenPoints(firstFrame.enemy,last.enemy)>10:Phaser.Math.Distance.BetweenPoints(firstFrame.enemy,last.enemy)<1e-7),{from:firstFrame,to:last});
   if(expected)verify(fps+'Hz '+mode+' native passage cannot duplicate damage inside shared cooldown',value.contactFrames>=(mode==='contracting'?1:2)&&damageEvents.length===1,{contactFrames:value.contactFrames,damageEvents});
   if(enhanced)verify(fps+'Hz '+mode+' actual hit occurs within native radius transition at current-rank D ×1.5',damageEvents.length===1&&damageEvents[0].starActive&&damageEvents[0].radius>60&&damageEvents[0].radius<80,{damageEvents});
   if(mode==='edge')verify(fps+'Hz edge actual contact occurs beside camera/world border while native cat reaches702u',last.cat.x===702&&damageEvents.length===1&&damageEvents[0].enemy.x>=last.view.x+last.view.width-24,{last,damageEvents});
   if(mode==='near-miss')verify(fps+'Hz near-miss actually approaches radius20 boundary without damage',value.minimumCenterDistance>20&&value.minimumCenterDistance<30,{minimumCenterDistance:value.minimumCenterDistance,hp:e.getData('hp')});
   if(mode==='mistimed'){
    let crossing:any=null;for(let i=1;i<trace.length&&!crossing;i++)for(let j=1;j<trace.length&&!crossing;j++)for(let bell=0;bell<trace[i].bells.length&&!crossing;bell++){
     const bp=trace[i-1].bells[bell],bn=trace[i].bells[bell],ep=trace[j-1].enemy,en=trace[j].enemy,point=new Phaser.Math.Vector2();
     if(lineToLine(new Phaser.Geom.Line(bp.x,bp.y,bn.x,bn.y),new Phaser.Geom.Line(ep.x,ep.y,en.x,en.y),point))crossing={point:{x:point.x,y:point.y},bellFrame:i,enemyFrame:j,bellTime:trace[i].time,enemyTime:trace[j].time};
    }
    verify(fps+'Hz mistimed native paths spatially cross at different times without a ghost hit',!!crossing&&Math.abs(crossing.bellTime-crossing.enemyTime)>.5&&!trace.some(row=>row.touching.some(Boolean))&&e.getData('hp')===1000,{crossing,minimumCenterDistance:value.minimumCenterDistance});
   }
   e.body.moves=true;a.physics.moveToObject=moveToObject;a.recycle(e,a.enemies);
  }
  a.fireVolley=fire;start();return {status:'PASS',scope:'ACTUAL_NATIVE_BODY_MOTION_AND_DAMAGE_AT30_60HZ_FIXED_RELATIVE_STAR_TRANSITIONS_CAMERA_EDGE_NEAR_MISS_MISTIMED_NOT_RENDER_FPS',checks};
 }catch(error){a.physics.moveToObject=moveToObject;for(const e of a.enemies.getChildren())if(e.body)e.body.moves=true;a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitStarRankChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const state=()=>battle.snapshot().bellAbilities!,wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const advance=async(ms:number)=>{for(let elapsed=0;elapsed<ms;){const dt=Math.min(20,ms-elapsed);await wait(dt);now+=dt;g.scene.update(now,dt);elapsed+=dt;}};
  const update=()=>{a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,require('../../src/progression').abilityDamage(require('../../src/level-config').courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),a.growth.snapshot().ranks),battle.snapshot().elapsed);};
  let drop=980000,root=980000;const dismiss=()=>{while(a.growth.snapshot().offer){const choices=a.growth.snapshot().offer.choices;choose(choices.find((id:string)=>id==='L1_HEART')||choices.find((id:string)=>id==='L1_DAMAGE')||choices.find((id:string)=>id.startsWith('L1_')&&!id.includes('ORBIT')));}};
  const pickup=(xp:number)=>{a.pickups.drop(drop++,'E01',{...a.cat.body.center});a.pickups.group.getFirstAlive().setData('xp',xp);step();dismiss();};
  const consume=()=>{const before=state().chimes;a.fireVolley=fire;a.fireVolley({x:0,y:1,id:root++});a.fireVolley=()=>{};verify('actual root consumes one charged chime for star refill',state().charge===0&&state().chimes===before+1,state());};
  for(const rank of [1,2,3]){
   a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:rank,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1};verify('rank '+rank+' star setup uses actual upgrade confirmation',choose('L1_RATE'),a.growth.snapshot().ranks);a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   pickup(7);verify('rank '+rank+' real7XP remains below star threshold',state().charge===7&&!state().starActive,state());pickup(1);const tween=a.abilities.orbitTween;verify('rank '+rank+' real below8→8 event starts existing '+(rank+1)+'-bell star at60u',state().charge===8&&state().starActive&&state().orbits.length===rank+1&&state().orbitRadius===60,state());
   await advance(100);verify('rank '+rank+' native expansion preserves current count and actual contact positions',state().orbitRadius>60&&state().orbitRadius<80&&state().orbits.every(b=>Math.abs(Math.hypot(b.x-a.cat.body.center.x,b.y-a.cat.body.center.y)-state().orbitRadius)<1e-7),state());
   const b=state().orbits[0],e=a.placeSliceEnemy('E01',b.x,b.y);e.setData('hp',1000);update();const firstHP=e.getData('hp'),hitAt=e.getData('orbitHitAt');verify('rank '+rank+' expanding star actual contact deals current-rank independent D ×1.5',Math.abs(firstHP-(1000-12*[.75,1,1.4][rank-1]*1.5))<1e-7&&state().orbitHits===1,{hp:firstHP,state:state()});position(e,state().orbits[rank].x,state().orbits[rank].y);update();verify('rank '+rank+' star shares one enemy cooldown across all bells',e.getData('hp')===firstHP&&e.getData('orbitHitAt')===hitAt,state());position(e,600,1300);
   consume();const expiry=a.abilities.starEnd,oldRadius=state().orbitRadius;pickup(8);verify('rank '+rank+' real refill refreshes native3s window without cooldown reset or new rotation',expiry.callback===undefined&&a.abilities.starEnd!==expiry&&a.abilities.starEnd.getRemaining()===3000&&e.getData('orbitHitAt')===hitAt&&a.abilities.orbitTween===tween&&state().orbitRadius>=oldRadius&&state().orbitRadius<80,{state:state(),oldRadius});
   await advance(220);verify('rank '+rank+' star reaches80u with same current '+(rank+1)+' bells',Math.abs(state().orbitRadius-80)<1e-7&&state().orbits.length===rank+1,state());
   const cd=[.8,.7,.5][rank-1]/1.15,ready=hitAt+cd,remaining=ready-battle.snapshot().elapsed;now+=(remaining-.001)*1000;g.scene.update(now,(remaining-.001)*1000);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('rank '+rank+' star does not hit before inherited '+cd+'s shared CD',e.getData('hp')===firstHP,{hp:e.getData('hp'),ready,elapsed:battle.snapshot().elapsed});position(e,600,1300);now+=1;g.scene.update(now,1);position(e,state().orbits[0].x,state().orbits[0].y);update();verify('rank '+rank+' star hits exactly at inherited '+cd+'s',Math.abs(e.getData('hp')-(firstHP-require('../../src/progression').abilityDamage(require('../../src/level-config').courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),a.growth.snapshot().ranks)*[.75,1,1.4][rank-1]*1.5))<1e-8,{hp:e.getData('hp'),ready,elapsed:battle.snapshot().elapsed});a.recycle(e,a.enemies);
   for(const reason of ['menu','background']){battle.pause(reason as any);g.scene.processQueue();const before=JSON.stringify(state()),elapsed=battle.snapshot().elapsed;await wait(150);now+=150;g.scene.update(now,150);verify('rank '+rank+' star '+reason+' real150ms freezes radius/window/phase/damage',JSON.stringify(state())===before&&battle.snapshot().elapsed===elapsed,state());g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();const angle=state().orbitAngle;step();let delta=state().orbitAngle-angle;if(delta<0)delta+=2*Math.PI;verify('rank '+rank+' star '+reason+' resume has no wall-time debt',delta<=.06&&state().starActive,{delta,state:state()});}
   if(rank<3){a.growth.random=()=>.999;a.growth.collect(experienceNeeded(a.growth.snapshot().level)-a.growth.snapshot().xp);step();g.scene.processQueue();const phase=state().orbitAngle,radius=state().orbitRadius,end=a.abilities.starEnd,charge=state().charge,hits=state().orbitHits;verify('rank '+rank+' active-star actual orbit upgrade preserves radius/timer/phase/charge with no damage',choose('L1_ORBIT_BELL')&&state().orbitAngle===phase&&state().orbitRadius===radius&&a.abilities.starEnd===end&&state().charge===charge&&state().orbitHits===hits&&state().orbits.length===rank+2&&a.abilities.orbitTween===tween,state());}
   const enhancedCount=state().orbits.length;await advance(a.abilities.starEnd.getRemaining()-140);verify('initial rank '+rank+' final.2s native contraction keeps enhanced damage state and current bell count',state().starActive&&state().orbitRadius>60&&state().orbitRadius<80&&state().orbits.length===enhancedCount,state());await advance(200);verify('initial rank '+rank+' exactly finite effective window expires back to60u without XP renewal',!state().starActive&&state().orbitRadius===60&&state().orbits.length===enhancedCount,state());
  }
  a.fireVolley=fire;start();return {status:'PASS',scope:'REAL_PICKUP_STAR_ALL_RANKS_EXPAND_REFRESH_SHARED_CD_ACTIVE_UPGRADE_PAUSE_CONTRACT',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runOrbitRankCapacityChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley,resolve=a.resolveProjectile;try{
  start();const pool=a.projectiles;const fill=(n:number)=>{for(let i=0;i<n;i++)a.projectile({x:360,y:300},Math.PI/2,'bell','PRIMARY',10000+i,12,0,620,1.2);};fill(32);verify('Orange courtyard actually allocates32 in original native Group',a.projectiles.maxSize===32&&a.projectiles.countActive(true)===32&&a.projectiles.getLength()===32,battle.snapshot().engine.groups.projectiles);
  const old=a.projectiles.getChildren().slice(),timers=old.map((p:any)=>p.getData('lifeTimer'));start('CAT02');verify('other cat restores24 and destroys8 surplus recycled members in same Group',a.projectiles===pool&&a.projectiles.maxSize===24&&a.projectiles.getLength()===24&&timers.every((t:any)=>t.callback===undefined)&&old.slice(24).every((p:any)=>!p.scene),{group:battle.snapshot().engine.groups.projectiles,max:a.projectiles.maxSize});fill(25);verify('non-slice cannot reuse a25th hidden dead member',a.projectiles.countActive(true)===24&&a.projectiles.getLength()===24,battle.snapshot().engine.groups.projectiles);start();fill(32);verify('return Orange restores32 on same native Group',a.projectiles===pool&&a.projectiles.maxSize===32&&a.projectiles.countActive(true)===32,battle.snapshot().engine.groups.projectiles);
  start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:6,L1_HEART:3,L1_SPLIT:1,L1_ECHO:1,L1_EVO_BARRAGE:1,L1_EVO_CADENCE:1,L1_PICKUP_CHIME:1};verify('15-investment audit worst vector applies through actual confirmation',choose('L1_RATE')&&Object.values(a.growth.snapshot().ranks).reduce((n:number,v:any)=>n+v,0)===15,a.growth.snapshot().ranks);
  position(a.cat,360,300);const target=a.placeSliceEnemy('E01',360,530);target.setData('hp',1000000);a.resolveProjectile=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
  let peak=0,lastShots=0,lastReloads=0,remaining=0,secondary=0;const lifespan=1.2;
  for(let i=0;i<3600;i++){
   a.abilities.state.collect(8,true);position(target,360,530);step();const st=battle.snapshot();peak=Math.max(peak,st.projectiles);
   if(st.shots>lastShots){if(st.reloadCompletions>lastReloads)remaining=3;if(remaining){secondary+=3;remaining--;}else if(st.shots===1||st.reloadCompletions>lastReloads)secondary++;if(st.ammo===0)secondary+=2;secondary++;
    verify('15-pick actual root '+st.shots+' emits all primary/chime/opening/tail expected sources',st.sourceCounts.PRIMARY===st.shots*3&&st.sourceCounts.SECONDARY===secondary&&st.bellAbilities!.chimes===st.shots,{counts:st.sourceCounts,expected:{PRIMARY:st.shots*3,SECONDARY:secondary},active:st.projectiles});lastShots=st.shots;lastReloads=st.reloadCompletions;
   }
  }
  const st=battle.snapshot();verify('60 effective seconds full native1.2s lifetime audit worst vector preserves all source counts with32 slots',peak<=32&&peak>20&&st.reloadCompletions>=7&&a.projectiles===pool&&a.projectiles.maxSize===32,{peak,allocated:st.engine.groups.projectiles.total,roots:st.shots,reloads:st.reloadCompletions,lifespan,scope:'AUDIT_CONSERVATIVE27_IS_BOUND_NOT_EXPECTED_ACTUAL_PEAK',ranks:st.progression!.ranks,counts:st.sourceCounts});
  a.resolveProjectile=resolve;a.fireVolley=fire;start();return {status:'PASS',scope:'NATIVE_POOL32_24_32_AND15_PICK_FULL_LIFE_EXPECTED_EMISSION_COUNTS',checks};
 }catch(error){a.resolveProjectile=resolve;a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runGrowthChecks=()=>{try{
  start();let s=battle.snapshot();check('new run uses Lv1/0XP/0.8s and 30u/12u protected dimensions',s.progression?.level===1&&s.progression.xp===0&&s.weaponInterval===.8&&s.presentation?.bodyDisplay.width===30&&s.engine.bodies.cat.radius===12,s.progression);
  const p=a.pickups,enemy=a.placeSliceEnemy('E01',460,720);enemy.setData('hp',1);
  step(20);s=battle.snapshot();check('actual projectile death drops 2XP at enemy; kill alone grants no XP',s.kills===1&&s.pickups!.groundXP===2&&s.progression!.totalXP===0,{kills:s.kills,pickups:s.pickups});
  const orb=p.group.getFirstAlive();const point={x:orb.body.center.x,y:orb.body.center.y};p.drop(enemy.getData('id'),'E01',point);check('same death cannot pay twice',p.snapshot().droppedXP===2,p.snapshot());
  position(a.cat,point.x-39,point.y);step(1);check('orb inside 40u accelerates through Arcade',orb.getData('magnet')&&orb.body.velocity.length()>0,p.snapshot());step(16);s=battle.snapshot();check('native motion reaches independent 8u collection once',s.progression!.totalXP===2&&s.pickups!.active===0&&s.pickups!.collectedXP===2,s.pickups);
  start();for(let i=0;i<512;i++)a.pickups.drop(1000+i,'E01',{x:50+i%10*10,y:50+Math.floor(i/10)*10});s=battle.snapshot();check('96-object cap merges overflow without losing XP',s.pickups!.active===96&&s.pickups!.groundXP===1024&&s.pickups!.droppedXP===1024,s.pickups!.active);
  a.pickups.drop(3000,'B01',{x:360,y:720});a.pickups.drop(3001,'EL01',{x:360,y:720});check('elite and final Boss do not masquerade as ordinary XP',a.pickups.snapshot().droppedXP===1024,a.pickups.snapshot().droppedXP);
  start();a.pickups.drop(4000,'E01',{x:369,y:720});const before=battle.snapshot();check('physical player radius remains 12u, collection separate',before.engine.bodies.cat.radius===12,before.engine.bodies.cat.radius);
  a.growth.collect(25);a.keys.D.isDown=true;step();g.scene.processQueue();s=battle.snapshot();check('multi-level pickup opens one frozen offer and clears movement',s.progression!.pending===2&&s.reasons.includes('upgrade')&&!s.moveHeld&&s.engine.velocity.x===0,s.reasons);
  const frozen=JSON.stringify({elapsed:s.elapsed,projectiles:s.projectiles,pickups:s.pickups});step(90);s=battle.snapshot();check('upgrade freezes time, physical drops and projectiles',JSON.stringify({elapsed:s.elapsed,projectiles:s.projectiles,pickups:s.pickups})===frozen,s.elapsed);
  const offer=s.progression!.offer!,run=s.progression!.runId;battle.resume();g.scene.processQueue();check('ordinary resume cannot bypass upgrade',battle.snapshot().reasons.includes('upgrade')&&battle.snapshot().engine.paused,battle.snapshot().reasons);
  battle.pause('background');check('cannot confirm behind background wait',!battle.confirmUpgrade(run,offer.id,'L1_DAMAGE'),battle.snapshot().reasons);battle.resume();g.scene.processQueue();
  check('first real choice applies once and stays paused for second',choose('L1_DAMAGE')&&battle.snapshot().progression!.ranks.L1_DAMAGE===1&&battle.snapshot().reasons.includes('upgrade'),battle.snapshot().progression);
  check('previous offer token rejected after next offer',!battle.confirmUpgrade(run,offer.id,'L1_HEART'),battle.snapshot().progression);
  check('second choice resumes without old key',choose('L1_RATE')&&!battle.snapshot().engine.paused,battle.snapshot().reasons);step();s=battle.snapshot();check('new real cadence and clean velocity',Math.abs(s.weaponInterval-.8/1.15)<1e-8&&s.engine.velocity.x===0,s.weaponInterval);
  const target=a.placeSliceEnemy('E01',500,720);target.setData('hp',10000);step();const shots=a.projectiles.getChildren().filter((x:any)=>x.active&&x.getData('source')==='PRIMARY');check('new real projectiles use damage growth',shots.length>0&&shots.every((x:any)=>Math.abs(x.getData('damage')-14.4)<1e-8),shots.map((x:any)=>x.getData('damage')));
  start();const killer=a.placeSliceEnemy('E01',360,720);killer.setData('hp',10000);
  while(battle.snapshot().hp>8){position(killer,360,720);step(43);}
  a.growth.collect(6);a.pickups.drop(5000,'E01',{x:360,y:720});position(killer,360,720);a.contactAt=-Infinity;step();
  s=battle.snapshot();check('same-frame lethal contact wins over underfoot XP and no healing menu',s.result==='death'&&s.progression!.totalXP===6&&s.progression!.offer===null&&s.pickups!.groundXP===2,{result:s.result,growth:s.progression,pickups:s.pickups});
  start();a.growth.collect(6);a.pickups.drop(5001,'E01',{x:360,y:720});now+=600000;g.scene.update(now,600000);s=battle.snapshot();
  check('600s timeout wins over pending pickup',s.result==='timeout'&&s.progression!.totalXP===6&&s.progression!.offer===null,{result:s.result,growth:s.progression});
  start();const far=a.placeSliceEnemy('E01',590,720);far.setData('hp',10000);step();const old=a.projectiles.getChildren().find((x:any)=>x.active&&x.getData('source')==='PRIMARY');
  a.growth.collect(8);step();g.scene.processQueue();choose('L1_DAMAGE');check('in-flight projectiles keep their launch damage',old.active&&old.getData('damage')===12,old.getData('damage'));
  start();const preserved=battle.snapshot().presentation;
  const one=a.placeSliceEnemy('E01',590,720);one.setData('hp',10000);step();
  const oldSingle=a.projectiles.getChildren().find((x:any)=>x.active&&x.getData('source')==='PRIMARY');
  a.growth.collect(8);step();g.scene.processQueue();check('real core offer appears before any attribute purchase',battle.snapshot().progression!.offer!.choices.includes('L1_SPLIT'),battle.snapshot().progression!.offer);
  check('selecting core keeps old in-flight shot and physical dimensions',choose('L1_SPLIT')&&oldSingle.active&&oldSingle.getData('damage')===12&&battle.snapshot().engine.bodies.cat.radius===12,oldSingle.getData('damage'));
  const emit=()=>{
   for(const shot of a.projectiles.getChildren())if(shot.active)a.recycle(shot,a.projectiles);
   const snap=battle.snapshot(),volley=snap.shots+1;a.catArt?.fire();a.fireVolley({x:1,y:0,id:volley});
   return a.projectiles.getChildren().filter((x:any)=>x.active&&x.getData('source')==='PRIMARY');
  };
  let primary=emit();check('actual primary emitter uses two bells at -4 and +4 degrees',primary.length===2&&primary.every((x:any)=>Math.abs(x.getData('damage')-9.6)<1e-8)&&Math.abs(primary[0].rotation+4*Math.PI/180)<1e-8&&Math.abs(primary[1].rotation-4*Math.PI/180)<1e-8,primary.map((x:any)=>({damage:x.getData('damage'),angle:x.rotation})));
  a.growth.collect(experienceNeeded(2));step();g.scene.processQueue();choose('L1_DAMAGE');a.growth.collect(experienceNeeded(3));step();g.scene.processQueue();choose('L1_RATE');
  check('next real offer guarantees evolution and does not grant it free',!battle.snapshot().progression!.ranks.L1_EVO_BARRAGE&&battle.snapshot().progression!.barrage.eligible,battle.snapshot().progression);
  a.growth.collect(experienceNeeded(4));step();g.scene.processQueue();const evoOffer=battle.snapshot().progression!.offer!;
  check('real upgrade transaction grants evolution only on confirmation',evoOffer.choices.includes('L1_EVO_BARRAGE')&&choose('L1_EVO_BARRAGE'),battle.snapshot().progression);
  primary=emit();check('actual evolved emitter has three bells with only one 0.8 multiplier',primary.length===3&&primary.every((x:any)=>Math.abs(x.getData('damage')-11.52)<1e-8)&&Math.abs(primary[1].rotation)<1e-8,primary.map((x:any)=>({damage:x.getData('damage'),angle:x.rotation})));
  check('confirmed actions and visual size remain protected across evolution',battle.snapshot().presentation!.bodyDisplay.width===30&&battle.snapshot().engine.bodies.cat.radius===12&&preserved!.bodyDisplay.width===30,battle.snapshot().presentation!.bodyDisplay);
  // Fresh evolved run: observe natural cadence, one ammo per volley and the
  // original single secondary only on the opening/reload volley.
  start();a.growth.collect(100);step();g.scene.processQueue();
  for(const id of ['L1_SPLIT','L1_DAMAGE','L1_RATE','L1_EVO_BARRAGE'])check('controlled queued choice '+id,choose(id),battle.snapshot().progression!.ranks);
  const durable=a.placeSliceEnemy('E01',590,720);durable.setData('hp',100000);step();s=battle.snapshot();
  check('natural evolved volley consumes one ammo and emits three primary plus one secondary',s.ammo===11&&s.shots===1&&s.sourceCounts.PRIMARY===3&&s.sourceCounts.SECONDARY===1,{ammo:s.ammo,shots:s.shots,counts:s.sourceCounts});
  const secondary=a.projectiles.getChildren().find((x:any)=>x.active&&x.getData('source')==='SECONDARY');check('single reload secondary scales with current primary and is not multiplied in count',secondary&&Math.abs(secondary.getData('damage')-8.64)<1e-8,secondary?.getData('damage'));
  step(44);s=battle.snapshot();check('second natural evolved volley adds only three primary',s.shots===2&&s.ammo===10&&s.sourceCounts.PRIMARY===6&&s.sourceCounts.SECONDARY===1,s.sourceCounts);
  // No infinite object claim: the natural short-level maximum is six XP picks.
  // At most three primary per volley and one reload secondary stay in native pool.
  const peak=s.engine.groups.projectiles.active;check('new route active occupancy remains within original24 bound',peak<=24,s.engine.groups.projectiles);
  start();const nodes=a.children.length;for(let i=0;i<20;i++){a.pickups.drop(6000,'E01',{x:50,y:50});start();}s=battle.snapshot();check('20 restarts clear growth, drops, inputs and reuse objects',s.pickups!.active===0&&s.progression!.level===1&&s.progression!.totalXP===0&&a.children.length===nodes,s.pickups);
  start('CAT02');check('other cat baseline does not gain pilot progression',battle.snapshot().progression===null,battle.snapshot().catId);
  return {status:'PASS',scope:'CONTROLLED_PHASER_SCENE',checks};
 }catch(e){return {status:'FAIL',error:String(e),checks};}};
 w.growthSceneReady=true;
 w.runThreeBuildsChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  const Hits=require('../../src/battle-hits.cjs');
  const setup=(path:string[])=>{
   start();let draw=path[0]==='L1_PIERCE'?.3:path[0]==='L1_ECHO'?.5:0;
   a.growth=new RunGrowth(battle.snapshot().progression!.runId,()=>draw);
   a.growth.collect(Array.from({length:path.length},(_,i)=>experienceNeeded(i+1)).reduce((a,b)=>a+b,0));step();g.scene.processQueue();draw=path[0]==='L1_ECHO'?.99:0;
   for(const id of path)verify('actual route choice '+id,choose(id),battle.snapshot().progression!.ranks);
  };
  const sweep=(frames:number)=>{for(let i=0;i<frames;i++){
   a.physics.world.update(now,1000/60);const pad=Hits.targetMotionPadding(a.physics);
   for(const shot of a.projectiles.getChildren())if(shot.active){for(const c of Hits.hitCandidates(shot,a.physics,pad)){a.hit(shot,c.target,c.path);if(!shot.active)break;}}
   a.physics.world.postUpdate();now+=1000/60;
  }};
  setup(['L1_PIERCE']);const line=[430,470,510].map(x=>{const e=a.placeSliceEnemy('E01',x,720);e.setData('hp',1000);e.setVelocity(-54,0);return e;});
  a.fire({x:1,y:0,id:800});sweep(25);
  verify('real pierce core hits first two moving bodies at 100/70 percent then stops',Math.abs(line[0].getData('hp')-988)<1e-8&&Math.abs(line[1].getData('hp')-991.6)<1e-8&&line[2].getData('hp')===1000,line.map(e=>e.getData('hp')));
  setup(['L1_PIERCE','L1_DAMAGE','L1_DAMAGE','L1_EVO_PIERCE']);const row=[430,470,510,550].map(x=>{const e=a.placeSliceEnemy('E01',x,720);e.setData('hp',1000);e.setVelocity(-54,0);return e;});
  a.fire({x:1,y:0,id:801});sweep(28);const damage=battle.snapshot().weaponStats.damage;
  verify('evolved real pierce hits exactly three bodies at 100/70/49 percent',row.every((e,i)=>Math.abs(e.getData('hp')-(i<3?1000-damage*.7**i:1000))<1e-8),row.map(e=>e.getData('hp')));
  setup(['L1_ECHO','L1_RELOAD','L1_RELOAD','L1_EVO_CADENCE']);
  const target=a.placeSliceEnemy('E01',590,720);target.setData('hp',100000);
  const tick=()=>{position(target,590,720);step();};
  let peak=0;while(battle.snapshot().shots<12&&battle.snapshot().elapsed<15){tick();peak=Math.max(peak,battle.snapshot().projectiles);}
  let s=battle.snapshot(),tail=a.projectiles.getChildren().filter((p:any)=>p.active&&p.getData('effect')==='TAIL_ECHO');
  verify('real last root volley emits two non-piercing 25 percent echoes, once',s.shots===12&&s.ammo===0&&s.bursts.tailBursts===1&&tail.length===2&&tail.every((p:any)=>p.getData('damage')===3&&p.getData('extraPierce')===0),{ammo:s.ammo,bursts:s.bursts,tail:tail.map((p:any)=>p.getData('damage'))});
  verify('real reload speed is derived and has not refilled ammo early',Math.abs(s.reloadSeconds-2.4/1.4)<1e-8&&s.reloadLeft>1.69,s.reloadLeft);
  battle.pause('background');g.scene.processQueue();const frozen=JSON.stringify({ammo:s.ammo,bursts:s.bursts,time:s.elapsed,counts:s.sourceCounts});step(120);s=battle.snapshot();
  verify('background freezes reload burst and never replays a tail',JSON.stringify({ammo:s.ammo,bursts:s.bursts,time:s.elapsed,counts:s.sourceCounts})===frozen,s.bursts);
  battle.resume();g.scene.processQueue();g.loop.sleep();while(battle.snapshot().shots<13&&battle.snapshot().elapsed<17){tick();peak=Math.max(peak,battle.snapshot().projectiles);}
  s=battle.snapshot();const opening=a.projectiles.getChildren().filter((p:any)=>p.active&&p.getData('effect')==='OPENING_BURST');
  verify('real completed reload opening replaces one secondary with three half-damage bells',s.shots===13&&s.reloadCompletions===1&&s.ammo===11&&s.bursts.openingBursts===1&&opening.length===3&&opening.every((p:any)=>p.getData('damage')===6&&p.getData('extraPierce')===0),{ammo:s.ammo,bursts:s.bursts,opening:opening.map((p:any)=>({damage:p.getData('damage'),rotation:p.rotation}))});
  verify('opening replacement does not also add the old passive',s.sourceCounts.PRIMARY===13&&s.sourceCounts.SECONDARY===6,s.sourceCounts);
  verify('observed cadence peak stays within the configured native pool',peak<=24,{peak,allocated:s.engine.groups.projectiles.total,configuredMax:a.projectiles.maxSize});
  start();a.growth=new RunGrowth(battle.snapshot().progression!.runId,()=>.99);a.growth.collect(8);step();g.scene.processQueue();verify('movement upgrade is a genuine offered choice',choose('L1_MOVE'),battle.snapshot().progression!.offer);
  a.keys.D.isDown=true;step(20);s=battle.snapshot();verify('170 base plus one movement pick actually moves at 187u/s',Math.abs(s.moveSpeed-187)<1e-8&&Math.abs(s.engine.velocity.x-187)<1e-8,{speed:s.moveSpeed,velocity:s.engine.velocity});
  a.keys.D.isDown=false;step();verify('movement release stops even after speed growth',battle.snapshot().engine.velocity.x===0,battle.snapshot().engine.velocity);
  {
  // A legal seven-pick combination. Disable only hit resolution so every
  // native shot retains its full Clock lifetime; no projectile or timer mocks.
  start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:1,L1_HEART:0,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1};verify('seven-pick stress setup applies actual second rate pick',choose('L1_RATE'),a.growth.snapshot().ranks);
  position(a.cat,360,300);const stressTarget=a.placeSliceEnemy('E01',360,530);stressTarget.setData('hp',100000);const resolve=a.resolveProjectile;a.resolveProjectile=()=>{};a.spawns.take=()=>null;
  let stressPeak=0,lastShots=0,lastReloads=0,remaining=0,expectedSecondary=0;
  try{for(let i=0;i<1800;i++){position(stressTarget,360,530);step();const state=battle.snapshot();stressPeak=Math.max(stressPeak,state.projectiles);
   if(state.shots>lastShots){if(state.reloadCompletions>lastReloads){remaining=3;lastReloads=state.reloadCompletions;}
    if(remaining){expectedSecondary+=3;remaining--;}else if(state.shots===1)expectedSecondary++;
    if(state.ammo===0)expectedSecondary+=2;lastShots=state.shots;
    verify('stress root '+state.shots+' emits every real primary and secondary without pool loss',state.sourceCounts.PRIMARY===state.shots*3&&state.sourceCounts.SECONDARY===expectedSecondary,{counts:state.sourceCounts,expectedSecondary,active:state.projectiles});
   }
  }}finally{a.resolveProjectile=resolve;}
  s=battle.snapshot();verify('native seven-pick no-collision full-lifetime occupancy keeps24 bound in reused32-slot Group',stressPeak<=24&&s.engine.groups.projectiles.total<=32&&s.reloadCompletions>=5,{stressPeak,allocated:s.engine.groups.projectiles.total,reloads:s.reloadCompletions});
  }
  {
  // A legal seven-pick combination. Disable only hit resolution so every
  // native shot retains its full Clock lifetime; no projectile or timer mocks.
  start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:2,L1_HEART:0,L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_ECHO:1,L1_EVO_CADENCE:1};verify('seven-pick stress setup applies actual third rate pick',choose('L1_RATE'),a.growth.snapshot().ranks);
  position(a.cat,360,300);const stressTarget=a.placeSliceEnemy('E01',360,530);stressTarget.setData('hp',100000);const resolve=a.resolveProjectile;a.resolveProjectile=()=>{};a.spawns.take=()=>null;
  let stressPeak=0,lastShots=0,lastReloads=0,remaining=0,expectedSecondary=0;
  try{for(let i=0;i<1800;i++){position(stressTarget,360,530);step();const state=battle.snapshot();stressPeak=Math.max(stressPeak,state.projectiles);
   if(state.shots>lastShots){if(state.reloadCompletions>lastReloads){remaining=3;lastReloads=state.reloadCompletions;}
    if(remaining){expectedSecondary+=3;remaining--;}else if(state.shots===1)expectedSecondary++;
    if(state.ammo===0)expectedSecondary+=2;lastShots=state.shots;
    verify('stress root '+state.shots+' emits every real primary and secondary without pool loss',state.sourceCounts.PRIMARY===state.shots*3&&state.sourceCounts.SECONDARY===expectedSecondary,{counts:state.sourceCounts,expectedSecondary,active:state.projectiles});
   }
  }}finally{a.resolveProjectile=resolve;}
  s=battle.snapshot();verify('native maximum-bound seven-pick no-collision full-lifetime occupancy keeps24 bound in reused32-slot Group',stressPeak<=24&&s.engine.groups.projectiles.total<=32&&s.reloadCompletions>=2,{stressPeak,allocated:s.engine.groups.projectiles.total,reloads:s.reloadCompletions});
  }
  start();const nodes=a.children.length;for(let i=0;i<20;i++)start();s=battle.snapshot();verify('twenty restarts clear all route and burst state without growing children',s.bursts.tailBursts===0&&s.bursts.openingBursts===0&&s.progression!.routes.every(r=>!r.coreOwned)&&a.children.length===nodes,{bursts:s.bursts,nodes:a.children.length});
  return {status:'PASS',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runBellModifierChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  const Hits=require('../../src/battle-hits.cjs');
  const configure=(ranks:Record<string,number>)=>{
   start();a.growth.collect(8);step();g.scene.processQueue();
   // Isolated rule fixture: configure already-owned cards, then apply through
   // the real upgrade transaction. Candidate legality has independent Node tests.
   a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};verify('fixture applies owned ranks through actual confirmation',choose('L1_RATE'),ranks);
  };
  const enemy=(x:number,y:number,hp=100)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);return e;};
  const shot=(id:number,source='PRIMARY',pierce=0,damage=12,life=1.2)=>{a.projectile({x:440,y:720},0,'bell',source,id,damage,pierce,620,life);a.physics.world.step(0);return a.projectiles.getChildren().filter((p:any)=>p.active&&p.getData('volleyId')===id).slice(-1)[0];};
  configure({L1_SPLIT:1,L1_SHOCK_BELL:1});
  const direct=enemy(450,720),ring=[0,1,2,3,4,5,6].map(i=>enemy(450+(i<6?20:30),720));
  const first=shot(1000),shared=shot(1000);a.hit(first,direct,'overlap');
  verify('first PRIMARY hit creates one shock, excludes direct target, nearest stable six only',first!==shared&&direct.getData('hp')===88&&ring.every((e:any,i:number)=>Math.abs(e.getData('hp')-(i<6?95.8:100))<1e-8)&&battle.snapshot().bellModifiers.shocks===1,ring.map((e:any)=>e.getData('hp')));
  a.hit(shared,direct,'overlap');verify('same root sibling cannot create a second shock after first shot recycle',battle.snapshot().bellModifiers.shocks===1,battle.snapshot().bellModifiers);
  const sec=shot(1001,'SECONDARY');a.hit(sec,direct,'overlap');verify('SECONDARY hit never creates shock or ricochet',battle.snapshot().bellModifiers.shocks===1&&!sec.active,battle.snapshot().bellModifiers);
  configure({L1_PIERCE:1,L1_SHOCK_BELL:1});
  const crate=a.place(a.objects,430,720/1440,'object');crate.setData('hp',100);const primary=enemy(450,720),other=enemy(470,720);
  const attenuated=shot(1002,'PRIMARY',1);a.hit(attenuated,crate,'overlap');a.hit(attenuated,primary,'overlap');
  verify('shock uses actual attenuated first enemy hit after crate and survives shot recycling',Math.abs(other.getData('hp')-(100-12*.7*.35))<1e-8&&battle.snapshot().bellModifiers.shocks===1,other.getData('hp'));
  configure({L1_PIERCE:1});const frozenVictim=enemy(450,720),frozenNeighbor=enemy(470,720),oldShot=shot(1100);
  a.growth.ranks.L1_SHOCK_BELL=1;a.growth.ranks.L1_RICOCHET=1;a.hit(oldShot,frozenVictim,'overlap');
  verify('selecting modifiers cannot retroactively change an in-flight primary',!oldShot.active&&frozenNeighbor.getData('hp')===100&&battle.snapshot().bellModifiers.shocks===0&&battle.snapshot().bellModifiers.bounces===0,battle.snapshot().bellModifiers);
  configure({L1_SPLIT:1,L1_SHOCK_BELL:1});const killedDirect=enemy(450,720,1),killedArea=enemy(470,720,1),lethal=shot(1101);
  for(const fx of a.feedback.effects.getChildren())fx.setActive(true);for(const text of a.feedback.numbers.getChildren())text.setActive(true).setData('player',true);
  a.hit(lethal,killedDirect,'overlap');a.hit(lethal,killedDirect,'overlap');
  verify('shock damage and single death XP remain real when cosmetic pools are occupied',!killedDirect.active&&!killedArea.active&&battle.snapshot().kills===2&&battle.snapshot().pickups!.droppedXP===4&&battle.snapshot().bellModifiers.shocks===1,{kills:battle.snapshot().kills,pickups:battle.snapshot().pickups,bell:battle.snapshot().bellModifiers});
  configure({L1_PIERCE:1,L1_RICOCHET:1});
  const p1=enemy(450,720),p2=enemy(470,720),turn=enemy(440,770);turn.setVelocity(40,0);
  const bounce=shot(1003,'PRIMARY',1),pid=bounce.getData('projectileId'),timer=bounce.getData('lifeTimer'),hitIds=bounce.getData('hitIds');
  a.hit(bounce,p1,'overlap');verify('piercing before exhaustion does not turn',!bounce.getData('ricocheted')&&bounce.body.velocity.x===620,bounce.body.velocity.x);
  a.hit(bounce,p2,'overlap');
  verify('terminal pierce turns same Sprite and id with same life timer and hit ledger',bounce.active&&bounce.getData('ricocheted')&&bounce.getData('projectileId')===pid&&bounce.getData('lifeTimer')===timer&&bounce.getData('hitIds')===hitIds&&bounce.getData('extraPierce')===1&&bounce.body.velocity.y>0,{id:pid,damage:bounce.getData('ricochetDamage'),velocity:{x:bounce.body.velocity.x,y:bounce.body.velocity.y}});
  verify('turn rebases native previous path without teleporting projectile',bounce.body.prev.equals(bounce.body.position),{prev:{...bounce.body.prev},position:{...bounce.body.position}});
  for(let i=0;i<15&&bounce.active;i++){a.physics.world.update(now,1000/60);a.resolveProjectile(bounce,Hits.targetMotionPadding(a.physics));a.physics.world.postUpdate();now+=1000/60;}
  verify('following native frames hit moving target once at post-pierce damage times .6 then terminate',Math.abs(turn.getData('hp')-(100-12*.7*.6))<1e-8&&!bounce.active&&hitIds.size===3,turn.getData('hp'));
  configure({L1_PIERCE:1,L1_RICOCHET:1});
  const stop=enemy(450,720),next=enemy(500,720),oldPath=enemy(550,720);const bent=shot(1004,'PRIMARY',0);
  position(bent,700,720);bent.body.prev.set(430,720); // A long actual-Body candidate path.
  a.resolveProjectile(bent,0);
  verify('turn immediately abandons precomputed old straight-path candidates',stop.getData('hp')===88&&next.getData('hp')===100&&oldPath.getData('hp')===100&&bent.active&&bent.body.center.x<450,{hp:[stop,next,oldPath].map(e=>e.getData('hp')),bounces:battle.snapshot().bellModifiers.bounces});
  configure({L1_PIERCE:1,L1_RICOCHET:1});const lonely=enemy(450,720),noTarget=shot(1005);a.hit(noTarget,lonely,'overlap');verify('no unhit target ends projectile and removes volley identity',!noTarget.active&&battle.snapshot().bellModifiers.activeVolleys===0,battle.snapshot().bellModifiers);
  configure({L1_PIERCE:1,L1_RICOCHET:1});const lifeA=enemy(450,720),lifeB=enemy(440,820),short=shot(1006,'PRIMARY',0,12,.05),lifeTimer=short.getData('lifeTimer');a.hit(short,lifeA,'overlap');step(5);
  verify('bounce retains short remaining native lifetime instead of renewing it',!short.active&&short.getData('lifeTimer')===null&&lifeB.getData('hp')===100,{active:short.active,life:lifeTimer.delay});
  configure({L1_ECHO:1,L1_LIGHT_MAG:1,L1_EVO_CADENCE:1,L1_RELOAD:2});
  const target=enemy(590,720,100000);const tick=()=>{position(target,590,720);step();};let peak=0;
  while(battle.snapshot().shots<6&&battle.snapshot().elapsed<8){tick();peak=Math.max(peak,battle.snapshot().projectiles);}
  let state=battle.snapshot();verify('light magazine clamps current ammo, then six actual roots initiate derived reload',state.ammo===0&&state.reloadCompletions===0&&Math.abs(state.reloadSeconds-2.4/1.4*.8)<1e-8,state);
  verify('native overhead bar is thin, world-positioned and bound to actual reload fraction',state.reloadIndicator.visible&&state.reloadIndicator.width===24&&state.reloadIndicator.height===2&&Math.abs(state.reloadIndicator.progress-(1-state.reloadLeft/state.reloadSeconds))<1e-8,state.reloadIndicator);
  battle.pause('background');g.scene.processQueue();const frozen=JSON.stringify({bar:state.reloadIndicator,left:state.reloadLeft});step(60);state=battle.snapshot();verify('pause freezes actual reload and overhead bar',JSON.stringify({bar:state.reloadIndicator,left:state.reloadLeft})===frozen,state.reloadIndicator);battle.resume();g.scene.processQueue();g.loop.sleep();
  while(battle.snapshot().shots<9&&battle.snapshot().elapsed<12){tick();peak=Math.max(peak,battle.snapshot().projectiles);}
  state=battle.snapshot();verify('real reload grants exactly three successive actual cadence bursts',state.reloadCompletions===1&&state.shots===9&&state.bursts.openingBursts===3&&state.bursts.cadenceRemaining===0&&state.sourceCounts.SECONDARY===12&&!state.reloadIndicator.visible,{bursts:state.bursts,counts:state.sourceCounts,peak});
  for(const quality of ['low','standard']){battle.setPresentation({quality:quality as any});verify('quality retains protected cat 30u and independent 12u body',battle.snapshot().presentation?.bodyDisplay.width===30&&battle.snapshot().engine.bodies.cat.radius===12,quality);}
  start();const originalTry=a.trySpecialSpawn;a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};// Controlled encounter timing only.
  // markSpawned must be the real arrival path, never warning retries.
  now+=150000;g.scene.update(now,150000);const elite=a.enterSpecial('EL01',{x:650,y:720});verify('actual EL01 spawn opens exactly one six-enemy arrival quota',!!elite&&battle.snapshot().reinforcements.remaining===6,battle.snapshot().reinforcements);
  const initialEnemyCount=a.enemies.countActive(true);step(70);verify('reinforcement does not precede the full 1.2s arrival',a.enemies.countActive(true)===initialEnemyCount,battle.snapshot().reinforcements);step(190);state=battle.snapshot();
  verify('arrival reinforcement uses safe native group births and finite six quota',state.reinforcements.spawned===6&&state.reinforcements.remaining===0&&state.engine.groups.enemies.total<=32,state.reinforcements);
  delete a.level.pending;a.trySpecialSpawn=originalTry;
  start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};now+=450000;g.scene.update(now,450000);for(let i=0;i<2;i++){const prior=a.enterSpecial('EL01',{x:650,y:720});a.recycle(prior,a.enemies);}a.reinforcements.clear();
  const births:any[]=[];const spawn=a.spawnCourtyardEnemy;a.spawnCourtyardEnemy=function(id:string,reinforcement:boolean){const previous=this.nextMob,view={...this.cameras.main.worldView},player={...this.cat.body.center};const ok=spawn.call(this,id,reinforcement);if(ok&&reinforcement){const e=this.enemies.getChildren().find((e:any)=>e.active&&e.getData('id')===previous);births.push({x:e.body.center.x,y:e.body.center.y,view,player});}return ok;};
  const boss=a.enterSpecial('B01',{x:650,y:720});step(80);Object.assign(boss.getData('behavior'),{phase:'recover',until:1000});
  battle.pause('background');g.scene.processQueue();const quotaFrozen=JSON.stringify(battle.snapshot().reinforcements);step(180);verify('pause freezes actual arrival quota and does not accumulate births',JSON.stringify(battle.snapshot().reinforcements)===quotaFrozen,battle.snapshot().reinforcements);battle.resume();g.scene.processQueue();g.loop.sleep();step(230);state=battle.snapshot();
  verify('B01 actual arrival births exactly eight E01 through the shared thirty-two-slot group',state.reinforcements.spawned===8&&state.reinforcements.remaining===0&&boss.active&&state.enemies<=9&&state.engine.groups.enemies.total<=32,state.reinforcements);
  verify('all arrival births obey the existing safe camera edge and 180u minimum distance',births.length===8&&births.every(p=>Math.hypot(p.x-p.player.x,p.y-p.player.y)>=180&&p.x>=24&&p.x<=696&&p.y>=24&&p.y<=1416&&(p.x<=p.view.x-48||p.x>=p.view.x+p.view.width+48||p.y<=p.view.y-48||p.y>=p.view.y+p.view.height+48)),births);
  a.spawnCourtyardEnemy=spawn;delete a.level.pending;a.trySpecialSpawn=originalTry;
  start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};now+=450000;g.scene.update(now,450000);for(let i=0;i<2;i++){const prior=a.enterSpecial('EL01',{x:650,y:720});a.recycle(prior,a.enemies);}a.reinforcements.clear();const filled=Array.from({length:20},(_,i)=>enemy(30+i*12,60,100000));const fullBoss=a.enterSpecial('B01',{x:650,y:720});step(90);Object.assign(fullBoss.getData('behavior'),{phase:'recover',until:1000});state=battle.snapshot();
  verify('current ordinary cap twenty plus one real special skips reinforcement slots without replacement',state.reinforcements.spawned===0&&state.reinforcements.remaining===8&&state.enemies===21,state.reinforcements);
  a.recycle(filled[0],a.enemies);step(35);state=battle.snapshot();verify('one freed ordinary slot admits only one birth without a catch-up burst',state.reinforcements.spawned===1&&state.reinforcements.remaining===7&&state.enemies===21,state.reinforcements);
  for(const e of a.enemies.getChildren())if(e.active)e.setData('hp',100000);
  step(470);state=battle.snapshot();verify('blocked arrival quota expires after its finite eight-second window',state.reinforcements.expired&&state.reinforcements.spawned===1&&state.reinforcements.remaining===7,state.reinforcements);
  delete a.level.pending;a.trySpecialSpawn=originalTry;
  start();const nodeCount=a.children.length;for(let i=0;i<20;i++)start();state=battle.snapshot();verify('twenty restarts clear bar, bell history and reinforcement without growing objects',!state.reloadIndicator.visible&&state.bellModifiers.activeVolleys===0&&state.bellModifiers.shocks===0&&state.reinforcements.remaining===0&&a.children.length===nodeCount,{bell:state.bellModifiers,reinforcements:state.reinforcements,nodes:a.children.length});
  return {status:'PASS',scope:'CONTROLLED_PHASER_SCENE',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runBellAbilityChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const state=()=> (battle.snapshot() as any).bellAbilities;
  const configure=(ranks:Record<string,number>)=>{a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};verify('fixture rank application uses real confirmation',choose('L1_RATE'),ranks);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
  const enemy=(x:number,y:number,hp=100)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',hp);a.physics.world.step(0);return e;};
  const update=()=>{a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,require('../../src/progression').abilityDamage(require('../../src/level-config').courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),a.growth.snapshot().ranks),battle.snapshot().elapsed);};
  start();verify('new Scene exposes empty actual native ability groups and charge',state().trails.length===0&&state().orbits.length===0&&state().charge===0,state());
  a.growth=new RunGrowth(battle.snapshot().progression!.runId,()=>.7);a.growth.collect(8);step();g.scene.processQueue();verify('legitimate first reward can actually select the new trail core',choose('L1_TRAIL_BELL')&&battle.snapshot().progression!.ranks.L1_TRAIL_BELL===1,battle.snapshot().progression);
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};position(a.cat,100,720);a.keys.D.isDown=true;step(64);let st=state();
  verify('native input Body travel leaves first bell exactly at 180u threshold',st.placed===1&&Math.abs(st.trails[0].x-280)<.0001&&st.trails[0].y===720,st);
  step(64);st=state();verify('second threshold has a distinct fixed world point despite camera follow',st.placed===2&&st.trails.some((b:any)=>Math.abs(b.x-280)<.0001)&&st.trails.some((b:any)=>Math.abs(b.x-460)<.0001),st);
  step(64);st=state();verify('third bell stays below six-bell cap without replacement or explosion',st.placed===3&&st.replaced===0&&st.explosions===0&&st.trails.length===3&&st.groups.trails.total<=9&&st.groups.trails.active===3&&st.trails.some((b:any)=>Math.abs(b.x-280)<1e-7),st);
  const distance=st.trailDistance;step(100);a.clearInput();step(3);const wallDistance=state().trailDistance;step(90);verify('pushing native world boundary and standing add no distance',Math.abs(wallDistance-state().trailDistance)<1e-8&&state().placed===3,state());
  position(a.cat,50,500);step();verify('external Body reset does not credit teleport distance',Math.abs(wallDistance-state().trailDistance)<1e-8,state());
  configure({L1_TRAIL_BELL:1,L1_SPLIT:1,L1_DAMAGE:2});a.fireVolley=()=>{};a.abilities.place({x:450,y:700},16.8);const direct=enemy(450,700,1),ring=Array.from({length:7},(_,i)=>enemy(470+(i<6?0:10),700,100));
  for(const fx of a.feedback.effects.getChildren())fx.setActive(true);for(const n of a.feedback.numbers.getChildren())n.setActive(true).setData('player',true);update();verify('unarmed bell does not damage entering enemies',direct.active&&direct.getData('hp')===1&&state().explosions===0,state());
  for(let i=0;i<16;i++){position(direct,450,700);ring.forEach((e:any,j:number)=>position(e,470+(j<6?0:10),700));step();}st=state();verify('armed explosion uses frozen unsplit D, kills once and targets nearest stable six',!direct.active&&battle.snapshot().kills===1&&battle.snapshot().pickups!.droppedXP===2&&ring.every((e:any,i:number)=>Math.abs(e.getData('hp')-(i<5?84.88:100))<1e-7)&&st.explosions===1,ring.map((e:any)=>e.getData('hp')));
  step(1);verify('ground explosion cannot recurse into shock bounce tail or another death',state().explosions===1&&battle.snapshot().bellModifiers.shocks===0&&battle.snapshot().sourceCounts.SECONDARY===0&&battle.snapshot().kills===1,battle.snapshot().bellModifiers);
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};a.abilities.place({x:450,y:700},12);step(10);battle.pause('background');g.scene.processQueue();const paused=JSON.stringify(state());step(90);verify('pause freezes native arm Clock and all actual ability state',JSON.stringify(state())===paused,state());battle.resume();g.scene.processQueue();g.loop.sleep();step(240);verify('ground bell stays armed beyond old four-second lifetime without damage',state().trails.length===1&&state().trails[0].armed&&state().explosions===0,state());
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};position(a.cat,100,720);const from={...a.cat.body.center};a.cat.setVelocity(170,0);a.physics.world.step(2.2);const to={...a.cat.body.center};a.abilities.travel(from,to,true,a.growth.snapshot().ranks,12);st=state();
  verify('one native long-frame segment places multiple unique thresholds via Line.getPoint',st.trails.length===2&&Math.abs(st.trails[0].x-280)<1e-7&&Math.abs(st.trails[1].x-460)<1e-7,st);
  configure({L1_ORBIT_BELL:1,L1_SPLIT:1,L1_DAMAGE:2});a.fireVolley=()=>{};st=state();const first=st.orbits[0];const victim=enemy(first.x,first.y);update();
  verify('orbit actual overlap applies .75 unsplit current D with 16u display and 8u contact',Math.abs(victim.getData('hp')-87.4)<1e-8&&a.abilities.orbits.getFirstAlive().displayWidth===16&&state().orbitHits===1,state());
  const second=state().orbits[1];position(victim,second.x,second.y);update();verify('opposite bells share one enemy birth cooldown',Math.abs(victim.getData('hp')-87.4)<1e-8&&state().orbitHits===1,state());
  for(let i=0;i<48;i++){const p=state().orbits[0];position(victim,p.x,p.y);step();}verify('shared orbit cooldown permits one further real hit after .8 effective seconds',Math.abs(victim.getData('hp')-74.8)<1e-7&&state().orbitHits===2,state());
  const oldId=victim.getData('id');a.recycle(victim,a.enemies);const reused=enemy(second.x,second.y);update();verify('native enemy Sprite reuse starts a new stable birth and clean cooldown',reused===victim&&reused.getData('id')!==oldId&&Math.abs(reused.getData('hp')-87.4)<1e-8,state());
  a.recycle(reused,a.enemies);await new Promise(r=>setTimeout(r,40));step(20);const pre=state();battle.pause('background');g.scene.processQueue();step(80);verify('pause freezes native orbit tween phase and contacts',JSON.stringify(state())===JSON.stringify(pre),state());battle.resume();g.scene.processQueue();g.loop.sleep();
  const angle=state().orbitAngle;for(const quality of ['low','standard']){battle.setPresentation({quality:quality as any});verify('quality and reflection preserve orbit phase, radius and physical player',state().orbitAngle===angle&&state().orbits.every((b:any)=>Math.abs(Math.hypot(b.x-a.cat.body.center.x,b.y-a.cat.body.center.y)-60)<1e-7)&&battle.snapshot().engine.bodies.cat.radius===12,{quality,state:state()});}for(let i=0;i<5&&state().orbitAngle===angle;i++){await new Promise(r=>setTimeout(r,20));step(1);}verify('native tween resumes rotation from preserved phase',state().orbitAngle!==angle,state());
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};a.abilities.place({x:100,y:100},12);step(10);for(let i=0;i<6;i++)a.abilities.place({x:200+i*50,y:100},12);step(7);verify('replacing native pooled trail cancels its old pending arm callback',state().trails.length===6&&state().trails.every((b:any)=>!b.armed),state());
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};a.abilities.place({x:100,y:100},12);step(230);a.abilities.place({x:200,y:100},12);a.abilities.place({x:300,y:100},12);step(20);verify('old four-second point no longer expires earlier deployed trail Sprite',state().trails.length===3&&state().placed===3,state());
  configure({L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1});const reloadTarget=enemy(590,720,100000);while(battle.snapshot().ammo>0&&battle.snapshot().elapsed<15){position(reloadTarget,590,720);step();}
  const duringReload=state().orbits[0],reloadVictim=enemy(duringReload.x,duringReload.y,100);update();verify('native orbit keeps dealing damage during actual automatic reload',battle.snapshot().reloadLeft>0&&Math.abs(reloadVictim.getData('hp')-91)<1e-8,{reload:battle.snapshot().reloadLeft,hp:reloadVictim.getData('hp')});a.recycle(reloadVictim,a.enemies);
  a.pickups.drop(7999,'E01',{x:360,y:720});a.pickups.group.getFirstAlive().setData('xp',8);step();verify('actual pickup during reload charges without consuming a chime',battle.snapshot().reloadLeft>0&&state().charge===8&&state().chimes===0,{state:state(),reload:battle.snapshot().reloadLeft});
  configure({L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,L1_SPLIT:1,L1_ECHO:1,L1_SHOCK_BELL:1,L1_RICOCHET:1,L1_DAMAGE:2});a.fireVolley=()=>{};
  a.pickups.drop(8000,'E01',{x:360,y:720});a.pickups.group.getFirstAlive().setData('xp',14);step();verify('actual merged pickup amount credits all XP and caps charge at eight',battle.snapshot().progression!.totalXP===22&&state().charge===8,{growth:battle.snapshot().progression,state:state()});
  // Dismiss any genuine XP-opened menu through its actual choice.
  while(battle.snapshot().progression!.offer){const o=battle.snapshot().progression!.offer!;choose(o.choices[0]);}
  const beforeCharge=state().charge;step(80);verify('no target and no actual volley do not consume charge',state().charge===beforeCharge,state());
  const root=800;a.fireVolley=fire;a.fireVolley({x:0,y:-1,id:root});const shots=a.projectiles.getChildren().filter((p:any)=>p.active&&p.getData('effect')==='PICKUP_CHIME');
  verify('one actual root gets one independent secondary despite split, correct D and no inheritance',shots.length===1&&Math.abs(shots[0].getData('damage')-require('../../src/progression').abilityDamage(require('../../src/level-config').courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),a.growth.snapshot().ranks)*.75)<1e-8&&shots[0].getData('extraPierce')===0&&!shots[0].getData('shockEnabled')&&!shots[0].getData('ricochetEnabled')&&state().charge===0&&state().chimes===1,shots.map((p:any)=>p.data.values));
  a.abilities.state.collect(8,true);a.fireVolley({x:0,y:-1,id:root});verify('same root invocation cannot consume another charge or duplicate the chime',state().charge===8&&state().chimes===1,state());
  configure({L1_TRAIL_BELL:1});a.fireVolley=()=>{};a.pickups.drop(9000,'E01',{x:360,y:720});step();verify('XP before chime selection does not charge it',state().charge===0,state());a.growth.ranks.L1_PICKUP_CHIME=1;step();verify('newly selected chime never backcredits previous total XP',state().charge===0,state());
  configure({L1_ORBIT_BELL:1,L1_TRAIL_BELL:1,L1_PICKUP_CHIME:1});a.fireVolley=()=>{};a.abilities.place({x:600,y:700},12);a.abilities.state.collect(8,true);const nodes=a.children.length;for(let i=0;i<20;i++){configure({L1_ORBIT_BELL:1,L1_TRAIL_BELL:1,L1_PICKUP_CHIME:1});a.fireVolley=()=>{};a.abilities.place({x:600,y:700},12);a.abilities.state.collect(8,true);const tween=a.abilities.orbitTween;start();if(a.tweens.getTweens().includes(tween))throw Error('orphan native orbit tween on restart '+i);}st=state();verify('twenty restarts clear ability state, cooldowns and timers with bounded native objects',st.trails.length===0&&st.orbits.length===0&&st.charge===0&&st.placed===0&&st.orbitHits===0&&a.children.length===nodes,{state:st,nodes:a.children.length});
  configure({L1_ORBIT_BELL:1,L1_TRAIL_BELL:1});a.fireVolley=()=>{};a.abilities.place({x:600,y:700},12);now+=600000;g.scene.update(now,600000);st=state();verify('real timeout clears trails, orbit entities and native repeating tween',battle.snapshot().result==='timeout'&&st.trails.length===0&&st.orbits.length===0&&st.orbitAngle===0,st);
  a.fireVolley=fire;return {status:'PASS',scope:'CONTROLLED_PHASER_SCENE',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runBellTweenResumeChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));const native=require('../../src/phaser-entry.cjs');
  const state=()=>battle.snapshot().bellAbilities!;
  for(const [reason,ms] of [['menu',300],['menu-subpage',650],['background',300],['inputLost',650],['upgrade',300],['upgrade',650]] as const){
   start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:1};verify(reason+' '+ms+'ms acquires native orbit through actual confirmation',choose('L1_RATE'),state());a.fireVolley=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   await wait(35);step();await wait(35);step();
   if(reason==='upgrade'){a.growth.collect(experienceNeeded(a.growth.snapshot().level));step();g.scene.processQueue();}
   else {battle.pause(reason==='menu-subpage'?'menu':reason);g.scene.processQueue();}
   const before={angle:state().orbitAngle,time:battle.snapshot().elapsed,hits:state().orbitHits};
   const target={x:a.cat.body.center.x+60,y:a.cat.body.center.y};native.Math.RotateAroundDistance(target,a.cat.body.center.x,a.cat.body.center.y,before.angle+(ms===300?Math.PI/4:.42),60);
   const enemy=a.placeSliceEnemy('E01',target.x,target.y);enemy.setData('hp',100);a.physics.world.step(0);
   await wait(ms);step();verify(reason+' '+ms+'ms true wall-clock pause preserves angle, effective time and contacts',state().orbitAngle===before.angle&&battle.snapshot().elapsed===before.time&&state().orbitHits===before.hits,{before,after:state()});
   if(reason==='upgrade')verify(reason+' '+ms+'ms real upgrade confirmation resumes',choose('L1_DAMAGE'),battle.snapshot().reasons);
   else {g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();}
   verify(reason+' '+ms+'ms continue consumes elapsed wall time without changing orbit phase',state().orbitAngle===before.angle&&!battle.snapshot().engine.paused,{before:before.angle,after:state().orbitAngle});
   step();let angleDelta=state().orbitAngle-before.angle;if(angleDelta<0)angleDelta+=Math.PI*2;
   verify(reason+' '+ms+'ms first resumed frame has no pause-time catch-up rotation',angleDelta<=.06&&Math.abs(battle.snapshot().elapsed-before.time-1/60)<1e-7,{angleDelta,effectiveDelta:battle.snapshot().elapsed-before.time,before:before.angle,after:state().orbitAngle});
   verify(reason+' '+ms+'ms first native overlap does not deal skipped-arc catch-up damage',enemy.getData('hp')===100&&state().orbitHits===before.hits,{hp:enemy.getData('hp'),hits:state().orbitHits,beforeHits:before.hits});
   g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();const again=state().orbitAngle;step();let repeatDelta=state().orbitAngle-again;if(repeatDelta<0)repeatDelta+=Math.PI*2;
   verify(reason+' '+ms+'ms repeated explicit continue cannot replay the paused interval',repeatDelta<=.06,{repeatDelta});
  }
  start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ORBIT_BELL:1};verify('restart creates a fresh phase-zero native orbit without old pause debt',choose('L1_RATE')&&state().orbitAngle===0&&state().orbitHits===0,state());
  a.fireVolley=fire;return {status:'PASS',scope:'ACTUAL_WALL_CLOCK_PAUSE_WITH_NATIVE_TWEEN_AND_OVERLAP',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runBellBoundaryChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
  for(const quality of ['standard','low']){
   battle.setPresentation({quality:quality as any});
   for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
    const ends:number[][]=[];
    for(const display of [36,30]){
     a.cat.setDisplaySize(display,display);const body=a.cat.body;body.updateFromGameObject();body.setCircle(12*(1+Number.EPSILON)/Math.abs(a.cat.scaleX));body.setOffset(a.cat.width/2-body.halfWidth/Math.abs(a.cat.scaleX),a.cat.height/2-body.halfHeight/Math.abs(a.cat.scaleY));a.catBounds();position(a.cat,360,720);a.cat.setVelocity(dx*170,dy*170);a.physics.world.step(10);a.physics.world.postUpdate();a.cat.setVelocity(0,0);ends.push([body.center.x,body.center.y]);
    }
    const expected=[dx<0?18:dx>0?702:360,dy<0?18:dy>0?1422:720];verify(quality+' direction '+dx+','+dy+' native old36/new30 have identical original center bounds',ends.every(p=>p.every((n,i)=>Math.abs(n-expected[i])<1e-7))&&Math.abs(a.cat.body.halfWidth-12)<1e-8,{old36:ends[0],new30:ends[1],expected});
   }
  }
  start();return {status:'PASS',scope:'NATIVE_SETBOUNDSRECTANGLE_OLD36_NEW30_FOUR_SIDES_AND_CORNERS',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runBellDisplaySizeChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  start();const s=battle.snapshot();verify('local30u cat keeps12u physical world circle and unchanged spawn/weapon',s.presentation!.bodyDisplay.width===30&&Math.abs(a.cat.body.halfWidth-12)<1e-8&&s.player.x===360&&s.player.y===720&&s.weaponInterval===.8&&s.reloadSeconds===2.4,{presentation:s.presentation,body:s.engine.bodies.cat,player:s.player});
  const e=a.placeSliceEnemy('E01',384,720);a.physics.world.step(0);verify('local26u E01 keeps independent12u world circle at tangent24u',e.displayWidth===26&&Math.abs(e.body.halfWidth-12)<1e-8&&a.physics.overlapCirc(360,720,12,true,false).includes(e.body),{display:e.displayWidth,radius:e.body.halfWidth,center:{...e.body.center}});
  position(e,384.1,720);a.physics.world.step(0);verify('26u displayed enemy has no collision beyond independent12+12u radius',!a.physics.overlapCirc(360,720,12,true,false).includes(e.body),{distance:e.body.center.x-a.cat.body.center.x});
  position(e,500,720);a.fireVolley({x:1,y:0,id:7800});const shot=a.projectiles.getChildren().find((p:any)=>p.active&&p.getData('source')==='PRIMARY');verify('smaller cat retains center-origin shot and620u/s projectile',shot.body.center.x===360&&shot.body.center.y===720&&Math.abs(shot.body.velocity.length()-620)<1e-8,{origin:{...shot.body.center},velocity:{...shot.body.velocity}});
  for(const quality of ['low','standard']){battle.setPresentation({quality:quality as any});a.syncCatArt();verify(quality+' preserves30/26 display and12u physical centers',battle.snapshot().presentation!.bodyDisplay.width===30&&e.displayWidth===26&&Math.abs(e.body.halfWidth-12)<1e-8&&Math.abs(a.cat.body.halfWidth-12)<1e-8&&a.cat.body.center.x===360&&a.cat.body.center.y===720,battle.snapshot().engine.bodies);}
  for(const id of ['E02','E03','E04','EL01','B01']){const spec=require('../../src/level-config').ENEMIES[id],enemy=a.placeSliceEnemy(id,600,1100);verify(id+' keeps its existing display and circle',enemy.displayWidth===spec.size&&Math.abs(enemy.body.halfWidth-spec.radius)<1e-8,{width:enemy.displayWidth,radius:enemy.body.halfWidth});a.recycle(enemy,a.enemies);}
  start('CAT02');verify('other-cat P2 keeps58u and original198/180 family configuration',battle.snapshot().presentation!.bodyDisplay.width===58&&battle.snapshot().progression===null,battle.snapshot().presentation);
  start();return {status:'PASS',scope:'ACTUAL_NATIVE_DISPLAY_CIRCLE_ORIGIN_NOT_CALIBRATION_APPROVAL',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runBellCombinationChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  const native=require('../../src/phaser-entry.cjs'),N=require('../../src/progression').GROWTH_NUMBERS;
  const state=()=>battle.snapshot().bellAbilities!,wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const configure=(ranks:Record<string,number>)=>{a.fireVolley=fire;start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};verify('controlled actual upgrade applies '+Object.keys(ranks).join(','),choose('L1_RATE'),a.growth.snapshot().ranks);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};};
  const dismiss=()=>{while(a.growth.snapshot().offer)choose(a.growth.snapshot().offer.choices[0]);};
  const pickup=(xp:number)=>{a.pickups.drop(99000+state().chimes+state().placed+Math.floor(now),'E01',{...a.cat.body.center});a.pickups.group.getFirstAlive().setData('xp',xp);step();dismiss();};
  const advance=async(ms:number)=>{for(let t=0;t<ms;t+=20){await wait(20);now+=20;g.scene.update(now,20);}};
  const update=()=>{a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,12,battle.snapshot().elapsed);};
  const touch=(bellIndex=0,hp=100)=>{const p=state().orbits[bellIndex],e=a.placeSliceEnemy('E01',p.x,p.y);e.setData('hp',hp);a.physics.world.step(0);return e;};
  let comboRoot=900;const consumeRoot=()=>{const before=state();a.fireVolley=fire;a.fireVolley({x:0,y:-1,id:++comboRoot});a.fireVolley=()=>{};verify('actual increasing root '+comboRoot+' consumes full chime once before next refill',before.charge===8&&state().charge===0&&state().chimes===before.chimes+1,state());};
  const refreshed=(previous:any)=>verify('real refill replaces previous native3s expiry with a fresh full window',previous!==a.abilities.starEnd&&previous.callback===undefined&&a.abilities.starEnd.getRemaining()===3000&&state().charge===8,{oldRemaining:previous.getRemaining(),newRemaining:a.abilities.starEnd.getRemaining(),state:state()});
  // Follow real legal offers from a seeded run to each prerequisite and then
  // the combination; no direct rank injection in these acquisition checks.
  for(const [combo,requirements] of [['L1_DUO_TRAIL_CADENCE',['L1_TRAIL_BELL','L1_ECHO']],['L1_DUO_STAR_RING',['L1_ORBIT_BELL','L1_PICKUP_CHIME']]] as const){
   start();let seed=13;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};a.growth=new RunGrowth(battle.snapshot().progression!.runId,rng);a.growth.collect(100000);step();g.scene.processQueue();let acquired=false;
   for(let i=0;i<50;i++){
    const s=a.growth.snapshot(),o=s.offer;const id=o.choices.includes(combo)?combo:requirements.find(id=>!s.ranks[id]&&o.choices.includes(id))||o.choices.find((id:string)=>id==='L1_DAMAGE')||o.choices[0];
    if(id===combo)verify(combo+' appears only after both selected prerequisites and is not granted free',requirements.every(id=>s.ranks[id]===1)&&!s.ranks[combo],s);
    verify(combo+' legal actual confirmation '+id,choose(id),o);if(id===combo){acquired=true;break;}
   }
   verify(combo+' is acquired exactly once by a real legal candidate transaction',acquired&&a.growth.snapshot().ranks[combo]===1&&!a.growth.snapshot().offer.choices.includes(combo),a.growth.snapshot());
  }
  configure({L1_TRAIL_BELL:1,L1_ECHO:1,L1_DUO_TRAIL_CADENCE:1});position(a.cat,100,720);
  const travel=(distance:number,reload:boolean)=>{const from={...a.cat.body.center};a.cat.setVelocity(170,0);a.physics.world.step(distance/170);a.abilities.travel(from,{...a.cat.body.center},true,a.growth.snapshot().ranks,12,reload);a.cat.setVelocity(0,0);};
  travel(90,false);a.abilities.travel(a.cat.body.center,a.cat.body.center,false,a.growth.snapshot().ranks,12,true);verify('threshold-only reload transition preserves half-completion without placing',state().trailThreshold===60&&Math.abs(state().trailDistance-30)<1e-7&&state().placed===0,state());
  travel(30,true);travel(120,true);verify('native Body/Line thresholds create three separate reload bells at 60u cadence',state().placed===3&&state().trails.length===3&&state().groups.trails.total<=9&&state().groups.trails.active===3&&state().trails.map(b=>Math.round(b.x)).join(',')==='220,280,340',state());
  a.abilities.travel(a.cat.body.center,a.cat.body.center,false,a.growth.snapshot().ranks,12,false);verify('reload completion keeps the existing third bell and restores 180u without a free bell',state().trails.length===3&&state().placed===3&&state().trailThreshold===180,state());
  travel(180,false);verify('fourth native bell remains below nine-bell cap without explosion or replacement',state().trails.length===4&&state().replaced===0&&state().explosions===0&&state().trails.some(b=>b.x===220),state());
  const amount=state().trailDistance;position(a.cat,600,600);step();battle.pause('menu');g.scene.processQueue();await wait(300);step();verify('stop teleport and true pause do not backcredit or place trail',state().placed===4&&state().trailDistance===amount,state());g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
  configure({L1_TRAIL_BELL:1,L1_ECHO:1,L1_DUO_TRAIL_CADENCE:1});a.fireVolley=fire;position(a.cat,100,720);const reloadTarget=a.placeSliceEnemy('E01',330,720);reloadTarget.setData('hp',100000);while(battle.snapshot().ammo>0&&battle.snapshot().elapsed<14){position(reloadTarget,a.cat.body.center.x+230,720);step();}a.fireVolley=()=>{};a.keys.D.isDown=true;
  for(let i=0;i<64;i++){position(reloadTarget,a.cat.body.center.x+230,720);step();}a.clearInput();verify('actual Session automatic reload drives60u Body cadence below cap9',battle.snapshot().reloadLeft>0&&state().trailThreshold===60&&state().trails.length===3,{reload:battle.snapshot().reloadLeft,state:state()});
  while(battle.snapshot().reloadLeft>0)step();step();verify('actual reload completion restores180u while preserving third existing bell',state().trailThreshold===180&&state().trails.length===3,state());
  configure({L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1});pickup(8);a.growth.ranks.L1_DUO_STAR_RING=1;a.abilities.ensure(a.growth.snapshot().ranks,battle.snapshot().elapsed);verify('acquiring combination with existing full charge never backtriggers',state().charge===8&&!state().starActive&&state().orbitRadius===60,state());
  consumeRoot();pickup(7);verify('seven actual XP does not start star',state().charge===7&&!state().starActive,state());pickup(1);verify('actual below-eight to full pickup starts three-second star without changing phase',state().starActive&&state().charge===8&&state().orbits.length===2&&state().orbitRadius===60,state());
  const baseTween=a.abilities.orbitTween;await advance(100);let st=state();verify('native expansion uses intermediate radius matching actual displayed orbit',st.orbitRadius>60&&st.orbitRadius<80&&st.orbits.every(b=>Math.abs(Math.hypot(b.x-a.cat.body.center.x,b.y-a.cat.body.center.y)-st.orbitRadius)<1e-7),st);
  let victim=touch();update();verify('intermediate-radius actual overlap already deals 1.125D',victim.getData('hp')===86.5&&state().orbitHits===1,state());position(victim,state().orbits[1].x,state().orbits[1].y);update();verify('two star bells retain shared birth cooldown while expanding',victim.getData('hp')===86.5&&state().orbitHits===1,state());a.recycle(victim,a.enemies);
  const collect=a.abilities.collect;let radiusBeforeFill=0,radiusAfterFill=0;a.abilities.collect=function(...args:any[]){radiusBeforeFill=a.cat.getData('orbitRadius');collect.apply(this,args);radiusAfterFill=a.cat.getData('orbitRadius');};consumeRoot();const expansionExpiry=a.abilities.starEnd;pickup(8);a.abilities.collect=collect;refreshed(expansionExpiry);verify('real refill during expansion preserves exact current radius and rotation tween',radiusBeforeFill===radiusAfterFill&&radiusBeforeFill>60&&radiusBeforeFill<80&&a.abilities.orbitTween===baseTween,{radiusBeforeFill,radiusAfterFill,state:state()});
  await advance(220);verify('native expansion reaches 80u with original continuous rotation tween and only two bells',Math.abs(state().orbitRadius-80)<1e-7&&a.abilities.orbitTween===baseTween&&state().orbits.length===2,state());
  const noBack=state().orbitRadius;pickup(8);verify('XP arriving while already saturated cannot refresh star',state().charge===8&&state().orbitRadius===noBack,state());
  // A second real fill refreshes the native window, preserving an existing
  // enemy's shared cooldown and phase; no recreated rotation tween.
  victim=touch();update();const hits=state().orbitHits,hp=victim.getData('hp'),hitAt=victim.getData('orbitHitAt'),phase=state().orbitAngle;
  consumeRoot();const fullExpiry=a.abilities.starEnd;pickup(8);refreshed(fullExpiry);position(victim,state().orbits[1].x,state().orbits[1].y);update();verify('real refill refresh preserves two bells rotation phase and shared enemy cooldown',state().starActive&&state().orbits.length===2&&a.abilities.orbitTween===baseTween&&victim.getData('hp')===hp&&victim.getData('orbitHitAt')===hitAt&&state().orbitHits===hits,{phase,after:state(),hp});a.recycle(victim,a.enemies);
  await advance(2820);st=state();verify('final .2s returns through an intermediate native radius while damage stays enhanced',st.starActive&&st.orbitRadius>60&&st.orbitRadius<80,st);
  victim=touch();update();verify('return transition retains 1.125D actual collision',victim.getData('hp')===86.5,state());a.recycle(victim,a.enemies);
  a.abilities.collect=function(...args:any[]){radiusBeforeFill=a.cat.getData('orbitRadius');collect.apply(this,args);radiusAfterFill=a.cat.getData('orbitRadius');};consumeRoot();const contractionExpiry=a.abilities.starEnd;pickup(8);a.abilities.collect=collect;refreshed(contractionExpiry);verify('refill while contracting never jumps radius or resets rotation',radiusBeforeFill===radiusAfterFill&&a.abilities.orbitTween===baseTween,{radiusBeforeFill,radiusAfterFill,state:state()});await advance(220);verify('refreshed contraction expands smoothly back to80',Math.abs(state().orbitRadius-80)<1e-7,state());
  for(const [reason,ms] of [['menu',300],['background',650],['upgrade',300],['upgrade',650]] as const){
   if(reason==='upgrade'){a.growth.collect(experienceNeeded(a.growth.snapshot().level));step();g.scene.processQueue();}else{battle.pause(reason);g.scene.processQueue();}
   const before=JSON.stringify(state()),elapsed=battle.snapshot().elapsed;
   for(const quality of ['low','standard'])battle.setPresentation({quality:quality as any});await wait(ms);step();verify(reason+' '+ms+'ms true pause freezes star radius window phase and damage through quality changes',JSON.stringify(state())===before&&battle.snapshot().elapsed===elapsed,state());
   if(reason==='upgrade')choose(a.growth.snapshot().offer.choices[0]);else{g.loop.wake=()=>{};battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();}
   const angle=state().orbitAngle;step();let delta=state().orbitAngle-angle;if(delta<0)delta+=Math.PI*2;verify(reason+' '+ms+'ms resume does not rotate or expire star from wall-clock debt',delta<=.06&&state().starActive&&Math.abs(state().orbitRadius-80)<1e-7,{delta,state:state()});
  }
  await advance(3100);verify('three effective seconds expire to normal60/.75D without isolated-Boss XP renewal',!state().starActive&&state().orbitRadius===60&&state().orbits.length===2,state());victim=touch();update();verify('expired actual orbit damage returns to .75D',victim.getData('hp')===91,state());a.recycle(victim,a.enemies);
  battle.setPresentation({quality:'low'});consumeRoot();pickup(8);await advance(220);victim=touch(0,1);update();const drops=battle.snapshot().pickups!.droppedXP,kills=battle.snapshot().kills;update();verify('low quality star actual damage kills/drops exactly once without secondary recursion',!victim.active&&drops>=2&&battle.snapshot().pickups!.droppedXP===drops&&battle.snapshot().kills===kills&&battle.snapshot().bellModifiers.shocks===0,{drops,kills,state:state()});
  const nodes=a.children.length;for(let i=0;i<20;i++){configure({L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1});a.abilities.collect(8,a.growth.snapshot().ranks);const radiusTween=a.abilities.radiusTween,rotation=a.abilities.orbitTween;start();verify('restart '+i+' clears star timers/tweens/charge/entities',!state().starActive&&state().orbitRadius===60&&state().charge===0&&state().orbits.length===0&&!a.tweens.getTweens().includes(radiusTween)&&!a.tweens.getTweens().includes(rotation)&&a.children.length===nodes,state());}
  configure({L1_ORBIT_BELL:1,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1});a.abilities.collect(8,a.growth.snapshot().ranks);now+=600000;g.scene.update(now,600000);verify('terminal scene clears star and native timers without delayed restart window',battle.snapshot().result==='timeout'&&!state().starActive&&state().orbitRadius===60&&state().orbits.length===0&&a.abilities.starReturn===null&&a.abilities.starEnd===null,state());
  a.fireVolley=fire;return {status:'PASS',scope:'CONTROLLED_NATIVE_COMBINATIONS_WITH_REAL_XP_AND_WALL_CLOCK_PAUSE',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runBellCombinationDisposeChecks=async()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};try{
  start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:2,L1_RATE:0,L1_HEART:0,L1_SPLIT:1,L1_ORBIT_BELL:3,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1,L1_SHOCK_BELL:1,L1_RICOCHET:1};verify('controlled lifecycle transaction uses actual confirmation',choose('L1_RATE'),a.growth.snapshot().ranks);a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.fireVolley=()=>{};
  a.abilities.collect(8,a.growth.snapshot().ranks);const p=battle.snapshot().bellAbilities!.orbits[0],victim=a.placeSliceEnemy('E01',p.x,p.y);victim.setData('hp',100);a.physics.world.step(0);a.abilities.update(a.growth.snapshot().ranks,require('../../src/progression').abilityDamage(require('../../src/level-config').courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),a.growth.snapshot().ranks),battle.snapshot().elapsed);
  verify('star damage uses grown unsplit D and never triggers shock/bounce/projectile attachments',Math.abs(victim.getData('hp')-64.72)<1e-8&&battle.snapshot().bellModifiers.shocks===0&&battle.snapshot().sourceCounts.SECONDARY===0,{hp:victim.getData('hp'),modifiers:battle.snapshot().bellModifiers});
  const abilities=a.abilities,timers=[abilities.starReturn,abilities.starEnd],manager=a.tweens,rotation=abilities.orbitTween,radius=abilities.radiusTween;verify('active window owns only native Clock and Tween references',timers.every(t=>typeof t.callback==='function')&&!!radius&&!!rotation,battle.snapshot().bellAbilities);
  battle.dispose();verify('dispose immediately removes window/rotation tweens and destroys timer callbacks',abilities.starReturn===null&&abilities.starEnd===null&&abilities.radiusTween===null&&abilities.orbitTween===null&&timers.every(t=>t.callback===undefined)&&!manager.getTweens().includes(rotation)&&!manager.getTweens().includes(radius),{timerCallbacks:timers.map(t=>typeof t.callback),nativeTweens:manager.getTweens().length});
  await new Promise(r=>setTimeout(r,650));verify('disposed Scene cannot revive an old window after real650ms',abilities.starReturn===null&&abilities.starEnd===null&&abilities.radiusTween===null&&abilities.orbitTween===null,{nativeTimers:timers.map(t=>typeof t.callback)});
  return {status:'PASS',scope:'ACTUAL_SCENE_DISPOSE_WITH_PENDING_NATIVE_STAR_WINDOW',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
 w.runBellAbilityBudgetChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const resolve=a.resolveProjectile,fire=a.fireVolley;try{
  for(const [name,ranks,picks] of [
   ['exhaustive worst ten',{L1_RATE:2,L1_SPLIT:1,L1_ECHO:1,L1_EVO_BARRAGE:1,L1_EVO_CADENCE:1,L1_PICKUP_CHIME:1,L1_MOVE:2},10],
   ['actual seed5 mixed nine',{L1_RATE:1,L1_DAMAGE:2,L1_ORBIT_BELL:1,L1_HEART:1,L1_PICKUP_CHIME:1,L1_TRAIL_BELL:1,L1_MOVE:1},9]
  ] as const){
   start();a.growth.collect(8);step();g.scene.processQueue();a.growth.ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};verify(name+' real upgrade transaction applies ranks',choose('L1_RATE'),a.growth.snapshot().ranks);
   position(a.cat,360,300);const target=a.placeSliceEnemy('E01',360,530);target.setData('hp',1000000);a.resolveProjectile=()=>{};a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   let peak=0,lastShots=0,lastReloads=0,remaining=0,secondary=0;
   for(let i=0;i<1800;i++){
    a.abilities.state.collect(8,true);position(target,360,530);step();const state=battle.snapshot();peak=Math.max(peak,state.projectiles);
    if(state.shots>lastShots){
     if(ranks.L1_EVO_CADENCE&&state.reloadCompletions>lastReloads)remaining=3;
     if(remaining){secondary+=3;remaining--;}else if(state.shots===1||state.reloadCompletions>lastReloads)secondary++;
     if(ranks.L1_ECHO&&state.ammo===0)secondary+=2;secondary++;
     verify(name+' actual root '+state.shots+' has no swallowed primary or chime/burst',state.sourceCounts.PRIMARY===state.shots*state.weaponStats.pellets&&state.sourceCounts.SECONDARY===secondary&&state.bellAbilities!.chimes===state.shots,{counts:state.sourceCounts,secondary,active:state.projectiles});
     lastShots=state.shots;lastReloads=state.reloadCompletions;
    }
   }
   const state=battle.snapshot();verify(name+' full native lifetime stress fits original 24 at '+picks+' investments',peak<=24&&state.engine.groups.projectiles.total<=32&&state.reloadCompletions>=2,{picks,peak,allocated:state.engine.groups.projectiles.total,roots:state.shots,reloads:state.reloadCompletions,ranks:state.progression!.ranks,counts:state.sourceCounts});
  }
  a.resolveProjectile=resolve;a.fireVolley=fire;return {status:'PASS',scope:'CONTROLLED_NATIVE_30S_FULL_LIFETIME_EVERY_ROOT_CHARGED',checks};
 }catch(error){a.resolveProjectile=resolve;a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runBellMovementRoomChecks=()=>{const checks:any[]=[];const verify=(name:string,pass:unknown,value:unknown)=>{checks.push({name,pass:!!pass,value});if(!pass)throw Error(name);};const fire=a.fireVolley;try{
  for(const edge of [false,true])for(const id of ['EL01','B01']){
   start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.begin=()=>false;a.fireVolley=()=>{};a.cameras.main.stopFollow();
   const x=edge?80:360,y=edge?140:720;position(a.cat,x,y);const boss=a.placeSliceEnemy(id,x-60,y);boss.setData('hp',100000);const behavior=boss.getData('behavior');
   Object.assign(behavior,{phase:'warning',until:battle.snapshot().elapsed+(id==='EL01'?1:1.05),direction:{x:1,y:0}});a.keys.S.isDown=true;const hp=battle.snapshot().hp;step(80);const st=battle.snapshot();
   verify(id+' '+(edge?'near corner':'center')+' native 170u movement clears locked dash lane within warning',st.hp===hp&&Math.abs(st.engine.velocity.y-170)<1e-8&&st.player.y-y>170&&st.engine.bodies.cat.radius===12,{hp:st.hp,player:st.player,velocity:st.engine.velocity,boss:behavior});
  }
  for(const edge of [false,true]){
   start();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.begin=()=>false;a.fireVolley=()=>{};a.cameras.main.stopFollow();
   const x=edge?100:360,y=edge?140:720;position(a.cat,x+10,y);const boss=a.placeSliceEnemy('B01',x,y);boss.setData('hp',100000);Object.assign(boss.getData('behavior'),{phase:'slam-warning',until:battle.snapshot().elapsed+1.05});a.keys.S.isDown=true;step(65);const st=battle.snapshot();
   verify('Boss '+(edge?'near corner':'center')+' native 170u movement clears 112u slam plus 12u body',st.hp>0&&st.hp>=78&&Math.hypot(st.player.x-x,st.player.y-y)>124&&st.engine.bodies.cat.radius===12,{hp:st.hp,player:st.player,boss:boss.getData('behavior')});
  }
  a.fireVolley=fire;return {status:'PASS',scope:'CONTROLLED_NATIVE_WARNING_MOVEMENT_NOT_ALL_MOB_CROWD_PROOF',checks};
 }catch(error){a.fireVolley=fire;return {status:'FAIL',error:String(error),checks};}};
 w.runMovingHitChecks=()=>{const checks:any[]=[];try{
  start();const target=a.placeSliceEnemy('E03',105,110);target.setData('hp',1000);target.setVelocity(0,96);
  a.projectile({x:100,y:100},0,'bell','PRIMARY',99,12,0,620,1.2);const shot=a.projectiles.getFirstAlive();
  a.physics.world.update(0,1000/60);
  const data={projectile:{prev:{x:shot.body.prev.x+shot.body.halfWidth,y:shot.body.prev.y+shot.body.halfHeight},now:{...shot.body.center}},enemy:{prev:{x:target.body.prev.x+target.body.halfWidth,y:target.body.prev.y+target.body.halfHeight},now:{...target.body.center},radius:target.body.halfWidth}};
  const Hits=require('../../src/battle-hits.cjs'),candidates=Hits.hitCandidates(shot,a.physics,Hits.targetMotionPadding(a.physics));
  checks.push({name:'real Arcade moving E03 crossed during a 60FPS frame enters hit candidates',pass:candidates.some((c:any)=>c.target===target),value:data});
  if(!checks[0].pass)return {status:'FAIL',checks};
  a.hit(shot,target,candidates[0].path);checks.push({name:'real moving crossing applies damage once and recycles the bell',pass:target.getData('hp')===988&&!shot.active,value:{hp:target.getData('hp'),active:shot.active}});
  return {status:checks.every(c=>c.pass)?'PASS':'FAIL',checks};
 }catch(error){return {status:'FAIL',error:String(error),checks};}};
}
void boot().catch(e=>{w.growthBootError=String(e);});
