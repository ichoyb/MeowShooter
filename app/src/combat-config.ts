// Phaser TimeStep's minimum FPS sets the maximum smoothed Scene delta.
// Native Clock capacity proofs consume this same bound, without an own clock.
export const BATTLE_MIN_FPS=20;
export type CatId = 'CAT01' | 'CAT02' | 'CAT03';
export type WeaponId = 'W01' | 'W04' | 'W02';
export type RunProfile = 'diagnostic' | 'p2-basic';
export type Passive = 'none' | 'reload-secondary' | 'chill' | 'spirit';
export type WeaponConfig = Readonly<{
  damage: number; intervalSeconds: number; ammoCapacity: number; reloadSeconds: number;
  pellets: number; spreadDegrees: number; extraPierce: number; pierceDamageMultiplier: number;
  bulletSpeed: number; bulletLifeSeconds: number; targetRange: number;
}>;
export type ScenarioConfig = Readonly<{
  enemyHp: number; objectHp: number; enemySpeed: number; spawnIntervalSeconds: number;
  maxEnemies: number; contactDamage: number; contactIntervalSeconds: number;
}>;
export type ChillConfig = Readonly<{
  creditFactor: number; threshold: number; slowPerLayer: number; layerDurationSeconds: number;
  maxLayers: number; freezeSeconds: number; protectionSeconds: number; transferRange: number;
}>;
export type SpiritConfig = Readonly<{
  intervalSeconds: number; targetRange: number; damage: number; bulletSpeed: number; bulletLifeSeconds: number;
}>;
export type GrowthTuning = Readonly<{attributePlan:'A'|'B';xpTarget:20|28|36}>;
export type RunConfig = Readonly<{
  growthPool?:'normal';
  growthTuning?:GrowthTuning;
  projectileTraits?:Readonly<{enabled:true}>;
  projectileFlight?:Readonly<{enabled:true}>;
  huntTargeting?:Readonly<{enabled:true}>;
  areaAbilities?:Readonly<{enabled:true}>;
  defenseCompanions?:Readonly<{enabled:true}>;
  sustainRewards?:Readonly<{enabled:true}>;
  rewardContracts?:Readonly<{enabled:true}>;
  movementContracts?:Readonly<{enabled:true}>;
  openingPower?:Readonly<{volleys:number; multiplier:number}>;
  spiritMark?:Readonly<{seconds:number; multiplier:number}>;
  catId: CatId; weaponId: WeaponId; rulesVersion: string; maxHp: number; moveSpeed: number;
  directDamageMultiplier: number; passive: Passive; durationSeconds: number;
  endCondition?:'duration'|'boss';
  weapon: WeaponConfig; scenario: ScenarioConfig;
  secondary: Readonly<{ damageMultiplier: number }>; chill: ChillConfig; spirit: SpiritConfig;
}>;

const fixedPairs: Readonly<Record<CatId, WeaponId>> = Object.freeze({ CAT01: 'W01', CAT02: 'W04', CAT03: 'W02' });
const cats: Record<CatId, { maxHp: number; moveSpeed: number; directDamageMultiplier: number; passive: Passive }> = {
  CAT01: { maxHp: 90, moveSpeed: 198, directDamageMultiplier: 1, passive: 'reload-secondary' },
  CAT02: { maxHp: 100, moveSpeed: 180, directDamageMultiplier: .9, passive: 'chill' },
  CAT03: { maxHp: 120, moveSpeed: 162, directDamageMultiplier: 1, passive: 'spirit' }
};
const weapons: Record<WeaponId, WeaponConfig> = {
  W01: { damage: 12, intervalSeconds: .25, ammoCapacity: 12, reloadSeconds: 1.4,
    pellets: 1, spreadDegrees: 0, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 620, bulletLifeSeconds: 1.2, targetRange: 240 },
  W04: { damage: 32, intervalSeconds: 1 / 1.2, ammoCapacity: 4, reloadSeconds: 1.8,
    pellets: 1, spreadDegrees: 0, extraPierce: 2, pierceDamageMultiplier: .7, bulletSpeed: 800, bulletLifeSeconds: 1.2, targetRange: 240 },
  W02: { damage: 8, intervalSeconds: 1 / 1.5, ammoCapacity: 4, reloadSeconds: 1.6,
    pellets: 5, spreadDegrees: 36, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 550, bulletLifeSeconds: .55, targetRange: 240 }
};

