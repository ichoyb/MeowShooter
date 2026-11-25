import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatPassives, newChillState, applyChill, stepChill, chillSnapshot, chillTarget } from '../src/cat-passives';
import { makeRunConfig } from '../src/combat-config';
import { Session, type Target } from '../src/rules';
import { courtyardBalanceRunConfig } from '../src/level-config';
import { WeaponBursts } from '../src/weapon-bursts';
import { nativeSpiritDamage } from '../src/area-ability-rules';
import { companionFrequency } from '../src/sentinel-rules';
const config = (cat: string) => makeRunConfig(cat, { CAT01: 'W01', CAT02: 'W04', CAT03: 'W02' }[cat]!, 'p2-basic');
const enemy = (id: number, x: number, y = 0): Target => ({ id, x, y, kind: 'enemy', alive: true });
const hit = (overrides = {}) => ({ source: 'PRIMARY' as const, firstEnemyHit: true, targetKind: 'enemy' as const, targetId: 1, killed: false, position: { x: 0, y: 0 }, ...overrides });
const chill = config('CAT02').chill;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
test('orange first actual volley and each completed reload consume exactly one secondary flag', () => {
  const p = new CatPassives(config('CAT01'));
  assert.equal(p.snapshot().secondaryReady, true);
  assert.equal(p.onVolley(1, 0), true); assert.equal(p.onVolley(1, 0), false); assert.equal(p.onVolley(2, 0), false);
  p.syncReloads(1); assert.equal(p.snapshot().secondaryReady, true);
  assert.equal(p.onVolley(3, 1), true); p.syncReloads(1); assert.equal(p.onVolley(4, 1), false);
  assert.equal(p.onVolley(5, 2), true);
});
test('no target and paused Session preserve orange flag; a new run has only its first flag', () => {
  const s = new Session(config('CAT01')), p = new CatPassives(s.runConfig);
  assert.equal(s.step(10, null), null); p.syncReloads(s.reloadCompletions); assert.equal(p.snapshot().secondaryReady, true);
  s.pause('background'); assert.equal(s.step(30, { x: 1, y: 0 }), null); assert.equal(p.snapshot().secondaryReady, true);
  s.resume(); assert.equal(p.onVolley(s.step(0, { x: 1, y: 0 })!.id, s.reloadCompletions), true);
  const reset = new CatPassives(s.runConfig); assert.equal(reset.onVolley(1, 0), true); assert.equal(reset.onVolley(2, 0), false);
});
test('snow gets 4/(base rate * pellets), deducts six and keeps credit remainder', () => {
  const p = new CatPassives(config('CAT02'));
  assert.equal(p.onHit(hit()), false); near(p.snapshot().chillCredit, 10 / 3);
  assert.equal(p.onHit(hit()), true); near(p.snapshot().chillCredit, 2 / 3);
});
test('pierce later enemies, boxes, secondary and summon cannot grant chill credit', () => {
  const p = new CatPassives(config('CAT02'));
  for (const invalid of [hit({ firstEnemyHit: false }), hit({ targetKind: 'object' }), hit({ source: 'SECONDARY' }), hit({ source: 'SUMMON' })]) assert.equal(p.onHit(invalid), false);
  assert.equal(p.snapshot().chillCredit, 0);
});
test('dead hit transfers within 120 to nearest living enemy with stable ID ties and skips itself', () => {
  const death = hit({ killed: true });
  const targets = [enemy(1, 0), enemy(9, 40), enemy(2, -40), { ...enemy(3, 1), kind: 'object' as const }, { ...enemy(4, 2), alive: false }];
  assert.equal(chillTarget(death, targets, chill)?.id, 2);
  assert.equal(chillTarget(death, [enemy(6, 120)], chill)?.id, 6); assert.equal(chillTarget(death, [enemy(6, 120.01)], chill), null);
  assert.equal(chillTarget(hit(), targets, chill)?.id, 1);
});
test('chill trigger with no transfer target still consumes six credit', () => {
  const p = new CatPassives(config('CAT02')); p.onHit(hit());
  const death = hit({ killed: true }); assert.equal(p.onHit(death), true); assert.equal(chillTarget(death, [], chill), null); near(p.snapshot().chillCredit, 2 / 3);
});
test('chill layers slow 15 percent each and expire independently at 2.5 seconds', () => {
  const state = newChillState(); assert.equal(stepChill(state, 0, chill), 1);
  assert.equal(applyChill(state, 0, chill), true); near(stepChill(state, 0, chill), .85);
  assert.equal(applyChill(state, 1, chill), true); near(stepChill(state, 1, chill), .7);
  near(stepChill(state, 2.5, chill), .85); assert.equal(chillSnapshot(state, 2.5, chill).layers, 1);
  assert.equal(stepChill(state, 3.5, chill), 1); assert.equal(chillSnapshot(state, 3.5, chill).layers, 0);
});
test('third layer clears layers, freezes .75 then protects for three seconds after thaw', () => {
  const state = newChillState(); applyChill(state, 0, chill); applyChill(state, .1, chill); applyChill(state, .2, chill);
  assert.equal(chillSnapshot(state, .2, chill).layers, 0); assert.equal(stepChill(state, .949, chill), 0); assert.equal(stepChill(state, .95, chill), 1);
  assert.equal(applyChill(state, .96, chill), false); assert.equal(applyChill(state, 3.949, chill), false); assert.equal(applyChill(state, 3.95, chill), true);
  near(stepChill(state, 3.95, chill), .85);
});
test('chill and spirit use effective Session time so pause leaves expiry and first attack unchanged', () => {
  const s = new Session(config('CAT03')), p = new CatPassives(s.runConfig), state = newChillState(); applyChill(state, s.elapsed, chill);
  s.step(1, null); assert.equal(p.spiritAttack(s.elapsed, { x: 0, y: 0 }, [enemy(1, 10)]), null);
  s.pause('menu'); s.step(50, null); near(stepChill(state, s.elapsed, chill), .85); assert.equal(s.elapsed, 1);
  assert.equal(p.spiritAttack(s.elapsed, { x: 0, y: 0 }, [enemy(1, 10)]), null);
  s.resume(); s.step(.5, null); assert.equal(p.spiritAttack(s.elapsed, { x: 0, y: 0 }, [enemy(1, 10)])?.id, 1);
  const reset = new CatPassives(s.runConfig); assert.equal(reset.spiritAttack(0, { x: 0, y: 0 }, [enemy(1, 10)]), null);
  assert.deepEqual(newChillState(), { layerEnds: [], frozenUntil: 0, protectedUntil: 0 });
});
test('spirit first attack waits a full 1.5 and then chooses enemy only within 260 with stable ID ties', () => {
  const p = new CatPassives(config('CAT03')), targets = [enemy(9, 100), enemy(2, -100), { ...enemy(1, 1), kind: 'object' as const }];
  assert.equal(p.spiritAttack(1.499, { x: 0, y: 0 }, targets), null); assert.equal(p.spiritAttack(1.5, { x: 0, y: 0 }, targets)?.id, 2);
  assert.equal(p.spiritAttack(2.999, { x: 0, y: 0 }, targets), null); assert.equal(p.spiritAttack(3, { x: 0, y: 0 }, [enemy(6, 260)])?.id, 6);
  assert.equal(p.spiritAttack(4.5, { x: 0, y: 0 }, [enemy(6, 260.01)]), null);
});
test('spirit no-target and long-frame deadlines never accumulate catch-up attacks', () => {
  const p = new CatPassives(config('CAT03')), origin = { x: 0, y: 0 }, targets = [enemy(1, 20)];
  assert.equal(p.spiritAttack(1.5, origin, [{ ...enemy(2, 1), kind: 'object' as const }]), null);
  assert.equal(p.spiritAttack(1.6, origin, targets), null); assert.equal(p.spiritAttack(20, origin, targets)?.id, 1);
  assert.equal(p.spiritAttack(20, origin, targets), null); assert.equal(p.spiritAttack(21.49, origin, targets), null); assert.equal(p.spiritAttack(21.5, origin, targets)?.id, 1);
});
test('diagnostic none has no secondary, chill credit or spirit attacks', () => {
  const p = new CatPassives(makeRunConfig('CAT01', 'W01', 'diagnostic'));
  assert.equal(p.onVolley(1, 0), false); assert.equal(p.onHit(hit()), false); assert.equal(p.spiritAttack(20, { x: 0, y: 0 }, [enemy(1, 10)]), null);
  assert.equal(p.snapshot().secondaryReady, false); assert.equal(p.snapshot().chillCredit, 0);
});

