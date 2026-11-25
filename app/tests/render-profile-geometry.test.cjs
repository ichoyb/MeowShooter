const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../tools/render-density-test.cjs'), 'utf8');
const code = source.slice(source.indexOf('function assertGeometry('), source.indexOf('async function heldResizeChecks'));
const contract = { courtyard: true, WORLD_WIDTH: 360, COURTYARD: { width: 720, height: 1440 } };
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const geometry = vm.runInNewContext('(' + code.trim() + ')', { assert:{...assert,deepEqual:(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))}, near, contract });
const plain = value => JSON.parse(JSON.stringify(value));
const m = { buffer: { width: 780, height: 1688 }, css: { width: 390, height: 844 }, stage: { width: 390, height: 844 }, dpr: 2 };
const zoom = 780 / 360;
const e = { world: { width: 720, height: 1440 }, buffer: { ...m.buffer, rgbaBytes: 780 * 1688 * 4 }, css: { width: 390, height: 844 }, dpr: 2, density: 2, quality: 'standard',
  scale: { gameWidth: 780, gameHeight: 1688, baseSize: m.buffer, displayScale: { x: 2, y: 2 } },
  camera: { width: 780, height: 600 * zoom, zoomX: zoom, zoomY: zoom, scrollX: 0, scrollY: 0, view: { x: 180, y: 420, width: 360, height: 600 } },
  cssPixelsPerLogicalUnit: 390 / 360, bounds: { top: 100, bottom: 700 }, bodies: { cat: { radius: 12, width: 24, height: 24, center: { x: 360, y: 720 }, visual: { x: 360, y: 720 } } } };
test('courtyard uses the actual 720x1440 world and 360-wide clipped follow camera', () => assert.doesNotThrow(() => geometry(m, plain({ engine: e, player: { x: 360, y: 720 } }), 'standard')));
test('courtyard geometry still rejects a wrong fixed world size', () => {
  const state = plain({ engine: e, player: { x: 360, y: 720 } }); state.engine.world.width = 360;
  assert.throws(() => geometry(m, state, 'standard'));
});
test('native Camera worldView uses Phaser rounded logical dimensions', () => {
  const state = plain({ engine: e, player: { x: 360, y: 720 } });
  state.engine.bounds.bottom = 700.125;
  state.engine.camera.height = 600.125 * zoom;
  assert.doesNotThrow(() => geometry(m, state, 'standard'));
});
test('single-screen camera preserves separate X/Y zoom after fractional CSS resize', () => {
  const metrics = { buffer: { width: 230, height: 320 }, css: { width: 230.125, height: 320 }, stage: { width: 230.125, height: 320 }, dpr: 1 };
  const state = plain({ engine: e, player: { x: 180, y: 250 } }), engine = state.engine;
  engine.world = { width: 360, height: 360 * 320 / 230.125 };
  engine.buffer = { ...metrics.buffer, rgbaBytes: 230 * 320 * 4 }; engine.css = metrics.css; engine.dpr = engine.density = 1;
  engine.scale = { gameWidth: 230, gameHeight: 320, baseSize: metrics.buffer, displayScale: { x: 230 / 230.125, y: 1 } };
  engine.camera = { width: 230, height: 320, zoomX: 230 / 360, zoomY: 320 / engine.world.height, scrollX: 0, scrollY: 0, view: { x: 0, y: 0, width: 360, height: Math.round(engine.world.height) } };
  engine.cssPixelsPerLogicalUnit = 230.125 / 360; engine.bounds = { top: 100, bottom: 400 };
  engine.bodies.cat.center = engine.bodies.cat.visual = state.player;
  contract.courtyard = false;
  try { assert.doesNotThrow(() => geometry(metrics, state, 'standard')); }
  finally { contract.courtyard = true; }
});
