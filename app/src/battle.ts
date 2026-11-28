import type {DevtoolsController} from '../devtools/model';
// Code guarded by __DEVTOOLS__ serves the local developer tools only; official builds compile it out.
declare const __DEVTOOLS__:boolean;
import type PhaserType from 'phaser';
import Runtime from './phaser-entry.cjs';
import Hits from './battle-hits.cjs';
import { atlas } from './atlas';
import {HuntMark,emptyHuntMark,type HuntMarkSnapshot} from './hunt-mark';
import {RunGrowth,WeaponBursts,BellModifiers,GROWTH_NUMBERS as N,type GrowthSnapshot} from './progression';
import type {BellVolley} from './bell-modifiers';
import type {BurstEffect,RhythmIntent} from './weapon-bursts';
import {BellAbilities} from './bell-abilities';
import {abilityDamage} from './bell-ability-rules';
import {SentinelAbilities} from './sentinel-abilities';
import {companionFrequency} from './sentinel-rules';
import {AreaAbilities} from './area-abilities';
import {areaMultiplier,pickupMagnetRadius,nativeSpiritDamage,abilityGeometry} from './area-ability-rules';
import {growthNumbers,NORMAL_GROWTH_RULES_VERSION} from './progression-content';
import {SUSTAIN_NUMBERS} from './sustain-rules';
import {SessionOnboarding,type OnboardingKind} from './onboarding';
import {SessionPlaytestSummaries,type PlaytestSummary,type DamageSource} from './playtest-summary';
import {projectileCapacityForGrowth} from './progression-capacity';
import {projectileTraitStats,rollProjectileTraits} from './projectile-traits';
import {ExperiencePickups} from './experience-pickups';
import sliceAtlas from './courtyard-atlas.json';
import enemyParts from './courtyard-parts.json';
import {BOSS_SCATTER,COMBAT_SLICE,COURTYARD_LEVEL,courtyardRunConfig,ENEMIES,ENEMY_BUBBLE,SliceSpawns,ArrivalReinforcements,inOpeningSpawnWindow,spawnStageAt,type EnemyId,type SpecialId} from './level-config';
import {CourtyardLevel} from './level-rules';
import {bossIsEnraged,bossScatterRounds,newEnemyState,stepEnemy,stepFlanker,stepFlower,stepSpecial,type EnemyState} from './enemy-behavior';
import {BossProjectileSlots} from './boss-projectiles';
import {EnemyPresentation} from './enemy-presentation';
import {BossEffects,BOSS_DUST_FRAME} from './boss-effects';
import {ImageBudget} from './image-budget';
import {runtimeImagePath} from './runtime-image-path.cjs';
import budgetLimits from '../asset-budget.json';
import { CombatCadence, Session, chooseTarget } from './rules';
import { BATTLE_MIN_FPS, makeRunConfig, assertProjectileTraitsProfile, assertProjectileFlightProfile, assertHuntTargetingProfile, assertAreaAbilitiesProfile, assertDefenseCompanionsProfile, assertSustainRewardsProfile, assertRewardContractsProfile, assertMovementContractsProfile, type CatId, type RunConfig } from './combat-config';
import { CatPassives, newChillState, applyChill, stepChill, chillSnapshot, chillTarget, type ChillState } from './cat-passives';
import type { FiredVolley, Point, PauseReason, Target } from './rules';
import { BattleInput, WORLD_WIDTH } from './battle-geometry';
import type { BattleBounds, TouchArea } from './battle-geometry';
import { bindCanvasTouchCompatibility } from './platform/touch-compatibility';
import type { TouchInputObservation } from './platform/touch-compatibility';
import {observeWindowInput,type BattleInputObservation} from './platform/input-observation';
import { RenderFrames } from './render-frames';
import { Cat01Presentation } from './cat01-presentation';
import courtyardCat01Frames from './r1-art/cat01-courtyard-frames.json';
import { HeldHeroPresentation } from './held-hero-presentation';
import type {G6Art} from './g6-battle-art';
import type {G6FlightRhythmPresentation} from './g6-flight-rhythm-presentation';
import type {ImpactPresentation} from './impact-presentation';
import { BattleFeedback } from './battle-feedback';
import { BattleScenery } from './battle-scenery';
import { CourtyardScenery } from './courtyard-scenery';
import { COURTYARD, chooseCourtyardSpawn, inputBufferPoint } from './arena-layout';
import type {AudioSession,AudioFact} from './audio/session';
import type {ChapterTimeline} from './chapter-timeline';
declare const __BUILD_PROFILE__: 'release' | 'review' | 'playtest';
declare const __COURTYARD_ENABLED__: boolean;
declare const __COMBAT_SLICE_ENABLED__: boolean;
declare const __TEST_INPUT_DIAGNOSTICS__: boolean;
declare function require(path:string):any;

export type { PauseReason } from './rules';
export type { BattleBounds } from './battle-geometry';
const Phaser = Runtime as typeof PhaserType;
// The normal esbuild configuration owns this flag for every runtime entry.
const courtyardPilot = __COURTYARD_ENABLED__;
const sliceContent = courtyardPilot && typeof __COMBAT_SLICE_ENABLED__!=='undefined' && __COMBAT_SLICE_ENABLED__;
const r1Module=__COURTYARD_ENABLED__?require('./r1-art') as typeof import('./r1-art'):null;
const g6Module=__BUILD_PROFILE__==='playtest'
  ? require('./g6-battle-art') as typeof import('./g6-battle-art') : null;
const impactModule=__BUILD_PROFILE__==='playtest'
  ? require('./impact-presentation') as typeof import('./impact-presentation') : null;
type Sprite = PhaserType.Physics.Arcade.Sprite;
type Group = PhaserType.Physics.Arcade.Group;
type G6ArtSnapshot = {[K in keyof G6Art]:ReturnType<G6Art[K]['snapshot']>};
type Body = PhaserType.Physics.Arcade.Body;
type GroupSnapshot = { active: number; enabled: number; total: number };
type BodySnapshot = { circle: boolean; radius: number; width: number; height: number; center: Point; visual: Point };
type SessionSnapshot = ReturnType<Session['snapshot']>;
type CompanionSourceDiagnostics={
  emitted:number;hits:number;actualDamage:number;
  lastShot:{at:number;projectileId:number;deploymentId:number|null;origin:Point;angle:number;damage:number}|null;
  lastHit:{at:number;targetId:number;projectileId:number;damage:number;actualDamage:number}|null;
};
const companionDiagnosticSnapshot=(value:CompanionSourceDiagnostics):CompanionSourceDiagnostics=>({...value,
  lastShot:value.lastShot?{...value.lastShot,origin:{...value.lastShot.origin}}:null,lastHit:value.lastHit?{...value.lastHit}:null});
type FirstEncounter={id:number;enemyId:'E01';bornAt:number;birth:Point;side:'left'|'right';fullVisibleAt:number|null;fullVisibleBounds:{x:number;y:number;width:number;height:number}|null;firstPrimaryShotAt:number|null;firstSpiritShotAt:number|null;firstHitAt:number|null;defeatedAt:number|null;eligible:boolean;artBounds:{x:number;y:number;width:number;height:number}|null};
export type BattleSnapshot = SessionSnapshot & {
  g6Art?:G6ArtSnapshot;
  summary:PlaytestSummary|null;previousSummary:PlaytestSummary|null;
  onboarding:ReturnType<SessionOnboarding['snapshot']>;firstEncounter:FirstEncounter|null;
  projectileTraits:ReturnType<typeof projectileTraitStats>&{rolls:number;criticalRolls:number;criticalHits:number;
    active:{id:number;source:string;effect:BurstEffect|null;damage:number;critical:boolean;criticalMultiplier:number;nonCriticalDamage:number;hitCount:number}[]};
  rhythm:{counter:number;triggers:number;pending:number;emitted:number};
  projectileDiagnostics:{capacity:number;failedSpawns:number};
  projectileFlight:{enabled:boolean;returns:number;returnHits:number;outbound:number;returning:number};
  areaAbilities:ReturnType<AreaAbilities['snapshot']>|null;
  sentry:ReturnType<SentinelAbilities['snapshot']>|null;
  companionDiagnostics:{spirit:CompanionSourceDiagnostics;sentry:CompanionSourceDiagnostics};
  spiritMark?:{targetId:number|null;applied:number;detonated:number;damage:number};
  defenseVisual:{objects:number;visible:boolean;flashing:boolean};
  abilitySources:Record<string,{hits:number;damage:number}>;
  bellAbilities:ReturnType<BellAbilities['snapshot']>|null;spawnPressure:ReturnType<SliceSpawns['snapshot']>;
  bellModifiers:ReturnType<BellModifiers['snapshot']>;reinforcements:ReturnType<ArrivalReinforcements['snapshot']>;
  huntingMark:HuntMarkSnapshot;
  reloadIndicator:{visible:boolean;progress:number;x:number;y:number;width:number;height:number};
  progression:GrowthSnapshot|null; pickups:ReturnType<ExperiencePickups['snapshot']>|null;
  weaponStats:RunConfig['weapon'];moveSpeed:number;bursts:ReturnType<WeaponBursts['snapshot']>;
  imageBudget: ReturnType<ImageBudget['snapshot']>;
  contentId:string; contactCalibration:{radius:number;confirmed:boolean};
  enemyBehaviors:{id:number;enemyId:EnemyId;phase:string;until:number;hp:number;entering:boolean}[];
  enemyProjectiles:{id:number;x:number;y:number;vx:number;vy:number;origin:Point;source:'B01'|'E04';lifeMode:'timed'|'world-boundary'}[];
  level:ReturnType<CourtyardLevel['snapshot']>|null;
  boss:{id:number;hp:number;maxHp:number;enraged:boolean;phase:string}|null;
  bossEffects:ReturnType<BossEffects['snapshot']>|null;
  encounter:string|null;weaponInterval:number;
  presentation: ReturnType<Cat01Presentation['snapshot']> | null;
  heldPresentation: ReturnType<HeldHeroPresentation['snapshot']> | null;
  feedback: ReturnType<BattleFeedback['snapshot']> | null;
  impact: ReturnType<ImpactPresentation['snapshot']> | null;
  scenery: ReturnType<BattleScenery['snapshot']> | ReturnType<CourtyardScenery['snapshot']> | null;
  reloadSeconds: number; durationSeconds: number; catTexture: string; catDisplay: {width:number;height:number};
  mode: 'auto'; locked: number | null; targetKind: 'enemy' | 'object' | null; player: Point;
  enemies: number; kills: number; objectsHit: number; projectiles: number;
  passiveState: ReturnType<CatPassives['snapshot']>; sourceCounts: { PRIMARY: number; SECONDARY: number; SUMMON: number }; companions: number;
  enemyStatuses: ({ id: number } & ReturnType<typeof chillSnapshot>)[];
  moveHeld: boolean; moveOwner: number | null; moveStick: { x: number; y: number; dx: number; dy: number } | null; textureFrames: string[];
  targets: { id: number; x: number; y: number; kind: 'enemy' | 'object' }[];
  frame: string | number | null; renderer: 'Phaser Canvas';
  engine: {
    physics: 'Arcade'; velocity: Point;
    bodies: { cat: BodySnapshot; enemies: BodySnapshot[]; objects: BodySnapshot[]; projectiles: BodySnapshot[] };
    groups: { enemies: GroupSnapshot; objects: GroupSnapshot; projectiles: GroupSnapshot; enemyProjectiles:GroupSnapshot };
    colliders: number; timers: number; overlapHits: number; sweepHits: number; stickVisible: boolean; paused: boolean;
    world: { width: number; height: number }; buffer: { width: number; height: number; rgbaBytes: number };
    css: { width: number; height: number }; dpr: number; density: number; quality: 'standard' | 'low'; cssPixelsPerLogicalUnit: number;
    camera: { width: number; height: number; zoomX: number; zoomY: number; scrollX: number; scrollY: number; view: {x:number;y:number;width:number;height:number} }; renderFrames: ReturnType<RenderFrames['snapshot']>;
    arenaMode: 'single-screen' | 'courtyard-preview';
    scale: { gameWidth: number; gameHeight: number; baseSize: { width: number; height: number }; displaySize: { width: number; height: number }; displayScale: Point }; bounds: BattleBounds;
  };
};
export type BattleCallbacks = {
  onState: (snapshot: BattleSnapshot) => void;
  onInterrupt: (reason: PauseReason) => void;
  onFinish: (snapshot: BattleSnapshot) => void;
  onTouchInput?: (record: TouchInputObservation) => void;
  onBattleInput?: (record: BattleInputObservation) => void;
  onResize?: () => void;
};
export type BattleController = {
  readonly audio: AudioSession | null;
  readonly chapterTimeline: ChapterTimeline | null;
  devtools?:DevtoolsController;
  start(runConfig?: RunConfig): void; pause(reason: PauseReason): void; resume(): void; reset(): void;
  snapshot(): BattleSnapshot;
  dismissOnboarding():void;skipOnboarding():void;
  confirmUpgrade(runId:number,offerId:number,cardId:string,holdForFeedback?:boolean):boolean;
  setPresentation(value: { quality: 'standard' | 'low'; cat01Art?: boolean; f1Art?: boolean }): void;
  setBounds(bounds: BattleBounds): void;
  setInputArea(area: TouchArea, cssPixelsPerLogicalUnit: number, exclusions: TouchArea[]): void;
  pageToWorld(pageX: number, pageY: number): Point;
  pageToInput(pageX: number, pageY: number): Point;
  readonly cssPixelsPerLogicalUnit: number;
  dispose(): void;
};
const bodyOf = (sprite: Sprite): Body => sprite.body as Body;
const centerOf = (sprite: Sprite): Point => ({ x: bodyOf(sprite).center.x, y: bodyOf(sprite).center.y });
const active = (sprite: Sprite): boolean => sprite.active && bodyOf(sprite).enable;
const bodySnapshot = (sprite: Sprite): BodySnapshot => {
  const body = bodyOf(sprite);
  return { circle: body.isCircle, radius: body.halfWidth, width: body.width, height: body.height, center: centerOf(sprite), visual: { x: sprite.x, y: sprite.y } };
};
function circleBody(sprite: Sprite, radius: number): void {
  const body = bodyOf(sprite); body.updateFromGameObject();
  // Pinned Phaser 3.90 floors world halfWidth. A one-world-pixel circle
  // has halfWidth=0, so Arcade treats a projectile as its exact center point.
  // For other circles, avoid floating scaling rounding below the integer radius.
  const sourceRadius = (radius === 0 ? .5 : radius * (1 + Number.EPSILON)) / Math.abs(sprite.scaleX);
  body.setCircle(sourceRadius);
  body.setOffset(sprite.width / 2 - body.halfWidth / Math.abs(sprite.scaleX), sprite.height / 2 - body.halfHeight / Math.abs(sprite.scaleY));
  body.updateFromGameObject();
}
function resetBody(sprite: Sprite, x: number, y: number): void {
  const body = bodyOf(sprite); body.reset(x, y);
  // Body.reset uses the visual top-left in 3.90; resync the circle offset
  // before reading its center or retaining its initial path position.
  body.updateFromGameObject(); body.prev.copy(body.position); body.prevFrame.copy(body.position);
}
const children = (group: Group): Sprite[] => group.getChildren() as Sprite[];
const groupSnapshot = (group: Group): GroupSnapshot => ({ active: group.countActive(true), enabled: children(group).filter(sprite => bodyOf(sprite).enable).length, total: group.getLength() });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      window.clearTimeout(timeout); image.onload = null; image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    const timeout = window.setTimeout(() => finish(new Error('包内战斗图片加载超时。')), 8000);
    image.onload = () => finish(); image.onerror = () => finish(new Error('包内战斗图片加载失败。')); image.src = runtimeImagePath(src);
  });
}

