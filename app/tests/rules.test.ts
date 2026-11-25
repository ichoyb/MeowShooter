import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatCadence, Session, chooseTarget } from '../src/rules';
import { makeRunConfig } from '../src/combat-config';
const aim = { x: 1, y: 0 };
test('advance exposes the sole effective timestamp while survival waits for same-frame damage settlement', () => {
  const s = new Session(); s.elapsed = 119.99; s.hp = 1;
  s.advance(.01); assert.equal(s.elapsed, 120); assert.equal(s.result, null); assert.equal(s.shots, 0);
  s.damage(10); assert.equal(s.step(0, aim), null); assert.equal(s.hp, 0); assert.equal(s.result, 'death');
});
test('advance permits nonlethal boundary damage before survival and no boundary emission', () => {
  const s = new Session(); s.elapsed = 119.99; s.hp = 11;
  s.advance(.01); s.damage(10); assert.equal(s.result, null); assert.equal(s.step(0, aim), null);
  assert.equal(s.hp, 1); assert.equal(s.result, 'survived'); assert.equal(s.shots, 0);
});
test('advance and final step share reload/cooldown time once and remain frozen while paused', () => {
  const s = new Session(); s.step(0, aim); s.step(.5, aim); s.step(.5, aim);
  s.pause('menu'); const paused = s.snapshot(); s.advance(30); assert.deepEqual(s.snapshot(), paused);
  s.resume(); s.advance(.5); assert.equal(s.elapsed, 1.5); assert.equal(s.reloadLeft, .5); assert.equal(s.step(0, aim), null);
  s.advance(.5); assert.equal(s.elapsed, 2); assert.equal(s.reloadCompletions, 1); assert.equal(s.step(0, aim)?.id, 4); assert.equal(s.elapsed, 2);
});
const enemy = (id: number, x: number, y: number) => ({ id, x, y, alive: true, kind: 'enemy' as const });
test('3 rounds at t=0/.5/1, auto reload, fourth shot not before t=2', () => {
  const s = new Session(); assert.equal(s.step(0, aim)?.id, 1);
  assert.equal(s.step(.49, aim), null); assert.equal(s.step(.01, aim)?.id, 2);
  assert.equal(s.step(.5, aim)?.id, 3); assert.equal(s.ammo, 0); assert.equal(s.reloadLeft, 1);
  assert.equal(s.step(.99, aim), null); assert.equal(s.step(.01, aim)?.id, 4);
});
test('no target stops fire without refilling a partial magazine', () => {
  const s = new Session(); s.step(0, aim); assert.equal(s.step(1, null), null); assert.equal(s.ammo, 2); assert.equal(s.reloadLeft, 0);
});
test('switching aim shares cooldown and ammo', () => {
  const s = new Session(); s.step(0, aim); assert.equal(s.step(.1, {x:0,y:1}), null); assert.equal(s.ammo,2); assert.equal(s.step(.4,{x:0,y:1})?.y,1);
});
test('pause freezes effective time, reload and cooldown; resume has no backlog', () => {
  const s=new Session(); s.step(0,aim); s.step(.5,aim); s.step(.5,aim); s.pause('menu');
  const before=JSON.stringify(s.snapshot()); assert.equal(s.step(10,aim),null); assert.equal(JSON.stringify(s.snapshot()),before);
  s.resume(); assert.equal(s.step(0,aim),null); assert.equal(s.reloadLeft,1);
});
test('upgrade reason survives explicit resume until upgrade completed', () => {
  const s=new Session(); s.pause('upgrade'); s.pause('background'); s.resume(); assert.equal(s.isPaused,true); assert.deepEqual(s.reasons,['upgrade']); s.finishUpgrade(); assert.equal(s.isPaused,false);
});
test('input interruption waits for explicit continue', () => {
  const s=new Session(); s.pause('inputLost'); assert.equal(s.step(3,aim),null); assert.equal(s.elapsed,0); s.resume(); assert.equal(s.step(0,aim)?.id,1);
});
test('each choice switches from a farther current target to the nearest living enemy', () => {
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,90,0),enemy(2,10,0)],1)?.id,2);
  assert.equal(chooseTarget({x:85,y:0},[enemy(1,90,0),enemy(2,10,0)],2)?.id,1);
});
test('enemy priority wins over a nearer object then falls back when the enemy dies or leaves range', () => {
  const targets=[enemy(1,900,0),{...enemy(2,2,0),kind:'object' as const},enemy(3,80,0)];
  assert.equal(chooseTarget({x:0,y:0},targets,2)?.id,3);
  targets[2].alive=false;
  assert.equal(chooseTarget({x:0,y:0},targets,3)?.id,2);
  targets[2].alive=true;
  targets[2].x=241;
  assert.equal(chooseTarget({x:0,y:0},targets,3)?.id,2);
});
test('distance ties preserve current target then choose minimum ID independently of array order', () => {
  assert.equal(chooseTarget({x:0,y:0},[enemy(9,10,0),enemy(2,-10,0)],9)?.id,9);
  assert.equal(chooseTarget({x:0,y:0},[enemy(2,-10,0),enemy(9,10,0)],9)?.id,9);
  assert.equal(chooseTarget({x:0,y:0},[enemy(9,10,0),enemy(2,-10,0)],null)?.id,2);
  assert.equal(chooseTarget({x:0,y:0},[enemy(2,-10,0),enemy(9,10,0)],null)?.id,2);
  assert.equal(chooseTarget({x:0,y:0},[enemy(9,10,0),enemy(2,-10,0)],100)?.id,2);
});
test('nearest objects use the same current target and minimum ID tie rules', () => {
  const objects=[{...enemy(9,10,0),kind:'object' as const},{...enemy(2,-10,0),kind:'object' as const}];
  assert.equal(chooseTarget({x:0,y:0},objects,9)?.id,9);
  assert.equal(chooseTarget({x:0,y:0},objects,null)?.id,2);
  objects[0].x=20;
  assert.equal(chooseTarget({x:0,y:0},objects,9)?.id,2);
});
test('target range includes exactly 240 units and excludes positions beyond it', () => {
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,240,0)],null)?.id,1);
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,0,-240)],null)?.id,1);
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,240.01,0)],1),null);
  assert.equal(chooseTarget({x:0,y:0},[{...enemy(2,240,0),kind:'object' as const}],null)?.id,2);
});
test('configured attack range controls enemy eligibility and idle-object fallback', () => {
  const object = {...enemy(2,80,0),kind:'object' as const};
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,100,0),object],1,90)?.id,2);
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,260,0)],null,260)?.id,1);
  assert.equal(chooseTarget({x:0,y:0},[enemy(1,260.01,0)],1,260),null);
});
test('dead or non-finite positions cannot win nearest selection or block valid objects', () => {
  const targets=[{...enemy(1,0,0),alive:false},enemy(2,NaN,0),enemy(3,0,Infinity),enemy(4,-Infinity,0),{...enemy(5,20,0),kind:'object' as const}];
  assert.equal(chooseTarget({x:0,y:0},targets,2)?.id,5);
  assert.equal(chooseTarget({x:NaN,y:0},[enemy(1,10,0)],null),null);
  assert.equal(chooseTarget({x:0,y:Infinity},[enemy(1,10,0)],1),null);
  targets[4].alive=false;
  assert.equal(chooseTarget({x:0,y:0},targets,2),null);
});
test('no targets returns null while a target at the origin remains selectable', () => {
  assert.equal(chooseTarget({x:0,y:0},[],null),null);
  assert.equal(chooseTarget({x:0,y:0},[enemy(4,0,0)],null)?.id,4);
});
test('lazy aim is resolved only after cooldown advances and a shot is ready', () => {
  const s=new Session();
  s.step(0,aim);
  let calls=0;
  const provideAim=()=>{ calls++; assert.ok((s.snapshot() as {cooldown:number}).cooldown<=1e-8); assert.equal(s.elapsed,.5); return {x:0,y:1}; };
  assert.equal(s.step(.49,provideAim),null);
  assert.equal(calls,0);
  assert.deepEqual(s.step(.01,provideAim),{id:2,x:0,y:1});
  assert.equal(calls,1);
});
test('lazy aim waits for reload completion before resolving the next direction', () => {
  const s=new Session();
  s.step(0,aim); s.step(.5,aim); s.step(.5,aim);
  let calls=0;
  const provideAim=()=>{ calls++; assert.equal(s.ammo,3); assert.equal(s.reloadLeft,0); return {x:-1,y:0}; };
  assert.equal(s.step(.99,provideAim),null);
  assert.equal(calls,0);
  assert.deepEqual(s.step(.01,provideAim),{id:4,x:-1,y:0});
  assert.equal(calls,1);
});
test('actual firing chooses the current nearest target instead of a direction sampled during cooldown', () => {
  const s=new Session();
  const targets=[enemy(1,10,0),enemy(2,0,80)];
  let current: number|null=null;
  let calls=0;
  const provideAim=()=>{ calls++; const target=chooseTarget({x:0,y:0},targets,current); current=target?.id??null; return target?{x:target.x,y:target.y}:null; };
  assert.equal(s.step(0,provideAim)?.x,1);
  assert.equal(current,1);
  targets[0].x=100;
  assert.equal(s.step(.25,provideAim),null);
  assert.equal(calls,1);
  assert.equal(s.step(.25,provideAim)?.y,1);
  assert.equal(current,2);
  assert.equal(calls,2);
});
test('paused or settled sessions never invoke lazy aim', () => {
  const s=new Session();
  let calls=0;
  const provideAim=()=>{ calls++; return aim; };
  s.pause('menu');
  assert.equal(s.step(3,provideAim),null);
  assert.equal(calls,0);
  s.resume();
  assert.equal(s.step(120,provideAim),null);
  assert.equal(s.step(1,provideAim),null);
  assert.equal(calls,0);
});
test('lazy no-target result preserves ammo and checks again when another frame is ready', () => {
  const s=new Session();
  let target: {x:number;y:number}|null=null;
  let calls=0;
  const provideAim=()=>{ calls++; return target; };
  assert.equal(s.step(0,provideAim),null);
  assert.equal(s.ammo,3);
  target=aim;
  assert.equal(s.step(0,provideAim)?.id,1);
  assert.equal(calls,2);
});
test('dropped frame does not emit multiple accumulated shots', () => {
  const s=new Session(); s.step(0,aim); s.step(10,aim); assert.equal(s.shots,2); assert.equal(s.ammo,1);
});
test('death precedes survival at 120 second boundary and settles once', () => {
  const s=new Session(); s.step(119.9,null); s.damage(100); s.step(.1,aim); assert.equal(s.result,'death'); assert.equal(s.shots,0); s.damage(1); assert.equal(s.result,'death');
});
test('120 second survival settles once, no shots after result', () => {
  const s=new Session(); s.step(120,aim); assert.equal(s.result,'survived'); assert.equal(s.shots,0); s.step(5,aim); assert.equal(s.elapsed,120);
});
test('paused damage is ignored and active damage clamps HP', () => {
  const s=new Session(); s.pause('menu'); s.damage(20); assert.equal(s.hp,100); s.resume(); s.damage(150); assert.equal(s.hp,0); assert.equal(s.result,'death');
});

