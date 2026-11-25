import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedWeaponId, makeRunConfig } from '../src/combat-config';

test('three fixed pairs expose distinct P2 movement, survivability and direct damage', () => {
  const orange = makeRunConfig('CAT01', 'W01', 'p2-basic');
  const snow = makeRunConfig('CAT02', 'W04', 'p2-basic');
  const ink = makeRunConfig('CAT03', 'W02', 'p2-basic');
  assert.deepEqual([orange.maxHp, snow.maxHp, ink.maxHp], [90, 100, 120]);
  assert.deepEqual([orange.moveSpeed, snow.moveSpeed, ink.moveSpeed], [198, 180, 162]);
  assert.deepEqual([orange.directDamageMultiplier, snow.directDamageMultiplier, ink.directDamageMultiplier], [1, .9, 1]);
  assert.deepEqual([orange.passive, snow.passive, ink.passive], ['reload-secondary', 'chill', 'spirit']);
  assert.deepEqual([orange.weapon.damage, snow.weapon.damage * snow.directDamageMultiplier, ink.weapon.damage], [12, 28.8, 8]);
});

test('W01 supports twelve quarter-second shots and a one point four second reload', () => {
  const run = makeRunConfig('CAT01', 'W01', 'p2-basic');
  assert.deepEqual(run.weapon, { damage: 12, intervalSeconds: .25, ammoCapacity: 12, reloadSeconds: 1.4,
    pellets: 1, spreadDegrees: 0, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 620, bulletLifeSeconds: 1.2, targetRange: 240 });
});

test('W04 trades frequency for direct damage and two extra penetrations', () => {
  const run = makeRunConfig('CAT02', 'W04', 'p2-basic');
  assert.deepEqual(run.weapon, { damage: 32, intervalSeconds: 1 / 1.2, ammoCapacity: 4, reloadSeconds: 1.8,
    pellets: 1, spreadDegrees: 0, extraPierce: 2, pierceDamageMultiplier: .7, bulletSpeed: 800, bulletLifeSeconds: 1.2, targetRange: 240 });
});

test('W02 is a five-pellet short-range spread with four salvos per magazine', () => {
  const run = makeRunConfig('CAT03', 'W02', 'p2-basic');
  assert.deepEqual(run.weapon, { damage: 8, intervalSeconds: 1 / 1.5, ammoCapacity: 4, reloadSeconds: 1.6,
    pellets: 5, spreadDegrees: 36, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 550, bulletLifeSeconds: .55, targetRange: 240 });
});

test('P2 uses the same two-minute arena scenario for every fixed pair', () => {
  for (const [cat, weapon] of [['CAT01', 'W01'], ['CAT02', 'W04'], ['CAT03', 'W02']]) {
    const run = makeRunConfig(cat, weapon, 'p2-basic');
    assert.equal(run.catId, cat); assert.equal(run.weaponId, weapon);
    assert.equal(run.rulesVersion, 'p2-basic-v1'); assert.equal(run.durationSeconds, 120);
    assert.deepEqual(run.scenario, { enemyHp: 48, objectHp: 144, enemySpeed: 24,
      spawnIntervalSeconds: 2, maxEnemies: 10, contactDamage: 10, contactIntervalSeconds: .7 });
  }
});

test('diagnostic remains a neutral CAT01 fixture with one damage and three rounds', () => {
  const run = makeRunConfig('CAT01', 'W01', 'diagnostic');
  assert.equal(run.rulesVersion, 'diagnostic-v1');
  assert.equal(run.maxHp, 100); assert.equal(run.moveSpeed, 180);
  assert.equal(run.directDamageMultiplier, 1); assert.equal(run.passive, 'none');
  assert.equal(run.durationSeconds, 120);
  assert.deepEqual(run.weapon, { damage: 1, intervalSeconds: .5, ammoCapacity: 3, reloadSeconds: 1,
    pellets: 1, spreadDegrees: 0, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 320, bulletLifeSeconds: 1.5, targetRange: 240 });
  assert.deepEqual(run.scenario, { enemyHp: 2, objectHp: 6, enemySpeed: 24,
    spawnIntervalSeconds: 2, maxEnemies: 10, contactDamage: 10, contactIntervalSeconds: .7 });
});

test('unknown IDs, historical W03 and mismatched pairs cannot create a run', () => {
  for (const [cat, weapon] of [['CAT00', 'W01'], ['CAT01', 'W99'], ['CAT01', 'W03'],
    ['CAT01', 'W04'], ['CAT02', 'W02'], ['CAT03', 'W01'], ['toString', 'W01'], ['__proto__', 'W01']]) {
    assert.throws(() => makeRunConfig(cat, weapon, 'p2-basic'));
  }
  assert.throws(() => makeRunConfig('CAT02', 'W04', 'diagnostic'));
  assert.throws(() => makeRunConfig('CAT03', 'W02', 'diagnostic'));
  assert.throws(() => makeRunConfig('CAT01', 'W01', 'unknown' as 'p2-basic'));
});

test('fixed weapon lookup rejects unknown cats and matches all accepted run pairs', () => {
  assert.equal(fixedWeaponId('CAT01'), 'W01');
  assert.equal(fixedWeaponId('CAT02'), 'W04');
  assert.equal(fixedWeaponId('CAT03'), 'W02');
  assert.throws(() => fixedWeaponId('CAT99'));
  assert.throws(() => fixedWeaponId('toString'));
});

test('run configuration is frozen through weapon and scenario to preserve the copied run', () => {
  const run = makeRunConfig('CAT03', 'W02', 'p2-basic');
  assert.ok(Object.isFrozen(run)); assert.ok(Object.isFrozen(run.weapon)); assert.ok(Object.isFrozen(run.scenario));
  assert.throws(() => { (run as { maxHp: number }).maxHp = 1; });
  assert.throws(() => { (run.weapon as { ammoCapacity: number }).ammoCapacity = 99; });
  assert.throws(() => { (run.scenario as { enemyHp: number }).enemyHp = 1; });
  assert.equal(makeRunConfig('CAT03', 'W02', 'p2-basic').maxHp, 120);
  assert.equal(makeRunConfig('CAT03', 'W02', 'p2-basic').weapon.ammoCapacity, 4);
  assert.equal(makeRunConfig('CAT03', 'W02', 'p2-basic').scenario.enemyHp, 48);
});

test('run config freezes every passive balance and pierce attenuation under the existing rules version', () => {
  const run = makeRunConfig('CAT02', 'W04', 'p2-basic');
  assert.deepEqual(run.secondary, { damageMultiplier: .75 });
  assert.deepEqual(run.chill, { creditFactor: 4, threshold: 6, slowPerLayer: .15, layerDurationSeconds: 2.5,
    maxLayers: 3, freezeSeconds: .75, protectionSeconds: 3, transferRange: 120 });
  assert.deepEqual(run.spirit, { intervalSeconds: 1.5, targetRange: 260, damage: 6, bulletSpeed: 600, bulletLifeSeconds: 1 });
  assert.equal(run.weapon.pierceDamageMultiplier, .7); assert.equal(run.rulesVersion, 'p2-basic-v1');
  for (const balance of [run.secondary, run.chill, run.spirit]) assert.ok(Object.isFrozen(balance));
  assert.throws(() => { (run.secondary as { damageMultiplier: number }).damageMultiplier = 1; });
  assert.throws(() => { (run.chill as { threshold: number }).threshold = 1; });
  assert.throws(() => { (run.spirit as { damage: number }).damage = 1; });
});
