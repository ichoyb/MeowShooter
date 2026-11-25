import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import {courtyardRunConfig} from '../src/level-config';
import {Session} from '../src/rules';
import {CatPassives} from '../src/cat-passives';
import {WeaponBursts} from '../src/weapon-bursts';
import type {GrowthRanks} from '../src/progression';

const aim={x:1,y:0};
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const hot:GrowthRanks&{M12:number}={...zero,M12:1};
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const run=(cat='CAT01',weapon='W01'):RunConfig=>Object.freeze({...courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),projectileFlight:Object.freeze({enabled:true})});
const state=(s:Session)=>s.snapshot() as ReturnType<Session['snapshot']>&{hotStartRemaining:number;hotStartEnabled:boolean};
function drain(s:Session):void {
  while(s.ammo>0)assert.ok(s.step(s.snapshot().cooldown,aim));
  assert.ok(s.reloadLeft>0);
}
function finishReload(s:Session):void {
  const before=s.reloadCompletions;
  s.advance(s.reloadLeft);
  assert.equal(s.reloadCompletions,before+1);
  assert.equal(s.reloadLeft,0);
  assert.equal(s.ammo,s.effectiveConfig.weapon.ammoCapacity);
}

test('a real reload makes exactly two following root volleys establish a 0.60s cooldown',()=>{
  const s=new Session(run());s.applyGrowth(hot);drain(s);
  assert.equal(s.reloadCompletions,0);
  const last=s.shots;
  assert.equal(s.step(s.reloadLeft-.01,aim),null);
  assert.equal(s.shots,last);
  assert.equal(s.step(.01,aim)?.id,last+1);
  near(s.snapshot().cooldown,.6);
  assert.equal(state(s).hotStartRemaining,1);
  assert.equal(s.step(.59,aim),null);
  assert.equal(s.step(.01,aim)?.id,last+2);
  near(s.snapshot().cooldown,.6);
  assert.equal(state(s).hotStartRemaining,0);
  assert.equal(s.step(.59,aim),null);
  assert.equal(s.step(.01,aim)?.id,last+3);
  near(s.snapshot().cooldown,.8);
});

test('forged M12 ranks without the playtest flag cannot change an actual reload or shot',()=>{
  const {projectileFlight:_,...off}=run();
  const s=new Session(off);s.applyGrowth(hot);drain(s);finishReload(s);
  assert.ok(s.step(0,aim));near(s.snapshot().cooldown,.8);
  assert.equal(state(s).hotStartEnabled,false);
  assert.equal(state(s).hotStartRemaining,0);
});

test('selection never credits the opening magazine or a reload already completed before selection',()=>{
  const opening=new Session(run());opening.applyGrowth(hot);
  assert.ok(opening.step(0,aim));near(opening.snapshot().cooldown,.8);
  assert.equal(state(opening).hotStartRemaining,0);
  const s=new Session(run());drain(s);finishReload(s);
  assert.equal(s.reloadCompletions,1);
  s.applyGrowth(hot);assert.ok(s.step(0,aim));near(s.snapshot().cooldown,.8);
  assert.equal(state(s).hotStartRemaining,0);
  drain(s);finishReload(s);assert.ok(s.step(0,aim));near(s.snapshot().cooldown,.6);
});

test('M12 leaves an existing cooldown intact, including a cooldown longer than the reload',()=>{
  const base=run(),s=new Session({...base,weapon:{...base.weapon,ammoCapacity:1,intervalSeconds:2,reloadSeconds:.5}});
  assert.ok(s.step(0,aim));s.advance(.25);s.applyGrowth(hot);
  near(s.snapshot().cooldown,1.75);near(s.reloadLeft,.25);
  finishReload(s);assert.equal(state(s).hotStartRemaining,2);
  assert.equal(s.step(1.49,aim),null);
  assert.equal(state(s).hotStartRemaining,2);
  assert.ok(s.step(.01,aim));near(s.snapshot().cooldown,1.5);
});

test('taking M12 during a reload credits its future real completion, never the selection itself',()=>{
  const s=new Session(run());drain(s);s.advance(.6);
  const before=s.snapshot();s.applyGrowth(hot);
  near(s.reloadLeft,before.reloadLeft);near(s.snapshot().cooldown,before.cooldown);
  assert.equal(s.reloadCompletions,0);assert.equal(state(s).hotStartRemaining,0);
  s.advance(s.reloadLeft-.01);assert.equal(state(s).hotStartRemaining,0);
  s.advance(.01);assert.equal(s.reloadCompletions,1);assert.equal(state(s).hotStartRemaining,2);
});