test('combat cadence first spawns at two seconds and starts a fresh two second interval', () => {
  const s=new Session(), cadence=new CombatCadence();
  const step=(delta:number)=>{ const spawn=cadence.step(delta,s); s.step(delta,null); return spawn; };
  assert.equal(step(0),false);
  assert.equal(step(1.99),false);
  assert.equal(step(.01),true);
  assert.equal(step(0),false);
  assert.equal(step(1.99),false);
  assert.equal(step(.01),true);
  assert.equal(s.elapsed,4);
  assert.equal(s.ammo,3);
});

test('first enemy contact deals ten damage immediately and all enemies share the point seven second permit', () => {
  const s=new Session(), cadence=new CombatCadence();
  assert.equal(cadence.contact(s),true);
  assert.equal(s.hp,90);
  for (let enemy=0; enemy<3; enemy++) assert.equal(cadence.contact(s),false);
  assert.equal(s.hp,90);
  cadence.step(.69,s);
  assert.equal(cadence.contact(s),false);
  cadence.step(.01,s);
  assert.equal(cadence.contact(s),true);
  assert.equal(cadence.contact(s),false);
  assert.equal(s.hp,80);
});

test('each pause reason freezes spawn progress and the shared contact cooldown', () => {
  for (const reason of ['menu','upgrade','background','inputLost'] as const) {
    const s=new Session(), cadence=new CombatCadence();
    assert.equal(cadence.step(1.2,s),false);
    assert.equal(cadence.contact(s),true);
    assert.equal(cadence.step(.2,s),false);
    s.pause(reason);
    assert.equal(cadence.step(50,s),false);
    assert.equal(cadence.contact(s),false);
    assert.equal(s.hp,90);
    s.resume(); s.finishUpgrade();
    assert.equal(cadence.contact(s),false);
    assert.equal(cadence.step(.49,s),false);
    assert.equal(cadence.contact(s),false);
    assert.equal(cadence.step(.01,s),false);
    assert.equal(cadence.contact(s),true);
    assert.equal(cadence.step(.1,s),true);
    assert.equal(s.hp,80);
  }
});

