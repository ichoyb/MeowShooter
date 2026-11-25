// Isolated approved-v05 round-body adaptation. Normal src never imports this entry.
import {createTraitFixture} from './projectile-traits-sample';
import {PresenceCatPresentation, registerPresenceTextures} from './player-presence-presentation';
import {courtyardBalanceRunConfig} from '../../src/level-config';
import {Session} from '../../src/rules';
import {growthCard} from '../../src/progression';
import type {BattleSnapshot} from '../../src/battle';

const w = window as any;
const strideCapeReview=true;
const candidateLabel='圆胖小满',baselineLabel='当前小满';
const $ = (id: string) => document.getElementById(id)!;
const image = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(Error(src)); im.src = src;
});
const wait = async (predicate: () => boolean) => {
  const end = performance.now() + 10000;
  while (!predicate()) {if (performance.now() > end) throw Error('场景准备超时'); await new Promise<void>(r => requestAnimationFrame(() => r()));}
};

async function boot() {
  let ready = false, busy = false, modern = true, size: 36 | 42 | 48 = strideCapeReview?42:36;
  let quality: 'standard' | 'low' = 'standard', offerKey = '';
  const originalAdvance = Session.prototype.advance;
  let draw = (_s?: BattleSnapshot) => {};
  const f = await createTraitFixture($('stage'), s => draw(s), true);
  // createTraitFixture captures a Session by a temporary prototype hook. Restore
  // that hook between starts and on disposal; never leave a global patch active.
  const captureAdvance = Session.prototype.advance;
  Session.prototype.advance = originalAdvance;
  const {a, battle} = f;
  const runConfig = courtyardBalanceRunConfig(f.config('CAT01'));
  const baseline = a.g6Art.cat;
  registerPresenceTextures(a, {
    body: await image('./assets/round-cat/body.png'),
    weapon: a.textures.get('g6-cat01-weapon').getSourceImage(),
    grip: await image('./assets/round-cat/grip.png'),
    head: await image('./assets/round-cat/head.png'),
  });
  const candidate = new PresenceCatPresentation(a, runConfig.moveSpeed);
  const resizeBaseline = () => {
    baseline.displaySize = size;
    const [body, weapon, grip, head] = baseline.objects();
    body.setDisplaySize(size, size); head.setDisplaySize(size, size);
    weapon.setDisplaySize(size / 2, size / 2); grip.setDisplaySize(size / 4, size / 4);
    baseline.placeParts();
  };
  const applyDisplay = () => {
    resizeBaseline(); candidate.setDisplaySize(size);
    baseline.setVisible(!modern); candidate.setVisible(modern);
    $('mode').textContent = modern ? candidateLabel : baselineLabel;
    $('mode').setAttribute('aria-pressed', String(modern));
    $('display').textContent = `${size}u 显示 · 12u 接触`;
  };
  const baseReset = baseline.reset.bind(baseline), baseSync = baseline.sync.bind(baseline);
  const baseFire = baseline.fire.bind(baseline), basePause = baseline.pause.bind(baseline);
  baseline.reset = (enabled = true) => {baseReset(enabled, size); candidate.reset(enabled, size); applyDisplay();};
  baseline.sync = (...args: Parameters<PresenceCatPresentation['sync']>) => {baseSync(...args); candidate.sync(...args);};
  baseline.fire = () => {baseFire(); candidate.fire();};
  baseline.pause = (paused: boolean) => {basePause(paused); candidate.pause(paused);};
  // Existing real damage flash follows the selected visual, using its native
  // four objects. It never reads or modifies a physics body.
  a.playerImpactParts = () => modern ? candidate.objects() : baseline.objects();
  const setSize = (value: 36 | 42 | 48) => {
    if (![36, 42, 48].includes(value)) throw RangeError('Unsupported display size');
    size = value; resizeBaseline();
    candidate.setDisplaySize(size); applyModeVisibility(); draw();
    ($('size') as HTMLSelectElement).value = String(size);
  };
  const applyModeVisibility = () => {
    baseline.setVisible(!modern); candidate.setVisible(modern);
    $('mode').textContent = modern ? candidateLabel : baselineLabel;
    $('mode').setAttribute('aria-pressed', String(modern));
    $('display').textContent = `${size}u 显示 · 12u 接触`;
  };
  const setMode = (value: boolean) => {
    a.clearImpact(); modern = value;
    // Prepare the selected side before any future actual hit, using the
    // existing shared native flash cache. Hit processing never builds Canvas.
    a.impact?.prepare(a.playerImpactParts());
    applyModeVisibility(); draw();
  };
  const magnifier = a.cameras.add(0, 0, 1, 1, false, 'presence-close-up').setBackgroundColor('#edf1df');
  magnifier.inputEnabled = false; magnifier.ignore(a.stick);
  const magnify = () => {
    const showing = ($('zoom') as HTMLInputElement).checked;
    magnifier.setVisible(showing); if (!showing) return;
    const density = a.scale.gameSize.width / $('stage').clientWidth;
    // At 48u the close-up must still contain both feet; the narrow historical
    // 36u review window crops the largest comparison size.
    const desired = (size + 8) * 3 * battle.cssPixelsPerLogicalUnit;
    const edge = Math.min(desired, $('stage').clientWidth * .7, $('stage').clientHeight * .85) * density;
    magnifier.setViewport(10 * density, a.scale.gameSize.height - edge - 10 * density, edge, edge)
      .setOrigin(.5, .5).setZoom(3 * a.cameras.main.zoomX).centerOn(a.cat.body.center.x, a.cat.body.center.y);
  };
  const snapshot = () => {
    const body = a.cat.body, bounds = a.physics.world.bounds;
    return {ready, modern, size, quality, battle: battle.snapshot(), baseline: baseline.snapshot(), candidate: candidate.snapshot(),
      physical: {radius: body.halfWidth, center: {x: body.center.x, y: body.center.y}, width: body.width, height: body.height,
        spriteDisplay: {width: a.cat.displayWidth, height: a.cat.displayHeight},
        bounds: {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height},
        customBounds: body.customBoundsRectangle ? {x: body.customBoundsRectangle.x, y: body.customBoundsRectangle.y, width: body.customBoundsRectangle.width, height: body.customBoundsRectangle.height} : null},
      objects: {candidate: candidate.objects().length, scene: a.children.list.length, textures: a.textures.getTextureKeys().length,
        animations: Object.keys(a.anims.anims.entries).length, nativeTweens: a.tweens.getTweens().length},
      prototypeRestored: Session.prototype.advance === originalAdvance};
  };
  const updateOffer = (s: BattleSnapshot) => {
    const progression = s.progression, offer = progression?.offer;
    const next = offer ? `${progression!.runId}:${offer.id}` : '';
    if (next === offerKey) return;
    offerKey = next; const panel = $('upgrade'); panel.replaceChildren(); panel.hidden = !offer;
    if (!offer || !progression) return;
    const title = document.createElement('p'); title.textContent = '实际升级：选择本局成长'; panel.append(title);
    for (const id of offer.choices) {
      const button = document.createElement('button'); button.textContent = growthCard(id)!.name;
      button.addEventListener('click', () => battle.confirmUpgrade(progression.runId, offer.id, id)); panel.append(button);
    }
  };
  draw = (state?: BattleSnapshot) => {
    if (!ready) return;
    const s = state ?? battle.snapshot();
    $('health').textContent = `生命 ${Math.ceil(s.hp)}/${s.maxHp}`;
    $('ammo').textContent = `弹匣 ${s.ammo}/${s.weaponStats.ammoCapacity}`;
    $('time').textContent = `${s.elapsed.toFixed(1)} 秒`;
    $('pause').textContent = s.engine.paused ? '继续' : '暂停';
    $('status').textContent = s.result ? '本局结束，重开继续比较。' : s.engine.paused ? (s.progression?.offer ? '实际升级已暂停战斗，请选择成长。' : '已暂停。') : '拖动／WASD走位，遇敌自动射击。';
    updateOffer(s);
  };
  const start = async () => {
    if (busy) return; busy = true; ready = false;
    try {
      const previous = f.session;
      Session.prototype.advance = captureAdvance;
      battle.setPresentation({quality}); battle.start(runConfig);
      await wait(() => !!f.session && f.session !== previous);
      ready = true; f.layout(); setSize(size); magnify(); draw();
    } finally {Session.prototype.advance = originalAdvance; busy = false;}
  };
  const pause = () => battle.pause('menu'), resume = () => battle.resume();
  $('start').addEventListener('click', () => void start());
  $('pause').addEventListener('click', () => battle.snapshot().engine.paused ? resume() : pause());
  $('mode').addEventListener('click', () => setMode(!modern));
  $('size').addEventListener('change', () => setSize(Number(($('size') as HTMLSelectElement).value) as 36 | 42 | 48));
  $('quality').addEventListener('change', () => {
    quality = ($('quality') as HTMLSelectElement).value as typeof quality;
    battle.setPresentation({quality}); f.layout(); magnify();
  });
  $('zoom').addEventListener('change', magnify);
  $('sound').addEventListener('click', () => void battle.audio?.enable().then(() => {$('sound').textContent = '声音已开启';}));
  const post = () => {if (ready) {draw(); magnify();}};
  a.events.on('postupdate', post);
  window.addEventListener('resize', () => {f.layout(); magnify();});
  window.addEventListener('blur', () => {if (ready) battle.pause('inputLost');});
  document.addEventListener('visibilitychange', () => {if (document.hidden && ready) battle.pause('background');});
  const onPageHide = (event: PageTransitionEvent) => {
    Session.prototype.advance = originalAdvance;
    if (event.persisted) {battle.pause('background'); return;}
    a.events.off('postupdate', post); candidate.destroy();
    window.removeEventListener('pagehide', onPageHide);
  };
  // A cached document keeps its Scene and input bindings. Leave it paused on
  // pageshow; only the existing explicit Continue action resumes the battle.
  window.addEventListener('pagehide', onPageHide);
  w.presence = {f, candidate, baseline, snapshot, start, setSize, setMode, pause, resume};
  await start();
  for (const element of Array.from(document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('button,select,input'))) element.disabled = false;
  w.presenceReady = true;
}
void boot().catch(error => {w.presenceError = String(error); $('status').textContent = '加载失败：' + String(error);});