test('custom run chill credit, stack timing, slow, freeze, protection and transfer consume explicit config', () => {
  const base = config('CAT02');
  const chill = { creditFactor: 12, threshold: 4, slowPerLayer: .2, layerDurationSeconds: 1,
    maxLayers: 2, freezeSeconds: .5, protectionSeconds: 1, transferRange: 30 };
  const p = new CatPassives({ ...base, chill }), state = newChillState();
  assert.equal(p.onHit(hit()), true); near(p.snapshot().chillCredit, 6);
  applyChill(state, 0, chill); near(stepChill(state, 0, chill), .8);
  assert.equal(chillSnapshot(state, 1, chill).layers, 0);
  applyChill(state, 2, chill); applyChill(state, 2.1, chill);
  assert.equal(stepChill(state, 2.599, chill), 0); assert.equal(stepChill(state, 2.6, chill), 1);
  assert.equal(applyChill(state, 3.599, chill), false); assert.equal(applyChill(state, 3.6, chill), true);
  assert.equal(chillTarget(hit({ killed: true }), [enemy(2, 30)], chill)?.id, 2);
  assert.equal(chillTarget(hit({ killed: true }), [enemy(2, 30.01)], chill), null);
});

test('custom spirit interval and range affect first attack, spent windows and long frames', () => {
  const base = config('CAT03'), p = new CatPassives({ ...base, spirit: { ...base.spirit, intervalSeconds: .4, targetRange: 30 } });
  const origin = { x: 0, y: 0 };
  assert.equal(p.snapshot().nextSpiritAt, .4);
  assert.equal(p.spiritAttack(.399, origin, [enemy(1, 30)]), null);
  assert.equal(p.spiritAttack(.4, origin, [enemy(1, 30)])?.id, 1);
  assert.equal(p.spiritAttack(.8, origin, [enemy(1, 30.01)]), null);
  assert.equal(p.spiritAttack(.9, origin, [enemy(1, 1)]), null);
  assert.equal(p.spiritAttack(10, origin, [enemy(1, 1)])?.id, 1);
  assert.equal(p.spiritAttack(10, origin, [enemy(1, 1)]), null);
  near(p.snapshot().nextSpiritAt, 10.4);
});