test('paused contact does not consume the initial immediate contact permit', () => {
  const s=new Session(), cadence=new CombatCadence();
  s.pause('menu');
  assert.equal(cadence.contact(s),false);
  assert.equal(cadence.step(10,s),false);
  s.resume();
  assert.equal(cadence.contact(s),true);
  assert.equal(s.hp,90);
  assert.equal(cadence.step(1.99,s),false);
  assert.equal(cadence.step(.01,s),true);
});

test('death and survival both stop spawn permits and contact damage', () => {
  for (const result of ['death','survived'] as const) {
    const s=new Session(), cadence=new CombatCadence();
    cadence.step(1.99,s);
    if (result==='death') s.damage(100); else s.step(120,null);
    const hp=s.hp;
    assert.equal(cadence.step(10,s),false);
    assert.equal(cadence.contact(s),false);
    assert.equal(s.hp,hp);
    assert.equal(s.result,result);
  }
});

test('long frames offer only one spawn and contact without catching up later frames', () => {
  const s=new Session(), cadence=new CombatCadence();
  cadence.contact(s);
  assert.equal(cadence.step(10,s),true);
  assert.equal(cadence.contact(s),true);
  assert.equal(cadence.contact(s),false);
  assert.equal(cadence.step(0,s),false);
  assert.equal(cadence.contact(s),false);
  assert.equal(cadence.step(.69,s),false);
  assert.equal(cadence.contact(s),false);
  assert.equal(cadence.step(.01,s),false);
  assert.equal(cadence.contact(s),true);
  assert.equal(cadence.step(1.29,s),false);
  assert.equal(cadence.step(.01,s),true);
  assert.equal(s.hp,70);
});

