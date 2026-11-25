// Controlled native-Arena review only. The normal player entry never imports this file.
import {createTraitFixture} from './projectile-traits-sample';
import {courtyardBalanceRunConfig} from '../../src/level-config';
import {ImpactPresentation} from '../../src/impact-presentation';
import {hudMarkup,r1HUDValues} from '../../src/ui/hud';
import type {CatId} from '../../src/combat-config';
import type {IncomingDamageFact} from '../../src/player-defense-rules';

const w=window as any;
const $=(id:string)=>document.getElementById(id)!;
const select=(id:string)=>$(id) as HTMLSelectElement;
const wait=async(fn:()=>boolean)=>{const until=performance.now()+10000;while(!fn()){if(performance.now()>until)throw Error('等待原生场景超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
type Scenario='plain'|'absorb'|'break'|'overflow';

async function boot(){
 let started=false,busy=false,lastFact:IncomingDamageFact|null=null,lastScenario:Scenario='plain';
 const events:any[]=[];
 const f=await createTraitFixture($('stage'),s=>{if(started)draw(s);},true);
 const {a,battle,g}=f;
 const impact=new ImpactPresentation(a);
 // This A/B fixture owns both the pulse and contact curve. Keep the newly
 // adopted runtime route inactive on every reset/resize/quality synchronization.
 const runtimeConfigure=a.configureImpact,feedbackConfigure=a.feedback.configure;
 a.configureImpact=function(...args:any[]){runtimeConfigure.apply(a,args);a.impact?.configure(false,select('quality').value as 'standard'|'low');};
 a.feedback.configure=function(enabled:boolean,quality:'standard'|'low'){feedbackConfigure.call(a.feedback,enabled,quality,false);};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const playerParts=()=>f.session!.runConfig.catId==='CAT01'
  ?['body','weapon','grip','head'].map(key=>a.activeG6.cat[key])
  :[...a.heldArt.objects(),a.activeG6.held.legs];
 const enemyParts=(target:any)=>{const art=target.getData('art');return art?[art.feet,art.body,art.second].filter(Boolean):[target];};
 const modern=()=>select('mode').value!=='original';
 function configure(){
  const quality=select('quality').value as 'standard'|'low';
  impact.configure(modern(),quality,select('mode').value==='strong'?.70:.45,($('reduce') as HTMLInputElement).checked||reduced.matches);
  battle.setPresentation({quality});
 }
 function warm(){impact.prepare(playerParts());for(const e of a.enemies.getChildren())if(e.active)impact.prepare(enemyParts(e));}
 const record=(type:string,detail:any)=>{events.push({type,at:f.session?.elapsed??0,...detail});if(events.length>96)events.shift();};
 const incoming=a.incomingEnemyDamage;
 a.incomingEnemyDamage=function(amount:number){
  const fact=incoming.call(a,amount);impact.playerDamage(fact,playerParts());record('incoming',{fact,impact:impact.snapshot()});return fact;
 };
 const hit=a.applyHitResult;
 a.applyHitResult=function(target:any,result:any,...rest:any[]){
  // The pure hit resolver has already settled damage. Decorations never decide it.
  if(result.targetId===target.getData('id')&&!target.getData('deathResolved')&&result.damage>0&&!result.killed){
   impact.targetHit(result.targetId,enemyParts(target),result.critical===true);
   if(modern()&&select('quality').value==='standard'&&!reduced.matches&&!($('reduce') as HTMLInputElement).checked){
    const previous=target.getData('impactAt') as number|undefined;
    if(previous===undefined||a.time.now-previous>=100){
     let pose=target.getData('pilotImpactPose');if(!pose){pose={x:0};target.setData('pilotImpactPose',pose);}
     a.tweens.killTweensOf(pose);pose.x=1;target.setData('impactAt',a.time.now);
     a.tweens.add({targets:pose,x:0,duration:80,ease:'Quad.easeOut'});
    }
   }
  }
  hit.call(a,target,result,...rest);
  if(result.damage>0)record('hit',{source:result.source,critical:result.critical===true,damage:result.damage,targetId:result.targetId});
 };
 const syncEnemies=a.syncEnemyArt;
 a.syncEnemyArt=function(...args:any[]){syncEnemies.apply(a,args);if(modern())for(const e of a.enemies.getChildren())if(e.active){const root=e.getData('art')?.root,pose=e.getData('pilotImpactPose');if(root&&pose)root.x+=pose.x;}};
 const contact=a.feedback.hit;
 a.feedback.hit=function(...args:any[]){
  const old=a.feedback.effects.getChildren().reduce((n:number,e:any)=>Math.max(n,e.getData('order')||0),0);
  contact.apply(a.feedback,args);
  if(!modern())return;
  for(const effect of a.feedback.effects.getChildren())if(effect.active&&effect.getData('effect')==='contact'&&(effect.getData('order')||0)>old){
   a.tweens.killTweensOf(effect);const first=effect.getData('critical')?50:60,total=effect.getData('duration');
   a.tweens.add({targets:effect,alpha:.35,duration:first,onComplete:()=>{
    if(!effect.active)return;a.tweens.add({targets:effect,alpha:0,duration:total-first,onComplete:()=>a.feedback.effects.killAndHide(effect)});
   }});
  }
 };
 function clear(){
  impact.clear();a.feedback?.clear();for(const e of a.enemies.getChildren()){const pose=e.getData('pilotImpactPose');if(pose){a.tweens.killTweensOf(pose);pose.x=0;}}
  if(started){a.syncEnemyArt();draw(battle.snapshot());}
 }
 a.events.on('postupdate',()=>{if(f.session?.result||f.session?.isPaused)clear();else impact.sync();});a.events.on('pause',clear);
 a.events.once('shutdown',()=>impact.destroy());
 const position=(obj:any,x:number,y:number)=>{obj.body.reset(x,y);obj.body.updateFromGameObject();obj.body.prev.copy(obj.body.position);obj.body.prevFrame.copy(obj.body.position);};
 async function start(scenario:Scenario='plain',trigger=false){
  if(busy)return;busy=true;
  try{
   started=false;clear();lastFact=null;lastScenario=scenario;const previous=f.session;
   configure();battle.start(courtyardBalanceRunConfig(f.config(select('cat').value as CatId)));
   await wait(()=>!!f.session&&f.session!==previous&&!!a.activeG6);
   a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
   for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);
   position(a.cat,360,720);
   for(const x of [460,505,550]){const e=a.placeSliceEnemy('E01',x,720);e.setData('hp',100000);e.body.moves=false;}
   a.projectileRandom.frac=()=>select('critical').value==='critical'?0:.99;
   if(scenario!=='plain')f.install({C13:1});
   a.syncCatArt(false,true);a.syncEnemyArt();warm();
   $('hud').innerHTML=hudMarkup(battle.snapshot(),false,1,false,'受控实战',true);$('hud').querySelector('button')?.remove();
   started=true;f.layout();
   if(trigger){
    const shield=f.session!.defenseSnapshot().shield;
    lastFact=a.incomingEnemyDamage(scenario==='plain'?10:scenario==='absorb'?4:scenario==='break'?shield:shield+10);
   }
   draw(battle.snapshot());record('start',{catId:f.session!.runConfig.catId,scenario,trigger});
  }finally{busy=false;}
 }
 function draw(s:any){
  if(!$('health'))return;
  const values=r1HUDValues(s),d=s.defense;
  $('health').textContent=values.health;$('timer').textContent=values.remaining;$('ammo').textContent=values.ammo;$('level').textContent=values.level;
  $('hud').querySelector<HTMLElement>('.hp-meter i')!.style.width=(s.hp/s.maxHp*100)+'%';
  $('hud').querySelector<HTMLElement>('.hp-trail')!.style.width=(s.feedback.hud.hpTrailRatio*100)+'%';
  $('survival-progress').style.width=values.percent+'%';$('battle-hurt-edge').style.opacity=String(s.feedback.hud.hurtEdgeAlpha);
  const fact=lastFact?`实际扣血 ${lastFact.hpLost.toFixed(1)} · 吸收 ${lastFact.shieldAbsorbed.toFixed(1)}${lastFact.shieldBroke?' · 已破盾':''}`:'拖动战场走位，观察移动中的真实命中。';
  $('fact').textContent=fact;
  $('status').textContent=`${s.engine.paused?'已暂停 · 点继续恢复':s.result?'本局结束 · 可重开':'三猫36u · 真实弹道／伤害'}${d?` · 护盾 ${d.shield.toFixed(1)}/${d.maxShield.toFixed(1)}`:''}`;
  $('stage').dataset.state=JSON.stringify(s);
 }
 $('restart').addEventListener('click',()=>void start(lastScenario));
 for(const scenario of ['plain','absorb','break','overflow'] as const)$(scenario).addEventListener('click',()=>void start(scenario,true));
 $('pause').addEventListener('click',()=>battle.pause('menu'));$('resume').addEventListener('click',()=>battle.resume());
 $('sound').addEventListener('click',()=>{void battle.audio?.enable().then(()=>{$('sound').textContent=battle.audio?.snapshot().ready?'声音已开':'声音未就绪';});});
 $('cat').addEventListener('change',()=>void start(lastScenario));
 $('critical').addEventListener('change',()=>{a.projectileRandom.frac=()=>select('critical').value==='critical'?0:.99;});
 const changed=()=>{clear();configure();if(started)warm();};
 for(const id of ['mode','quality','reduce'])$(id).addEventListener('change',changed);
 if(reduced.addEventListener)reduced.addEventListener('change',changed);else reduced.addListener(changed);
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)battle.pause('inputLost');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)battle.pause('background');});
 let manualNow=0;const wake=g.loop.wake.bind(g.loop);
 const controlled=()=>{g.loop.sleep();manualNow=a.time.now;g.loop.wake=()=>{};a.tweens.getDelta=()=>1000/60;};
 const step=(frames=1,render=true)=>{for(let i=0;i<frames;i++){manualNow+=1000/60;g.scene.update(manualNow,1000/60);g.scene.processQueue();}if(render){g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();}};
 w.impactSample={f,impact,events,start,clear,configure,warm,playerParts,enemyParts,controlled,step,
  uncontrolled(){g.loop.wake=wake;delete a.tweens.getDelta;g.loop.wake();},
  snapshot:()=>({battle:battle.snapshot(),impact:impact.snapshot(),lastFact,lastScenario}),
  dispose(){impact.destroy();battle.dispose();}};
 for(const e of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input')))e.disabled=false;
 await start();w.impactSampleReady=true;
}
void boot().catch(e=>{w.impactSampleError=String(e);$('status').textContent='小样加载失败：'+String(e);});
