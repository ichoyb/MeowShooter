'use strict';
// Normal URL and real input only. The separately supplied Scene fixture may advance its own clock.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const url = process.env.G6_URL;
const controlledUrl = process.env.G6_TIMELINE_URL;
const out = path.resolve(process.env.G6_CHECK_DIR || '../.local/checks/g6-normal-browser');
const fullRun = process.argv.includes('--full-run');
const reachTimeLimit = process.argv.includes('--reach-time-limit');
if (reachTimeLimit && !fullRun) throw Error('--reach-time-limit requires --full-run');
const timelineOnly = process.argv.includes('--timeline-only');
const balanceG7 = process.argv.includes('--g7');
const pairs = {CAT01: ['W01', balanceG7 ? 16 : 12], CAT02: ['W04', 29], CAT03: ['W02', 7.5]};
const catArg = process.argv.find(arg=>arg.startsWith('--cat='));
const cats = catArg ? [catArg.slice('--cat='.length)] : Object.keys(pairs);
if (cats.some(cat=>!Object.hasOwn(pairs,cat))) throw Error('Use --cat=CAT01, CAT02 or CAT03');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const state = page => page.evaluate(() => JSON.parse(document.querySelector('#app').dataset.state));
const ui = page => page.evaluate(() => JSON.parse(document.querySelector('#app').dataset.ui));
const action = (page, id) => page.locator(`button[data-action="${id}"]:visible`).last();
const click = (page, id) => action(page, id).click();
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, {timeout: 9000});
const motion = s => s.catId === 'CAT01' ? s.g6Art?.cat : s.g6Art?.held;
const shot = (page, name) => page.screenshot({path: path.join(out, `${name}.png`)});

if (timelineOnly ? !controlledUrl : !url) throw Error(timelineOnly ? 'G6_TIMELINE_URL required' : 'G6_URL required');
fs.mkdirSync(out, {recursive: true});

const evidence = {url, controlledUrl, runnerSHA256: sha(fs.readFileSync(__filename)),
  startedUtc: new Date().toISOString(), checks: [], errors: [],
  environment: 'Windows desktop headless Chrome, 390×844 CSS, DPR 2',
  phone: 'NOT_TESTED', platform: 'NOT_TESTED', minimumKernel: 'NOT_TESTED'};
function save() {
  fs.writeFileSync(path.join(out, 'normal.json'), JSON.stringify(evidence, null, 2) + '\n');
}
function observe(name, detail) {
  evidence.checks.push({name, detail});
  save();
  console.log(`PASS ${name}`);
}

function initial(s, cat) {
  const [weapon, damage] = pairs[cat];
  assert.equal(s.catId, cat);
  assert.equal(s.weaponId, weapon);
  assert.equal(s.durationSeconds, 600);
  assert.equal(s.progression.rulesVersion, 'courtyard-growth-normal50-v18');
  assert.equal(s.progression.level, 1);
  assert.equal(s.progression.confirmedPicks, 0);
  assert.equal(s.progression.totalXP, 0);
  assert.equal(s.progression.pending, 0);
  assert.equal(s.progression.eliteRewards.length, 0);
  assert(Object.values(s.progression.ranks).every(rank => rank === 0));
  assert.equal(s.weaponStats.damage, damage);
  if (balanceG7) {
    assert.match(s.rulesVersion, /-balance-g7-v1-/);
    assert.equal(s.moveSpeed, {CAT01:185,CAT02:175,CAT03:162}[cat]);
    assert.equal(s.maxHp, {CAT01:95,CAT02:100,CAT03:120}[cat]);
  }
  assert.equal(s.catDisplay.width, 36);
  assert.equal(s.engine.bodies.cat.radius, 12);
  assert.equal(s.moveHeld, false);
  assert.deepEqual(s.level.encounters.map(({encounterId, enemyId, dueAt, spawnedAt}) =>
    [encounterId, enemyId, dueAt, spawnedAt]), [
    ['elite-1', 'EL01', 150, null], ['elite-2', 'EL01', 300, null], ['boss-1', 'B01', 450, null],
  ]);
}

function checkArt(s) {
  assert(s.g6Art, 'G6 art must be connected to the real normal battle');
  const {rewards, bells, areas, flight, huntContracts} = s.g6Art;
  assert(rewards && bells && areas && flight && huntContracts, 'All G6 presentations must be connected');
  assert.equal(rewards.enabled, true);
  assert.equal(bells.enabled, true);
  assert.equal(flight.enabled, true);
  const cat = motion(s);
  assert(cat?.active && cat.visible, `${s.catId} must use visible G6 art`);
  assert.equal(cat.bodyDisplay.width, 36);
  assert.equal(cat.bodyDisplay.height, 36);
  for (const part of [cat, rewards, bells, areas, flight]) assert.equal(part.physicalBodies, 0);
  return cat;
}