export async function createBattle(stage: HTMLElement, callbacks: BattleCallbacks, catImages: Readonly<Record<CatId, HTMLImageElement>>, imageBudget = new ImageBudget(budgetLimits.sourceRGBALimits[__BUILD_PROFILE__]), enableG6 = false): Promise<BattleController> {
  const g6=sliceContent&&enableG6?g6Module:null;
  const paths=Array.from(new Set(courtyardPilot?[...r1Module!.r1BattlePaths,...(g6?.g6BattlePaths??[])]:['./assets/cat.png','./assets/atlas.png',...(__BUILD_PROFILE__==='playtest'?
    ['body-0.png','body-1.png','weapon.png','grip.png','head.png'].map(name=>'./assets/cat01-pilot/'+name)
      .concat(['bell-hit.png','ground.png'].map(name=>'./assets/battle-feedback/'+name)):[]),
    ...(sliceContent?['parts.png','bubble.png','b01-dust.png'].map(name=>'./assets/first-combat/'+name):[])]));
  // Settle every load before registration, including late failed-batch images.
  // Promise.allSettled is unavailable on the Chrome61 runtime baseline.
  const decoded=await Promise.all(paths.map(src=>loadImage(src).then(image=>({image,error:null}),error=>({image:null,error}))));
  const ownedImages: HTMLImageElement[]=[];
  try {
    for(const id of ['CAT01','CAT02','CAT03'] as const)imageBudget.register('ui/'+id+'.png',catImages[id]);
    for(let i=0;i<decoded.length;i++){
      const result=decoded[i];if(result.error||!result.image)throw result.error||new Error('图片未解码');
      imageBudget.register(paths[i],result.image);ownedImages.push(result.image);
    }
    imageBudget.assertHeadroom();
  }catch(error){for(const image of ownedImages)imageBudget.release(image);throw error;}
  const sources=new Map(paths.map((path,i)=>[path,ownedImages[i]]));
  const [catImage,atlasImage]=ownedImages;
  const pilotImages=__BUILD_PROFILE__==='playtest'&&!courtyardPilot?ownedImages.slice(2,7):null;
  const f1Images=courtyardPilot?[sources.get('./assets/battle-feedback/bell-hit.png')!,sources.get('./assets/battle-feedback/ground.png')!]:__BUILD_PROFILE__==='playtest'?ownedImages.slice(7,9):null;
  let cat01Art = true, f1Art = true;
  let bounds: BattleBounds = { top: 80, bottom: 385 };
  let inputArea: TouchArea = { left: 0, right: WORLD_WIDTH, top: bounds.top, bottom: 500 };
  let inputExclusions: TouchArea[] = [], cssScale = 1;
  let runSequence=0;
  let session = new Session(), running = false, disposed = false, finished = false;
  let quality: 'standard' | 'low' = 'standard', worldHeight = 500, cssWidth = 360, cssHeight = 500, dpr = 1, density = 1;
  let syncingPresentation = false;
  const renderFrames = new RenderFrames();
  let game: PhaserType.Game | null = null;
  let audio:AudioSession|null=null;
  const impactMotion=impactModule?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const sound=(fact:AudioFact)=>{if(!session.runConfig.rulesVersion.startsWith('diagnostic-v1'))audio?.consume(fact);};
  let resolveReady: (controller: BattleController) => void, rejectReady: (reason: Error) => void;
  const ready = new Promise<BattleController>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const onboarding=new SessionOnboarding();
  const summaries=new SessionPlaytestSummaries();
  const snapshot = (): BattleSnapshot => {
    if(running){const g=arena.growth?.snapshot();summaries.observe({elapsed:session.elapsed,travel:arena.onboardingTravel,collectedXP:arena.pickups?.snapshot().collectedXP??0,level:g?.level??1,confirmedPicks:g?.confirmedPicks??0,eliteRewards:g?.eliteRewards.length??0,bossEncountered:arena.level?.snapshot(session.elapsed).bossAt!==null&&arena.level?.snapshot(session.elapsed).bossAt!==undefined,result:session.result});}
    const clock = arena.time as PhaserType.Time.Clock & { _active: PhaserType.Time.TimerEvent[]; _pendingInsertion: PhaserType.Time.TimerEvent[]; _pendingRemoval: PhaserType.Time.TimerEvent[] };
    const timers = new Set([...clock._active, ...clock._pendingInsertion].filter(timer => !clock._pendingRemoval.includes(timer)));
    return {
      ...(arena.activeG6?{g6Art:arena.g6Snapshot()}:{}),
      summary:summaries.current(),previousSummary:summaries.previous(),
      onboarding:onboarding.snapshot(),firstEncounter:arena.firstEncounter?{...arena.firstEncounter,birth:{...arena.firstEncounter.birth},artBounds:arena.firstEncounter.artBounds?{...arena.firstEncounter.artBounds}:null,fullVisibleBounds:arena.firstEncounter.fullVisibleBounds?{...arena.firstEncounter.fullVisibleBounds}:null}:null,
      projectileTraits:{...projectileTraitStats(session.runConfig,arena.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0}),
        rolls:arena.projectileRolls,criticalRolls:arena.criticalRolls,criticalHits:arena.criticalHits,
        active:children(arena.projectiles).filter(active).map(shot=>({id:shot.getData('projectileId'),source:shot.getData('source'),effect:shot.getData('effect')??null,damage:shot.getData('damage'),
          critical:shot.getData('critical')===true,criticalMultiplier:shot.getData('criticalMultiplier'),nonCriticalDamage:shot.getData('nonCriticalDamage'),hitCount:shot.getData('hitCount')}))},
      projectileDiagnostics:{capacity:arena.projectiles.maxSize,failedSpawns:arena.failedProjectileSpawns},
      projectileFlight:{enabled:!!session.runConfig.projectileFlight?.enabled,returns:arena.flightReturns,returnHits:arena.flightReturnHits,
        outbound:children(arena.projectiles).filter(s=>active(s)&&s.getData('flightPhase')==='outbound').length,
        returning:children(arena.projectiles).filter(s=>active(s)&&s.getData('flightPhase')==='return').length},
      huntingMark:arena.hunt?.snapshot()??emptyHuntMark(),
      rhythm:{counter:arena.bursts.snapshot().rhythmCounter,triggers:arena.bursts.snapshot().rhythmTriggers,pending:arena.rhythmTimers.size,emitted:arena.rhythmEmitted},
      progression:arena.growth?{...arena.growth.snapshot(),...(session.runConfig.defenseCompanions?.enabled?{defense:session.defenseSnapshot(),sentry:arena.sentries?.snapshot()}:{}),...(session.runConfig.sustainRewards?.enabled?{sustain:session.sustainSnapshot()}:{}),...(session.runConfig.movementContracts?.enabled?{contracts:session.contractSnapshot()}:{})}:null,pickups:arena.isSlice()?arena.pickups?.snapshot()??null:null,
      defenseVisual:{objects:arena.defenseEffects?.getLength()??0,visible:arena.defenseGraphic?.visible??false,flashing:arena.defenseGraphic?.getData('flashing')===true},
      sentry:arena.sentries?.snapshot()??null,companionDiagnostics:{spirit:companionDiagnosticSnapshot(arena.companionDiagnostics.spirit),sentry:companionDiagnosticSnapshot(arena.companionDiagnostics.sentry)},
      ...(session.runConfig.spiritMark?{spiritMark:{...arena.spiritMarkStats,targetId:arena.passives.spiritMarkTarget(session.elapsed)}}:{}),
      areaAbilities:arena.areas?.snapshot()??null,abilitySources:JSON.parse(JSON.stringify(arena.abilitySources)),
      bellAbilities:arena.abilities?.snapshot()??null,spawnPressure:arena.spawns.snapshot(),
      bellModifiers:arena.bells.snapshot(),reinforcements:arena.reinforcements.snapshot(session.elapsed),reloadIndicator:arena.reloadBarSnapshot(),
      weaponStats:session.effectiveConfig.weapon,moveSpeed:session.effectiveConfig.moveSpeed,bursts:arena.bursts.snapshot(),
      contentId:arena.isSlice()?COURTYARD_LEVEL.id:'p2-basic',contactCalibration:{radius:arena.isSlice()?COMBAT_SLICE.previewContactRadius:12,confirmed:false},
      level:arena.isSlice()?arena.level.snapshot(session.elapsed):null,boss:arena.bossSnapshot(),bossEffects:arena.bossEffects?.snapshot()??null,encounter:arena.arrivalName(),weaponInterval:session.effectiveConfig.weapon.intervalSeconds,
      enemyBehaviors:children(arena.enemies).filter(active).map(e=>({id:e.getData('id'),enemyId:e.getData('enemyId'),phase:e.getData('behavior')?.phase??'chase',until:e.getData('behavior')?.until??0,hp:e.getData('hp'),entering:!!e.getData('entering')})),
      enemyProjectiles:children(arena.enemyProjectiles).filter(active).map(e=>({id:e.getData('id'),x:e.body!.center.x,y:e.body!.center.y,vx:bodyOf(e).velocity.x,vy:bodyOf(e).velocity.y,origin:e.getData('origin'),source:e.getData('source'),lifeMode:e.getData('lifeMode')})),
      ...session.snapshot(), imageBudget:imageBudget.snapshot(), reloadSeconds: session.effectiveConfig.weapon.reloadSeconds, durationSeconds: session.runConfig.durationSeconds,
      catTexture: arena.cat.texture.key, catDisplay:{width:arena.cat.displayWidth,height:arena.cat.displayHeight}, presentation: arena.catArt?.snapshot() ?? null, heldPresentation: arena.heldArt?.snapshot() ?? null, feedback: arena.feedback?.snapshot() ?? null, impact: arena.impact?.snapshot() ?? null, scenery: arena.scenery?.snapshot() ?? null, mode: 'auto', locked: arena.locked, targetKind: arena.targetKind,
      player: centerOf(arena.cat), enemies: arena.enemies.countActive(true), kills: arena.kills, objectsHit: arena.objectsHit,
      passiveState: arena.passives.snapshot(), sourceCounts: { ...arena.sourceCounts }, companions: arena.spirit?.active ? 1 : 0,
      enemyStatuses: children(arena.enemies).filter(active).map(enemy => ({ id: enemy.getData('id'), ...arena.chillStatus(enemy) })),
      projectiles: arena.projectiles.countActive(true), moveHeld: !!arena.sticks.owner, moveOwner: arena.sticks.owner?.id ?? null,
      moveStick: arena.sticks.owner ? { x: arena.sticks.owner.x, y: arena.sticks.owner.y, dx: arena.sticks.owner.dx, dy: arena.sticks.owner.dy } : null,
      targets: arena.targets().map(({ id, x, y, kind }) => ({ id, x, y, kind })),
      textureFrames: !disposed && arena.textures.exists('atlas') ? arena.textures.get('atlas').getFrameNames().slice() : [],
      frame: children(arena.enemies).find(active)?.frame?.name ?? null, renderer: 'Phaser Canvas',
      engine: {
        physics: 'Arcade', velocity: { x: bodyOf(arena.cat).velocity.x, y: bodyOf(arena.cat).velocity.y },
        bodies: { cat: bodySnapshot(arena.cat), enemies: children(arena.enemies).filter(active).map(bodySnapshot),
          objects: children(arena.objects).filter(active).map(bodySnapshot), projectiles: children(arena.projectiles).filter(active).map(bodySnapshot) },
        groups: { enemies: groupSnapshot(arena.enemies), objects: groupSnapshot(arena.objects), projectiles: groupSnapshot(arena.projectiles),enemyProjectiles:groupSnapshot(arena.enemyProjectiles) },
        colliders: arena.physics.world.colliders.length, timers: timers.size, overlapHits: arena.overlapHits, sweepHits: arena.sweepHits,
        stickVisible: arena.stickVisible, paused: arena.scene.isPaused() || arena.physics.world.isPaused || arena.time.paused,
        world: { width: courtyardPilot ? COURTYARD.width : WORLD_WIDTH, height: courtyardPilot ? COURTYARD.height : worldHeight }, buffer: { width: game!.canvas.width, height: game!.canvas.height, rgbaBytes: game!.canvas.width * game!.canvas.height * 4 },
        css: { width: cssWidth, height: cssHeight }, dpr, density, quality, cssPixelsPerLogicalUnit: controller.cssPixelsPerLogicalUnit,
        camera: { width: arena.cameras.main.width, height: arena.cameras.main.height, zoomX: arena.cameras.main.zoomX, zoomY: arena.cameras.main.zoomY, scrollX: arena.cameras.main.scrollX, scrollY: arena.cameras.main.scrollY, view: {x:arena.cameras.main.worldView.x,y:arena.cameras.main.worldView.y,width:arena.cameras.main.worldView.width,height:arena.cameras.main.worldView.height} }, arenaMode: courtyardPilot ? 'courtyard-preview' : 'single-screen', renderFrames: renderFrames.snapshot(),
        scale: { gameWidth: arena.scale.gameSize.width, gameHeight: arena.scale.gameSize.height, baseSize: { width: arena.scale.baseSize.width, height: arena.scale.baseSize.height }, displaySize: { width: arena.scale.displaySize.width, height: arena.scale.displaySize.height }, displayScale: { x: arena.scale.displayScale.x, y: arena.scale.displayScale.y } }, bounds: { ...bounds },
      },
    };
  };
  const emit = () => { if (!disposed) callbacks.onState(snapshot()); if(__DEVTOOLS__)require('../devtools/bridge').publish(); };
  const pauseScene = () => { arena.clearOnboarding();arena.interruptG6();arena.feedback?.clear();renderFrames.suspend(); arena.physics.world.pause(); arena.time.paused = true; if (arena.scene.isActive()) arena.scene.pause(); };
  const resumeScene = () => { arena.clearImpact();arena.clearBellEffects();arena.feedback?.clear(); arena.clearBubbleImpact();arena.clearSlamImpact();arena.clearBossDashEffects(); if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__)arena.tweens.getDelta(true); renderFrames.suspend(); game!.loop.resetDelta(); game!.loop.wake(); arena.time.paused = false; arena.physics.world.resume(); arena.scene.resume(); arena.activeG6?.cat.pause(false);arena.activeG6?.held.pause(false); };
  const onRender = (_renderer: PhaserType.Renderer.Canvas.CanvasRenderer, now: number) => {
    if (running && !disposed && !session.isPaused && !session.result) renderFrames.record(now); else renderFrames.suspend();
  };
  const interrupt = (reason: PauseReason) => {
    if (disposed || !running || session.result) return;
    arena.clearInput(); callbacks.onInterrupt(reason);
  };

  class Arena extends Phaser.Scene {
    cat!: Sprite; enemies!: Group; objects!: Group; projectiles!: Group; enemyProjectiles!:Group;
    bossProjectileSlots!:BossProjectileSlots;
    failedProjectileSpawns=0;
    projectileRandom:PhaserType.Math.RandomDataGenerator|null=null;projectileRolls=0;criticalRolls=0;criticalHits=0;
    syncProjectileCapacity():void{if(this.isSlice())this.projectiles.maxSize=Math.max(this.projectiles.maxSize,projectileCapacityForGrowth(session.runConfig,session.effectiveConfig,this.growth!.snapshot().ranks));}
    hunt:HuntMark|null=null;
    growth:RunGrowth|null=null; pickups:ExperiencePickups|null=null;bursts=new WeaponBursts();
    rhythmTimers=new Set<PhaserType.Time.TimerEvent>();rhythmEmitted=0;rhythmGeneration=0;
    abilities:BellAbilities|null=null;
    sentries:SentinelAbilities|null=null;
    companionDiagnostics:{spirit:CompanionSourceDiagnostics;sentry:CompanionSourceDiagnostics}={spirit:{emitted:0,hits:0,actualDamage:0,lastShot:null,lastHit:null},sentry:{emitted:0,hits:0,actualDamage:0,lastShot:null,lastHit:null}};
    spiritMarkStats={applied:0,detonated:0,damage:0};
    areas:AreaAbilities|null=null;abilitySources:Record<string,{hits:number;damage:number}>={};
    bells=new BellModifiers();reinforcements=new ArrivalReinforcements();
    shockEffect!:PhaserType.GameObjects.Graphics;reloadBar!:PhaserType.GameObjects.Graphics;
    catArt: Cat01Presentation | null = null;
    heldArt: HeldHeroPresentation | null = null;
    g6Art:G6Art|null=null;
    flightVisual:G6FlightRhythmPresentation|null=null;
    seenShieldRecovery=0;
    rewardHealing=0;
    get activeG6():G6Art|null {return this.isSlice()&&session.runConfig.growthPool==='normal'?this.g6Art:null;}
    feedback: BattleFeedback | null = null;
    impact: ImpactPresentation | null = null;
    defenseEffects:PhaserType.GameObjects.Group|null=null;
    defenseGraphic:PhaserType.GameObjects.Graphics|null=null;
    scenery: BattleScenery | CourtyardScenery | null = null;
    backgroundCamera: PhaserType.Cameras.Scene2D.Camera | null = null;
    screenCamera: PhaserType.Cameras.Scene2D.Camera | null = null;
    background!: PhaserType.GameObjects.Graphics; guide!: PhaserType.GameObjects.Graphics; stick!: PhaserType.GameObjects.Graphics; chillEffects!: PhaserType.GameObjects.Graphics;
    keys!: Record<string, PhaserType.Input.Keyboard.Key>;
    sticks = new BattleInput(); cadence = new CombatCadence();
    get passives(): CatPassives { return this.cat.getData('passives') as CatPassives; }
    spirit: PhaserType.GameObjects.Image | null = null;
    sourceCounts = { PRIMARY: 0, SECONDARY: 0, SUMMON: 0 }; nextSummonVolley = -1;
    flightReturns=0;flightReturnHits=0;
    locked: number | null = null; targetKind: 'enemy' | 'object' | null = null; lastAim: Point = { x: 0, y: -1 };
    spawns = new SliceSpawns(); contactAt = -Infinity;
    level=new CourtyardLevel();specialRetry:PhaserType.Time.TimerEvent|null=null;
    slamSource:Sprite|null=null;
    bossEffects:BossEffects|null=null;
    warning!: PhaserType.GameObjects.Graphics;
    scatterCore!:PhaserType.GameObjects.Graphics;
    bubbleImpact!:PhaserType.GameObjects.Graphics;
    slamImpact!:PhaserType.GameObjects.Graphics;
    bossDashTrail!:PhaserType.GameObjects.Graphics;
    bossDashImpact!:PhaserType.GameObjects.Graphics;
    isSlice(): boolean { return sliceContent && !session.runConfig.rulesVersion.startsWith('diagnostic-v1'); }
    isOpening():boolean {return this.isSlice()&&this.growth?.snapshot().rulesVersion===NORMAL_GROWTH_RULES_VERSION;}
    firstEncounter:FirstEncounter|null=null;onboardingTravel=0;
    onboardingXPHighlighted=false;onboardingXPTween:PhaserType.Tweens.Tween|null=null;onboardingXPOrb:Sprite|null=null;
    onboardingTimer:PhaserType.Time.TimerEvent|null=null;onboardingTimerKind:OnboardingKind|null=null;
    clearOnboarding():void {
      if(this.onboardingTimer){this.time.removeEvent(this.onboardingTimer);this.onboardingTimer.destroy();}
      this.onboardingTimer=null;this.onboardingTimerKind=null;onboarding.clearTransient();
      this.onboardingXPTween?.remove();this.onboardingXPTween=null;this.onboardingXPOrb?.setAlpha(1);this.onboardingXPOrb=null;
    }
    syncOnboardingTimer():void {
      const kind=onboarding.snapshot().hint?.kind??null;if(kind===this.onboardingTimerKind)return;
      if(this.onboardingTimer){this.time.removeEvent(this.onboardingTimer);this.onboardingTimer.destroy();}
      this.onboardingTimer=null;this.onboardingTimerKind=kind;
      const duration=onboarding.snapshot().hint?.compact?0:kind==='move'?4000:kind==='xp'?3000:kind==='fire'?4000:0;
      if(kind&&duration)this.onboardingTimer=this.time.delayedCall(duration,()=>{this.onboardingTimer=null;this.onboardingTimerKind=null;onboarding.expire(kind);this.syncOnboardingTimer();emit();});
    }
    observeOnboarding():void {
      if(!this.isOpening()||session.result)return;
      const pickups=this.pickups?.snapshot(),growth=this.growth!.snapshot();
      onboarding.observe({elapsed:session.elapsed,travel:this.onboardingTravel,primaryShots:this.sourceCounts.PRIMARY,droppedXP:pickups?.droppedXP??0,collectedXP:pickups?.collectedXP??0,offerId:growth.offer?.id??null,confirmedPicks:growth.confirmedPicks,danger:this.bossSnapshot()?.phase.includes('warning')??false});this.syncOnboardingTimer();
      if(onboarding.snapshot().hint?.kind==='xp'&&!this.onboardingXPHighlighted){
        const orb=children(this.pickups!.group).filter(active).sort((a,b)=>Phaser.Math.Distance.BetweenPointsSquared(a,this.cat)-Phaser.Math.Distance.BetweenPointsSquared(b,this.cat)||a.getData('orbId')-b.getData('orbId'))[0];
        if(orb){this.onboardingXPHighlighted=true;this.onboardingXPOrb=orb;this.onboardingXPTween=this.tweens.add({targets:orb,alpha:.55,duration:160,yoyo:true,repeat:2,onComplete:()=>{orb.setAlpha(1);this.onboardingXPTween=null;this.onboardingXPOrb=null;}});}
      }
      if(summaries.current()?.first.enemy===null){this.cameras.main.preRender();for(const enemy of children(this.enemies).filter(active)){const art=enemy.getData('art') as EnemyPresentation|undefined;if(art&&Phaser.Geom.Rectangle.ContainsRect(this.cameras.main.worldView,art.bounds())){summaries.visibleEnemy(session.elapsed);break;}}}
    }
    eligibleForAutomaticTarget(enemy:Sprite):boolean {return !enemy.getData('openingEncounter')||enemy.getData('openingEligible')===true;}
    automaticTargets():Target[] {const pending=children(this.enemies).find(e=>active(e)&&!this.eligibleForAutomaticTarget(e));return this.targets().filter(target=>target.id!==pending?.getData('id'));}
    observeFirstEncounter():void {
      const fact=this.firstEncounter;if(!fact)return;
      const enemy=children(this.enemies).find(e=>active(e)&&e.getData('id')===fact.id&&e.getData('openingEncounter'));
      if(!enemy)return;
      const art=enemy.getData('art') as EnemyPresentation,p=centerOf(enemy);
      art.sync(p.x,p.y,enemy.getData('behavior'),bodyOf(enemy).velocity.x,session.elapsed);
      const rect=art.bounds();fact.artBounds={x:rect.x,y:rect.y,width:rect.width,height:rect.height};
      this.cameras.main.preRender();
      if(!enemy.getData('openingEligible')&&Phaser.Geom.Rectangle.ContainsRect(this.cameras.main.worldView,rect)){fact.eligible=true;fact.fullVisibleAt=session.elapsed;fact.fullVisibleBounds={...fact.artBounds};enemy.setData('openingEligible',true);}
    }
    kills = 0; objectsHit = 0; nextMob = 1; nextProjectile = 1; overlapHits = 0; sweepHits = 0; stickVisible = false;
    constructor() { super({ key: 'Arena' }); }
    create(): void {
      try {
        if(courtyardPilot) {
          r1Module!.installR1Atlases(this,sources,catImages);
          this.textures.addImage('enemy-bubble',sources.get('./assets/first-combat/bubble.png')!);
          this.textures.addSpriteSheet('boss-dust',sources.get('./assets/first-combat/b01-dust.png')!,{frameWidth:BOSS_DUST_FRAME,frameHeight:BOSS_DUST_FRAME});
        } else {
        this.textures.addImage('cat', courtyardPilot ? catImages.CAT01 : catImage); this.textures.addImage('cat-CAT01', catImages.CAT01); this.textures.addImage('cat-CAT02', catImages.CAT02);
        this.textures.addImage('cat-CAT03', catImages.CAT03); this.textures.addAtlas('atlas', atlasImage, sliceContent ? sliceAtlas : atlas);
        if(sliceContent){this.textures.addAtlas('enemy-parts',ownedImages[9],enemyParts);this.textures.addImage('enemy-bubble',ownedImages[10]);this.textures.addSpriteSheet('boss-dust',ownedImages[11],{frameWidth:BOSS_DUST_FRAME,frameHeight:BOSS_DUST_FRAME});}
        }
        this.anims.create({ key: 'wiggle', frames: [{ key: 'atlas', frame: 'enemy-0' }, { key: 'atlas', frame: 'enemy-1' }], frameRate: 3, repeat: -1 });
        if (courtyardPilot) {
          this.backgroundCamera = this.cameras.add(0, 0, 360, 500, false, 'courtyard-background').setBackgroundColor('#dbe7c0');
          this.backgroundCamera.inputEnabled = false;
          // Move the new Camera before main without changing the native main/default.
          this.cameras.cameras.unshift(this.cameras.cameras.pop()!);
        }
        this.background = this.add.graphics().setDepth(-5);
        this.cat = this.physics.add.sprite(WORLD_WIDTH / 2, 0, 'cat',courtyardPilot?'body':'__BASE').setDisplaySize(58, 58).setDepth(3).setCollideWorldBounds(true);
        bodyOf(this.cat).updateFromGameObject();
        if (courtyardPilot || pilotImages) this.catArt = new Cat01Presentation(this, pilotImages, courtyardPilot?courtyardCat01Frames:undefined);
        if (f1Images) { this.feedback = new BattleFeedback(this, f1Images[0]); this.scenery = courtyardPilot ? new CourtyardScenery(this, this.backgroundCamera!, sources.get('./assets/r1-restoration/native/courtyard-native-v01.png')!) : new BattleScenery(this, f1Images[1]); }
        if(courtyardPilot)this.heldArt=new HeldHeroPresentation(this);
        this.guide = this.add.graphics().setDepth(2); this.stick = this.add.graphics().setDepth(5); this.chillEffects = this.add.graphics().setDepth(2);
        if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__){this.shockEffect=this.add.graphics().setDepth(2.2);this.reloadBar=this.add.graphics().setDepth(3.8);}
        this.warning = this.add.graphics().setDepth(.8);
        this.scatterCore=this.add.graphics().setDepth(1.2);
        this.bubbleImpact=this.add.graphics().setDepth(4);
        this.slamImpact=this.add.graphics().setDepth(.9);
        this.bossDashTrail=this.add.graphics().setDepth(.6);
        this.bossDashImpact=this.add.graphics().setDepth(.9);
        if(sliceContent)this.bossEffects=new BossEffects(this,this.slamImpact,this.bossDashTrail,this.bossDashImpact);
        if(sliceContent)this.pickups=new ExperiencePickups(this);
        this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 10, collideWorldBounds: true });
        this.objects = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 1, collideWorldBounds: true });
        this.projectiles = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 24 });
        this.enemyProjectiles=this.physics.add.group({classType:Phaser.Physics.Arcade.Sprite,maxSize:ENEMY_BUBBLE.maxCount});
        this.bossProjectileSlots=new BossProjectileSlots(this.enemyProjectiles);
        if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__)this.abilities=new BellAbilities(this,this.cat,(point,radius)=>this.nearbyEnemies(point,radius),(enemy,damage,effect)=>this.abilityHit(enemy,damage,effect));
        if(g6&&this.heldArt){
          this.g6Art=g6.createG6Art(this,this.heldArt,sources);
          this.g6Art.flight.attach(this.projectiles);
        }
        if (courtyardPilot) {
          this.screenCamera = this.cameras.add(0, 0, 360, 500, false, 'courtyard-input');
          this.screenCamera.inputEnabled = false;
          // Keep native follow/readability on main, and draw the whole world
          // with its full-canvas projection so HUD reserves do not clip actors.
          this.cameras.main.ignore(this.children.getChildren());
          this.backgroundCamera!.ignore(this.stick);
          this.screenCamera.ignore(this.children.getChildren().filter(object => object !== this.stick));
          this.events.on('addedtoscene', this.filterCourtyardObject, this);
        }
        this.keys = this.input.keyboard!.addKeys('W,A,S,D,ESC') as Record<string, PhaserType.Input.Keyboard.Key>;
        this.keys.ESC.on('down', () => interrupt('menu'));
        this.input.on('pointerdown', this.onPointerDown, this); this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this); this.input.on('pointerupoutside', this.onPointerUp, this);
        // Canvas exit is not release: keep the held direction until Phaser
        // receives pointerup/pointerupoutside, cancellation or a lifecycle pause.
        this.scale.on('resize', this.onResize, this); this.events.on('postupdate', this.afterUpdate, this);
        this.syncPresentation(false); game!.events.on('postrender', onRender);
        this.events.once('shutdown',()=>{this.clearRhythm();this.destroyDefenseVisual();});
        if(impactModule&&courtyardPilot){
          this.impact=new impactModule.ImpactPresentation(this);
          const updateMotion=()=>this.configureImpact();
          impactMotion!.addListener(updateMotion);this.events.once('shutdown',()=>impactMotion!.removeListener(updateMotion));
        }
        this.resetEntities(); pauseScene(); window.clearTimeout(bootTimeout); if(__DEVTOOLS__)require('../devtools/bridge').attach(controller.devtools!); resolveReady(controller); emit();
      } catch (error) {
        window.clearTimeout(bootTimeout); rejectReady(error instanceof Error ? error : new Error('战斗场景初始化失败。'));
      }
    }
    acceptsInput(): boolean { return running && !disposed && !session.isPaused && !session.result; }
    g6Snapshot():G6ArtSnapshot {
      const {cat,held,rewards,bells,areas,flight,huntContracts}=this.g6Art!;
      return {cat:cat.snapshot(),held:held.snapshot(),rewards:rewards.snapshot(),bells:bells.snapshot(),
        areas:areas.snapshot(),flight:flight.snapshot(),huntContracts:huntContracts.snapshot()};
    }
    resetG6():void {
      const art=this.g6Art;if(!art)return;
      art.rewards.reset();art.bells.reset();art.areas.reset();art.flight.reset();art.huntContracts.reset();
      const active=!!this.activeG6;
      art.bells.bind(active?this.abilities:null);
      this.flightVisual=active?art.flight:null;
      this.seenShieldRecovery=0;this.rewardHealing=0;
      this.setG6Quality();
    }
    interruptG6():void {
      this.clearImpact();
      const art=this.activeG6;if(!art)return;
      // An upgrade may interrupt the same frame after its casts already settled.
      // Observe persistent facts silently before discarding transient effects.
      this.syncG6(false);
      art.cat.pause(true);art.held.pause(true);
      art.rewards.interrupt();art.bells.interrupt();art.areas.interrupt();art.flight.interrupt();art.huntContracts.interrupt();
    }
    setG6Quality():void {
      this.configureImpact();
      const art=this.activeG6;if(!art)return;
      art.rewards.setQuality(quality);art.bells.setQuality(quality);art.areas.setQuality(quality);
      art.flight.setQuality(quality);art.huntContracts.setQuality(quality);
    }
    configureImpact():void {
      if(!this.impact)return;
      this.clearImpact();
      this.feedback?.configure(f1Art,quality,!!this.activeG6);
      this.impact.configure(!!this.activeG6&&f1Art,quality,.70,impactMotion?.matches??false);
    }
    playerImpactParts():(PhaserType.GameObjects.Image|PhaserType.GameObjects.Sprite)[] {
      const art=this.activeG6;if(!art)return [];
      return session.runConfig.catId==='CAT01'?art.cat.objects():[...this.heldArt!.objects(),...art.held.objects()];
    }
    clearImpact():void {
      this.impact?.clear();
      if(!this.enemies)return;
      for(const enemy of children(this.enemies)){
        const pose=enemy.getData('impactPose');if(pose){this.tweens.killTweensOf(pose);pose.x=0;}
        (enemy.getData('art') as EnemyPresentation|undefined)?.clearImpactOffset();
      }
    }
    syncG6(animate=true):void {
      const art=this.activeG6;if(!art||session.result||(session.isPaused&&animate))return;
      const body=bodyOf(this.cat),p=body.center,ranks=this.growth!.snapshot().ranks;
      const defense=session.defenseSnapshot(),sentry=this.sentries?.snapshot();
      art.rewards.sync(p,defense,sentry?.station??null,sentry?.emitted??0,sentry?.lastShot??null,animate);
      art.rewards.syncSpirit(this.spirit,this.companionDiagnostics.spirit.emitted,session.elapsed,animate);
      const markedId=this.passives.spiritMarkTarget(session.elapsed);
      const spiritTarget=markedId===null?undefined:children(this.enemies).find(enemy=>active(enemy)&&enemy.getData('id')===markedId);
      art.rewards.syncSpiritMark(spiritTarget?{x:bodyOf(spiritTarget).center.x,y:bodyOf(spiritTarget).center.y-bodyOf(spiritTarget).halfHeight-9}:null);
      this.spirit?.setVisible(false);
      const recovered=session.sustainSnapshot().shieldRecoveredTotal;
      if(animate&&recovered>this.seenShieldRecovery){
        const pose=cat01Art?(session.runConfig.catId==='CAT01'?art.cat.snapshot():this.heldArt?.snapshot()):null;
        art.rewards.reloadShield(recovered-this.seenShieldRecovery,pose?.weaponPosition??p,p);
      }
      this.seenShieldRecovery=recovered;
      const areas=this.areas?.snapshot()??null;
      art.bells.sync(this.abilities?.snapshot()??null);
      art.areas.sync(areas,session.elapsed,!!ranks.E16,animate);
      art.flight.sync();
      const mark=this.hunt?.snapshot()??null;
      const marked=mark?.targetId==null?null:children(this.enemies).find(e=>active(e)&&e.getData('id')===mark.targetId&&e.getData('hp')>0);
      art.huntContracts.syncMark(mark,marked?{...centerOf(marked),height:marked.displayHeight}:null,!!this.hunt?.preferredTarget());
      art.huntContracts.syncContract(p,{x:body.deltaXFinal(),y:body.deltaYFinal()},session.contractSnapshot(),
        !!ranks.R06,!!ranks.R07,!!ranks.R04,areas?.lastPulse??null,animate);
    }
    ensureDefenseVisual():void {
      if(this.activeG6||!session.runConfig.defenseCompanions?.enabled||this.defenseGraphic)return;
      this.defenseEffects=this.add.group({maxSize:1});
      this.defenseGraphic=this.add.graphics().setDepth(2.7).setVisible(false).setData('flashing',false);
      this.defenseEffects.add(this.defenseGraphic);
    }
    destroyDefenseVisual():void {
      if(this.defenseGraphic)this.tweens.killTweensOf(this.defenseGraphic);
      this.defenseEffects?.clear(true,true);this.defenseEffects?.destroy();
      this.defenseEffects=null;this.defenseGraphic=null;
    }
    drawDefenseVisual():void {
      const graphic=this.defenseGraphic;
      if(!graphic||session.isPaused)return;
      const d=session.defenseSnapshot(),flashing=graphic.getData('flashing')===true;
      graphic.clear().setVisible(!session.result&&(d.shield>0||flashing));
      if(!graphic.visible)return;
      // A foot-level outline keeps the approved face/body unobscured.
      const p=centerOf(this.cat);graphic.setPosition(p.x,p.y);
      graphic.lineStyle(flashing?2:1,0x71dfe1,flashing?.95:.45).strokeEllipse(0,10,44,16);
    }
    showShieldAbsorption():void {
      this.ensureDefenseVisual();const graphic=this.defenseGraphic;
      if(!graphic)return;
      this.tweens.killTweensOf(graphic);graphic.setData('flashing',true).setAlpha(1);
      this.drawDefenseVisual();
      this.tweens.add({targets:graphic,alpha:.45,duration:160,onComplete:()=>{graphic.setData('flashing',false);this.drawDefenseVisual();}});
    }
    incomingEnemyDamage(amount:number,source?:DamageSource):ReturnType<Session['damage']> {
      const fact=session.damage(amount);
      summaries.damage(source,fact.accepted,fact.hpLost,session.hp);if(fact.accepted&&fact.hpLost>0)onboarding.hurt(session.elapsed);
      if(this.activeG6)this.activeG6.rewards.incoming(fact);
      else if(fact.shieldAbsorbed>0)this.showShieldAbsorption();
      this.feedback?.incoming(fact,centerOf(this.cat),session.hp,session.effectiveConfig.maxHp);
      this.impact?.playerDamage(fact,this.playerImpactParts());
      sound({type:'incoming',at:session.elapsed,accepted:fact.accepted,hpLost:fact.hpLost,shieldBroke:fact.shieldBroke});
      return fact;
    }
    applyCourtyardEnemyHit(amount:number,source:DamageSource):void {
      if(session.elapsed+1e-8>=this.contactAt+COURTYARD_LEVEL.incomingHitIntervalSeconds){
        this.incomingEnemyDamage(amount,source);
        this.contactAt=session.elapsed;
      }
    }
    clearInput(): void {
      this.sticks.clear(); this.input.keyboard?.resetKeys();
      // A host may never deliver the end of an interrupted gesture. Release
      // Phaser's native pointers too, so fresh presses can reuse them.
      for (const pointer of this.input.manager.pointers) pointer.reset();
      this.cat?.setVelocity(0, 0); this.guide?.clear(); this.stick?.clear(); this.stickVisible = false;
    }
    filterCourtyardObject(object: PhaserType.GameObjects.GameObject): void {
      // DisplayList emits the actual added object, including pooled effects/text.
      this.cameras.main.ignore(object); this.screenCamera?.ignore(object);
    }
    onPointerDown(pointer: PhaserType.Input.Pointer): void {
      const world = courtyardPilot ? inputBufferPoint(pointer.x, pointer.y, this.cameras.main.zoomX) : this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.acceptsInput() && (pointer.wasTouch || pointer.leftButtonDown())) this.sticks.beginTouch(pointer.id, world.x, world.y, inputArea, cssScale, inputExclusions);
      this.observePointer('down',pointer);
    }
    onPointerMove(pointer: PhaserType.Input.Pointer): void { if (this.acceptsInput() && pointer.isDown) { const world = courtyardPilot ? inputBufferPoint(pointer.x, pointer.y, this.cameras.main.zoomX) : this.cameras.main.getWorldPoint(pointer.x, pointer.y); this.sticks.moveTouch(pointer.id, world.x, world.y); } }
    onPointerUp(pointer: PhaserType.Input.Pointer): void {
      const owner = this.sticks.owner?.id === pointer.id, canceled = pointer.wasCanceled; this.sticks.releaseTouch(pointer.id);
      this.observePointer('up',pointer);
      if (owner && canceled) interrupt('inputLost');
    }
    observePointer(type:string,pointer:PhaserType.Input.Pointer):void {
      if(!__TEST_INPUT_DIAGNOSTICS__)return;
      try { callbacks.onBattleInput?.({channel:'phaser',type,at:Date.now(),owner:this.sticks.owner?.id??null,
        pointerId:pointer.id,wasTouch:pointer.wasTouch,canceled:pointer.wasCanceled,buttons:pointer.buttons,x:pointer.x,y:pointer.y}); }
      catch { /* Read-only diagnostics must not change gameplay. */ }
    }
    onResize(): void { this.syncPresentation(); }
    syncPresentation(notify = true): void {
      if (syncingPresentation || disposed) return;
      const rect = stage.getBoundingClientRect(), nextDpr = window.devicePixelRatio || 1, nextDensity = quality === 'low' ? 1 : Math.min(Math.max(nextDpr, 1), 2);
      const width = Math.round(rect.width * nextDensity), height = Math.round(rect.height * nextDensity);
      const changed = cssWidth !== rect.width || cssHeight !== rect.height || dpr !== nextDpr || density !== nextDensity ||
        this.scale.gameSize.width !== width || this.scale.gameSize.height !== height;
      if (!changed && notify) return;
      syncingPresentation = true;
      try {
        cssWidth = rect.width; cssHeight = rect.height; dpr = nextDpr; density = nextDensity; worldHeight = WORLD_WIDTH * cssHeight / cssWidth;
        // Scale owns buffer resize and CameraManager owns the native viewport.
        // CSS only fills the existing stage; no old buffer is enlarged here.
        game!.canvas.style.width = '100%'; game!.canvas.style.height = '100%';
        if (this.scale.gameSize.width !== width || this.scale.gameSize.height !== height) this.scale.resize(width, height);
        else this.scale.refresh();
        const camera = this.cameras.main;
        if (courtyardPilot) this.configureCourtyardCamera();
        else camera.setOrigin(0, 0).setScroll(0, 0).setZoom(width / WORLD_WIDTH, height / worldHeight);
        camera.preRender(); // Native matrix update is also required while paused.
        this.feedback?.layout(courtyardPilot ? {top:0,bottom:COURTYARD.height,left:0,right:COURTYARD.width} : bounds);
        if (notify) {
          if (this.sticks.owner && this.acceptsInput()) interrupt('inputLost');
          callbacks.onResize?.(); emit();
        }
      } finally { syncingPresentation = false; }
    }
    configureCourtyardCamera(resetFollow = false): void {
      const camera = this.cameras.main, zoom = this.scale.gameSize.width / WORLD_WIDTH;
      const centerX = camera.midPoint.x, centerY = camera.midPoint.y;
      camera.setViewport(0, bounds.top * zoom, this.scale.gameSize.width, Math.max(1, (bounds.bottom - bounds.top) * zoom))
        .setOrigin(.5, .5).setZoom(zoom).setBounds(0, 0, COURTYARD.width, COURTYARD.height);
      // Both native setters recenter. New runs reset follow; density/layout
      // changes retain its world center via the native Camera API.
      if (resetFollow) camera.startFollow(this.cat, false, 1, 1).setDeadzone(72, 96);
      else camera.centerOn(centerX, centerY);
      this.screenCamera?.setViewport(0, 0, this.scale.gameSize.width, this.scale.gameSize.height).setOrigin(0, 0).setScroll(0, 0).setZoom(zoom);
      this.screenCamera?.preRender();
      this.syncCourtyardBackground();
    }
    syncCourtyardBackground(): void {
      const main = this.cameras.main, background = this.backgroundCamera;
      if (!background) return;
      main.preRender();
      // Native scroll includes the zoom/origin offset. Query the canvas corner
      // after preRender instead of treating main.scroll as the world top-left.
      const corner = main.getWorldPoint(0, 0);
      background.setViewport(0, 0, this.scale.gameSize.width, this.scale.gameSize.height)
        .setOrigin(0, 0).setZoom(main.zoomX, main.zoomY).setScroll(corner.x, corner.y);
      background.preRender();
      if (this.scenery instanceof CourtyardScenery) this.scenery.syncCamera();
    }
    syncHunt():void {
      const ranks=this.growth?.snapshot().ranks,enabled=this.isSlice()&&!!session.runConfig.huntTargeting?.enabled&&!!ranks?.C18;
      if(enabled&&!this.hunt)this.hunt=new HuntMark(this,this.cat,
        ()=>children(this.enemies).filter(e=>active(e)&&e.getData('hp')>0&&this.eligibleForAutomaticTarget(e)).map(e=>({id:e.getData('id'),...centerOf(e),hp:e.getData('hp'),alive:true,kind:'enemy'})),
        ()=>centerOf(this.cat),()=>session.effectiveConfig.weapon.targetRange);
      this.hunt?.update(enabled,!!ranks?.M26);
    }
    targets(): Target[] {
      return [...children(this.enemies), ...children(this.objects)].filter(sprite => active(sprite) && sprite.getData('hp') > 0)
        .map(sprite => ({ id: sprite.getData('id') as number, ...centerOf(sprite), alive: true, kind: sprite.getData('kind') as Target['kind'] }));
    }
    drawBackground(): void {
      const f1 = !!f1Images && f1Art && cat01Art && session.runConfig.catId === 'CAT01' && session.runConfig.rulesVersion !== 'diagnostic-v1';
      this.feedback?.configure(f1||courtyardPilot&&f1Art, quality,!!this.impact&&!!this.activeG6); this.feedback?.layout(courtyardPilot ? {top:0,bottom:COURTYARD.height,left:0,right:COURTYARD.width} : bounds); this.scenery?.layout(courtyardPilot || f1, quality, bounds, worldHeight);
      if (courtyardPilot) { this.background.clear().fillStyle(0xdbe7c0).fillRect(0, 0, COURTYARD.width, COURTYARD.height); return; }
      if (f1) { this.background.clear().fillStyle(0xdbe7c0).fillRect(0, 0, WORLD_WIDTH, worldHeight); return; }
      this.background.clear().fillStyle(0xe5edda).fillRect(0, 0, WORLD_WIDTH, worldHeight);
      for (let x = 12; x < WORLD_WIDTH; x += 42) for (let y = bounds.top + 8; y < bounds.bottom - 8; y += 42) this.background.fillStyle((x + y) % 3 ? 0xd4e2c6 : 0xc9dbba, .6).fillCircle(x, y, 3);
      this.background.lineStyle(2, 0x9fb393, .4).strokeRoundedRect(12, bounds.top, WORLD_WIDTH - 24, bounds.bottom - bounds.top, Math.min(20, (bounds.bottom - bounds.top) / 2));
    }
    cancelLife(sprite: Sprite): void {
      const timer = sprite.getData('lifeTimer') as PhaserType.Time.TimerEvent | null;
      if (timer) { this.time.removeEvent(timer); timer.destroy(); sprite.setData('lifeTimer', null); }
      this.cancelFlightTimer(sprite);
    }
    cancelFlightTimer(sprite:Sprite):void {
      const timer=sprite.getData('flightTimer') as PhaserType.Time.TimerEvent|null;
      if(timer){this.time.removeEvent(timer);timer.destroy();sprite.setData('flightTimer',null);}
    }
    recycle(sprite: Sprite, group: Group): void {
      if(group===this.enemies){
        this.impact?.clearTarget(sprite.getData('id'));
        const pose=sprite.getData('impactPose');if(pose)this.tweens.killTweensOf(pose);
      }
      if(group===this.enemies){sprite.setData('entering',false);sprite.setCollideWorldBounds(true);}
      if(group===this.projectiles){const volley=sprite.getData('bellVolley') as BellVolley|undefined;if(volley){this.bells.release(volley);sprite.setData('bellVolley',null);}}
      if(group===this.enemies&&sprite.getData('enemyId')==='B01'){this.bossEffects?.clear();this.scatterCore?.clear();this.bossProjectileSlots.release(sprite);}
      (sprite.getData('art') as EnemyPresentation | undefined)?.clear();
      this.cancelLife(sprite); sprite.stop(); sprite.setData('chill', null); sprite.disableBody(true, true); group.killAndHide(sprite);
      if(group===this.projectiles&&sprite.getData('flightOwned')){
        (sprite.getData('hitIds') as Set<number>)?.clear();
        (sprite.getData('returnHitIds') as Set<number>|null)?.clear();
        sprite.setData({flightOwned:false,flightOrigin:null,flightPhase:null,returnEnabled:false,mirrorReturn:false,returnAllowance:0,returnHitIds:null,returnHitCount:0,flightLastDamage:null,returnDamage:null,flightTurnDue:false,flightExpired:false});
      }
      if (group === this.enemies) this.drawChillEffects();
    }
    chillOf(enemy: Sprite): ChillState {
      let state = enemy.getData('chill') as ChillState | null;
      if (!state) { state = newChillState(); enemy.setData('chill', state); }
      return state;
    }
    chillStatus(enemy:Sprite){
      const state=chillSnapshot(this.chillOf(enemy),session.elapsed,session.runConfig.chill);
      return enemy.getData('enemyId')==='B01'?{...state,frozen:false,bossSlow:state.frozen,speedMultiplier:Math.max(.85,state.speedMultiplier)}:state;
    }
    drawChillEffects(): void {
      this.chillEffects.clear();
      for (const enemy of children(this.enemies)) if (active(enemy)) {
        const status = this.chillStatus(enemy), position = centerOf(enemy);
        if (status.frozen) this.chillEffects.lineStyle(2, 0x75bfff, .95).strokeCircle(position.x, position.y, 23);
        else if('bossSlow' in status&&status.bossSlow)this.chillEffects.lineStyle(1.5,0x75bfff,.65).strokeCircle(position.x,position.y,bodyOf(enemy).halfWidth+4);
        else for (let layer = 0; layer < status.layers; layer++) {
          this.chillEffects.fillStyle(0x75bfff, .95).fillCircle(position.x + (layer - (status.layers - 1) / 2) * 9, position.y - 24, 3);
        }
      }
    }
    place(group: Group, x: number, fraction: number, kind: 'enemy' | 'object'): Sprite | null {
      if(kind==='enemy'&&group.countActive(true)>=session.runConfig.scenario.maxEnemies)return null;
      const y = courtyardPilot ? COURTYARD.height * fraction : bounds.top + (bounds.bottom - bounds.top) * fraction;
      const sprite = group.get(x, y, 'atlas', kind === 'enemy' ? 'enemy-0' : 'crate') as Sprite | null;
      if (!sprite) return null;
      const existingArt=sprite.getData('art') as EnemyPresentation|undefined;
      this.cancelLife(sprite); sprite.data?.reset(); sprite.stop();
      if(existingArt)sprite.setData('art',existingArt);
      sprite.setTexture('atlas', kind === 'enemy' ? 'enemy-0' : 'crate').setDisplaySize(kind === 'enemy' ? 36 : 40, kind === 'enemy' ? 36 : 40)
        .setDepth(1).setAlpha(1).setAngle(0).setFlip(false, false);
      circleBody(sprite, kind === 'enemy' ? 18 : 21);
      sprite.enableBody(true, x, y, true, true); sprite.setVelocity(0, 0); resetBody(sprite, x, y);
      const entering=courtyardPilot&&kind==='enemy'&&!Phaser.Geom.Rectangle.Contains(this.physics.world.bounds,x,y);
      sprite.setCollideWorldBounds(!entering);
      sprite.setData({ id: this.nextMob++, kind, hp: kind === 'enemy' ? session.runConfig.scenario.enemyHp : session.runConfig.scenario.objectHp,entering });
      if (kind === 'enemy') sprite.setData('chill', newChillState());
      if (kind === 'enemy') sprite.play('wiggle'); this.correctBounds(sprite); return sprite;
    }
    resetEntities(): void {
      this.sentries?.destroy();this.sentries=null;
      if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__&&this.isSlice()&&session.runConfig.defenseCompanions?.enabled){
        this.sentries=new SentinelAbilities(this,this.cat,()=>session.runConfig,(point,radius)=>this.nearbyEnemies(point,radius),
          (origin,angle,damage,speed,life,deploymentId)=>{const id=this.nextProjectile;return this.projectile(origin,angle,'spirit-shot',Hits.SUMMON,this.nextSummonVolley--,damage,0,speed,life,'SENTRY',deploymentId)?id:null;},()=>session.elapsed,()=>session.defenseSnapshot().shield,()=>session.movementContext(),!this.activeG6);
      }
      this.companionDiagnostics={spirit:{emitted:0,hits:0,actualDamage:0,lastShot:null,lastHit:null},sentry:{emitted:0,hits:0,actualDamage:0,lastShot:null,lastHit:null}};
      this.spiritMarkStats={applied:0,detonated:0,damage:0};
      this.destroyDefenseVisual();
      if(session.runConfig.defenseCompanions?.enabled)this.ensureDefenseVisual();
      this.clearRhythm();
      this.abilities?.reset();this.clearBellEffects();this.reloadBar?.clear();this.reinforcements=new ArrivalReinforcements();
      this.pickups?.reset();this.abilitySources={};
      if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__&&this.isSlice()&&session.runConfig.areaAbilities?.enabled){
        if(!this.areas)this.areas=new AreaAbilities(this,this.cat,()=>session.runConfig,(point,radius)=>this.nearbyEnemies(point,radius),(enemy,damage,effect,castId)=>this.abilityHit(enemy,damage,effect,castId),()=>session.elapsed,()=>session.movementContext());
        this.areas.reset();
        this.areas.setOriginalPresentation(!this.activeG6);
      }else if(this.areas){this.areas.destroy();this.areas=null;}
      this.abilities?.setAreaMultiplier(1);
      this.abilities?.setAreaPreview(__BUILD_PROFILE__==='playtest'&&this.isSlice()&&!!session.runConfig.areaAbilities?.enabled&&!this.activeG6);
      const growthRandom=this.isSlice()?new Phaser.Math.RandomDataGenerator([String(Date.now()),String(++runSequence)]):null;
      this.abilities?.setRateCoefficient(growthNumbers(session.runConfig.growthTuning?.attributePlan).rate);
      this.growth=growthRandom?new RunGrowth(runSequence,()=>growthRandom.frac(),session.runConfig):null;this.bursts=new WeaponBursts();
      this.projectileRandom=session.runConfig.projectileTraits?.enabled?new Phaser.Math.RandomDataGenerator(['projectile-traits',String(Date.now()),String(runSequence)]):null;
      this.projectileRolls=0;this.criticalRolls=0;this.criticalHits=0;
      this.flightReturns=0;this.flightReturnHits=0;
      this.feedback?.reset(); this.warning?.clear();this.scatterCore?.clear();this.clearBubbleImpact();this.clearSlamImpact();this.clearBossDashEffects();this.cancelSpecialRetry();this.level=new CourtyardLevel();this.slamSource=null;this.bossEffects?.reset(); this.spawns = new SliceSpawns({opening:this.isOpening()});this.firstEncounter=null;this.onboardingTravel=0;this.onboardingXPHighlighted=false; this.contactAt = -Infinity;
      this.clearInput(); this.locked = null; this.targetKind = null; this.lastAim = { x: 0, y: -1 };
      this.hunt?.clear();
      this.cadence = new CombatCadence(session.runConfig); this.kills = 0; this.objectsHit = 0; this.nextMob = 1; this.nextProjectile = 1; this.overlapHits = 0; this.sweepHits = 0;
      this.cat.setData('passives', new CatPassives(session.runConfig)); this.sourceCounts = { PRIMARY: 0, SECONDARY: 0, SUMMON: 0 }; this.nextSummonVolley = -1;
      this.spirit?.destroy(); this.spirit = null;
      for (const group of [this.enemies, this.objects, this.projectiles,this.enemyProjectiles]) for (const sprite of children(group)) this.recycle(sprite, group);
      this.failedProjectileSpawns=0;
      const projectileCapacity=this.isSlice()?projectileCapacityForGrowth(session.runConfig,session.effectiveConfig,this.growth!.snapshot().ranks):24;
      // Group.get reuses dead members before checking maxSize. Remove recycled
      // excess members when leaving the courtyard, keeping the same native pool.
      for(const shot of children(this.projectiles).slice(projectileCapacity))this.projectiles.remove(shot,true,true);
      this.projectiles.maxSize=projectileCapacity;
      this.bells=new BellModifiers();
      this.chillEffects.clear();
      this.physics.world.setBounds(0, courtyardPilot ? 0 : bounds.top, courtyardPilot ? COURTYARD.width : WORLD_WIDTH, courtyardPilot ? COURTYARD.height : bounds.bottom - bounds.top);
      this.enemies.maxSize = this.isSlice()?32:session.runConfig.scenario.maxEnemies;
      const displaySize=this.isSlice()?COMBAT_SLICE.displaySize:58;
      this.cat.setTexture(session.runConfig.rulesVersion === 'diagnostic-v1' ? 'cat' : 'cat-' + session.runConfig.catId,courtyardPilot?'body':'__BASE').setDisplaySize(displaySize,displaySize);
      circleBody(this.cat, this.isSlice()?COMBAT_SLICE.previewContactRadius:12); this.catBounds();
      const startX = courtyardPilot ? COURTYARD.width / 2 : WORLD_WIDTH / 2, startY = courtyardPilot ? COURTYARD.height / 2 : (bounds.top + bounds.bottom) / 2;
      this.cat.enableBody(true, startX, startY, true, true).setFlipX(false);
      resetBody(this.cat, startX, startY);
      this.resetG6();
      this.syncCatArt(true);
      if (session.runConfig.passive === 'spirit') this.spirit = this.add.image(this.cat.x - 34, this.cat.y - 28, 'atlas', 'spirit').setDisplaySize(28, 28).setDepth(3).setAlpha(.9);
      this.correctBounds(this.cat);
      if (courtyardPilot) { this.configureCourtyardCamera(true); if(!this.isSlice()){this.spawnCourtyardEnemy(); this.spawnCourtyardEnemy(); this.place(this.objects, 450, 540 / COURTYARD.height, 'object');} }
      else { this.place(this.enemies, 80, .2, 'enemy'); this.place(this.enemies, 275, .35, 'enemy'); this.place(this.objects, 275, .75, 'object'); }
      this.drawBackground();
    }
    correctBounds(sprite: Sprite): void {
      const body = bodyOf(sprite); body.updateFromGameObject(); body.prevFrame.copy(body.position); if(!sprite.getData('entering'))body.checkWorldBounds(); body.postUpdate();
    }
    catBounds(): void {
      const body = bodyOf(this.cat);
      // Preserve the local slice's original 36u boundary footprint independently
      // of display size. Arcade owns separation and the 12u contact circle.
      const orangeSlice=this.isSlice()&&session.runConfig.catId==='CAT01';
      const width=this.isSlice()?COMBAT_SLICE.boundarySize:this.cat.displayWidth,height=this.isSlice()?COMBAT_SLICE.boundarySize:this.cat.displayHeight;
      body.setBoundsRectangle(new Phaser.Geom.Rectangle(width / 2 - body.halfWidth,
        (courtyardPilot ? 0 : bounds.top) + height / 2 - body.halfHeight,
        (courtyardPilot ? COURTYARD.width : WORLD_WIDTH) - width + body.width, (courtyardPilot ? COURTYARD.height : bounds.bottom - bounds.top) - height + body.height));
    }
    applyBounds(): void {
      this.physics.world.setBounds(0, courtyardPilot ? 0 : bounds.top, courtyardPilot ? COURTYARD.width : WORLD_WIDTH, courtyardPilot ? COURTYARD.height : bounds.bottom - bounds.top); this.catBounds(); this.correctBounds(this.cat);
      for (const sprite of [...children(this.enemies), ...children(this.objects)]) if (active(sprite)) this.correctBounds(sprite);
      for (const shot of children(this.projectiles)) if (active(shot) && !Phaser.Geom.Rectangle.Contains(this.physics.world.bounds, bodyOf(shot).center.x, bodyOf(shot).center.y)) this.recycle(shot, this.projectiles);
      for(const shot of children(this.enemyProjectiles))if(active(shot)&&!Phaser.Geom.Rectangle.Contains(this.physics.world.bounds,bodyOf(shot).center.x,bodyOf(shot).center.y))this.recycle(shot,this.enemyProjectiles);
      if (courtyardPilot) this.configureCourtyardCamera();
      this.syncCatArt(false, true); this.guide.clear(); this.drawBackground();
    }
    spawnCourtyardEnemy(enemyId: EnemyId = 'E01',reinforcement=false): boolean {
      if(this.isSlice()){
        if(enemyId==='E02')return false;
        const stage=spawnStageAt(session.elapsed,this.isOpening()),cap=stage?.cap??0;
        const ordinary=children(this.enemies).filter(e=>e.active&&!['EL01','B01'].includes(e.getData('enemyId'))).length;
        const typeCap=stage?.typeCaps[enemyId as 'E01'|'E03'|'E04']??0;
        if(ordinary>=cap||children(this.enemies).filter(e=>e.active&&e.getData('enemyId')===enemyId).length>=typeCap)return false;
      }
      const view = this.backgroundCamera!.worldView, gap = COURTYARD.spawnGap;
      const perimeter = new Phaser.Geom.Rectangle(-gap, -gap, COURTYARD.width + gap * 2, COURTYARD.height + gap * 2);
      const opening=this.isOpening()&&!this.firstEncounter&&!reinforcement&&inOpeningSpawnWindow(session.elapsed);
      const player=centerOf(this.cat),start=Phaser.Math.FloatBetween(0,1);
      // Native perimeter lines supply the true courtyard sides; native nearest
      // points preserve the initial player's Y. Stable ties choose the left.
      const left=Phaser.Geom.Line.GetNearestPoint(perimeter.getLineD(),player),right=Phaser.Geom.Line.GetNearestPoint(perimeter.getLineB(),player);
      const candidates=opening?[player.x<=COURTYARD.width/2?left:right]:Array.from({length:8},(_,index)=>perimeter.getPoint((start+index/8)%1));
      const point = chooseCourtyardSpawn(candidates, view, player);
      if(!point)return false;
      const born=this.isSlice()?this.placeSliceEnemy(enemyId,point.x,point.y):this.place(this.enemies,point.x,point.y/COURTYARD.height,'enemy');
      if(born&&opening){born.setData({openingEncounter:true,openingEligible:false});this.firstEncounter={id:born.getData('id'),enemyId:'E01',bornAt:session.elapsed,birth:{x:point.x,y:point.y},side:point.x<0?'left':'right',fullVisibleAt:null,fullVisibleBounds:null,firstPrimaryShotAt:null,firstSpiritShotAt:null,firstHitAt:null,defeatedAt:null,eligible:false,artBounds:null};}
      if(born&&this.isSlice())this.spawns.recordBirth(session.elapsed,reinforcement);return !!born;
    }
    placeSliceEnemy(id:EnemyId,x:number,y:number):Sprite|null {
      const spec=ENEMIES[id],enemy=this.enemies.get(x,y,'atlas','enemy-0') as Sprite|null;
      if(!enemy)return null;
      const art=(enemy.getData('art') as EnemyPresentation|undefined)??new EnemyPresentation(this);
      this.cancelLife(enemy);enemy.data?.reset();enemy.stop().setTexture('atlas',spec.frame).setDisplaySize(spec.size,spec.size).setAlpha(1).setAngle(0).setFlip(false,false);
      circleBody(enemy,spec.radius);enemy.enableBody(true,x,y,true,false);resetBody(enemy,x,y);
      const entering=courtyardPilot&&!Phaser.Geom.Rectangle.Contains(this.physics.world.bounds,x,y);
      enemy.setCollideWorldBounds(!entering);
      enemy.setData({id:this.nextMob++,kind:'enemy',enemyId:id,hp:__DEVTOOLS__?spec.hp*session.devtools!.settings.hp:spec.hp,chill:newChillState(),behavior:newEnemyState(id,session.elapsed),orbitHitAt:-Infinity,art,entering});
      if(__DEVTOOLS__)enemy.setData('devtoolsMaxHP',enemy.getData('hp'));
      art.reset(id,spec.size);art.sync(x,y,enemy.getData('behavior'),0,session.elapsed);
      if(this.activeG6&&f1Art)this.impact?.prepare(art.objects());
      this.correctBounds(enemy);return enemy;
    }
    readableAttack(enemy:Sprite,aim:Point,length=121):boolean {
      const p=centerOf(enemy),r=bodyOf(enemy).halfWidth+bodyOf(this.cat).halfWidth,view=this.cameras.main.worldView;
      const end={x:p.x+aim.x*length,y:p.y+aim.y*length};
      const risk=new Phaser.Geom.Rectangle(Math.min(p.x,end.x)-r,Math.min(p.y,end.y)-r,Math.abs(end.x-p.x)+r*2,Math.abs(end.y-p.y)+r*2);
      const startRadius=Math.max(r,enemy.displayWidth/2);
      // The whole starting body/risk cap must be readable. Camera clips the
      // visible danger segment; the true world-length band is never shortened.
      return Phaser.Geom.Rectangle.ContainsRect(view,new Phaser.Geom.Rectangle(p.x-startRadius,p.y-startRadius,startRadius*2,startRadius*2))&&Phaser.Geom.Intersects.RectangleToRectangle(view,risk);
    }
    readableScatter(enemy:Sprite):boolean {
      const p=centerOf(enemy),r=ENEMIES.B01.size/2;
      return Phaser.Geom.Rectangle.ContainsRect(this.cameras.main.worldView,new Phaser.Geom.Rectangle(p.x-r,p.y-r,r*2,r*2));
    }
    readableFlower(enemy:Sprite):boolean {
      const p=(enemy.getData('art') as EnemyPresentation).mouthPoint()!;
      // Main Camera viewport already excludes the actual HUD/platform bands.
      return Phaser.Geom.Rectangle.ContainsRect(this.cameras.main.worldView,new Phaser.Geom.Rectangle(p.x-9,p.y-9,18,18));
    }
    readableSlam(enemy:Sprite):boolean {
      const p=centerOf(enemy),r=ENEMIES.B01.slamRadius+bodyOf(this.cat).halfWidth;
      return Phaser.Geom.Rectangle.ContainsRect(this.cameras.main.worldView,new Phaser.Geom.Rectangle(p.x-r,p.y-r,r*2,r*2));
    }
    cancelSpecialRetry():void {if(this.specialRetry){this.time.removeEvent(this.specialRetry);this.specialRetry.destroy();this.specialRetry=null;}}
    trySpecialSpawn():void {
      if(!this.isSlice()||session.result||session.isPaused)return;
      const id=this.level.pending(session.elapsed);if(!id)return;
      const view=this.backgroundCamera!.worldView,gap=Math.max(COURTYARD.spawnGap,ENEMIES[id].size);
      const perimeter=new Phaser.Geom.Rectangle(-gap,-gap,COURTYARD.width+gap*2,COURTYARD.height+gap*2);
      const start=Phaser.Math.FloatBetween(0,1);
      const candidates=Array.from({length:8},(_,i)=>perimeter.getPoint((start+i/8)%1));
      const point=chooseCourtyardSpawn(candidates,view,centerOf(this.cat),{gap,minDistance:240});
      if(point&&this.enterSpecial(id,point))return;
      this.specialRetry=this.time.delayedCall(1000,()=>{this.specialRetry=null;this.trySpecialSpawn();});
    }
    enterSpecial(id:SpecialId,point:Point):Sprite|null {
      const encounter=this.level.next(session.elapsed);if(encounter?.enemyId!==id)return null;
      if(children(this.enemies).filter(e=>e.active&&e.getData('enemyId')===id).length>=ENEMIES[id].maxCount)return null;
      const enemy=this.placeSliceEnemy(id,point.x,point.y);if(!enemy)return null;
      if(!this.level.markSpawned(id,session.elapsed,enemy.getData('id'))){this.recycle(enemy,this.enemies);return null;}
      enemy.setData('encounterId',encounter.encounterId);
      this.reinforcements.begin(id,session.elapsed,encounter.encounterId,enemy.getData('id'));
      const state=enemy.getData('behavior') as EnemyState;state.phase='arriving';state.until=session.elapsed+COURTYARD_LEVEL.arrival;
      bodyOf(enemy).enable=false;(enemy.getData('art') as EnemyPresentation).sync(point.x,point.y,state,0,session.elapsed);
      if(id==='B01')audio?.setBossActive(true);
      const timer=this.time.delayedCall(COURTYARD_LEVEL.arrival*1000,()=>{
        if(enemy.getData('lifeTimer')!==timer||!enemy.active)return;
        enemy.setData('lifeTimer',null);Object.assign(state,newEnemyState(id,session.elapsed));bodyOf(enemy).enable=true;resetBody(enemy,point.x,point.y);
      });enemy.setData('lifeTimer',timer);return enemy;
    }
    arrivalName():string|null {
      const enemy=children(this.enemies).find(e=>e.active&&e.getData('behavior')?.phase==='arriving');
      return enemy?(enemy.getData('enemyId')==='B01'?'雾壳巨兽入场':'雾壳队长入场'):null;
    }
    bossSnapshot():BattleSnapshot['boss'] {
      const enemy=children(this.enemies).find(e=>e.active&&e.getData('enemyId')==='B01'&&e.getData('hp')>0);if(!enemy)return null;
      const state=enemy.getData('behavior') as EnemyState;
      return {id:enemy.getData('id'),hp:enemy.getData('hp'),maxHp:__DEVTOOLS__?enemy.getData('devtoolsMaxHP'):ENEMIES.B01.hp,enraged:state.enraged,phase:state.phase};
    }
    clearSlamImpact():void {
      this.bossEffects?.clear();if(!this.slamImpact)return;this.tweens?.killTweensOf(this.slamImpact);this.slamImpact.clear().setAlpha(0).setScale(1);
    }
    clearBossDashEffects():void {
      this.bossEffects?.clear();this.bossDashTrail?.clear();
      if(!this.bossDashImpact)return;this.tweens?.killTweensOf(this.bossDashImpact);this.bossDashImpact.clear().setAlpha(0).setScale(1);
    }
    showBossDashImpact(enemy:Sprite):void {
      const p=centerOf(enemy),state=enemy.getData('behavior') as EnemyState,art=enemy.getData('art') as EnemyPresentation;
      art.sync(p.x,p.y,state,0,session.elapsed);const anchors=art.bossAnchors();if(anchors)this.bossEffects?.stop(anchors,state.direction);
    }
    resolveSlam(enemy:Sprite):void {
      const p=centerOf(enemy),r=ENEMIES.B01.slamRadius;
      if(this.physics.overlapCirc(p.x,p.y,r,true,false).some(body=>body===bodyOf(this.cat)))this.applyCourtyardEnemyHit(ENEMIES.B01.slamDamage,'B01_SLAM');
      const art=enemy.getData('art') as EnemyPresentation;art.sync(p.x,p.y,enemy.getData('behavior'),0,session.elapsed);
      art.landSlam();const anchors=art.bossAnchors();if(anchors)this.bossEffects?.slam(anchors);
    }
    clearBubbleImpact():void {
      if(!this.bubbleImpact)return;
      this.tweens?.killTweensOf(this.bubbleImpact);this.bubbleImpact.clear().setAlpha(0);
    }
    emitBubble(enemy:Sprite):Sprite|null {
      const origin=(enemy.getData('art') as EnemyPresentation).mouthPoint()!;
      return this.enemyBubble(origin,(enemy.getData('behavior') as EnemyState).direction,ENEMY_BUBBLE);
    }
    emitBossScatter(enemy:Sprite,round:number):void {
      const state=enemy.getData('behavior') as EnemyState,origin=centerOf(enemy);
      const angle=Phaser.Math.Angle.Between(0,0,state.direction.x,state.direction.y);
      for(const offset of BOSS_SCATTER.angles){
        const direction=new Phaser.Math.Vector2(1,0).rotate(angle+(offset+(round-1)*BOSS_SCATTER.secondOffset)*Math.PI/180);
        this.enemyBubble(origin,direction,BOSS_SCATTER,enemy);
      }
    }
    enemyBubble(origin:Point,direction:Point,spec:{size:number;radius:number;speed:number;life:number|null;damage:number},owner?:Sprite):Sprite|null {
      const shot=this.bossProjectileSlots.get(origin.x,origin.y,owner);
      if(!shot)return null;
      this.cancelLife(shot);shot.data?.reset();shot.stop().setTexture('enemy-bubble').setDisplaySize(spec.size,spec.size).setDepth(4).setAlpha(1).setRotation(0).setFlip(false,false).clearTint();
      if(owner)shot.setTint(0xe4a0b7);
      circleBody(shot,spec.radius);shot.enableBody(true,origin.x,origin.y,true,true);resetBody(shot,origin.x,origin.y);
      shot.setData({id:this.nextProjectile++,kind:'enemyProjectile',origin:{...origin},damage:spec.damage,lifeTimer:null,source:owner?'B01':'E04',lifeMode:spec.life===null?'world-boundary':'timed'});
      shot.setVelocity(direction.x*spec.speed,direction.y*spec.speed);
      if(spec.life===null)return shot;
      const timer=this.time.delayedCall(spec.life*1000,()=>{
        if(shot.getData('lifeTimer')!==timer)return;
        shot.setData('lifeTimer',null);this.recycle(shot,this.enemyProjectiles);
      });shot.setData('lifeTimer',timer);return shot;
    }
    cancelBossReservations():void {
      this.scatterCore?.clear();
      for(const enemy of children(this.enemies))this.bossProjectileSlots.release(enemy);
    }
    resolveBubbles():void {
      const cat=bodyOf(this.cat);
      for(const shot of children(this.enemyProjectiles))if(active(shot)){
        const body=bodyOf(shot);
        const path=new Phaser.Geom.Line(body.prev.x+body.halfWidth-cat.prev.x-cat.halfWidth,body.prev.y+body.halfHeight-cat.prev.y-cat.halfHeight,body.center.x-cat.center.x,body.center.y-cat.center.y);
        if(Phaser.Geom.Intersects.LineToCircle(path,new Phaser.Geom.Circle(0,0,body.halfWidth+cat.halfWidth))){
          this.applyCourtyardEnemyHit(shot.getData('damage'),shot.getData('source')==='B01'?'B01_PROJECTILE':'E04_PROJECTILE');
          this.clearBubbleImpact();this.bubbleImpact.setPosition(body.center.x,body.center.y).setAlpha(1).lineStyle(1.5,0xb681bc,.9).strokeCircle(0,0,7);
          this.tweens.add({targets:this.bubbleImpact,alpha:0,duration:150});this.recycle(shot,this.enemyProjectiles);
        }else if(!Phaser.Geom.Rectangle.Contains(this.physics.world.bounds,body.center.x,body.center.y))this.recycle(shot,this.enemyProjectiles);
      }
    }
    syncEnemyArt():void {
      this.warning.clear();this.scatterCore.clear();this.bossDashTrail.clear();
      for(const enemy of children(this.enemies))if(enemy.active&&enemy.getData('enemyId')){
        const p=centerOf(enemy),state=enemy.getData('behavior') as EnemyState;
        const art=enemy.getData('art') as EnemyPresentation;art.sync(p.x,p.y,state,bodyOf(enemy).velocity.x,session.elapsed);
        const impactPose=enemy.getData('impactPose');if(impactPose)art.showImpactOffset(impactPose.x);
        if(enemy.getData('enemyId')==='B01'){
          this.bossEffects?.configure(quality==='low',f1Art);const anchors=art.bossAnchors();if(anchors)this.bossEffects?.sync(enemy.getData('id'),anchors,state);
        }
        if(state.phase==='arriving')this.warning.lineStyle(2,0xb587a1,.75).strokeCircle(p.x,p.y,ENEMIES[enemy.getData('enemyId') as EnemyId].size/2+5);
        if(state.phase==='slam-warning'){
          this.warning.fillStyle(0xbf8e9e,.1).fillCircle(p.x,p.y,ENEMIES.B01.slamRadius).lineStyle(1.5,0xa16b81,.9).strokeCircle(p.x,p.y,ENEMIES.B01.slamRadius).lineStyle(1,0xa16b81,.65).strokeCircle(p.x,p.y,ENEMIES.B01.slamRadius+bodyOf(this.cat).halfWidth);
        }
        if(state.phase==='scatter-warning'||state.phase==='scatter-wait'){
          const angle=Phaser.Math.Angle.Between(0,0,state.direction.x,state.direction.y),reach=Phaser.Math.Distance.BetweenPoints({x:0,y:0},{x:this.physics.world.bounds.width,y:this.physics.world.bounds.height});
          for(let round=state.scatterRound;round<state.scatterRounds;round++){
            const angles=BOSS_SCATTER.angles;
            const first=angle+(angles[0]+round*BOSS_SCATTER.secondOffset)*Math.PI/180,last=angle+(angles[angles.length-1]+round*BOSS_SCATTER.secondOffset)*Math.PI/180;
            this.warning.fillStyle(0xb45783,.06).beginPath().moveTo(p.x,p.y).arc(p.x,p.y,reach,first,last,false).closePath().fillPath();
            this.warning.lineStyle(1.5,0x9d486c,.8).lineBetween(p.x,p.y,p.x+Math.cos(first)*reach,p.y+Math.sin(first)*reach).lineBetween(p.x,p.y,p.x+Math.cos(last)*reach,p.y+Math.sin(last)*reach);
            for(const offset of BOSS_SCATTER.angles){const ray=angle+(offset+round*BOSS_SCATTER.secondOffset)*Math.PI/180;this.warning.lineStyle(1,0x9d486c,.45).lineBetween(p.x+Math.cos(ray)*38,p.y+Math.sin(ray)*38,p.x+Math.cos(ray)*70,p.y+Math.sin(ray)*70);}
          }
          const progress=state.phase==='scatter-warning'?Phaser.Math.Clamp(1-(state.until-session.elapsed)/BOSS_SCATTER.warningSeconds,0,1):1;
          const core=art.bossAnchors()?.core;
          if(core)this.scatterCore.fillStyle(0xf5acd9,.25+progress*.5).fillPoints(core,true).lineStyle(1.5,0xffe2f3,.85).strokePoints(core,true);
          for(let n=0;n<state.scatterRounds;n++)this.scatterCore.fillStyle(0xa94f80,n<state.scatterRound?.3:1).fillCircle(p.x+(n-(state.scatterRounds-1)/2)*13,p.y-30,4).lineStyle(1,0xffe2f3,.95).strokeCircle(p.x+(n-(state.scatterRounds-1)/2)*13,p.y-30,4);
        }
        if(state.phase==='warning'&&enemy.getData('enemyId')==='E04'){
          const mouth=art.mouthPoint()!;
          this.warning.lineStyle(1.5,0x95639e,.9).strokeCircle(mouth.x,mouth.y,9).lineBetween(mouth.x,mouth.y,mouth.x+state.direction.x*18,mouth.y+state.direction.y*18);
        }
        if(state.phase==='warning'&&['E02','EL01','B01'].includes(enemy.getData('enemyId'))){
          const id=enemy.getData('enemyId') as 'E02'|SpecialId;
          const length=id==='E02'?121:ENEMIES[id].dashSpeed*ENEMIES[id].dashSeconds,r=bodyOf(enemy).halfWidth+bodyOf(this.cat).halfWidth;
          const angle=Phaser.Math.Angle.Between(0,0,state.direction.x,state.direction.y),ux=Math.cos(angle),uy=Math.sin(angle);
          // Native Geom/Graphics only: risk capsule includes both round ends.
          this.warning.lineStyle(r*2,0xa76579,.22).lineBetween(p.x,p.y,p.x+ux*length,p.y+uy*length);
          this.warning.fillStyle(0xa76579,.22).fillCircle(p.x,p.y,r).fillCircle(p.x+ux*length,p.y+uy*length,r);
          this.warning.lineStyle(1.5,0x8f4d62,.9).lineBetween(p.x,p.y,p.x+ux*length,p.y+uy*length);
          this.warning.lineStyle(1.5,0x8f4d62,.9).strokeCircle(p.x+ux*length,p.y+uy*length,r);
        }
      }
    }
    hit(shot: Sprite, target: Sprite, path: 'overlap' | 'sweep', now = session.elapsed,impact?:Point): boolean {
      // Capture immutable visual data before resolveHit can recycle this shot.
      const velocity = bodyOf(shot).velocity, to = centerOf(target), radius = bodyOf(target).halfWidth;
      const length = Math.hypot(velocity.x, velocity.y);
      const contact = length > .001 ? { x: to.x - velocity.x / length * radius, y: to.y - velocity.y / length * radius } : to;
      const returning=shot.getData('flightPhase')==='return',canReturn=!!shot.getData('returnEnabled')&&!returning;
      const volley=shot.getData('bellVolley') as BellVolley|undefined,shock=!!shot.getData('shockEnabled'),bounce=!returning&&!!shot.getData('ricochetEnabled')&&!shot.getData('ricocheted');
      const primaryMultiplier=shot.getData('primaryMultiplier')??1;
      const result = Hits.resolveHit(shot,target,(projectile:Sprite)=>this.recycle(projectile,this.projectiles),{deferTerminal:bounce||canReturn,primaryTargetMultiplier:this.hunt?.multiplier(target.getData('id'),shot.getData('source'),target.getData('kind'))??1});
      if(!result)return false;
      if(returning)this.flightReturnHits++;
      this.applyHitResult(target,result,path,now,to,contact);
      if(!result.killed&&result.targetKind==='enemy'&&result.actualDamage>0){
        if(result.source===Hits.SUMMON&&result.effect!=='SENTRY'&&this.passives.markSpiritHit(now,result.targetId,result.damage))this.spiritMarkStats.applied++;
        if(result.source===Hits.PRIMARY){
          const bonus=this.passives.consumeSpiritMark(now,result.targetId);
          if(bonus>0){
            this.spiritMarkStats.detonated++;
            this.spiritMarkStats.damage+=this.abilityHit(target,bonus,'SPIRIT_MARK',0,Hits.SUMMON);
            this.activeG6?.rewards.flashSpiritMark(contact);
          }
        }
      }
      if(shock&&result.source===Hits.PRIMARY&&result.targetKind==='enemy'&&volley&&this.bells.shock(volley))this.shock({...result,damage:result.damage/primaryMultiplier});
      if(bounce&&result.exhausted&&active(shot)){
        const incoming=Math.atan2(velocity.y,velocity.x);
        const origin=impact??centerOf(shot),hitIds=shot.getData('hitIds') as Set<number>;
        const next=this.nearbyEnemies(origin,N.ricochetRange).find(enemy=>!hitIds.has(enemy.getData('id')));
        if(!next){if(canReturn)return this.beginReturn(shot,origin);this.recycle(shot,this.projectiles);return false;}
        const aim=centerOf(next),speed=bodyOf(shot).velocity.length();
        const angle=Phaser.Math.Angle.Between(origin.x,origin.y,aim.x,aim.y);
        resetBody(shot,origin.x,origin.y);
        shot.setData('ricocheted',true);shot.setData('ricochetDamage',result.nonCriticalDamage*N.ricochetDamage);shot.setRotation(angle);
        this.physics.velocityFromRotation(angle,speed,bodyOf(shot).velocity);
        bodyOf(shot).prev.copy(bodyOf(shot).position);bodyOf(shot).prevFrame.copy(bodyOf(shot).position);this.bells.bounced();
        this.flightVisual?.ricochet({point:origin,angle,projectileId:shot.getData('projectileId')},incoming);
        return true;
      }
      if(canReturn&&result.exhausted&&active(shot))return this.beginReturn(shot,impact??centerOf(shot));
      return false;
    }
    beginReturn(shot:Sprite,turnPoint=centerOf(shot)):boolean {
      if(!Hits.beginReturn(shot,N.returnDamage))return false;
      this.cancelFlightTimer(shot);this.flightReturns++;
      const origin=shot.getData('flightOrigin') as Point;
      // Direction changes now run after Arcade sweep arbitration, outside
      // Clock dispatch, so a near-origin impact can retire immediately.
      if(Phaser.Math.Distance.BetweenPoints(turnPoint,origin)<=N.returnOriginRadius){resetBody(shot,turnPoint.x,turnPoint.y);this.recycle(shot,this.projectiles);return true;}
      const angle=Phaser.Math.Angle.Between(turnPoint.x,turnPoint.y,origin.x,origin.y);
      resetBody(shot,turnPoint.x,turnPoint.y);shot.setRotation(angle);
      this.physics.velocityFromRotation(angle,shot.getData('flightSpeed'),bodyOf(shot).velocity);
      this.flightVisual?.returned({point:turnPoint,angle,projectileId:shot.getData('projectileId')},!!shot.getData('mirrorReturn'));
      return true;
    }
    applyHitResult(target:Sprite,result:any,path:'overlap'|'sweep'|'area',now:number,to:Point,contact:Point):void {
      if(result.targetId!==target.getData('id')||target.getData('deathResolved'))return;
      if(result.damage>0&&!result.killed&&this.impact){
        const art=target.getData('art') as EnemyPresentation|undefined;
        const started=this.impact.targetHit(result.targetId,art?art.objects():[target],result.critical===true);
        if(started&&quality==='standard'&&!impactMotion?.matches){
          let pose=target.getData('impactPose');if(!pose){pose={x:0};target.setData('impactPose',pose);}
          this.tweens.killTweensOf(pose);pose.x=1;
          this.tweens.add({targets:pose,x:0,duration:80,ease:'Quad.easeOut'});
        }
      }
      if(result.source===Hits.PRIMARY&&result.targetKind==='enemy'&&result.damage>0)summaries.primaryHit(now);
      const first=this.firstEncounter;if(first&&first.id===result.targetId){if(first.firstHitAt===null)first.firstHitAt=now;if(result.killed)first.defeatedAt=now;}
      const recovered=session.recordSustainHit(result);
      this.activeG6?.rewards.heal(recovered,contact);
      if(result.source===Hits.SUMMON){
        const diagnostic=result.effect==='SENTRY'?this.companionDiagnostics.sentry:this.companionDiagnostics.spirit;
        diagnostic.actualDamage+=result.actualDamage;
        if(result.effect!=='SPIRIT_MARK'){
          diagnostic.hits++;
          diagnostic.lastHit={at:now,targetId:result.targetId,projectileId:result.projectileId,damage:result.damage,actualDamage:result.actualDamage};
        }
      }
      this.hunt?.recordHit(result.damage,result.targetMultiplier??1);
      if(result.damage>0)sound({type:'hit',at:now,critical:result.critical===true,targetId:result.targetId,killed:result.killed===true,targetKind:result.targetKind});
      if(result.critical===true)this.criticalHits++;
      this.feedback?.damage(to, result.damage, false, centerOf(this.cat),result.critical===true);
      this.feedback?.hit(contact,{source:result.source,weaponId:session.runConfig.weaponId,critical:result.critical===true});
      if(path==='overlap')this.overlapHits++;else if(path==='sweep')this.sweepHits++;
      if (result.targetKind === 'object') this.objectsHit++;
      if (this.passives.onHit(result)) {
        const recipient = chillTarget(result, this.targets(), session.runConfig.chill);
        const enemy = recipient && children(this.enemies).find(sprite => active(sprite) && sprite.getData('id') === recipient.id);
        if (enemy) applyChill(this.chillOf(enemy), now, session.runConfig.chill);
      }
      if (result.killed) {
        if(target.getData('deathResolved'))return;target.setData('deathResolved',true);
        if(result.targetKind==='enemy'){
          this.passives.clearSpiritMark(result.targetId);
          const from=centerOf(target),next=this.hunt?.died(target.getData('id'),from);
          if(next)this.activeG6?.huntContracts.transfer(from,{x:next.x,y:next.y});
        }
        if(this.isSlice()&&result.targetKind==='enemy')this.pickups?.drop(target.getData('id'),target.getData('enemyId'),centerOf(target));
        const id=target.getData('enemyId');if(id==='B01'){audio?.pause('boss-defeated');audio?.setBossActive(false);}
        if(this.isSlice()&&(id==='EL01'||id==='B01')){
          const encounterId=target.getData('encounterId'),birthId=target.getData('id');
          if(encounterId&&this.level.defeated(id,session.elapsed,encounterId,birthId)){
            if(id==='EL01'&&!session.result&&session.hp>0)this.growth?.queueElite(encounterId,birthId);
          }else if(!encounterId)this.level.defeated(id,session.elapsed);
        }
        this.feedback?.defeat(target); this.recycle(target, result.targetKind === 'enemy' ? this.enemies : this.objects); if (result.targetKind === 'enemy') this.kills++;
      }
    }
    abilityHit(enemy:Sprite,damage:number,effect:string,castId=0,hitSource='AREA'):number {
      if(!active(enemy)||enemy.getData('hp')<=0||enemy.getData('deathResolved'))return 0;const position=centerOf(enemy),actual=Math.min(damage,enemy.getData('hp'));
      const source=this.abilitySources[effect]??={hits:0,damage:0};source.hits++;source.damage+=actual;
      enemy.setData('hp',Math.max(0,enemy.getData('hp')-damage));
      this.applyHitResult(enemy,{source:hitSource,effect,castId,volleyId:0,projectileId:0,targetId:enemy.getData('id'),targetKind:'enemy',damage,actualDamage:actual,killed:enemy.getData('hp')<=0,firstEnemyHit:false,position},'area',session.elapsed,position,position);
      return actual;
    }
    nearbyEnemies(origin:Point,radius:number):Sprite[] {
      const circle=new Phaser.Geom.Circle(origin.x,origin.y,radius);
      return this.physics.overlapCirc(origin.x,origin.y,radius,true,false).map(body=>body.gameObject as Sprite)
       .filter(enemy=>enemy?.getData('kind')==='enemy'&&active(enemy)&&enemy.getData('hp')>0&&Phaser.Geom.Circle.Contains(circle,bodyOf(enemy).center.x,bodyOf(enemy).center.y))
       .sort((a,b)=>Phaser.Math.Distance.BetweenPointsSquared(origin,centerOf(a))-Phaser.Math.Distance.BetweenPointsSquared(origin,centerOf(b))||a.getData('id')-b.getData('id'));
    }
    shock(hit:any):void {
      const radius=abilityGeometry(session.runConfig,this.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0}).shockRadius;
      // Cosmetic reuse may replace the previous ring; damage has no pool gate.
      if(this.activeG6)this.activeG6.areas.showShock(hit.position,radius);
      else {
        this.tweens.killTweensOf(this.shockEffect);this.shockEffect.clear().setAlpha(1).lineStyle(1.5,0xe9ce79,.65).strokeCircle(hit.position.x,hit.position.y,radius);
        this.tweens.add({targets:this.shockEffect,alpha:0,duration:180,onComplete:()=>this.shockEffect.clear()});
      }
      for(const enemy of this.nearbyEnemies(hit.position,radius).filter(e=>e.getData('id')!==hit.targetId).slice(0,N.shockTargets)){
        const damage=hit.damage*N.shockDamage,position=centerOf(enemy);enemy.setData('hp',Math.max(0,enemy.getData('hp')-damage));
        this.applyHitResult(enemy,{source:'AREA',volleyId:hit.volleyId,projectileId:hit.projectileId,targetId:enemy.getData('id'),targetKind:'enemy',damage,killed:enemy.getData('hp')<=0,firstEnemyHit:false,position},'area',session.elapsed,position,position);
      }
    }
    resolveProjectile(shot:Sprite,targetTravel:number,now=session.elapsed,deltaMs=0):void {
      const life=shot.getData('lifeTimer') as PhaserType.Time.TimerEvent|null,out=shot.getData('flightTimer') as PhaserType.Time.TimerEvent|null;
      // Snapshot native elapsed before any hit can return early or recycle.
      if(life)shot.setData('flightLifeElapsed',life.elapsed);if(out)shot.setData('flightOutElapsed',out.elapsed);
      const stop=Hits.returnStopFraction(shot,N.returnOriginRadius);
      const straightStop=Hits.secondaryRangeStopFraction(shot);
      if(stop===0||straightStop===0){this.recycle(shot,this.projectiles);return;}
      // Clock dispatch precedes our Arcade update. Clip this frame's native
      // sweep to a due event before changing direction or retiring a short
      // shot. Read TimerEvent elapsed values; no independent lifetime clock.
      const fraction=(key:string)=>deltaMs>0?Phaser.Math.Clamp(shot.getData(key)/deltaMs,0,1):1;
      const turn=shot.getData('flightTurnDue')&&shot.getData('flightPhase')==='outbound'?fraction('flightTurnRemaining'):null;
      const expiry=shot.getData('flightExpired')?fraction('flightLifeRemaining'):null;
      const end=Math.min(stop??1,straightStop??1,turn??1,expiry??1);
      if(expiry===0){this.recycle(shot,this.projectiles);return;}
      for(const candidate of Hits.hitCandidates(shot,this.physics,targetTravel)){
        if(candidate.fraction>end)break;
        const turned=this.hit(shot,candidate.target,candidate.path,now,candidate.position);
        if(turned||!active(shot)){
          // Ricochet has already consumed this native movement frame. If the
          // outbound Clock budget is due, do not lend it another outbound frame.
          if(turn!==null&&active(shot)&&shot.getData('flightPhase')==='outbound')this.beginReturn(shot);
          if(expiry!==null&&active(shot))this.recycle(shot,this.projectiles);return;
        }
      }
      if(expiry!==null&&expiry<=end){this.recycle(shot,this.projectiles);return;}
      if(turn!==null&&turn<=end){
        const body=bodyOf(shot),line=new Phaser.Geom.Line(body.prev.x+body.halfWidth,body.prev.y+body.halfHeight,body.center.x,body.center.y);
        this.beginReturn(shot,line.getPoint(turn));
        if(expiry!==null&&active(shot))this.recycle(shot,this.projectiles);
      }else if(stop!==null&&stop<=end){this.recycle(shot,this.projectiles);return;}
      else if(straightStop!==null&&straightStop<=end){this.recycle(shot,this.projectiles);return;}
    }
    clearBellEffects():void {if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__&&this.shockEffect){this.tweens.killTweensOf(this.shockEffect);this.shockEffect.clear();}}
    reloadBarSnapshot(){const p=centerOf(this.cat),visible=this.isSlice()&&running&&!session.result&&session.reloadLeft>0;
      return {visible,progress:visible?Phaser.Math.Clamp(1-session.reloadLeft/session.effectiveConfig.weapon.reloadSeconds,0,1):0,x:p.x-12,y:p.y-27,width:24,height:2};}
    drawReloadBar():void {if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__){this.reloadBar.clear();const bar=this.reloadBarSnapshot();if(bar.visible)this.reloadBar.fillStyle(0x5e6254,.35).fillRoundedRect(bar.x,bar.y,bar.width,bar.height,1).fillStyle(0xf5e7a8,.85).fillRoundedRect(bar.x,bar.y,bar.width*bar.progress,bar.height,1);}}
    fire(direction: FiredVolley): void {
      // This is the primary weapon emitter. Automatic actual volleys add the
      // cat passive through fireVolley; controlled collision fixtures may use
      // this emitter to isolate primary path arbitration.
      const player = centerOf(this.cat), config = session.effectiveConfig, weapon = config.weapon;
      const frame = config.weaponId === 'W04' ? 'fish' : config.weaponId === 'W02' ? 'bone' : 'bell';
      const aimAngle = Math.atan2(direction.y, direction.x);
      for (let index = 0; index < weapon.pellets; index++) {
        const spread = weapon.pellets === 1 ? 0 : -weapon.spreadDegrees / 2 + weapon.spreadDegrees * index / (weapon.pellets - 1);
        const angle = aimAngle + spread * Math.PI / 180;
        this.projectile(player, angle, frame, Hits.PRIMARY, direction.id, weapon.damage * config.directDamageMultiplier,
          weapon.extraPierce, weapon.bulletSpeed, weapon.bulletLifeSeconds,undefined,undefined,direction.primaryMultiplier);
      }
    }
    projectile(origin: Point, angle: number, frame: string, source: 'PRIMARY' | 'SECONDARY' | 'SUMMON', volleyId: number,
      damage: number, extraPierce: number, speed: number, life: number,effect?:BurstEffect,deploymentId?:number,primaryMultiplier=1): boolean {
      const shot = this.projectiles.get(origin.x, origin.y, 'atlas', frame) as Sprite | null;
      if (!shot) {this.failedProjectileSpawns++;return false;}
      this.cancelLife(shot); shot.data?.reset(); shot.stop();
      shot.setTexture('atlas', frame).setDisplaySize(18, 18).setDepth(4).setAlpha(1).setFlip(false, false).setRotation(0);
      circleBody(shot, 0);
      shot.enableBody(true, origin.x, origin.y, true, true); resetBody(shot, origin.x, origin.y);
      // Arcade reset uses the Game Object's top-left. Rotate the image after
      // resetting so its visual corner never displaces the physical origin.
      shot.setRotation(angle);
      const ranks=this.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
      const returns=source===Hits.PRIMARY&&!!session.runConfig.projectileFlight?.enabled&&!!ranks.M05;
      const mirror=returns&&!!ranks.E23&&!!ranks.L1_PIERCE;
      const traits=rollProjectileTraits(source,damage*primaryMultiplier,session.runConfig,ranks,()=>{
        this.projectileRolls++;return this.projectileRandom!.frac();
      });
      if(traits.critical)this.criticalRolls++;
      shot.setData({ id: this.nextProjectile, projectileId: this.nextProjectile++, volleyId, kind: 'projectile', source, damage:damage*primaryMultiplier, primaryMultiplier,extraPierce,effect,deploymentId,...traits,
        pierceDamageMultiplier: session.effectiveConfig.weapon.pierceDamageMultiplier,
        hitIds: new Set<number>(), returnHitIds:mirror?new Set<number>():null,mirrorReturn:mirror,returnAllowance:mirror?1+extraPierce:1,returnHitCount:0,hitCount: 0, firstEnemyCredited: false, lifeTimer: null,ricocheted:false,
        bellVolley:source===Hits.PRIMARY?this.bells.acquire(volleyId):null,
        shockEnabled:source===Hits.PRIMARY&&!!ranks.L1_SHOCK_BELL,
        ricochetEnabled:source===Hits.PRIMARY&&!!ranks.L1_RICOCHET,
        returnEnabled:returns,flightPhase:returns?'outbound':null,flightOrigin:{...origin},flightSpeed:speed,flightLife:life,flightTimer:null,
        flightOwned:!!session.runConfig.projectileFlight?.enabled,flightLifeElapsed:0,flightOutElapsed:0,flightExpired:false,flightTurnDue:false });
      this.sourceCounts[source]++;
      this.physics.velocityFromRotation(angle, speed, bodyOf(shot).velocity);
      const timer = this.time.delayedCall(life * (returns?N.returnLife:1) * 1000, () => {
        if (shot.getData('lifeTimer') !== timer) return;
        // Clock owns removal during dispatch; splicing its active list here
        // would skip the adjacent TimerEvent in this same Clock update.
        shot.setData('lifeTimer', null);
        if(session.runConfig.projectileFlight?.enabled){shot.setData('flightLifeRemaining',timer.delay-shot.getData('flightLifeElapsed'));shot.setData('flightExpired',true);}
        else this.recycle(shot, this.projectiles);
      }); shot.setData('lifeTimer', timer);
      if(returns){
        const range=session.effectiveConfig.weapon.targetRange;
        const outbound=this.time.delayedCall(range/speed*1000,()=>{
          if(shot.getData('flightTimer')!==outbound)return;
          shot.setData('flightTimer',null);shot.setData('flightTurnRemaining',outbound.delay-shot.getData('flightOutElapsed'));shot.setData('flightTurnDue',true);
        });shot.setData('flightTimer',outbound);
      }
      if(source===Hits.SUMMON){const diagnostic=effect==='SENTRY'?this.companionDiagnostics.sentry:this.companionDiagnostics.spirit;diagnostic.emitted++;diagnostic.lastShot={at:session.elapsed,projectileId:shot.getData('projectileId'),deploymentId:deploymentId??null,origin:{x:origin.x,y:origin.y},angle,damage};}
      return true;
    }
    clearRhythm():void {
      this.rhythmGeneration++;
      for(const timer of this.rhythmTimers){this.time.removeEvent(timer);timer.destroy();}
      this.rhythmTimers.clear();this.rhythmEmitted=0;this.bursts.clearRhythm();
    }
    queueRhythm(intent:RhythmIntent,direction:Point & {id:number}):void {
      const generation=this.rhythmGeneration,originalAngle=Math.atan2(direction.y,direction.x);
      const later=(seconds:number,callback:()=>void)=>{
        const timer=this.time.delayedCall(seconds*1000,()=>{
          this.rhythmTimers.delete(timer);
          if(disposed||!running||session.result||generation!==this.rhythmGeneration)return;
          callback();
        });this.rhythmTimers.add(timer);
      };
      later(intent.delay,()=>{
        const player=centerOf(this.cat),target=intent.retarget?chooseTarget(player,this.targets().filter(t=>t.kind==='enemy'),null,intent.range):null;
        if(intent.retarget&&!target)return;
        const angle=target?Phaser.Math.Angle.Between(player.x,player.y,target.x,target.y):originalAngle;
        for(const [index,segment] of intent.segments.entries()){
          const fire=()=>{
            const point=centerOf(this.cat),shotAngle=angle+segment.angle*Math.PI/180;
            if(!this.projectile(point,shotAngle,'bell',Hits.SECONDARY,direction.id,segment.damage,0,intent.speed,intent.life,'RHYTHM'))return;
            this.rhythmEmitted++;
            this.flightVisual?.rhythm({point,angle:shotAngle,volleyId:direction.id,step:index+1,steps:intent.segments.length,retarget:intent.retarget});
          };
          if(segment.offset===0)fire();else later(segment.offset,fire);
        }
      });
    }
    fireVolley(direction: FiredVolley): void {
      const before=this.sourceCounts.PRIMARY,angle=Math.atan2(direction.y,direction.x);
      this.fire(direction);
      if(this.activeG6&&cat01Art&&session.runConfig.catId==='CAT01')this.activeG6.cat.fire();
      else this.catArt?.fire();
      this.heldArt?.fire();
      const config = session.effectiveConfig, weapon = config.weapon;
      const opening=this.passives.onVolley(direction.id,session.reloadCompletions);
      const ranks=this.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
      if(this.isSlice()&&this.abilities?.state.onVolley(direction.id,!!ranks.L1_PICKUP_CHIME))this.projectile(centerOf(this.cat),Math.atan2(direction.y,direction.x),'bell',Hits.SECONDARY,direction.id,abilityDamage(session.runConfig,ranks,session.movementContext())*N.chimeDamage,0,weapon.bulletSpeed,weapon.bulletLifeSeconds,'PICKUP_CHIME');
      const point=centerOf(this.cat);
      const tailBefore=this.flightVisual?this.bursts.snapshot().tailBursts:0;
      const burstShots=this.bursts.onVolley(config,ranks,{id:direction.id,ammo:session.ammo,reloads:session.reloadCompletions,opening});
      const burst=this.flightVisual&&burstShots.length?this.bursts.snapshot():null;
      for(const shot of burstShots){
        const shotAngle=angle+shot.angle*Math.PI/180;
        const emitted=this.projectile(point,shotAngle,'bell',Hits.SECONDARY,direction.id,shot.damage,0,weapon.bulletSpeed,weapon.bulletLifeSeconds,shot.effect);
        if(emitted&&this.flightVisual&&burst){
          const mark={point,angle:shotAngle,volleyId:direction.id};
          if(shot.effect==='TAIL_ECHO')this.flightVisual.echo(mark);
          if(shot.effect==='OPENING_BURST')this.flightVisual.opening({...mark,step:N.cadenceVolleys-burst.cadenceRemaining});
        }
      }
      if(this.sourceCounts.PRIMARY>before){
        if(burst&&burst.tailBursts>tailBefore)this.flightVisual?.tail({point,angle,volleyId:direction.id});
        if(ranks.R05)this.activeG6?.huntContracts.weaponVolley(point,direction);
      }
      const rhythm=this.bursts.onRhythmVolley(config,ranks,{id:direction.id});if(rhythm)this.queueRhythm(rhythm,direction);
    }
    update(time: number, delta: number): void {
      if (!this.acceptsInput()) return;
      let mx = Number(this.keys.D.isDown) - Number(this.keys.A.isDown), my = Number(this.keys.S.isDown) - Number(this.keys.W.isDown);
      if (this.sticks.owner) { const move = this.sticks.movementVector(); mx = move.x; my = move.y; }
      const length = Math.hypot(mx, my); if (length > 1) { mx /= length; my /= length; }
      const config = session.effectiveConfig;
      this.cat.setVelocity(mx * config.moveSpeed, my * config.moveSpeed).setFlipX(mx < -.1);
      const dt = delta / 1000;
      if(session.runConfig.defenseCompanions?.enabled)this.passives.setSpiritFrequency(companionFrequency(this.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0}),session.elapsed);
      // Advance the single effective clock before contact/hit rules. Survival
      // waits until those rules finish, so same-frame death retains priority.
      const frameFromElapsed=session.elapsed;
      session.advance(dt);
      const passiveNow = session.elapsed;
      this.syncHunt();
      const oldSpawn=this.cadence.step(dt, session);
      if(this.isSlice()){const id=this.spawns.take(session.elapsed);if(id){if(__DEVTOOLS__){const scaled=require('../devtools/model').scaleCount(1,session.devtools!.settings.spawn,session.devtools!.spawnCarry);session.devtools!.spawnCarry=scaled.carry;for(let i=0;i<scaled.count;i++)this.spawnCourtyardEnemy(id);}else this.spawnCourtyardEnemy(id);}if(!this.specialRetry&&this.level.pending(session.elapsed))this.trySpecialSpawn();for(const encounterId of this.reinforcements.dueEncounters(session.elapsed))this.reinforcements.attempt(session.elapsed,this.spawnCourtyardEnemy('E01',true),encounterId);}
      else if (oldSpawn) {
        if (courtyardPilot) this.spawnCourtyardEnemy();
        else this.place(this.enemies, this.nextMob % 2 ? 40 : WORLD_WIDTH - 40, ((this.nextMob * 73) % 360) / 360, 'enemy');
      }
      this.slamSource=null;
      if(this.isSlice())this.areas?.prepare(this.growth!.snapshot().ranks);
      for (const enemy of children(this.enemies)) if (active(enemy)) {
        const state = this.chillOf(enemy), speed = stepChill(state, passiveNow, config.chill);
        if(courtyardPilot&&enemy.getData('entering')){
          const id=enemy.getData('enemyId') as EnemyId|undefined,behavior=enemy.getData('behavior') as EnemyState|undefined;
          if(behavior?.phase==='arriving')enemy.setVelocity(0,0);
          else this.physics.moveToObject(enemy,bodyOf(this.cat).center,(id?ENEMIES[id].speed:config.scenario.enemySpeed)*(id==='B01'?Math.max(.85,speed):speed));
          continue;
        }
        if(this.isSlice()){
          const id=enemy.getData('enemyId') as EnemyId,state=enemy.getData('behavior') as EnemyState;
          if(id==='EL01'||id==='B01'){
            const offset=new Phaser.Math.Vector2(bodyOf(this.cat).center).subtract(bodyOf(enemy).center),distance=offset.length(),aim=offset.normalize(),spec=ENEMIES[id];
            const oldPhase=state.phase;
            const hpRatio=enemy.getData('hp')/(__DEVTOOLS__?enemy.getData('devtoolsMaxHP'):spec.hp);
            const scatterSlots=bossScatterRounds(bossIsEnraged(state.enraged,hpRatio))*BOSS_SCATTER.angles.length;
            const intent=stepSpecial(id,state,passiveNow,aim,{dash:this.readableAttack(enemy,aim,spec.dashSpeed*spec.dashSeconds),slam:id==='B01'&&this.readableSlam(enemy),scatter:id==='B01'&&this.readableScatter(enemy)&&this.bossProjectileSlots.available>=scatterSlots},!bodyOf(enemy).blocked.none,hpRatio,passiveNow+1e-8<(enemy.getData('chill') as ChillState).frozenUntil,distance,()=>Phaser.Math.FloatBetween(0,1));
            if(state.phase==='scatter-warning'&&oldPhase!=='scatter-warning')this.bossProjectileSlots.reserve(enemy,state.scatterRounds*BOSS_SCATTER.angles.length);
            if(intent.scatterRound)this.emitBossScatter(enemy,intent.scatterRound);
            if(id==='B01'&&oldPhase==='dash'&&state.phase==='recover')this.showBossDashImpact(enemy);
            const multiplier=id==='B01'?Math.max(.85,speed):speed;
            if(state.phase==='dash')enemy.setVelocity(state.direction.x*spec.dashSpeed*multiplier,state.direction.y*spec.dashSpeed*multiplier);
            else if(state.phase==='chase')this.physics.moveToObject(enemy,bodyOf(this.cat).center,spec.speed*multiplier);
            else enemy.setVelocity(0,0);
            if(intent.slam)this.slamSource=enemy;
          }else if(id==='E02'){
            const aim=new Phaser.Math.Vector2(bodyOf(this.cat).center).subtract(bodyOf(enemy).center).normalize();
            stepEnemy(state,passiveNow,aim,this.readableAttack(enemy,aim),bodyOf(enemy).blocked.none===false);
            if(state.phase==='dash')enemy.setVelocity(state.direction.x*220,state.direction.y*220);
            else if(state.phase==='chase')this.physics.moveToObject(enemy,bodyOf(this.cat).center,ENEMIES[id].speed);
            else enemy.setVelocity(0,0);
          }else if(id==='E03'){
            const p=centerOf(enemy),player=centerOf(this.cat),offset=new Phaser.Math.Vector2(player).subtract(p),distance=offset.length();
            const decision=stepFlanker(state,passiveNow,distance);
            if(decision==='refresh'){
              const goal=offset.normalize().rotate(enemy.getData('id')%2?Math.PI/2:-Math.PI/2).scale(ENEMIES.E03.flankOffset).add(player);
              state.flankGoal={x:Phaser.Math.Clamp(goal.x,24,COURTYARD.width-24),y:Phaser.Math.Clamp(goal.y,24,COURTYARD.height-24)};
            }
            this.physics.moveToObject(enemy,decision==='direct'?player:state.flankGoal!,ENEMIES.E03.speed*speed);
          }else if(id==='E04'){
            if(speed===0){
              enemy.setVelocity(0,0);
              // Interrupted warnings must be shown again after thaw; an old
              // deadline cannot turn into a shot on the first resumed frame.
              if(state.phase==='warning')state.phase='chase';
              continue;
            }
            const offset=new Phaser.Math.Vector2(bodyOf(this.cat).center).subtract(bodyOf(enemy).center),distance=offset.length(),aim=offset.normalize();
            state.direction={x:aim.x,y:aim.y};
            (enemy.getData('art') as EnemyPresentation).sync(enemy.body!.center.x,enemy.body!.center.y,state);
            const intent=stepFlower(state,passiveNow,distance,aim,this.readableFlower(enemy));
            enemy.setVelocity(aim.x*ENEMIES.E04.speed*intent.movement*speed,aim.y*ENEMIES.E04.speed*intent.movement*speed);
            (enemy.getData('art') as EnemyPresentation).sync(enemy.body!.center.x,enemy.body!.center.y,state);
            if(intent.fire)this.emitBubble(enemy);
          }else this.physics.moveToObject(enemy,bodyOf(this.cat).center,ENEMIES[id].speed*speed);
        }else this.physics.moveToObject(enemy, bodyOf(this.cat).center, config.scenario.enemySpeed * speed);
      }
      if(this.isSlice())this.pickups?.beforePhysics(this.cat,dt,pickupMagnetRadius(session.runConfig,this.growth!.snapshot().ranks));
      if(this.isSlice())this.areas?.beforePhysics(this.growth!.snapshot().ranks,dt);
      const movementStart=centerOf(this.cat);
      this.physics.world.update(time, delta);
      if(this.isSlice())session.recordMovement(length>0,Phaser.Math.Distance.BetweenPoints(movementStart,centerOf(this.cat)),this.growth!.snapshot().ranks);
      if(courtyardPilot)for(const enemy of children(this.enemies))if(active(enemy)&&enemy.getData('entering')){
        const body=bodyOf(enemy);
        if(body.enable&&Phaser.Geom.Rectangle.ContainsRect(this.physics.world.bounds,new Phaser.Geom.Rectangle(body.x,body.y,body.width,body.height))){enemy.setData('entering',false);enemy.setCollideWorldBounds(true);}
      }
      if(this.isOpening()){this.onboardingTravel+=Phaser.Math.Distance.BetweenPoints(movementStart,centerOf(this.cat));this.observeFirstEncounter();}
      const catBody = bodyOf(this.cat);
      // overlapCirc includes tangent circles, unlike 3.90 registered overlap's
      // separateCircle callback. Preserve the old inclusive contact boundary.
      const hpBeforeContact = session.hp;
      const contacts=this.physics.overlapCirc(catBody.center.x,catBody.center.y,catBody.halfWidth,true,false)
        .map(b=>b.gameObject as Sprite).filter(e=>e&&e.getData('kind')==='enemy'&&active(e)&&e.getData('hp')>0);
      if(this.isSlice()){
        // Controlled long-frame crossing reproduced an endpoint miss. The
        // native relative segment includes both moving Bodies' previous centers.
        for(const enemy of children(this.enemies))if(active(enemy)&&['E02','EL01','B01'].includes(enemy.getData('enemyId'))&&enemy.getData('behavior').phase==='dash'&&!contacts.includes(enemy)){
          const body=bodyOf(enemy);
          const path=new Phaser.Geom.Line(body.prev.x+body.halfWidth-catBody.prev.x-catBody.halfWidth,
            body.prev.y+body.halfHeight-catBody.prev.y-catBody.halfHeight,body.center.x-catBody.center.x,body.center.y-catBody.center.y);
          if(Phaser.Geom.Intersects.LineToCircle(path,new Phaser.Geom.Circle(0,0,body.halfWidth+catBody.halfWidth)))contacts.push(enemy);
        }
      }
      contacts.sort((a,b)=>a.getData('id')-b.getData('id'));
      if(this.isSlice()){
        if(contacts.length){
          const enemy=contacts[0],id=enemy.getData('enemyId') as EnemyId;
          const dash=enemy.getData('behavior').phase==='dash';
          this.applyCourtyardEnemyHit(dash&&id==='E02'?12:dash&&(id==='EL01'||id==='B01')?ENEMIES[id].dashDamage:ENEMIES[id].contact,(id+'_'+(dash&&(id==='E02'||id==='EL01'||id==='B01')?'DASH':'CONTACT')) as DamageSource);
        }
      }else if(contacts.length){const shieldBefore=session.defenseSnapshot().shield;this.cadence.contact(session);if(session.defenseSnapshot().shield<shieldBefore)this.showShieldAbsorption();}
      if(this.isSlice())this.resolveBubbles();
      if(this.slamSource&&active(this.slamSource))this.resolveSlam(this.slamSource);
      if (session.hp < hpBeforeContact) {
        this.clearOnboarding();
        // Slice incoming damage already carried the authoritative defense fact.
        if(!this.isSlice()){this.feedback?.hurt(catBody.center);this.feedback?.damage(catBody.center,hpBeforeContact-session.hp,true);}
      }
      // Enemy contact, bubbles/scatter and slam share the existing hit permit.
      // Settle regeneration after all incoming damage and before old friendly shots.
      if(!session.result&&session.hp>0)session.settleShieldRecovery(frameFromElapsed);
      // Resolve every old projectile before creating this frame's volley. A
      // pooled Sprite's old Body.prev can therefore never become a ghost path.
      const targetTravel=Hits.targetMotionPadding(this.physics);
      for (const shot of children(this.projectiles)) if (active(shot)) {
        this.resolveProjectile(shot,targetTravel,passiveNow,delta);
        if (active(shot) && !Phaser.Geom.Rectangle.Contains(this.physics.world.bounds, bodyOf(shot).center.x, bodyOf(shot).center.y)) this.recycle(shot, this.projectiles);
      }
      if(this.isSlice()&&!session.result&&session.hp>0){const ranks=this.growth!.snapshot().ranks,damage=abilityDamage(session.runConfig,ranks,session.movementContext());this.abilities?.setAreaMultiplier(areaMultiplier(session.runConfig,ranks));this.abilities?.travel(movementStart,centerOf(this.cat),length>0,ranks,damage,session.reloadLeft>0);this.abilities?.update(ranks,damage,session.elapsed);this.areas?.update(ranks);}
      if(this.isSlice()&&this.level.bossDefeated)session.completeBoss();
      // Finish same-frame death/Boss/timeout before XP can open or heal anything.
      session.step(0,null);
      if(session.result)this.growth?.clearPending();
      if(this.isSlice()&&!session.result&&session.hp>0)this.sentries?.update(this.growth!.snapshot().ranks);
      if(this.growth&&!session.result){
        const collected=this.pickups!.collect(this.cat);
        this.feedback?.collectXP(collected);
        if(collected>0)sound({type:'xp',at:session.elapsed,amount:collected});
        if(__DEVTOOLS__){
          const scaled=require('../devtools/model').scaleCount(collected,session.devtools!.settings.xpm,session.devtools!.xpCarry);session.devtools!.xpCarry=scaled.carry;
          this.abilities?.collect(scaled.count,this.growth.snapshot().ranks);this.growth.collect(scaled.count);
        }else {
        this.abilities?.collect(collected,this.growth.snapshot().ranks);
        this.growth.collect(collected);
        }
        if(this.growth.snapshot().offer){
          enterUpgradePause();emit();return;
        }
      }
      this.observeOnboarding();
      const player = centerOf(this.cat), currentTargets = this.automaticTargets(), previous = currentTargets.find(target => target.id === this.locked);
      if (!previous || Math.hypot(previous.x - player.x, previous.y - player.y) > config.weapon.targetRange) { this.locked = null; this.targetKind = null; }
      const shieldBeforeRoot=session.defenseSnapshot().shield;
      const fired = session.step(0, () => {
        const preferred=this.hunt?.preferredTarget();const target = preferred&&currentTargets.some(t=>t.id===preferred.id)?preferred:chooseTarget(player, currentTargets, this.locked, config.weapon.targetRange); this.locked = target?.id ?? null; this.targetKind = target?.kind ?? null;
        if (!target) return null;
        const dx = target.x - player.x, dy = target.y - player.y, distance = Math.hypot(dx, dy);
        if (distance > .01) this.lastAim = { x: dx / distance, y: dy / distance }; return this.lastAim;
      });
      // M10 is paid by this actual last-round start. Only synchronize E14's
      // form now; update already spent this frame's real sentry opportunities.
      if(fired&&session.defenseSnapshot().shield>shieldBeforeRoot)this.sentries?.ensure(this.growth!.snapshot().ranks);
      this.passives.syncReloads(session.reloadCompletions);
      if (fired) {sound({type:'fire',at:session.elapsed,volleyId:fired.id});this.fireVolley(fired);if(this.firstEncounter&&this.locked===this.firstEncounter.id&&this.firstEncounter.firstPrimaryShotAt===null)this.firstEncounter.firstPrimaryShotAt=session.elapsed;}
      if (this.spirit) {
        this.spirit.setPosition(player.x - 34, player.y - 28);
        const target = !session.result && this.passives.spiritAttack(session.elapsed, player, this.automaticTargets());
        if (target) {const emitted=this.projectile(this.spirit, Math.atan2(target.y - this.spirit.y, target.x - this.spirit.x), 'spirit-shot', Hits.SUMMON, this.nextSummonVolley--,
          nativeSpiritDamage(session.runConfig,this.growth?.snapshot().ranks??{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0},session.movementContext()), 0, config.spirit.bulletSpeed, config.spirit.bulletLifeSeconds);if(emitted&&this.firstEncounter&&target.id===this.firstEncounter.id&&this.firstEncounter.firstSpiritShotAt===null)this.firstEncounter.firstSpiritShotAt=session.elapsed;}
      }
    }
    afterUpdate(): void {
      if (!running || disposed) return;
      this.syncCatArt(); this.syncEnemyArt();
      if (courtyardPilot) this.syncCourtyardBackground();
      this.feedback?.syncHealth(session.hp,session.effectiveConfig.maxHp);this.feedback?.follow(centerOf(this.cat)); this.scenery?.drawShadows(centerOf(this.cat), this.targets());
      this.drawChillEffects();this.drawReloadBar();
      if(this.activeG6)this.syncG6();
      else {this.hunt?.draw();this.drawDefenseVisual();}
      this.impact?.sync();
      this.guide.clear(); this.stick.clear(); this.stickVisible = false;
      const stick = this.sticks.owner;
      if (stick && this.acceptsInput()) {
        this.stick.lineStyle(2 / cssScale, 0x647f5a, .55).fillStyle(0xf0f5e8, .08).fillCircle(stick.x, stick.y, 48 / cssScale).strokeCircle(stick.x, stick.y, 48 / cssScale);
        this.stick.lineStyle(2 / cssScale, 0x647f5a, .65).fillStyle(0xc7e9d4, .3).fillCircle(stick.x + stick.dx, stick.y + stick.dy, 14 / cssScale).strokeCircle(stick.x + stick.dx, stick.y + stick.dy, 14 / cssScale); this.stickVisible = true;
      }
      if (session.result && !finished) { this.clearRhythm();this.growth?.clearPending();this.abilities?.clear();this.areas?.clear();this.sentries?.clear();this.destroyDefenseVisual();finished = true; this.hunt?.clear();audio?.pause('finish');this.feedback?.clear();this.clearBubbleImpact();this.clearSlamImpact();this.clearBossDashEffects();this.cancelSpecialRetry();this.cancelBossReservations();this.reinforcements.clear();this.clearBellEffects();if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__)this.reloadBar.clear();for(const shot of children(this.enemyProjectiles))this.recycle(shot,this.enemyProjectiles);if(session.runConfig.projectileFlight?.enabled||session.runConfig.defenseCompanions?.enabled)for(const shot of children(this.projectiles))this.recycle(shot,this.projectiles); this.clearInput();
        const art=this.activeG6;
        if(art){art.rewards.reset();art.bells.finish();art.areas.reset();art.flight.finish();art.huntContracts.reset();this.spirit?.setVisible(false);}
        pauseScene(); const result = snapshot(); callbacks.onState(result); callbacks.onFinish(result);
      }
      else emit();
    }
    syncCatArt(reset = false, preserveMotion = false): void {
      const show = !!this.catArt && cat01Art && session.runConfig.catId === 'CAT01' && session.runConfig.rulesVersion !== 'diagnostic-v1';
      const held=!!this.heldArt&&cat01Art&&session.runConfig.catId!=='CAT01'&&session.runConfig.rulesVersion!=='diagnostic-v1';
      const art=this.activeG6,displaySize=this.isSlice()?COMBAT_SLICE.displaySize:58;
      if (reset){
        this.catArt?.reset(show&&!art,displaySize);
        this.heldArt?.reset(held,session.runConfig.catId==='CAT03'?'CAT03':'CAT02',displaySize);
        this.g6Art?.cat.reset(show&&!!art,displaySize);
        this.g6Art?.held.reset(held&&!!art,session.runConfig.catId==='CAT03'?'CAT03':'CAT02',displaySize);
      }
      this.cat.setVisible(!show&&!held);
      const body = bodyOf(this.cat);
      this.catArt?.sync(body.center, preserveMotion ? null : Math.abs(body.deltaXFinal()) + Math.abs(body.deltaYFinal()) > .00001, reset ? 0 : body.deltaXFinal(), this.lastAim);
      this.heldArt?.sync(body.center,preserveMotion?null:Math.abs(body.deltaXFinal())+Math.abs(body.deltaYFinal())>.00001,reset?0:body.deltaXFinal(),this.lastAim);
      if(art){
        const dx=reset?0:body.deltaXFinal(),dy=reset?0:body.deltaYFinal(),distance=Math.hypot(dx,dy);
        const movement={moved:preserveMotion||session.isPaused?null:distance>1e-5,horizontalDisplacement:dx,
          actualSpeed:this.game.loop.delta>0?distance/(this.game.loop.delta/1000):0};
        art.cat.sync(body.center,movement,this.lastAim);
        art.held.sync(movement);
      }
      if(reset){this.configureImpact();if(art&&f1Art){this.impact?.prepare(this.playerImpactParts());if(this.impact)art.held.prepareImpact(this.impact);}}
    }
  }

  const arena = new Arena();
  function syncAfterGrowthReward():void {
    arena.feedback?.syncHealth(session.hp,session.effectiveConfig.maxHp);
    arena.observeOnboarding();
    if(arena.isSlice()){arena.syncProjectileCapacity();arena.abilities?.setAreaMultiplier(areaMultiplier(session.runConfig,arena.growth!.snapshot().ranks));arena.areas?.ensure(arena.growth!.snapshot().ranks);arena.sentries?.ensure(arena.growth!.snapshot().ranks);if(session.runConfig.defenseCompanions?.enabled)arena.passives.setSpiritFrequency(companionFrequency(arena.growth!.snapshot().ranks),session.elapsed);arena.abilities?.ensure(arena.growth!.snapshot().ranks,session.elapsed);}arena.clearInput();
  }
  function enterUpgradePause():void {
    session.pause('upgrade');audio?.pause('upgrade');arena.clearInput();pauseScene();arena.observeOnboarding();
  }
  let chapterTimeline:ChapterTimeline|null=null;
  const controller: BattleController = {
    get audio(){return audio;},
    get chapterTimeline(){if(__BUILD_PROFILE__!=='playtest'||!game||disposed)return null;return chapterTimeline??(chapterTimeline=require('./chapter-timeline').createChapterTimeline(game,Phaser.Scene));},
    start(runConfig: RunConfig = makeRunConfig('CAT01', 'W01', 'diagnostic')): void { if (disposed) return; assertProjectileTraitsProfile(runConfig,__BUILD_PROFILE__);assertProjectileFlightProfile(runConfig,__BUILD_PROFILE__);assertHuntTargetingProfile(runConfig,__BUILD_PROFILE__);assertAreaAbilitiesProfile(runConfig,__BUILD_PROFILE__);assertDefenseCompanionsProfile(runConfig,__BUILD_PROFILE__);assertSustainRewardsProfile(runConfig,__BUILD_PROFILE__);assertRewardContractsProfile(runConfig,__BUILD_PROFILE__);assertMovementContractsProfile(runConfig,__BUILD_PROFILE__);audio?.pause('restart');audio?.setBossActive(false);audio?.setLocation('battle');pauseScene();
      const ordinary=sliceContent&&!runConfig.rulesVersion.startsWith('diagnostic-v1');
      audio?.setWeapon(runConfig.weaponId);if(__DEVTOOLS__){const settings=session.devtools!.settings;session=new Session(ordinary?courtyardRunConfig(runConfig):courtyardPilot?Object.freeze({...runConfig,rulesVersion:runConfig.rulesVersion+'-courtyard-preview'}):runConfig);session.devtools!.setSettings(settings);}else session=new Session(ordinary?courtyardRunConfig(runConfig):courtyardPilot?Object.freeze({...runConfig,rulesVersion:runConfig.rulesVersion+'-courtyard-preview'}):runConfig); renderFrames.reset(); finished = false; arena.resetEntities();if(arena.isOpening()){summaries.start(runSequence,session.runConfig.catId,session.runConfig.weaponId);onboarding.startRun();arena.syncOnboardingTimer();} running = true; resumeScene();if(audio?.snapshot().contextState!=='not-created')void audio?.continue(); emit(); },
    pause(reason: PauseReason): void { if (disposed || !running || session.result) return; audio?.pause(reason);session.pause(reason); arena.clearInput(); pauseScene(); if (reason === 'background') game!.loop.sleep(); emit(); },
    resume(): void { if (disposed || !running || session.result) return; arena.clearInput(); session.resume(); if (!session.isPaused) {resumeScene();if(audio?.snapshot().contextState!=='not-created')void audio?.continue();} emit(); },
    reset(): void { if (disposed) return; audio?.pause('reset');audio?.setBossActive(false);audio?.setLocation('silent');pauseScene(); summaries.end('abandoned');running = false; if(__DEVTOOLS__){const settings=session.devtools!.settings;session=new Session();session.devtools!.setSettings(settings);}else session = new Session(); renderFrames.reset(); finished = false; arena.resetEntities(); game!.loop.resetDelta(); game!.loop.wake(); emit(); },
    snapshot,
    dismissOnboarding():void {if(disposed)return;arena.clearOnboarding();emit();},
    skipOnboarding():void {if(disposed)return;arena.clearOnboarding();onboarding.skip();emit();},
    confirmUpgrade(runId,offerId,cardId,holdForFeedback=false):boolean {
      if(disposed||!running||session.result||!arena.growth||!session.reasons.includes('upgrade')||session.reasons.some(r=>r!=='upgrade'))return false;
      if(!arena.growth.confirm(runId,offerId,cardId,(ranks,source)=>{
        const before=session.hp;
        const recovered=session.applyGrowthReward(ranks,source==='elite'?SUSTAIN_NUMBERS.eliteHealFraction:0);
        if(recovered!==false&&arena.activeG6)arena.rewardHealing+=Math.max(0,session.hp-before);
        return recovered;
      }))return false;
      syncAfterGrowthReward();
      if(!arena.growth.snapshot().offer){
        session.finishUpgrade();if(holdForFeedback)session.pause('menu');else resumeScene();
        arena.activeG6?.rewards.heal(arena.rewardHealing,centerOf(arena.cat));
        arena.rewardHealing=0;
        if(!holdForFeedback&&audio?.snapshot().contextState!=='not-created')void audio?.continue();
      }
      emit();return true;
    },
    setPresentation(value): void { if (!disposed) { quality = value.quality; if (value.f1Art !== undefined) f1Art = value.f1Art; arena.setG6Quality();arena.clearSlamImpact();arena.clearBossDashEffects(); if (value.cat01Art !== undefined && value.cat01Art !== cat01Art) { cat01Art = value.cat01Art; arena.syncCatArt(true); } arena.drawBackground(); arena.syncPresentation(); arena.syncEnemyArt(); emit(); } },
    setBounds(value: BattleBounds): void {
      if (disposed) return;
      const top = Math.max(0, value.top), bottom = Math.min(worldHeight, value.bottom);
      if (top === bounds.top && bottom === bounds.bottom) return;
      bounds = { top, bottom }; arena.applyBounds();
    },
    setInputArea(area: TouchArea, scale: number, exclusions: TouchArea[]): void { if (!disposed) { inputArea = area; cssScale = scale; inputExclusions = exclusions; } },
    pageToWorld(pageX: number, pageY: number): Point { return arena.cameras.main.getWorldPoint(arena.scale.transformX(pageX), arena.scale.transformY(pageY)); },
    pageToInput(pageX: number, pageY: number): Point { return courtyardPilot ? inputBufferPoint(arena.scale.transformX(pageX), arena.scale.transformY(pageY), arena.cameras.main.zoomX) : controller.pageToWorld(pageX, pageY); },
    get cssPixelsPerLogicalUnit(): number { return arena.cameras.main.zoomX / arena.scale.displayScale.x; },
    dispose(): void {
      if (disposed) return;
      if(__DEVTOOLS__)require('../devtools/bridge').detach();
      chapterTimeline?.dispose();
      arena.interruptG6();arena.g6Art?.bells.destroy();arena.g6Art?.flight.destroy();
      arena.g6Art?.rewards.destroy();arena.g6Art?.held.destroy();arena.g6Art?.cat.destroy();
      arena.clearOnboarding();arena.impact?.destroy();audio?.dispose();arena.destroyDefenseVisual();arena.clearRhythm();arena.abilities?.clear();arena.areas?.clear();arena.sentries?.destroy();arena.hunt?.clear();
      arena.feedback?.clear();arena.clearBubbleImpact();arena.clearSlamImpact();arena.clearBossDashEffects();arena.cancelSpecialRetry();arena.cancelBossReservations();arena.reinforcements.clear();arena.clearBellEffects();if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__)arena.reloadBar.clear(); arena.clearInput(); for (const group of [arena.projectiles,arena.enemyProjectiles])for(const shot of children(group))arena.recycle(shot,group);
      arena.scale.off('resize', arena.onResize, arena); arena.events.off('postupdate', arena.afterUpdate, arena);
      arena.events.off('addedtoscene', arena.filterCourtyardObject, arena);
      game?.events.off('postrender', onRender);
      // Game.destroy is deferred to the next native frame. Keep this batch
      // charged until Scene/Texture teardown, and retain the shared UI sources.
      game?.events.once('destroy',()=>{for(const image of ownedImages)imageBudget.release(image);});
      running = false; disposed = true; unbindInputObservation(); unbindTouchCompatibility(); game?.loop.wake(); game?.destroy(true, false);
    },
  };
  if(__DEVTOOLS__){
    controller.devtools={
      read(){
        const active=running&&!disposed&&!session.result&&session.hp>0,growth=arena.growth?.snapshot();
        const blocked=!active?'请先开始一局':growth?.offer?'请先完成当前选卡':session.reasons.some(reason=>reason==='background'||reason==='inputLost')?'请先继续游戏':null;
        return {battle:snapshot(),settings:session.devtools!.settings,active,ordinaryCap:spawnStageAt(session.elapsed,arena.isOpening())?.cap??0,
          rewards:growth?require('../devtools/model').devtoolsRewards(session.runConfig,growth,blocked):[]};
      },
      setSettings(settings){session.devtools!.setSettings(settings);emit();},
      clearInput(){arena.clearInput();},
      grant(id){
        if(!running||disposed||session.result||!arena.growth||session.reasons.some(reason=>reason!=='menu'))return false;
        if(!arena.growth.devtoolsGrant!(id,ranks=>session.applyGrowthReward(ranks)))return false;
        syncAfterGrowthReward();emit();return true;
      },
      experience(amount){
        if(!running||disposed||session.result||!arena.growth||session.reasons.some(reason=>reason==='background'||reason==='inputLost'))return false;
        arena.growth.collect(amount);
        if(arena.growth.snapshot().offer){session.resume();enterUpgradePause();}
        emit();return true;
      },
    };
  }
  const bootTimeout = window.setTimeout(() => rejectReady(new Error('战斗场景初始化超时。')), 8000);
  const unbindTouchCompatibility = bindCanvasTouchCompatibility(stage, __TEST_INPUT_DIAGNOSTICS__?callbacks.onTouchInput:undefined);
  const unbindInputObservation = __TEST_INPUT_DIAGNOSTICS__&&callbacks.onBattleInput
    ?observeWindowInput(()=>arena.sticks.owner?.id??null,callbacks.onBattleInput):()=>{};
  try {
    game = new Phaser.Game({
      type: Phaser.CANVAS, width: WORLD_WIDTH, height: 500, parent: stage, backgroundColor: '#e5edda', banner: false,
      scene: [arena], plugins: { default: ['Clock', 'InputPlugin', ...(__BUILD_PROFILE__ === 'playtest' ? ['TweenManager'] : [])] }, physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, customUpdate: true, fixedStep: false } },
      input: { activePointers: 4, keyboard: true, mouse: true, touch: true, gamepad: false },
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
      fps: { target: 30, min: BATTLE_MIN_FPS, forceSetTimeOut: false }, audio: { noAudio: true }, render: { pixelArt: false, antialias: true, roundPixels: false },
    });
    if(__BUILD_PROFILE__==='playtest')audio=require('./audio/runtime').createRuntimeAudio(game,(Phaser as any).Sound.WebAudioSoundManager,()=>arena);
    return await ready;
  } catch (error) {
    window.clearTimeout(bootTimeout); unbindInputObservation(); unbindTouchCompatibility(); disposed = true; game?.loop.wake(); game?.destroy(true, false);
    for(const image of ownedImages)imageBudget.release(image);
    throw error instanceof Error ? error : new Error('战斗画布初始化失败。');
  }
}
