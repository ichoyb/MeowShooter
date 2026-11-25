import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleInput, type TouchArea } from '../src/battle-geometry';

const touchArea = { left: 0, right: 360, top: 100, bottom: 620 };
const excludedAreas: readonly TouchArea[] = [
  { left: 220, right: 330, top: 560, bottom: 600 },
  { left: 80, right: 180, top: 570, bottom: 590 },
];
const assertPoint = (actual: { x: number; y: number }, expected: { x: number; y: number }): void => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-10, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-10, `y: ${actual.y} != ${expected.y}`);
};
const movement = (input: BattleInput): { x: number; y: number } => {
  assert.equal(typeof input.movementVector, 'function', 'input exposes the movement vector');
  return input.movementVector();
};

test('effective touch area is independent of actor bounds and accepts the first valid touch on either side', () => {
  const input = new BattleInput();
  input.beginTouch(1, 280, 580, touchArea);
  assert.deepEqual(input.owner, { id: 1, x: 280, y: 580, dx: 0, dy: 0 });
  input.releaseTouch(1);
  input.beginTouch(2, 40, 130, touchArea);
  assert.equal(input.owner?.id, 2);
});

test('touch area excludes the HUD, outer sides and bottom safety area', () => {
  const input = new BattleInput();
  for (const [id, x, y] of [[1, 80, 99], [2, -1, 200], [3, 361, 200], [4, 80, 621], [5, NaN, 200], [6, 80, Infinity]]) {
    assert.equal(input.beginTouch(id, x, y, touchArea), false);
  }
  assert.equal(input.owner, null);
  assert.deepEqual(movement(input), { x: 0, y: 0 });
  assert.equal(input.beginTouch(7, 0, 100, touchArea), true);
  input.releaseTouch(7);
  assert.equal(input.beginTouch(8, 360, 620, touchArea), true);
});

test('HUD exclusions reject touches inside each rectangle including every edge and corner', () => {
  for (const area of excludedAreas) {
    const midX = (area.left + area.right) / 2;
    const midY = (area.top + area.bottom) / 2;
    for (const [x, y] of [
      [midX, midY], [area.left, midY], [area.right, midY], [midX, area.top], [midX, area.bottom],
      [area.left, area.top], [area.right, area.top], [area.left, area.bottom], [area.right, area.bottom],
    ]) {
      const input = new BattleInput();
      assert.equal(input.beginTouch(1, x, y, touchArea, 1, excludedAreas), false, `HUD touch ${x}, ${y}`);
      assert.equal(input.owner, null);
      assert.deepEqual(movement(input), { x: 0, y: 0 });
    }
    for (const [x, y] of [
      [area.left - .1, midY], [area.right + .1, midY], [midX, area.top - .1], [midX, area.bottom + .1],
    ]) {
      const input = new BattleInput();
      assert.equal(input.beginTouch(1, x, y, touchArea, 1, excludedAreas), true, `touch outside HUD ${x}, ${y}`);
    }
  }
});

test('a first finger beginning on excluded HUD leaves ownership available to a valid second finger', () => {
  const input = new BattleInput();
  assert.equal(input.beginTouch(1, 280, 580, touchArea, 1, excludedAreas), false);
  assert.equal(input.beginTouch(2, 200, 580, touchArea, 1, excludedAreas), true);
  input.moveTouch(1, 100, 300);
  assert.deepEqual(input.owner, { id: 2, x: 200, y: 580, dx: 0, dy: 0 });
  input.moveTouch(2, 219, 580);
  assert.deepEqual(movement(input), { x: .5, y: 0 });
});

test('a rejected HUD finger must release before a new valid down can gain ownership', () => {
  const input = new BattleInput();
  assert.equal(input.beginTouch(1, 280, 580, touchArea, 1, excludedAreas), false);
  input.moveTouch(1, 200, 300);
  assert.equal(input.owner, null);
  assert.deepEqual(movement(input), { x: 0, y: 0 });
  assert.equal(input.beginTouch(1, 200, 300, touchArea, 1, excludedAreas), false);
  assert.equal(input.owner, null);
  input.releaseTouch(1);
  assert.equal(input.beginTouch(1, 200, 300, touchArea, 1, excludedAreas), true);
  assert.deepEqual(input.owner, { id: 1, x: 200, y: 300, dx: 0, dy: 0 });
});

test('HUD rectangles use logical coordinates while the fifth parameter keeps CSS movement scaling', () => {
  for (const scale of [320 / 360, 1, 390 / 360, 430 / 360, 2]) {
    const input = new BattleInput();
    assert.equal(input.beginTouch(1, 280, 580, touchArea, scale, excludedAreas), false);
    assert.equal(input.beginTouch(2, 200, 300, touchArea, scale, excludedAreas), true);
    input.moveTouch(2, 200 + 19 / scale, 300);
    assertPoint(movement(input), { x: .5, y: 0 });
  }
});

test('an owner begun outside HUD may keep moving when dragged through an excluded rectangle', () => {
  const input = new BattleInput();
  assert.equal(input.beginTouch(1, 200, 580, touchArea, 1, excludedAreas), true);
  input.moveTouch(1, 280, 580);
  assert.deepEqual(input.owner, { id: 1, x: 248, y: 580, dx: 32, dy: 0 });
  assert.deepEqual(movement(input), { x: 1, y: 0 });
});

