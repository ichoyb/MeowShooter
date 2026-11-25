import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationModel, fixedLoadout, createReviewModel } from '../src/ui/model';
import { fixedWeaponId, makeRunConfig } from '../src/combat-config';

test('preview cat cancellation discards the entire fixed pair', () => {
  const m = new NavigationModel(); m.unlocked = ['CAT01','CAT02'];
  m.beginSelection(); assert.equal(m.previewCat('CAT02'),true);
  assert.deepEqual(m.draft,{cat:'CAT02',weapon:'W04'});
  m.cancelSelection(); assert.deepEqual(m.committed,{cat:'CAT01',weapon:'W01'});
});
test('confirmation is atomic and locked cats cannot become a draft', () => {
  const m = new NavigationModel(); m.beginSelection();
  assert.equal(m.previewCat('CAT03'),false);
  assert.deepEqual(m.draft,{cat:'CAT01',weapon:'W01'});
  m.unlocked.push('CAT03'); assert.equal(m.previewCat('CAT03'),true);
  assert.equal(m.confirmSelection(),true); assert.deepEqual(m.committed,{cat:'CAT03',weapon:'W02'});
});
test('closing nested details restores parent and its scroll position', () => {
  const m = new NavigationModel(); m.openPage('PAGE-04-S01',{category:'升级'});
  m.current.scroll=340; m.openLayer('LAYER-03-S02',{contentId:'BALL_04'});
  m.current.scroll=112; m.openLayer('LAYER-03-S02',{contentId:'BALL_02'});
  m.closeLayer(); assert.equal(m.current.context.contentId,'BALL_04'); assert.equal(m.current.scroll,112);
  m.closeLayer(); assert.equal(m.current.frame,'PAGE-04-S01'); assert.equal(m.current.scroll,340);
});
test('normal page back restores category and scroll', () => {
  const m = new NavigationModel(); m.openPage('PAGE-04-S01',{category:'协同'});
  m.current.scroll=90; m.openPage('PAGE-05-S01'); m.back();
  assert.equal(m.current.context.category,'协同'); assert.equal(m.current.scroll,90);
});
test('only CAT01 is runnable in this stage and every fixed pair is stable', () => {
  const m = new NavigationModel(); assert.equal(m.canStartProbe,true);
  assert.deepEqual(fixedLoadout('CAT02'),{cat:'CAT02',weapon:'W04'});
  assert.throws(()=>fixedLoadout('W03'));
  m.unlocked.push('CAT02'); m.beginSelection(); m.previewCat('CAT02'); m.confirmSelection();
  assert.equal(m.canStartProbe,false);
});
test('reset navigation preserves session selection and settings', () => {
  const m = new NavigationModel(); m.settings.quality='低'; m.unlocked.push('CAT02');
  m.beginSelection();m.previewCat('CAT02');m.confirmSelection();
  m.openLayer('LAYER-01-S01');m.home();
  assert.equal(m.layers.length,0);assert.equal(m.settings.quality,'低');assert.equal(m.committed.cat,'CAT02');
});
test('review fixtures cannot change the real loadout, locks, draft or settings', () => {
  const real = new NavigationModel(); real.settings.quality='低';
  const review=createReviewModel(real);
  review.unlocked.push('CAT02'); review.beginSelection(); review.previewCat('CAT02'); review.confirmSelection();
  review.settings.quality='标准';
  assert.deepEqual(real.unlocked,['CAT01']);
  assert.deepEqual(real.committed,{cat:'CAT01',weapon:'W01'});
  assert.deepEqual(real.draft,{cat:'CAT01',weapon:'W01'});
  assert.equal(real.settings.quality,'低');
});

test('navigation fixed pairs agree with the combat configuration source', () => {
  for(const cat of ['CAT01','CAT02','CAT03']){
    const loadout=fixedLoadout(cat), weapon=fixedWeaponId(cat);
    assert.deepEqual(loadout,{cat,weapon});
    const run=makeRunConfig(loadout.cat,loadout.weapon,'p2-basic');
    assert.equal(run.catId,loadout.cat); assert.equal(run.weaponId,loadout.weapon);
    loadout.weapon='W03'; assert.equal(fixedLoadout(cat).weapon,weapon);
  }
});
