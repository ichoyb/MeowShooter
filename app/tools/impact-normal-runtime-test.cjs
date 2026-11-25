'use strict';
// Real main, imported unchanged by the existing N1 fixture. Controlled Scene
// time, damage, random draws and spawn suppression are explicitly reported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const sceneURL = process.env.IMPACT_SCENE_URL || 'http://127.0.0.1:9051/.local/checks/n1-runtime-20261112/scene/';
const normalURL = process.env.IMPACT_NORMAL_URL || null;
const out = path.resolve(process.env.IMPACT_NORMAL_QA_OUT || path.join(root, '.local/checks/impact-normal', new Date().toISOString().replace(/[:.]/g, '-')));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
if (fs.existsSync(path.join(out, 'report.json'))) throw Error('Use a new IMPACT_NORMAL_QA_OUT; do not replace evidence');
fs.mkdirSync(out, {recursive: true});
const report = {status: 'RUNNING', atUtc: new Date().toISOString(), sceneURL, normalURL,
  runnerSHA256: sha(fs.readFileSync(__filename)), checks: [], pageErrors: [],
  scope: 'CONTROLLED_NATIVE_MAIN_UI: existing N1 fixture imports unchanged main; controlled XP, Scene time, damage, random draws and spawn suppression. Not natural play or wall-clock endurance.',
  notTested: ['Platform simulator', 'Android', 'iOS', 'Chrome61', 'Natural ten-minute endurance', 'Real OS background/lock', 'Phone audio and FPS']};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const state = p => p.evaluate(() => JSON.parse(document.getElementById('app').dataset.state));
