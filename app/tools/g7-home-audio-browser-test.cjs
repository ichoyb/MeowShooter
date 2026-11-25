'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const app = path.resolve(__dirname, '..');
const dist = path.resolve(process.env.G7_DIST || path.join(app, 'dist-playtest-0.4.2'));
const output = path.resolve(process.env.G7_HOME_CHECK_DIR || path.join(app, '../.local/checks/g7-home-audio'));
const port = Number(process.env.G7_HOME_PORT || 8972);
const checks = [], errors = [];
const button = (page, action) => page.locator('button[data-action="' + action + '"]:visible').last();
const click = (page, action) => button(page, action).click();
const audio = page => page.evaluate(() => JSON.parse(document.getElementById('app').dataset.audio));
const ui = page => page.evaluate(() => JSON.parse(document.getElementById('app').dataset.ui));
const played = page => page.waitForFunction(() => {
  const state = JSON.parse(document.getElementById('app').dataset.audio);
  return state.ready && state.location === 'battle' && state.musicPlaying;
});
const record = (name, value) => { checks.push({name, value}); console.log('PASS ' + name); };
const sha = name => createHash('sha256').update(readFileSync(path.join(dist, name))).digest('hex');

async function boot(browser, options, init) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:' + port);
  await page.waitForFunction(() => document.getElementById('app').dataset.ready === 'true');
  const state = await audio(page);
  assert.equal(state.contextState, 'not-created');
  assert.equal(state.musicPlaying, false);
  assert.equal(state.settings.music, true);
  assert.equal(state.settings.effects, true);
  return {context, page};
}

