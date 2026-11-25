'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {chromium} = require(process.env.N1_PLAYWRIGHT_MODULE || process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const normalDist = path.resolve(process.env.N1_NORMAL_DIST || path.join(root, 'app/dist-playtest-0.4.2'));
const sceneDir = path.resolve(process.env.N1_SCENE_DIR || path.join(root, '.local/checks/n1-runtime-20261112/scene'));
const normalURL = process.env.N1_NORMAL_URL || 'http://127.0.0.1:9051/app/dist-playtest-0.4.2/';
const sceneURL = process.env.N1_SCENE_URL || 'http://127.0.0.1:9051/.local/checks/n1-runtime-20261112/scene/';
const out = path.resolve(process.env.N1_RUNTIME_OUT || path.join(root, '.local/checks/n1-runtime-20261112', 'run-' + new Date().toISOString().replace(/[:.]/g, '-')));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity = {normalMainSHA256: sha(path.join(normalDist, 'assets/main.js')), normalStyleSHA256: sha(path.join(normalDist, 'assets/style.css')),
  fixture: JSON.parse(fs.readFileSync(path.join(sceneDir, 'n1-runtime.json'), 'utf8'))};
assert.equal(identity.fixture.normalMainSHA256, identity.normalMainSHA256);
assert.equal(identity.fixture.normalStyleSHA256, identity.normalStyleSHA256);
assert.equal(sha(path.join(sceneDir, 'assets/n1-runtime.js')), identity.fixture.fixtureSHA256);
fs.mkdirSync(out, {recursive: true});
const checks = [], pageErrors = [], actions = [], contextPages = [];
const checkScope = process.env.N1_CHECK_SCOPE || 'all';
assert(['all', 'normal', 'controlled'].includes(checkScope));
let browser;
const state = p => p.evaluate(() => JSON.parse(document.getElementById('app').dataset.state));
const ui = p => p.evaluate(() => JSON.parse(document.getElementById('app').dataset.ui));
const frame = async (p, expected) => p.waitForFunction(expected => JSON.parse(document.getElementById('app').dataset.ui).frame.startsWith(expected), expected);
const action = async (p, value) => { actions.push(value); await p.locator('button[data-action="' + value + '"]:visible').last().click(); };
const shot = async (p, name) => { const file = name.replace(/[^a-zA-Z0-9_-]/g, '-') + '.png'; await p.screenshot({path: path.join(out, file)}); return file; };
async function check(name, scope, fn, p) {
  try { const detail = await fn(); checks.push({name, scope, status: 'Pass', detail}); }
  catch (error) { const evidence = p && !p.isClosed() ? await shot(p, 'FAIL-' + name).catch(() => null) : null;
    checks.push({name, scope, status: 'Fail', error: String(error), stack: error.stack, evidence});
    // Each layout case owns a fresh page; collect every independent failure.
    // Stateful transaction cases still stop rather than cascading bad state.
    if(!name.includes('four-size')&&!name.startsWith('controlled-long-selected-'))throw error;
  }
}
async function open(controlled = false, viewport = {width: 390, height: 844}, options = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, ...options}), p = await context.newPage();
  contextPages.push({context, p}); p.on('pageerror', error => pageErrors.push({url: p.url(), error: String(error)}));
  await p.goto(controlled ? sceneURL : normalURL);
  await p.waitForFunction(() => document.getElementById('app')?.dataset.ready === 'true');
  if (controlled) { await p.waitForFunction(() => window.N1Test?.ready); await p.evaluate(() => { window.N1Test.hold(); window.N1Test.isolate(); }); }
  else assert.equal(await p.evaluate(() => typeof window.N1Test), 'undefined', 'Normal player entry must not expose the fixture');
  return p;
}
async function start(p) { await action(p, 'start'); if ((await ui(p)).frame === 'N1-OPEN') await action(p, 'chapter-skip'); await frame(p, 'PAGE-06'); }
async function home(p) {
  const current=await ui(p);
  if(current.inProbe) {
    if(current.frame.startsWith('PAGE-07')||current.frame==='N1-RECEIPT')await p.keyboard.press('Escape');
    else if(!current.frame.startsWith('LAYER-02'))await action(p,'pause');
    await frame(p,'LAYER-02');await action(p,'end');await action(p,'confirm-end');
  } else await action(p,'home');
  await frame(p,'PAGE-02');
}
const tick = (p, ms) => p.evaluate(ms => window.N1Test.tick(ms), ms);
async function choose(p, card, expectedMode, xp, inspectOffer) {
  const before = await p.evaluate(({card, xp}) => window.N1Test.offer(card, xp), {card, xp});
  await frame(p, 'PAGE-07'); const offer = before.state.progression.offer;
  assert(offer.choices.includes(card));
  if(inspectOffer)await inspectOffer(before.state);
  await action(p, 'growth-select:' + before.state.progression.runId + '.' + offer.id + '.' + card);
  const beforeConfirm = await state(p);
  await action(p, 'growth-confirm:' + before.state.progression.runId + '.' + offer.id + '.' + card);
  const key = before.state.progression.runId + '.' + offer.id;
  await p.waitForFunction(key => window.N1Test.events.some(e => e.type === 'receipt' && e.key === key), key);
  const receipt = await p.evaluate(key => window.N1Test.events.find(e => e.type === 'receipt' && e.key === key), key);
  assert(receipt.className.includes('is-' + expectedMode));
  assert.equal(receipt.state.progression.confirmedPicks, beforeConfirm.progression.confirmedPicks + 1);
  assert.equal(receipt.state.elapsed, beforeConfirm.elapsed);
  const during = await tick(p, 100); assert.equal(during.elapsed, beforeConfirm.elapsed, 'Receipt must freeze actual battle time');
  await p.waitForFunction(key => JSON.parse(document.getElementById('app').dataset.ui).narrative.receipt?.key !== key, key);
  const after = await state(p);
  const end = await p.evaluate(key => window.N1Test.events.find(e => e.type === 'animationend' && e.key === key), key);
  assert(end?.trusted, 'Standard receipt must close from a native CSS animationend');
  assert.equal(after.progression.confirmedPicks, beforeConfirm.progression.confirmedPicks + 1);
  return {before: beforeConfirm, receipt, after, end};
}
async function nextSpecial(p, due) {
  const current = (await state(p)).elapsed;
  await tick(p, due * 1000 - current * 1000);
  await tick(p, 1201);
  await p.evaluate(() => window.N1Test.parkSpecials());
}
async function geometry(p, selector) {
  await p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.animationName?.startsWith('court-reward-')).map(a=>a.finished.catch(()=>{})));});
  return p.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(), root = node.closest('#modal-scroll') || node.closest('#page-scroll'), clip = root?.getBoundingClientRect();
    return {text: node.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height,
      visible: r.width > 0 && r.height > 0 && r.left >= -.5 && r.right <= innerWidth + .5 && r.top >= -.5 && r.bottom <= innerHeight + .5 && (!clip || r.top >= clip.top - .5 && r.bottom <= clip.bottom + .5)};
  }));
}