const ui = p => p.evaluate(() => JSON.parse(document.getElementById('app').dataset.ui));
const audio = p => p.evaluate(() => JSON.parse(document.getElementById('app').dataset.audio || '{}'));
const frame = (p, prefix) => p.waitForFunction(prefix => JSON.parse(document.getElementById('app').dataset.ui).frame.startsWith(prefix), prefix);
const action = (p, id) => p.locator('button[data-action="' + id + '"]:visible').last().click();
const tick = (p, ms) => p.evaluate(ms => window.N1Test.tick(ms), ms);
const contexts = [], criticalBuffers = {};
let browser;
async function check(name, fn, p, scope = report.scope) {
  try { const detail = await fn(); report.checks.push({name, status: 'Pass', scope, detail}); save(); console.log('PASS ' + name); }
  catch (error) {
    const evidence = p && !p.isClosed() ? name.replace(/[^a-zA-Z0-9_-]/g, '-') + '.png' : null;
    if (evidence) await p.screenshot({path: path.join(out, evidence)}).catch(() => {});
    report.checks.push({name, status: 'Fail', scope, error: String(error), stack: error.stack, evidence}); save(); throw error;
  }
}
async function open(options = {}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, ...options});
  contexts.push(context); const p = await context.newPage();
  p.on('pageerror', e => report.pageErrors.push({url: p.url(), error: String(e)}));
  await p.goto(sceneURL); await p.waitForFunction(() => window.N1Test?.ready);
  await p.evaluate(() => {
    window.N1Test.hold(); window.N1Test.isolate();
    // Native TweenManager timing is fixed only on this held controlled page.
    // Scene updates and render observations are never reported as measured FPS.
    window.N1Test.arena.tweens.getDelta = () => 1000 / 60;
    window.N1Test.arena.game.loop.delta = 1000 / 60;
  }); return p;
}
async function start(p) { await action(p, 'start'); if ((await ui(p)).frame === 'N1-OPEN') await action(p, 'chapter-skip'); await frame(p, 'PAGE-06'); }
async function home(p) {
  if ((await ui(p)).inProbe) {
    const f = (await ui(p)).frame;
    if (f.startsWith('PAGE-07') || f === 'N1-RECEIPT') await p.keyboard.press('Escape');
    else if (!f.startsWith('LAYER-02')) await action(p, 'pause');
    await frame(p, 'LAYER-02'); await action(p, 'end'); await action(p, 'confirm-end');
  } else await action(p, 'home');
  await frame(p, 'PAGE-02');
}
async function fresh(p, cat = 'CAT01') {
  if (!(await ui(p)).frame.startsWith('PAGE-02')) await home(p);
  await action(p, 'select'); await action(p, 'choose:' + cat); await action(p, 'confirm-select'); await start(p);
  await tick(p, 0); return state(p);
}
async function pick(p, card) {
  const offer = await p.evaluate(card => window.N1Test.offer(card), card); await frame(p, 'PAGE-07');
  const s = offer.state, key = s.progression.runId + '.' + s.progression.offer.id;
  assert(s.progression.offer.choices.includes(card), 'Must be a real legal offer');
  await action(p, 'growth-select:' + key + '.' + card); await action(p, 'growth-confirm:' + key + '.' + card);
  if ((await ui(p)).frame === 'N1-RECEIPT') await action(p, 'receipt-skip:' + key);
  await frame(p, 'PAGE-06'); const after = await state(p);
  assert.equal(after.progression.confirmedPicks, s.progression.confirmedPicks + 1);
  return {card, seed: offer.seed, xp: offer.xp, rank: after.progression.ranks[card]};
}
async function steps(p, frames = 2, render = true) {
  return p.evaluate(({frames, render}) => {
    const x = window.N1Test, a = x.arena;
    for (let i = 0; i < frames; i++) { a.game.loop.delta = 1000 / 60; x.tick(1000 / 60); }
    if (render) { a.game.renderer.preRender(); a.game.scene.render(a.game.renderer); a.game.renderer.postRender(); }
    return x.state();
  }, {frames, render});
}
async function layers(p, kind = 'player') {
  return p.evaluate(kind => {
    const a = window.N1Test.arena;
    const overlays = a.impact.overlays.getChildren().filter(o => o.active && o.getData('impact-pulse').kind === kind);
    return overlays.map(o => {
      const s = o.getData('impact-source'), parent = s.parentContainer;
      return {visible: o.visible, sourceVisible: s.visible, alpha: o.alpha, sourceAlpha: s.alpha,
        sourceFrame: s.frame.name, frameCut: [o.frame.cutX, o.frame.cutY, o.frame.cutWidth, o.frame.cutHeight],
        sourceCut: [s.frame.cutX, s.frame.cutY, s.frame.cutWidth, s.frame.cutHeight],
        texture: o.texture.key, sameParent: o.parentContainer === parent,
        order: parent ? parent.getIndex(o) - parent.getIndex(s) : null,
        transform: [o.x, o.y, o.scaleX, o.scaleY, o.rotation, o.originX, o.originY, o.flipX, o.flipY, o.cameraFilter],
        sourceTransform: [s.x, s.y, s.scaleX, s.scaleY, s.rotation, s.originX, s.originY, s.flipX, s.flipY, s.cameraFilter]};
    });
  }, kind);
}
function assertLayers(parts, outline = false) {
  assert(parts.length > 0 && parts.length <= 32);
  assert(parts.some(p => p.visible && p.alpha > 0), 'At least one real visible part must draw');
  for (const p of parts) {
    p.transform.forEach((value,index)=>{
      const expected=p.sourceTransform[index];
      if(typeof value==='number'&&index<7)assert.ok(Number.isFinite(value)&&Number.isFinite(expected)&&Math.abs(value-expected)<1e-9,'native transform differs beyond floating point roundoff');
      else assert.equal(value,expected);
    });
    assert.deepEqual(p.frameCut, p.sourceCut);
    assert(p.sameParent); if (p.order !== null) assert.equal(p.order, 1);
    assert.equal(p.visible, p.sourceVisible); assert.match(p.texture, outline ? /^impact-outline-/ : /^impact-white-/);
    if (outline) assert(p.alpha <= .160001);
  }
}
async function hit(p, critical = false, source = 'PRIMARY', enemyId = 'EL01') {
  const value = await p.evaluate(({critical, source, enemyId}) => {
    const x = window.N1Test, a = x.arena, s = x.state(), origin = s.player;
    // Real catalog HP/Body/art. Placement is controlled; no target stats change.
    const target = a.placeSliceEnemy(enemyId, origin.x + 70, origin.y);
    if (!target) throw Error('Native enemy pool full'); target.body.moves = false;
    a.syncEnemyArt(); a.projectileRandom.frac = () => critical ? 0 : .99;
    const hp = target.getData('hp'), weapon = s.weaponStats;
    const previous = new Set(a.projectiles.getChildren().filter(o => o.active));
    a.projectile(origin, 0, s.weaponId === 'W04' ? 'fish' : s.weaponId === 'W02' ? 'bone' : 'bell', source,
      901, weapon.damage, weapon.extraPierce, weapon.bulletSpeed, weapon.bulletLifeSeconds);
    const shot = a.projectiles.getChildren().find(o => o.active && !previous.has(o));
    if (!shot) throw Error('Native projectile allocation failed');
    const nativeCritical = shot.getData('critical') === true;
    a.hit(shot, target, 'overlap');
    return {hpBefore: hp, hpAfter: target.getData('hp'), nativeCritical,
      body: {x: target.body.center.x, y: target.body.center.y}, targetId: target.getData('id')};
  }, {critical, source, enemyId});
  const after = await steps(p);
  const target = await p.evaluate(id => {
    const e = window.N1Test.arena.enemies.getChildren().find(e => e.active && e.getData('id') === id);
    return e ? {body: {x: e.body.center.x, y: e.body.center.y}, display: {x: e.getData('art').root.x, y: e.getData('art').root.y}} : null;
  }, value.targetId);
  return {...value, target, impact: after.impact, feedback: after.feedback, audio: await audio(p)};
}
async function clearEnemies(p) {
  await p.evaluate(() => { const a = window.N1Test.arena; for (const e of a.enemies.getChildren()) if (e.active) a.recycle(e, a.enemies); });
}
const assertClear = s => { assert.equal(s.impact.playerActive, 0); assert.equal(s.impact.targetPartsActive, 0); assert.equal(s.feedback.active, 0); assert.equal(s.feedback.numbersActive, 0); assert.equal(s.feedback.hurtVisible, false); };
async function offset(p, id) {
  // Read immediately after the real event. No tick, sync or reset is allowed
  // here: those could accidentally conceal a stale display-side displacement.
  return p.evaluate(id => {
    const a = window.N1Test.arena, e = a.enemies.getChildren().find(e => e.active && e.getData('id') === id);
    if (!e) throw Error('Expected original native target to remain active');
    const art = e.getData('art'), pose = e.getData('impactPose');
    return {body: {x: e.body.center.x, y: e.body.center.y}, display: {x: art.root.x, y: art.root.y},
      offsetX: art.root.x - e.body.center.x, poseX: pose?.x, poseTweening: !!pose && a.tweens.isTweening(pose), impact: a.impact.snapshot()};
  }, id);
}
function assertOffsetCleared(before, after) {
  assert.deepEqual(after.body, before.body); assert.equal(after.display.x, after.body.x);
  assert.equal(after.offsetX, 0); assert.equal(after.poseX, 0); assert.equal(after.poseTweening, false);
  assert.equal(after.impact.targetPartsActive, 0);
}
async function identity() {
  const request = await browser.newContext(); contexts.push(request);
  const get = async url => { const r = await request.request.get(url); assert(r.ok(), 'Artifact HTTP ' + r.status() + ': ' + url); return r.body(); };
  const fixture = JSON.parse((await get(new URL('n1-runtime.json', sceneURL).href)).toString());
  const actualMainSHA256 = sha(await get(new URL('assets/main.js', normalURL || sceneURL).href));
  const fixtureSHA256 = sha(await get(new URL('assets/n1-runtime.js', sceneURL).href));
  assert.equal(actualMainSHA256, fixture.normalMainSHA256, 'Fixture receipt must bind actual normal bundle');
  assert.equal(fixtureSHA256, fixture.fixtureSHA256, 'Fixture receipt must bind actual fixture bundle');
  report.identity = {actualMainSHA256, fixtureSHA256, receipt: fixture, environment: {node: process.version, platform: process.platform, browser: browser.version(), viewport: '390x844 CSS / DPR1'}};
  return report.identity;
}