async function main() {
  mkdirSync(output, {recursive:true});
  const server = spawn(process.execPath, [path.join(app, 'tools/serve.mjs')], {
    cwd:app, env:{...process.env, APP_DIST:dist, PORT:String(port)}, stdio:['ignore','pipe','pipe'], windowsHide:true,
  });
  let browser, failure;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('error', reject);
      server.once('exit', code => reject(Error('serve exit ' + code)));
    });
    browser = await chromium.launch({channel:'chrome', headless:true, args:['--autoplay-policy=user-gesture-required']});
    for (const [input, viewport] of [['click',{width:390,height:844}],['touch',{width:320,height:568}],['keyboard',{width:430,height:932}]]) {
      const {context,page} = await boot(browser, {viewport, hasTouch:input==='touch', deviceScaleFactor:2});
      const start = button(page, 'start');
      if (input==='touch') await start.tap();
      else if (input==='keyboard') await start.press('Enter');
      else await start.click();
      await played(page);
      await page.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio).played.slingshot > 0);
      const s = await audio(page);
      record(input + ' direct start', {context:s.contextState, track:s.currentTrack, weaponSound:s.played.slingshot});
      if (input==='click') {
        await click(page,'pause');
        assert.equal((await audio(page)).musicPlaying,false);
        await click(page,'resume');
        await played(page);
        record('audible pause and resume', {track:(await audio(page)).currentTrack});
      }
      await context.close();
    }

    for (const [width,height] of [[320,568],[360,640],[390,844],[430,932]]) {
      const {context,page} = await boot(browser, {viewport:{width,height}, hasTouch:true, deviceScaleFactor:2});
      const selector = button(page, 'select');
      assert.match(await selector.innerText(), /橘团[\s\S]*铃铛弹射器[\s\S]*换猫/);
      assert.equal(await button(page,'detail:W01').count(),0);
      for (const target of [selector,button(page,'start')]) {
        const rect = await target.boundingBox();
        assert(rect.width>=44 && rect.height>=44);
        assert(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=width+1 && rect.y+rect.height<=height+1);
        assert(await target.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===node||node.contains(hit);}));
      }
      assert(await page.locator('#page-scroll').evaluate(node => node.scrollHeight <= node.clientHeight + 1));
      await page.screenshot({path:path.join(output,'home-'+width+'x'+height+'.png')});
      await selector.tap({position:{x:18,y:22}});
      await page.waitForFunction(() => {const s=JSON.parse(document.getElementById('app').dataset.audio);return s.ready && s.location==='silent' && !s.musicPlaying;});
      await click(page,'choose:CAT02');
      assert.deepEqual((await ui(page)).committed,{cat:'CAT01',weapon:'W01'});
      assert.match(await button(page,'choose:CAT01').innerText(),/当前出战/);
      assert.match(await button(page,'choose:CAT02').innerText(),/已选/);
      const weapon = button(page,'detail:W04');
      await weapon.scrollIntoViewIfNeeded();
      await weapon.tap();
      assert.match(await page.locator('#modal-scroll').innerText(),/小鱼干飞镖/);
      await click(page,'close');
      assert.deepEqual((await ui(page)).draft,{cat:'CAT02',weapon:'W04'});
      await page.screenshot({path:path.join(output,'select-'+width+'x'+height+'.png')});
      await click(page,'confirm-select');
      await page.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio).musicPlaying);
      assert.match(await selector.innerText(), /雪团[\s\S]*小鱼干飞镖[\s\S]*换猫/);
      assert.equal((await ui(page)).inProbe,false);
      record('selector and layout '+width+'x'+height,{choice:'CAT02',weaponDetail:'W04'});
      await context.close();
    }

    const keyboard = await boot(browser,{viewport:{width:390,height:844}});
    const keyPage=keyboard.page;
    await button(keyPage,'select').focus();
    await keyPage.keyboard.press('Enter');
    assert.equal(await keyPage.evaluate(()=>document.activeElement.dataset.action),'choose:CAT01');
    await keyPage.keyboard.press('Tab');
    await keyPage.keyboard.press('Enter');
    assert.equal(await keyPage.evaluate(()=>document.activeElement.dataset.action),'choose:CAT02');
    await button(keyPage,'detail:W04').focus();
    await keyPage.keyboard.press('Enter');
    await keyPage.keyboard.press('Escape');
    assert.equal(await keyPage.evaluate(()=>document.activeElement.dataset.action),'detail:W04');
    await button(keyPage,'cancel-select').focus();
    await keyPage.keyboard.press('Enter');
    assert.equal(await keyPage.evaluate(()=>document.activeElement.dataset.action),'select');
    assert.deepEqual((await ui(keyPage)).draft,{cat:'CAT01',weapon:'W01'});
    assert.deepEqual((await ui(keyPage)).committed,{cat:'CAT01',weapon:'W01'});
    record('keyboard focus through select, weapon details and cancel');
    await keyboard.context.close();

    const {context,page} = await boot(browser, {viewport:{width:390,height:844}});
    await click(page,'sound-toggle:music');
    await page.waitForFunction(() => {const s=JSON.parse(document.getElementById('app').dataset.audio);return s.ready && !s.settings.music && !s.musicPlaying;});
    await click(page,'start');
    await page.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio).played.slingshot > 0);
    assert.equal((await audio(page)).musicPlaying,false);
    await click(page,'pause');
    assert.equal((await audio(page)).effectsPlaying,0);
    await click(page,'settings');
    await click(page,'sound-toggle:effects');
    await click(page,'close');
    await click(page,'resume');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await button(page,'resume').waitFor();
    assert.equal((await audio(page)).musicPlaying,false);
    assert.equal((await audio(page)).effectsPlaying,0);
    await click(page,'resume');
    await click(page,'pause');
    await click(page,'end');
    await click(page,'confirm-end');
    await click(page,'select');
    await click(page,'choose:CAT03');
    await click(page,'confirm-select');
    await click(page,'start');
    await page.waitForFunction(() => {const s=JSON.parse(document.getElementById('app').dataset.audio);return s.ready && s.location==='battle' && s.weapon==='W02';});
    const s = await audio(page);
    assert.equal(s.settings.music,false);
    assert.equal(s.settings.effects,false);
    assert.equal(s.musicPlaying,false);
    assert.equal(s.effectsPlaying,0);
    record('mute, pause, simulated blur, return, change cat and restart', {settings:s.settings, weapon:s.weapon});
    await context.close();

    const failedUnlock = await boot(browser, {viewport:{width:390,height:844}}, () => {
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = function () {
        AudioContext.prototype.resume = resume;
        return Promise.reject(new Error('QA: first resume failed'));
      };
    });
    await click(failedUnlock.page,'settings');
    await failedUnlock.page.getByText(/声音暂不可用.*QA: first resume failed/).waitFor();
    await click(failedUnlock.page,'sound-enable');
    await failedUnlock.page.waitForFunction(() => {
      const state = JSON.parse(document.getElementById('app').dataset.audio);
      return state.ready && !state.error && state.location==='silent' && !state.musicPlaying;
    });
    await click(failedUnlock.page,'close');
    await failedUnlock.page.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio).musicPlaying);
    record('first unlock failure, settings retry and return', {track:(await audio(failedUnlock.page)).currentTrack});
    await failedUnlock.context.close();

    const delayedUnlock = await boot(browser,{viewport:{width:390,height:844}},() => {
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = function () {
        const native = resume.call(this);
        return new Promise(resolve => {window.releaseAudio = () => resolve(native);});
      };
    });
    const delayedPage = delayedUnlock.page;
    await click(delayedPage,'settings');
    await delayedPage.waitForFunction(() => typeof window.releaseAudio === 'function');
    await delayedPage.locator('#musicVolume').focus();
    await delayedPage.evaluate(() => {window.originalSlider = document.activeElement;window.releaseAudio();});
    await delayedPage.waitForFunction(() => JSON.parse(document.getElementById('app').dataset.audio).ready);
    assert(await delayedPage.evaluate(() => document.activeElement === window.originalSlider && window.originalSlider.isConnected));
    await delayedPage.keyboard.press('ArrowLeft');
    assert.equal((await audio(delayedPage)).settings.musicVolume,.64);
    record('delayed first unlock preserves the focused volume slider');
    await delayedUnlock.context.close();
    assert.deepEqual(errors, []);
  } catch (error) {
    failure = String(error);
    console.error(error);
    process.exitCode = 1;
  } finally {
    writeFileSync(path.join(output,'report.json'),JSON.stringify({
      status:failure?'FAIL':'PASS', environment:'Local Chrome, CSP harness; simulated window blur',
      browser:browser?.version(), mainSHA256:sha('assets/main.js'), cssSHA256:sha('assets/style.css'),
      checks, errors, failure,
    },null,2)+'\n');
    await browser?.close();
    server.kill();
  }
}

void main();
