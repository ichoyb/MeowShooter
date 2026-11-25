import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationModel, createReviewModel } from '../src/ui/model';
import { renderPage } from '../src/ui/pages';
import { renderLayer } from '../src/ui/layers';
import { hudMarkup } from '../src/ui/hud';
import data from '../src/ui/content.generated.json';

test('release keeps only the initial cat runnable while playtest explicitly opens all fixed pairs', () => {
  const release = new NavigationModel(), playtest = new NavigationModel(false, true);
  assert.deepEqual(release.unlocked, ['CAT01']);
  assert.equal(release.previewCat('CAT02'), false);
  assert.deepEqual(playtest.unlocked, ['CAT01', 'CAT02', 'CAT03']);
  for (const [cat, weapon] of [['CAT01', 'W01'], ['CAT02', 'W04'], ['CAT03', 'W02']]) {
    assert.equal(playtest.previewCat(cat), true); assert.equal(playtest.confirmSelection(), true);
    assert.equal(playtest.canStartProbe, true);
    const run = playtest.beginRun(); assert.equal(run.catId, cat); assert.equal(run.weaponId, weapon);
    assert.equal(run.rulesVersion, 'p2-basic-v1');
  }
});

test('an unconfirmed preview and cancellation cannot change the committed or actual run', () => {
  const m = new NavigationModel(false, true); const run = m.beginRun();
  m.beginSelection(); m.previewCat('CAT02'); assert.deepEqual(m.committed, { cat: 'CAT01', weapon: 'W01' });
  assert.equal(m.run, run); m.cancelSelection(); assert.deepEqual(m.draft, m.committed);
  assert.equal(m.run?.catId, 'CAT01');
});

test('the copied run survives a later confirmed pair, and home clears that completed run', () => {
  const m = new NavigationModel(false, true); m.beginSelection(); m.previewCat('CAT02'); m.confirmSelection();
  const run = m.beginRun(); m.beginSelection(); m.previewCat('CAT03'); m.confirmSelection();
  assert.equal(m.run, run); assert.equal(m.run?.weaponId, 'W04'); assert.equal(m.run?.maxHp, 100);
  assert.equal(Object.isFrozen(run.weapon), true); m.home(); assert.equal(m.run, null);
  assert.equal(m.beginRun().catId, 'CAT03');
});

test('invalid draft pair is not silently repaired and invalid committed pair cannot start', () => {
  const m = new NavigationModel(false, true); m.draft = { cat: 'CAT02', weapon: 'W01' };
  assert.equal(m.confirmSelection(), false); assert.deepEqual(m.committed, { cat: 'CAT01', weapon: 'W01' });
  m.committed = { cat: 'CAT02', weapon: 'W01' }; assert.equal(m.canStartProbe, false);
  assert.throws(() => m.beginRun()); assert.equal(m.run, null);
  m.committed = { cat: 'UNKNOWN', weapon: 'W03' }; assert.equal(m.canStartProbe, false); assert.throws(() => m.beginRun());
});

test('a release lock cannot be bypassed by assigning a valid pair, and samples do not acquire playtest permission', () => {
  const release = new NavigationModel(); release.committed = { cat: 'CAT02', weapon: 'W04' };
  assert.equal(release.canStartProbe, false); assert.throws(() => release.beginRun());
  const real = new NavigationModel(false, true); real.beginSelection(); real.previewCat('CAT02'); real.confirmSelection();
  const run = real.beginRun(), sample = createReviewModel(real);
  assert.equal(sample.playtestEnabled, false); assert.equal(sample.run, null); assert.equal(sample.canStartProbe, false);
  sample.previewCat('CAT03'); sample.confirmSelection(); assert.equal(real.run, run); assert.equal(real.committed.cat, 'CAT02');
});

test('playtest selection and home continuously disclose temporary three-cat access', () => {
  const m = new NavigationModel(false, true);
  assert.match(renderPage(m, data, null).body, /内部试玩：三猫临时开放，不保存进度/);
  m.openPage('PAGE-03-S01'); const page = renderPage(m, data, null);
  assert.match(page.body, /内部试玩：三猫临时开放，不保存进度/); assert.match(page.body, /data-action="choose:CAT03"/);
});

test('actual result and pause show the copied snow pair rather than the courtyard selection', () => {
  const m = new NavigationModel(false, true); m.previewCat('CAT02'); m.confirmSelection(); const run = m.beginRun();
  m.committed = { cat: 'CAT01', weapon: 'W01' };
  m.openPage('PAGE-06-S01', { actual: true }); m.openLayer('LAYER-02-S01');
  assert.match(renderLayer(m, data).body, /CAT02\.png/);
  m.openPage('PAGE-08-S02', { actual: true });
  const page = renderPage(m, data, { result: 'survived', elapsed: 120, kills: 4, catId: run.catId, weaponId: run.weaponId });
  assert.match(page.body, /雪团 \/ 小鱼干飞镖/); assert.doesNotMatch(page.body, /橘团 \/ 铃铛/);
});

test('actual HUD keeps P2 health and hides automatic-action hints; details retain P2 rules', () => {
  const m = new NavigationModel(false, true); m.previewCat('CAT03'); m.confirmSelection(); const run = m.beginRun();
  const hud = hudMarkup({ hp: 90, maxHp: 120, ammo: 3, ammoCapacity: 4, elapsed: 12, reloadLeft: .8, reloadSeconds: 1.6, targetKind: 'enemy', durationSeconds: 120, catId: 'CAT03', weaponId: 'W02' });
  assert.match(hud, /90 \/ 120/); assert.doesNotMatch(hud, /90 \/ 100/);
  assert.doesNotMatch(hud, /id="(?:ammo-chip|ammo|reload-fill|mode)"|弹药 · 自动装填|自动 · 近敌/);
  m.openLayer('LAYER-03-S01', { contentId: run.catId }); const layer = renderLayer(m, data);
  assert.match(layer.body, /120/); assert.match(layer.body, /162/); assert.match(layer.body, /1\.5/);
  assert.doesNotMatch(layer.body, /专属能力尚未接入|生命100、移速180/);
});