async function start(page, cat) {
  await click(page, 'select');
  await click(page, `choose:${cat}`);
  await click(page, 'confirm-select');
  await click(page, 'start');
  if((await ui(page)).page==='N1-OPEN')await click(page,'chapter-skip');
  await wait(page, () => JSON.parse(document.querySelector('#app').dataset.state).elapsed > .05);
  assert.equal((await ui(page)).source, 'actual');
  const s = await state(page);
  initial(s, cat);
  return s;
}

async function walk(page, cat, startState) {
  const before = checkArt(startState);
  assert.equal(before.motion, 'idle');
  assert.equal(before.actualSpeed, 0);
  assert.equal(before.walkFrames, 0);
  await shot(page, `${cat}-idle`);
  await page.keyboard.down('d');
  let moving;
  try {
    await wait(page, ({cat, x}) => {
      const s = JSON.parse(document.querySelector('#app').dataset.state);
      const art = cat === 'CAT01' ? s.g6Art.cat : s.g6Art.held;
      return art.motion === 'walk' && art.transition === 'steady' && art.walkFrames >= 2 && s.player.x > x + 10;
    }, {cat, x: startState.player.x});
    moving = await state(page);
    const art = checkArt(moving);
    assert.equal(art.facing, 'right');
    assert(art.actualSpeed > 0);
    assert(Math.abs(art.walkTimeScale - art.actualSpeed / art.referenceSpeed) < 1e-6);
    await shot(page, `${cat}-walk`);
  } finally {
    await page.keyboard.up('d');
  }
  await wait(page, cat => {
    const s = JSON.parse(document.querySelector('#app').dataset.state);
    const art = cat === 'CAT01' ? s.g6Art.cat : s.g6Art.held;
    return art.motion === 'idle' && art.transition === 'idle' && art.actualSpeed === 0;
  }, cat);
  const stopped = await state(page);
  return {idle: before, walk: motion(moving), stopped: motion(stopped), from: startState.player, to: stopped.player};
}

async function pauseSettings(page, cat) {
  await click(page, 'pause');
  await wait(page, () => JSON.parse(document.querySelector('#app').dataset.state).engine.paused);
  const paused = await state(page);
  assert.equal(motion(paused).paused, true);
  for (const [label, quality, density] of [['低', 'low', 1], ['标准', 'standard', 2]]) {
    await click(page, 'settings');
    await page.locator('#quality').selectOption(label);
    await click(page, 'close');
    const s = await state(page);
    assert.equal(s.engine.paused, true);
    assert.equal(s.engine.quality, quality);
    assert.equal(s.engine.density, density);
    assert.equal(s.g6Art.bells.quality, quality);
    assert.equal(s.g6Art.flight.quality, quality);
    for (const key of ['elapsed', 'player', 'hp', 'shots', 'progression']) assert.deepEqual(s[key], paused[key], key);
    assert.deepEqual(motion(s), motion(paused));
    for (const key of ['x', 'y', 'width', 'height']) {
      assert(Math.abs(s.engine.camera.view[key] - paused.engine.camera.view[key]) < .0001, `camera ${key}`);
    }
    checkArt(s);
    if (cat === 'CAT01' && quality === 'low') await shot(page, 'CAT01-paused-low');
  }
  await click(page, 'resume');
  await wait(page, elapsed => {
    const s = JSON.parse(document.querySelector('#app').dataset.state);
    return !s.engine.paused && s.elapsed > elapsed;
  }, paused.elapsed);
  const resumed = await state(page);
  assert.equal(motion(resumed).paused, false);
  assert.equal(resumed.moveHeld, false);
  assert.deepEqual(resumed.player, paused.player);
  return {pausedElapsed: paused.elapsed, resumedElapsed: resumed.elapsed, worldView: paused.engine.camera.view};
}