test('reset begins a new full spawn interval and restores immediate contact', () => {
  const previous=new Session(), cadence=new CombatCadence();
  cadence.step(1.99,previous); cadence.contact(previous);
  cadence.reset();
  const next=new Session();
  assert.equal(cadence.step(0,next),false);
  assert.equal(cadence.contact(next),true);
  assert.equal(cadence.contact(next),false);
  assert.equal(next.hp,90);
  assert.equal(previous.hp,90);
  assert.equal(cadence.step(1.99,next),false);
  assert.equal(cadence.step(.01,next),true);
});

test('invalid or negative scene deltas do not advance combat cadence', () => {
  const s=new Session(), cadence=new CombatCadence();
  cadence.step(1.99,s); cadence.contact(s);
  for (const delta of [-1,NaN,Infinity,-Infinity]) {
    assert.equal(cadence.step(delta,s),false);
    assert.equal(cadence.contact(s),false);
  }
  assert.equal(cadence.step(.01,s),true);
  assert.equal(cadence.contact(s),false);
  cadence.step(.69,s);
  assert.equal(cadence.contact(s),true);
});

test('contact damage at the survival boundary still gives death priority', () => {
  const s=new Session(), cadence=new CombatCadence();
  s.step(119.9,null); s.damage(90);
  cadence.step(.1,s);
  assert.equal(cadence.contact(s),true);
  assert.equal(s.step(.1,aim),null);
  assert.equal(s.result,'death');
  assert.equal(s.hp,0);
});

