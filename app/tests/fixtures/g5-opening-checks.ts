import {createTraitFixture} from './projectile-traits-sample';
import {normalCourtyardRunConfig} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{battle,a,g}=f;
 const wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 const step=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;g.scene.update(now,1000/60);g.scene.processQueue();}};
 const start=(cat:CatId='CAT01')=>{g.loop.wake=()=>{};try{battle.start(normalCourtyardRunConfig(f.config(cat)));}finally{g.loop.wake=wake;}g.loop.sleep();g.scene.processQueue();step();};
 w.runG5GateChecks=()=>{const checks:any[]=[];
  const check=(name:string,fn:()=>unknown)=>{try{const value=fn();checks.push({name,pass:!!value});}catch(error){checks.push({name,pass:false,error:String(error)});}};
  check('C18 cannot mark first encounter before full visibility',()=>{start();const first=battle.snapshot().firstEncounter!,enemy=a.enemies.getChildren().find((e:any)=>e.active&&e.getData('id')===first.id);position(enemy,160,720);f.install({C18:1});a.syncHunt();return a.hunt.snapshot().targetId===null&&!battle.snapshot().firstEncounter!.eligible;});
  check('actual incoming HP loss dismisses transient cue',()=>{start();const before=battle.snapshot();if(before.onboarding.hint?.kind!=='move')throw Error('fresh unfinished move cue required');const e=a.placeSliceEnemy('E01',a.cat.x,a.cat.y);e.body.moves=false;step();const after=battle.snapshot();return after.hp<before.hp&&after.onboarding.hint===null;});
  check('child-layer dismissal only clears hint, preserving battle facts',()=>{start();const before=battle.snapshot();(battle as any).dismissOnboarding();const after=battle.snapshot();return after.onboarding.hint===null&&JSON.stringify(after.progression)===JSON.stringify(before.progression)&&after.elapsed===before.elapsed&&after.hp===before.hp&&after.moveHeld===before.moveHeld;});
  return {status:checks.every(c=>c.pass)?'PASS':'FAIL',checks,scope:'CONTROLLED_ACTUAL_ARENA_SPEC_GATES_NOT_NATURAL'};
 };
 w.runG5OpeningChecks=()=>{const checks:any[]=[];
 const check=(name:string,ok:unknown,value?:unknown)=>{checks.push({name,pass:!!ok,value});if(!ok)throw Error(name+' '+JSON.stringify(value));};
 try{
  for(const cat of ['CAT01','CAT02','CAT03'] as const){
   start(cat);let s=battle.snapshot(),first=s.firstEncounter;
   check(cat+' real first-frame native body birth',first&&first.bornAt<.05&&s.engine.groups.enemies.active===1&&s.targets.some(t=>t.id===first!.id),first);
   check(cat+' first from real courtyard outside',first&&(first.birth.x===-48||first.birth.x===768)&&first.birth.y===720,first);
   for(let i=0;i<305&&!battle.snapshot().firstEncounter?.eligible;i++){s=battle.snapshot();check(cat+' before-visible cannot select main/spirit '+i,s.sourceCounts.PRIMARY===0&&s.sourceCounts.SUMMON===0,{elapsed:s.elapsed,counts:s.sourceCounts});step();}
   s=battle.snapshot();first=s.firstEncounter;check(cat+' native art complete by5s',first?.eligible&&first.fullVisibleAt!==null&&first.fullVisibleAt<=5,first);
   position(a.cat,360,1300);step(3);check(cat+' first eligibility remains after camera leaves',battle.snapshot().firstEncounter?.eligible,battle.snapshot().firstEncounter);
  }
  start();check('unfinished move cue available next run',battle.snapshot().onboarding.hint?.kind==='move',battle.snapshot().onboarding);
  a.keys.D.isDown=true;step(9);a.keys.D.isDown=false;step();check('only real native body travel completes move',battle.snapshot().onboarding.completed.move&&battle.snapshot().onboarding.travel>=12,battle.snapshot().onboarding);
  battle.pause('menu');const paused=battle.snapshot();step(50);check('pause freezes effective clock and clears tutorial',battle.snapshot().elapsed===paused.elapsed&&battle.snapshot().onboarding.hint===null,battle.snapshot().onboarding);battle.resume();g.loop.sleep();step(2);
  check('resume keeps completion without movement replay',battle.snapshot().onboarding.completed.move&&battle.snapshot().onboarding.hint?.kind!=='move',battle.snapshot().onboarding);
  for(let i=0;i<20;i++){start();const s=battle.snapshot();check('restart'+i+' native first entity and input reset, session completion retained',s.enemies===1&&s.firstEncounter?.eligible===false&&s.firstEncounter.fullVisibleAt===null&&s.firstEncounter.firstPrimaryShotAt===null&&s.onboarding.completed.move&&s.onboarding.hint?.kind!=='move'&&!s.moveHeld&&s.progression?.confirmedPicks===0,{first:s.firstEncounter,onboarding:s.onboarding,timers:s.engine.timers});}
  // Controlled actual collision/pickup/confirmation witness. This uses declared
  // stationary one-HP targets and native Body positioning, not natural balance.
  start();a.spawns.take=()=>null;
  for(const enemy of a.enemies.getChildren())if(enemy.active)a.recycle(enemy,a.enemies);
  position(a.cat,360,720);let dropObserved=false,pickObserved=false;
  for(let kill=0;kill<12&&!battle.snapshot().progression?.offer;kill++){
   const enemy=a.placeSliceEnemy('E01',440,720);enemy.setData('hp',1);enemy.body.moves=false;
   for(let i=0;i<240&&enemy.active;i++)step();check('controlled real hit kills target '+kill,!enemy.active,battle.snapshot().kills);
   const dropped=battle.snapshot();if(!dropObserved){check('first actual death/drop requests XP tutorial',dropped.pickups!.droppedXP>0&&dropped.onboarding.hint?.kind==='xp',dropped.onboarding);dropObserved=true;}
   const orb=dropped.pickups!.orbs[0];check('death has actual XP orb',!!orb,dropped.pickups);position(a.cat,orb.x,orb.y);step(2);
   const picked=battle.snapshot();check('native overlap collected real XP '+kill,picked.pickups!.collectedXP>0,picked.pickups);pickObserved=true;
   if(!picked.progression?.offer)position(a.cat,360,720);
  }
  const offer=battle.snapshot().progression!.offer!;check('actual pickup opens real upgrade tutorial',dropObserved&&pickObserved&&!!offer&&battle.snapshot().onboarding.hint?.kind==='upgrade',battle.snapshot().onboarding);
  const offered=battle.snapshot();(battle as any).dismissOnboarding();a.observeOnboarding();check('child dismissal preserves actual offer and cannot replay the same tutorial',battle.snapshot().onboarding.hint===null&&JSON.stringify(battle.snapshot().progression)===JSON.stringify(offered.progression),battle.snapshot().onboarding);
  const before=battle.snapshot().progression!,id=offer.choices[0];check('real controller confirms offered card',battle.confirmUpgrade(before.runId,offer.id,id));g.loop.sleep();step(2);
  const confirmed=battle.snapshot();check('only committed pick completes upgrade tutorial',confirmed.onboarding.completed.upgrade&&confirmed.progression!.confirmedPicks===1&&confirmed.onboarding.hint?.kind!=='upgrade',confirmed.onboarding);
  check('real XP conserved through tutorial',confirmed.pickups!.droppedXP===confirmed.pickups!.collectedXP+confirmed.pickups!.groundXP,confirmed.pickups);
  return {status:'PASS',checks,scope:'CONTROLLED_ACTUAL_ARENA_NOT_NATURAL_BALANCE_OR_FPS'};
 }catch(error){return {status:'FAIL',error:String(error),checks};}
 };
 w.g5OpeningReady=true;
}
void boot().catch(error=>w.g5OpeningBootError=String(error));