(async () => {
 try {
  browser = await chromium.launch({headless: true, channel: process.env.N1_CHROME_CHANNEL || 'chrome'});
  identity.browser = browser.version();
  if(checkScope!=='controlled') {
  const p = await open();
  await check('normal-first-opening-waits-eight-seconds-before-real-session', 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
    await action(p, 'start'); await frame(p, 'N1-OPEN'); const before = await state(p);
    await p.waitForTimeout(8000); const after = await state(p);
    assert.equal((await ui(p)).inProbe, false); assert.equal(after.elapsed, before.elapsed); assert.equal(after.shots, before.shots);
    assert.equal(after.progression?.confirmedPicks || 0, 0);
    assert((await ui(p)).narrative.motion.time >= 7); await frame(p, 'PAGE-06');
    await frame(p, 'PAGE-06'); const live = await state(p); assert(live.elapsed < 1); assert.equal(live.durationSeconds, 600);
    assert.match(live.progression.rulesVersion, /50/); return {before, after, live};
  }, p);
  await check('normal-pause-settings-help-back-stay-paused-until-continue', 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
    await action(p, 'pause'); const before = await state(p);
    for (const child of ['settings', 'help']) { await action(p, child); await action(p, child === 'settings' ? 'close' : 'back'); await frame(p, 'LAYER-02'); assert.equal((await state(p)).elapsed, before.elapsed); }
    await action(p, 'resume'); await frame(p, 'PAGE-06'); await p.waitForTimeout(100); assert((await state(p)).elapsed > before.elapsed);
    await home(p); return {elapsed: before.elapsed};
  }, p);
  await check('normal-replay-does-not-start-run-or-grant-reward', 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
    const before = await state(p), previousRun = (await ui(p)).runLoadout;
    await action(p, 'chapter-replay'); await frame(p, 'N1-OPEN');
    await action(p, 'chapter-skip');
    await frame(p, 'PAGE-02'); const after = await state(p);
    assert.equal((await ui(p)).inProbe, false); assert.deepEqual((await ui(p)).runLoadout, previousRun);
    assert.equal(after.elapsed, before.elapsed); assert.equal(after.progression?.confirmedPicks || 0, before.progression?.confirmedPicks || 0);
    return {before, after};
  }, p);
  for (const [cat, weapon, name] of [['CAT01', 'W01', '小满'], ['CAT02', 'W04', '听雪'], ['CAT03', 'W02', '乌舟']]) {
    await check('normal-three-cat-pair-and-42u-' + cat, 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
      await action(p, 'select'); assert.match(await p.locator('#page-scroll').innerText(), /小满[\s\S]*听雪[\s\S]*乌舟/);
      await action(p, 'choose:' + cat); await action(p, 'confirm-select'); assert.match(await p.locator('#page-scroll').innerText(), new RegExp(name));
      await start(p); const s = await state(p); assert.equal(s.catId, cat); assert.equal(s.weaponId, weapon);
      assert.equal(s.catDisplay.width, 42); assert.equal(s.catDisplay.height, 42); assert.equal(s.progression.confirmedPicks, 0);
      await home(p); return {cat: s.catId, weapon: s.weaponId, display: s.catDisplay};
    }, p);
  }
  await check('normal-twenty-end-and-start-cycles-clear-session', 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
    const runs = []; for (let i = 0; i < 20; i++) { await start(p); const s = await state(p); assert.equal(s.progression.confirmedPicks, 0); assert.equal(s.moveHeld, false); assert(s.elapsed < 1); runs.push(s.progression.runId); await home(p); }
    assert.equal(new Set(runs).size, 20); return {runs, scope: 'Normal explicit end and start; controlled death/restart is covered separately'};
  }, p);
  for (const [width, height] of [[320,568],[360,640],[390,844],[430,932]]) {
    const q = await open(false, {width, height});
    await check('normal-four-size-opening-selection-' + width, 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => {
      await action(q, 'select'); const names = await geometry(q, '.court-select-copy>strong'); assert.equal(names.length, 3); assert(names.every(n => n.visible), JSON.stringify(names));
      await action(q, 'cancel-select'); await action(q, 'start');
      await q.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).narrative.motion?.playing); const buttons = await geometry(q, '.n1-motion button,.n1-movie-controls button'); assert.equal(buttons.length,3); assert(buttons.every(b=>b.visible&&b.width>=44&&b.height>=44),JSON.stringify(buttons)); const panels=[buttons]; await shot(q,'normal-opening-'+width); await action(q,'chapter-skip');
      await frame(q, 'PAGE-06'); await home(q); return {names, panels};
    }, q);
    await q.context().close();
  }
  const skip = await open();
  await check('normal-first-opening-skip-starts-real-run', 'NORMAL_UNMODIFIED_PLAYER_BUNDLE', async () => { await action(skip, 'start'); await action(skip, 'chapter-skip'); await frame(skip, 'PAGE-06'); const s = await state(skip); assert.equal(s.durationSeconds, 600); assert(s.elapsed < 1); return {elapsed: s.elapsed}; }, skip);
  await skip.context().close(); await p.context().close();
  const imageRetry=await open();
  await check('normal-failed-chapter-image-retries-and-releases-on-exit','NORMAL_UNMODIFIED_PLAYER_BUNDLE_CONTROLLED_NETWORK_FAILURE',async()=>{
    await imageRetry.route('**/story/ch01-fish.jpeg',route=>route.abort());await action(imageRetry,'start');
    await imageRetry.locator('button[data-action="chapter-retry"]').waitFor({state:'visible'});assert.equal((await ui(imageRetry)).narrative.images.active,false);
    await imageRetry.unroute('**/story/ch01-fish.jpeg');await action(imageRetry,'chapter-retry');
    await imageRetry.waitForFunction(()=>document.querySelector('.n1-art-slot img')?.naturalWidth>0);assert.equal((await ui(imageRetry)).narrative.images.active,true);
    await action(imageRetry,'chapter-skip');assert.equal((await ui(imageRetry)).narrative.images.active,false);assert.equal((await ui(imageRetry)).narrative.images.path,'');
    return {network:'One explicitly aborted illustration; successful real reload, then release at battle start'};
  },imageRetry);await imageRetry.context().close();
  }
  if(checkScope!=='normal') {
  const c = await open(true); await start(c);
  await check('controlled-receipts-attribute-core-and-repeat-rank', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    const attribute = await choose(c, 'L1_DAMAGE', 'attribute'), core = await choose(c, 'L1_ORBIT_BELL', 'core'), rank2 = await choose(c, 'L1_ORBIT_BELL', 'rank'), rank3 = await choose(c, 'L1_ORBIT_BELL', 'rank');
    assert.match(rank2.receipt.text, /3枚飞铃/); assert.match(rank3.receipt.text, /4枚飞铃/);
    return {attribute, core, rank2, rank3};
  }, c);
  await check('controlled-real-tradeoff-and-evolution-receipts', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    const tradeoff = await choose(c, 'R04', 'tradeoff'); assert.match(tradeoff.receipt.text, /代价|降低|0\.8|20%/);
    await choose(c, 'L1_PIERCE', 'core'); await choose(c, 'L1_DAMAGE', 'attribute');
    const evolution = await choose(c, 'L1_EVO_PIERCE', 'evolution'); assert.equal(evolution.after.progression.ranks.L1_EVO_PIERCE, 1);
    return {tradeoff, evolution};
  }, c);
  await home(c); await start(c);
  await check('controlled-two-offer-queue-never-resumes-between-receipts', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    // Large real XP input makes a queue; selection still uses the normal buttons.
    const before = await c.evaluate(() => window.N1Test.offer('L1_DAMAGE', 100)); await frame(c, 'PAGE-07');
    const picked = [], elapsed = before.state.elapsed;
    for (let i = 0; i < 2; i++) { const s = await state(c), offer = s.progression.offer, card = offer.choices[0], key = s.progression.runId + '.' + offer.id;
      await action(c, 'growth-select:' + key + '.' + card); await action(c, 'growth-confirm:' + key + '.' + card);
      await c.waitForFunction(key => window.N1Test.events.some(e => e.type === 'receipt' && e.key === key), key);
      const frozen = await tick(c, 250); assert.equal(frozen.elapsed, elapsed);
      await c.waitForFunction(key => JSON.parse(document.getElementById('app').dataset.ui).narrative.receipt?.key !== key, key); picked.push({key, card});
      assert.equal((await state(c)).progression.confirmedPicks, i + 1); assert.equal((await ui(c)).frame, 'PAGE-07-S01');
    }
    return {picked, elapsed, pending: (await state(c)).progression.pending};
  }, c);
  await home(c);
  for (const [width,height] of (process.env.N1_SKIP_LAYOUT ? [] : [[320,568],[360,640],[390,844],[430,932]])) {
    const q = await open(true, {width,height}); await start(q);
    await check('controlled-four-size-three-rewards-and-touch-targets-' + width, 'CONTROLLED_NATIVE_MAIN_UI', async () => {
      await q.evaluate(() => window.N1Test.offer('L1_DAMAGE')); await frame(q, 'PAGE-07');
      const names = await geometry(q, '.court-reward-title strong'), benefits = await geometry(q, '.court-reward-benefit');
      assert.equal(names.length,3); assert(names.every(n=>n.visible),JSON.stringify(names)); assert(benefits.every(n=>n.visible),JSON.stringify(benefits));
      const targets = await geometry(q, '.court-reward-choice,.court-reward-detail,#modal-footer button');
      assert(targets.every(n=>n.width>=44&&n.height>=44),JSON.stringify(targets));
      const fonts=await q.locator('.court-reward-benefit').evaluateAll(es=>es.map(e=>Number.parseFloat(getComputedStyle(e).fontSize))); assert(fonts.every(n=>n>=14));
      const s=await state(q), card=s.progression.offer.choices[0]; await action(q,'growth-detail:'+card); assert.equal((await state(q)).progression.confirmedPicks,0);
      await action(q,'close'); assert.equal((await state(q)).progression.confirmedPicks,0); await shot(q,'controlled-rewards-'+width);
      return {names,benefits,targets,fonts};
    },q); await q.context().close();
  }
  for (const [width,height] of (process.env.N1_SKIP_LAYOUT ? [] : [[320,568],[360,640],[390,844],[430,932]])) {
    const q=await open(true,{width,height});await start(q);
    await check('controlled-long-selected-attribute-light-mag-tradeoff-'+width,'CONTROLLED_NATIVE_MAIN_UI',async()=>{
      for(const card of ['L1_ECHO','L1_ORBIT_BELL','L1_DAMAGE','L1_RATE'])await choose(q,card,['L1_DAMAGE','L1_RATE'].includes(card)?'attribute':'core');
      const layouts=[];
      for(const card of ['L1_HEART','L1_LIGHT_MAG','R04']) {
        await q.evaluate(card=>window.N1Test.offer(card),card);await frame(q,'PAGE-07');const s=await state(q),key=s.progression.runId+'.'+s.progression.offer.id;
        await action(q,'growth-select:'+key+'.'+card);
        const names=await geometry(q,'.court-reward-title strong'),benefits=await geometry(q,'.court-reward-benefit');
        assert(names.every(n=>n.visible),JSON.stringify({card,names}));assert(benefits.every(n=>n.visible),JSON.stringify({card,benefits}));
        const costs=await geometry(q,'.court-reward-card.is-selected .court-reward-cost');
        if(card==='L1_LIGHT_MAG'||card==='R04')assert(costs.some(n=>n.visible),JSON.stringify({card,costs}));
        layouts.push({card,names,benefits,costs});await shot(q,'selected-'+width+'-'+card);
        await action(q,'growth-confirm:'+key+'.'+card);await q.waitForFunction(key=>JSON.parse(document.getElementById('app').dataset.ui).narrative.receipt?.key!==key,key);await frame(q,'PAGE-06');
      }
      return layouts;
    },q);await q.context().close();
  }
  await start(c);
  await check('controlled-real-elite-full-hp-zero-and-wounded-healing', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    await nextSpecial(c,150); const defeated1=await c.evaluate(()=>window.N1Test.defeat('EL01'));
    const full=await choose(c,'L1_DAMAGE','elite',0,async offered=>{
      const key=offered.progression.runId+'.'+offered.progression.offer.id;
      await action(c,'growth-select:'+key+'.L1_DAMAGE');
      for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]) {
        await check('controlled-elite-four-size-three-rewards-confirm-'+width,'CONTROLLED_NATIVE_ELITE_SAME_OFFER_VIEWPORT_CHANGE',async()=>{
          await c.setViewportSize({width,height});await c.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,{width,height});
          const s=await state(c);assert.equal(s.progression.runId,offered.progression.runId);assert.equal(s.progression.offer.id,offered.progression.offer.id);assert.equal(s.progression.offer.source,'elite');
          const names=await geometry(c,'.court-reward-title strong'),benefits=await geometry(c,'.court-reward-benefit');
          assert.equal(names.length,3);assert(names.every(n=>n.visible),JSON.stringify({names}));assert(benefits.every(n=>n.visible),JSON.stringify({benefits}));
          const confirm=await geometry(c,'#modal-footer .growth-confirm button');assert.equal(confirm.length,1);assert(confirm[0].visible&&confirm[0].width>=44&&confirm[0].height>=44,JSON.stringify(confirm));
          assert.equal(await c.locator('#modal-footer .growth-confirm button').isEnabled(),true);
          const npc=await c.locator('.n1-elite-line').innerText(),recovery=await c.locator('.court-reward-heading').innerText();assert.match(npc,/听雪/);assert.match(recovery,/20%/);
          await shot(c,'controlled-elite-selected-'+width);return {width,height,key,names,benefits,confirm,npc,recovery};
        },c);
      }
      await c.setViewportSize({width:390,height:844});
    }); assert.match(full.receipt.text,/实际恢复0/); assert.equal(full.after.hp,full.before.hp); assert.equal(full.after.progression.eliteRewards[0].recovered,0);
    await tick(c,16); const damage=await c.evaluate(()=>window.N1Test.damage(40)); assert.equal(damage.hpLost,40);
    await nextSpecial(c,300); const defeated2=await c.evaluate(()=>window.N1Test.defeat('EL01'));
    const healed=await choose(c,'L1_DAMAGE','elite',0); const amount=healed.after.hp-healed.before.hp;
    assert.equal(amount,healed.after.maxHp*.2); assert.match(healed.receipt.text,new RegExp('生命 \\+'+amount));
    assert.equal(healed.after.progression.eliteRewards[1].recovered,amount);
    await action(c,'pause'); await c.locator('.n1-clues summary').click(); const clues=await c.locator('.n1-clues').innerText(); assert.match(clues,/听雪/); assert.match(clues,/乌舟/); await action(c,'resume');
    return {defeated1,full,damage,defeated2,healed,clues};
  },c);
  await check('controlled-native-450-boss-and-600-timeout-no-cleared-ending', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    await nextSpecial(c,450); const boss=await state(c); assert.equal(boss.level.bossAt,450); assert.equal(boss.result,null);
    await tick(c,599999-boss.elapsed*1000); assert.equal((await state(c)).result,null); await tick(c,1.01);
    const s=await state(c); assert.equal(s.elapsed,600); assert.equal(s.result,'timeout'); assert.match((await ui(c)).frame,/PAGE-08/); assert.equal((await ui(c)).narrative.motion,null); assert.doesNotMatch(await c.locator('#page-scroll').innerText(),/本章发现|角色已解锁/);
    return {boss:boss.level,result:s.result,elapsed:s.elapsed};
  },c);
  await action(c,'restart');
  await check('controlled-real-boss-kill-alone-opens-motion-ending', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    for(const due of [150,300,450])await nextSpecial(c,due);
    const damage=await c.evaluate(()=>window.N1Test.defeat('B01')); await tick(c,16); assert.equal((await state(c)).result,'cleared'); await frame(c,'N1-END');
    const frozen=(await state(c)).elapsed; const panels=[];
    await c.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).narrative.motion?.playing); panels.push(await c.locator('.n1-motion').innerText()); assert.equal((await ui(c)).narrative.motion.kind,'ending'); await tick(c,1000); assert.equal((await state(c)).elapsed,frozen); await action(c,'chapter-skip');
    await frame(c,'PAGE-08'); assert.match(await c.locator('#page-scroll').innerText(),/风炉街七号|失去的街/); assert.doesNotMatch(await c.locator('#page-scroll').innerText(),/角色已解锁/);
    return {damage,panels,elapsed:frozen,unlocked:(await ui(c)).unlocked};
  },c);
  await action(c,'restart');
  await check('controlled-twenty-actual-death-restarts-bound-objects-and-clear-ui', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    const counts=[],runs=[];
    for(let i=0;i<20;i++){await c.evaluate(()=>window.N1Test.damage(100000));await tick(c,0);assert.equal((await state(c)).result,'death');assert.equal((await ui(c)).narrative.motion,null);await action(c,'restart');const s=await state(c);assert.equal((await ui(c)).frame,'PAGE-06-S01');assert.equal(s.hp,s.maxHp);assert.equal(s.elapsed,0);assert.equal(s.progression.confirmedPicks,0);assert.equal(s.moveHeld,false);assert.equal(s.progression.offer,null);assert.equal((await ui(c)).narrative.receipt,null);runs.push(s.progression.runId);counts.push(await c.evaluate(()=>window.N1Test.counts()));}
    assert.equal(new Set(runs).size,20);for(const count of counts)assert.deepEqual(count,counts[0]); return {runs,counts};
  },c);
  let oldReceiptKey;
  await check('controlled-receipt-escape-interruption-needs-explicit-continue', 'CONTROLLED_NATIVE_MAIN_UI', async () => {
    await c.evaluate(()=>window.N1Test.offer('L1_ECHO'));const s=await state(c),key=s.progression.runId+'.'+s.progression.offer.id;
    oldReceiptKey=key;
    await action(c,'growth-select:'+key+'.L1_ECHO');await action(c,'growth-confirm:'+key+'.L1_ECHO');await frame(c,'N1-RECEIPT');
    await c.keyboard.press('Escape');await frame(c,'LAYER-02');const paused=await state(c);await c.waitForTimeout(700);await tick(c,5000);assert.equal((await state(c)).elapsed,paused.elapsed);assert.equal((await ui(c)).frame,'LAYER-02-S01');await action(c,'resume');await tick(c,16);assert((await state(c)).elapsed>paused.elapsed);assert.equal((await state(c)).progression.confirmedPicks,1);return {key,paused:paused.elapsed};
  },c);
  await check('controlled-background-receipt-interruption-and-return-never-auto-continue','CONTROLLED_SYNTHETIC_VISIBILITY_EVENT_REAL_MAIN_HANDLER',async()=>{
    await c.evaluate(()=>window.N1Test.offer('L1_ORBIT_BELL'));const s=await state(c),key=s.progression.runId+'.'+s.progression.offer.id;
    await action(c,'growth-select:'+key+'.L1_ORBIT_BELL');await action(c,'growth-confirm:'+key+'.L1_ORBIT_BELL');await frame(c,'N1-RECEIPT');
    await c.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await frame(c,'LAYER-02');
    const paused=await state(c);assert(paused.reasons.includes('background'));await c.waitForTimeout(700);await tick(c,2000);assert.equal((await state(c)).elapsed,paused.elapsed);
    await c.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await tick(c,1000);assert.equal((await state(c)).elapsed,paused.elapsed);assert.equal((await ui(c)).frame,'LAYER-02-S03');
    await action(c,'resume');await tick(c,16);assert((await state(c)).elapsed>paused.elapsed);assert.equal((await state(c)).progression.confirmedPicks,2);await c.evaluate(()=>delete document.hidden);
    return {key,elapsed:paused.elapsed,event:'Synthetic visibilitychange + controlled hidden; real main background handler. NOT an OS visibility result.'};
  },c);
  await home(c);await start(c);
  await check('controlled-old-animationend-cannot-close-new-run-and-live-reduce-finishes-650ms','CONTROLLED_ADVERSARIAL_OLD_EVENT_AND_NATIVE_MEDIA_CHANGE',async()=>{
    await choose(c,'L1_PIERCE','core');await choose(c,'L1_DAMAGE','attribute');await choose(c,'L1_DAMAGE','attribute');
    await c.evaluate(()=>window.N1Test.offer('L1_EVO_PIERCE'));const s=await state(c),key=s.progression.runId+'.'+s.progression.offer.id;assert.notEqual(key.split('.')[0],oldReceiptKey.split('.')[0]);
    await action(c,'growth-select:'+key+'.L1_EVO_PIERCE');await action(c,'growth-confirm:'+key+'.L1_EVO_PIERCE');await frame(c,'N1-RECEIPT');
    await c.evaluate(oldKey=>{const old=document.createElement('div');old.hidden=true;old.dataset.receiptKey=oldKey;document.body.append(old);old.dispatchEvent(new AnimationEvent('animationend',{animationName:'n1-acquire',bubbles:true}));old.remove();},oldReceiptKey);
    assert.equal((await ui(c)).frame,'N1-RECEIPT');assert.equal((await ui(c)).narrative.receipt.key,key);
    await c.emulateMedia({reducedMotion:'reduce'});await c.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).frame==='PAGE-06-S01');
    assert.equal((await state(c)).progression.confirmedPicks,4);assert.equal((await state(c)).progression.ranks.L1_EVO_PIERCE,1);await tick(c,16);assert((await state(c)).elapsed>s.elapsed);await c.emulateMedia({reducedMotion:'no-preference'});
    return {oldReceiptKey,key,durationMs:650,confirmedPicks:(await state(c)).progression.confirmedPicks};
  },c);
  await check('controlled-active-receipt-continue-and-stale-confirm-do-not-double-award','CONTROLLED_ADVERSARIAL_OLD_ACTION_REAL_MAIN_HANDLER',async()=>{
    await c.evaluate(()=>window.N1Test.offer('L1_TRAIL_BELL'));const s=await state(c),key=s.progression.runId+'.'+s.progression.offer.id,confirm='growth-confirm:'+key+'.L1_TRAIL_BELL';
    await action(c,'growth-select:'+key+'.L1_TRAIL_BELL');await action(c,confirm);await frame(c,'N1-RECEIPT');
    await c.evaluate(action=>{const old=document.createElement('button');old.dataset.action=action;document.getElementById('modal-footer').append(old);old.click();old.remove();},confirm);
    assert.equal((await state(c)).progression.confirmedPicks,s.progression.confirmedPicks+1);await action(c,'receipt-skip:'+key);await frame(c,'PAGE-06');
    await c.waitForTimeout(500);assert.equal((await state(c)).progression.confirmedPicks,s.progression.confirmedPicks+1);return {key,confirmedPicks:(await state(c)).progression.confirmedPicks};
  },c);
  await check('controlled-native-animationcancel-finishes-receipt-on-next-frame','CONTROLLED_DOM_ANIMATION_CANCELLATION_REAL_MAIN_HANDLER',async()=>{
    await c.evaluate(()=>window.N1Test.offer('C15'));const s=await state(c),key=s.progression.runId+'.'+s.progression.offer.id;
    await action(c,'growth-select:'+key+'.C15');await action(c,'growth-confirm:'+key+'.C15');await frame(c,'N1-RECEIPT');
    await c.waitForFunction(key=>window.N1Test.events.some(e=>e.type==='animationstart'&&e.key===key&&e.trusted),key);
    await c.locator('.n1-receipt').evaluate(node=>node.style.animation='none');await frame(c,'PAGE-06');
    const canceled=await c.evaluate(key=>window.N1Test.events.find(e=>e.type==='animationcancel'&&e.key===key),key);
    assert(canceled?.trusted);assert.equal((await state(c)).progression.confirmedPicks,s.progression.confirmedPicks+1);await tick(c,16);assert((await state(c)).elapsed>s.elapsed);return {key,canceled};
  },c);
  for(const mode of ['low','reduced']) {
    const q=await open(true,{width:390,height:844},mode==='reduced'?{reducedMotion:'reduce'}:{});await start(q);
    await check('controlled-'+mode+'-receipt-finishes-on-animation-free-path','CONTROLLED_NATIVE_MAIN_UI',async()=>{
      if(mode==='low'){await action(q,'pause');await action(q,'settings');await q.locator('#quality').selectOption('低');await action(q,'close');await action(q,'resume');}
      await q.evaluate(()=>window.N1Test.offer('L1_ORBIT_BELL'));const s=await state(q),key=s.progression.runId+'.'+s.progression.offer.id;
      await action(q,'growth-select:'+key+'.L1_ORBIT_BELL');await action(q,'growth-confirm:'+key+'.L1_ORBIT_BELL');await q.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).frame==='PAGE-06-S01');
      const receipt=await q.evaluate(key=>window.N1Test.events.find(e=>e.type==='receipt'&&e.key===key),key);assert(receipt);assert.equal(receipt.animation,'none');assert.equal((await state(q)).progression.confirmedPicks,1);await tick(q,16);assert((await state(q)).elapsed>s.elapsed);return {mode,key,receipt};
    },q);await q.context().close();
  }
  }
  await check('artifact-identities-stay-unchanged-after-ui-suite','ARTIFACT_IDENTITY',async()=>{assert.equal(sha(path.join(normalDist,'assets/main.js')),identity.normalMainSHA256);assert.equal(sha(path.join(normalDist,'assets/style.css')),identity.normalStyleSHA256);assert.equal(sha(path.join(sceneDir,'assets/n1-runtime.js')),identity.fixture.fixtureSHA256);return identity;});
 } catch(error) { if(!checks.some(check=>check.status==='Fail'))checks.push({name:'suite-environment-or-harness',scope:'HARNESS',status:'Blocked',error:String(error)}); }
 finally {
  for(const [index,{p}] of contextPages.entries())if(!p.isClosed()&&await p.evaluate(()=>!!window.N1Test).catch(()=>false))fs.writeFileSync(path.join(out,'controlled-events-'+index+'.json'),JSON.stringify(await p.evaluate(()=>window.N1Test.events),null,2)+'\n');
  if(browser)await browser.close();
  const status=checks.some(c=>c.status!=='Pass')||pageErrors.length?'FAIL':'PASS';
  const report={status,atUtc:new Date().toISOString(),identity,normalURL,sceneURL,selection:{checkScope,layout:process.env.N1_SKIP_LAYOUT?'DELIBERATELY_SKIPPED':'INCLUDED'},checks,pageErrors,actions:actions.length,uniqueActions:[...new Set(actions)],
    scope:'Normal unmodified UI and separately labelled controlled native-main UI. Controlled XP/damage/time/spawn suppression do not represent natural play, wall-clock endurance, phone, platform or render FPS.',
    notTested:['Platform simulator','Android','iOS','Chrome61','Natural ten-minute endurance','Real OS visibility event; synthetic lifecycle is labelled separately']};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status,out,checks:checks.length,failed:checks.filter(c=>c.status!=='Pass').map(c=>({name:c.name,error:c.error})),pageErrors}));process.exitCode=status==='PASS'?0:1;
 }
})();
