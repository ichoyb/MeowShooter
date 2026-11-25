'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..'), config = require('./release-test-config.cjs')(root);
const contract = require('./release-profile-contract.cjs')(config);
const manifest = config.candidate, out = path.join(config.qa, 'render-density', new Date().toISOString().replace(/[:.]/g, '-'));
config.verify();
fs.mkdirSync(out, { recursive: true });
const checks = [], consoleErrors = [], sha = value => crypto.createHash('sha256').update(value).digest('hex');
const runnerSha256 = sha(fs.readFileSync(__filename));
const atlasAB = process.argv.includes('--atlas-ab'), renderAB = process.argv.includes('--ab'), startupOnly = process.argv.includes('--startup-only'), fixtureVariants = [];
const heldResizeOnly = process.argv.includes('--held-resize-only');
const frameIds = ['enemy-0', 'enemy-1', 'bell', 'crate', 'fish', 'bone', 'spirit', 'spirit-shot'];
const state = page => page.evaluate(() => JSON.parse(document.getElementById('app').dataset.state));
const click = (page, action) => page.locator('button[data-action="' + action + '"]:visible').last().click();
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' != ' + expected);
let browser, server, browserVersion;
async function check(name, run) {
  try { checks.push({ name, status: 'PASS', observed: await run() }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: String(error), stack: error.stack }); }
  fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify(checks, null, 2));
}
async function metrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#stage canvas'), r = canvas.getBoundingClientRect(), stage = document.getElementById('stage').getBoundingClientRect();
    return { buffer: { width: canvas.width, height: canvas.height }, css: { x: r.x, y: r.y, width: r.width, height: r.height },
      stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height }, dpr: devicePixelRatio };
  });
}
async function boot(page) {
  await page.goto('http://127.0.0.1:8832/');
  await page.waitForFunction(() => document.getElementById('app').dataset.ready === 'true');
  await click(page, 'start');
  if (await page.locator('button[data-action="chapter-skip"]:visible').count()) await click(page, 'chapter-skip');
}
async function quality(page, quality) {
  await click(page, 'pause'); await click(page, 'settings'); await page.locator('#quality').selectOption(quality === 'low' ? '低' : '标准');
  await click(page, 'close');
}
function assertGeometry(m, s, quality) {
  const density = quality === 'low' ? 1 : Math.min(Math.max(m.dpr, 1), 2), e = s.engine;
  near(m.css.width, m.stage.width); near(m.css.height, m.stage.height);
  assert.equal(m.buffer.width, Math.round(m.stage.width * density)); assert.equal(m.buffer.height, Math.round(m.stage.height * density));
  const viewWidth = contract.WORLD_WIDTH, viewHeight = viewWidth * m.stage.height / m.stage.width;
  near(e.world.width, contract.courtyard ? contract.COURTYARD.width : viewWidth); near(e.world.height, contract.courtyard ? contract.COURTYARD.height : viewHeight);
  assert.deepEqual(e.buffer, { ...m.buffer, rgbaBytes: m.buffer.width * m.buffer.height * 4 });
  near(e.css.width, m.stage.width); near(e.css.height, m.stage.height); assert.equal(e.dpr, m.dpr); assert.equal(e.density, density); assert.equal(e.quality, quality);
  assert.equal(e.scale.gameWidth, m.buffer.width); assert.equal(e.scale.gameHeight, m.buffer.height);
  assert.equal(e.scale.baseSize.width, m.buffer.width); assert.equal(e.scale.baseSize.height, m.buffer.height);
  near(e.scale.displayScale.x, m.buffer.width / m.css.width); near(e.scale.displayScale.y, m.buffer.height / m.css.height);
  assert.equal(e.camera.width, m.buffer.width);
  near(e.camera.height, contract.courtyard ? (e.bounds.bottom-e.bounds.top)*m.buffer.width/viewWidth : m.buffer.height);
  near(e.camera.zoomX, m.buffer.width / viewWidth); near(e.camera.zoomY, contract.courtyard ? m.buffer.width / viewWidth : m.buffer.height / e.world.height);
  near(e.camera.view.width, Math.round(viewWidth)); near(e.camera.view.height, Math.round(contract.courtyard ? e.bounds.bottom-e.bounds.top : viewHeight));
  if (contract.courtyard) { assert.ok(e.camera.view.x >= -.001 && e.camera.view.x+e.camera.view.width <= e.world.width+.001); assert.ok(e.camera.view.y >= -.001 && e.camera.view.y+e.camera.view.height <= e.world.height+.001); }
  else { near(e.camera.scrollX,0); near(e.camera.scrollY,0); }
  near(e.cssPixelsPerLogicalUnit, m.stage.width / 360);
  assert.equal(e.bodies.cat.radius, 12); near(e.bodies.cat.width, 24); near(e.bodies.cat.height, 24);
  near(e.bodies.cat.center.x, e.bodies.cat.visual.x); near(e.bodies.cat.center.y, e.bodies.cat.visual.y);
  const inset = contract.courtyard ? 18 : 29;
  assert.ok(s.player.x >= inset-.01 && s.player.x <= e.world.width-inset+.01); assert.ok(s.player.y >= (contract.courtyard ? inset : e.bounds.top+inset)-.01 && s.player.y <= (contract.courtyard ? e.world.height-inset : e.bounds.bottom-inset)+.01);
  return { ...m, engine: e, elapsed: s.elapsed, catId: s.catId, rulesVersion: s.rulesVersion };
}
async function heldResizeChecks() {
  for (const q of ['standard', 'low']) await check(q + ' same-size safe-area resize interrupts native held touch until explicit continue', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }), page = await context.newPage(), cdp = await context.newCDPSession(page);
    page.on('pageerror', error => consoleErrors.push(error.stack||String(error))); page.setDefaultTimeout(5000);
    try {
      await boot(page); await quality(page, q); await click(page, 'resume');
      await page.waitForFunction(() => !JSON.parse(document.getElementById('app').dataset.state).engine.paused);
      await page.evaluate(() => {
        const canvas = document.querySelector('#stage canvas'), width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
        window.heldResizeWrites = 0;
        Object.defineProperty(canvas, 'width', { configurable: true, get() { return width.get.call(canvas); }, set(value) { window.heldResizeWrites++; width.set.call(canvas, value); } });
        Object.defineProperty(canvas, 'height', { configurable: true, get() { return height.get.call(canvas); }, set(value) { window.heldResizeWrites++; height.set.call(canvas, value); } });
        document.getElementById('stage').addEventListener('touchstart', event => { window.heldTouchTrusted = event.isTrusted; }, { capture: true, once: true, passive: true });
        document.documentElement.style.setProperty('--safe-area-inset-top', '15px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '10px');
        window.dispatchEvent(new Event('resize'));
      });
      const noHeld = await state(page);
      assert.equal(noHeld.engine.paused, false); assert.equal(noHeld.moveHeld, false); assert.deepEqual(noHeld.reasons, []);
      const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await touch('touchStart', [{ id: 1, x: 100, y: 825 }]); await touch('touchMove', [{ id: 1, x: 132, y: 825 }]);
      await page.waitForFunction(() => { const s = JSON.parse(document.getElementById('app').dataset.state); return s.moveHeld && s.engine.velocity.x > 100; });
      const held = await state(page);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-area-inset-top', '30px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '20px');
        window.dispatchEvent(new Event('resize'));
      });
      const interrupted = await state(page); await page.waitForTimeout(140); const frozen = await state(page);
      const measured = await page.evaluate(() => ({ layout: JSON.parse(document.getElementById('app').dataset.layout), writes: window.heldResizeWrites, trusted: window.heldTouchTrusted }));
      fs.writeFileSync(path.join(out, q + '-held-safe-area-observed.json'), JSON.stringify({ noHeld, held, interrupted, frozen, measured }, null, 2));
      assert.equal(interrupted.moveHeld, false); assert.ok(interrupted.reasons.includes('inputLost')); assert.equal(interrupted.engine.paused, true);
      assert.equal(interrupted.engine.velocity.x, 0); assert.deepEqual(frozen.player, interrupted.player); assert.equal(frozen.elapsed, interrupted.elapsed);
      assert.equal(measured.trusted, true); assert.equal(measured.writes, 0); assert.equal(measured.layout.safeTop, 30); assert.equal(measured.layout.safeBottom, 20); assert.ok(measured.layout.touchArea.bottom < 825);
      assert.deepEqual(interrupted.engine.buffer, held.engine.buffer); assert.equal(interrupted.engine.quality, q);
      // Continue through the real action handler while the original touch is
      // still held, then move that old finger: it must never acquire ownership.
      await page.locator('button[data-action="resume"]:visible').evaluate(button => button.click());
      await page.waitForFunction(() => !JSON.parse(document.getElementById('app').dataset.state).engine.paused);
      await touch('touchMove', [{ id: 1, x: 150, y: 825 }]); await page.waitForTimeout(100); const continued = await state(page);
      assert.equal(continued.moveHeld, false); assert.equal(continued.engine.paused, false); assert.deepEqual(continued.reasons, []); assert.equal(continued.engine.velocity.x, 0); assert.deepEqual(continued.player, interrupted.player);
      await touch('touchEnd', []); return { noHeld, held, interrupted, frozen, continued, measured };
    } finally { await context.close(); }
  });
}
async function fixtures() {
  const {runtimeImagePath}=require('../src/runtime-image-path.cjs');
  const base = process.env.RENDER_BASE_COMMIT;
  assert.ok(!(atlasAB && renderAB), 'select either --ab or --atlas-ab');
  if (atlasAB || renderAB || startupOnly) assert.match(base || '', /^[a-f0-9]{40}$/, 'A/B requires the full actual RENDER_BASE_COMMIT');
  const variants = atlasAB || renderAB || startupOnly ? ['before', 'after'] : ['after'], observations = {};
  for (const variant of variants) {
    const before = variant === 'before', app = path.join(root, 'app'), fixtureDist = path.join(out, variant + '-fixture');
    // Only these independent bundles export internals. No production HP, duration,
    // rules or assets are changed; A/B reads source from the explicit real base.
    const original = file => execFileSync('git', ['show', base + ':app/' + file], { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 });
    const read = file => (renderAB || startupOnly) && before ? original(file).toString('utf8') : fs.readFileSync(path.join(app, file), 'utf8');
    // Renderer A/B always keeps the real base atlas on BOTH sides. Atlas A/B
    // uses the current renderer on BOTH sides, and only fixes PNG/metadata.
    const oldAtlas = renderAB || before, atlasPng = oldAtlas ? original('assets/atlas.png') : fs.readFileSync(path.join(app, 'assets/atlas.png'));
    const atlasSource = oldAtlas ? original('src/atlas.ts').toString('utf8') : fs.readFileSync(path.join(app, 'src/atlas.ts'), 'utf8');
    const cellSize = oldAtlas ? 64 : 128;
    fs.cpSync(config.dist, fixtureDist, { recursive: true });
    const plugins = [];
    if (atlasAB || renderAB || startupOnly) {
      fs.writeFileSync(path.join(fixtureDist, config.entryFile('style.css')), read('style.css'));
      for (const {file} of manifest.files.filter(row=>row.file.endsWith('.webp'))) {
        const png=file.replace(/\.webp$/,'.png');
        const source=contract.courtyard&&/^assets\/ui\/CAT0[123]\.png$/.test(png)
          ? 'assets/r1-restoration/ui-'+path.basename(png) : png;
        fs.copyFileSync(path.join(app,source),path.join(fixtureDist,png));
      }
      fs.writeFileSync(path.join(fixtureDist, 'assets/atlas.png'), atlasPng);
      plugins.push({ name:'historical-source-read', setup(builder) {
        builder.onLoad({filter:/[\\/]runtime-image-path\.cjs$/},()=>({contents:'exports.runtimeImagePath = path => path;',loader:'js'}));
        builder.onLoad({filter:/[\\/]src[\\/](?:main|battle|atlas)\.ts$/},args=>{
          const file=path.basename(args.path);
          return {contents:file==='atlas.ts'?atlasSource:read('src/'+file),loader:'ts',resolveDir:path.join(app,'src')};
        });
      }});
    }
    await build(await require('./browser-fixture-options.cjs')(config, { outfile: path.join(fixtureDist, config.entryFile('main.js')), plugins, testInputDiagnostics: true }));
    fixtureVariants.push({ variant, mode: startupOnly ? 'startup-ab' : atlasAB ? 'atlas-ab' : renderAB ? 'renderer-ab' : 'current', baseCommit: base || null,
      rendererSource: (renderAB || startupOnly) && before ? 'base' : 'current', atlasSource: oldAtlas ? 'base' : 'current',
      sourceHashes: ['src/battle.ts', 'src/main.ts', 'style.css', 'src/rules.ts', 'src/combat-config.ts'].map(file => ({ file, sha256: sha(read(file)) })),
      atlasMetadataSha256: sha(contract.courtyard&&!atlasAB&&!renderAB&&!startupOnly?fs.readFileSync(path.join(app,'src/r1-art/atlas.json')):atlasSource), assets: (contract.courtyard ? ['assets/r1-restoration/enemies.png','assets/ui/CAT01.png','assets/ui/CAT02.png','assets/ui/CAT03.png'] : ['assets/atlas.png', 'assets/cat.png', 'assets/ui/CAT01.png', 'assets/ui/CAT02.png', 'assets/ui/CAT03.png']).map(name => {
        const file=atlasAB||renderAB||startupOnly?name:runtimeImagePath(name);
        return {file,sha256:sha(fs.readFileSync(path.join(fixtureDist,file)))};
      }),
      mainSha256: sha(fs.readFileSync(path.join(fixtureDist, config.entryFile('main.js')))) });
    fixtureVariants[fixtureVariants.length - 1].testInputDiagnostics = true;
    server.kill(); server = spawn(process.execPath, [path.join(app, 'tools/serve.mjs')], { cwd: app, env: { ...process.env, PORT: '8832', APP_DIST: fixtureDist }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
    if (startupOnly) {
      observations[variant] = [];
      for (const catId of ['CAT01', 'CAT02', 'CAT03']) for (const q of ['standard', 'low']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }), page = await context.newPage();
        page.on('pageerror', error => consoleErrors.push(error.stack||String(error)));
        try {
          await page.goto('http://127.0.0.1:8832/'); await page.waitForFunction(() => document.getElementById('app').dataset.ready === 'true');
          await click(page, 'settings'); await page.locator('#quality').selectOption(q === 'low' ? '低' : '标准'); await click(page, 'close');
          await click(page, 'select'); await click(page, 'choose:' + catId); await click(page, 'confirm-select');
          const sample = action => page.evaluate(action => {
            const arena = window.densityArena, loop = arena.game.loop, wake = loop.wake;
            // Identical independent-fixture boundary on both versions: suppress
            // only wake's immediate tick, without writing time/actors/rules.
            loop.sleep(); loop.wake = () => {};
            try {
              let button = document.querySelector('button[data-action="' + action + '"]');
              if (action === 'restart') { button = document.createElement('button'); button.dataset.action = 'restart'; button.style.cssText = 'position:fixed;left:-1000px;top:-1000px;width:1px;height:1px;visibility:hidden'; document.body.appendChild(button); }
              button.click();
              if (action === 'start') document.querySelector('button[data-action="chapter-skip"]')?.click();
              const state = window.densityBattle.snapshot();
              if (action === 'restart') button.remove();
              return { player: state.player, targets: state.targets, bounds: state.engine.bounds, elapsed: state.elapsed, catId: state.catId, weaponId: state.weaponId,
                rulesVersion: state.rulesVersion, moveHeld: state.moveHeld, presentation: state.engine.quality ? { quality: state.engine.quality, density: state.engine.density } : null,
                activation: JSON.parse(document.getElementById('app').dataset.inputEvents).filter(event => event.action === action).pop(),
                ui: JSON.parse(document.getElementById('app').dataset.ui) };
            } finally { loop.wake = wake; loop.sleep(); }
          }, action);
          const first = await sample('start'), restart = await sample('restart');
          observations[variant].push({ catId, quality: q, first, restart });
        } finally { await context.close(); }
      }
      fs.writeFileSync(path.join(out, variant + '-startup-observed.json'), JSON.stringify(observations[variant], null, 2));
      continue;
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }), page = await context.newPage();
    page.on('pageerror', error => consoleErrors.push(error.stack||String(error))); await boot(page);
    observations[variant] = [];
    try {
      for (const catId of ['CAT01', 'CAT02', 'CAT03']) {
        await check(variant + ' controlled elapsed=0 ' + catId + ' original physical center/range/emitter', async () => {
          const observed = await page.evaluate(catId => {
            const arena = window.densityArena, battle = window.densityBattle, loop = arena.game.loop, wake = loop.wake;
            loop.sleep(); loop.wake = () => {};
            const run = window.densityRun(catId, { CAT01: 'W01', CAT02: 'W04', CAT03: 'W02' }[catId], 'p2-basic');
            battle.start(run); battle.pause('menu'); loop.wake = wake;
            // Arrange the same world scene at the exact same effective time.
            for (const actor of arena.densityGallery || []) actor.destroy();
            arena.densityGallery = ['enemy-0', 'enemy-1', 'bell', 'crate', 'fish', 'bone', 'spirit', 'spirit-shot'].map((frame, index) => {
              const size = frame.startsWith('enemy') ? 36 : frame === 'crate' ? 40 : frame === 'spirit' ? 28 : 18;
              return arena.add.image(50 + index % 4 * 85, 190 + Math.floor(index / 4) * 70, 'atlas', frame).setDisplaySize(size, size).setDepth(6);
            });
            for (const group of [arena.enemies, arena.objects, arena.projectiles]) for (const actor of group.getChildren()) arena.recycle(actor, group);
            const body = arena.cat.body; body.reset(180, 430); body.updateFromGameObject(); body.prev.copy(body.position); body.prevFrame.copy(body.position);
            arena.spirit?.setPosition(146, 402);
            window.fixturePlace(arena, arena.enemies, 80, .2, 'enemy'); window.fixturePlace(arena, arena.enemies, 275, .35, 'enemy'); window.fixturePlace(arena, arena.objects, 275, .75, 'object');
            arena.fire({ id: 9001, x: 1, y: 0 });
            const shots = arena.projectiles.getChildren().filter(sprite => sprite.active).map(sprite => ({ center: { x: sprite.body.center.x, y: sprite.body.center.y }, radius: sprite.body.halfWidth, width: sprite.displayWidth }));
            const cat = { x: arena.cat.x, y: arena.cat.y, width: arena.cat.displayWidth, height: arena.cat.displayHeight, radius: body.halfWidth, center: { x: body.center.x, y: body.center.y } };
            arena.cameras.main.preRender();
            const coords = [0, .25, .5, .75, 1].map(f => { const r = arena.game.canvas.getBoundingClientRect(), page = { x: r.left + r.width * f, y: r.top + r.height * f }; return { page, world: battle.pageToWorld(page.x + scrollX, page.y + scrollY), native: { ...arena.cameras.main.getWorldPoint(arena.scale.transformX(page.x+scrollX),arena.scale.transformY(page.y+scrollY)) } };  });
            arena.game.renderer.preRender(); arena.game.scene.render(arena.game.renderer); arena.game.renderer.postRender();
            const texture = arena.textures.get('atlas'), image = texture.getSourceImage();
            const framePixels = texture.getFrameNames().map(id => {
              const frame = texture.get(id), canvas = document.createElement('canvas'); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
              const ctx = canvas.getContext('2d'); ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let nonzero = 0, partial = 0, outerEdge = 0, minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
              for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3]; if (!alpha) continue;
                nonzero++; if (alpha < 255) partial++;
                if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) outerEdge++;
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
              }
              return { id, rect: { x: frame.cutX, y: frame.cutY, width: frame.cutWidth, height: frame.cutHeight }, nonzero, partial, outerEdge,
                margins: { left: minX, top: minY, right: canvas.width - maxX - 1, bottom: canvas.height - maxY - 1 } };
            });
            return { elapsed: battle.snapshot().elapsed, run, frozen: Object.isFrozen(run) && Object.isFrozen(run.weapon), cat, shots, coords, engine: battle.snapshot().engine,
              frames: texture.getFrameNames(), framePixels, wiggleFrames: arena.anims.get('wiggle').frames.map(frame => frame.textureFrame),
              gallery: arena.densityGallery.map(sprite => ({ id: sprite.frame.name, width: sprite.displayWidth, height: sprite.displayHeight })),
              atlasSize: { width: image.width, height: image.height } };
          }, catId);
          const displaySize=contract.courtyard?contract.COMBAT_SLICE.displaySize:58;
          assert.equal(observed.elapsed, 0); assert.equal(observed.frozen, true); assert.equal(observed.cat.width, displaySize); assert.equal(observed.cat.height, displaySize); assert.equal(observed.cat.radius, 12);
          assert.equal(observed.run.weapon.targetRange, 240); assert.equal(observed.run.spirit.targetRange, 260);
          near(observed.cat.x, observed.cat.center.x); near(observed.cat.y, observed.cat.center.y);
          for (const shot of observed.shots) { near(shot.center.x, observed.cat.center.x); near(shot.center.y, observed.cat.center.y); assert.equal(shot.radius, 0); assert.equal(shot.width, 18); }
          assert.equal(observed.shots.length, observed.run.weapon.pellets); if (!contract.courtyard) assert.deepEqual(observed.atlasSize, { width: 512, height: cellSize === 64 ? 64 : 256 });
          if (!contract.courtyard) assert.deepEqual(observed.frames, frameIds); else for (const id of frameIds) assert.ok(observed.frames.includes(id),id); assert.deepEqual(observed.wiggleFrames, ['enemy-0', 'enemy-1']);
          observed.framePixels.forEach((frame, index) => {
            if (!contract.courtyard) assert.deepEqual(frame.rect, { x: index % (cellSize === 64 ? 8 : 4) * cellSize, y: Math.floor(index / (cellSize === 64 ? 8 : 4)) * cellSize, width: cellSize, height: cellSize });
            assert.ok(frame.nonzero > 0); if (!contract.courtyard) { assert.ok(frame.partial > 0); assert.equal(frame.outerEdge, 0); assert.ok(Object.values(frame.margins).every(margin => margin > 0)); }
            const size = frame.id.startsWith('enemy') ? 36 : frame.id === 'crate' ? 40 : frame.id === 'spirit' ? 28 : 18;
            if (!contract.courtyard) assert.deepEqual(observed.gallery[index], { id: frame.id, width: size, height: size });
          });
          for (let index = 0; index < observed.coords.length; index++) { const point=observed.coords[index], f=index/4; near(point.world.x,point.native.x,5e-5); near(point.world.y,point.native.y,5e-5); if (!contract.courtyard) { near(point.world.x,contract.WORLD_WIDTH*f,5e-5); if (!(renderAB&&before)) near(point.world.y,contract.WORLD_WIDTH*844/390*f,5e-5); } }
          await page.locator('#stage canvas').screenshot({ path: path.join(out, variant + '-' + catId + '-DPR2.png') });
          await page.evaluate(() => { const arena = window.densityArena; arena.background.setVisible(false); arena.cameras.main.setBackgroundColor('#25352b'); arena.game.renderer.preRender(); arena.game.scene.render(arena.game.renderer); arena.game.renderer.postRender(); });
          await page.locator('#stage canvas').screenshot({ path: path.join(out, variant + '-' + catId + '-DPR2-dark.png') });
          await page.evaluate(() => { window.densityArena.background.setVisible(true); });
          observations[variant].push(observed); return observed;
        });
      }
      if (!before) {
        if (contract.courtyard) await check('courtyard camera follows real body to center and four world edges across density changes', async () => {
          const observed = await page.evaluate(world => {
            const arena=window.densityArena,battle=window.densityBattle,rows=[],inset=arena.cat.displayWidth/2;
            for (const point of [{x:world.width/2,y:world.height/2},{x:inset,y:inset},{x:world.width-inset,y:inset},{x:inset,y:world.height-inset},{x:world.width-inset,y:world.height-inset}]) {
              window.fixturePosition(arena.cat,point.x,point.y); arena.cameras.main.preRender(); arena.syncCourtyardBackground();
              const before=battle.snapshot(); battle.setPresentation({quality:'low'});const low=battle.snapshot();battle.setPresentation({quality:'standard'});const standard=battle.snapshot();
              rows.push({point,before,low,standard});
            }
            return rows;
          },contract.COURTYARD);
          for (const row of observed) {
            for (const sample of [row.before,row.low,row.standard]) assertGeometry({...await metrics(page),buffer:{width:sample.engine.buffer.width,height:sample.engine.buffer.height}},sample,sample.engine.quality);
            for (const axis of ['x','y']) { near(row.low.engine.camera.view[axis],row.before.engine.camera.view[axis],.001);near(row.standard.engine.camera.view[axis],row.before.engine.camera.view[axis],.001); }
            if (row.point.x===18) near(row.before.engine.camera.view.x,0,.001);
            if (row.point.x===contract.COURTYARD.width-18) near(row.before.engine.camera.view.x+row.before.engine.camera.view.width,contract.COURTYARD.width,.001);
            if (row.point.y===18) near(row.before.engine.camera.view.y,0,.001);
            if (row.point.y===contract.COURTYARD.height-18) near(row.before.engine.camera.view.y+row.before.engine.camera.view.height,contract.COURTYARD.height,1);
          }
          return observed;
        });
        await check('same-size resize refreshes native safe-area layout while paused without buffer writes', async () => {
          await click(page, 'pause');
          const observed = await page.evaluate(async () => {
            const battle = window.densityBattle, app = document.getElementById('app'), canvas = document.querySelector('#stage canvas');
            const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
            let writes = 0;
            Object.defineProperty(canvas, 'width', { configurable: true, get() { return width.get.call(canvas); }, set(value) { writes++; width.set.call(canvas, value); } });
            Object.defineProperty(canvas, 'height', { configurable: true, get() { return height.get.call(canvas); }, set(value) { writes++; height.set.call(canvas, value); } });
            const before = battle.snapshot(), stage = document.getElementById('stage').getBoundingClientRect();
            try {
              document.documentElement.style.setProperty('--safe-area-inset-top', '30px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '20px');
              window.dispatchEvent(new Event('resize')); await new Promise(resolve => setTimeout(resolve, 100));
              const probe = getComputedStyle(document.getElementById('safe-area-probe')), style = getComputedStyle(app), hud = document.getElementById('hud').getBoundingClientRect(), after = battle.snapshot();
              return { beforeElapsed: before.elapsed, afterElapsed: after.elapsed, beforeReasons: before.reasons, afterReasons: after.reasons,
                paused: after.engine.paused, moveHeld: after.moveHeld, writes, stage: { width: stage.width, height: stage.height },
                probe: { top: parseFloat(probe.paddingTop), bottom: parseFloat(probe.paddingBottom) },
                contentTop: parseFloat(style.getPropertyValue('--content-top')), safeBottom: parseFloat(style.getPropertyValue('--safe-bottom')),
                layout: JSON.parse(app.dataset.layout), hudTop: hud.top, bounds: after.engine.bounds,
                hudScreenBottom: battle.pageToInput(hud.left+scrollX,hud.bottom+8+scrollY).y, hudWorldBottom: battle.pageToWorld(hud.left + scrollX, hud.bottom + 8 + scrollY).y, camera: after.engine.camera, bounds: after.engine.bounds, buffer: after.engine.buffer };
            } finally {
              document.documentElement.style.removeProperty('--safe-area-inset-top'); document.documentElement.style.removeProperty('--safe-area-inset-bottom');
              window.dispatchEvent(new Event('resize')); delete canvas.width; delete canvas.height;
            }
          });
          fs.writeFileSync(path.join(out, 'safe-area-observed.json'), JSON.stringify(observed, null, 2));
          assert.deepEqual(observed.stage, { width: 390, height: 844 }); assert.deepEqual(observed.probe, { top: 30, bottom: 20 });
          assert.equal(observed.contentTop, 94); assert.equal(observed.safeBottom, 20); assert.equal(observed.layout.safeTop, 30); assert.equal(observed.layout.safeBottom, 20); assert.equal(observed.hudTop, 94);
          assert.equal(observed.writes, 0); assert.equal(observed.afterElapsed, observed.beforeElapsed); assert.deepEqual(observed.afterReasons, observed.beforeReasons);
          assert.equal(observed.paused, true); assert.equal(observed.moveHeld, false); if (!contract.courtyard) near(observed.bounds.top, observed.hudWorldBottom); else near(observed.bounds.top, observed.hudScreenBottom);
          assert.equal(observed.camera.width, observed.buffer.width); near(observed.camera.height,contract.courtyard?(observed.bounds.bottom-observed.bounds.top)*observed.camera.zoomY:observed.buffer.height); return observed;
        });
        await check('snapshot/render do not resize buffer; changed quality resizes only once', async () => {
          const result = await page.evaluate(async () => {
            const arena = window.densityArena, battle = window.densityBattle, canvas = arena.game.canvas;
            const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
            let writes = 0;
            Object.defineProperty(canvas, 'width', { configurable: true, get() { return width.get.call(canvas); }, set(value) { writes++; width.set.call(canvas, value); } });
            Object.defineProperty(canvas, 'height', { configurable: true, get() { return height.get.call(canvas); }, set(value) { writes++; height.set.call(canvas, value); } });
            for (let i = 0; i < 100; i++) battle.snapshot(); battle.resume();
            await new Promise(resolve => setTimeout(resolve, 100)); battle.pause('menu'); const renderWrites = writes;
            const elapsed = battle.snapshot().elapsed; battle.setPresentation({ quality: 'low' }); const changedWrites = writes;
            for (let i = 0; i < 100; i++) battle.snapshot(); battle.setPresentation({ quality: 'low' });
            await new Promise(resolve => setTimeout(resolve, 100)); const repeatedWrites = writes, after = battle.snapshot();
            battle.setPresentation({ quality: 'standard' }); delete canvas.width; delete canvas.height;
            return { renderWrites, changedWrites, repeatedWrites, elapsed, afterElapsed: after.elapsed, camera: after.engine.camera, bounds: after.engine.bounds, buffer: after.engine.buffer };
          });
          assert.equal(result.renderWrites, 0); assert.equal(result.changedWrites, 2); assert.equal(result.repeatedWrites, 2); assert.equal(result.afterElapsed, result.elapsed);
          assert.equal(result.camera.width, result.buffer.width); near(result.camera.height,contract.courtyard?(result.bounds.bottom-result.bounds.top)*result.camera.zoomY:result.buffer.height); return result;
        });
        await check('native POST_RENDER count, scene update independence, pause/background and dispose', async () => {
          const result = await page.evaluate(async () => {
            const arena = window.densityArena, battle = window.densityBattle, game = arena.game;
            battle.pause('menu'); const paused = battle.snapshot().engine.renderFrames, wake = game.loop.wake;
            game.loop.wake = () => {}; battle.resume(); game.loop.wake = wake; game.loop.sleep();
            arena.update(game.loop.now, 0); const manualUpdate = battle.snapshot().engine.renderFrames; battle.pause('menu');
            let renders = 0; const onRender = () => { renders++; }; game.events.on('postrender', onRender);
            battle.resume(); const start = battle.snapshot().engine.renderFrames.sampleCount, first = renders;
            await new Promise(resolve => setTimeout(resolve, 180)); battle.pause('menu');
            const sampled = battle.snapshot().engine.renderFrames, actualRenders = renders - first;
            await new Promise(resolve => setTimeout(resolve, 100)); const frozen = battle.snapshot().engine.renderFrames;
            battle.pause('background'); await new Promise(resolve => setTimeout(resolve, 110)); battle.resume();
            await new Promise(resolve => setTimeout(resolve, 80)); battle.pause('menu'); const resumed = battle.snapshot().engine.renderFrames;
            game.events.off('postrender', onRender);
            // The production page owns layout callbacks while its run is active.
            // End through that owner before disposing the independent controller.
            for (const action of ['pause','end','confirm-end']) document.querySelector('button[data-action="'+action+'"]')?.click();
            const listenersBefore = game.events.listenerCount('postrender'); battle.dispose(); const listenersAfter = game.events.listenerCount('postrender');
            return { paused, manualUpdate, sampled, start, actualRenders, frozen, resumed, listenersBefore, listenersAfter };
          });
          assert.deepEqual(result.manualUpdate, result.paused); assert.deepEqual(result.frozen, result.sampled);
          assert.equal(result.sampled.sampleCount - result.start, result.actualRenders); assert.ok(result.sampled.sampleCount > 0); assert.ok(result.sampled.avgFPS > 0);
          assert.equal(result.resumed.intervalCount - result.sampled.intervalCount, result.resumed.sampleCount - result.sampled.sampleCount - 1, 'first resumed render must not measure the pause/background gap');
          assert.equal(result.listenersAfter, result.listenersBefore - 1);
          return result;
        });
      }
    } finally { await context.close(); }
  }
  if (startupOnly) {
    for (let index = 0; index < observations.before.length; index++) {
      const before = observations.before[index], after = observations.after[index];
      await check(before.catId + ' ' + before.quality + ' real navigation first start and restart preserve base coordinates', async () => {
        for (const phase of ['first', 'restart']) {
          const a = before[phase], b = after[phase]; assert.equal(b.elapsed, 0); assert.equal(a.elapsed, 0);
          for (const observed of [a, b]) { assert.equal(observed.activation.action, phase === 'first' ? 'start' : 'restart'); assert.equal(observed.activation.outcome, 'activated'); }
          near(b.player.x, a.player.x, 5e-5); near(b.player.y, a.player.y, 5e-5);
          assert.equal(b.targets.length, a.targets.length);
          b.targets.forEach((target, i) => { assert.equal(target.id, a.targets[i].id); assert.equal(target.kind, a.targets[i].kind); near(target.x, a.targets[i].x, 5e-5); near(target.y, a.targets[i].y, 5e-5); });
          assert.equal(b.catId, a.catId); assert.equal(b.weaponId, a.weaponId); assert.equal(b.rulesVersion, a.rulesVersion); assert.equal(b.moveHeld, false);
          assert.deepEqual(b.ui.runLoadout, a.ui.runLoadout); assert.equal(b.presentation.quality, before.quality); assert.equal(b.presentation.density, before.quality === 'low' ? 1 : 2);
        }
        return { before, after, method: 'Real settings/select/start/restart action handlers in independent fixture; only immediate Phaser wake tick suppressed; no time/spawn/actor/rule writes; restart uses a fixture button dispatching the production restart action; not natural gameplay evidence' };
      });
    }
    return;
  }
  if (observations.before) await check(atlasAB ? 'atlas A/B changes only atlas pixels/metadata under the same current renderer' : 'renderer A/B keeps real base atlas pixels/metadata on both sides', async () => {
    for (let i = 0; i < 3; i++) {
      const before = observations.before[i], after = observations.after[i]; assert.ok(before && after);
      assert.deepEqual(after.run, before.run); assert.deepEqual(after.cat, before.cat); assert.deepEqual(after.shots, before.shots); assert.deepEqual(after.frames, before.frames); assert.deepEqual(after.gallery, before.gallery);
      if (atlasAB) {
        assert.deepEqual(after.engine.camera, before.engine.camera); assert.deepEqual(after.engine.buffer, before.engine.buffer); assert.deepEqual(after.coords, before.coords);
        after.framePixels.forEach((frame, index) => { for (const side of ['left', 'top', 'right', 'bottom']) near(frame.margins[side] / 128, before.framePixels[index].margins[side] / 64, 1 / 64); });
      }
    }
    const [before, after] = fixtureVariants;
    for (let index = 0; index < before.assets.length; index++) {
      const a = after.assets[index], b = before.assets[index];
      if (atlasAB && a.file === 'assets/atlas.png') assert.notEqual(a.sha256, b.sha256); else assert.deepEqual(a, b);
      if (a.file !== 'assets/atlas.png') assert.equal(a.sha256, sha(execFileSync('git', ['show', base + ':app/' + a.file], { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 })), 'unchanged original asset: ' + a.file);
    }
    if (atlasAB) { assert.deepEqual(after.sourceHashes, before.sourceHashes); assert.notEqual(after.atlasMetadataSha256, before.atlasMetadataSha256); }
    else assert.equal(after.atlasMetadataSha256, before.atlasMetadataSha256);
    return { baseCommit: base, variants: fixtureVariants, scene: 'independent fixture; exact elapsed=0; original run config and eight original atlas frames' };
  });
}
(async () => {
  try {
    for (const file of manifest.files) assert.equal(sha(fs.readFileSync(path.join(config.dist, file.file))), file.sha256);
    for (const file of manifest.sourceFiles) assert.equal(sha(fs.readFileSync(path.join(root, 'app', file.file))), file.sha256, 'build/package before running checks: ' + file.file);
    server = spawn(process.execPath, [path.join(root, 'app/tools/serve.mjs')], { cwd: path.join(root, 'app'), env: { ...process.env, PORT: '8832', APP_DIST: config.dist }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
    browser = await chromium.launch({ channel: 'chrome', headless: true }); browserVersion = browser.version();
    const combinations = startupOnly || heldResizeOnly || process.argv.includes('--fixtures-only') ? [] : process.argv.includes('--red') ? [[390, 844, 2, 'standard']] : [[320, 568], [360, 640], [390, 844], [430, 932]].flatMap(([w, h]) => [1, 2, 3].flatMap(dpr => ['standard', 'low'].map(q => [w, h, dpr, q])));
    for (const [width, height, dpr, q] of combinations) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true }), page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.on('pageerror', error => consoleErrors.push(error.stack||String(error))); page.setDefaultTimeout(5000);
      try {
        await boot(page); await quality(page, q); const paused = await state(page);
        // Save the raw observation even when the first buffer assertion is RED.
        const raw = await metrics(page); fs.writeFileSync(path.join(out, width + '-' + dpr + '-' + q + '.json'), JSON.stringify({ metrics: raw, state: paused }, null, 2));
        await check(width + 'x' + height + ' DPR' + dpr + ' ' + q + ' CSS/buffer/world/Camera', async () => assertGeometry(raw, paused, q));
        if (process.argv.includes('--red')) continue;
        await check(width + ' DPR' + dpr + ' ' + q + ' input and paused quality/restart', async () => {
          await page.waitForTimeout(80); assert.equal((await state(page)).elapsed, paused.elapsed);
          await click(page, 'resume');
          await page.waitForFunction(() => !JSON.parse(document.getElementById('app').dataset.state).engine.paused);
          const m = await metrics(page), x = m.css.x + m.css.width * .5, y = height * .52;
          const before = await state(page);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
          await page.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.state).moveHeld);
          // Phaser's camera matrix uses Float32 entries; bound that native error
          // well below one screen pixel rather than asserting double precision.
          const down = await state(page); assert.equal(down.moveHeld, true); near(down.moveStick.x, 180, 5e-5); near(down.moveStick.y, (y - m.css.y) * 360 / m.css.width, 5e-5);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 6, y }] }); await page.waitForTimeout(80);
          near((await state(page)).player.x, before.player.x, .1);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 32, y }] }); await page.waitForTimeout(100);
          const moved = await state(page); assert.ok(moved.player.x > before.player.x + 5); near(moved.engine.velocity.x, contract.normalRun(moved.catId).moveSpeed, 1e-4);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await click(page, 'pause'); const frozen = await state(page); await click(page, 'settings');
          await page.locator('#quality').selectOption(q === 'low' ? '标准' : '低'); await click(page, 'close'); await page.waitForTimeout(80);
          const switched = await state(page); assert.equal(switched.elapsed, frozen.elapsed); assert.equal(switched.engine.paused, true);
          assertGeometry(await metrics(page), switched, q === 'low' ? 'standard' : 'low');
          await click(page, 'end'); await click(page, 'confirm-end'); await click(page, 'start');
          assert.equal((await state(page)).engine.quality, q === 'low' ? 'standard' : 'low');
          const restartSamples = (await state(page)).engine.renderFrames; assert.ok(restartSamples.sampleCount < switched.engine.renderFrames.sampleCount);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 32, y }] });
          await page.setViewportSize({ width: height, height: width }); await page.waitForTimeout(180);
          const resized = await state(page); assert.equal(resized.moveHeld, false); assert.ok(resized.reasons.includes('inputLost')); assert.equal(resized.engine.paused, true);
          assertGeometry(await metrics(page), resized, q === 'low' ? 'standard' : 'low');
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          return { down: down.moveStick, velocity: moved.engine.velocity, switched: switched.engine, resized: resized.engine };
        });
      } finally { await context.close(); }
    }
    if (heldResizeOnly || !startupOnly && !process.argv.includes('--fixtures-only') && !process.argv.includes('--red')) await heldResizeChecks();
    if (!heldResizeOnly && !process.argv.includes('--red')) await fixtures();
  } catch (error) { checks.push({ name: 'suite', status: 'FAIL', error: String(error) }); }
  finally {
    if (browser) await browser.close(); if (server) server.kill();
    const report = { status: checks.some(c => c.status === 'FAIL') || consoleErrors.length ? 'FAIL' : 'PASS', atUtc: new Date().toISOString(), browserVersion,
      profile: manifest.profile, candidate:config.identity, sourceBaseCommit: manifest.sourceBaseCommit, sourceFiles: manifest.sourceFiles, runnerSha256, fixtureVariants, artifactKind: config.artifactKind, receipt: config.receipt, zipSha256: config.artifactKind === 'archive' ? manifest.sha256 : null, checks, consoleErrors,
      screenshots: fs.readdirSync(out).filter(file => file.endsWith('.png')).map(file => ({ file, sha256: sha(fs.readFileSync(path.join(out, file))) })),
      environment: 'Windows / Chrome desktop DPR emulation / real Canvas rendering and synthetic CDP input', platform: 'NOT_TESTED', phone: 'NOT_TESTED' };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ out, status: report.status, checks: checks.length, failures: checks.filter(c => c.status === 'FAIL'), consoleErrors })); process.exitCode = report.status === 'PASS' ? 0 : 1;
  }
})();