function steer(s) {
  const {player: p} = s;
  const enemies = s.targets.filter(t => t.kind === 'enemy');
  const distance = t => Math.hypot(t.x - p.x, t.y - p.y);
  const orb = s.pickups.orbs.slice().sort((a, b) => distance(a) - distance(b))
    .find(o => !enemies.some(e => Math.hypot(e.x - o.x, e.y - o.y) < 50));
  let x, y;
  const boss = reachTimeLimit && s.boss ? enemies.find(enemy => enemy.id === s.boss.id) : null;
  if (boss) {
    // A normal-input endurance strategy: avoid the Boss and do not collect XP
    // beside it. No combat state, time, HP or firing behavior is overridden.
    const dx=p.x-boss.x,dy=p.y-boss.y,d=Math.max(1,Math.hypot(dx,dy));
    const desired=Math.max(340,(s.weaponStats.range||190)+140);
    x=-dy/d*.7+dx/d*(desired-d)*.018;
    y=dx/d*.7+dy/d*(desired-d)*.018;
  } else if (orb) {
    const d = Math.max(1, distance(orb));
    x = (orb.x - p.x) / d;
    y = (orb.y - p.y) / d;
  } else {
    const dx = p.x - 360, dy = p.y - 720, d = Math.max(1, Math.hypot(dx, dy));
    x = -dy / d * .7 + dx / d * (200 - d) * .012;
    y = dx / d * .7 + dy / d * (200 - d) * .012;
  }
  for (const [targets, range, weight] of [[enemies, 110, 28], [s.enemyProjectiles, 70, 15]]) {
    for (const t of targets) {
      const d = Math.max(1, distance(t));
      if (d >= range) continue;
      x += (p.x - t.x) / d * (range - d) / weight;
      y += (p.y - t.y) / d * (range - d) / weight;
    }
  }
  x += Number(p.x < 65) * 2 - Number(p.x > 655) * 2;
  y += Number(p.y < 65) * 2 - Number(p.y > 1375) * 2;
  return [x > .2 && 'd', x < -.2 && 'a', y > .2 && 's', y < -.2 && 'w'].filter(Boolean);
}

async function confirmGrowth(page, s, first) {
  const p = s.progression, offer = p.offer;
  assert.equal(new Set(offer.choices).size, 3);
  const priority = reachTimeLimit
    ? ['L1_HEART','A13','C13','C21','L1_MOVE','L1_RELOAD','M10','A10']
    : ['L1_TRAIL_BELL', 'L1_ORBIT_BELL', 'L1_DAMAGE', 'L1_RATE', 'L1_HEART', 'L1_RELOAD', 'L1_MOVE'];
  const card = priority.find(id => offer.choices.includes(id)) || offer.choices[0];
  if (first) {
    assert.equal(offer.source, 'experience');
    assert(s.pickups.collectedXP > 0);
    await shot(page, `${s.catId}-growth-offer`);
    await click(page, `growth-detail:${card}`);
    assert.deepEqual((await state(page)).progression.offer, offer);
    await click(page, 'close');
  }
  const key = `${p.runId}.${offer.id}.${card}`;
  await click(page, `growth-select:${key}`);
  assert.equal((await state(page)).progression.confirmedPicks, p.confirmedPicks);
  await click(page, `growth-confirm:${key}`);
  const after = await state(page);
  assert.equal(after.progression.confirmedPicks, p.confirmedPicks + 1);
  assert.equal(after.progression.ranks[card], (p.ranks[card] || 0) + 1);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#app').dataset.ui).frame!=='N1-RECEIPT');
  return {elapsed: s.elapsed, collectedXP: s.pickups.collectedXP, offer, card, rank: after.progression.ranks[card]};
}

async function play(page) {
  const started = Date.now(), trace = [], picks = [];
  const keys = new Set();
  async function setKeys(next) {
    for (const k of keys) {
      if (next.includes(k)) continue;
      await page.keyboard.up(k);
      keys.delete(k);
    }
    for (const k of next) {
      if (keys.has(k)) continue;
      await page.keyboard.down(k);
      keys.add(k);
    }
  }
  try {
    while (Date.now() - started < (fullRun ? 900000 : 100000)) {
      const s = await state(page);
      if (!trace.length || s.elapsed - trace.at(-1).elapsed >= 10 || s.result) {
        trace.push({elapsed: s.elapsed, hp: s.hp, kills: s.kills, shots: s.shots, encounters: s.level.encounters,
          frames: s.engine.renderFrames, failedSpawns: s.projectileDiagnostics.failedSpawns});
        fs.writeFileSync(path.join(out, 'play-progress.json'), JSON.stringify({mainSHA256: evidence.mainSHA256, picks, trace}, null, 2) + '\n');
      }
      if (s.result) break;
      if (s.progression.offer) {
        await setKeys([]);
        picks.push(await confirmGrowth(page, s, !picks.length));
        if (!fullRun) break;
        continue;
      }
      assert.equal(s.engine.paused, false);
      await setKeys(steer(s));
      await page.waitForTimeout(100);
    }
  } finally {
    await setKeys([]);
  }
  const final = await state(page);
  assert(picks.length, 'real battle must earn XP and confirm an actual reward');
  if (fullRun) assert(final.result, 'normal full-run mode must reach a real result');
  if (reachTimeLimit) assert(final.elapsed >= final.durationSeconds, 'endurance strategy did not reach the actual time cap');
  return {picks, trace, result: final.result, elapsed: final.elapsed, frames: final.engine.renderFrames};
}

