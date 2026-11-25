import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseHuntTarget,
  chooseHuntTransfer,
  getMarkedTarget,
  type HuntCandidate,
} from '../src/hunt-targeting';

const origin = { x: 0, y: 0 };
const enemy = (id: number, hp: number, x = 0, y = 0): HuntCandidate =>
  ({ id, hp, x, y, alive: true, kind: 'enemy' });

test('hunt chooses highest current HP in range rather than nearest or maximum HP', () => {
  const near = { ...enemy(1, 30, 5), maxHp: 1000 };
  const healthy = { ...enemy(2, 90, 200), maxHp: 100 };
  const beyond = enemy(3, 200, 241);
  assert.equal(chooseHuntTarget(origin, [near, beyond, healthy], 240), healthy);
  healthy.hp = 20;
  assert.equal(chooseHuntTarget(origin, [near, beyond, healthy], 240), near);
});

test('equal current HP always selects the earliest birth ID independent of candidate order', () => {
  const first = enemy(2, 80, 200);
  const second = enemy(8, 80, 1);
  const third = enemy(12, 80, 10);
  for (const candidates of [
    [first, second, third], [first, third, second],
    [second, first, third], [second, third, first],
    [third, first, second], [third, second, first],
  ]) {
    assert.equal(chooseHuntTarget(origin, candidates, 240), first);
  }
});

test('hunt includes the exact circular range boundary and excludes targets just outside it', () => {
  const edge = enemy(4, 40, 144, 192);
  const beyond = enemy(3, 100, 144, 192.001);
  assert.equal(chooseHuntTarget(origin, [beyond, edge], 240), edge);
  assert.equal(chooseHuntTarget(origin, [beyond], 240), null);
});

test('hunt excludes objects, dead enemies, nonpositive or nonfinite HP and invalid coordinates', () => {
  const valid = enemy(20, 1, 10);
  const excluded: HuntCandidate[] = [
    { ...enemy(1, 100), kind: 'object' },
    { ...enemy(2, 100), alive: false },
    ...[0, -1, NaN, Infinity, -Infinity].map((hp, i) => enemy(3 + i, hp)),
    enemy(8, 100, NaN), enemy(9, 100, Infinity),
    enemy(10, 100, 0, NaN), enemy(11, 100, 0, -Infinity),
  ];
  assert.equal(chooseHuntTarget(origin, [...excluded, valid], 240), valid);
  assert.equal(chooseHuntTarget(origin, excluded, 240), null);
});

test('all selectors return null for an empty field or invalid origin', () => {
  assert.equal(chooseHuntTarget(origin, [], 240), null);
  assert.equal(chooseHuntTransfer(origin, [], 1), null);
  assert.equal(getMarkedTarget(origin, [], 1, 240), null);
  for (const invalidOrigin of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    const candidates = [enemy(1, 10)];
    assert.equal(chooseHuntTarget(invalidOrigin, candidates, 240), null);
    assert.equal(chooseHuntTransfer(invalidOrigin, candidates, 9), null);
    assert.equal(getMarkedTarget(invalidOrigin, candidates, 1, 240), null);
  }
});

test('selectors preserve candidate order and values and return original candidate references', () => {
  const first = Object.freeze(enemy(8, 20, 5));
  const chosen = Object.freeze(enemy(2, 80, 10));
  const candidates = Object.freeze([first, chosen]);
  const before = JSON.stringify(candidates);
  assert.equal(chooseHuntTarget(origin, candidates, 240), chosen);
  assert.equal(chooseHuntTransfer(origin, candidates, first.id), chosen);
  assert.equal(getMarkedTarget(origin, candidates, first.id, 240), first);
  assert.deepEqual(candidates, [first, chosen]);
  assert.equal(JSON.stringify(candidates), before);
});

test('transfer uses the death point and highest current HP within its fixed 120u circle', () => {
  const deathPoint = { x: 300, y: 100 };
  const deadId = 1;
  const deadBirth = enemy(deadId, 1000, 300, 100);
  const near = enemy(2, 20, 310, 100);
  const edge = enemy(3, 90, 372, 196);
  const beyond = enemy(4, 200, 372, 196.001);
  const candidates = [deadBirth, beyond, near, edge];
  assert.equal(chooseHuntTransfer(deathPoint, candidates, deadId), edge);
  assert.equal(getMarkedTarget(origin, candidates, edge.id, 240), null);
});

test('transfer uses the same live-enemy and birth-ID rules and may have no successor', () => {
  const first = enemy(5, 30, 100);
  const second = enemy(9, 30, 1);
  const invalid: HuntCandidate[] = [
    { ...enemy(1, 100), alive: false },
    { ...enemy(2, 100), kind: 'object' },
    enemy(3, Infinity), enemy(4, 100, NaN),
  ];
  assert.equal(chooseHuntTransfer(origin, [...invalid, second, first], 99), first);
  assert.equal(chooseHuntTransfer(origin, [...invalid, first, second], 99), first);
  assert.equal(chooseHuntTransfer(origin, invalid, 99), null);
  assert.equal(chooseHuntTransfer(origin, [first], first.id), null);
});

test('marked target retains its birth ID despite HP changes and can leave and reenter range', () => {
  const marked = enemy(4, 10, 240);
  const healthier = enemy(2, 100, 1);
  const candidates = [healthier, marked];
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), marked);
  healthier.hp = 500;
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), marked);
  marked.x = 240.001;
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), null);
  marked.x = 239;
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), marked);
  assert.equal(getMarkedTarget(origin, candidates, null, 240), null);
  assert.equal(getMarkedTarget(origin, candidates, 99, 240), null);
});

test('marked lookup rejects dead or invalid targets and never chooses a replacement itself', () => {
  const marked = enemy(4, 10, 30);
  const other = enemy(5, 100, 1);
  const candidates = [marked, other];
  marked.alive = false;
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), null);
  marked.alive = true;
  for (const hp of [0, -1, NaN, Infinity]) {
    marked.hp = hp;
    assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), null);
  }
  marked.hp = 10;
  marked.kind = 'object';
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), null);
  marked.kind = 'enemy';
  marked.y = NaN;
  assert.equal(getMarkedTarget(origin, candidates, marked.id, 240), null);
});

test('a reused enemy object with a new birth ID does not inherit the old mark', () => {
  const reused = enemy(8, 20, 20);
  const markedId = reused.id;
  assert.equal(getMarkedTarget(origin, [reused], markedId, 240), reused);
  reused.alive = false;
  assert.equal(getMarkedTarget(origin, [reused], markedId, 240), null);
  reused.id = 9;
  reused.hp = 100;
  reused.alive = true;
  assert.equal(getMarkedTarget(origin, [reused], markedId, 240), null);
  assert.equal(chooseHuntTarget(origin, [reused], 240), reused);
});