test('A16 spirit frequency preserves completed fraction and spends overdue windows once',()=>{
 const p=new CatPassives(config('CAT03'));
 assert.equal(typeof p.setSpiritFrequency,'function');
 p.setSpiritFrequency(1.1,.6);near(p.snapshot().nextSpiritAt,1.4181818181818182);
 p.setSpiritFrequency(1.1,1);near(p.snapshot().nextSpiritAt,1.4181818181818182);
 assert.equal(p.spiritAttack(1.4181818181818182,{x:0,y:0},[enemy(1,1)])?.id,1);
 near(p.snapshot().nextSpiritAt,1.4181818181818182+1.5/1.1);
 p.setSpiritFrequency(1.2,20);near(p.snapshot().nextSpiritAt,20);
 assert.equal(p.spiritAttack(20,{x:0,y:0},[enemy(1,1)])?.id,1);
 assert.equal(p.spiritAttack(20,{x:0,y:0},[enemy(1,1)]),null);near(p.snapshot().nextSpiritAt,21.25);
});

test('G7 orange empowers three actual root volleys at start and after reload, with separate growth bursts', () => {
  const run = courtyardBalanceRunConfig(config('CAT01'));
  const session = new Session(run), passives = new CatPassives(run);
  assert.deepEqual([run.maxHp, run.moveSpeed, run.weapon.damage, run.weapon.intervalSeconds, run.weapon.ammoCapacity, run.weapon.reloadSeconds], [95, 185, 16, .68, 8, 1.8]);
  const aim = { x: 1, y: 0 };
  assert.equal(session.step(5, null), null);
  session.pause('upgrade');
  assert.equal(session.step(10, aim), null);
  session.finishUpgrade();
  for (let round = 0; round < 8; round++) {
    const fired = session.step(round === 0 ? 0 : .68, aim)!;
    assert.equal(fired.primaryMultiplier ?? 1, round < 3 ? 1.35 : 1);
    assert.equal(passives.onVolley(fired.id, session.reloadCompletions), false);
  }
  session.applyGrowth({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_RELOAD:1,L1_ECHO:1,L1_EVO_CADENCE:1,M12:1});
  assert.equal(session.step(3, null), null);
  const fired = session.step(0, aim)!;
  assert.equal(fired.primaryMultiplier, 1.35);
  assert.equal(session.snapshot().hotStartRemaining,1);
  near(session.snapshot().cooldown,.68*.75);
  const shots = new WeaponBursts().onVolley(session.effectiveConfig,
    {L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_ECHO:1,L1_EVO_CADENCE:1},
    {id:fired.id,ammo:session.ammo,reloads:session.reloadCompletions,opening:passives.onVolley(fired.id,session.reloadCompletions)});
  assert.equal(shots.length, 3);
  assert(shots.every(shot => shot.effect === 'OPENING_BURST' && shot.damage < run.weapon.damage));
  assert.equal(new Session(run).step(0,aim)?.primaryMultiplier,1.35);
});

