import {fixedWeaponId,makeRunConfig,type CatId} from '../src/combat-config';
import {ArrivalReinforcements,BOSS_ENRAGE,BOSS_SCATTER,COMBAT_SLICE,COURTYARD_LEVEL,ENEMIES,ENEMY_BUBBLE,SPAWN_STAGES,courtyardBalanceRunConfig} from '../src/level-config';
import {CONTRACT_NUMBERS,MOVEMENT_CONTRACT_NUMBERS} from '../src/contract-rules';
import {GROWTH_NUMBERS as N,PICKUP,type GrowthId,type GrowthRanks} from '../src/progression-content';
import {RunGrowth,abilityDamage,anchorStats,areaMultiplier,companionFrequency,deriveGrowthConfig,dropExperience,experienceNeeded,growthCardEligible,growthCards,growthCombinations,growthNumbers,growthRoutes,nativeSpiritDamage,orbitStats,pickupMagnetRadius,projectileTraitStats,pulseStats,sentinelStats,skillMultiplier} from '../src/progression';
import {DEFENSE_NUMBERS,armorMultiplier,shieldCapacity} from '../src/player-defense-rules';
import {SUSTAIN_NUMBERS,lifeCircuitLimit,reloadShieldRecovery} from '../src/sustain-rules';
import {chapterNames} from '../src/ui/chapter';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const n=(value:number)=>Number(value.toFixed(4));
const pct=(value:number)=>n(value*100)+'%';
const multiplier=(value:number)=>'×'+n(value);