test('P2 Session starts with the selected run HP and full magazine and records its identity', () => {
  const run=makeRunConfig('CAT03','W02','p2-basic'), s=new Session(run);
  assert.equal(s.hp,120); assert.equal(s.ammo,4);
  const snapshot=s.snapshot() as {maxHp:number;ammoCapacity:number;catId:string;weaponId:string;rulesVersion:string;reloadCompletions:number};
  assert.equal(snapshot.maxHp,120); assert.equal(snapshot.ammoCapacity,4);
  assert.equal(snapshot.catId,'CAT03'); assert.equal(snapshot.weaponId,'W02');
  assert.equal(snapshot.rulesVersion,'p2-basic-v1'); assert.equal(snapshot.reloadCompletions,0);
});

test('five-pellet spread consumes one round per salvo and reloads after four salvos', () => {
  const run=makeRunConfig('CAT03','W02','p2-basic'), s=new Session(run);
  assert.equal(s.step(0,aim)?.id,1); assert.equal(s.ammo,3);
  assert.equal(s.step(run.weapon.intervalSeconds-.01,aim),null); assert.equal(s.ammo,3);
  assert.equal(s.step(.01,aim)?.id,2);
  assert.equal(s.step(run.weapon.intervalSeconds,aim)?.id,3);
  assert.equal(s.step(run.weapon.intervalSeconds,aim)?.id,4);
  assert.equal(s.ammo,0); assert.equal(s.reloadLeft,1.6);
  assert.equal(s.step(1.59,aim),null);
  assert.equal(s.step(.01,aim)?.id,5); assert.equal(s.ammo,3);
});

test('P2 W01 interval and twelve round capacity drive its actual shot schedule', () => {
  const s=new Session(makeRunConfig('CAT01','W01','p2-basic'));
  assert.equal(s.step(0,aim)?.id,1); assert.equal(s.ammo,11);
  assert.equal(s.step(.24,aim),null); assert.equal(s.step(.01,aim)?.id,2);
  for(let i=3;i<=12;i++)assert.equal(s.step(.25,aim)?.id,i);
  assert.equal(s.ammo,0); assert.equal(s.reloadLeft,1.4);
  assert.equal(s.step(1.39,aim),null);
  assert.equal(s.step(.01,aim)?.id,13); assert.equal(s.ammo,11);
});

