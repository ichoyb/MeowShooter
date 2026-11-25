import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RenderFrames } from '../src/render-frames';

test('actual render samples report frame intervals and consecutive slow time', () => {
  const frames = new RenderFrames();
  for (const now of [0, 20, 40, 100, 170, 190]) frames.record(now);
  assert.deepEqual(frames.snapshot(), { sampleCount: 6, intervalCount: 5, avgFPS: 5000 / 190, p95IntervalMs: 70,
    maxConsecutiveSlowMs: 130, intervalResolutionMs: 1 });
});
test('suspend drops paused/background gaps; reset clears the run', () => {
  const frames = new RenderFrames();
  frames.record(0); frames.record(60); frames.suspend(); frames.record(10000); frames.record(10020);
  assert.equal(frames.snapshot().sampleCount, 4); assert.equal(frames.snapshot().intervalCount, 2);
  assert.equal(frames.snapshot().avgFPS, 25); assert.equal(frames.snapshot().maxConsecutiveSlowMs, 60);
  frames.reset(); assert.equal(frames.snapshot().sampleCount, 0); assert.equal(frames.snapshot().p95IntervalMs, null);
});
test('long runs retain bounded histogram storage and include long render stalls', () => {
  const frames = new RenderFrames();
  for (let i = 0; i <= 20000; i++) frames.record(i * 16.5);
  assert.equal(frames.snapshot().sampleCount, 20001); assert.equal(frames.snapshot().p95IntervalMs, 17);
  frames.reset(); frames.record(0); frames.record(20000);
  assert.equal(frames.snapshot().p95IntervalMs, 20000); assert.equal(frames.snapshot().maxConsecutiveSlowMs, 20000);
});
