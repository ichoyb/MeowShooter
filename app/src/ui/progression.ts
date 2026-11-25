import {growthNumbers,GROWTH_RULES_VERSION,NORMAL_GROWTH_RULES_VERSION,SUSTAIN_GROWTH_RULES_VERSION,CONTRACT_GROWTH_RULES_VERSION,MOVEMENT_GROWTH_RULES_VERSION} from '../progression-content';
import {CONTRACT_NUMBERS as CONTRACT,contractMultipliers,stanceMultiplier,MOVEMENT_CONTRACT_NUMBERS as MOVEMENT} from '../contract-rules';
import {growthCards,growthCard,areaMultiplier,pickupMagnetRadius,nativeSpiritDamage,pulseStats,anchorStats,skillMultiplier,GROWTH_COMBINATIONS,GROWTH_NUMBERS as N,abilityDamage,deriveGrowthConfig,growthRank,orbitStats,projectileTraitStats,type GrowthSnapshot,type GrowthId,type GrowthRanks} from '../progression';
import {assetImage,button,esc,notice,stat} from './components';
import type {RunConfig} from '../combat-config';
import {courtyardBadge,courtyardButton,courtyardNotice,courtyardStat} from './courtyard-components';
import {companionFrequency,sentinelStats} from '../sentinel-rules';
import {DEFENSE_NUMBERS as DEFENSE,armorMultiplier,armorPoints,shieldCapacity} from '../player-defense-rules';
import {SUSTAIN_NUMBERS as SUSTAIN,hpAfterMaxGrowth,hpAfterRewardRecovery,lifeCircuitLimit,reloadShieldRecovery} from '../sustain-rules';
export type GrowthPresentation={courtyard?:boolean;source?:'offer'|'owned';playerHp?:number;motion?:{enter?:boolean;selected?:string}};
export type GrowthMotionState={offer:string;selected?:string};
// UI-only edge bookkeeping. Hidden/covered renders consume edges without replay.
export function nextGrowthMotion(previous:GrowthMotionState|undefined,g:GrowthSnapshot,selected?:string,enabled=true){
 const state={offer:g.runId+'.'+(g.offer?.id??''),selected};
 const enter=previous?.offer!==state.offer;
 return {state,enter:!!g.offer&&enabled&&enter,selected:enabled&&!enter&&previous?.selected!==selected?selected:undefined};
}
const number=(n:number)=>Number(n.toFixed(3));
const percent=(fraction:number)=>number(fraction*100)+'%';
const movementStatus=(g:GrowthSnapshot)=>g.contracts?.moving?'当前自主移动':`当前静止${number(g.contracts?.stationarySeconds??0)}秒${g.ranks.R07?(g.contracts?.stance===MOVEMENT.stationaryBenefit?' · 蓄势已满':' · 蓄势未满'+MOVEMENT.chargeSeconds+'秒'):''}`;
const lifeCircuitEffect=(maxHp:number)=>'主弹对活敌的实际生命伤害×'+percent(SUSTAIN.lifeDamageFraction)+'回复生命 · 每有效秒上限'+number(lifeCircuitLimit(maxHp))+'生命';
const shieldPerSecond=(capacity:number)=>number(capacity*DEFENSE.shieldRatePerSecond);
const hotStartTiming=(interval:number)=>number(interval)+' → '+number(interval*N.hotStartIntervalMultiplier)+'秒';
function eliteRecoveryText(g:GrowthSnapshot,base:RunConfig,selected:string|undefined,playerHp?:number):string {
 const ratio=SUSTAIN.eliteHealFraction;
 const rule='确认后回复'+percent(ratio)+'最大生命，不超上限';
 if(!selected||playerHp===undefined)return rule;
 const current=deriveGrowthConfig(base,g.ranks),ranks={...g.ranks,[selected]:growthRank(g.ranks,selected as GrowthId)+1};
 const maxHp=deriveGrowthConfig(base,ranks).maxHp;
 const afterCard=hpAfterMaxGrowth(playerHp,current.maxHp,maxHp);
 const healed=hpAfterRewardRecovery(afterCard,maxHp,ratio)-afterCard;
 return healed>0?'精英战利品：预计实际回复'+number(healed)+'生命 · 上限按选卡后最大生命计算':'生命已满 · 精英战利品回复0生命';
}
function cadencePassiveDetail(base?:RunConfig):string {
 const opening=base?.openingPower;
 if(opening)return '小满开局和真实装填后的前'+opening.volleys+'次主齐射×'+opening.multiplier+'。连奏副弹独立结算，开局没有连奏副弹。';
 if(base?.passive==='reload-secondary')return '此配置开局保留原生首发副弹，真实装填后的连奏替换该轮首发副弹（原为主弹的'+percent(base.secondary.damageMultiplier)+'）。';
 return '';
}
const kindName={attribute:'属性',core:'新能力',evolution:'进阶',attachment:'配件',combination:'组合进阶',tradeoff:'取舍'};
const prerequisites=(id:GrowthId)=>GROWTH_COMBINATIONS.find(c=>c.id===id)?.requires.map(id=>growthCard(id)!.name).join('＋');
const displayQ=(g?:GrowthSnapshot,base?:RunConfig)=>g&&base?areaMultiplier(base,g.ranks):g&&(g.rulesVersion===GROWTH_RULES_VERSION||g.rulesVersion===NORMAL_GROWTH_RULES_VERSION||g.rulesVersion===SUSTAIN_GROWTH_RULES_VERSION||g.rulesVersion===CONTRACT_GROWTH_RULES_VERSION||g.rulesVersion===MOVEMENT_GROWTH_RULES_VERSION||g.rulesVersion.includes('-area-v2')||/-controlled-defense-v[123]$/.test(g.rulesVersion))?1+.05*growthRank(g.ranks,'A08'):1;
const ownedAreaRanges=(r:GrowthRanks,q:number)=>[
 r.C15?`脉冲${number(48*q)}u`:'',r.C16?`锚点${number(60*q)}u`:'',r.L1_SHOCK_BELL?`震荡${number(N.shockRadius*q)}u`:'',
 r.L1_TRAIL_BELL?`地铃触发${number(N.trailTrigger*q)}u／爆炸${number(N.trailRadius*q)}u`:'',r.L1_ORBIT_BELL?`环铃${number(N.orbitRadius*q)}u`:''
].filter(Boolean).join(' · ');
const orbitSummary=(ranks:GrowthRanks,star=false,rate=N.rate,q=1)=>{const s=orbitStats(ranks.L1_ORBIT_BELL??0,ranks.L1_RATE,rate);return `${s.count}枚 · ${number((star?N.starRadius:N.orbitRadius)*q)}u半径 · ${number(s.damageCoefficient*(star?N.starDamage:1)*100)}%D伤害 · ${number(s.period)}秒/圈 · 同敌共享${number(s.cooldown)}秒冷却`;};
function cardEffect(id:GrowthId,g?:GrowthSnapshot):string {
 const n=growthNumbers(g?.attributePlan);
 const effects:Partial<Record<GrowthId,string>>={L1_DAMAGE:`武器与独立技能基础伤害 +${100*n.damage}%`,L1_RATE:`武器射速与环铃转速、命中频率 +${100*n.rate}%`,L1_HEART:`生命上限 +${n.heart}，恢复${n.heart}生命`,L1_RELOAD:`自动装填速度 +${100*n.reload}%`,L1_RANGE:`索敌射程 +${100*n.range}%`,L1_MOVE:`移动速度 +${100*n.move}%`};
 return effects[id]||growthCard(id)!.effect;
}
function cardDetail(id:GrowthId,g?:GrowthSnapshot,base?:RunConfig):string {
 const c=growthCard(id)!,n=growthNumbers(g?.attributePlan);
 if(id==='L1_EVO_CADENCE')return c.detail+cadencePassiveDetail(base);
 if(c.kind!=='attribute'||['A07','A08','A10','A11','A12','A13','A15','A16'].includes(id))return c.detail;
 const rules:Record<string,string>={L1_DAMAGE:'同类加成相加；独立技能以12起算，不套武器基伤、角色直接伤害修正或多重投射系数。已部署地铃保留原伤害。',L1_RATE:`累计倍率H＝1＋${100*n.rate}%×次数；主武器间隔、环铃一周时间和同敌共享冷却除以H，保留相位与完成比例，不加速其他计时。`,L1_HEART:'当次回复只发生一次，不超过新的生命上限。',L1_RELOAD:'基础装填时间除以累计速度倍率；正在装填保持完成比例，不提前补满。',L1_RANGE:'增加基础索敌射程，弹速不变，弹丸寿命至少覆盖射程。不扩大区域技能半径。',L1_MOVE:'增加初始移速，不改变造型、体积与受击范围。'};
 return cardEffect(id,g)+'。'+rules[id]+'可以重复选择，不以三次封顶。';
}
function routeStatus(g:GrowthSnapshot,id?:GrowthId):string {
 const combo=id?g.combinations.find(c=>c.id===id):g.combinations.find(c=>c.eligible);
 if(combo)return growthCard(combo.id)!.name+' · '+(combo.owned?'已进阶':combo.eligible?'可组合进阶':'需要'+prerequisites(combo.id));
 const route=id?g.routes.find(r=>r.core===id||r.evolution===id):g.routes.find(r=>r.eligible)||g.routes.find(r=>r.coreOwned&&!r.evolved)||g.routes.find(r=>r.coreOwned);
 if(!route)return '选择新能力，搭配相关成长';
 if(!route.evolution)return route.name+' · 相关属性：'+route.supports.map(id=>growthCard(id)!.name).join('、');
 const name=growthCard(route.evolution)!.name;
 return route.evolved?name+' · 已进阶':route.eligible?name+' · 可进阶':
  route.coreOwned?name+'进阶：相关属性已选 '+Math.min(route.supportPicks,2)+'/2 次':'需要'+growthCard(route.core)!.name+'＋相关属性2次';
}
export function growthChange(id:GrowthId,g:GrowthSnapshot,base:RunConfig):string {
 const n=growthNumbers(g.attributePlan),q=areaMultiplier(base,g.ranks);
 const current=deriveGrowthConfig(base,g.ranks,g.contracts),next=deriveGrowthConfig(base,{...g.ranks,[id]:growthRank(g.ranks,id)+1},id==='R07'&&!g.ranks.R07?{moving:g.contracts?.moving??false,stationarySeconds:0}:g.contracts);
 if(id==='R06'||id==='R07'){
  const after={...g.ranks,[id]:1},c=id==='R07'&&!g.ranks.R07?{moving:g.contracts?.moving??false,stationarySeconds:0}:g.contracts;
  return `${movementStatus(g)} · 武器单颗 ${number(current.weapon.damage*base.directDamageMultiplier)} → ${number(next.weapon.damage*base.directDamageMultiplier)}伤害 · 独立技能S ${number(abilityDamage(base,g.ranks,g.contracts))} → ${number(abilityDamage(base,after,c))} · 确认时全伤害×${stanceMultiplier(base,after,c)}${id==='R07'?` · 取得时重新蓄势，静止满${MOVEMENT.chargeSeconds}秒×${MOVEMENT.stationaryBenefit}`:''} · 与${id==='R06'?'扎根誓约':'疾驰誓约'}互斥 · 已发弹和部署保留原伤害`;
 }
 if(id==='R04'||id==='R05'){
  const after={...g.ranks,[id]:1};return `武器单颗 ${number(current.weapon.damage*base.directDamageMultiplier)} → ${number(next.weapon.damage*base.directDamageMultiplier)}伤害 · 独立技能S ${number(abilityDamage(base,g.ranks,g.contracts))} → ${number(abilityDamage(base,after,g.contracts))}${base.passive==='spirit'?` · 原生星灵 ${number(nativeSpiritDamage(base,g.ranks,g.contracts))} → ${number(nativeSpiritDamage(base,after,g.contracts))}`:''} · 与${id==='R04'?'纯粹火力':'术式专注'}互斥 · 已发弹与已部署物件保留伤害`;
 }
 if(id==='C21')return lifeCircuitEffect(current.maxHp)+' · 只占实际回复额度，不结转';
 if(id==='M10')return `真实装填开始最多补${number(reloadShieldRecovery(0,shieldCapacity(current.maxHp)))}护盾 · 需要能量护盾 · 两次实际补盾至少${SUSTAIN.reloadShieldIntervalSeconds}秒 · 只补盾，原恢复等待继续`;
 if(id==='A16'){const f=companionFrequency(g.ranks),after=companionFrequency({...g.ranks,A16:growthRank(g.ranks,'A16')+1});return `伙伴频率F ${number(f)} → ${number(after)}${base.passive==='spirit'?` · 星灵${number(base.spirit.intervalSeconds/f)} → ${number(base.spirit.intervalSeconds/after)}秒`:''}${g.ranks.C12?` · 哨卫${number(1/f)} → ${number(1/after)}秒 · 部署和寿命仍6秒`:''}`;}
 if(id==='C12'){const s=sentinelStats(base,g.ranks,false,g.contracts);return `每${s.deploySeconds}秒部署${s.durationSeconds}秒 · ${s.range}u最近活敌 · 每${number(s.intervalSeconds)}秒${number(s.damage)}伤害 · 首发等待完整间隔`;}
 if(id==='A13'){const rank=growthRank(g.ranks,id);return `护甲${armorPoints(rank)} → ${armorPoints(rank+1)} · 减伤${percent(1-armorMultiplier(rank))} → ${percent(1-armorMultiplier(rank+1))} · 先甲、再盾、再生命`;}
 if(id==='C13'){const shield=shieldCapacity(current.maxHp);return `首次获得${number(shield)}满盾 · 受伤后${DEFENSE.shieldWaitSeconds}秒开始恢复，每秒${shieldPerSecond(shield)}盾`;}
 if(id==='E14')return `正盾附着新弹${number(sentinelStats(base,g.ranks,true,g.contracts).damage)}伤害 · 破盾落地新弹${number(sentinelStats(base,g.ranks,false,g.contracts).damage)}伤害 · 不赠攻击、不重置部署、寿命或射击相位`;
 if(id==='A07'){const after={...g.ranks,A07:growthRank(g.ranks,'A07')+1};return `技能S ${number(abilityDamage(base,g.ranks,g.contracts))} → ${number(abilityDamage(base,after,g.contracts))} · K ${number(skillMultiplier(base,g.ranks))} → ${number(skillMultiplier(base,after))}${base.rewardContracts?.enabled?` · 取舍契约×${contractMultipliers(base,g.ranks).skill}`:''}${base.passive==='spirit'?` · 原生星灵${number(nativeSpiritDamage(base,g.ranks,g.contracts))} → ${number(nativeSpiritDamage(base,after,g.contracts))}`:''} · 主弹和震荡不变`;}
 if(id==='A08'){const after={...g.ranks,A08:growthRank(g.ranks,'A08')+1},nextQ=areaMultiplier(base,after);return `范围Q ${number(q)} → ${number(nextQ)} · ${ownedAreaRanges(g.ranks,q)} → ${ownedAreaRanges(g.ranks,nextQ)} · 已部署地铃和锚点保留范围，频率与目标上限不变`;}
 if(id==='A10')return `${number(pickupMagnetRadius(base,g.ranks))} → ${number(pickupMagnetRadius(base,{...g.ranks,A10:growthRank(g.ranks,'A10')+1}))}u 吸附启动 · 领取8u · 速度上限360u/s`;
 if(id==='C15'){const p=pulseStats(base,g.ranks,g.contracts);return `首次等待${p.intervalSeconds}秒，此后每${p.intervalSeconds}秒 · ${number(p.radius)}u · 最多${p.targets}敌各${number(p.damage)}伤害`;}
 if(id==='C16'){const a=anchorStats(base,g.ranks,g.contracts);return `首次等待${a.intervalSeconds}秒，此后每${a.intervalSeconds}秒 · ${a.range}u选敌 · ${number(a.radius)}u锚点${a.durationSeconds}秒 · 最多${a.targets}普通敌牵引，结束各${number(a.damage)}伤害`;}
 if(id==='E16'){const p=pulseStats(base,g.ranks,g.contracts);return `只把原定每${p.intervalSeconds}秒脉冲移到有效锚点，否则脚下 · ${number(p.radius)}u最多${p.targets}敌各${number(p.damage)}伤害 · 不双发、不重置周期`;}
 if(id==='A15')return `${number(current.weapon.bulletSpeed)} → ${number(next.weapon.bulletSpeed)}u/s 弹速 · ${number(current.weapon.bulletLifeSeconds)} → ${number(next.weapon.bulletLifeSeconds)}秒寿命 · 最大直线距离${number(next.weapon.bulletSpeed*next.weapon.bulletLifeSeconds)}u`;
 if(id==='M05')return `主弹硬寿命最多${number(next.weapon.bulletLifeSeconds*N.returnLife)}秒 · 返回发射原点 · 回程1个全程新目标 · 末段非暴击本体${N.returnDamage*100}% · 副弹不返航`;
 if(id==='M09')return `${number(current.weapon.pierceDamageMultiplier*100)}% → ${number(next.weapon.pierceDamageMultiplier*100)}% 逐敌衰减 · 仍${next.weapon.extraPierce+1}个目标 · 首目标${number(next.weapon.damage*base.directDamageMultiplier)}伤害`;
 if(id==='A11'||id==='A12'){
  const before=projectileTraitStats(base,g.ranks),after=projectileTraitStats(base,{...g.ranks,[id]:growthRank(g.ranks,id)+1});
  return id==='A11'?`${number(before.criticalChance*100)}% → ${number(after.criticalChance*100)}% 主弹暴击率 · 上限${N.criticalChanceMax*100}%`:
   `${number(before.criticalMultiplier)} → ${number(after.criticalMultiplier)} 倍主弹暴击伤害 · 非暴击伤害不变`;
 }
 if(id==='M06')return `${number(current.weapon.spreadDegrees)}° → ${number(next.weapon.spreadDegrees)}° 主弹总散角 · ${next.weapon.pellets}颗 × ${number(next.weapon.damage*base.directDamageMultiplier)}伤害 · 每齐射1发`;
 if(id==='C18'){const damage=current.weapon.damage*base.directDamageMultiplier;return `每${N.huntPeriodSeconds}秒标记4秒 · 当前HP最高 · 主弹首段 ${number(damage)} → ${number(damage*N.huntDamageMultiplier)}伤害 · ${number(current.weapon.targetRange)}u射程`;}
 if(id==='M26')return `死亡点${N.huntTransferRange}u内 · 当前HP最高活敌 · 仅一次剩余时间传承，不续满4秒`;
 if(id==='M12')return `真实装填后前${N.hotStartVolleys}次齐射 · 后续等待 ${hotStartTiming(current.weapon.intervalSeconds)} · 装填不变`;
 if(id==='E23')return `回程目标额度 1 → ${current.weapon.extraPierce+1} · 可再命中去程旧敌 · 每程每敌最多一次`;
 if(id==='C23')return `每${N.rhythmRoots}次实际齐射 · ${N.rhythmDelay}秒后附1颗${N.rhythmDamage*100}%副弹 · 跨装填保留计数`;
 if(id==='M31')return `${N.rhythmDelay} → ${N.rhythmRetargetDelay}秒节拍延迟 · 到时重选射程内最近敌人 · 无目标跳过`;
 if(id==='E21')return `节拍1颗${N.rhythmDamage*100}% → ${N.rhythmSequenceCount}颗各${N.rhythmSequenceDamage*100}%副弹 · 间隔${N.rhythmSequenceStep}秒 · −${N.rhythmSequenceAngle}°／0°／＋${N.rhythmSequenceAngle}°`;
 if(id==='L1_DAMAGE')return `${number(current.weapon.damage*base.directDamageMultiplier)} → ${number(next.weapon.damage*base.directDamageMultiplier)} 主弹伤害 · 铃术技能S ${number(abilityDamage(base,g.ranks,g.contracts))} → ${number(abilityDamage(base,{...g.ranks,L1_DAMAGE:g.ranks.L1_DAMAGE+1},g.contracts))}`;
 if(id==='L1_RATE'){const before=orbitStats(g.ranks.L1_ORBIT_BELL??0,g.ranks.L1_RATE,n.rate),after=orbitStats(g.ranks.L1_ORBIT_BELL??0,g.ranks.L1_RATE+1,n.rate);return `${number(current.weapon.intervalSeconds)} → ${number(next.weapon.intervalSeconds)} 秒 / 发 · 环铃${number(before.period)} → ${number(after.period)}秒/圈 · 转速与命中频率×${number(after.haste)}`;}
 if(id==='L1_HEART')return `${current.maxHp} → ${next.maxHp} 生命上限`;
 if(id==='L1_RELOAD')return `${number(current.weapon.reloadSeconds)} → ${number(next.weapon.reloadSeconds)} 秒 / 装填`;
 if(id==='L1_RANGE')return `${number(current.weapon.targetRange)} → ${number(next.weapon.targetRange)}u 索敌射程`;
 if(id==='L1_MOVE')return `${number(current.moveSpeed)} → ${number(next.moveSpeed)}u / 秒`;
 if(id==='L1_PIERCE'||id==='L1_EVO_PIERCE')return `${current.weapon.extraPierce+1} → ${next.weapon.extraPierce+1} 个命中目标`;
 if(id==='L1_ECHO')return `尾弹额外${N.tailCount}颗 · ${number(current.weapon.damage*base.directDamageMultiplier*N.tailDamage)} / 颗`;
 if(id==='L1_EVO_CADENCE')return `装填后${N.cadenceVolleys}次齐射，各附${N.openingCount}颗副弹 · 每颗${number(current.weapon.damage*base.directDamageMultiplier*N.openingDamage)}基础伤害`;
 if(id==='L1_LIGHT_MAG')return `${current.weapon.ammoCapacity} → ${next.weapon.ammoCapacity}发 · 装填${number(current.weapon.reloadSeconds)} → ${number(next.weapon.reloadSeconds)}秒`;
 if(id==='L1_SHOCK_BELL')return `${number(N.shockRadius*q)}u · 最多${N.shockTargets}敌 · 实际命中伤害${N.shockDamage*100}%${base.openingPower?' · 不计装填强化':''}`;
 if(id==='L1_TRAIL_BELL')return `180u留铃 · 长期留存，最多${g.ranks.L1_DUO_TRAIL_CADENCE?N.duoTrailMax:N.trailMax}枚 · 满额替换最早 · 最多6敌 × 90%D`;
 if(id==='L1_ORBIT_BELL'){const rank=growthRank(g.ranks,id),current=orbitStats(rank,g.ranks.L1_RATE,n.rate),next=orbitStats(Math.min(3,rank+1),g.ranks.L1_RATE,n.rate),d=abilityDamage(base,g.ranks,g.contracts);return `Lv.${rank} → Lv.${Math.min(3,rank+1)} · ${current.count} → ${next.count} 枚 · ${number(current.damageCoefficient*d)} → ${number(next.damageCoefficient*d)}伤害（${number(next.damageCoefficient*100)}%D） · ${number(next.period)}秒/圈 · 同敌共享${rank?number(current.cooldown)+' → ':''}${number(next.cooldown)}秒冷却`;}
 if(id==='L1_PICKUP_CHIME')return '实际拾取8经验充满 · 下次齐射一颗75%副弹';
 if(id==='L1_DUO_TRAIL_CADENCE')return '地铃长期留存，最多9枚 · 满额替换最早 · 仅装填期间180→60u留铃';
 if(id==='L1_DUO_STAR_RING'){const s=orbitStats(g.ranks.L1_ORBIT_BELL??0,g.ranks.L1_RATE,n.rate);return `真实蓄满触发3秒 · ${orbitSummary(g.ranks,true,growthNumbers(g.attributePlan).rate,displayQ(g,base))} · 当前级伤害×${N.starDamage}＝${number(abilityDamage(base,g.ranks,g.contracts)*s.damageCoefficient*N.starDamage)}`;}
 if(id==='L1_RICOCHET')return `${N.ricochetRange}u内一次转向 · 末次穿透伤害${N.ricochetDamage*100}%`;
 return `${current.weapon.pellets} → ${next.weapon.pellets} 颗主弹 · ${number(next.weapon.damage*base.directDamageMultiplier)} / 颗`;
}
// Decision-sized facts stay on the card; growthChange and cardDetail remain complete in details.
export function growthCardSummary(id:GrowthId,g:GrowthSnapshot,base:RunConfig):{benefit:string;cost?:string} {
 const current=deriveGrowthConfig(base,g.ranks,g.contracts),next=deriveGrowthConfig(base,{...g.ranks,[id]:growthRank(g.ranks,id)+1},id==='R07'&&!g.ranks.R07?{moving:g.contracts?.moving??false,stationarySeconds:0}:g.contracts);
 const damage=(run:RunConfig)=>number(run.weapon.damage*base.directDamageMultiplier);
 const n=growthNumbers(g.attributePlan),d=abilityDamage(base,g.ranks,g.contracts),q=areaMultiplier(base,g.ranks);
 switch(id){
  case 'R04':return {benefit:`独立技能／伙伴伤害 ×${CONTRACT.benefit}`,cost:`武器主／副弹伤害 ×${CONTRACT.cost} · 与纯粹火力互斥 · 确认后本局持续生效`};
  case 'R05':return {benefit:`武器主／副弹伤害 ×${CONTRACT.benefit}`,cost:`独立技能／伙伴伤害 ×${CONTRACT.cost} · 与术式专注互斥 · 确认后本局持续生效`};
  case 'R06':return {benefit:`实际自主移动时全伤害 ×${MOVEMENT.movingBenefit}`,cost:`静止全伤害 ×${MOVEMENT.cost} · 与扎根誓约互斥 · 撞墙无位移算静止`};
  case 'R07':return {benefit:`静止满${MOVEMENT.chargeSeconds}秒全伤害 ×${MOVEMENT.stationaryBenefit}`,cost:`移动全伤害 ×${MOVEMENT.cost} · 蓄势中维持原伤害 · 取得重新蓄势 · 与疾驰誓约互斥`};
  case 'C21':return {benefit:growthChange(id,g,base),cost:'仅根主弹对活敌的生命实损 · 副弹、伙伴与独立技能不触发'};
  case 'M10':return {benefit:growthChange(id,g,base),cost:'满盾不占冷却 · 取得时已装填不追补 · 不赠哨卫攻击'};
  case 'C12':return {benefit:growthChange(id,g,base),cost:'固定脚下位置 · 不打箱子、不暴击、不触发主弹配件'};
  case 'A16':return {benefit:cardEffect(id,g),cost:growthChange(id,g,base)};
  case 'A13':return {benefit:`护甲 +${DEFENSE.armorPerRank}`,cost:growthChange(id,g,base)};
  case 'C13':return {benefit:`获得${number(shieldCapacity(current.maxHp))}护盾 · 上限为最大生命${percent(DEFENSE.shieldFraction)}`,cost:`有效受击后${DEFENSE.shieldWaitSeconds}秒开始恢复 · 每秒${shieldPerSecond(shieldCapacity(current.maxHp))}盾 · 只回护盾`};
  case 'E14':return {benefit:'护盾为正时，当前哨卫附着猫咪中心随行',cost:`附着新弹打八折 · ${growthChange(id,g,base)}`};
  case 'A07':case 'A08':case 'A10':return {benefit:cardEffect(id,g),cost:growthChange(id,g,base)};
  case 'C15':{const p=pulseStats(base,g.ranks,g.contracts);return {benefit:`每${p.intervalSeconds}秒：${number(p.radius)}u内最多${p.targets}敌各${number(p.damage)}伤害`,cost:'首次等待3秒 · 不暴击、不触发寒意或副弹'};}
  case 'C16':{const a=anchorStats(base,g.ranks,g.contracts);return {benefit:`每${a.intervalSeconds}秒：${number(a.radius)}u锚点牵引最多${a.targets}普通敌，结束各${number(a.damage)}伤害`,cost:`${a.range}u最近活敌位置 · 固定${a.durationSeconds}秒 · 精英Boss免拉 · 部署冻结数值`};}
  case 'E16':{const p=pulseStats(base,g.ranks,g.contracts);return {benefit:`原定脉冲移到有效锚点：最多${p.targets}敌各${number(p.damage)}伤害`,cost:`无锚仍脚下 · 原${p.intervalSeconds}秒／${number(p.radius)}u · 不双发、不提前引爆`};}
  case 'L1_DAMAGE':case 'L1_RATE':case 'L1_HEART':case 'L1_RELOAD':case 'L1_RANGE':case 'L1_MOVE':return {benefit:cardEffect(id,g)};
  case 'L1_SPLIT':case 'L1_EVO_BARRAGE':return {benefit:`主弹 ${current.weapon.pellets} → ${next.weapon.pellets}颗`,cost:`每颗 ${damage(current)} → ${damage(next)}伤害 · 总散角 ${number(current.weapon.spreadDegrees)} → ${number(next.weapon.spreadDegrees)}°`};
  case 'L1_PIERCE':case 'L1_EVO_PIERCE':return {benefit:`命中目标 ${current.weapon.extraPierce+1} → ${next.weapon.extraPierce+1}个`,cost:`后续逐敌 ×${number(next.weapon.pierceDamageMultiplier*100)}% · 仅主弹`};
  case 'L1_ECHO':return {benefit:`尾弹附${N.tailCount}颗，各${number(current.weapon.damage*base.directDamageMultiplier*N.tailDamage)}伤害`,cost:`副弹 ±${N.tailAngle}° · 不穿透、不递归`};
  case 'L1_EVO_CADENCE':return {benefit:growthChange(id,g,base),cost:`仅真实装填完成后触发 · 副弹 ±${N.openingSpread/2}°`+(base.openingPower?' · 与小满的主弹强化独立':base.passive==='reload-secondary'?` · 替换橘团${percent(base.secondary.damageMultiplier)}装填首发`:'')};
  case 'L1_SHOCK_BELL':return {benefit:`齐射首次主弹命中：${number(N.shockRadius*q)}u震荡、最多${N.shockTargets}敌`,cost:`其他敌各受命中伤害${N.shockDamage*100}%${base.openingPower?'（不计装填强化）':''} · 副弹不触发`};
  case 'L1_RICOCHET':return {benefit:`穿透用尽后，${N.ricochetRange}u内转向1次`,cost:`末次穿透伤害 ×${N.ricochetDamage*100}% · 仅新目标、主弹`};
  case 'L1_TRAIL_BELL':return {benefit:`每走${N.trailDistance}u留铃 · 最多${g.ranks.L1_DUO_TRAIL_CADENCE?N.duoTrailMax:N.trailMax}枚`,cost:`布防${N.trailArm}秒；${number(N.trailRadius*q)}u最多${N.trailTargets}敌各${N.trailDamage*100}%D · 满额替最早`};
  case 'L1_ORBIT_BELL':{const s=orbitStats(Math.min(3,growthRank(g.ranks,id)+1),g.ranks.L1_RATE,n.rate);return {benefit:`${s.count}枚飞铃 · 每次${number(s.damageCoefficient*d)}伤害 · ${number(N.orbitRadius*q)}u环绕`,cost:`同敌共享${number(s.cooldown)}秒冷却 · 不挡弹、不免伤`};}
  case 'L1_PICKUP_CHIME':return {benefit:`拾取${N.chimeXP}经验，下次齐射附1颗${N.chimeDamage*100}%D副弹`,cost:'蓄满溢出不留 · 副弹不分弹、不穿透'};
  case 'L1_LIGHT_MAG':return {benefit:`装填 ${number(current.weapon.reloadSeconds)} → ${number(next.weapon.reloadSeconds)}秒`,cost:`基础弹匣减半：${current.weapon.ammoCapacity} → ${next.weapon.ammoCapacity}发 · 不补弹`};
  case 'L1_DUO_TRAIL_CADENCE':return {benefit:`地铃上限 ${N.trailMax} → ${N.duoTrailMax}枚 · 装填留铃 ${N.trailDistance} → ${N.duoTrailDistance}u`,cost:'仅装填期间缩短间距 · 满额替最早'};
  case 'L1_DUO_STAR_RING':return {benefit:`拾光蓄满：${number(N.starRadius*q)}u星环 · 当前级伤害 ×${N.starDamage}`,cost:`持续${N.starSeconds}秒 · 已有满格不补触发 · 原拾光副弹保留`};
  case 'A11':{const before=projectileTraitStats(base,g.ranks),after=projectileTraitStats(base,{...g.ranks,A11:growthRank(g.ranks,id)+1});return {benefit:`暴击率 +${number((after.criticalChance-before.criticalChance)*100)}个百分点 · ${number(before.criticalChance*100)}% → ${number(after.criticalChance*100)}%`,cost:`仅主弹 · 上限${N.criticalChanceMax*100}%`};}
  case 'A12':return {benefit:`主弹暴击倍率 ${number(projectileTraitStats(base,g.ranks).criticalMultiplier)} → ${number(projectileTraitStats(base,{...g.ranks,A12:growthRank(g.ranks,id)+1}).criticalMultiplier)}倍`,cost:'仅暴击主弹 · 非暴击与副弹不变'};
  case 'M06':return {benefit:`总散角 ${number(current.weapon.spreadDegrees)} → ${number(next.weapon.spreadDegrees)}°`,cost:'横向覆盖缩小 · 仅主弹，副弹不变'};
  case 'C18':return {benefit:`每${N.huntPeriodSeconds}秒标记高生命敌，主弹对其+15%`,cost:'主武器可能放过近身小怪 · 离程回近敌 · 副弹不加成'};
  case 'M26':return {benefit:`死亡点${N.huntTransferRange}u内传给另一高生命敌`,cost:'每窗口仅一次 · 只传剩余时间，不续时 · 不越程开火'};
  case 'M12':return {benefit:`装填后前${N.hotStartVolleys}次齐射，下一枪等待 ${hotStartTiming(current.weapon.intervalSeconds)}`,cost:'真实装填后计入额度 · 沿用首枪、装填与弹数 · 无目标时保留'};
  case 'E23':return {benefit:`回程最多${current.weapon.extraPierce+1}目标，去程旧敌可再受一次`,cost:'同一弹丸每敌全程最多两次 · 继续逐敌衰减 · 不再折射'};
  case 'C23':return {benefit:`每${N.rhythmRoots}次齐射，附1颗${N.rhythmDamage*100}%主弹伤害的副弹`,cost:`延迟${N.rhythmDelay}秒 · 不穿透、不额外耗弹`};
  case 'M31':return {benefit:'节拍到时重选射程内最近敌人',cost:`节拍延迟 ${N.rhythmDelay} → ${N.rhythmRetargetDelay}秒 · 无目标跳过`};
  case 'E21':return {benefit:`节拍1颗${N.rhythmDamage*100}% → ${N.rhythmSequenceCount}颗各${N.rhythmSequenceDamage*100}%副弹`,cost:`替换原副弹 · 间隔${N.rhythmSequenceStep}秒、±${N.rhythmSequenceAngle}° · 集束不收束`};
  case 'A15':return {benefit:`投射弹速 ${number(current.weapon.bulletSpeed)} → ${number(next.weapon.bulletSpeed)}u/s`,cost:`寿命 ${number(current.weapon.bulletLifeSeconds)} → ${number(next.weapon.bulletLifeSeconds)}秒 · 仅新投射物，星灵不变`};
  case 'M05':return {benefit:'主弹去程结束后，返回发射原点',cost:`末段非暴击本体${N.returnDamage*100}% · 回程仅1个新目标 · 副弹不返航`};
  case 'M09':return {benefit:`逐敌伤害倍率 ${number(current.weapon.pierceDamageMultiplier*100)}% → ${number(next.weapon.pierceDamageMultiplier*100)}%`,cost:'首目标伤害与目标额度不变 · 仅主弹'};
 }
}
export function growthComparison(change:string):string {
 const parts=change.split(' · '),numeric=parts.filter(part=>part.includes('→'));
 return (numeric.length?numeric.slice(0,2):parts.slice(0,1)).join(' · ');
}
export function growthPage(g:GrowthSnapshot,base:RunConfig,selected?:string,options:GrowthPresentation={}):{body:string;footer:string;courtyardUI?:boolean;growthUI?:boolean}{
 const offer=g.offer;if(!offer)return {body:'',footer:''};
 selected=offer.choices.includes(selected as GrowthId)&&!!growthCard(selected||'')?selected:undefined;
 if(options.courtyard)return courtyardGrowthPage(g,base,selected,options);
 const key=`${g.runId}.${offer.id}.`;
 return {body:`<div class="growth-heading"><span class="growth-level">Lv.${g.level}</span><p>${offer.source==='elite'?'精英战利品':'选择这一局的成长方向'}</p>${offer.source==='elite'?`<small>${esc(eliteRecoveryText(g,base,selected,options.playerHp))}</small>`:''}<small>${esc(routeStatus(g))}</small>${g.pending>1?`<small>还有 ${g.pending} 次选择</small>`:''}</div><div class="growth-cards">`+offer.choices.map(id=>{
  const c=growthCard(id)!,summary=growthCardSummary(id,g,base);
  return `<article class="growth-card ${c.kind==='combination'?'combination evolution':c.kind} ${selected===id?'chosen':''}"><button type="button" class="growth-choice" data-action="growth-select:${key+id}" aria-pressed="${selected===id}"><span class="growth-title">${assetImage(c.icon,'growth-icon')}<span class="growth-name"><small class="growth-kind">${c.id==='L1_ORBIT_BELL'&&growthRank(g.ranks,c.id)?'能力升级':kindName[c.kind]}${selected===id?' · 已选':''}</small><strong>${esc(c.name)}</strong></span></span><span class="growth-effect">${esc(summary.benefit)}</span>${summary.cost?`<span class="growth-cost">${esc(summary.cost)}</span>`:''}${c.id==='L1_ORBIT_BELL'?`<small class="growth-rank">Lv.${growthRank(g.ranks,id)} → ${Math.min(3,growthRank(g.ranks,id)+1)}</small>`:c.kind==='attribute'?`<small class="growth-rank">第${growthRank(g.ranks,id)+1}次</small>`:''}</button><button type="button" class="btn growth-detail" data-action="growth-detail:${id}" aria-label="${esc(c.name)}：查看规则">详情</button></article>`;
 }).join('')+'</div>',footer:`<div class="growth-confirm">${button('growth-confirm:'+key+(selected||''),selected?'确认选择 · '+growthCard(selected)!.name:'先选择一项奖励','primary',!selected)}</div><div class="two-buttons">${button('build','本局构筑','small-button')}${button('settings','设置','small-button')}</div>`};
}
export function growthBuild(g:GrowthSnapshot,base?:RunConfig,options:GrowthPresentation={}):string {
 if(options.courtyard)return courtyardGrowthBuild(g,base);
 const n=growthNumbers(g.attributePlan);
 const cards=growthCards(base).filter(c=>growthRank(g.ranks,c.id)>0);
 const total=(id:GrowthId)=>id==='A11'?`当前主弹暴击率 ${number(g.projectileTraits.criticalChance*100)}% · 上限${N.criticalChanceMax*100}%`:
  id==='A12'?`当前主弹暴击倍率 ${number(g.projectileTraits.criticalMultiplier)}倍 · 非暴击伤害不变`:
  id==='A15'?`累计投射弹速 +${number(100*N.flightSpeed*growthRank(g.ranks,id))}% · 寿命按倍率缩短，保留最大直线飞行距离`:
  id==='L1_DAMAGE'?'累计武器与铃术基础伤害 +'+number(100*n.damage*g.ranks.L1_DAMAGE)+'%':
  id==='L1_RATE'?'累计武器射速与环铃转速、命中频率 +'+number(100*n.rate*g.ranks.L1_RATE)+'%':
  id==='L1_HEART'?'累计生命上限 +'+n.heart*g.ranks.L1_HEART:
  id==='L1_RELOAD'?'累计装填速度 +'+number(100*n.reload*growthRank(g.ranks,id))+'%':
  id==='L1_RANGE'?'累计索敌射程 +'+number(100*n.range*growthRank(g.ranks,id))+'%':
  id==='L1_ORBIT_BELL'?orbitSummary(g.ranks,false,growthNumbers(g.attributePlan).rate,displayQ(g,base)):
  id==='L1_DUO_STAR_RING'?`真实蓄满3秒 · ${orbitSummary(g.ranks,true,growthNumbers(g.attributePlan).rate,displayQ(g,base))}`:
  id==='L1_TRAIL_BELL'||id==='L1_DUO_TRAIL_CADENCE'?`长期留存，最多${g.ranks.L1_DUO_TRAIL_CADENCE?N.duoTrailMax:N.trailMax}枚 · 满额新铃替换最早一枚`:
  id==='L1_MOVE'?'累计移动速度 +'+number(100*n.move*growthRank(g.ranks,id))+'%':base&&['A07','A08','A10','C15','C16','E16','A13','C13','C12','A16','E14','C21','M10','R04','R05','R06','R07','L1_EVO_CADENCE','M12'].includes(id)?growthCurrentEffect(id,g,base):cardEffect(id,g);
 const routes=g.routes.filter(r=>r.coreOwned).map(r=>notice(routeStatus(g,r.core))).join('');
 return notice(`Lv.${g.level} · 已拾取 ${g.totalXP} 经验`)+(g.eliteRewards?.length?notice('精英战利品：'+g.eliteRewards.map(e=>growthCard(e.cardId)!.name+' · 实际回复'+number(e.recovered)+'生命').join('；')):'')+(routes||notice(routeStatus(g)))+(cards.length?cards.map(c=>`<article class="card content-card">${assetImage(c.icon,'content-icon')}<div><strong>${esc(c.name)} ${c.id==='L1_ORBIT_BELL'?'Lv.'+growthRank(g.ranks,c.id):c.kind==='attribute'?'已选'+growthRank(g.ranks,c.id)+'次':c.kind==='evolution'?'已进阶':c.kind==='combination'?'已进阶':'已获得'}</strong><p>${esc(total(c.id))}</p></div></article>`).join(''):'<p>还没有取得能力，靠近击败怪物留下的星光拾取经验。</p>');
}
export function growthDetail(id:string,g?:GrowthSnapshot,base?:RunConfig,options:GrowthPresentation={}):{title:string;body:string;footer:string;courtyardUI?:boolean}{
 const c=id==='E14'&&!base?.defenseCompanions?.enabled?undefined:growthCard(id);
 if(c&&options.courtyard)return courtyardGrowthDetail(c.id,g,base,options.source==='owned');
 return {title:c?.name||'本局构筑',body:c?`${assetImage(c.icon,'large-icon')}${c.kind==='combination'?notice('需要'+prerequisites(c.id)+'；无需额外属性次数，满足后仍须实际选择。'):''}${g&&base?`<h2>${options.source==='owned'?'当前效果':'本次变化'}</h2><p>${esc(options.source==='owned'?growthCurrentEffect(c.id,g,base):growthChange(c.id,g,base))}</p>`:''}<h2>完整规则</h2><p>${esc(cardDetail(c.id,g,base))}</p>${stat('类型',c.id==='L1_ORBIT_BELL'&&g&&growthRank(g.ranks,c.id)?'能力升级':kindName[c.kind])}${c.id==='L1_ORBIT_BELL'&&g?stat('当前等级',`Lv.${growthRank(g.ranks,c.id)} / 3 · ${orbitSummary(g.ranks,false,growthNumbers(g.attributePlan).rate,displayQ(g,base))}`):''}${c.id==='L1_DUO_STAR_RING'&&g?stat('当前星环',orbitSummary(g.ranks,true,growthNumbers(g.attributePlan).rate,displayQ(g,base))):''}${stat('取得方式',c.id==='L1_ORBIT_BELL'?'每次提升1级，最高3级':c.kind==='attribute'?'可重复选择':c.kind==='core'||c.kind==='attachment'?'本局获得一次':'满足条件后选择一次')}${g?notice(routeStatus(g,c.id)):''}${notice('仅在这次守护中生效；查看规则不会选中或确认卡片。')}`:'',footer:button('close','返回选择','primary')};
}