(async () => {
  try {
    browser = await chromium.launch({headless: true, channel: process.env.IMPACT_CHROME_CHANNEL || 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
    await check('actual-artifact-identities', identity, null, 'ARTIFACT_IDENTITY');
    const p = await open(); await start(p);
    await check('normal-main-wires-approved-impact-070', async () => {
      const value = await p.evaluate(() => ({arenaImpact: !!window.N1Test.arena.impact, impact: window.N1Test.state().impact,
        native: window.N1Test.arena.impact?.snapshot(), state: window.N1Test.state()}));
      assert.equal(value.arenaImpact, true, 'Real normal Arena must own ImpactPresentation');
      assert(value.impact, 'Real normal BattleSnapshot must expose impact');
      assert.equal(value.impact.enabled, true); assert.equal(value.impact.peakAlpha, .70);
      assert.deepEqual(value.native, value.impact); assert.equal(value.state.durationSeconds, 600);
      assert.match(value.state.progression.rulesVersion, /normal50/);
      assert.equal(value.state.catDisplay.width, 42); assert.equal(value.state.engine.bodies.cat.radius, 12);
      await hit(p);
      const firstContact = await p.evaluate(() => {
        const a = window.N1Test.arena;
        const effect = a.feedback.effects.getChildren().find(e => e.active && e.getData('effect') === 'contact');
        if (!effect) throw Error('Expected first actual hit contact');
        const data = a.tweens.getTweensOf(effect).flatMap(t => t.data).find(d => d.key === 'alpha');
        if (!data) throw Error('Expected native contact alpha TweenData');
        return {refined: a.feedback.refinedContacts, easeAtFirst: data.ease(60 / 160), size: effect.getData('size')};
      });
      assert.equal(firstContact.refined, true); assert.equal(firstContact.easeAtFirst, .65); assert.equal(firstContact.size, 20);
      return {impact: value.impact, cat: value.state.catId, rulesVersion: value.state.progression.rulesVersion, firstContact};
    }, p);
    if (normalURL) await check('normal-player-entry-has-no-test-controls', async () => {
      const context = await browser.newContext(); contexts.push(context); const q = await context.newPage();
      q.on('pageerror', e => report.pageErrors.push({url: q.url(), error: String(e)}));
      await q.goto(normalURL); await q.waitForFunction(() => document.getElementById('app')?.dataset.ready === 'true');
      assert.equal(await q.evaluate(() => typeof window.N1Test), 'undefined'); await start(q);
      const s = await state(q); assert(s.impact.enabled); assert.equal(s.impact.peakAlpha, .70);
      assert.equal(s.durationSeconds, 600); assert.match(s.progression.rulesVersion, /normal50/);
      await action(q, 'pause'); const paused = await state(q); assertClear(paused);
      await q.close(); return {impact: s.impact, catDisplay: s.catDisplay, duration: s.durationSeconds};
    }, null, 'NORMAL_UNMODIFIED_PLAYER_ENTRY_REAL_UI');

    for (const cat of ['CAT01', 'CAT02', 'CAT03']) {
      for (const scenario of ['plain', 'absorb', 'break', 'overflow']) await check(cat + '-real-damage-' + scenario, async () => {
        await fresh(p, cat); const rewards = scenario === 'plain' ? [] : [await pick(p, 'C13')];
        const before = await state(p), soundBefore = await audio(p), shield = before.defense.shield;
        const amount = scenario === 'plain' ? 10 : scenario === 'absorb' ? 4 : scenario === 'break' ? shield : shield + 10;
        const fact = await p.evaluate(amount => window.N1Test.damage(amount), amount);
        const after = await steps(p), soundAfter = await audio(p), parts = await layers(p);
        assert(fact.accepted); assert.equal(fact.hpLost, scenario === 'plain' || scenario === 'overflow' ? 10 : 0);
        assert.equal(fact.shieldBroke, scenario === 'break' || scenario === 'overflow');
        assert.equal(after.hp, before.hp - fact.hpLost); assert.equal(after.defense.shield, shield - fact.shieldAbsorbed);
        assert.equal(after.impact.playerActive > 0, fact.hpLost > 0); assert.equal(after.impact.unpreparedPartsSkipped, 0);
        assert.equal(after.catDisplay.width, 42); assert.equal(after.engine.bodies.cat.radius, 12);
        assert.equal(soundAfter.events.hurt - soundBefore.events.hurt, fact.hpLost > 0 ? 1 : 0);
        assert.equal(soundAfter.events['shield-break'] - soundBefore.events['shield-break'], fact.hpLost === 0 && fact.shieldBroke ? 1 : 0);
        if (fact.hpLost > 0) {
          assertLayers(parts); assert(parts.length <= 6);
          await p.screenshot({path: path.join(out, cat + '-' + scenario + '.png')});
        } else assert.equal(parts.length, 0);
        if (fact.shieldBroke) assert.equal(after.g6Art.rewards.shieldBreaks, 1);
        await steps(p, 12); assert.equal((await state(p)).impact.playerActive, 0);
        return {rewards, amount, fact, hpBefore: before.hp, hpAfter: after.hp, shieldAfter: after.defense.shield,
          impact: after.impact, parts, incomingSoundRequests: {hurt: soundAfter.events.hurt - soundBefore.events.hurt, shieldBreak: soundAfter.events['shield-break'] - soundBefore.events['shield-break']}};
      }, p);
      await check(cat + '-zero-rejection-fatal-clear', async () => {
        await fresh(p, cat); const before = await state(p);
        const zero = await p.evaluate(() => window.N1Test.damage(0)); assert.equal(zero.hpLost, 0); assert.equal((await state(p)).impact.playerActive, 0);
        await p.evaluate(() => window.N1Test.damage(10)); await steps(p); await action(p, 'pause');
        const rejected = await p.evaluate(() => window.N1Test.damage(10)); assert.equal(rejected.accepted, false);
        const paused = await state(p); assertClear(paused); await action(p, 'resume'); await steps(p, 12); assert.equal((await state(p)).impact.playerActive, 0);
        const fatal = await p.evaluate(() => window.N1Test.damage(100000)); await tick(p, 0); const dead = await state(p);
        assert(fatal.accepted && fatal.hpLost > 0); assert.equal(dead.result, 'death'); assertClear(dead);
        await action(p, 'restart'); const restarted = await state(p); assertClear(restarted); assert.equal(restarted.hp, restarted.maxHp);
        return {initialHP: before.hp, zero, rejected, fatal, result: dead.result};
      }, p);
      await check(cat + '-moving-and-firing-parts-stay-synchronized', async () => {
        await fresh(p, cat);
        await p.evaluate(() => { const a = window.N1Test.arena; a.fireVolley = Object.getPrototypeOf(a).fireVolley; a.placeSliceEnemy('EL01', 450, 720).body.moves = false; });
        await p.keyboard.down('d'); const moving = await steps(p, 10); await p.keyboard.up('d');
        await p.evaluate(() => window.N1Test.damage(10)); const lit = await steps(p), parts = await layers(p);
        assert(moving.player.x > 360); assert(moving.shots > 0); assert.equal(moving.engine.bodies.cat.radius, 12);
        assertLayers(parts); assert(lit.impact.playerActive > 0);
        const nativeMotion = cat === 'CAT01' ? moving.g6Art.cat : moving.g6Art.held; assert.equal(nativeMotion.motion, 'walk');
        await p.screenshot({path: path.join(out, cat + '-moving.png')});
        await p.evaluate(() => { window.N1Test.arena.fireVolley = () => {}; });
        return {moving: {player: moving.player, shots: moving.shots, motion: nativeMotion}, impact: lit.impact, parts};
      }, p);
      for (const critical of [false, true]) await check(cat + '-native-' + (critical ? 'critical' : 'ordinary') + '-hit-and-sound', async () => {
        await fresh(p, cat); const before = await audio(p);
        await p.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio || '{}').ready === true);
        const result = await hit(p, critical); assert(result.hpAfter < result.hpBefore);
        assert.equal(result.nativeCritical, critical); assert(result.impact.targetActive > 0); assert.equal(result.impact.unpreparedPartsSkipped, 0);
        const parts = await layers(p, 'target'); assertLayers(parts);
        assert.equal(result.feedback.contactDetails.at(-1).critical, critical);
        const id = critical ? 'critical' : 'hit'; assert.equal(result.audio.events[id] - before.events[id], 1);
        assert.equal(result.audio.played[id] - before.played[id], 1, 'Real native Sound.play must accept the hit');
        assert.equal(result.audio.nativeSounds, 16); assert.equal(result.audio.audioBuffers, 12); assert(result.audio.maxEffectsPlaying <= 8);
        assert.deepEqual(result.target.body, result.body); assert(Math.abs(result.target.display.x - result.body.x) <= 1);
        const variant = result.audio.criticalVariant;
        if (critical) {
          assert.equal(result.audio.weapon, {CAT01: 'W01', CAT02: 'W04', CAT03: 'W02'}[cat]); assert(variant, 'Production audio must identify the adopted weapon critical bank');
          criticalBuffers[cat] = await p.evaluate(async () => {
            const buffer = window.N1Test.arena.game.cache.audio.get('f1-critical');
            if (!buffer || buffer.numberOfChannels !== 1) throw Error('Expected one adopted native mono critical AudioBuffer');
            const pcm = buffer.getChannelData(0);
            const bytes = await crypto.subtle.digest('SHA-256', pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
            return {length: buffer.length, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
              sha256: Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')};
          });
        }
        await p.screenshot({path: path.join(out, cat + '-' + id + '.png')});
        return {...result, parts, variant, nativeCriticalBuffer: critical ? criticalBuffers[cat] : null,
          controlledRNG: critical ? 'frac=0; actual primary roll' : 'frac=.99; actual primary roll'};
      }, p);
    }
    await check('three-weapons-use-distinct-actual-native-critical-buffers', async () => {
      assert.equal(Object.keys(criticalBuffers).length, 3); assert.equal(new Set(Object.values(criticalBuffers).map(b => b.sha256)).size, 3);
      return criticalBuffers;
    }, p);

    for (const source of ['SECONDARY', 'SUMMON']) await check(source + '-cannot-fabricate-primary-critical', async () => {
      await fresh(p); const result = await hit(p, true, source);
      assert(result.hpAfter < result.hpBefore); assert.equal(result.nativeCritical, false);
      assert(result.feedback.numberDetails.every(n => !n.critical));
      return {source, result};
    }, p);
    await check('real-enemy-projectile-collision-starts-player-flash', async () => {
      await fresh(p); const before = await state(p);
      await p.evaluate(() => { const x = window.N1Test; x.arena.enemyBubble(x.state().player, {x: 0, y: 0}, {size: 12, radius: 4, speed: 0, life: 2.5, damage: 10}); });
      const after = await steps(p); assert.equal(after.hp, before.hp - 10); assert(after.impact.playerActive > 0);
      return {hpLost: before.hp - after.hp, impact: after.impact, feedback: after.feedback};
    }, p);
    await check('coalescing-never-drops-real-damage-facts', async () => {
      await fresh(p); const before = await state(p), a0 = await audio(p);
      const facts = await p.evaluate(() => [window.N1Test.damage(2), window.N1Test.damage(3)]);
      const after = await steps(p), a1 = await audio(p);
      assert.deepEqual(facts.map(f => f.hpLost), [2, 3]); assert.equal(after.hp, before.hp - 5);
      assert.equal(a1.events.hurt - a0.events.hurt, 2); assert(after.impact.playerActive <= 6);
      assert.equal(after.feedback.numberDetails.filter(n => n.player).length, 2);
      return {facts, hpLost: before.hp - after.hp, impact: after.impact, feedback: after.feedback};
    }, p);
    await check('pause-upgrade-background-clear-and-explicit-resume', async () => {
      await fresh(p); await hit(p); await p.evaluate(() => window.N1Test.damage(10)); await steps(p);
      await action(p, 'pause'); const paused = await state(p); assertClear(paused); assert.equal((await audio(p)).effectsPlaying, 0);
      await tick(p, 1000); assert.equal((await state(p)).elapsed, paused.elapsed);
      await action(p, 'resume'); await steps(p, 12); assert.equal((await state(p)).impact.playerActive, 0);
      await clearEnemies(p); await hit(p); await p.evaluate(() => window.N1Test.damage(5)); await steps(p);
      await p.evaluate(() => window.N1Test.offer('L1_DAMAGE')); await frame(p, 'PAGE-07'); const offered = await state(p); assertClear(offered);
      await tick(p, 1000); assert.equal((await state(p)).elapsed, offered.elapsed);
      const key = offered.progression.runId + '.' + offered.progression.offer.id;
      await action(p, 'growth-select:' + key + '.L1_DAMAGE'); await action(p, 'growth-confirm:' + key + '.L1_DAMAGE');
      if ((await ui(p)).frame === 'N1-RECEIPT') await action(p, 'receipt-skip:' + key);
      await frame(p, 'PAGE-06'); await steps(p, 12); assert.equal((await state(p)).impact.playerActive, 0);
      await p.evaluate(() => window.N1Test.damage(5)); await steps(p);
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); });
      await frame(p, 'LAYER-02'); const hidden = await state(p); assert(hidden.reasons.includes('background')); assertClear(hidden);
      assert.equal((await audio(p)).effectsPlaying, 0);
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: false}); document.dispatchEvent(new Event('visibilitychange')); });
      await tick(p, 5000); assert.equal((await state(p)).elapsed, hidden.elapsed);
      await action(p, 'resume'); await steps(p, 12); const resumed = await state(p); assert(resumed.elapsed > hidden.elapsed); assert.equal(resumed.impact.playerActive, 0);
      await p.evaluate(() => delete document.hidden);
      return {paused: paused.elapsed, upgrade: offered.elapsed, background: hidden.elapsed, resumed: resumed.elapsed,
        visibilityScope: 'Synthetic hidden/visibilitychange invoking real main handler; not an OS background test'};
    }, p);
    const offsetPause = await open(); await start(offsetPause); await tick(offsetPause, 0);
    await check('P3-target-offset-immediately-clears-on-real-pause-and-low-quality', async () => {
      // Freeze native Tween progress only to observe the approved 1u initial
      // offset. Native Scene updates still synchronize the actual target art.
      await offsetPause.evaluate(() => { window.N1Test.arena.tweens.getDelta = () => 0; });
      const actual = await hit(offsetPause), before = await offset(offsetPause, actual.targetId);
      assert(actual.hpAfter < actual.hpBefore); assert.equal(before.offsetX, 1); assert.equal(before.poseX, 1); assert(before.poseTweening);
      await action(offsetPause, 'pause'); const paused = await offset(offsetPause, actual.targetId); assertOffsetCleared(before, paused);
      await action(offsetPause, 'settings'); await offsetPause.locator('#quality').selectOption('低');
      const low = await offset(offsetPause, actual.targetId); assertOffsetCleared(before, low); assert.equal(low.impact.quality, 'low');
      await offsetPause.screenshot({path: path.join(out, 'P3-pause-and-low-offset-cleared.png')});
      await offsetPause.evaluate(() => { window.N1Test.arena.tweens.getDelta = () => 1000 / 60; });
      return {actual: {hpBefore: actual.hpBefore, hpAfter: actual.hpAfter, targetId: actual.targetId}, before, paused, low,
        observation: 'Actual DOM pause and quality select; immediate reads without art.sync, Scene tick or manual offset correction'};
    }, offsetPause); await offsetPause.close();
    const offsetReduce = await open(); await start(offsetReduce); await tick(offsetReduce, 0);
    await check('P3-target-offset-immediately-clears-on-native-reduced-motion-event', async () => {
      await offsetReduce.evaluate(() => {
        window.N1Test.arena.tweens.getDelta = () => 0;
        window.impactMotionChanges = [];
        matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => window.impactMotionChanges.push({matches: e.matches, trusted: e.isTrusted}));
      });
      const actual = await hit(offsetReduce), before = await offset(offsetReduce, actual.targetId);
      assert(actual.hpAfter < actual.hpBefore); assert.equal(before.offsetX, 1); assert.equal(before.poseX, 1); assert(before.poseTweening);
      await offsetReduce.emulateMedia({reducedMotion: 'reduce'});
      await offsetReduce.waitForFunction(() => window.impactMotionChanges.some(e => e.matches && e.trusted));
      const reduced = await offset(offsetReduce, actual.targetId); assertOffsetCleared(before, reduced); assert.equal(reduced.impact.reducedMotion, true);
      const events = await offsetReduce.evaluate(() => window.impactMotionChanges);
      await offsetReduce.screenshot({path: path.join(out, 'P3-native-reduced-offset-cleared.png')});
      await offsetReduce.evaluate(() => { window.N1Test.arena.tweens.getDelta = () => 1000 / 60; });
      return {actual: {hpBefore: actual.hpBefore, hpAfter: actual.hpAfter, targetId: actual.targetId}, before, reduced, events,
        observation: 'Browser-emulated media preference with trusted native MediaQueryList change; immediate reads without Scene tick or art.sync. Not a physical OS setting change.'};
    }, offsetReduce); await offsetReduce.close();
    for (const mode of ['low', 'reduced']) await check(mode + '-uses-native-outline-and-preserves-body', async () => {
      const q = await open(mode === 'reduced' ? {reducedMotion: 'reduce'} : {}); await start(q);
      if (mode === 'low') { await action(q, 'pause'); await action(q, 'settings'); await q.locator('#quality').selectOption('低'); await action(q, 'close'); await action(q, 'resume'); }
      const before = await state(q); await q.evaluate(() => window.N1Test.damage(10)); const after = await steps(q), parts = await layers(q);
      assertLayers(parts, true); assert.equal(after.impact[mode === 'low' ? 'quality' : 'reducedMotion'], mode === 'low' ? 'low' : true);
      assert.deepEqual(after.player, before.player); assert.equal(after.engine.bodies.cat.radius, 12); assert.equal(after.catDisplay.width, 42);
      await q.screenshot({path: path.join(out, mode + '-outline.png')}); await q.close(); return {impact: after.impact, parts};
    }, p);
    await check('native-special-timeline-150-300-450-600', async () => {
      await fresh(p); const initial = await state(p), encounters = [];
      assert.match(initial.progression.rulesVersion, /normal50/); assert.equal(initial.durationSeconds, 600);
      const base = await p.evaluate(() => window.N1Test.arena.growth.base);
      assert.equal(base.growthPool, 'normal');
      for (const due of [150, 300, 450]) {
        await tick(p, due * 1000 - (await state(p)).elapsed * 1000); await tick(p, 1201);
        await p.evaluate(() => window.N1Test.parkSpecials()); const s = await state(p);
        const encounter = s.level.encounters.find(e => e.dueAt === due);
        assert(encounter && encounter.spawnedAt !== null && encounter.birthId !== null); assert.equal(s.result, null);
        assert(s.impact.enabled); assert.equal(s.impact.unpreparedPartsSkipped, 0); encounters.push(encounter);
      }
      await tick(p, 599999 - (await state(p)).elapsed * 1000); assert.equal((await state(p)).result, null);
      await tick(p, 1.01); const ended = await state(p); assert.equal(ended.elapsed, 600); assert.equal(ended.result, 'timeout'); assertClear(ended);
      return {normalPool: base.growthPool, rules: initial.progression.rulesVersion, duration: initial.durationSeconds, encounters, result: ended.result};
    }, p);
    await check('native-boss-death-clears-impact-and-opens-actual-ending', async () => {
      await action(p, 'restart');
      for (const due of [150, 300, 450]) { await tick(p, due * 1000 - (await state(p)).elapsed * 1000); await tick(p, 1201); await p.evaluate(() => window.N1Test.parkSpecials()); }
      const damage = await p.evaluate(() => window.N1Test.defeat('B01')); await tick(p, 16);
      const ended = await state(p); assert.equal(ended.result, 'cleared'); assertClear(ended); await frame(p, 'N1-END');
      // Current ending is a native timed motion comic; this impact check only
      // verifies the real victory handoff and explicit skip into actual results.
      await action(p, 'chapter-skip'); await frame(p, 'PAGE-08');
      return {damage, result: ended.result, elapsed: ended.elapsed, impact: ended.impact};
    }, p);
    await action(p, 'restart');
    await check('legal-high-load-rewards-keep-native-limits', async () => {
      const cards = ['L1_SPLIT', 'L1_ECHO', 'L1_PIERCE', 'L1_DAMAGE', 'L1_RATE', 'L1_EVO_BARRAGE', 'L1_RELOAD', 'L1_EVO_CADENCE',
        'L1_ORBIT_BELL', 'L1_ORBIT_BELL', 'L1_ORBIT_BELL', 'L1_PICKUP_CHIME', 'L1_DUO_STAR_RING', 'L1_TRAIL_BELL', 'L1_DUO_TRAIL_CADENCE',
        'C23', 'E21', 'C15', 'C16', 'E16', 'C12', 'C13', 'E14'];
      const transactions = []; for (const card of cards) transactions.push(await pick(p, card));
      const built = await state(p); assert.equal(built.progression.confirmedPicks, cards.length); assert.equal(built.progression.ranks.L1_ORBIT_BELL, 3);
      const sampled = await p.evaluate(() => {
        const x = window.N1Test, a = x.arena, samples = [];
        a.fireVolley = Object.getPrototypeOf(a).fireVolley;
        a.projectileRandom.frac = () => 0;
        // Controlled catalog enemies use unchanged HP and mechanics. Replenish
        // actual dead bodies to stress a legal build, rather than inflating HP.
        for (let frame = 0; frame < 600; frame++) {
          if (frame % 20 === 0) {
            const live = a.enemies.getChildren().filter(e => e.active).length;
            for (let i = live; i < 8; i++) { const e = a.placeSliceEnemy('E01', 420 + (i % 3) * 20, 680 + Math.floor(i / 3) * 25); if (e) e.body.moves = false; }
          }
          x.tick(1000 / 60);
          if (x.state().progression.offer) throw Error('Unexpected real XP offer; stress must not continue across upgrade pause');
          if (frame % 10 === 0) { a.game.renderer.preRender(); a.game.scene.render(a.game.renderer); a.game.renderer.postRender(); }
          if (frame % 20 === 0) { const s = x.state(); samples.push({elapsed: s.elapsed, impact: s.impact, enemies: s.enemies, projectiles: s.projectiles, sourceCounts: s.sourceCounts, failed: s.projectileDiagnostics.failedSpawns}); }
        }
        a.fireVolley = () => {}; return samples;
      });
      assert(sampled.some(s => s.sourceCounts.PRIMARY > 0)); assert(sampled.some(s => s.impact.targetPartsActive > 0));
      for (const s of sampled) { assert(s.impact.playerActive <= 6); assert(s.impact.targetActive <= 8); assert(s.impact.targetPartsActive <= 32); assert(s.impact.allocated <= 38); assert.equal(s.impact.unpreparedPartsSkipped, 0); }
      const after = await state(p), sound = await audio(p); assert.equal(after.result, null); assert(sound.maxEffectsPlaying <= 8); assert.equal(sound.nativeSounds, 16); assert.equal(sound.audioBuffers, 12);
      await p.screenshot({path: path.join(out, 'legal-high-load.png')});
      return {transactions, samples: sampled, final: {hp: after.hp, ranks: after.progression.ranks, sources: after.sourceCounts, impact: after.impact}, sound,
        renderScope: 'Native render observations during controlled stepping; no render FPS or wall-clock endurance claim'};
    }, p);
    for (const cat of ['CAT01', 'CAT02', 'CAT03']) await check(cat + '-presentation-on-off-rule-isolation', async () => {
      const runs = [];
      for (const enabled of [false, true]) {
        await fresh(p, cat); const transactions = [];
        for (const card of ['C13', 'L1_SPLIT', 'L1_DAMAGE', 'L1_ORBIT_BELL']) transactions.push(await pick(p, card));
        await p.evaluate(enabled => {
          const a = window.N1Test.arena;
          a.impact.configure(enabled, 'standard', .70, false);
          a.fireVolley = Object.getPrototypeOf(a).fireVolley;
          a.projectileRandom.frac = Object.getPrototypeOf(a.projectileRandom).frac.bind(a.projectileRandom);
          a.projectileRandom.sow(['impact-normal-rule-isolation']);
          for (const [x, y] of [[460, 720], [480, 740], [500, 700]]) a.placeSliceEnemy('E01', x, y);
        }, enabled);
        await p.keyboard.down('d'); await steps(p, 30, false); await p.keyboard.up('d');
        const fact = await p.evaluate(() => window.N1Test.damage(30)); await steps(p, 90);
        const s = await state(p);
        assert.equal(s.impact.enabled, enabled);
        const physical = await p.evaluate(() => {
          const a = window.N1Test.arena;
          return {enemies: a.enemies.getChildren().filter(e => e.active).map(e => ({id: e.getData('id'), hp: e.getData('hp'), enemyId: e.getData('enemyId'), x: e.body.center.x, y: e.body.center.y, vx: e.body.velocity.x, vy: e.body.velocity.y})),
            projectiles: a.projectiles.getChildren().filter(e => e.active).map(e => ({id: e.getData('projectileId'), source: e.getData('source'), damage: e.getData('damage'), critical: e.getData('critical'), x: e.body.center.x, y: e.body.center.y}))};
        });
        runs.push({enabled, transactions, impact: s.impact, rules: {hp: s.hp, maxHp: s.maxHp, defense: s.defense, ammo: s.ammo,
          shots: s.shots, kills: s.kills, sourceCounts: s.sourceCounts, player: s.player, result: s.result, elapsed: s.elapsed,
          xp: s.progression.totalXP, picks: s.progression.confirmedPicks, ranks: s.progression.ranks, pending: s.progression.pending,
          criticalHits: s.projectileTraits.criticalHits, rolls: s.projectileTraits.rolls, enemyBehaviors: s.enemyBehaviors, fact, physical}});
        await p.evaluate(() => { window.N1Test.arena.fireVolley = () => {}; });
      }
      assert.deepEqual(runs[0].rules, runs[1].rules);
      return {runs, rngScope: 'Reward draws use existing N1 legal-offer seed search; projectile RNG seeded identically. Ordinary spawns suppressed, fixed native E01 placements; existing global Boss/spawn random debt is not a claim of full-game determinism.'};
    }, p);
    await check('twenty-death-restarts-release-pulses-and-bound-native-resources', async () => {
      await fresh(p); const samples = [], runs = [];
      for (let i = 0; i < 20; i++) {
        await hit(p); await p.evaluate(() => window.N1Test.damage(10)); await steps(p);
        await p.evaluate(() => window.N1Test.damage(100000)); await tick(p, 0);
        const dead = await state(p); assert.equal(dead.result, 'death'); assertClear(dead); assert.equal((await audio(p)).effectsPlaying, 0);
        await action(p, 'restart'); await steps(p, 1); const live = await state(p), sound = await audio(p);
        assertClear(live); assert.equal(live.hp, live.maxHp); assert.equal(live.progression.confirmedPicks, 0); assert.equal(live.progression.offer, null);
        assert.equal(live.moveHeld, false); assert.equal(live.impact.unpreparedPartsSkipped, 0); assert(live.impact.allocated <= 38);
        const counts = await p.evaluate(() => window.N1Test.counts());
        samples.push({counts, cacheSources: live.impact.cacheSources, derivedTotalBytes: live.impact.derivedTotalBytes,
          allocated: live.impact.allocated, nativeSounds: sound.nativeSounds, audioBuffers: sound.audioBuffers}); runs.push(live.progression.runId);
      }
      assert.equal(new Set(runs).size, 20);
      for (const sample of samples.slice(1)) assert.deepEqual(sample, samples[0], 'Repeated same real scenario must stop growing after warmup');
      return {runs, samples};
    }, p);
    await check('served-artifacts-remain-identical-after-suite', async () => {
      const before = report.identity; await identity();
      assert.equal(report.identity.actualMainSHA256, before.actualMainSHA256); assert.equal(report.identity.fixtureSHA256, before.fixtureSHA256);
      return {actualMainSHA256: before.actualMainSHA256, fixtureSHA256: before.fixtureSHA256};
    }, null, 'ARTIFACT_IDENTITY');
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL'; report.failure = error.stack;
    if (!report.checks.some(c => c.status === 'Fail')) report.checks.push({name: 'environment-or-harness', status: 'Blocked', scope: 'HARNESS', error: String(error)});
    process.exitCode = 1; console.error(error);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser?.close(); if (report.pageErrors.length) { report.status = 'FAIL'; process.exitCode = 1; }
    save(); console.log(JSON.stringify({status: report.status, out, checks: report.checks.length, failed: report.checks.filter(c => c.status !== 'Pass').map(c => ({name: c.name, error: c.error})), pageErrors: report.pageErrors}));
  }
})();
