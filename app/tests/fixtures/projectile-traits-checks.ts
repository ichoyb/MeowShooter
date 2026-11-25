import {createTraitFixture} from './projectile-traits-sample';
import {growthCardEligible,GROWTH_CARDS} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const f=await createTraitFixture(document.getElementById('stage')!),{a,g,battle}=f;
 const wake=g.loop.wake.bind(g.loop);g.loop.sleep();let now=0;
 const step=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;g.scene.update(now,1000/60);g.scene.processQueue();}};
 const start=(cat:CatId='CAT01',enabled=true)=>{g.loop.wake=()=>{};battle.start(f.config(cat,enabled));g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();step();a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};};
 const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
 const target=(x:number,y:number)=>{const e=a.placeSliceEnemy('E01',x,y);e.setData('hp',1000);e.body.moves=false;return e;};
 const active=()=>a.projectiles.getChildren().filter((s:any)=>s.active&&s.body.enable);
 const emit=(source='PRIMARY',damage=12,pierce=0,angle=0)=>{a.projectile({x:360,y:600},angle,'bell',source,1234,damage,pierce,600,2);const list=active();return list[list.length-1];};
 w.runProjectileTraitsChecks=async()=>{
  const checks:any[]=[],check=(name:string,pass:unknown,value?:any)=>{checks.push({name,pass:!!pass,value:value===undefined?undefined:JSON.parse(JSON.stringify(value))});if(!pass)throw Error(name);};
  const close=(x:number,y:number)=>Math.abs(x-y)<1e-7,fireVolley=a.fireVolley;
  try{
   const ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
   start('CAT01',false);check('normal default keeps20-entry catalog and no trait switch',GROWTH_CARDS.filter(c=>!['A11','A12','M06','C23','M31','E21','A15','M05','M09','C18','M26','M12','E23'].includes(c.id)).length===20&&!battle.snapshot().projectileTraits.enabled&&['A11','A12','M06','C23','M31','E21'].every(id=>!growthCardEligible(id as any,ranks,f.session!.runConfig)),battle.snapshot().projectileTraits);
   start();check('31definitions with26normal trait entries makes A11 A12 and post-split M06 legal',GROWTH_CARDS.length===33&&battle.snapshot().projectileTraits.enabled&&growthCardEligible('A11',ranks,f.session!.runConfig)&&growthCardEligible('A12',ranks,f.session!.runConfig)&&!growthCardEligible('M06',ranks,f.session!.runConfig)&&growthCardEligible('M06',{...ranks,L1_SPLIT:1},f.session!.runConfig),{legal:GROWTH_CARDS.filter(c=>growthCardEligible(c.id,ranks,f.session!.runConfig)).map(c=>c.id),all:GROWTH_CARDS.length});
   check('legacy candidate pool20 and traits pool26 exclude independently gated flight and hunt definitions',GROWTH_CARDS.length===33&&['A11','A12','M06','C23','M31','E21'].every(id=>!growthCardEligible(id as any,ranks,f.config('CAT03',false))),GROWTH_CARDS.map(c=>c.id));
   start('CAT03');check('native scatter M06 is legal without another core',growthCardEligible('M06',ranks,f.session!.runConfig));
   start();f.install({A11:6});check('A11 caps60percent and disappears',close(battle.snapshot().projectileTraits.criticalChance,.6)&&!growthCardEligible('A11',a.growth.snapshot().ranks,f.session!.runConfig),battle.snapshot().projectileTraits);
   start();a.projectileRandom.frac=()=>.049999;let shot=emit(),e=target(410,600);a.hit(shot,e,'overlap');check('rng below5percent primary12 becomes18',close(1000-e.getData('hp'),18)&&battle.snapshot().projectileTraits.rolls===1,battle.snapshot().projectileTraits);
   start();a.projectileRandom.frac=()=>.05;shot=emit();e=target(410,600);a.hit(shot,e,'overlap');check('rng equals5percent primary stays12',close(1000-e.getData('hp'),12)&&battle.snapshot().projectileTraits.criticalRolls===0,battle.snapshot().projectileTraits);
   start();f.install({A12:1});a.projectileRandom.frac=()=>0;shot=emit();e=target(410,600);a.hit(shot,e,'overlap');check('one A12 critical12 becomes30',close(1000-e.getData('hp'),30));
   start();let candidates=0;a.growth.random=()=>{candidates++;return .2;};a.projectileRandom.frac=()=>0;
   for(const source of ['SECONDARY','SUMMON']){shot=emit(source,6);e=target(410,600);a.hit(shot,e,'overlap');check(source+' neither rolls nor crits',close(1000-e.getData('hp'),6)&&battle.snapshot().projectileTraits.rolls===0,battle.snapshot().projectileTraits);}
   emit();check('projectile random does not consume candidate random',candidates===0&&battle.snapshot().projectileTraits.rolls===1,{candidates,traits:battle.snapshot().projectileTraits});
   start('CAT03');let rolls=0;a.projectileRandom.frac=()=>[0,.1,0,.1,0][rolls++]!;a.fire({x:1,y:0,id:5});
   check('native five scatter pellets roll once each independently',rolls===5&&battle.snapshot().projectileTraits.criticalRolls===3&&active().map((s:any)=>s.getData('critical')).join(',')==='true,false,true,false,true',battle.snapshot().projectileTraits);
   // Real native physics sweep, with a fixed generated result retained through
   // three target entries. No fixture collision solver or movement integration.
   start();a.fireVolley=()=>{};a.projectileRandom.frac=()=>0;position(a.cat,360,800);
   const line=[target(390,600),target(425,600),target(460,600)];emit('PRIMARY',12,2);step(18);
   check('native swept pierce retains18 12.6 8.82 from one roll',line.every((t:any,i:number)=>close(1000-t.getData('hp'),[18,12.6,8.82][i]!))&&battle.snapshot().projectileTraits.rolls===1,{damage:line.map((t:any)=>1000-t.getData('hp')),traits:battle.snapshot().projectileTraits});a.fireVolley=fireVolley;
   start();f.install({L1_SPLIT:1,L1_SHOCK_BELL:1});a.projectileRandom.frac=()=>0;e=target(410,600);const nearby=target(425,600);a.physics.world.step(0);shot=emit();a.hit(shot,e,'overlap');
   check('shock uses actual critical18 times35percent exactly once',close(1000-e.getData('hp'),18)&&close(1000-nearby.getData('hp'),6.3),{direct:1000-e.getData('hp'),shock:1000-nearby.getData('hp')});
   start();f.install({L1_SPLIT:1,L1_RICOCHET:1});a.projectileRandom.frac=()=>0;e=target(410,600);const bounced=target(450,600);a.physics.world.step(0);shot=emit();a.hit(shot,e,'overlap');a.hit(shot,bounced,'overlap');
   check('ricochet retains crit once 18 then10.8 with one roll',close(1000-e.getData('hp'),18)&&close(1000-bounced.getData('hp'),10.8)&&battle.snapshot().projectileTraits.rolls===1,{first:1000-e.getData('hp'),ricochet:1000-bounced.getData('hp')});
   start('CAT03');const original=f.session!.effectiveConfig.weapon;f.install({M06:1});const focused=f.session!.effectiveConfig.weapon;a.projectileRandom.frac=()=>.9;a.fire({x:1,y:0,id:8});
   const angles=active().map((s:any)=>s.rotation*180/Math.PI);
   check('M06 native36 becomes9 without pellet damage ammo changes',original.spreadDegrees===36&&focused.spreadDegrees===9&&focused.pellets===original.pellets&&focused.damage===original.damage&&focused.ammoCapacity===original.ammoCapacity&&close(Math.max(...angles)-Math.min(...angles),9),{original,focused,angles});
   start();f.install({L1_SPLIT:1,M06:1});check('split total8 degrees becomes2 after M06',f.session!.effectiveConfig.weapon.spreadDegrees===2&&f.session!.effectiveConfig.weapon.pellets===2,f.session!.effectiveConfig.weapon);
   start();a.projectileRandom.frac=()=>0;const old=emit();a.growth.collect(8);step();a.growth.offer.choices=['A12'];
   const offer=battle.snapshot().progression!;g.loop.wake=()=>{};const confirmed=battle.confirmUpgrade(offer.runId,offer.offer!.id,'A12');g.loop.wake=wake;g.loop.sleep();g.scene.processQueue();
   e=target(410,600);a.hit(old,e,'overlap');shot=emit();const newer=target(450,600);a.hit(shot,newer,'overlap');
   check('actual A12 confirmation preserves old1.5 and new2.5',confirmed&&close(1000-e.getData('hp'),18)&&close(1000-newer.getData('hp'),30),{confirmed,old:1000-e.getData('hp'),new:1000-newer.getData('hp'),growth:battle.snapshot().progression});
   check('real critical feedback is golden22px exclamation and records exact damage',battle.snapshot().feedback!.numberDetails.some(n=>n.critical&&n.text==='30!'&&n.color==='#f4c95d'&&n.fontSize==='22px'),battle.snapshot().feedback);
   a.projectileRandom.frac=()=>.9;shot=emit();e=target(490,600);a.hit(shot,e,'overlap');check('pooled ordinary feedback restores16px and original color',battle.snapshot().feedback!.numberDetails.some(n=>!n.critical&&n.text==='12'&&n.color==='#fff8da'&&n.fontSize==='16px'),battle.snapshot().feedback);
   start();a.projectileRandom.frac=()=>0;shot=emit();a.recycle(shot,a.projectiles);a.projectileRandom.frac=()=>.9;const reused=emit('SECONDARY',9);e=target(410,600);a.hit(reused,e,'overlap');
   check('native Group reuse clears critical state and damage',shot===reused&&close(1000-e.getData('hp'),9)&&battle.snapshot().projectileTraits.rolls===1,{reused:shot===reused,hp:e.getData('hp'),traits:battle.snapshot().projectileTraits});
   start();a.fireVolley=()=>{};emit();step(122);check('native Clock expiration releases trait-bearing shots and bell references',active().length===0&&battle.snapshot().bellModifiers.activeVolleys===0,{traits:battle.snapshot().projectileTraits,bells:battle.snapshot().bellModifiers});a.fireVolley=fireVolley;
   for(let i=0;i<20;i++){start(i%2?'CAT03':'CAT01',i%3!==0);const s=battle.snapshot();check('restart'+i+' resets growth projectiles rolls and crit data',s.projectiles===0&&s.projectileTraits.rolls===0&&s.projectileTraits.criticalRolls===0&&s.projectileTraits.criticalHits===0&&!s.progression!.ranks.A11&&!s.progression!.ranks.A12&&!s.progression!.ranks.M06,s.projectileTraits);}
   start();const before=battle.snapshot().elapsed;battle.pause('menu');step(30);battle.setPresentation({quality:'low'});step(30);check('pause and low quality retain native time freeze',battle.snapshot().elapsed===before&&battle.snapshot().engine.paused,battle.snapshot().engine);battle.resume();g.loop.sleep();step(2);check('explicit continue resumes native time',battle.snapshot().elapsed>before,battle.snapshot().elapsed);
   const s=battle.snapshot(),scenery=s.scenery;
   check('orange36u and native B source ledger protected',s.presentation?.bodyDisplay.width===36&&s.imageBudget.mode==='advisory'&&s.imageBudget.sourceRGBA===9117384&&s.imageBudget.sources.length===12&&!!scenery&&'sourceSize' in scenery&&scenery.visualRevision==='courtyard-continuous-native-v01'&&scenery.sourceSize.width===887&&scenery.sourceSize.height===1774&&scenery.mapCache.persistentRGBAEstimate===0,{presentation:s.presentation,imageBudget:s.imageBudget,scenery});
   start();a.fireVolley=()=>{};position(a.cat,360,600);target(360,600);const hp=f.session!.hp;step(2);check('actual contact damage still reduces real life',f.session!.hp<hp,{before:hp,after:f.session!.hp});a.fireVolley=fireVolley;
   return {status:'PASS',scope:'ACTUAL_SCENE_CONTROLLED_PRESET_NOT_NATURAL_GROWTH',checks};
  }catch(error){return {status:'FAIL',error:String(error),checks};}finally{a.fireVolley=fireVolley;}
 };
 w.traitsChecksFixture={...f,start,step};w.traitsChecksReady=true;
}
void boot().catch(e=>w.traitsChecksBootError=String(e));