test('second touches cannot steal movement even when the owner crosses the screen', () => {
  const input = new BattleInput();
  input.beginTouch(1, 80, 500, touchArea);
  input.beginTouch(2, 280, 500, touchArea);
  input.moveTouch(1, 300, 500);
  assert.deepEqual(input.owner, { id: 1, x: 268, y: 500, dx: 32, dy: 0 });
  input.moveTouch(2, 50, 530);
  assert.deepEqual(input.owner, { id: 1, x: 268, y: 500, dx: 32, dy: 0 });
  assert.deepEqual(movement(input), { x: 1, y: 0 });
});

test('movement remains stopped within the six CSS pixel dead zone and increases linearly after it', () => {
  const input = new BattleInput();
  input.beginTouch(1, 180, 300, touchArea);
  for (const distance of [0, 5.9, 6]) {
    input.moveTouch(1, 180 + distance, 300);
    assert.deepEqual(movement(input), { x: 0, y: 0 });
  }
  input.moveTouch(1, 199, 300);
  assert.deepEqual(movement(input), { x: .5, y: 0 });
  input.moveTouch(1, 212, 300);
  assert.deepEqual(movement(input), { x: 1, y: 0 });
});

test('diagonal dragging has the same speed as an axial drag at the same distance', () => {
  const input = new BattleInput();
  input.beginTouch(1, 180, 300, touchArea);
  input.moveTouch(1, 180 + 19 / Math.SQRT2, 300 + 19 / Math.SQRT2);
  const partial = movement(input);
  assertPoint(partial, { x: .5 / Math.SQRT2, y: .5 / Math.SQRT2 });
  assert.ok(Math.abs(Math.hypot(partial.x, partial.y) - .5) < 1e-10);
  input.moveTouch(1, 240, 360);
  const full = movement(input);
  assertPoint(full, { x: 1 / Math.SQRT2, y: 1 / Math.SQRT2 });
  assert.ok(Math.abs(Math.hypot(full.x, full.y) - 1) < 1e-10);
});

test('floating origin follows beyond max throw so a reverse gesture does not keep the old direction', () => {
  const input = new BattleInput();
  input.beginTouch(1, 100, 300, touchArea);
  input.moveTouch(1, 200, 300);
  assert.deepEqual(input.owner, { id: 1, x: 168, y: 300, dx: 32, dy: 0 });
  input.moveTouch(1, 165, 300);
  assert.deepEqual(movement(input), { x: 0, y: 0 });
  input.moveTouch(1, 149, 300);
  assert.deepEqual(movement(input), { x: -.5, y: 0 });
  input.moveTouch(1, 100, 300);
  assert.deepEqual(input.owner, { id: 1, x: 132, y: 300, dx: -32, dy: 0 });
  assert.deepEqual(movement(input), { x: -1, y: 0 });
});

test('CSS scale conversion preserves six pixel dead zone and thirty two pixel max throw', () => {
  for (const scale of [320 / 360, 1, 390 / 360, 430 / 360, 2]) {
    const input = new BattleInput();
    input.beginTouch(1, 100, 300, touchArea, scale);
    input.moveTouch(1, 100 + 6 / scale, 300);
    assertPoint(movement(input), { x: 0, y: 0 });
    input.moveTouch(1, 100 + 19 / scale, 300);
    assertPoint(movement(input), { x: .5, y: 0 });
    input.moveTouch(1, 100 + 40 / scale, 300);
    assertPoint(movement(input), { x: 1, y: 0 });
    assertPoint(input.owner!, { x: 100 + 8 / scale, y: 300 });
    assert.ok(Math.abs(input.owner!.dx * scale - 32) < 1e-10);
  }
});

test('ignored held second finger must release and begin again after the owner releases', () => {
  const input = new BattleInput();
  input.beginTouch(1, 80, 500, touchArea);
  input.beginTouch(2, 280, 500, touchArea);
  input.releaseTouch(1);
  input.moveTouch(2, 300, 500);
  assert.equal(input.owner, null);
  assert.equal(input.beginTouch(2, 300, 500, touchArea), false);
  assert.equal(input.owner, null);
  input.releaseTouch(2);
  assert.equal(input.beginTouch(2, 300, 500, touchArea), true);
  assert.equal(input.owner?.id, 2);
});

test('unrelated release does not cancel ownership and clear removes held movement', () => {
  const input = new BattleInput();
  input.beginTouch(1, 80, 500, touchArea);
  input.beginTouch(2, 280, 500, touchArea);
  input.moveTouch(1, 112, 500);
  input.releaseTouch(2);
  assert.equal(input.owner?.id, 1);
  assert.deepEqual(movement(input), { x: 1, y: 0 });
  input.clear();
  input.moveTouch(1, 140, 500);
  assert.equal(input.owner, null);
  assert.deepEqual(movement(input), { x: 0, y: 0 });
  assert.equal(input.beginTouch(1, 140, 500, touchArea), true);
  assert.deepEqual(movement(input), { x: 0, y: 0 });
});

test('duplicate pointer-down events do not move a held stick origin', () => {
  const input = new BattleInput();
  input.beginTouch(1, 80, 500, touchArea);
  input.moveTouch(1, 99, 500);
  assert.equal(input.beginTouch(1, 280, 520, touchArea), false);
  assert.deepEqual(input.owner, { id: 1, x: 80, y: 500, dx: 19, dy: 0 });
  assert.deepEqual(movement(input), { x: .5, y: 0 });
});

test('non-finite movement never corrupts a valid owner', () => {
  const input = new BattleInput();
  input.beginTouch(1, 100, 300, touchArea);
  input.moveTouch(1, 119, 300);
  input.moveTouch(1, Infinity, 300);
  input.moveTouch(1, 100, NaN);
  assert.deepEqual(input.owner, { id: 1, x: 100, y: 300, dx: 19, dy: 0 });
  assert.deepEqual(movement(input), { x: .5, y: 0 });
});
