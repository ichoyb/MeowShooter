// Explicit controlled art preview. The normal player bundle never imports this entry.
import {createTraitFixture} from './projectile-traits-sample';
import {normalCourtyardRunConfig} from '../../src/level-config';
import {G6RewardPresentation} from '../../src/g6-reward-presentation';
import {G6CatPresentation,registerG6CatTextures} from '../../src/g6-cat-presentation';
import {G6HeldWalk,registerG6HeldWalkTextures} from '../../src/g6-held-walk';
import {G6AreaPresentation} from '../../src/g6-area-presentation';
import {G6BellPresentation} from '../../src/g6-bell-presentation';
import {G6FlightRhythmPresentation} from '../../src/g6-flight-rhythm-presentation';
import {G6HuntContractPresentation} from '../../src/g6-hunt-contract-presentation';
import {abilityGeometry} from '../../src/area-ability-rules';
import {contractMultipliers} from '../../src/contract-rules';
import type {Point} from '../../src/rules';
import type {CatId} from '../../src/combat-config';
import {attackBuilds,type AttackBuildId} from './g6-attack-builds';
import {checkG6Rewards} from './g6-reward-checks';

const w=window as any;
const $=(id:string)=>document.getElementById(id)!;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('图片加载失败：'+src));im.src=src;});
const wait=async(fn:()=>boolean)=>{const end=performance.now()+10000;while(!fn()){if(performance.now()>end)throw Error('等待场景超时');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}};
async function boot(){
 let started=false,busy=false,modern=true,paused=false,ended=false,quality:'standard'|'low'='standard';
 let selectedCat:CatId='CAT01',seenReloadTotal=0;
 const buildSelect=document.getElementById('build') as HTMLSelectElement|null;
 let selectedBuild:AttackBuildId='return',previewDropId=100000;
 if(buildSelect)for(const [id,build] of Object.entries(attackBuilds))buildSelect.add(new Option(build.name,id));
 if(buildSelect)buildSelect.value=selectedBuild;
 let reflectState=()=>{};
 const f=await createTraitFixture($('stage'),()=>reflectState()),{battle,a}=f;
 const config=(id:CatId)=>normalCourtyardRunConfig(f.config(id));
 const rewardNames=['guard','cannon','leaf','shard','spirit'];
 const rewardImages=await Promise.all(rewardNames.map(n=>image('./assets/g6-reward/'+n+'.png')));
 rewardImages.forEach((im,i)=>a.textures.addImage('g6-'+rewardNames[i],im));
 const catImages=await Promise.all(['body','weapon','grip','head'].map(n=>image('./assets/g6-cat/'+n+'.png')));
 registerG6CatTextures(a,{body:catImages[0],weapon:catImages[1],grip:catImages[2],head:catImages[3]});
 const [snow,ink]=await Promise.all(['cat02-walk','cat03-walk'].map(n=>image('./assets/g6-held/'+n+'.png')));
 registerG6HeldWalkTextures(a,{CAT02:snow,CAT03:ink});
 const cat=new G6CatPresentation(a,config('CAT01').moveSpeed),fx=new G6RewardPresentation(a);
 const bells=buildSelect?new G6BellPresentation(a):null;
 const areas=buildSelect?new G6AreaPresentation(a):null;
 const flight=buildSelect?new G6FlightRhythmPresentation(a):null;
 const huntContracts=buildSelect?new G6HuntContractPresentation(a):null;
 if(flight){flight.attach(a.projectiles);a.flightVisual=flight;}
 const huntTarget=(id:number|null)=>{
  if(id===null)return null;
  const enemy=a.enemies.getChildren().find((e:any)=>e.active&&e.getData('id')===id&&e.getData('hp')>0);
  if(!enemy)return null;
  return {x:enemy.body.center.x,y:enemy.body.center.y,height:enemy.displayHeight};
 };
 if(huntContracts){
  const bound=new WeakSet<object>();
  const syncHunt=a.syncHunt.bind(a);
  a.syncHunt=()=>{
   syncHunt();
   const hunt=a.hunt;
   if(!hunt||bound.has(hunt))return;
   bound.add(hunt);
   const died=hunt.died.bind(hunt);
   hunt.died=(id:number,position:Point)=>{
    const before=hunt.snapshot().transfers;
    died(id,position);
    const after=hunt.snapshot();
    if(!started||ended||after.transfers===before)return;
    const next=huntTarget(after.targetId);
    if(next)huntContracts.transfer(position,{x:next.x,y:next.y});
   };
  };
  const fireVolley=a.fireVolley.bind(a);
  a.fireVolley=(direction:Point&{id:number})=>{
   const before=a.sourceCounts.PRIMARY;
   fireVolley(direction);
   if(started&&!ended&&a.growth.snapshot().ranks.R05&&a.sourceCounts.PRIMARY>before){
    huntContracts.weaponVolley(a.cat.body.center,direction);
   }
  };
 }
 const heldWalk=new G6HeldWalk(a,a.heldArt,{CAT02:config('CAT02').moveSpeed,CAT03:config('CAT03').moveSpeed});
 if(areas){
  const originalShock=a.shock.bind(a);
  a.shock=(hit:{position:Point})=>{
   originalShock(hit);
   if(started&&modern&&!ended){
    const radius=abilityGeometry(f.session!.runConfig,a.growth.snapshot().ranks).shockRadius;
    areas.showShock(hit.position,radius);
   }
  };
 }
 const applyCatMode=()=>{
  const animateCats=modern||!!buildSelect;
  cat.setVisible(animateCats&&selectedCat==='CAT01');
  for(const name of ['body','weapon','grip','head'])a.catArt[name].setVisible(!animateCats&&selectedCat==='CAT01');
  heldWalk.setVisible(animateCats);
 };
 // Both art versions consume the very same physical cat and actual volleys.
 const originalSync=a.syncCatArt.bind(a),originalFire=a.catArt.fire.bind(a.catArt);
 a.catArt.fire=()=>{originalFire();cat.fire();};
 a.syncCatArt=(reset=false,preserve=false)=>{
  originalSync(reset,preserve);
  if(reset){
   cat.reset(selectedCat==='CAT01',36);
   heldWalk.reset(selectedCat!=='CAT01',selectedCat==='CAT03'?'CAT03':'CAT02',36);
  }
  const body=a.cat.body,dx=body.deltaXFinal(),dy=body.deltaYFinal(),distance=Math.hypot(dx,dy);
  const movement={moved:preserve?null:distance>1e-5,horizontalDisplacement:reset?0:dx,actualSpeed:a.game.loop.delta>0?distance/(a.game.loop.delta/1000):0};
  if(selectedCat==='CAT01')cat.sync(body.center,movement,a.lastAim);
  else heldWalk.sync(movement);
  applyCatMode();
 };
 const syncEffects=(animateEntry=true)=>{
  const session=f.session!,sentry=a.sentries?.snapshot();
  const modernSupport=modern||!!buildSelect;
  fx.sync(a.cat.body.center,session.defenseSnapshot(),sentry?.station??null,sentry?.emitted??0,sentry?.lastShot??null,animateEntry);
  fx.syncSpirit(a.spirit,a.companionDiagnostics.spirit.emitted,session.elapsed);
  if(a.spirit)a.spirit.setVisible(!modernSupport);
  if(a.defenseGraphic)a.defenseGraphic.setVisible(!modernSupport&&!session.result&&(session.defenseSnapshot().shield>0||a.defenseGraphic.getData('flashing')===true));
  if(a.sentries)for(const obj of a.sentries.group.getChildren())obj.setAlpha(modernSupport?0:1);
  if(bells&&areas){
   const area=a.areas?.snapshot()??null,ranks=a.growth.snapshot().ranks;
   bells.sync(a.abilities?.snapshot()??null,session.elapsed);
   areas.sync(area,session.elapsed,!!ranks.E16,animateEntry);
   for(const layer of a.areas?.group.getChildren()??[])layer.setVisible(!modern&&layer.active&&layer.commandBuffer.length>0);
   a.shockEffect.setVisible(!modern);
   flight?.sync();
   const hunt=a.hunt,mark=hunt?.snapshot()??null,body=a.cat.body;
   if(hunt&&modern)hunt.graphic.setVisible(false);
   else if(hunt&&!animateEntry)hunt.draw();
   huntContracts?.syncMark(mark,huntTarget(mark?.targetId??null),!!hunt?.preferredTarget());
   huntContracts?.syncContract(body.center,{x:body.deltaXFinal(),y:body.deltaYFinal()},session.contractSnapshot(),
    !!ranks.R06,!!ranks.R07,!!ranks.R04,area?.lastPulse??null,animateEntry);
  }
 };
 const clearOriginalAttackEffects=()=>{
  if(!buildSelect)return;
  // Keep the native anchor and its gameplay lifetime. Discard only old transient ink.
  a.areas?.pulse.clear().setVisible(false);
  a.clearBellEffects();
 };
 const interruptEffects=()=>{
  fx.interrupt();bells?.interrupt();areas?.interrupt();flight?.interrupt();huntContracts?.interrupt();clearOriginalAttackEffects();
 };
 const applyMode=(animateEntry=false)=>{
  if(!animateEntry)clearOriginalAttackEffects();
  fx.setEnabled(modern||!!buildSelect);bells?.setEnabled(modern);areas?.setEnabled(modern);applyCatMode();
  flight?.setEnabled(modern);huntContracts?.setEnabled(modern);
  $('mode').textContent=modern?'查看旧版':'查看新版';
  $('version').textContent=buildSelect?(modern?'精修特效':'原版特效'):(modern?'新版 · G6-2':'旧版 · G5');
  $('version').dataset.version=modern?'new':'old';
  if(started&&!ended){
   syncEffects(animateEntry);
   if(paused)interruptEffects();
  }
 };
 const originalPause=battle.pause.bind(battle),originalResume=battle.resume.bind(battle);
 battle.pause=reason=>{interruptEffects();cat.pause(true);heldWalk.pause(true);originalPause(reason);paused=true;draw();};
 battle.resume=()=>{cat.pause(false);heldWalk.pause(false);originalResume();paused=false;draw();};
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const draw=()=>{
  if(!started)return;const s=battle.snapshot(),d=f.session!.defenseSnapshot();
  $('health').textContent=`生命 ${Math.ceil(s.hp)} / ${s.maxHp}`;
  $('shield').textContent=buildSelect?`${s.elapsed.toFixed(1)} 秒`:`护盾 ${d.shield.toFixed(1)} / ${d.maxShield}`;
  const station=a.sentries?.snapshot().station;
  $('ammo').textContent=`弹匣 ${s.ammo}/${f.session!.effectiveConfig.weapon.ammoCapacity}`;
  const reload=f.session!.sustainSnapshot().shieldRecoveredTotal;
  if(buildSelect){
   const bell=s.bellAbilities,area=s.areaAbilities;
   const session=f.session!,ranks=a.growth.snapshot().ranks;
   const multipliers=contractMultipliers(session.runConfig,ranks),stance=session.contractSnapshot();
   const mark=s.huntingMark;
   $('readout').textContent=ranks.R04||ranks.R05?`武器 ×${multipliers.weapon} · 技能 ×${multipliers.skill}`:
    ranks.R06||ranks.R07?`${stance.moving?'移动中':'站定'} · 实际倍率 ×${stance.stance}`:
    ranks.C18?`追猎标记 ${mark.targetId===null?'待出现':mark.remainingSeconds.toFixed(1)+' 秒'} · 传承 ${mark.transfers} 次`:
    bell?.orbits.length||bell?.trails.length||ranks.C15||ranks.C16?`飞铃 ${bell?.orbits.length??0} · 地铃 ${bell?.trails.length??0} · 脉冲 ${area?.casts??0} · 锚点爆发 ${area?.bursts??0}`:'';
  }else $('readout').textContent=`装填补盾累计 +${Number(reload.toFixed(2))} · 堡垒${station?(station.attached?'随行':'落地'):'待部署'}${selectedCat==='CAT03'?' · 星灵发射 '+a.companionDiagnostics.spirit.emitted:''}`;
  $('pause').textContent=paused?'继续':'暂停';
  const hint=buildSelect?attackBuilds[selectedBuild].tip:'拖动走位／WASD。先损盾，等弹匣打空观察补盾；破盾后走开可看堡垒落地。';
  $('status').textContent=s.result?'本次演示已结束，点重开再试。':paused?'已暂停，点继续恢复':hint;
  $('stage').dataset.state=JSON.stringify({battle:s,cat:cat.snapshot(),held:heldWalk.snapshot(),fx:fx.snapshot()});
 };
 reflectState=()=>{
  if(started&&!ended&&battle.snapshot().result){
   ended=true;paused=true;
   fx.setEnabled(false);
   bells?.finish();areas?.reset();
   flight?.finish();huntContracts?.reset();
   a.spirit?.setVisible(false);
   fx.interrupt();cat.pause(true);heldWalk.pause(true);$('pause').setAttribute('disabled','');draw();
  }
 };
 const spawnWave=()=>{
  const {x,y}=a.cat.body.center,bounds=a.physics.world.bounds;
  const formation=selectedBuild==='mirror'
   ?[[70,0],[96,0],[122,0],[148,0],[-120,34]]
   :[[104,-24],[124,32],[-116,28],[-130,-39],[7,-128]];
  for(const [dx,dy] of formation){
   if(a.enemies.countActive(true)>=8)break;
   const px=Math.max(bounds.x+16,Math.min(bounds.right-16,x+dx));
   const py=Math.max(bounds.y+16,Math.min(bounds.bottom-16,y+dy));
   if(Math.hypot(px-x,py-y)>48)a.placeSliceEnemy('E01',px,py);
  }
 };
 const post=()=>{
  if(!started||ended||f.session!.isPaused)return;
  syncEffects();
  const total=f.session!.sustainSnapshot().shieldRecoveredTotal;
  if(total>seenReloadTotal){
   const weapon=selectedCat==='CAT01'?cat.snapshot().weaponPosition:a.heldArt.snapshot().weaponPosition;
   fx.reloadShield(total-seenReloadTotal,weapon,a.cat.body.center);
  }
  seenReloadTotal=total;
  draw();
 };
 a.events.on('postupdate',post);
 const start=async()=>{
  if(busy)return;busy=true;started=false;
  const catSelect=$('cat') as HTMLSelectElement;
  catSelect.disabled=true;
  if(buildSelect){buildSelect.disabled=true;selectedBuild=buildSelect.value as AttackBuildId;}
  selectedCat=catSelect.value as CatId;
  try{
   fx.reset();bells?.reset();areas?.reset();flight?.reset();huntContracts?.reset();seenReloadTotal=0;cat.pause(false);heldWalk.pause(false);paused=false;ended=false;$('pause').removeAttribute('disabled');
   const previous=f.session;battle.setPresentation({quality});battle.start(config(selectedCat));
   await wait(()=>!!f.session&&f.session!==previous);
   a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   a.growth.collect=()=>{};a.growth.queueElite=()=>false;
   for(const enemy of a.enemies.getChildren())if(enemy.active)a.recycle(enemy,a.enemies);
   position(a.cat,360,720);
   if(buildSelect){
    f.install(attackBuilds[selectedBuild].ranks);
    bells?.bind(a.abilities);
    spawnWave();
    ($('xp') as HTMLButtonElement).disabled=selectedBuild!=='star'&&selectedBuild!=='mixed';
   }else{
    const enemy=a.placeSliceEnemy('E01',460,720);enemy.setData('hp',1000000);enemy.body.moves=false;
    f.session!.damage(18);f.install({C21:1,C13:1,C12:1,M10:1,E14:1});
    const session=f.session!,recover=session.recordSustainHit.bind(session),damage=session.damage.bind(session);
    session.recordSustainHit=fact=>{const actual=recover(fact);fx.heal(actual,enemy.body.center);return actual;};
    session.damage=amount=>{const fact=damage(amount);fx.incoming(fact);return fact;};
   }
   fx.setQuality(quality);started=true;applyMode(true);f.layout();a.syncCatArt(false);post();
  }finally{busy=false;catSelect.disabled=false;if(buildSelect)buildSelect.disabled=false;}
 };
 $('mode').addEventListener('click',()=>{modern=!modern;applyMode();if(!paused)post();});
 $('start').addEventListener('click',()=>void start());
 $('cat').addEventListener('change',()=>void start());
 buildSelect?.addEventListener('change',()=>void start());
 $('pause').addEventListener('click',()=>paused?battle.resume():battle.pause('menu'));
 $('damage')?.addEventListener('click',()=>{a.incomingEnemyDamage(4);draw();});
 $('break')?.addEventListener('click',()=>{a.incomingEnemyDamage(f.session!.defenseSnapshot().shield+6);draw();});
 $('wave')?.addEventListener('click',()=>{if(started&&!ended&&!paused)spawnWave();});
 $('xp')?.addEventListener('click',()=>{
  if(!started||ended||paused)return;
  const p=a.cat.body.center;
  for(let i=0;i<4;i++)a.pickups.drop(++previewDropId,'E01',{x:p.x+13+i*3,y:p.y});
 });
 $('quality').addEventListener('change',()=>{quality=($('quality') as HTMLSelectElement).value as typeof quality;fx.setQuality(quality);bells?.setQuality(quality);areas?.setQuality(quality);flight?.setQuality(quality);huntContracts?.setQuality(quality);battle.setPresentation({quality});f.layout();magnify();});
 $('sound')?.addEventListener('click',()=>void battle.audio?.enable().then(()=>{$('sound').textContent='声音已开启';}));
 // Magnifier is a second native camera, never a CSS enlargement of the whole scene.
 const magnifier=a.cameras.add(0,0,1,1,false,'g6-close-up').setBackgroundColor('#edf1df');magnifier.inputEnabled=false;
 const magnify=()=>{
  const showing=($('zoom') as HTMLInputElement).checked,density=a.scale.gameSize.width/$('stage').clientWidth;
  magnifier.setVisible(showing);if(!showing)return;
  const size=Math.min(132,$('stage').clientWidth*.34)*density;
  magnifier.setViewport(12*density,a.scale.gameSize.height-size-12*density,size,size).setOrigin(.5,.5).setZoom(3*a.cameras.main.zoomX).centerOn(a.cat.body.center.x,a.cat.body.center.y);
 };
 magnifier.ignore(a.stick);a.events.on('postupdate',magnify);
 $('zoom').addEventListener('change',magnify);
 window.addEventListener('resize',()=>{f.layout();magnify();});
 window.addEventListener('blur',()=>{if(started)battle.pause('inputLost');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)battle.pause('background');});
 w.g6={f,cat,heldWalk,fx,bells,areas,flight,huntContracts,start,setMode:(value:boolean)=>{modern=value;applyMode();},checks:async()=>{
  battle.pause('menu');started=false;
  // Resume only the native Scene clock for this clearly isolated contract check.
  a.scene.resume();a.time.paused=false;
  await wait(()=>a.scene.isActive());
  const result=await checkG6Rewards(fx,ms=>new Promise(resolve=>a.time.delayedCall(ms,resolve)));
  await start();return result;
 }};
 for(const element of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input')))element.disabled=false;
 await start();w.g6Ready=true;
}
void boot().catch(e=>{$('status').textContent='加载失败：'+String(e);w.g6Error=String(e);});
