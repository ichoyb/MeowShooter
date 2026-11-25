// Arena/controller exports and altered Clock values exist only in this independent fixture bundle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'app/package.json'))).version;
const config = require('./release-test-config.cjs')(root), manifest = config.candidate, contract = require('./release-profile-contract.cjs')(config);
config.verify();
const out = path.join(config.qa, 'fixtures', new Date().toISOString().replace(/[:.]/g, '-'));
const fixtureDist = path.join(out, 'dist'), sourcePath = path.join(root, 'app/src/battle.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex'), sourceSha = sha(source);
const checks = [], consoleErrors = [];
let server, browser, browserVersion = null;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);
async function check(name, run) { try { checks.push({ name, status: 'PASS', observed: await run() }); } catch (error) { checks.push({ name, status: 'FAIL', error: String(error) }); } }
async function setup(page, catId = 'CAT01', profile = 'diagnostic', balance = {}) {
  return page.evaluate(({ catId, profile, balance }) => {
    const arena = window.fixtureArena, loop = arena.game.loop, wake = loop.wake;
    // TimeStep.wake calls tick synchronously. Suppress only that fixture tick
    // so start() is observed before an automatic volley; manual updates follow.
    loop.wake = () => {};
    const base = window.fixtureRunConfig(catId, { CAT01: 'W01', CAT02: 'W04', CAT03: 'W02' }[catId], profile);
    window.fixtureBattle.start(Object.freeze({ ...base, ...balance, weapon: Object.freeze({ ...base.weapon, ...balance.weapon }),
      secondary: Object.freeze({ ...base.secondary, ...balance.secondary }), chill: Object.freeze({ ...base.chill, ...balance.chill }),
      spirit: Object.freeze({ ...base.spirit, ...balance.spirit }) }));
    loop.wake = wake;
    arena.game.loop.sleep(); arena.physics.world.resume(); arena.time.paused = false;
    for (const group of [arena.enemies, arena.objects, arena.projectiles]) for (const actor of group.getChildren()) { arena.recycle(actor, group); actor.body.moves = true; }
    const bounds = arena.physics.world.bounds; window.fixturePosition(arena.cat, 29, bounds.top + 29);
    return { top: bounds.top, bottom: bounds.bottom, laneY: bounds.bottom - 50, state: window.fixtureBattle.snapshot(),
      body: { width: arena.cat.body.width, height: arena.cat.body.height, x: arena.cat.body.center.x, y: arena.cat.body.center.y }, sprite: { x: arena.cat.x, y: arena.cat.y } };
  }, { catId, profile, balance });
}
async function collisionFrame(page, fixture) {
  return page.evaluate(({ laneY, targets, start, speed }) => {
    const arena = window.fixtureArena;
    const actors = targets.map(target => {
      const group = target.kind === 'object' ? arena.objects : arena.enemies;
      const sprite = window.fixturePlace(arena, group, target.x, .5, target.kind);
      window.fixturePosition(sprite, target.x, laneY); sprite.setData({ id: target.id, hp: target.hp }); return sprite;
    });
    arena.fire({ id: 9001, x: 1, y: 0 });
    const shot = arena.projectiles.getChildren().find(sprite => (sprite.getData('volleyId') ?? sprite.getData('id')) === 9001);
    window.fixturePosition(shot, start, laneY); shot.setVelocity(speed, 0); const oldTimer = shot.getData('lifeTimer');
    const readShot = () => ({ active: shot.active, enabled: shot.body.enable, hitCount: shot.getData('hitCount'), hitIds: shot.getData('hitIds')?.size,
      prev: { x: shot.body.prev.x + shot.body.halfWidth, y: shot.body.prev.y + shot.body.halfHeight }, center: { x: shot.body.center.x, y: shot.body.center.y } });
    const readActors = () => actors.map(actor => ({ id: actor.getData('id'), kind: actor.getData('kind'), hp: actor.getData('hp'), active: actor.active,
      center: { x: actor.body.center.x, y: actor.body.center.y } }));
    arena.update(performance.now(), 50); arena.sys.events.emit('postupdate');
    const after = { shot: readShot(), targets: readActors(), overlaps: arena.overlapHits, sweeps: arena.sweepHits, lifeTimer: shot.getData('lifeTimer') === null, kills: arena.kills };
    arena.update(performance.now(), 50); arena.sys.events.emit('postupdate');
    const next = { shot: readShot(), targets: readActors(), overlaps: arena.overlapHits, sweeps: arena.sweepHits, kills: arena.kills };
    arena.fire({ id: 9002, x: 1, y: 0 });
    const reused = arena.projectiles.getChildren().find(sprite => (sprite.getData('volleyId') ?? sprite.getData('id')) === 9002), newTimer = reused.getData('lifeTimer');
    arena.time.preUpdate(); arena.time.update(performance.now(), 16);
    const reuse = { sameSprite: reused === shot, differentTimer: oldTimer !== newTimer, oldCallbackRemoved: oldTimer.callback == null,
      active: reused.active, enabled: reused.body.enable, elapsed: newTimer.elapsed, hitIds: reused.getData('hitIds')?.size,
      hitCount: reused.getData('hitCount'), firstEnemyCredited: reused.getData('firstEnemyCredited'), source: reused.getData('source'),
      projectileId: reused.getData('projectileId'), volleyId: reused.getData('volleyId'), alpha: reused.alpha };
    return { after, next, reuse };
  }, fixture);
}
function assertSingleHit(observed, hitPath) {
  assert.equal(observed.after.shot.active, false); assert.equal(observed.after.shot.enabled, false); assert.equal(observed.after.lifeTimer, true);
  assert.equal(observed.after.overlaps, hitPath === 'overlap' ? 1 : 0); assert.equal(observed.after.sweeps, hitPath === 'sweep' ? 1 : 0);
  assert.deepEqual(observed.next.targets.map(target => target.hp), observed.after.targets.map(target => target.hp));
  assert.deepEqual(observed.next.shot.center, observed.after.shot.center);
  assert.equal(observed.next.overlaps, observed.after.overlaps); assert.equal(observed.next.sweeps, observed.after.sweeps);
  assert.equal(observed.reuse.sameSprite, true); assert.equal(observed.reuse.differentTimer, true); assert.equal(observed.reuse.oldCallbackRemoved, true);
  assert.equal(observed.reuse.active, true); assert.equal(observed.reuse.enabled, true); assert.equal(observed.reuse.elapsed, 16);
  assert.equal(observed.reuse.hitIds, 0); assert.equal(observed.reuse.hitCount, 0); assert.equal(observed.reuse.firstEnemyCredited, false);
  assert.equal(observed.reuse.source, 'PRIMARY'); assert.equal(observed.reuse.volleyId, 9002); assert.equal(observed.reuse.alpha, 1);
}
(async () => {
  try {
    fs.mkdirSync(out, { recursive: true });
    const baseDist = process.env.FIXTURE_BASE_DIST || config.dist;
    fs.cpSync(baseDist, fixtureDist, { recursive: true });
    await build(await require('./browser-fixture-options.cjs')(config, { outfile: path.join(fixtureDist, config.entryFile('main.js')) }));
    server = spawn(process.execPath, [path.join(root, 'app/tools/serve.mjs')], { cwd: path.join(root, 'app'), env: { ...process.env, APP_DIST: fixtureDist, PORT: '8828' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    browserVersion = browser.version();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.on('pageerror', error => consoleErrors.push(String(error)));
    await page.addInitScript(() => {
      window.fixtureCatLoads = { CAT01: 0, CAT02: 0, CAT03: 0 };
      const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', { ...src, set(value) {
        const match = String(value).match(/(?:^|\/)CAT(0[123])\.webp$/);
        if (match) window.fixtureCatLoads['CAT' + match[1]]++;
        src.set.call(this, value);
      } });
    });
    await page.goto('http://127.0.0.1:8828/'); await page.waitForFunction(() => document.querySelector('#app').dataset.ready === 'true');
    await page.locator('button[data-action=start]').click();
    await check('battle reuses each already decoded UI cat image without a second image load', async () => {
      const observed = await page.evaluate(() => window.fixtureCatLoads);
      assert.deepEqual(observed, { CAT01: 1, CAT02: 1, CAT03: 1 }); return observed;
    });
    await check('configured run IDs, HP, ammo, duration and breed texture are actual scene values', async () => {
      const observed = [];
      for (const [catId, weaponId, hp, ammo] of [['CAT01', 'W01', 90, 12], ['CAT02', 'W04', 100, 4], ['CAT03', 'W02', 120, 4]]) {
        const { state, body, sprite } = await setup(page, catId, 'p2-basic');
        assert.equal(state.catId, catId); assert.equal(state.weaponId, weaponId); assert.equal(state.hp, hp); assert.equal(state.maxHp, hp);
        assert.equal(state.ammo, ammo); assert.equal(state.ammoCapacity, ammo); assert.equal(state.durationSeconds, contract.run(catId).durationSeconds); assert.equal(state.catTexture, 'cat-' + catId);
        near(body.width, 24); near(body.height, 24); near(body.x, sprite.x); near(body.y, sprite.y); observed.push(state);
      } return observed;
    });
    await check('real Arcade circle radii and visual centers survive all cat textures, entity reuse and resized bounds', async () => {
      const observed = [];
      for (const catId of ['CAT01', 'CAT02', 'CAT03']) {
        await setup(page, catId, 'p2-basic');
        observed.push(await page.evaluate(() => {
          const arena = window.fixtureArena;
          const read = sprite => ({ circle: sprite.body.isCircle, radius: sprite.body.halfWidth, halfHeight: sprite.body.halfHeight,
            center: { x: sprite.body.center.x, y: sprite.body.center.y }, visual: { x: sprite.x, y: sprite.y } });
          const enemy = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'), crate = window.fixturePlace(arena, arena.objects, 280, .5, 'object');
          const first = { cat: read(arena.cat), enemy: read(enemy), crate: read(crate) };
          enemy.setFrame('enemy-1'); enemy.body.updateFromGameObject(); const animationFrame = read(enemy);
          arena.recycle(enemy, arena.enemies); const reused = window.fixturePlace(arena, arena.enemies, 240, .6, 'enemy');
          window.fixtureBattle.setBounds({ top: 110, bottom: 600 });
          window.fixturePosition(arena.cat, 0, 0); arena.correctBounds(arena.cat);
          const topLeft = read(arena.cat); window.fixturePosition(arena.cat, arena.physics.world.bounds.right, arena.physics.world.bounds.bottom); arena.correctBounds(arena.cat);
          return { first, animationFrame, reused: read(reused), same: reused === enemy, topLeft, bottomRight: read(arena.cat), state: window.fixtureBattle.snapshot() };
        }));
      }
      for (const row of observed) {
        for (const [kind, radius] of [['cat', 12], ['enemy', contract.courtyard?contract.ENEMIES.E01.radius:18], ['crate', 21]]) {
          assert.equal(row.first[kind].circle, true); assert.equal(row.first[kind].radius, radius); assert.equal(row.first[kind].halfHeight, radius);
          near(row.first[kind].center.x, row.first[kind].visual.x); near(row.first[kind].center.y, row.first[kind].visual.y);
        }
        assert.equal(row.same, true); assert.equal(row.reused.radius, contract.courtyard?contract.ENEMIES.E01.radius:18); assert.deepEqual(row.reused.center, row.reused.visual);
        assert.equal(row.animationFrame.radius, contract.courtyard?contract.ENEMIES.E01.radius:18); assert.deepEqual(row.animationFrame.center, row.animationFrame.visual);
        const inset=(contract.courtyard?36:58)/2; near(row.topLeft.center.x,inset); near(row.topLeft.center.y,contract.courtyard?inset:110+inset); near(row.bottomRight.center.x,(contract.courtyard?contract.COURTYARD.width:contract.WORLD_WIDTH)-inset); near(row.bottomRight.center.y,(contract.courtyard?contract.COURTYARD.height:600)-inset);
        assert.equal(row.state.engine.bodies.cat.radius, 12);
      }
      return observed;
    });
    await check('actual center-point Arcade overlaps preserve enemy18 crate21 and cat contact30 inclusive edges', async () => {
      const observed = [];
      for (const [kind, radius] of [['enemy', 18], ['object', 21]]) for (const offset of [radius, radius + .01]) {
        await setup(page);
        observed.push(await page.evaluate(({ kind, offset }) => {
          const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
          const target = window.fixturePlace(arena, kind === 'enemy' ? arena.enemies : arena.objects, 200, .5, kind); window.fixturePosition(target, 200, y); target.body.moves = false;
          arena.fire({ id: 17000, x: 1, y: 0 }); const shot = arena.projectiles.getChildren().find(actor => actor.active);
          window.fixturePosition(shot, 200 - offset, y); shot.setVelocity(0, 0);
          const physicsOverlap = arena.physics.world.intersects(shot.body, target.body);
          const query = arena.physics.overlapRect; arena.physics.overlapRect = () => [];
          try { arena.update(performance.now(), 50); } finally { arena.physics.overlapRect = query; }
          return { kind, offset, physicsOverlap, hp: target.getData('hp'), radius: shot.body.halfWidth,
            circle: shot.body.isCircle, center: { x: shot.body.center.x, y: shot.body.center.y }, visual: { x: shot.x, y: shot.y } };
        }, { kind, offset }));
      }
      for (const [index, row] of observed.entries()) {
        assert.equal(row.circle, true); assert.equal(row.radius, 0); assert.equal(row.physicsOverlap, index % 2 === 0);
        assert.equal(row.hp, (row.kind === 'enemy' ? 2 : 6) - (index % 2 === 0 ? 1 : 0));
        near(row.center.x, row.visual.x); near(row.center.y, row.visual.y);
      }
      const contact = [];
      for (const distance of [30, 30.01]) {
        await setup(page);
        contact.push(await page.evaluate(distance => {
          const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
          window.fixturePosition(arena.cat, 100, y); const enemy = window.fixturePlace(arena, arena.enemies, 100 + distance, .5, 'enemy'); window.fixturePosition(enemy, 100 + distance, y); enemy.body.moves = false;
          const before = window.fixtureBattle.snapshot().hp, intersects = arena.physics.world.intersects(arena.cat.body, enemy.body);
          arena.update(performance.now(), 50); return { intersects, damage: before - window.fixtureBattle.snapshot().hp };
        }, distance));
      }
      assert.deepEqual(contact, [{ intersects: true, damage: 10 }, { intersects: false, damage: 0 }]); return { observed, contact };
    });
    await check('removing Arcade contact area query prevents actual damage despite intersecting live Bodies', async () => {
      await setup(page);
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
        window.fixturePosition(arena.cat, 100, y); const enemy = window.fixturePlace(arena, arena.enemies, 100, .5, 'enemy'); window.fixturePosition(enemy, 100, y);
        const before = window.fixtureBattle.snapshot().hp, original = arena.physics.overlapCirc;
        arena.physics.overlapCirc = () => [];
        try { arena.update(performance.now(), 50); return { intersects: arena.physics.world.intersects(arena.cat.body, enemy.body), before, after: window.fixtureBattle.snapshot().hp }; }
        finally { arena.physics.overlapCirc = original; }
      });
      assert.equal(observed.intersects, true); assert.equal(observed.after, observed.before); return observed;
    });
    await check('changing only the actual target Body circle changes both endpoint and swept hit eligibility', async () => {
      const observed = [];
      for (const [radius, start, speed] of [[10, 189, 0], [12, 189, 0], [10, 100, 4000], [12, 100, 4000]]) {
        await setup(page);
        observed.push(await page.evaluate(({ radius, start, speed }) => {
          const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
          const target = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'); window.fixtureCircle(target, radius);
          window.fixturePosition(target, 200, y + (speed ? 11 : 0)); target.body.moves = false;
          arena.fire({ id: 17200, x: 1, y: 0 }); const shot = arena.projectiles.getChildren().find(actor => actor.active);
          window.fixturePosition(shot, start, y); shot.setVelocity(speed, 0);
          arena.update(performance.now(), 50); return { radius: target.body.halfWidth, hp: target.getData('hp'), overlaps: arena.overlapHits, sweeps: arena.sweepHits };
        }, { radius, start, speed }));
      }
      assert.deepEqual(observed.map(row => row.hp), [2, 1, 2, 1]); assert.deepEqual(observed.map(row => row.radius), [10, 12, 10, 12]); return observed;
    });
    await check('custom passive damage, spirit speed/life/interval and pierce attenuation are consumed by the real Arena', async () => {
      await setup(page, 'CAT01', 'p2-basic', { secondary: { damageMultiplier: .4 } });
      const orange = await page.evaluate(() => {
        const arena = window.fixtureArena;
        arena.fireVolley({ id: 17500, x: 1, y: 0 });
        return arena.projectiles.getChildren().find(actor => actor.active && actor.getData('source') === 'SECONDARY').getData('damage');
      });
      await setup(page, 'CAT03', 'p2-basic', { spirit: { intervalSeconds: .4, targetRange: 45, damage: 13, bulletSpeed: 420, bulletLifeSeconds: .3 } });
      const spirit = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
        window.fixturePosition(arena.cat, 100, y); const enemy = window.fixturePlace(arena, arena.enemies, 130, .5, 'enemy'); window.fixturePosition(enemy, 130, y); enemy.body.moves = false;
        arena.update(performance.now(), 399); const before = window.fixtureBattle.snapshot().sourceCounts.SUMMON;
        arena.update(performance.now(), 1); const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('source') === 'SUMMON');
        return { before, after: window.fixtureBattle.snapshot().sourceCounts.SUMMON, damage: shot.getData('damage'), speed: shot.body.velocity.length(), life: shot.getData('lifeTimer').delay };
      });
      await setup(page, 'CAT02', 'p2-basic', { weapon: { pierceDamageMultiplier: .5 } });
      const pierce = await collisionFrame(page, { laneY: 400, targets: [{ id: 17501, x: 140, kind: 'enemy', hp: 100 },
        { id: 17502, x: 200, kind: 'enemy', hp: 100 }, { id: 17503, x: 260, kind: 'enemy', hp: 100 }], start: 100, speed: 4000 });
      near(orange, 4.8); assert.equal(spirit.before, 0); assert.equal(spirit.after, 1); assert.equal(spirit.damage, 13); near(spirit.speed, 420); assert.equal(spirit.life, 300);
      for (const [index, hp] of [71.2, 85.6, 92.8].entries()) near(pierce.after.targets[index].hp, hp);
      return { orange, spirit, pierce };
    });
    await check('actual Arcade endpoint and swept area queries independently authorize hits and removing both prevents damage', async () => {
      const observed = [];
      for (const [name, overlap, query, start, speed, hp] of [
        ['endpoint overlap alone', true, false, 200, 0, 1], ['fast spatial query alone', false, true, 100, 4000, 1],
        ['endpoint paths removed', false, false, 200, 0, 2], ['fast paths removed', false, false, 100, 4000, 2],
        ['fast query removed', true, false, 100, 4000, 2]]) {
        await setup(page);
        const row = await page.evaluate(({ overlap, query, start, speed }) => {
          const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
          const enemy = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'); window.fixturePosition(enemy, 200, y); enemy.body.moves = false;
          arena.fire({ id: 18000, x: 1, y: 0 }); const shot = arena.projectiles.getChildren().find(actor => actor.active);
          window.fixturePosition(shot, start, y); shot.setVelocity(speed, 0);
          const originalCirc = arena.physics.overlapCirc;
          const original = arena.physics.overlapRect;
          if (!overlap) arena.physics.overlapCirc = () => [];
          if (!query) arena.physics.overlapRect = () => [];
          const before = { hp: enemy.getData('hp'), center: { x: shot.body.center.x, y: shot.body.center.y }, target: { x: enemy.body.center.x, y: enemy.body.center.y }, damage: shot.getData('damage') };
          try { arena.update(performance.now(), 50); return { before, hp: enemy.getData('hp'), overlaps: arena.overlapHits, sweeps: arena.sweepHits, hitCount: shot.getData('hitCount') }; }
          finally { arena.physics.overlapRect = original; arena.physics.overlapCirc = originalCirc; }
        }, { overlap, query, start, speed });
        assert.equal(row.hp, hp, name + JSON.stringify(row)); assert.equal(row.overlaps + row.sweeps, 2 - hp, name + JSON.stringify(row)); observed.push({ name, ...row });
      }
      return observed;
    });
    await check('role speed and enemy/object HP are consumed by actual Bodies and Groups', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => { const arena = window.fixtureArena;
        const enemy = window.fixturePlace(arena, arena.enemies, 300, .2, 'enemy'), crate = window.fixturePlace(arena, arena.objects, 300, .7, 'object');
        arena.keys.D.isDown = true; arena.update(performance.now(), 50);
        return { speed: arena.cat.body.velocity.x, enemyHp: enemy.getData('hp'), objectHp: crate.getData('hp'), enemySpeed: enemy.body.velocity.length() }; });
      assert.equal(observed.speed, 162); assert.equal(observed.enemyHp, 48); assert.equal(observed.objectHp, 144); near(observed.enemySpeed, contract.courtyard?contract.ENEMIES.E01.speed:24); return observed;
    });
    await check('Clock expiry advances adjacent live TimerEvent in the same official update', async () => {
      await setup(page);
      const observed = await page.evaluate(() => { const arena = window.fixtureArena;
        arena.fire({ id: 8001, x: 1, y: 0 }); arena.fire({ id: 8002, x: 1, y: 0 });
        const shots = arena.projectiles.getChildren().filter(actor => actor.active), first = shots[0], second = shots[1];
        const firstTimer = first.getData('lifeTimer'), secondTimer = second.getData('lifeTimer');
        arena.time.preUpdate(); firstTimer.elapsed = 1490; secondTimer.elapsed = 990; arena.time.update(performance.now(), 16);
        return { firstActive: first.active, firstEnabled: first.body.enable, secondActive: second.active, secondEnabled: second.body.enable, secondElapsed: secondTimer.elapsed }; });
      assert.equal(observed.firstActive, false); assert.equal(observed.firstEnabled, false); assert.equal(observed.secondActive, true); assert.equal(observed.secondEnabled, true); assert.equal(observed.secondElapsed, 1006); return observed;
    });
    await check('4000u/s sweep between outside endpoints recycles and clears Sprite state on reuse', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 100, x: 200, kind: 'enemy', hp: 2 }], start: 100, speed: 4000 });
      const target = observed.after.targets[0], shot = observed.after.shot;
      assert.ok(Math.hypot(shot.prev.x - target.center.x, shot.prev.y - target.center.y) > 18); assert.ok(Math.hypot(shot.center.x - target.center.x, shot.center.y - target.center.y) > 18);
      assertSingleHit(observed, 'sweep'); assert.equal(target.hp, 1); return observed;
    });
    await check('overlap and sweep eligible path damage once and safely reuse Sprite and timer', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 101, x: 200, kind: 'enemy', hp: 2 }], start: 190, speed: 400 });
      assertSingleHit(observed, 'overlap'); assert.equal(observed.after.targets[0].hp, 1); return observed;
    });
    await check('crate before enemy consumes primary hit according to path order', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 102, x: 230, kind: 'enemy', hp: 2 }, { id: 103, x: 170, kind: 'object', hp: 6 }], start: 100, speed: 4000 });
      assertSingleHit(observed, 'sweep'); assert.deepEqual(observed.after.targets.map(target => target.hp), [2, 5]); return observed;
    });
    await check('reverse Group registration does not reverse the first path hit', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 104, x: 230, kind: 'enemy', hp: 2 }, { id: 105, x: 170, kind: 'enemy', hp: 2 }], start: 100, speed: 4000 });
      assertSingleHit(observed, 'sweep'); assert.deepEqual(observed.after.targets.map(target => target.hp), [2, 1]); return observed;
    });
    await check('W01 primary does 12 damage to HP48 enemy', async () => {
      const { laneY } = await setup(page, 'CAT01', 'p2-basic'), observed = await collisionFrame(page, { laneY, targets: [{ id: 106, x: 200, kind: 'enemy', hp: 48 }], start: 100, speed: 4000 });
      assert.equal(observed.after.targets[0].hp, 36); return observed;
    });
    await check('CAT02 W04 does 28.8 and repeat overlap cannot damage the same entity again', async () => {
      const { laneY } = await setup(page, 'CAT02', 'p2-basic'), observed = await collisionFrame(page, { laneY, targets: [{ id: 107, x: 200, kind: 'enemy', hp: 48 }], start: 190, speed: 0 });
      near(observed.after.targets[0].hp, 19.2); near(observed.next.targets[0].hp, 19.2); assert.equal(observed.after.shot.hitCount, 1); return observed;
    });
    await check('W04 entry order wins over endpoint overlap and stops after 3 distinct targets', async () => {
      const { laneY } = await setup(page, 'CAT02', 'p2-basic'), observed = await collisionFrame(page, { laneY, targets: [
        { id: 110, x: 295, kind: 'enemy', hp: 100 }, { id: 111, x: 240, kind: 'enemy', hp: 100 },
        { id: 112, x: 185, kind: 'enemy', hp: 100 }, { id: 113, x: 130, kind: 'enemy', hp: 100 }], start: 80, speed: 4300 });
      near(observed.after.targets[3].hp, 71.2); near(observed.after.targets[2].hp, 79.84); near(observed.after.targets[1].hp, 85.888); assert.equal(observed.after.targets[0].hp, 100);
      assert.equal(observed.after.shot.active, false); assert.equal(observed.after.overlaps, 0); assert.equal(observed.after.sweeps, 3); return observed;
    });
    await check('equal path distance uses stable ID instead of registration order', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 150, x: 200, kind: 'enemy', hp: 2 }, { id: 140, x: 200, kind: 'enemy', hp: 2 }], start: 100, speed: 4000 });
      assert.deepEqual(observed.after.targets.map(target => target.hp), [2, 1]); return observed;
    });
    await check('W04 crate crossing consumes one pierce hit and same attenuation', async () => {
      const { laneY } = await setup(page, 'CAT02', 'p2-basic'), observed = await collisionFrame(page, { laneY, targets: [
        { id: 154, x: 270, kind: 'enemy', hp: 100 }, { id: 153, x: 220, kind: 'enemy', hp: 100 },
        { id: 152, x: 170, kind: 'object', hp: 100 }, { id: 151, x: 120, kind: 'enemy', hp: 100 }], start: 75, speed: 4300 });
      near(observed.after.targets[3].hp, 71.2); near(observed.after.targets[2].hp, 79.84); near(observed.after.targets[1].hp, 85.888); assert.equal(observed.after.targets[0].hp, 100); return observed;
    });
    await check('W02 one real volley creates 5 independent directions and consumes 1 ammo', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => { const arena = window.fixtureArena;
        window.fixturePosition(arena.cat, 100, arena.physics.world.bounds.top + 100);
        const target = window.fixturePlace(arena, arena.objects, 190, 0, 'object'); window.fixturePosition(target, 190, arena.cat.body.center.y); arena.update(performance.now(), 0);
        const state = window.fixtureBattle.snapshot(), shots = arena.projectiles.getChildren().filter(actor => actor.active).map(actor => ({
          angle: Math.atan2(actor.body.velocity.y, actor.body.velocity.x) * 180 / Math.PI, speed: actor.body.velocity.length(), id: actor.getData('projectileId'),
          center: { x: actor.body.center.x, y: actor.body.center.y }, volleyId: actor.getData('volleyId'), frame: actor.frame.name, ttl: actor.getData('lifeTimer').delay })); return { ammo: state.ammo, shots: state.shots, origin: state.player, projectiles: shots }; });
      assert.equal(observed.ammo, 3); assert.equal(observed.shots, 1); assert.equal(observed.projectiles.length, 5);
      for (let i = 0; i < 5; i++) { near(observed.projectiles[i].angle, [-18, -9, 0, 9, 18][i]); near(observed.projectiles[i].speed, 550); assert.equal(observed.projectiles[i].ttl, 550); assert.equal(observed.projectiles[i].frame, 'bone');
        near(observed.projectiles[i].center.x, observed.origin.x); near(observed.projectiles[i].center.y, observed.origin.y); }
      assert.equal(new Set(observed.projectiles.map(shot => shot.id)).size, 5); assert.equal(new Set(observed.projectiles.map(shot => shot.volleyId)).size, 1); return observed;
    });
    await check('5 near W02 pellets hit one target for 40 total, each at most once', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => { const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
        window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.enemies, 120, .5, 'enemy'); window.fixturePosition(target, 120, y);
        arena.update(performance.now(), 0);
        const before = arena.projectiles.getChildren().filter(actor => actor.active).map(actor => ({ id: actor.getData('projectileId'), center: { x: actor.body.center.x, y: actor.body.center.y }, angle: actor.angle }));
        arena.update(performance.now(), 50); const hp = target.getData('hp');
        const after = arena.projectiles.getChildren().map(actor => ({ id: actor.getData('projectileId'), volley: actor.getData('volleyId'), active: actor.active, hits: actor.getData('hitCount'), center: { x: actor.body.center.x, y: actor.body.center.y } }));
        arena.update(performance.now(), 50); return { hp, nextHp: target.getData('hp'), active: arena.projectiles.countActive(true), before, after }; });
      assert.equal(observed.hp, 8, JSON.stringify(observed)); assert.equal(observed.nextHp, 8, JSON.stringify(observed)); return observed;
    });
    await check('W02 misses leave HP unchanged and expire at configured Clock TTL', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => { const arena = window.fixtureArena, target = window.fixturePlace(arena, arena.enemies, 300, .8, 'enemy');
        arena.fire({ id: 9200, x: 0, y: -1 }); arena.time.preUpdate(); arena.time.update(performance.now(), 550);
        return { hp: target.getData('hp'), active: arena.projectiles.countActive(true), timers: window.fixtureBattle.snapshot().engine.timers }; });
      assert.equal(observed.hp, 48); assert.equal(observed.active, 0); assert.equal(observed.timers, 0); return observed;
    });
    await check('dead enemy recycles and kill is credited only once', async () => {
      const { laneY } = await setup(page), observed = await collisionFrame(page, { laneY, targets: [{ id: 160, x: 200, kind: 'enemy', hp: 1 }], start: 190, speed: 0 });
      assert.equal(observed.after.targets[0].hp, 0); assert.equal(observed.after.targets[0].active, false); assert.equal(observed.after.kills, 1); assert.equal(observed.next.kills, 1); return observed;
    });
    await check('two actual simultaneous projectiles credit one enemy death once', async () => {
      const { laneY } = await setup(page);
      const observed = await page.evaluate(({ laneY }) => { const arena = window.fixtureArena, target = window.fixturePlace(arena, arena.enemies, 200, .7, 'enemy');
        window.fixturePosition(target, 200, laneY); target.setData('hp', 1);
        arena.fire({ id: 9400, x: 1, y: 0 }); arena.fire({ id: 9401, x: 1, y: 0 });
        for (const shot of arena.projectiles.getChildren().filter(actor => actor.active)) { window.fixturePosition(shot, 190, laneY); shot.setVelocity(0, 0); }
        arena.update(performance.now(), 50); const first = { hp: target.getData('hp'), active: target.active, kills: arena.kills };
        arena.update(performance.now(), 50); return { first, nextKills: arena.kills }; }, { laneY });
      assert.equal(observed.first.hp, 0); assert.equal(observed.first.active, false); assert.equal(observed.first.kills, 1); assert.equal(observed.nextKills, 1); return observed;
    });
    await check('same-frame recycled Sprite starts at cat center and cannot sweep its old position on birth', async () => {
      await setup(page);
      const observed = await page.evaluate(() => { const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 130;
        window.fixturePosition(arena.cat, 100, y); const enemy = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'), crate = window.fixturePlace(arena, arena.objects, 150, .5, 'object');
        window.fixturePosition(enemy, 200, y); enemy.setData('hp', 1); window.fixturePosition(crate, 150, y);
        arena.fire({ id: 9500, x: 1, y: 0 }); const old = arena.projectiles.getChildren().find(actor => actor.active);
        window.fixturePosition(old, 190, y); old.setVelocity(0, 0); arena.update(performance.now(), 50);
        const fresh = arena.projectiles.getChildren().find(actor => actor.active), state = window.fixtureBattle.snapshot();
        return { same: old === fresh, hp: crate.getData('hp'), kills: state.kills, shots: state.shots, ammo: state.ammo,
          origin: state.player, center: { x: fresh.body.center.x, y: fresh.body.center.y }, prev: { x: fresh.body.prev.x + fresh.body.halfWidth, y: fresh.body.prev.y + fresh.body.halfHeight },
          hitIds: fresh.getData('hitIds').size, hitCount: fresh.getData('hitCount'), volley: fresh.getData('volleyId') }; });
      assert.equal(observed.same, true); assert.equal(observed.hp, 6); assert.equal(observed.kills, 1); assert.equal(observed.shots, 1); assert.equal(observed.ammo, 2);
      assert.deepEqual(observed.center, observed.origin); assert.deepEqual(observed.prev, observed.origin); assert.equal(observed.hitIds, 0); assert.equal(observed.hitCount, 0); assert.equal(observed.volley, 1); return observed;
    });
    await check('reset clears projectiles/timers and pooled entity receives a new stable ID', async () => {
      await setup(page);
      const observed = await page.evaluate(() => { const arena = window.fixtureArena, first = window.fixturePlace(arena, arena.enemies, 200, .4, 'enemy'), firstId = first.getData('id');
        arena.recycle(first, arena.enemies); const second = window.fixturePlace(arena, arena.enemies, 200, .4, 'enemy'), secondId = second.getData('id');
        arena.fire({ id: 9300, x: 1, y: 0 }); window.fixtureBattle.reset(); return { same: first === second, firstId, secondId, state: window.fixtureBattle.snapshot() }; });
      assert.equal(observed.same, true); assert.notEqual(observed.firstId, observed.secondId); assert.equal(observed.state.projectiles, 0); assert.equal(observed.state.engine.timers, 0); assert.equal(observed.state.locked, null); return observed;
    });
    await check('orange actual first volley has one 9-damage secondary, next volley only primary and reload re-arms once', async () => {
      await setup(page, 'CAT01', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.objects, 220, .5, 'object'); window.fixturePosition(target, 220, y); target.setData('hp', 10000);
        const read = () => ({ state: window.fixtureBattle.snapshot(), shots: arena.projectiles.getChildren().filter(actor => actor.active).map(actor => ({
          source: actor.getData('source'), damage: actor.getData('damage'), pierce: actor.getData('extraPierce'), speed: actor.body.velocity.length(),
          ttl: actor.getData('lifeTimer').delay, vx: actor.body.velocity.x, vy: actor.body.velocity.y, volley: actor.getData('volleyId') })) });
        const clear = () => { for (const shot of arena.projectiles.getChildren()) arena.recycle(shot, arena.projectiles); };
        arena.update(performance.now(), 0); const first = read(); clear();
        arena.update(performance.now(), window.fixtureBattle.snapshot().weaponInterval*1000); const second = read(); clear();
        for (let i = 0; i < window.fixtureBattle.snapshot().ammoCapacity-2; i++) { arena.update(performance.now(), window.fixtureBattle.snapshot().weaponInterval*1000); clear(); }
        arena.update(performance.now(), window.fixtureBattle.snapshot().reloadSeconds*1000-1); const beforeReload = read(); clear();
        arena.update(performance.now(), 1); const reload = read(); clear();
        arena.update(performance.now(), window.fixtureBattle.snapshot().weaponInterval*1000); const afterReload = read(); return { first, second, beforeReload, reload, afterReload };
      });
      assert.equal(observed.first.shots.length, 2); assert.equal(observed.first.state.ammo, 11); assert.equal(observed.first.state.shots, 1);
      const primary = observed.first.shots.find(shot => shot.source === 'PRIMARY'), secondary = observed.first.shots.find(shot => shot.source === 'SECONDARY');
      assert.equal(primary.damage, 12); assert.equal(secondary.damage, 9); assert.equal(secondary.pierce, 0);
      near(secondary.speed, primary.speed); assert.equal(secondary.ttl, primary.ttl); near(secondary.vx, primary.vx); near(secondary.vy, primary.vy); assert.equal(secondary.volley, primary.volley);
      assert.equal(observed.second.shots.length, 1); assert.equal(observed.second.state.ammo, 10); assert.equal(observed.beforeReload.shots.length, 0);
      assert.equal(observed.reload.state.reloadCompletions, 1); assert.equal(observed.reload.shots.length, 2); assert.equal(observed.reload.state.ammo, 11);
      assert.equal(observed.afterReload.shots.length, 1); return observed;
    });
    await check('orange no target and paused/background frames preserve first flag and reset clears counts', async () => {
      await setup(page, 'CAT01', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena; arena.update(performance.now(), 1000); const noTarget = window.fixtureBattle.snapshot();
        window.fixtureBattle.pause('background'); arena.update(performance.now(), 50000); const paused = window.fixtureBattle.snapshot();
        const wake = arena.game.loop.wake; arena.game.loop.wake = () => {}; window.fixtureBattle.resume(); arena.game.loop.wake = wake; arena.game.loop.sleep();
        const target = window.fixturePlace(arena, arena.objects, 150, .5, 'object'); window.fixturePosition(target, arena.cat.body.center.x + 80, arena.cat.body.center.y);
        arena.update(performance.now(), 0); const first = window.fixtureBattle.snapshot(); window.fixtureBattle.reset(); const reset = window.fixtureBattle.snapshot();
        return { noTarget, paused, first, reset };
      });
      assert.equal(observed.noTarget.passiveState.secondaryReady, true); assert.equal(observed.noTarget.ammo, 12);
      assert.equal(observed.paused.elapsed, observed.noTarget.elapsed); assert.equal(observed.paused.passiveState.secondaryReady, true);
      assert.deepEqual(observed.first.sourceCounts, { PRIMARY: 1, SECONDARY: 1, SUMMON: 0 }); assert.equal(observed.first.ammo, 11);
      assert.deepEqual(observed.reset.sourceCounts, { PRIMARY: 0, SECONDARY: 0, SUMMON: 0 }); assert.equal(observed.reset.companions, 0); return observed;
    });
    await check('snow actual primary hits give layers and Body speed 24 -> 20.4 -> 16.8 -> frozen -> protected 24', async () => {
      await setup(page, 'CAT02', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(target, 220, y); target.setData('hp', 10000);
        let volley = 10000;
        const clear = () => { for (const shot of arena.projectiles.getChildren()) arena.recycle(shot, arena.projectiles); };
        const hits = () => { for (let i = 0; i < 2; i++) { const id = volley++; arena.fire({ id, x: 1, y: 0 });
          const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('volleyId') === id); arena.hit(shot, target, 'sweep'); clear(); } };
        const read = () => ({ state: window.fixtureBattle.snapshot(), speed: target.body.velocity.length(), tint: target.tintTopLeft });
        arena.update(performance.now(), 0); clear(); const base = read();
        hits(); arena.update(performance.now(), 0); clear(); const one = read();
        hits(); arena.update(performance.now(), 0); clear(); const two = read();
        hits(); arena.update(performance.now(), 0); clear(); const frozen = read();
        window.fixtureBattle.pause('menu'); arena.update(performance.now(), 50000); const paused = read();
        const wake = arena.game.loop.wake; arena.game.loop.wake = () => {}; window.fixtureBattle.resume(); arena.game.loop.wake = wake; arena.game.loop.sleep();
        arena.update(performance.now(), 749); clear(); const beforeThaw = read(); arena.update(performance.now(), 1); clear(); const thaw = read();
        hits(); arena.update(performance.now(), 0); clear(); const protectedHit = read();
        arena.update(performance.now(), 3000); clear(); hits(); arena.update(performance.now(), 0); clear(); const protectionOver = read();
        return { base, one, two, frozen, paused, beforeThaw, thaw, protectedHit, protectionOver };
      });
      const speed=contract.courtyard?contract.ENEMIES.E01.speed:24;near(observed.base.speed, speed); near(observed.one.speed, speed*.85); near(observed.two.speed, speed*.7); near(observed.frozen.speed, 0); near(observed.beforeThaw.speed, 0);
      const status = row => row.state.enemyStatuses.find(enemy => enemy.id === observed.base.state.targets.find(target => target.kind === 'enemy').id);
      assert.equal(status(observed.one).layers, 1); assert.equal(status(observed.two).layers, 2); assert.equal(status(observed.frozen).layers, 0); assert.equal(status(observed.frozen).frozen, true);
      assert.equal(observed.paused.state.elapsed, observed.frozen.state.elapsed); assert.equal(status(observed.paused).frozen, true);
      near(observed.thaw.speed, speed); assert.equal(status(observed.thaw).protected, true); assert.equal(status(observed.protectedHit).layers, 0);
      assert.equal(status(observed.protectionOver).layers, 1); near(observed.protectionOver.speed, speed*.85); return observed;
    });
    await check('snow layer expiry is independent and recycled enemy loses layers/freeze/protection', async () => {
      await setup(page, 'CAT02', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(target, 220, y); target.setData('hp', 10000);
        let volley = 11000;
        const clear = () => { for (const shot of arena.projectiles.getChildren()) arena.recycle(shot, arena.projectiles); };
        const hits = () => { for (let i = 0; i < 2; i++) { const id = volley++; arena.fire({ id, x: 1, y: 0 });
          const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('volleyId') === id); arena.hit(shot, target, 'sweep'); clear(); } };
        hits(); arena.update(performance.now(), 1000); clear(); hits(); arena.update(performance.now(), 0); clear();
        arena.update(performance.now(), 1500); clear(); const independent = { state: window.fixtureBattle.snapshot(), speed: target.body.velocity.length() };
        hits(); hits(); arena.update(performance.now(), 0); clear(); const before = { frozen: target.getData('chill').frozenUntil, tint: target.tintTopLeft, id: target.getData('id') };
        arena.recycle(target, arena.enemies); const reused = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(reused, 220, y); arena.update(performance.now(), 0); clear();
        return { independent, before, same: reused === target, after: { id: reused.getData('id'), state: window.fixtureBattle.snapshot(), tint: reused.tintTopLeft, speed: reused.body.velocity.length() } };
      });
      near(observed.independent.speed, (contract.courtyard?contract.ENEMIES.E01.speed:24)*.85); assert.equal(observed.independent.state.enemyStatuses[0].layers, 1);
      assert.ok(observed.before.frozen > 0); assert.equal(observed.same, true); assert.notEqual(observed.after.id, observed.before.id);
      assert.equal(observed.after.tint, 0xffffff); near(observed.after.speed, contract.courtyard?contract.ENEMIES.E01.speed:24); const reused = observed.after.state.enemyStatuses.find(enemy => enemy.id === observed.after.id);
      assert.equal(reused.layers, 0); assert.equal(reused.frozen, false); assert.equal(reused.protected, false); return observed;
    });
    await check('snow killed target transfers trigger to nearest live stable ID and secondary/summon/boxes grant zero credit', async () => {
      await setup(page, 'CAT02', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 29, arena.physics.world.bounds.top + 29);
        const victim = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(victim, 220, y); victim.setData('hp', 60);
        const high = window.fixturePlace(arena, arena.enemies, 260, .5, 'enemy'); window.fixturePosition(high, 260, y); high.setData({ id: 99, hp: 10000 });
        const low = window.fixturePlace(arena, arena.enemies, 180, .5, 'enemy'); window.fixturePosition(low, 180, y); low.setData({ id: 50, hp: 10000 });
        let volley = 12000;
        const shoot = (target, source = 'PRIMARY') => { const id = volley++; arena.fire({ id, x: 1, y: 0 });
          const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('volleyId') === id); shot.setData('source', source); arena.hit(shot, target, 'sweep');
          for (const actor of arena.projectiles.getChildren()) arena.recycle(actor, arena.projectiles); };
        shoot(victim); victim.setData('hp', 1); shoot(victim);
        const transferred = window.fixtureBattle.snapshot();
        shoot(high, 'SECONDARY'); shoot(high, 'SUMMON'); const crate = window.fixturePlace(arena, arena.objects, 300, .5, 'object'); shoot(crate);
        const excluded = window.fixtureBattle.snapshot(); arena.recycle(low, arena.enemies); arena.recycle(high, arena.enemies);
        const isolated = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'); window.fixturePosition(isolated, 200, y); isolated.setData('hp', 100); shoot(isolated); isolated.setData('hp', 1); shoot(isolated);
        const noTransfer = window.fixtureBattle.snapshot(); return { transferred, excluded, noTransfer };
      });
      assert.equal(observed.transferred.kills, 1); assert.equal(observed.transferred.enemyStatuses.find(enemy => enemy.id === 50).layers, 1); assert.equal(observed.transferred.enemyStatuses.find(enemy => enemy.id === 99).layers, 0);
      near(observed.transferred.passiveState.chillCredit, 2 / 3); near(observed.excluded.passiveState.chillCredit, 2 / 3); near(observed.noTransfer.passiveState.chillCredit, 4 / 3); return observed;
    });
    await check('spirit exists without Body, first actual summon at 1.5 is damage6 speed600 TTL1000 and does not spend ammo', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 29, y); const target = window.fixturePlace(arena, arena.enemies, 279, .5, 'enemy'); window.fixturePosition(target, 279, y); target.setData('hp', 10000);
        // Keep this high-HP fixture at 250u: inside spirit260 but outside
        // primary240, so the observed ammo checks isolate summon expenditure.
        target.body.moves = false;
        arena.update(performance.now(), 1499); const before = window.fixtureBattle.snapshot(); arena.update(performance.now(), 1); const at = window.fixtureBattle.snapshot();
        const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('source') === 'SUMMON');
        const projectile = shot && { damage: shot.getData('damage'), speed: shot.body.velocity.length(), ttl: shot.getData('lifeTimer').delay, pierce: shot.getData('extraPierce'), source: shot.getData('source') };
        const companion = { count: at.companions, hasBody: !!arena.spirit?.body }; arena.hit(shot, target, 'sweep'); const afterHp = target.getData('hp');
        return { before, at, projectile, companion, afterHp };
      });
      assert.equal(observed.before.sourceCounts.SUMMON, 0); assert.equal(observed.before.ammo, 4); assert.equal(observed.at.sourceCounts.SUMMON, 1); assert.equal(observed.at.ammo, 4);
      near(observed.projectile.speed, 600); assert.equal(observed.projectile.damage, 6); assert.equal(observed.projectile.ttl, 1000);
      assert.equal(observed.projectile.pierce, 0); assert.equal(observed.projectile.source, 'SUMMON');
      assert.deepEqual(observed.companion, { count: 1, hasBody: false }); assert.equal(observed.afterHp, 9994); return observed;
    });
    await check('spirit ignores boxes, no-target/long frames do not backlog, pause freezes and reset removes companion and shots', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 29, y); const crate = window.fixturePlace(arena, arena.objects, 279, .5, 'object'); window.fixturePosition(crate, 279, y);
        arena.update(performance.now(), 1500); const boxOnly = window.fixtureBattle.snapshot();
        const target = window.fixturePlace(arena, arena.enemies, 279, .5, 'enemy'); window.fixturePosition(target, 279, y); target.setData('hp', 10000);
        arena.update(performance.now(), 0); const noBacklog = window.fixtureBattle.snapshot();
        window.fixtureBattle.pause('background'); arena.update(performance.now(), 50000); const paused = window.fixtureBattle.snapshot();
        const wake = arena.game.loop.wake; arena.game.loop.wake = () => {}; window.fixtureBattle.resume(); arena.game.loop.wake = wake; arena.game.loop.sleep();
        arena.update(performance.now(), 0); const resumed = window.fixtureBattle.snapshot(); arena.update(performance.now(), 1500); const due = window.fixtureBattle.snapshot();
        for (const actor of arena.projectiles.getChildren()) arena.recycle(actor, arena.projectiles);
        arena.update(performance.now(), 10000); const long = window.fixtureBattle.snapshot(); arena.update(performance.now(), 0); const same = window.fixtureBattle.snapshot();
        window.fixtureBattle.reset(); const reset = window.fixtureBattle.snapshot(); return { boxOnly, noBacklog, paused, resumed, due, long, same, reset };
      });
      assert.equal(observed.boxOnly.sourceCounts.SUMMON, 0); assert.equal(observed.noBacklog.sourceCounts.SUMMON, 0); assert.equal(observed.paused.elapsed, observed.noBacklog.elapsed);
      assert.equal(observed.resumed.sourceCounts.SUMMON, 0); assert.equal(observed.due.sourceCounts.SUMMON, 1); assert.equal(observed.long.sourceCounts.SUMMON, 2); assert.equal(observed.same.sourceCounts.SUMMON, 2);
      assert.equal(observed.reset.companions, 0); assert.equal(observed.reset.projectiles, 0); assert.equal(observed.reset.engine.timers, 0); assert.deepEqual(observed.reset.sourceCounts, { PRIMARY: 0, SECONDARY: 0, SUMMON: 0 }); return observed;
    });
    await check('Canvas renders visible chill dots/freeze ring and recycling or reset removes those pixels', async () => {
      await setup(page, 'CAT02', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 29, arena.physics.world.bounds.top + 29);
        const target = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(target, 220, y); target.body.moves = false; target.setData('hp', 10000);
        const bluePixels = () => { arena.sys.events.emit('postupdate'); const renderer = arena.game.renderer;
          // Isolate the native chill Graphics from blue pixels baked into E01 art.
          const hidden=arena.children.list.filter(node=>node!==arena.chillEffects).map(node=>({node,visible:node.visible}));for(const {node} of hidden)node.setVisible(false);
          renderer.preRender(); arena.sys.render(renderer); renderer.postRender();
          const camera=arena.cameras.main,p=camera.matrix.transformPoint(target.x-camera.scrollX,target.y-camera.scrollY),scale=camera.zoomX;
          const pixels = arena.game.canvas.getContext('2d').getImageData(Math.floor(p.x-30*scale),Math.floor(p.y-34*scale),Math.ceil(60*scale),Math.ceil(68*scale)).data; let blue = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2] > pixels[i] + 30 && pixels[i + 2] > pixels[i + 1] + 5 && pixels[i + 2] > 180) blue++;
          for(const {node,visible} of hidden)node.setVisible(visible);return blue; };
        let volley = 14000;
        const hits = () => { for (let i = 0; i < 2; i++) { const id = volley++; arena.fire({ id, x: 1, y: 0 });
          const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('volleyId') === id); arena.hit(shot, target, 'sweep');
          for (const actor of arena.projectiles.getChildren()) arena.recycle(actor, arena.projectiles); } };
        const base = bluePixels(); hits(); const one = bluePixels(); hits(); const two = bluePixels(); hits(); const frozen = bluePixels();
        arena.recycle(target, arena.enemies); const reused = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(reused, 220, y); const recycled = bluePixels();
        window.fixtureBattle.reset(); const reset = bluePixels(); return { base, one, two, frozen, recycled, reset };
      });
      assert.ok(observed.one > observed.base + 8, JSON.stringify(observed)); assert.ok(observed.two > observed.one + 8, JSON.stringify(observed));
      assert.ok(observed.frozen > observed.two + 16, JSON.stringify(observed)); assert.equal(observed.recycled, observed.base); assert.equal(observed.reset, 0); return observed;
    });
    await check('contact death frame and passive expiry share the same effective Session timestamp', async () => {
      await setup(page, 'CAT02', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
        window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(target, 220, y); target.setData('hp', 10000);
        for (const id of [15000, 15001]) { arena.fire({ id, x: 1, y: 0 }); const shot = arena.projectiles.getChildren().find(actor => actor.active && actor.getData('volleyId') === id);
          arena.hit(shot, target, 'sweep'); for (const actor of arena.projectiles.getChildren()) arena.recycle(actor, arena.projectiles); }
        // Independent controlled initial state, never used by the natural-run bundle.
        window.fixtureSession().elapsed = 2.49; window.fixtureSession().hp = 1; window.fixturePosition(target, 100, y);
        arena.update(performance.now(), 10); return window.fixtureBattle.snapshot();
      });
      assert.equal(observed.result, 'death'); near(observed.elapsed, 2.5); assert.equal(observed.enemyStatuses[0].layers, 0); return observed;
    });
    await check('spirit partner and summon projectile use distinct existing atlas frames', async () => {
      await setup(page, 'CAT03', 'p2-basic');
      const observed = await page.evaluate(() => {
        const arena = window.fixtureArena, target = window.fixturePlace(arena, arena.enemies, 200, .5, 'enemy'); target.setData('hp', 10000); target.body.moves = false;
        window.fixturePosition(target, arena.cat.body.center.x + 100, arena.cat.body.center.y);
        arena.update(performance.now(), 1500); return { partner: arena.spirit.frame.name,
          projectile: arena.projectiles.getChildren().find(actor => actor.active && actor.getData('source') === 'SUMMON').frame.name };
      });
      assert.deepEqual(observed, { partner: 'spirit', projectile: 'spirit-shot' }); return observed;
    });
    for (const catId of ['CAT01', 'CAT02', 'CAT03']) {
      for (const scenario of [{ name: 'lethal contact', hp: 1, enemy: true, result: 'death', remainingHp: 0 },
        { name: 'nonlethal contact', hp: 11, enemy: true, result: contract.courtyard?'timeout':'survived', remainingHp: contract.courtyard?11-contract.ENEMIES.E01.contact:1 },
        { name: 'no enemy', hp: 1, enemy: false, result: contract.courtyard?'timeout':'survived', remainingHp: 1 }]) {
        await check(catId + ' duration boundary still runs actual ' + scenario.name + ' before settlement and emits no new projectiles', async () => {
          await setup(page, catId, 'p2-basic');
          const observed = await page.evaluate(scenario => {
            const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
            window.fixturePosition(arena.cat, 100, y);
            let enemy = null;
            if (scenario.enemy) { enemy = window.fixturePlace(arena, arena.enemies, 100, .5, 'enemy'); window.fixturePosition(enemy, 100, y); }
            window.fixtureSession().elapsed = window.fixtureBattle.snapshot().durationSeconds - .01; window.fixtureSession().hp = scenario.hp;
            const before = { state: window.fixtureBattle.snapshot(), catCenter: { x: arena.cat.body.center.x, y: arena.cat.body.center.y },
              enemyCenter: enemy && { x: enemy.body.center.x, y: enemy.body.center.y } };
            arena.update(performance.now(), 10); arena.sys.events.emit('postupdate'); return { before, after: window.fixtureBattle.snapshot() };
          }, scenario);
          if (scenario.enemy) assert.deepEqual(observed.before.catCenter, observed.before.enemyCenter);
          near(observed.after.elapsed, contract.run(catId).durationSeconds); assert.equal(observed.after.hp, scenario.remainingHp); assert.equal(observed.after.result, scenario.result);
          assert.equal(observed.after.shots, 0); assert.deepEqual(observed.after.sourceCounts, { PRIMARY: 0, SECONDARY: 0, SUMMON: 0 });
          assert.equal(observed.after.engine.paused, true); return observed;
        });
      }
      await check(catId + ' duration boundary resolves actual old primary projectile before survival and does not emit another', async () => {
        await setup(page, catId, 'p2-basic');
        const observed = await page.evaluate(() => {
          const arena = window.fixtureArena, y = arena.physics.world.bounds.top + 140;
          window.fixturePosition(arena.cat, 100, y); const target = window.fixturePlace(arena, arena.enemies, 220, .5, 'enemy'); window.fixturePosition(target, 220, y); target.setData('hp', 1000);
          arena.fire({ id: 16000, x: 1, y: 0 });
          const shots = arena.projectiles.getChildren().filter(actor => actor.active);
          for (const shot of shots) { window.fixturePosition(shot, 210, y); shot.setVelocity(0, 0); }
          window.fixtureSession().elapsed = window.fixtureBattle.snapshot().durationSeconds - .01;
          const before = window.fixtureBattle.snapshot(); arena.update(performance.now(), 10); arena.sys.events.emit('postupdate');
          return { before, after: window.fixtureBattle.snapshot(), hp: target.getData('hp') };
        });
        const expectedDamage = { CAT01: 12, CAT02: 28.8, CAT03: 40 }[catId];
        near(observed.hp, 1000 - expectedDamage); assert.equal(observed.after.result, contract.courtyard?'timeout':'survived'); assert.equal(observed.after.shots, 0);
        assert.deepEqual(observed.after.sourceCounts, observed.before.sourceCounts); return observed;
      });
      await check(catId + ' passive instance is stored on cat DataManager and replaced on restart', async () => {
        await setup(page, catId, 'p2-basic');
        const observed = await page.evaluate(catId => {
          const arena = window.fixtureArena, cat = arena.cat, first = cat.getData('passives'), getter = arena.passives;
          const wake = arena.game.loop.wake; arena.game.loop.wake = () => {};
          window.fixtureBattle.start(window.fixtureRunConfig(catId, { CAT01: 'W01', CAT02: 'W04', CAT03: 'W02' }[catId], 'p2-basic'));
          arena.game.loop.wake = wake; arena.game.loop.sleep();
          const second = cat.getData('passives'); return { stored: !!first, getterIdentity: first === getter, hasOwnField: Object.hasOwn(arena, 'passives'),
            sameCat: cat === arena.cat, replaced: first !== second, restartedIdentity: second === arena.passives, state: window.fixtureBattle.snapshot() };
        }, catId);
        assert.equal(observed.stored, true); assert.equal(observed.getterIdentity, true); assert.equal(observed.hasOwnField, false); assert.equal(observed.sameCat, true);
        assert.equal(observed.replaced, true); assert.equal(observed.restartedIdentity, true); assert.equal(observed.state.passiveState.chillCredit, 0);
        assert.equal(observed.state.passiveState.secondaryReady, catId === 'CAT01'); assert.equal(observed.state.passiveState.nextSpiritAt, 1.5); return observed;
      });
    }
    await page.screenshot({ path: path.join(out, 'fixture.png') }); fs.writeFileSync(path.join(out, 'snapshot.json'), JSON.stringify(await page.evaluate(() => window.fixtureBattle.snapshot()), null, 2));
  } catch (error) { checks.push({ name: 'fixture setup', status: 'FAIL', error: String(error) }); }
  finally {
    if (browser) await browser.close(); if (server) server.kill();
    const restored = sha(fs.readFileSync(sourcePath)); if (restored !== sourceSha) checks.push({ name: 'production source remains unchanged', status: 'FAIL', error: sourceSha + ' != ' + restored });
    const report = { status: checks.some(check => check.status === 'FAIL') || consoleErrors.length ? 'FAIL' : 'PASS', atUtc: new Date().toISOString(), sourcePath,
      sourceSha256: sourceSha, sourceSha256After: restored, profile:config.profile, candidate:config.identity, artifactKind:config.artifactKind, receipt:config.receipt, observers: 'test-only module API proxy and native factory/prototype observation; no business-source rewrite', fixtureDist,
      fixtureMainSha256: fs.existsSync(path.join(fixtureDist, config.entryFile('main.js'))) ? sha(fs.readFileSync(path.join(fixtureDist, config.entryFile('main.js')))) : null,
      frameDeltaMs: 50, checks, consoleErrors, environment: 'Windows / Chrome; controlled Arena / actual Arcade Bodies / Clock; independent fixture bundle',
      versions: { node: process.version, chrome: browserVersion, phaser: require('phaser/package.json').version,
        typescript: require('typescript/package.json').version, esbuild: require('esbuild/package.json').version }, platform: 'NOT_TESTED', phone: 'NOT_TESTED' };
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ out, status: report.status, checks: checks.length, failures: checks.filter(check => check.status === 'FAIL'), consoleErrors })); process.exitCode = report.status === 'PASS' ? 0 : 1;
  }
})();