test('G7 star mark accepts one live enemy, consumes once and keeps cooldown through death', () => {
  const run = courtyardBalanceRunConfig(config('CAT03'));
  const p = new CatPassives(run);
  assert.equal(run.maxHp,120);
  assert.equal(p.markSpiritHit(0,1,6),true);
  assert.equal(p.markSpiritHit(1,2,6),false);
  assert.equal(p.consumeSpiritMark(1,2),0);
  assert.equal(p.consumeSpiritMark(1,1),9);
  assert.equal(p.consumeSpiritMark(1,1),0);
  assert.equal(p.markSpiritHit(2.99,2,8),false);
  assert.equal(p.markSpiritHit(3,2,8),true);
  assert.equal(p.spiritMarkTarget(3),2);
  p.clearSpiritMark(2);
  assert.equal(p.spiritMarkTarget(3),null);
  assert.equal(p.markSpiritHit(5,2,8),false);
  assert.equal(p.markSpiritHit(6,2,8),true);
  assert.equal(p.consumeSpiritMark(9,2),0);
  assert.equal(p.spiritMarkTarget(9),null);
  assert.equal(new CatPassives(run).spiritMarkTarget(0),null);
  assert.equal(new CatPassives(config('CAT03')).markSpiritHit(0,1,6),false);
  const snow=courtyardBalanceRunConfig(config('CAT02'));
  assert.deepEqual([snow.maxHp,snow.moveSpeed,snow.weapon.damage,snow.weapon.extraPierce],[100,175,29,2]);
  assert.equal(courtyardBalanceRunConfig(run),run);
});

test('G7 star mark snapshots skill growth, with a fixed window on the effective clock', () => {
  const run = courtyardBalanceRunConfig(config('CAT03'));
  const session = new Session(run), p = new CatPassives(run);
  const ranks = {L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,A07:1,A16:1};
  p.setSpiritFrequency(companionFrequency(ranks),0);
  near(p.snapshot().nextSpiritAt,1.5/1.1);
  session.advance(1.5);
  const damage = nativeSpiritDamage(run,ranks);
  near(damage,7.5);
  assert(p.markSpiritHit(session.elapsed,1,damage));
  session.pause('menu');
  session.advance(20);
  assert.equal(p.spiritMarkTarget(session.elapsed),1);
  near(p.consumeSpiritMark(session.elapsed,1),11.25);
  session.resume();
  session.advance(2.99);
  assert.equal(p.markSpiritHit(session.elapsed,2,damage),false);
  session.advance(.02);
  assert(p.markSpiritHit(session.elapsed,2,damage));
});