export function readCourtyardBalance(catIds:readonly CatId[]){
 const profiles=catIds.map(id=>{
  const base=courtyardBalanceRunConfig(makeRunConfig(id,fixedWeaponId(id),'p2-basic'));
  const effective=deriveGrowthConfig(base,zero);
  const growth=new RunGrowth(1,()=>0,base).snapshot();
  return {name:chapterNames[id],base,effective,growth};
 });
 const base=profiles[0].base;
 const {attributePlan,xpTarget,rulesVersion}=profiles[0].growth;
 const A=growthNumbers(attributePlan);
 const weapon=base.weapon;
 const skill=abilityDamage(base,zero);
 const pulse=pulseStats(base,zero),anchor=anchorStats(base,zero);
 const sentinel=sentinelStats(base,zero),fortress=sentinelStats(base,zero,true);
 const defenseExamples=profiles.map(({effective})=>({
  eliteRecoveryMax:effective.maxHp*SUSTAIN_NUMBERS.eliteHealFraction,
  shieldCapacity:shieldCapacity(effective.maxHp),
  shieldPerSecond:shieldCapacity(effective.maxHp)*DEFENSE_NUMBERS.shieldRatePerSecond,
  lifeCircuitCap:lifeCircuitLimit(effective.maxHp),
  reloadShieldMax:reloadShieldRecovery(0,shieldCapacity(effective.maxHp)),
  hotStartWait:effective.weapon.intervalSeconds*N.hotStartIntervalMultiplier
 }));
 // Reinforcements expose a queue rather than a separate interval parameter.
 const firstSecond=(ready:(seconds:number)=>boolean)=>{
  let start=0,end=COURTYARD_LEVEL.duration*1000;
  if(!ready(end/1000))throw Error('Could not resolve numeric timing for the balance workbook');
  while(start<end){
   const middle=Math.floor((start+end)/2);
   if(ready(middle/1000))end=middle;else start=middle+1;
  }
  return start/1000;
 };
 const withCard=(id:GrowthId)=>({...zero,[id]:1});
 const split=n(deriveGrowthConfig(base,withCard('L1_SPLIT')).weapon.pellets-weapon.pellets);
 const pierce=deriveGrowthConfig(base,withCard('L1_PIERCE')).weapon.extraPierce-weapon.extraPierce;
 const pressure=deriveGrowthConfig(base,{...zero,L1_PIERCE:1,M09:1}).weapon.pierceDamageMultiplier;
 const barrage=deriveGrowthConfig(base,{...zero,L1_SPLIT:1,L1_EVO_BARRAGE:1}).weapon.pellets-weapon.pellets;
 const longPierce=deriveGrowthConfig(base,{...zero,L1_PIERCE:1,L1_EVO_PIERCE:1}).weapon.extraPierce-weapon.extraPierce;
 const light=deriveGrowthConfig(base,withCard('L1_LIGHT_MAG')).weapon;
 const scales={
  skill:skillMultiplier(base,withCard('A07'))-1,area:areaMultiplier(base,withCard('A08'))-1,
  pickup:pickupMagnetRadius(base,withCard('A10'))/PICKUP.magnetRadius-1,companion:companionFrequency(withCard('A16'))-1
 };
 const crit=projectileTraitStats(base,zero);
 const criticalPicks=Array.from({length:100},(_,rank)=>rank).find(rank=>!growthCardEligible('A11',{...zero,A11:rank},base));
 if(criticalPicks===undefined)throw Error('Critical chance cap was not reached');
 const combinations=growthCombinations(zero),routes=growthRoutes(zero).filter(route=>route.evolution!==null);
 const routePicks=Object.fromEntries(routes.map(route=>{
  const minimum=Array.from({length:20},(_,count)=>count).find(count=>
   growthCardEligible(route.evolution!,{...zero,[route.core]:1,[route.supports[0]]:count},base));
  if(minimum===undefined)throw Error('No reachable advancement threshold for '+route.evolution);
  return [route.evolution,minimum];
 }));
 const samples=Object.fromEntries((['L1_DAMAGE','L1_RATE','L1_RELOAD','L1_RANGE','L1_MOVE','A07','A08','A16','L1_SPLIT','M09'] as const)
  .map(id=>[id,profiles.map(p=>deriveGrowthConfig(p.base,withCard(id)))]));
 const orbit=Array.from({length:growthCards(base).find(c=>c.id==='L1_ORBIT_BELL')!.limit!},(_,rank)=>orbitStats(rank+1));
 const rhythm=N.rhythmSequenceCount;
 const stats:Record<GrowthId,string>={
  L1_DAMAGE:'武器单颗、独立技能基础伤害每次 +'+pct(A.damage),
  L1_RATE:'主武器射速、环铃转速及同敌命中频率每次 +'+pct(A.rate),
  L1_HEART:'最大生命及即时恢复各 +'+A.heart,
  L1_RELOAD:'装填速度每次 +'+pct(A.reload)+'，用基础时间除以速度倍率',
  L1_RANGE:'索敌半径每次 +'+pct(A.range)+'，弹丸寿命至少覆盖当前射程',
  L1_MOVE:'初始移速每次 +'+pct(A.move),
  A07:'独立技能与原生星灵伤害每次 +'+pct(scales.skill),
  A08:'适用的技能几何半径、环铃轨道及铃体每次 +'+pct(scales.area),
  A10:PICKUP.magnetRadius+'u 基础吸附启动半径，每次 +'+pct(scales.pickup),
  A11:'初始 '+pct(crit.criticalChance)+'，每次 +'+n(N.criticalChanceStep*100)+'个百分点，上限 '+pct(N.criticalChanceMax),
  A12:'初始暴击倍率 '+multiplier(crit.criticalMultiplier)+'，每次 +'+N.criticalMultiplierStep,
  A13:'每次 +'+DEFENSE_NUMBERS.armorPerRank+'护甲；首层减伤 '+pct(1-armorMultiplier(1))+'，先减伤，再扣盾和生命',
  A15:'投射弹速每次 +'+pct(N.flightSpeed),
  A16:'原生星灵与定点哨卫攻击频率每次 +'+pct(scales.companion),
  L1_SPLIT:'主弹数 +'+split+'，总散角 +'+N.splitSpread+'°；单颗倍率 max('+N.splitDamage+', n/(n+1))',
  L1_PIERCE:'额外穿透 +'+pierce+'；后续目标伤害递乘 '+pct(weapon.pierceDamageMultiplier),
  L1_ECHO:'尾弹附 '+N.tailCount+' 颗 '+pct(N.tailDamage)+' 主弹基数的副弹，角度 ±'+N.tailAngle+'°',
  L1_TRAIL_BELL:'移动 '+N.trailDistance+'u 放一枚，'+N.trailArm+'秒布防，最多 '+N.trailMax+' 枚长期留存。'+N.trailTrigger+'u 触发，'+N.trailRadius+'u 范围内最多 '+N.trailTargets+' 敌各受 '+pct(N.trailDamage)+' 技能基数伤害',
  L1_ORBIT_BELL:orbit.map(o=>o.count+'枚 / '+pct(o.damageCoefficient)+'伤害 / '+o.cooldown+'秒同敌间隔').join(' → ')+
   '；轨道 '+N.orbitRadius+'u，铃体 '+N.orbitSize+'u，判定半径 '+N.orbitHitRadius+'u，基础 '+N.orbitPeriod+'秒一圈',
  C12:'每 '+sentinel.deploySeconds+'秒部署，留场 '+sentinel.durationSeconds+'秒；'+sentinel.range+'u、'+sentinel.intervalSeconds+'秒/发、'+n(sentinel.damage)+'裸伤、'+sentinel.speed+'u/s、寿命 '+sentinel.lifeSeconds+'秒',
  C13:'上限为最大生命 '+pct(DEFENSE_NUMBERS.shieldFraction)+'；有效受击后 '+DEFENSE_NUMBERS.shieldWaitSeconds+'秒开始，每秒恢复上限 '+pct(DEFENSE_NUMBERS.shieldRatePerSecond),
  C15:'每 '+pulse.intervalSeconds+'秒，脚下半径 '+pulse.radius+'u；最多 '+pulse.targets+' 敌，各受 '+pct(pulse.damage/skill)+' 技能基数（裸值 '+n(pulse.damage)+'）',
  C16:'每 '+anchor.intervalSeconds+'秒部署，持续 '+anchor.durationSeconds+'秒；索敌 '+anchor.range+'u，牵引半径 '+anchor.radius+'u，最多 '+anchor.targets+' 只普通敌人；结束伤害 '+pct(anchor.damage/skill)+' 技能基数（裸值 '+n(anchor.damage)+'）',
  C18:'每 '+N.huntPeriodSeconds+'秒标记射程内生命最高目标，主弹对其 '+multiplier(N.huntDamageMultiplier),
  C21:'主弹实际扣血的 '+pct(SUSTAIN_NUMBERS.lifeDamageFraction)+' 回生命；每有效秒最多回复最大生命 '+pct(SUSTAIN_NUMBERS.lifeCapFraction),
  C23:'每 '+N.rhythmRoots+' 次实际齐射，'+N.rhythmDelay+'秒后追加一颗 '+pct(N.rhythmDamage)+' 武器基数的副弹',
  L1_SHOCK_BELL:'每齐射首个主弹命中后，'+N.shockRadius+'u 内最多 '+N.shockTargets+' 个其他敌人各受命中伤害 '+pct(N.shockDamage)+'；小满主弹强化独立',
  L1_RICOCHET:'贯穿耗尽后向 '+N.ricochetRange+'u 内未命中敌人折射一次，末次非暴击伤害 '+multiplier(N.ricochetDamage),
  L1_LIGHT_MAG:'基础弹匣减半向上取整（小满 '+weapon.ammoCapacity+' → '+light.ammoCapacity+'），装填时间 '+multiplier(N.lightReload),
  L1_PICKUP_CHIME:'实拾 '+N.chimeXP+' XP 蓄满，下次齐射附 '+pct(N.chimeDamage)+' 技能基数副弹',
  M05:'主弹返回发射点，回程最多打 1 个新敌，末段非暴击伤害 '+pct(N.returnDamage)+'；在原点 '+N.returnOriginRadius+'u 内回收，弹寿命最多原来的 '+N.returnLife+' 倍',
  M06:'主弹最终总散角 '+multiplier(N.clusterSpread),
  M09:'后续目标伤害从递乘 '+pct(weapon.pierceDamageMultiplier)+' 提高到 '+pct(pressure),
  M10:'开始真实装填时补盾 '+SUSTAIN_NUMBERS.reloadShieldPercent+'% 上限，两次实际补盾至少隔 '+SUSTAIN_NUMBERS.reloadShieldIntervalSeconds+'秒',
  M12:'真实装填后前 '+N.hotStartVolleys+' 次齐射，下一枪等待 '+multiplier(N.hotStartIntervalMultiplier)+'；三猫裸值 '+profiles.map(p=>n(p.effective.weapon.intervalSeconds*N.hotStartIntervalMultiplier)).join(' / ')+'秒',
  M26:'原标记死亡时把剩余时间传给 '+N.huntTransferRange+'u 内另一敌人一次',
  M31:'节拍延迟 '+N.rhythmDelay+' → '+N.rhythmRetargetDelay+'秒，发射时重选敌',
  L1_EVO_BARRAGE:'相对原生主弹 +'+barrage+'，保持多重投射单颗系数及散角',
  L1_EVO_PIERCE:'相对原生额外贯穿 +'+longPierce+'，衰减不变',
  L1_EVO_CADENCE:'真实装填后 '+N.cadenceVolleys+' 次齐射，各附 '+N.openingCount+' 颗 '+pct(N.openingDamage)+' 主弹基数副弹，扇面 '+N.openingSpread+'°；与小满的主弹强化独立',
  L1_DUO_TRAIL_CADENCE:'地铃最多 '+N.duoTrailMax+' 枚；装填期间每实际移动 '+N.duoTrailDistance+'u 布置一枚',
  L1_DUO_STAR_RING:'拾光蓄满时，环铃轨道扩至 '+N.starRadius+'u，当前级伤害 '+multiplier(N.starDamage)+'，持续 '+N.starSeconds+'秒',
  E14:'盾为正时哨卫附着跟随，附着的新弹 '+multiplier(fortress.damage/sentinel.damage)+'（裸值 '+n(fortress.damage)+'）',
  E16:'将当次定时脉冲移到有效锚点，沿用脉冲当前半径、伤害与冷却',
  E21:'节拍改为 '+rhythm+' 发，各 '+pct(N.rhythmSequenceDamage)+' 武器基数，间隔 '+N.rhythmSequenceStep+'秒，角度步长 '+N.rhythmSequenceAngle+'°',
  E23:'回程可再打去程旧敌，额度为 1＋生成时额外穿透数；回程首段 '+pct(N.returnDamage)+'，后续沿用逐敌衰减',
  R04:'独立技能／伙伴 '+multiplier(CONTRACT_NUMBERS.benefit)+'，武器主／副弹 '+multiplier(CONTRACT_NUMBERS.cost),
  R05:'武器主／副弹 '+multiplier(CONTRACT_NUMBERS.benefit)+'，独立技能／伙伴 '+multiplier(CONTRACT_NUMBERS.cost),
  R06:'自主移动时全伤害 '+multiplier(MOVEMENT_CONTRACT_NUMBERS.movingBenefit)+'，静止 '+multiplier(MOVEMENT_CONTRACT_NUMBERS.cost),
  R07:'移动 '+multiplier(MOVEMENT_CONTRACT_NUMBERS.cost)+'，静止蓄势满 '+MOVEMENT_CONTRACT_NUMBERS.chargeSeconds+'秒后 '+multiplier(MOVEMENT_CONTRACT_NUMBERS.stationaryBenefit)
 };
 let cumulative=0;
 const xp=Array.from({length:Math.max(34,xpTarget)},(_,i)=>{
  const level=i+1,cost=experienceNeeded(level,xpTarget);
  cumulative+=cost;
  return [level,level+1,cost,cumulative];
 });
 const reinforcements=new ArrivalReinforcements();
 const eliteQuota=(()=>{reinforcements.begin('EL01',0);return reinforcements.snapshot(0).remaining;})();
 reinforcements.begin('B01',0);
 const {startsAt,expiresAt,remaining:bossQuota}=reinforcements.snapshot(0);
 reinforcements.attempt(startsAt,false,'B01');
 const reinforcementInterval=firstSecond(seconds=>seconds>=expiresAt-startsAt||reinforcements.dueEncounters(startsAt+seconds).includes('B01'));
 return {profiles,xp,xpTarget,attributePlan,rulesVersion,crit,criticalPicks,attributes:A,scales,skill,samples,
  numbers:N,level:COURTYARD_LEVEL,combat:COMBAT_SLICE,stages:SPAWN_STAGES,enemies:ENEMIES,bubble:ENEMY_BUBBLE,scatter:BOSS_SCATTER,enrage:BOSS_ENRAGE,
  pickup:PICKUP,contracts:CONTRACT_NUMBERS,reinforcement:{eliteQuota,bossQuota,interval:reinforcementInterval,window:n(expiresAt-startsAt)},
  defense:DEFENSE_NUMBERS,sustain:SUSTAIN_NUMBERS,defenseExamples,firstArmorReduction:1-armorMultiplier(1),
  unrankedSkills:{orbit:orbit[0],pulse,sentinel,spirit:nativeSpiritDamage(profiles.find(p=>p.base.passive==='spirit')!.base,zero)},
  xpDrops:Object.fromEntries(Object.keys(ENEMIES).map(id=>[id,dropExperience(id)])),
  cards:growthCards(base).map(card=>({...card,numeric:stats[card.id],
   requires:combinations.find(c=>c.id===card.id)?.requires,
   route:routes.find(r=>r.evolution===card.id),
   supportPicks:routePicks[card.id],
   eligible:profiles.map(p=>growthCardEligible(card.id,zero,p.base,0))
  }))
 };
}