async function restart(page, cat) {
  const before = await state(page);
  const origin = await page.evaluate(() => performance.timeOrigin);
  if (before.result) {
    if((await ui(page)).page==='N1-END')await click(page,'chapter-skip');
    await shot(page, `${cat}-result`);
    await click(page, 'restart');
  } else {
    await click(page, 'pause');
    await click(page, 'end');
    await click(page, 'confirm-end');
    const home = await state(page);
    assert(!home.g6Art, 'home must not expose active G6 battle diagnostics');
    await click(page, 'start');
  }
  await wait(page, id => JSON.parse(document.querySelector('#app').dataset.state).progression?.runId !== id,
    before.progression.runId);
  const after = await state(page);
  initial(after, cat);
  const art = checkArt(after);
  assert.equal(art.motion, 'idle');
  assert.equal(art.walkFrames, 0);
  assert.equal(after.g6Art.rewards.pendingTimers, 0);
  assert.equal(after.g6Art.rewards.activeEffects, 0);
  assert.equal(after.g6Art.bells.orbitCount, 0);
  assert.equal(after.g6Art.bells.trailCount, 0);
  assert.equal(after.g6Art.flight.activeTrails, 0);
  assert.equal(after.g6Art.huntContracts.markedId, null);
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  return {previousRun: before.progression.runId, nextRun: after.progression.runId, elapsed: after.elapsed,
    frames: after.engine.renderFrames, art: after.g6Art};
}

async function normal(browser, cat) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  page.on('pageerror', e => evidence.errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400) evidence.errors.push(`${r.status()} ${r.url()}`);
  });
  try {
    const [main] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/assets/main.js')),
      page.goto(url),
    ]);
    const mainSHA256 = sha(await main.body());
    evidence.mainSHA256 ??= mainSHA256;
    assert.equal(evidence.mainSHA256, mainSHA256);
    await wait(page, () => document.querySelector('#app')?.dataset.ready === 'true');
    assert.equal(await page.locator('#app').getAttribute('data-build-profile'), 'playtest');
    assert.equal(await page.evaluate(() => [window.g6, window.qaArena, window.growthTestArena].every(v => v === undefined)), true);
    assert(!((await state(page)).g6Art), 'home must not expose active G6 battle diagnostics');
    const s = await start(page, cat);
    observe(`${cat} normal entry, fixed pairing, 50-pool marker and 600s limit`, {
      weapon: s.weaponId, weaponDamage: s.weaponStats.damage, rulesVersion: s.progression.rulesVersion,
      durationSeconds: s.durationSeconds, encounters: s.level.encounters, catDisplay: s.catDisplay,
      radius: s.engine.bodies.cat.radius,
    });
    observe(`${cat} native idle, walk and release at 36u`, await walk(page, cat, s));
    observe(`${cat} pause, low/standard quality and resume`, await pauseSettings(page, cat));
    if (fullRun || cat === 'CAT01' || balanceG7) observe(`${cat} actual XP and upgrade${fullRun ? ' through result' : ''}`, await play(page));
    observe(`${cat} clean new run without page reload`, await restart(page, cat));
  } finally {
    await page.close();
  }
}

async function timeline(browser) {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  page.on('pageerror', e => evidence.errors.push(e.message));
  try {
    const [script] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/assets/g6-timeline.js')),
      page.goto(controlledUrl),
    ]);
    const fixtureSHA256 = sha(await script.body());
    const manifestResponse = await page.request.get(new URL('../g6-timeline.json', script.url()).href);
    assert(manifestResponse.ok(), 'timeline build receipt must be reachable');
    const manifest = await manifestResponse.json();
    assert.equal(manifest.fixtureSHA256, fixtureSHA256);
    evidence.mainSHA256 ??= manifest.mainSHA256;
    assert.equal(evidence.mainSHA256, manifest.mainSHA256, 'timeline and normal build hashes must agree');
    await wait(page, () => typeof window.runG6NormalTimeline === 'function');
    const result = await page.evaluate(() => window.runG6NormalTimeline());
    evidence.controlledTimeline = {fixtureSHA256, result};
    assert.equal(result.status, 'PASS', result.error);
    observe('controlled native Scene 600s and 150/300/450 encounters', {fixtureSHA256, checks: result.checks.length});
  } finally {
    await page.close();
  }
}

(async () => {
  let browser;
  try {
    evidence.status = 'RUNNING';
    save();
    browser = await chromium.launch({channel: 'chrome', headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']});
    evidence.browserVersion = browser.version();
    if (!timelineOnly) for (const cat of cats) await normal(browser, cat);
    if (controlledUrl) await timeline(browser);
    assert.deepEqual(evidence.errors, []);
    evidence.status = 'PASS';
  } catch (error) {
    evidence.status = 'FAIL';
    evidence.failure = {message: error.message, stack: error.stack};
    console.error(error);
    process.exitCode = 1;
  } finally {
    evidence.finishedUtc = new Date().toISOString();
    save();
    await browser?.close();
  }
})();
