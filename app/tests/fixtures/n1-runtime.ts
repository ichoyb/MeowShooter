// CONTROLLED QA ENTRY ONLY. The normal player entry never imports this file.
// Main is bundled unchanged. Capture its real Arena before main creates it;
// only this page exposes controlled inputs and native Scene stepping.
import {RunGrowth, type GrowthId} from '../../src/progression';
// Register the normal engine factories before wrapping graphics. Main reuses
// this exact module instance; no second Phaser runtime is created.
import '../../src/phaser-entry.cjs';

declare function require(path: string): any;

const factory = require('phaser/src/gameobjects/GameObjectFactory');
const originalGraphics = factory.prototype.graphics;
let arena: any, now = 0, held = false;
factory.prototype.graphics = function (...args: unknown[]) {
  arena = this.scene;
  factory.prototype.graphics = originalGraphics;
  return originalGraphics.apply(this, args);
};
const app = () => document.getElementById('app')!;
const state = () => JSON.parse(app().dataset.state || '{}');
const ui = () => JSON.parse(app().dataset.ui || '{}');
const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const events: unknown[] = [];
let lastReceipt = '';
const recordReceipt = () => {
  const node = document.querySelector<HTMLElement>('.n1-receipt');
  if (!node || node.dataset.receiptKey === lastReceipt) return;
  lastReceipt = node.dataset.receiptKey!;
  const style = getComputedStyle(node);
  events.push({type: 'receipt', key: lastReceipt, card: node.dataset.receiptCard,
    className: node.className, text: node.innerText, at: performance.now(),
    animation: style.animationName, duration: style.animationDuration, state: state(), ui: ui()});
};
new MutationObserver(recordReceipt).observe(document.body, {childList: true, subtree: true});
for (const type of ['animationstart', 'animationend', 'animationcancel']) {
  document.addEventListener(type, event => {
    const animation = event as AnimationEvent, target = animation.target as HTMLElement;
    if (animation.animationName !== 'n1-acquire') return;
    events.push({type, key: target.dataset.receiptKey, trusted: event.isTrusted,
      at: performance.now(), elapsed: animation.elapsedTime, state: state()});
  }, true);
}

function hold() {
  if (!arena || app().dataset.ready !== 'true') throw Error('Real main is not ready');
  if (!held) {
    now = arena.game.loop.now;
    arena.game.loop.sleep();
    arena.game.loop.wake = () => {};
    held = true;
  }
  arena.game.scene.processQueue();
  return state();
}
function tick(ms: number) {
  hold();
  if (!Number.isFinite(ms) || ms < 0) throw Error('Invalid native Scene delta');
  now += ms;
  arena.game.scene.processQueue();
  arena.game.scene.update(now, ms);
  arena.game.scene.processQueue();
  return state();
}

// Search deterministic draws against a disposable copy, then feed exactly that
// draw stream and XP into the real RunGrowth. No offer/rank/config is fabricated.
function offer(card: GrowthId, amount?: number) {
  hold();
  const growth = arena.growth;
  if (!growth || growth.snapshot().offer) throw Error('Expected an unoffered real run');
  const xp = amount ?? growth.snapshot().nextXP;
  let chosen = 0;
  for (let seed = 1; seed <= 20000; seed++) {
    const candidate: any = Object.assign(new RunGrowth(growth.runId, rng(seed), growth.base), growth, {
      random: rng(seed), ranks: {...growth.ranks}, recentDeclined: growth.recentDeclined.map((r: unknown[]) => r.slice()),
      evolutionViews: {...growth.evolutionViews}, eliteQueue: growth.eliteQueue.map((e: unknown) => ({...(e as object)})),
      eliteSeen: new Set(growth.eliteSeen), eliteBirths: new Set(growth.eliteBirths),
      eliteRewards: growth.eliteRewards.map((e: unknown) => ({...(e as object)})),
    });
    candidate.collect(xp);
    if (candidate.snapshot().offer?.choices.includes(card)) { chosen = seed; break; }
  }
  if (!chosen) throw Error(`No legal deterministic offer for ${card}`);
  growth.random = rng(chosen);
  growth.collect(xp);
  const result = tick(16);
  return {scope: 'CONTROLLED_XP_REAL_OFFER_TRANSACTION', seed: chosen, xp, state: result};
}
function special(enemyId: 'EL01' | 'B01') {
  return arena.enemies.getChildren().find((enemy: any) => enemy.active && enemy.getData('enemyId') === enemyId);
}
const api = {
  scope: 'CONTROLLED_NATIVE_MAIN_UI_NOT_NATURAL_GAME_OR_WALL_CLOCK',
  get ready() { return !!arena && app().dataset.ready === 'true'; },
  get arena() { return arena; },
  events, state, ui, hold, tick, offer,
  isolate() {
    hold();
    // Keep special spawns, native arrival timers, Arcade entities, damage,
    // reward confirmation and all main DOM/navigation behavior unchanged.
    arena.spawnCourtyardEnemy = () => false;
    arena.fireVolley = () => {};
    return {ordinarySpawns: 'SUPPRESSED', playerVolley: 'SUPPRESSED'};
  },
  damage(amount: number) { hold(); const fact = arena.incomingEnemyDamage(amount); tick(0); return fact; },
  parkSpecials() {
    hold();
    for (const enemy of arena.enemies.getChildren()) if (enemy.active) {
      enemy.body.moves = false; enemy.body.reset(650, 180);
    }
    return state();
  },
  defeat(enemyId: 'EL01' | 'B01') {
    hold();
    const enemy = special(enemyId);
    if (!enemy || !enemy.body.enable) throw Error(`No arrived native ${enemyId}`);
    const hp = enemy.getData('hp'), birthId = enemy.getData('id'), encounterId = enemy.getData('encounterId');
    const actual = arena.abilityHit(enemy, hp, 'N1_CONTROLLED_TEST');
    return {scope: 'CONTROLLED_NATIVE_ABILITY_HIT', enemyId, hp, actual, birthId, encounterId};
  },
  counts() {
    hold();
    return {children: arena.children.length, enemies: arena.enemies.getLength(),
      projectiles: arena.projectiles.getLength(), enemyProjectiles: arena.enemyProjectiles.getLength(),
      timers: arena.time._active.length + arena.time._pendingInsertion.length};
  },
};
Object.assign(window, {N1Test: api});
document.documentElement.dataset.n1TestScope = api.scope;
// Dynamic import is intentionally after capture setup. esbuild keeps one main
// module with the same production imports; this is not a rewritten main source.
void import('../../src/main');
