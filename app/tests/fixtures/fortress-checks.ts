// D1 only: controlled native Arena, not normal rewards or device evidence.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMIES,ENEMY_BUBBLE,BOSS_SCATTER} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{a,g,battle}=f,wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const hpFeedback:number[]=[],nativeDamage=a.feedback.damage;
 a.feedback.damage=function(point:any,amount:number,player:boolean,...rest:any[]){if(player)hpFeedback.push(amount);return nativeDamage.call(this,point,amount,player,...rest);};
 const pos=(e:any,x:number,y:number)=>{e.body.reset(x,y);e.body.updateFromGameObject();e.body.prev.copy(e.body.position);e.body.prevFrame.copy(e.body.position);};
 const step=(n=1,dt=50)=>{for(let i=0;i<n;i++){now+=dt;g.scene.update(now,dt);g.scene.processQueue();}};
 const s=()=>battle.snapshot() as any;
 const start=(ranks:any={},cat:CatId='CAT01')=>{g.loop.wake=()=>{};battle.start({...f.config(cat),areaAbilities:{enabled:true},growthPool:undefined,defenseCompanions:{enabled:true}} as any);g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};a.reinforcements.dueEncounters=()=>[];a.growth.collect=()=>{};a.growth.queueElite=()=>false;f.install(ranks);(f.session as any).cooldown=999;pos(a.cat,360,600);step();};
 const enemy=(id:string,x=360,y=600)=>{const e=a.placeSliceEnemy(id,x,y);e.setData('hp',1e6);e.body.moves=false;return e;};
 const near=(x:number,y:number,eps=1e-6)=>Math.abs(x-y)<eps;
 w.runFortressChecks=()=>{const checks:any[]=[];const check=(name:string,pass:any,value?:any)=>{checks.push({name,pass:!!pass,value:value===undefined?undefined:JSON.parse(JSON.stringify(value))});if(!pass)throw Error(name);};try{
  start({C13:1,A13:1});check('D1 native Arena exposes active18shield and6armor before first enemy',s().defense?.enabled&&near(s().defense.shield,18)&&s().defense.armor===6,s().defense);
  for(const cat of ['CAT01','CAT02','CAT03'] as CatId[]){
   for(const kind of ['contact','elite-dash','boss-dash','bubble','slam','scatter']){
    start({C13:1,A13:1},cat);const before=s(),hp=before.hp,cap=before.defense.maxShield,feedbackBefore=hpFeedback.length;
    let raw=0;
    if(kind==='contact'){enemy('E01');raw=ENEMIES.E01.contact;step();}
    if(kind==='elite-dash'||kind==='boss-dash'){const id=kind==='elite-dash'?'EL01':'B01',e=enemy(id);const state=e.getData('behavior');state.phase='dash';state.until=f.session!.elapsed+5;state.direction={x:1,y:0};raw=ENEMIES[id].dashDamage;step();}
    if(kind==='bubble'){a.enemyBubble({x:360,y:600},{x:0,y:1},ENEMY_BUBBLE);raw=ENEMY_BUBBLE.damage;step();}
    if(kind==='slam'){const e=enemy('B01',440);e.getData('behavior').phase='slam-warning';e.getData('behavior').until=f.session!.elapsed;raw=ENEMIES.B01.slamDamage;step();}
    if(kind==='scatter'){const e=enemy('B01',260);const state=e.getData('behavior');state.phase='recover';state.until=f.session!.elapsed+100;state.direction={x:1,y:0};a.bossProjectileSlots.reserve(e,5);a.emitBossScatter(e,1);raw=BOSS_SCATTER.damage;step(18);}
    const d=s().defense,actual=raw*100/106,absorb=Math.min(cap,actual);
    check(cat+' '+kind+' actual enemy damage armor then shield then HP',near(d.absorbedTotal,absorb)&&near(hp-s().hp,Math.max(0,actual-cap))&&near(d.lastHit?.rawDamage,raw),{before:before.defense,after:d,hp:s().hp,raw});
    check(cat+' '+kind+' actual HP feedback only for real HP loss',d.hpLostTotal===0?hpFeedback.length===feedbackBefore:hpFeedback.length===feedbackBefore+1&&near(hpFeedback[feedbackBefore],d.hpLostTotal),{defense:d,hpFeedback:hpFeedback.slice(feedbackBefore)});
   }
  }
  start({C13:1});a.enemyBubble({x:360,y:600},{x:0,y:1},{...ENEMY_BUBBLE,damage:10});step();const hit=s();step(119);check('native regeneration stays gated before6seconds',near(s().defense.shield,8),s().defense);step(11);check('native continuous shield regeneration crosses6second boundary',s().defense.shield>8&&s().defense.shield<10,s().defense);
  a.enemyBubble({x:360,y:600},{x:0,y:1},{...ENEMY_BUBBLE,damage:1});step();const damaged=s();step(100);check('shield-only loss resets recharge wait without HP loss',near(s().defense.shield,damaged.defense.shield)&&s().hp===90&&damaged.defense.lastEnemyAt>hit.defense.lastEnemyAt,{hit:damaged.defense,after:s().defense});
  start({C13:1});a.enemyBubble({x:360,y:600},{x:0,y:1},{...ENEMY_BUBBLE,damage:10});step();f.install({C13:1,L1_HEART:1});check('native growth expands shield18to21 without filling missing shield',near(s().defense.shield,8)&&near(s().defense.maxShield,21)&&s().hp===105,s().defense);
  f.session!.hp=50;const beforeHeal=s().defense;(f.session as any).applyGrowthReward({C13:1,L1_HEART:1,L1_DAMAGE:0,L1_RATE:0},.2);check('elite-style HP recovery never fills shield or resets last damage',s().hp===71&&s().defense.shield===beforeHeal.shield&&s().defense.lastEnemyAt===beforeHeal.lastEnemyAt,s().defense);
  for(const reason of ['menu','background','upgrade']){
   start({C13:1});a.enemyBubble({x:360,y:600},{x:0,y:1},ENEMY_BUBBLE);step();
   if(reason==='upgrade'){a.growth.collect=Object.getPrototypeOf(a.growth).collect.bind(a.growth);for(let n=0;n<4;n++)a.pickups.drop(90000+n,'E01',{x:360,y:600});step();check('actual8XP opens actual upgrade offer',s().reasons.includes('upgrade')&&!!s().progression.offer,s().reasons);}
   else battle.pause(reason as any);
   const paused=s();step(130);check(reason+' freezes shield recovery and feedback',s().elapsed===paused.elapsed&&JSON.stringify(s().defense)===JSON.stringify(paused.defense),s().defense);
   g.loop.wake=()=>{};
   if(reason==='upgrade'){const o=s().progression.offer;check('actual reward confirmation closes upgrade',battle.confirmUpgrade(s().progression.runId,o.id,o.choices[0]),o);}
   else battle.resume();g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();check(reason+' explicit continue advances without6second catchup',s().elapsed-paused.elapsed<.1&&s().defense.shield<=paused.defense.shield+.01,s().defense);
  }
  for(let n=0;n<20;n++){start({C13:1,A13:4});a.enemyBubble({x:360,y:600},{x:0,y:1},ENEMY_BUBBLE);step();const oldGraphic=a.defenseGraphic;start();check('restart'+n+' clears armor shield counters and destroys old native feedback',!oldGraphic.active&&!oldGraphic.scene&&s().defense.armor===0&&s().defense.shield===0&&s().defense.absorbedTotal===0&&s().defense.lastHit===null&&s().defenseVisual.objects<=1&&!s().defenseVisual.visible,s().defenseVisual);}
  start({C13:1});(f.session as any).shield=0;f.session!.hp=1;const boss=enemy('B01',440);boss.setData('hp',1);boss.getData('behavior').phase='slam-warning';boss.getData('behavior').until=f.session!.elapsed;for(let n=0;n<4;n++)a.pickups.drop(99900+n,'E01',{x:360,y:600});a.projectile({x:440,y:600},0,'bell','PRIMARY',99999,999,0,1,1);const shots=s().shots;step();check('same-frame lethal enemy and Boss kill and touchingXP remain death',s().result==='death'&&s().progression.totalXP===0&&!s().progression.offer&&s().shots===shots&&s().defense.shield===0,{result:s().result,xp:s().progression.totalXP,defense:s().defense});
  const finished=s();step(200);check('terminal shield never regenerates or emits delayed feedback',JSON.stringify(s().defense)===JSON.stringify(finished.defense),s().defense);
  start({C13:1});a.enemyBubble({x:360,y:600},{x:0,y:1},ENEMY_BUBBLE);step();const visual=s().defenseVisual,graphic=a.defenseGraphic;battle.dispose();check('dispose destroys actual native defense Graphics',!graphic.active&&!graphic.scene&&!a.defenseGraphic?.active,{before:visual,oldGraphicActive:graphic.active});
  return {status:'PASS',scope:'CONTROLLED_NATIVE_ARENA_PRESET_RANKS_ENEMIES_AND_FRAMES_NOT_NATURAL_OR_PHONE',checks};
 }catch(e){return {status:'FAIL',error:String(e),stack:(e as Error).stack,checks};}};
 w.fortressChecksReady=true;
}
void boot().catch(e=>w.fortressChecksBootError=String(e));