const cardName=(id:GrowthId)=>growthCard(id)!.name;
function ownedStatus(id:GrowthId,g:GrowthSnapshot){
 const c=growthCard(id)!,rank=growthRank(g.ranks,id);
 return !rank?'尚未取得':id==='L1_ORBIT_BELL'?'已获得 · Lv.'+rank:c.kind==='attribute'?'已选'+rank+'次':c.kind==='evolution'||c.kind==='combination'?'已进阶':'已获得';
}
function growthConditions(g:GrowthSnapshot,id?:GrowthId){
 const combinations=g.combinations.filter(c=>!id||c.id===id);
 const routes=g.routes.filter(r=>id?r.core===id||r.evolution===id:r.coreOwned);
 return routes.map(r=>`<div class="court-growth-route"><strong>${esc(routeStatus(g,r.core))}</strong><p>${esc(cardName(r.core)+' · '+ownedStatus(r.core,g))}</p><p>${esc('相关属性：'+r.supports.map(id=>cardName(id)+' '+growthRank(g.ranks,id)+'次').join('、'))}${r.evolution?esc('；已选'+r.supportPicks+'/2次，取得核心并满足后仍须选择进阶。'):''}</p></div>`).join('')+
  combinations.map(c=>`<div class="court-growth-route"><strong>${esc(cardName(c.id)+' · '+(c.owned?'已进阶':c.eligible?'可组合进阶，尚未取得':'前置未齐'))}</strong><p>${esc(c.requires.map(id=>cardName(id)+' · '+ownedStatus(id,g)).join(' ＋ '))}</p><p>无需额外属性次数，满足后仍须实际选择。</p></div>`).join('');
}
// All current values come from the snapshot and existing derivation, never rank+1.
function growthCurrentEffect(id:GrowthId,g:GrowthSnapshot,base?:RunConfig):string {
 if(!base)return id==='L1_ORBIT_BELL'?orbitSummary(g.ranks,false,growthNumbers(g.attributePlan).rate,displayQ(g,base)):cardEffect(id,g);
 const current=deriveGrowthConfig(base,g.ranks,g.contracts),w=current.weapon,d=abilityDamage(base,g.ranks,g.contracts),damage=number(w.damage*base.directDamageMultiplier),n=growthNumbers(g.attributePlan),q=areaMultiplier(base,g.ranks);
 switch(id){
  case 'R06':case 'R07':return `${movementStatus(g)} · 当前全伤害×${stanceMultiplier(base,g.ranks,g.contracts)} · 单颗主弹${damage}伤害 · 独立技能S ${number(d)}${base.passive==='spirit'?` · 原生星灵${number(nativeSpiritDamage(base,g.ranks,g.contracts))}伤害`:''} · 与${id==='R06'?'扎根誓约':'疾驰誓约'}互斥 · ${id==='R07'?'取得时重新蓄势，暂停、升级、后台不计时':'撞墙无位移算静止'} · 旧飞弹与部署保留原伤害`;
  case 'R04':case 'R05':{const m=contractMultipliers(base,g.ranks);return `当前武器主／副弹×${m.weapon} · 独立技能／伙伴×${m.skill} · 单颗主弹${damage}伤害 · 技能S ${number(d)}${base.passive==='spirit'?` · 原生星灵${number(nativeSpiritDamage(base,g.ranks,g.contracts))}伤害`:''} · 与${id==='R04'?'纯粹火力':'术式专注'}互斥 · 本局代价持续生效`;}
  case 'C21':{const s=g.sustain;return lifeCircuitEffect(current.maxHp)+(s?` · 当前第${s.lifeWindowSecond}秒已回复${number(s.lifeUsedThisSecond)} · 本局实际回复${number(s.hpRecoveredTotal)}生命`:' · 实际回复以战斗状态为准')+' · 成长和精英治疗沿用原额度窗口';}
  case 'M10':{const s=g.sustain;return `真实装填开始最多补${number(reloadShieldRecovery(0,shieldCapacity(current.maxHp)))}护盾 · 两次实际补盾至少${SUSTAIN.reloadShieldIntervalSeconds}秒${s?` · 本局实际补${number(s.shieldRecoveredTotal)}盾 · ${s.reloadShieldReady?'间隔已就绪':'间隔等待中'}`:' · 实际补盾以战斗状态为准'} · 原护盾恢复等待继续`;}
  case 'C12':{const s=sentinelStats(base,g.ranks,g.sentry?.station?.attached===true,g.contracts);return `每${s.deploySeconds}秒部署${s.durationSeconds}秒 · ${s.range}u · 每${number(s.intervalSeconds)}秒${number(s.damage)}伤害 · 发弹时冻结伤害`; }
  case 'E14':return `${g.sentry?.station?(g.sentry.station.attached?'当前附着':'当前落地'):'等待原周期部署'} · 正盾附着新弹${number(sentinelStats(base,g.ranks,true,g.contracts).damage)}伤害 · 破盾落地新弹${number(sentinelStats(base,g.ranks,false,g.contracts).damage)}伤害 · 恢复正盾可同座再附着 · 原部署、寿命和射击相位不变`;
  case 'A16':return `当前伙伴频率F ×${number(companionFrequency(g.ranks))}${base.passive==='spirit'?` · 星灵${number(base.spirit.intervalSeconds/companionFrequency(g.ranks))}秒`:''}${g.ranks.C12?` · 哨卫${number(1/companionFrequency(g.ranks))}秒`:''} · 已选${growthRank(g.ranks,id)}次`;
  case 'A13':{const rank=growthRank(g.ranks,id),activeRank=base.defenseCompanions?.enabled?rank:0;return `当前护甲${g.defense?.armor??armorPoints(activeRank)} · 减伤${percent(1-(g.defense?.multiplier??armorMultiplier(activeRank)))} · 已选${rank}次`;}
  case 'C13':{
   const d=g.defense;
   if(!d?.enabled)return `护盾上限${number(shieldCapacity(current.maxHp))} · 受击后${DEFENSE.shieldWaitSeconds}秒等待 · 每秒上限${percent(DEFENSE.shieldRatePerSecond)}`;
   const recovery=d.shield>=d.maxShield?'护盾已满':d.rechargeWait>0?'再等'+number(d.rechargeWait)+'秒恢复':'每秒恢复'+shieldPerSecond(d.maxShield)+'盾';
   return `当前护盾${number(d.shield)} / ${number(d.maxShield)} · ${recovery} · 生命治疗不补盾`;
  }
  case 'A07':return `当前K ×${number(skillMultiplier(base,g.ranks))} · 技能S ${number(d)}${base.rewardContracts?.enabled?` · 取舍契约×${contractMultipliers(base,g.ranks).skill}`:''}${base.passive==='spirit'?` · 原生星灵${number(nativeSpiritDamage(base,g.ranks,g.contracts))}伤害`:''} · 已选${growthRank(g.ranks,id)}次`;
  case 'A08':return `当前范围Q ×${number(q)} · ${ownedAreaRanges(g.ranks,q)} · 已部署地铃和${g.ranks.C16?'锚点':'物件'}保留范围，频率与目标上限不变`;
  case 'A10':return `当前吸附启动${number(pickupMagnetRadius(base,g.ranks))}u · 领取8u · 速度上限360u/s · 不增加XP`;
  case 'C15':{const p=pulseStats(base,g.ranks,g.contracts);return `每${p.intervalSeconds}秒 · 当前${number(p.radius)}u · 最多${p.targets}敌各${number(p.damage)}伤害 · 首次等待3秒${g.ranks.E16?' · 有效锚点优先，否则脚下':''}`;}
  case 'C16':{const a=anchorStats(base,g.ranks,g.contracts);return `每${a.intervalSeconds}秒在${a.range}u最近活敌处部署 · 下次部署${number(a.radius)}u、${a.durationSeconds}秒、最多${a.targets}普通敌牵引，结束各${number(a.damage)}伤害 · 已部署保留原伤害和范围`;}
  case 'E16':{const p=pulseStats(base,g.ranks,g.contracts);return `原定每${p.intervalSeconds}秒脉冲：有效锚点优先，否则脚下 · ${number(p.radius)}u最多${p.targets}敌各${number(p.damage)}伤害 · 不双发、不重置周期、不提前引爆`;}
  case 'L1_DAMAGE':return `主弹伤害${damage} · 铃术技能S ${number(d)} · 累计基础伤害 +${number(100*n.damage*g.ranks.L1_DAMAGE)}%`;
  case 'L1_RATE':return `主武器${number(w.intervalSeconds)}秒/发 · 累计射速与环铃转速、命中频率 +${number(100*n.rate*g.ranks.L1_RATE)}%`;
  case 'L1_HEART':return `生命上限${current.maxHp} · 累计上限 +${n.heart*g.ranks.L1_HEART} · 取得时回复已结算`;
  case 'L1_RELOAD':return `自动装填${number(w.reloadSeconds)}秒 · 累计装填速度 +${number(100*n.reload*growthRank(g.ranks,id))}%`;
  case 'L1_RANGE':return `索敌射程${number(w.targetRange)}u · 不扩大区域技能半径`;
  case 'L1_MOVE':return `移动速度${number(current.moveSpeed)}u/s · 不改变受击范围`;
  case 'L1_SPLIT':case 'L1_EVO_BARRAGE':return `主弹${w.pellets}颗 · 每颗${damage}伤害 · 总散角${number(w.spreadDegrees)}° · 每齐射1发`;
  case 'L1_PIERCE':case 'L1_EVO_PIERCE':return `主弹最多命中${w.extraPierce+1}个目标 · 后续逐敌 ×${number(w.pierceDamageMultiplier*100)}% · 副弹不穿透`;
  case 'L1_ECHO':return `尾弹附${N.tailCount}颗，各${number(w.damage*base.directDamageMultiplier*N.tailDamage)}伤害 · ±${N.tailAngle}° · 不穿透、不递归`;
  case 'L1_EVO_CADENCE':return [growthChange(id,g,base),cadencePassiveDetail(base)].filter(Boolean).join(' · ');
  case 'L1_SHOCK_BELL':return `${number(N.shockRadius*q)}u震荡 · 最多${N.shockTargets}个其他敌人，各受首次主弹命中伤害${N.shockDamage*100}%${base.openingPower?'（不计装填强化）':''}`;
  case 'L1_RICOCHET':return `主弹穿透用尽后${N.ricochetRange}u内转向1次 · 末次穿透伤害 ×${N.ricochetDamage*100}% · 仅新目标`;
  case 'L1_TRAIL_BELL':case 'L1_DUO_TRAIL_CADENCE':return `每${N.trailDistance}u留铃${g.ranks.L1_DUO_TRAIL_CADENCE?'，装填期间每'+N.duoTrailDistance+'u':''} · 最多${g.ranks.L1_DUO_TRAIL_CADENCE?N.duoTrailMax:N.trailMax}枚 · 长期留存，满额替最早 · 每敌${number(d*N.trailDamage)}伤害`;
  case 'L1_ORBIT_BELL':{const s=orbitStats(growthRank(g.ranks,id),g.ranks.L1_RATE,n.rate);return `Lv.${growthRank(g.ranks,id)} · ${s.count}枚 · 每次${number(d*s.damageCoefficient)}伤害 · ${number(N.orbitRadius*q)}u · ${number(s.period)}秒/圈 · 同敌共享${number(s.cooldown)}秒冷却`;}
  case 'L1_PICKUP_CHIME':return `拾取${N.chimeXP}经验，下次齐射附1颗${number(d*N.chimeDamage)}伤害副弹 · 蓄满溢出不留`;
  case 'L1_LIGHT_MAG':return `弹匣${w.ammoCapacity}发 · 自动装填${number(w.reloadSeconds)}秒 · 取得不补弹`;
  case 'L1_DUO_STAR_RING':{const s=orbitStats(growthRank(g.ranks,'L1_ORBIT_BELL'),g.ranks.L1_RATE,n.rate);return `实际蓄满触发${N.starSeconds}秒星环 · ${s.count}枚 · ${number(N.starRadius*q)}u · 当前级每次${number(d*s.damageCoefficient*N.starDamage)}伤害 · 不补触发`};
  case 'A11':return `当前主弹暴击率${number(g.projectileTraits.criticalChance*100)}% · 上限${N.criticalChanceMax*100}% · 副弹与独立技能不变`;
  case 'A12':return `当前主弹暴击倍率${number(g.projectileTraits.criticalMultiplier)}倍 · 非暴击与副弹不变`;
  case 'M06':return `主弹总散角${number(w.spreadDegrees)}° · ${w.pellets}颗各${damage}伤害 · 横向覆盖缩小，副弹不变`;
  case 'C23':case 'E21':return `每${N.rhythmRoots}次真实齐射，延迟${g.ranks.M31?N.rhythmRetargetDelay:N.rhythmDelay}秒附${g.ranks.E21?N.rhythmSequenceCount+'颗各'+N.rhythmSequenceDamage*100:1+'颗'+N.rhythmDamage*100}%副弹 · 不额外耗弹、不穿透`;
  case 'M31':return `节拍延迟${N.rhythmRetargetDelay}秒 · 到时重选射程内最近敌人 · 无目标跳过`;
  case 'A15':return `投射弹速${number(w.bulletSpeed)}u/s · 寿命${number(w.bulletLifeSeconds)}秒 · 最大直线距离${number(w.bulletSpeed*w.bulletLifeSeconds)}u`;
  case 'M05':return g.ranks.E23?`主弹返回固定发射原点 · 镜面回程最多${w.extraPierce+1}目标 · 可再击去程旧敌，每程一次`:`主弹返回发射原点 · 回程仅1个新目标 · 末段非暴击本体${N.returnDamage*100}% · 副弹不返航`;
  case 'M09':return `后续逐敌伤害 ×${number(w.pierceDamageMultiplier*100)}% · 最多${w.extraPierce+1}个目标 · 首目标${damage}伤害`;
  case 'C18':return `每${N.huntPeriodSeconds}秒标记当前生命最高敌4秒 · 主弹对其+15% · ${w.targetRange}u内优先，离程回近敌`;
  case 'M26':return `标记目标死亡，向死亡点${N.huntTransferRange}u内另一高生命敌传承一次 · 只保留剩余时间，不续时`;
  case 'M12':return `每次真实装填后${N.hotStartVolleys}次齐射的下一枪等待 ${hotStartTiming(w.intervalSeconds)} · 不缩装填，不提前首枪`;
  case 'E23':return `回程最多${w.extraPierce+1}目标 · 可再击去程旧敌 · 回程首段为去程末段本体${N.returnDamage*100}%，之后逐敌×${w.pierceDamageMultiplier} · 每程每敌一次`;
 }
}
function courtyardGrowthPage(g:GrowthSnapshot,base:RunConfig,selected:string|undefined,options:GrowthPresentation){
 const offer=g.offer!,key=g.runId+'.'+offer.id+'.',elite=offer.source==='elite';
 const body=`<section class="court-reward-heading" data-reward-source="${offer.source}"><div>${courtyardBadge('Lv.'+g.level)}${courtyardBadge(elite?'精英战利品':'经验升级',elite?'elite':'')}</div><p class="court-reward-state"><strong>战斗已暂停</strong><span>${offer.choices.length}项可选</span></p>${elite?courtyardNotice(eliteRecoveryText(g,base,selected,options.playerHp)):''}<p class="court-reward-route">${esc(routeStatus(g))}</p>${g.pending>1?`<p class="court-reward-queue">连续奖励 · 本次确认后还有${g.pending-1}次选择</p>`:''}</section><div class="court-reward-cards">`+offer.choices.map(id=>{
  const c=growthCard(id)!,summary=growthCardSummary(id,g,base),rank=growthRank(g.ranks,id),chosen=selected===id;
  const entering=!!options.motion?.enter,picking=chosen&&options.motion?.selected===id;
  return `<article class="court-card court-reward-card kind-${c.kind}${c.kind==='tradeoff'||id==='L1_LIGHT_MAG'||id==='M06'?' has-actual-cost':''}${chosen?' is-selected':''}${entering?' is-entering':''}${picking?' is-picking':''}" data-growth-id="${id}"><div class="court-card-surface"><div class="court-card-inner"><button type="button" class="court-reward-choice" data-action="growth-select:${key+id}" aria-pressed="${chosen}"><span class="court-reward-title">${assetImage(c.icon,'court-growth-icon')}<span><small>${esc(id==='L1_ORBIT_BELL'&&rank?'能力升级':kindName[c.kind])}${c.kind==='attribute'?`<span class="n1-inline-count"> · 已选${rank}次</span>`:''}${chosen?' · 已选中':''}</small><strong>${esc(c.name)}</strong></span></span><span class="court-reward-benefit">${esc(chosen&&c.kind==='attribute'?growthComparison(growthChange(id,g,base)):summary.benefit)}</span>${chosen&&c.kind!=='attribute'?`<span class="court-reward-change">${esc(growthComparison(growthChange(id,g,base)))}</span>`:''}${summary.cost?`<span class="court-reward-cost"><b>${c.kind==='tradeoff'||id==='L1_LIGHT_MAG'||id==='M06'?'代价':'规则与条件'}</b>${esc(summary.cost)}</span>`:''}<span class="court-reward-rank">${esc(id==='L1_ORBIT_BELL'?'Lv.'+rank+' → Lv.'+Math.min(3,rank+1):c.kind==='attribute'?'已选'+rank+'次 · 本次为第'+(rank+1)+'次':c.kind==='evolution'||c.kind==='combination'?'满足前置后，确认取得':'本局取得一次')}</span></button><button type="button" class="court-reward-detail" data-action="growth-detail:${id}" aria-label="${esc(c.name)}：查看规则">详情</button>${entering||picking?'<span class="court-reward-spark one" aria-hidden="true"></span><span class="court-reward-spark two" aria-hidden="true"></span>':''}</div></div></article>`;
 }).join('')+'</div>';
 return {courtyardUI:true,growthUI:true,body,footer:`<p class="court-reward-hint">点卡片选中 · 确认后取得奖励</p><div class="growth-confirm">${courtyardButton('growth-confirm:'+key+(selected||''),selected?'确认选择 · '+cardName(selected as GrowthId):'先选择一项奖励',{kind:'gold',disabled:!selected})}</div><div class="court-reward-tools">${courtyardButton('build','本局构筑',{kind:'quiet'})}${courtyardButton('settings','设置',{kind:'quiet'})}</div>`};
}
function courtyardGrowthBuild(g:GrowthSnapshot,base?:RunConfig){
 const cards=growthCards(base).filter(c=>growthRank(g.ranks,c.id)>0);
 return `<section class="court-build-summary">${courtyardBadge('Lv.'+g.level)}${courtyardBadge('已取得'+cards.length+'项')}<p>已拾取${g.totalXP}经验 · 仅本次守护生效</p></section>`+
  (g.eliteRewards.length?`<section class="court-growth-section"><h2>精英战利品</h2>${g.eliteRewards.map(e=>courtyardNotice(cardName(e.cardId)+' · 实际回复'+number(e.recovered)+'生命')).join('')}</section>`:'')+
  `<section class="court-growth-section"><h2>已获得的成长</h2>${cards.length?cards.map(c=>`<article class="court-card court-build-card"><div class="court-card-surface"><div class="court-card-inner"><div class="court-build-title">${assetImage(c.icon,'court-growth-icon')}<div><small>${esc(kindName[c.kind])}</small><strong>${esc(c.name)}</strong><span>${esc(ownedStatus(c.id,g))}</span></div></div><p>${esc(growthCurrentEffect(c.id,g,base))}</p>${courtyardButton('growth-owned-detail:'+c.id,'查看完整规则',{kind:'quiet'})}</div></div></article>`).join(''):courtyardNotice('还没有取得成长，靠近击败怪物留下的星光拾取经验。')}</section>`+
  `<section class="court-growth-section"><h2>路线与组合条件</h2>${growthConditions(g)||courtyardNotice(routeStatus(g))}</section>`;
}
function courtyardGrowthDetail(id:GrowthId,g:GrowthSnapshot|undefined,base:RunConfig|undefined,owned:boolean){
 const c=growthCard(id)!,summary=g&&base&&!owned?growthCardSummary(id,g,base):undefined;
 return {courtyardUI:true,title:c.name,body:`<article class="court-card court-growth-detail"><div class="court-card-surface"><div class="court-card-inner"><div class="court-build-title">${assetImage(c.icon,'court-growth-icon')}<div>${courtyardBadge(kindName[c.kind])}<h2>${esc(c.name)}</h2>${g?`<span>${esc(ownedStatus(id,g))}</span>`:''}</div></div>${g&&base?`<section class="court-growth-section"><h3>${owned?'当前效果':'主要收益'}</h3><p class="court-reward-benefit">${esc(owned?growthCurrentEffect(id,g,base):summary!.benefit)}</p>${summary?.cost?`<p class="court-reward-cost"><b>${c.kind==='tradeoff'||id==='L1_LIGHT_MAG'||id==='M06'?'代价':'规则与条件'}</b>${esc(summary.cost)}</p>`:''}${!owned?`<h3>本次变化</h3><p>${esc(growthChange(id,g,base))}</p>`:''}</section>`:''}<section class="court-growth-section"><h3>完整规则</h3><p>${esc(cardDetail(id,g,base))}</p></section>${courtyardStat('取得方式',id==='L1_ORBIT_BELL'?'每次提升1级，最高3级':c.kind==='attribute'?(c.limit===null?'可重复选择，不以三次封顶':'可重复，达到现有上限后退出候选'):c.kind==='core'||c.kind==='attachment'?'本局获得一次':'满足条件后选择一次')}${g?growthConditions(g,id):''}</div></div></article>${courtyardNotice('仅在这次守护中生效；查看规则不会选中或确认卡片。')}`,footer:courtyardButton('close',owned?'返回本局构筑':'返回选择',{kind:'gold'})};
}
