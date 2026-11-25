// Separate controlled page. This entry never runs in the player bundle.
import {createBattle} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import {courtyardBalanceRunConfig, ENEMY_BUBBLE, normalCourtyardRunConfig} from '../../src/level-config';
import {dropExperience, growthCards, NORMAL_GROWTH_RULES_VERSION, RunGrowth, type GrowthId} from '../../src/progression';

declare function require(path: string): any;

function portrait(id: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error(`Missing portrait: ${id}`));
    image.src = `./assets/ui/${id}.png`;
  });
}

async function runG6NormalTimeline() {
  const checks: {name: string; pass: boolean; detail: unknown}[] = [];
  const check = (name: string, pass: boolean, detail: unknown) => {
    checks.push({name, pass, detail});
    if (!pass) throw Error(name);
  };
  let battle: Awaited<ReturnType<typeof createBattle>> | undefined;
  try {
    const [CAT01, CAT02, CAT03] = await Promise.all(['CAT01', 'CAT02', 'CAT03'].map(portrait));
    const factory = require('phaser/src/gameobjects/GameObjectFactory');
    const graphics = factory.prototype.graphics;
    let arena: any;
    factory.prototype.graphics = function (...args: unknown[]) {
      arena = this.scene;
      return graphics.apply(this, args);
    };
    try {
      battle = await createBattle(document.getElementById('stage')!, {onState() {}, onFinish() {}, onInterrupt() {}},
        {CAT01, CAT02, CAT03}, undefined, true);
    } finally {
      factory.prototype.graphics = graphics;
    }

    const {game} = arena;
    const wake = game.loop.wake;
    let now = 0;
    const tick = (ms: number) => {
      now += ms;
      game.scene.update(now, ms);
      game.scene.processQueue();
    };
    const snapshot = battle.snapshot;
    const config = normalCourtyardRunConfig(makeRunConfig('CAT01', 'W01', 'p2-basic'));
    const withoutWake = <T>(operation: () => T): T => {
      game.loop.wake = () => {};
      try {
        return operation();
      } finally {
        game.loop.wake = wake;
        game.loop.sleep();
        game.scene.processQueue();
      }
    };
    const start = () => withoutWake(() => battle!.start(config));
    const park = (actor: any) => {
      actor.body.moves = false;
      actor.body.reset(650, 180);
    };
    const hurt = (damage: number) => {
      arena.enemyBubble(snapshot().player, {x:0, y:0}, {...ENEMY_BUBBLE, speed:0, damage});
      tick(16);
    };
    const chooseFirst = (card: GrowthId) => {
      const before = snapshot();
      const nextXP = before.progression!.nextXP;
      const draws = Array.from({length:100}, (_, i) => i / 100);
      const draw = draws.find(value => {
        const candidate = new RunGrowth(1, () => value, config);
        candidate.collect(nextXP);
        return candidate.snapshot().offer?.choices.includes(card);
      });
      if (draw === undefined) throw Error(`No deterministic opening offer for ${card}`);
      arena.growth.random = () => draw;
      for (let xp = 0; xp < nextXP; xp += dropExperience('E01')) {
        arena.pickups.drop(1000 + xp, 'E01', before.player);
      }
      tick(16);
      const offered = snapshot();
      const offer = offered.progression!.offer!;
      const confirmed = withoutWake(() => battle!.confirmUpgrade(offered.progression!.runId, offer.id, card));
      const after = snapshot();
      check(`${card} is offered by real XP pickups and confirmed once`, offered.pickups!.collectedXP >= nextXP &&
        offer.choices.includes(card) && confirmed && after.progression!.ranks[card] === 1 &&
        !battle!.confirmUpgrade(offered.progression!.runId, offer.id, card), {offer, draw, card});
      return after;
    };

    // Preserve real special spawning, Scene Clock, Arcade and terminal rules.
    // Suppress ordinary waves and player fire to isolate effective-time boundaries.
    arena.spawnCourtyardEnemy = () => false;
    arena.fireVolley = () => {};
    start();
    const opening = snapshot();
    const poolSize = growthCards(config).length;
    check('G6 attached to a real normal 50-pool 600s session', opening.durationSeconds === 600 &&
      opening.progression?.rulesVersion === NORMAL_GROWTH_RULES_VERSION && poolSize === 50 && !!opening.g6Art?.cat.active,
      {duration: opening.durationSeconds, pool: opening.progression?.rulesVersion, poolSize, art: opening.g6Art});

    let elapsedMs = 0;
    for (const [index, due] of [150, 300, 450].entries()) {
      tick(due * 1000 - elapsedMs - 1);
      const before = snapshot().level!.encounters[index];
      check(`${before.encounterId} absent just before ${due}s`, before.spawnedAt === null, before);
      tick(1);
      const at = snapshot().level!.encounters[index];
      const actor = arena.enemies.getChildren().find((enemy: any) => enemy.active && enemy.getData('encounterId') === at.encounterId);
      check(`${at.encounterId} has a native birth at ${due}s`, Math.abs((at.spawnedAt ?? -1) - due) < 1e-8 &&
        !!actor && actor.getData('id') === at.birthId && actor.getData('behavior').phase === 'arriving', at);
      tick(1201);
      check(`${at.encounterId} arrival Timer enables its Arcade body`, !!actor.body.enable, snapshot().level);
      park(actor);
      elapsedMs = due * 1000 + 1201;
    }

    tick(599999 - elapsedMs);
    const before = snapshot();
    check('all three encounters remain at 599.999s without a result', !before.result && before.enemies === 3, before.level);
    tick(1.001);
    const result = snapshot();
    check('600s reaches real timeout and retires G6 effects', result.elapsed === 600 && result.result === 'timeout' &&
      result.g6Art?.rewards.activeEffects === 0 && result.g6Art?.flight.activeTrails === 0 &&
      result.g6Art?.bells.activeEffects === 0, {elapsed: result.elapsed, result: result.result, art: result.g6Art});

    start();
    hurt(20);
    const wounded = snapshot();
    const healed = chooseFirst('L1_HEART');
    const amount = healed.hp - wounded.hp;
    check('confirmed HEART restores 15 actual HP and queues the same display amount', wounded.hp === opening.hp - 20 &&
      amount === 15 && healed.maxHp === wounded.maxHp + 15 && healed.g6Art?.rewards.pendingHealing === amount,
      {before: wounded.hp, after: healed.hp, art: healed.g6Art?.rewards});
    tick(251);
    const shown = snapshot().g6Art!.rewards;
    check('native Clock emits one exact heal batch', shown.healBatches === 1 && shown.displayedHealing === amount &&
      shown.pendingTimers === 0 && shown.activeEffects > 0, shown);
    withoutWake(() => battle!.pause('menu'));
    check('pause clears visible heal effects', snapshot().g6Art!.rewards.activeEffects === 0, snapshot().g6Art!.rewards);
    withoutWake(() => battle!.resume());
    tick(1000);
    check('resume does not replay the cleared heal', snapshot().g6Art!.rewards.healBatches === 1 &&
      snapshot().g6Art!.rewards.activeEffects === 0, snapshot().g6Art!.rewards);

    start();
    const shielded = chooseFirst('C13');
    tick(16);
    check('real shield purchase displays a full shield with no HP heal', shielded.hp === opening.hp &&
      shielded.defense.shield === opening.maxHp * .2 && snapshot().g6Art?.rewards.shieldVisible === true &&
      snapshot().g6Art?.rewards.healBatches === 0, {rules: shielded.defense, art: snapshot().g6Art?.rewards});
    hurt(4);
    const absorbed = snapshot();
    check('Arcade bubble absorbs exactly 4 shield and does not show a break', absorbed.defense.lastHit?.shieldAbsorbed === 4 &&
      absorbed.hp === shielded.hp && absorbed.g6Art?.rewards.shieldValue === absorbed.defense.shield &&
      absorbed.g6Art?.rewards.shieldBreaks === 0, {rules: absorbed.defense, art: absorbed.g6Art?.rewards});
    tick(700);
    hurt(absorbed.defense.shield);
    const broken = snapshot();
    check('second native hit breaks shield once and produces four shards', broken.defense.lastHit?.shieldBroke === true &&
      broken.hp === shielded.hp && broken.g6Art?.rewards.shieldBreaks === 1 &&
      broken.g6Art?.rewards.activeEffects === 4 && !broken.g6Art?.rewards.shieldVisible,
      {rules: broken.defense, art: broken.g6Art?.rewards});

    start();
    const clearedShieldArt = snapshot().g6Art!.rewards;
    check('restart from active shield shards clears all reward state', clearedShieldArt.shieldBreaks === 0 &&
      clearedShieldArt.activeEffects === 0 && clearedShieldArt.pendingTimers === 0 && !clearedShieldArt.shieldVisible,
      clearedShieldArt);
    const pulse = chooseFirst('C15');
    const target = arena.placeSliceEnemy('E01', pulse.player.x + 36, pulse.player.y);
    target.body.moves = false;
    const hp = target.getData('hp');
    tick(2999);
    check('pulse is absent before its native timer fires', snapshot().areaAbilities?.casts === 0 &&
      snapshot().g6Art?.areas.played.pulse === 0, snapshot().areaAbilities);
    tick(2);
    const cast = snapshot();
    const fact = cast.areaAbilities?.lastPulse;
    const visual = cast.g6Art?.areas;
    check('real pulse damages its Arcade target and emits one matching visual', fact?.actualDamage !== undefined &&
      fact.actualDamage > 0 && Math.abs((hp - target.getData('hp')) - fact.actualDamage) < 1e-8 &&
      visual?.played.pulse === 1 && visual.last?.x === fact.x && visual.last.y === fact.y && visual.last.radius === fact.radius &&
      visual.shortEffects === 1, {fact, visual});
    withoutWake(() => battle!.pause('menu'));
    check('pause hides pulse while freezing the existing cast count', snapshot().areaAbilities?.casts === 1 &&
      snapshot().g6Art?.areas.shortEffects === 0, snapshot().g6Art?.areas);
    withoutWake(() => battle!.resume());
    tick(500);
    check('resume does not replay pulse', snapshot().g6Art?.areas.played.pulse === 1 &&
      snapshot().g6Art?.areas.shortEffects === 0, snapshot().g6Art?.areas);

    start();
    const interrupted = chooseFirst('C15');
    // Stop between the native cast and Scene postupdate, when a same-frame pause
    // can interrupt before the presentation sees the just-settled cast.
    arena.time.preUpdate();
    now += 3001;
    arena.time.update(now, 3001);
    arena.areas.update(interrupted.progression!.ranks);
    const beforeInterrupt = snapshot();
    check('real cast settles before the paused frame can draw it', beforeInterrupt.areaAbilities?.casts === 1 &&
      beforeInterrupt.g6Art?.areas.played.pulse === 0, {fact: beforeInterrupt.areaAbilities?.lastPulse, art: beforeInterrupt.g6Art?.areas});
    withoutWake(() => battle!.pause('menu'));
    withoutWake(() => battle!.resume());
    tick(16);
    const afterInterrupt = snapshot();
    check('resume does not draw the cast interrupted before postupdate', afterInterrupt.areaAbilities?.casts === 1 &&
      afterInterrupt.g6Art?.areas.played.pulse === 0 && afterInterrupt.g6Art?.areas.shortEffects === 0,
      {fact: afterInterrupt.areaAbilities?.lastPulse, art: afterInterrupt.g6Art?.areas});

    const counts = () => {
      const art = snapshot().g6Art!;
      return [art.cat.visualObjects, art.held.visualObjects, art.rewards.objects, art.bells.objects,
        art.areas.objects, art.flight.objects, arena.children.length];
    };
    start();
    const allocations = counts();
    let prior = snapshot().progression!.runId;
    for (let i = 0; i < 20; i++) {
      start();
      const current = snapshot();
      check(`restart ${i + 1} clears state and retains bounded Scene objects`, current.progression!.runId !== prior &&
        current.elapsed === 0 && current.enemies === 0 && current.progression!.confirmedPicks === 0 &&
        !current.moveHeld && current.g6Art?.rewards.pendingTimers === 0 && current.g6Art?.rewards.activeEffects === 0 &&
        current.g6Art?.cat.walkFrames === 0 && current.g6Art?.areas.played.pulse === 0 &&
        counts().every((count, index) => count === allocations[index]), {run: current.progression!.runId, counts: counts()});
      prior = current.progression!.runId;
    }
    // Identical scene hits and deterministic rolls. The controlled caller
    // supplies contacts; the player build still resolves paths through Arcade.
    const g7Orange = courtyardBalanceRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
    withoutWake(() => battle!.start(g7Orange));
    arena.projectileRandom.frac = () => .9;
    arena.fire({id:1,x:1,y:0,primaryMultiplier:g7Orange.openingPower!.multiplier});
    const boosted = arena.projectiles.getChildren().find((shot:any)=>shot.active);
    check('G7 empowered primary reaches native Scene projectile damage',
      Math.abs(boosted.getData('damage')-21.6)<1e-8 && boosted.getData('source')==='PRIMARY',
      {damage:boosted.getData('damage'),source:boosted.getData('source')});
    const g7Ink = courtyardBalanceRunConfig(makeRunConfig('CAT03','W02','p2-basic'));
    const compareSpirit = (enabled:boolean, enemyId:'E01'|'B01', pellets:number) => {
      const {spiritMark,...baseline}=g7Ink;
      withoutWake(() => battle!.start(enabled?g7Ink:baseline));
      arena.projectileRandom.frac = () => .9;
      const {player}=snapshot(),enemy=arena.placeSliceEnemy(enemyId,player.x+60,player.y);
      const health=()=>enemy.getData('hp');
      const base=health();
      const hit = (source:'SUMMON'|'PRIMARY'|'SECONDARY', damage:number, effect?:'SENTRY') => {
        const id=arena.nextProjectile;
        if(!arena.projectile(player,0,'spirit-shot',source,id,damage,0,600,1,effect))throw Error('No projectile slot');
        const shot=arena.projectiles.getChildren().find((p:any)=>p.active&&p.getData('projectileId')===id);
        arena.hit(shot,enemy,'overlap');
      };
      hit('SUMMON',g7Ink.spirit.damage);
      arena.syncG6(false);
      const shown=snapshot().g6Art!.rewards.spiritMarkVisible;
      hit('SUMMON',2,'SENTRY');
      hit('SECONDARY',1);
      const stillMarked=snapshot().spiritMark?.targetId!=null;
      for(let i=0;i<pellets;i++)hit('PRIMARY',g7Ink.weapon.damage);
      arena.syncG6(false);
      const end=snapshot();
      const {hits,actualDamage,lastHit}=end.companionDiagnostics.spirit;
      return {lost:base-health(),shown,stillMarked,mark:end.spiritMark,
        visible:end.g6Art!.rewards.spiritMarkVisible,partner:actualDamage,hits,lastProjectile:lastHit?.projectileId};
    };
    for (const [enemyId,pellets] of [['E01',1],['B01',5]] as const) {
      const off=compareSpirit(false,enemyId,pellets),on=compareSpirit(true,enemyId,pellets);
      check(`G7 ${enemyId}: one detonation over ${pellets} primary hits, with no sentry or secondary trigger`,
        on.shown && on.stillMarked && !on.visible && on.mark?.targetId===null && on.mark.applied===1 &&
        on.mark.detonated===1 && on.mark.damage===9 && on.lost-off.lost===9 && on.partner-off.partner===9 &&
        on.hits===1 && off.hits===1 && on.lastProjectile===off.lastProjectile && (on.lastProjectile??0)>0,{off,on});
    }
    withoutWake(() => battle!.start(g7Ink));
    check('G7 restart clears star mark, flash and attribution',snapshot().spiritMark?.applied===0 &&
      snapshot().spiritMark?.targetId===null && !snapshot().g6Art?.rewards.spiritMarkVisible &&
      snapshot().g6Art?.rewards.activeEffects===0,snapshot().spiritMark);
    return {status: 'PASS', scope: 'CONTROLLED_NATIVE_SCENE_TIME_NOT_WALL_CLOCK_OR_RENDER_FPS', checks};
  } catch (error) {
    return {status: 'FAIL', error: String(error), checks};
  } finally {
    battle?.dispose();
  }
}

Object.assign(window, {runG6NormalTimeline});