test('no target, lazy empty aim and invalid vectors preserve ready hot-start volleys',()=>{
  const s=new Session(run());s.applyGrowth(hot);drain(s);finishReload(s);
  const ready=state(s);
  for(const direction of [null,{x:0,y:0},{x:NaN,y:1},{x:Infinity,y:0}]){
    assert.equal(s.step(0,direction),null);
    assert.deepEqual(state(s),ready);
  }
  assert.equal(s.step(3,()=>null),null);
  assert.equal(state(s).hotStartRemaining,2);assert.equal(s.shots,ready.shots);assert.equal(s.ammo,ready.ammo);
  assert.ok(s.step(0,aim));assert.equal(state(s).hotStartRemaining,1);
});

for(const [cat,weapon,interval,short] of [['CAT01','W01',.8,.6],['CAT02','W04',1/1.2,.625],['CAT03','W02',1/1.5,.5]] as const){
  test(`${weapon} preserves its native cadence and consumes one hot-start charge per root volley`,()=>{
    const config=run(cat,weapon),s=new Session(config);s.applyGrowth(hot);
    assert.ok(s.step(0,aim));near(s.snapshot().cooldown,interval);
    assert.equal(s.ammo,config.weapon.ammoCapacity-1);
    drain(s);finishReload(s);const ammo=s.ammo,shots=s.shots;
    assert.equal(state(s).hotStartRemaining,2);
    assert.ok(s.step(0,aim));near(s.snapshot().cooldown,short);
    assert.equal(s.ammo,ammo-1);assert.equal(s.shots,shots+1);assert.equal(state(s).hotStartRemaining,1);
    assert.equal(s.effectiveConfig.weapon.pellets,config.weapon.pellets);
    assert.equal(s.step(short-.01,aim),null);
    assert.ok(s.step(.01,aim));near(s.snapshot().cooldown,short);
    assert.equal(state(s).hotStartRemaining,0);
    assert.ok(s.step(short,aim));near(s.snapshot().cooldown,interval);
  });
}

test('growth keeps both ordinary and hot-start cooldown completion ratios without refreshing the budget',()=>{
  const s=new Session(run());s.applyGrowth(hot);assert.ok(s.step(0,aim));s.advance(.2);
  s.applyGrowth({...hot,L1_RATE:1});near(s.snapshot().cooldown,.6/1.15);
  assert.equal(state(s).hotStartRemaining,0);
  drain(s);finishReload(s);assert.ok(s.step(0,aim));s.advance(.1);
  const before=s.snapshot().cooldown;
  s.applyGrowth({...hot,L1_RATE:2,L1_DAMAGE:1});near(s.snapshot().cooldown,before*1.15/1.3);
  assert.equal(state(s).hotStartRemaining,1);
  s.advance(s.snapshot().cooldown);assert.ok(s.step(0,aim));near(s.snapshot().cooldown,.6/1.3);
  assert.equal(state(s).hotStartRemaining,0);
});

test('reload attributes keep the current reload proportion and hot start never supplies ammunition early',()=>{
  const s=new Session(run());drain(s);s.advance(.6);
  s.applyGrowth({...hot,L1_RELOAD:1});near(s.reloadLeft,1.8/1.2);
  assert.equal(s.ammo,0);assert.equal(s.reloadCompletions,0);assert.equal(state(s).hotStartRemaining,0);
  assert.equal(s.step(s.reloadLeft-.01,aim),null);assert.equal(s.ammo,0);
  assert.ok(s.step(.01,aim));assert.equal(s.reloadCompletions,1);
  near(s.snapshot().cooldown,.6);assert.equal(state(s).hotStartRemaining,1);
});

for(const reason of ['menu','upgrade','background','inputLost'] as const){
  test(`${reason} freezes both active hot-start budget and the reload that will grant it`,()=>{
    const s=new Session(run());s.applyGrowth(hot);drain(s);s.advance(.4);s.pause(reason);
    const waiting=state(s);s.advance(20);assert.equal(s.step(20,aim),null);assert.deepEqual(state(s),waiting);
    s.resume();s.finishUpgrade();finishReload(s);assert.ok(s.step(0,aim));s.advance(.2);s.pause(reason);
    const active=state(s);s.advance(20);assert.equal(s.step(20,aim),null);assert.deepEqual(state(s),active);
    s.resume();s.finishUpgrade();assert.equal(s.step(.39,aim),null);assert.ok(s.step(.01,aim));
    assert.equal(state(s).hotStartRemaining,0);
  });
}