export function assertProjectileTraitsProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.projectileTraits?.enabled&&profile!=='playtest')throw new Error('主弹特性仅可在 playtest 中启用。');
}

export function assertProjectileFlightProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.projectileFlight?.enabled&&profile!=='playtest')throw new Error('投射飞行仅可在 playtest 中启用。');
}

export function assertHuntTargetingProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.huntTargeting?.enabled&&profile!=='playtest')throw new Error('追猎标记仅可在 playtest 中启用。');
}

export function assertAreaAbilitiesProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.areaAbilities?.enabled&&profile!=='playtest')throw new Error('区域能力仅可在 playtest 中启用。');
}

export function assertDefenseCompanionsProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.defenseCompanions?.enabled&&profile!=='playtest')throw new Error('护盾与伙伴仅可在 playtest 中启用。');
}

export function assertSustainRewardsProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.sustainRewards?.enabled&&profile!=='playtest')throw new Error('续航奖励仅可在 playtest 中启用。');
}

export function assertRewardContractsProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.rewardContracts?.enabled&&profile!=='playtest')throw new Error('取舍契约仅可在 playtest 中启用。');
}
export function assertMovementContractsProfile(config:RunConfig,profile:'release'|'review'|'playtest'):void {
  if(config.movementContracts?.enabled&&profile!=='playtest')throw new Error('走停契约仅可在 playtest 中启用。');
}

export function fixedWeaponId(catId: string): WeaponId {
  if (!Object.prototype.hasOwnProperty.call(fixedPairs, catId)) throw new Error('Unknown cat');
  return fixedPairs[catId as CatId];
}

export function makeRunConfig(catId: string, weaponId: string, profile: RunProfile): RunConfig {
  const pairedWeapon = fixedWeaponId(catId);
  if (!Object.prototype.hasOwnProperty.call(weapons, weaponId)) throw new Error('Unknown weapon');
  if (pairedWeapon !== weaponId) throw new Error('Invalid fixed pair');
  if (profile !== 'diagnostic' && profile !== 'p2-basic') throw new Error('Unknown run profile');
  if (profile === 'diagnostic' && catId !== 'CAT01') throw new Error('Diagnostic requires CAT01/W01');
  const diagnostic = profile === 'diagnostic';
  const cat = diagnostic ? { maxHp: 100, moveSpeed: 180, directDamageMultiplier: 1, passive: 'none' as const } : cats[catId as CatId];
  const weapon: WeaponConfig = diagnostic
    ? { damage: 1, intervalSeconds: .5, ammoCapacity: 3, reloadSeconds: 1,
      pellets: 1, spreadDegrees: 0, extraPierce: 0, pierceDamageMultiplier: .7, bulletSpeed: 320, bulletLifeSeconds: 1.5, targetRange: 240 }
    : weapons[weaponId as WeaponId];
  return Object.freeze({
    catId: catId as CatId, weaponId: weaponId as WeaponId,
    rulesVersion: diagnostic ? 'diagnostic-v1' : 'p2-basic-v1', ...cat, durationSeconds: 120,
    weapon: Object.freeze({ ...weapon }),
    secondary: Object.freeze({ damageMultiplier: .75 }),
    chill: Object.freeze({ creditFactor: 4, threshold: 6, slowPerLayer: .15, layerDurationSeconds: 2.5,
      maxLayers: 3, freezeSeconds: .75, protectionSeconds: 3, transferRange: 120 }),
    spirit: Object.freeze({ intervalSeconds: 1.5, targetRange: 260, damage: 6, bulletSpeed: 600, bulletLifeSeconds: 1 }),
    scenario: Object.freeze({ enemyHp: diagnostic ? 2 : 48, objectHp: diagnostic ? 6 : 144, enemySpeed: 24,
      spawnIntervalSeconds: 2, maxEnemies: 10, contactDamage: 10, contactIntervalSeconds: .7 })
  });
}