test('reload completion is counted once even without a target and survives every pause', () => {
  for(const reason of ['menu','upgrade','background','inputLost'] as const){
    const run=makeRunConfig('CAT02','W04','p2-basic'), s=new Session(run);
    s.step(0,aim); for(let i=1;i<4;i++)s.step(run.weapon.intervalSeconds,aim);
    assert.equal(s.reloadCompletions,0); s.step(.5,null); s.pause(reason);
    const before=JSON.stringify(s.snapshot()); s.step(50,aim);
    assert.equal(JSON.stringify(s.snapshot()),before);
    s.resume();s.finishUpgrade(); assert.equal(s.step(1.3,null),null);
    assert.equal(s.reloadCompletions,1); assert.equal(s.ammo,4);
    s.step(0,null); s.step(.2,null); assert.equal(s.reloadCompletions,1); assert.equal(s.ammo,4);
    assert.equal(s.step(0,aim)?.id,5); assert.equal(s.ammo,3);
    for(let i=0;i<3;i++)s.step(run.weapon.intervalSeconds,aim);
    assert.equal(s.ammo,0); assert.equal(s.reloadCompletions,1);
    s.step(run.weapon.reloadSeconds,null);
    assert.equal(s.ammo,4); assert.equal(s.reloadCompletions,2);
    assert.equal(s.snapshot().reloadCompletions,2);
  }
});

test('reload and firing cooldown overlap while the longer interval still blocks firing', () => {
  const base=makeRunConfig('CAT01','W01','diagnostic');
  const run={...base,weapon:{...base.weapon,ammoCapacity:1,intervalSeconds:2,reloadSeconds:.5}};
  const s=new Session(run); assert.equal(s.step(0,aim)?.id,1);
  assert.equal(s.step(.5,aim),null); assert.equal(s.reloadCompletions,1); assert.equal(s.ammo,1);
  assert.equal(s.step(1.49,aim),null); assert.equal(s.step(.01,aim)?.id,2);
});

test('the configured duration caps effective time and keeps death ahead of survival', () => {
  const run={...makeRunConfig('CAT01','W01','p2-basic'),durationSeconds:2};
  const alive=new Session(run); alive.step(1.99,null); assert.equal(alive.result,null);
  alive.step(.01,aim); assert.equal(alive.result,'survived'); assert.equal(alive.shots,0);
  alive.step(10,aim); assert.equal(alive.elapsed,2);
  const dead=new Session(run); dead.step(1.99,null); dead.damage(90); dead.step(.01,aim);
  assert.equal(dead.result,'death'); assert.equal(dead.shots,0);
});

test('P2 long frames emit at most one salvo and no-target frames preserve ammo', () => {
  const s=new Session(makeRunConfig('CAT03','W02','p2-basic'));
  s.step(0,aim); assert.equal(s.step(10,null),null); assert.equal(s.ammo,3);
  assert.equal(s.step(0,aim)?.id,2); assert.equal(s.step(10,aim)?.id,3);
  assert.equal(s.ammo,1); assert.equal(s.step(0,aim),null);
});

test('cadence reads configured spawn and shared contact timings on the same scene delta', () => {
  const base=makeRunConfig('CAT03','W02','p2-basic');
  const run={...base,scenario:{...base.scenario,spawnIntervalSeconds:.4,contactDamage:7,contactIntervalSeconds:.2}};
  const s=new Session(run), cadence=new CombatCadence(run);
  const step=(delta:number)=>{const spawn=cadence.step(delta,s);s.step(delta,null);return spawn;};
  assert.equal(cadence.contact(s),true); assert.equal(s.hp,113);
  assert.equal(step(.19),false); assert.equal(cadence.contact(s),false);
  assert.equal(step(.01),false); assert.equal(cadence.contact(s),true); assert.equal(s.hp,106);
  assert.equal(step(.2),true); assert.equal(s.elapsed,.4);
  cadence.reset(); assert.equal(cadence.contact(s),true); assert.equal(s.hp,99);
  assert.equal(step(.39),false); assert.equal(step(.01),true);
});

test('P2 configured HP gives contact damage death priority at the two minute boundary', () => {
  const run=makeRunConfig('CAT01','W01','p2-basic'), s=new Session(run), cadence=new CombatCadence(run);
  s.step(119.9,null); s.damage(80); cadence.step(.1,s);
  assert.equal(cadence.contact(s),true); assert.equal(s.step(.1,aim),null);
  assert.equal(s.hp,0); assert.equal(s.result,'death');
});