test('each new real reload resets two charges and a final round always starts a full reload',()=>{
  const base=run(),s=new Session({...base,weapon:{...base.weapon,ammoCapacity:1}});s.applyGrowth(hot);
  assert.ok(s.step(0,aim));near(s.reloadLeft,2.4);finishReload(s);
  for(let reloads=2;reloads<=4;reloads++){
    assert.equal(state(s).hotStartRemaining,2);assert.ok(s.step(0,aim));
    assert.equal(s.ammo,0);near(s.reloadLeft,2.4);near(s.snapshot().cooldown,.6);
    assert.equal(state(s).hotStartRemaining,1);finishReload(s);
    assert.equal(s.reloadCompletions,reloads);assert.equal(state(s).hotStartRemaining,2);
    s.advance(1);assert.equal(state(s).hotStartRemaining,2);assert.equal(s.reloadCompletions,reloads);
  }
});

test('light magazines, cadence secondaries and orange-cat passives share unchanged real root facts',()=>{
  const config=run(),ranks={...hot,L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1},controlRanks={...ranks,M12:0};
  const hotSession=new Session(config),control=new Session(config),passives=[new CatPassives(config),new CatPassives(config)],bursts=[new WeaponBursts(),new WeaponBursts()];
  hotSession.applyGrowth(ranks);control.applyGrowth(controlRanks);
  assert.deepEqual(hotSession.effectiveConfig,control.effectiveConfig);
  const emit=(delta:number)=>{
    const sessions=[hotSession,control],emissions=sessions.map((s,i)=>{
      const volley=s.step(delta,aim);assert.ok(volley);
      const opening=passives[i].onVolley(volley.id,s.reloadCompletions);
      return bursts[i].onVolley(s.effectiveConfig,i?controlRanks:ranks,{id:volley.id,ammo:s.ammo,reloads:s.reloadCompletions,opening});
    });
    assert.deepEqual(emissions[0],emissions[1]);
    assert.deepEqual(passives[0].snapshot(),passives[1].snapshot());
    assert.deepEqual(bursts[0].snapshot(),bursts[1].snapshot());
    assert.equal(hotSession.elapsed,control.elapsed);assert.equal(hotSession.ammo,control.ammo);
    assert.equal(hotSession.shots,control.shots);assert.equal(hotSession.reloadCompletions,control.reloadCompletions);
  };
  emit(0);for(let i=1;i<6;i++)emit(.8);
  emit(hotSession.reloadLeft);assert.equal(hotSession.reloadCompletions,1);
  assert.equal(state(hotSession).hotStartRemaining,1);assert.equal(bursts[0].snapshot().cadenceRemaining,2);
  emit(.8);assert.equal(state(hotSession).hotStartRemaining,0);assert.equal(bursts[0].snapshot().cadenceRemaining,1);
  emit(.8);assert.equal(bursts[0].snapshot().cadenceRemaining,0);
});

for(const ending of ['damage','step-death','timeout','survived','cleared'] as const){
  test(`${ending} clears pending hot start and the next Session keeps only its frozen configuration`,()=>{
    const config=ending==='survived'?{...run(),endCondition:'duration' as const}:run();
    const s=new Session(config);s.applyGrowth(hot);drain(s);finishReload(s);
    assert.equal(state(s).hotStartRemaining,2);assert.equal(state(s).hotStartEnabled,true);
    if(ending==='damage')s.damage(s.hp);
    else if(ending==='step-death'){s.hp=0;s.step(0,aim);}
    else if(ending==='cleared')s.completeBoss();
    else s.step(config.durationSeconds-s.elapsed,aim);
    assert.equal(s.result,ending==='damage'||ending==='step-death'?'death':ending==='timeout'?'timeout':ending==='survived'?'survived':'cleared');
    assert.equal(state(s).hotStartRemaining,0);assert.equal(state(s).hotStartEnabled,false);
    const final=state(s);s.applyGrowth(hot);s.advance(20);assert.equal(s.step(20,aim),null);assert.deepEqual(state(s),final);
    const restart=new Session(s.runConfig);assert.equal(restart.runConfig,config);
    assert.equal(state(restart).hotStartRemaining,0);assert.equal(state(restart).hotStartEnabled,false);
    drain(restart);finishReload(restart);assert.ok(restart.step(0,aim));near(restart.snapshot().cooldown,.8);
  });
}
