import type {GrowthTuning,RunConfig} from './combat-config';
import {CONTRACT_NUMBERS,MOVEMENT_CONTRACT_NUMBERS as MOVEMENT} from './contract-rules';
import {DEFENSE_NUMBERS as DEFENSE} from './player-defense-rules';
import {SUSTAIN_NUMBERS as SUSTAIN} from './sustain-rules';
export type AttributeId='L1_DAMAGE'|'L1_RATE'|'L1_HEART'|'L1_RELOAD'|'L1_RANGE'|'L1_MOVE'|'A11'|'A12'|'A15'|'A07'|'A08'|'A10'|'A16';
export type AbilityId='L1_SPLIT'|'L1_PIERCE'|'L1_ECHO'|'L1_EVO_BARRAGE'|'L1_EVO_PIERCE'|'L1_EVO_CADENCE'|'L1_SHOCK_BELL'|'L1_RICOCHET'|'L1_LIGHT_MAG'|'L1_TRAIL_BELL'|'L1_ORBIT_BELL'|'L1_PICKUP_CHIME'|'L1_DUO_TRAIL_CADENCE'|'L1_DUO_STAR_RING';
export type GrowthId=AttributeId|AbilityId|'M06'|'C23'|'M31'|'E21'|'M05'|'M09'|'C18'|'M26'|'M12'|'E23'|'C15'|'C16'|'E16'|'A13'|'C13'|'C12'|'E14'|'C21'|'M10'|'R04'|'R05'|'R06'|'R07';
export type GrowthRanks=Record<'L1_DAMAGE'|'L1_RATE'|'L1_HEART',number>&Partial<Record<Exclude<GrowthId,'L1_DAMAGE'|'L1_RATE'|'L1_HEART'>,number>>;
export type GrowthCard={id:GrowthId;name:string;icon:string;kind:'attribute'|'core'|'evolution'|'attachment'|'combination'|'tradeoff';limit:number|null;effect:string;detail:string};
export type GrowthAttributeNumbers=Readonly<{damage:number;rate:number;heart:number;reload:number;range:number;move:number}>;
export const ATTRIBUTE_PLANS:Readonly<Record<GrowthTuning['attributePlan'],GrowthAttributeNumbers>>=Object.freeze({
 A:Object.freeze({damage:.2,rate:.15,heart:15,reload:.2,range:.15,move:.1}),
 B:Object.freeze({damage:.1,rate:.08,heart:8,reload:.1,range:.08,move:.05})
});
export const growthNumbers=(plan:GrowthTuning['attributePlan']='A'):GrowthAttributeNumbers=>ATTRIBUTE_PLANS[plan];
export const GROWTH_NUMBERS=Object.freeze({...ATTRIBUTE_PLANS.A,criticalChance:.05,criticalMultiplier:1.5,criticalChanceStep:.1,criticalChanceMax:.6,criticalMultiplierStep:1,clusterSpread:.25,splitDamage:.8,splitSpread:8,
 flightSpeed:.1,returnDamage:.7,returnOriginRadius:8,returnLife:2,pressuredPierce:.85,huntPeriodSeconds:4,huntDamageMultiplier:1.15,huntTransferRange:120,hotStartVolleys:2,hotStartIntervalMultiplier:.75,
 rhythmRoots:4,rhythmDelay:.18,rhythmDamage:.6,rhythmRetargetDelay:.5,rhythmSequenceStep:.06,rhythmSequenceCount:3,rhythmSequenceDamage:.3,rhythmSequenceAngle:12,
 tailCount:2,tailDamage:.25,tailAngle:18,openingCount:3,openingDamage:.5,openingSpread:24,cadenceVolleys:3,shockRadius:32,shockDamage:.35,shockTargets:6,ricochetRange:120,ricochetDamage:.6,lightReload:.8,trailDistance:180,trailSize:12,trailArm:.25,trailTrigger:30,trailRadius:42,trailTargets:6,trailDamage:.9,trailMax:6,duoTrailDistance:60,duoTrailMax:9,projectileCapacity:32,orbitCount:2,orbitMax:4,orbitSize:16,orbitRadius:60,orbitPeriod:2.4,orbitHitRadius:8,orbitCooldowns:Object.freeze([.8,.7,.5]),orbitDamages:Object.freeze([.75,1,1.4]),chimeXP:8,chimeDamage:.75,starRadius:80,starDamage:1.5,starSeconds:3,starTransition:.2});
export const GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'L1_DAMAGE',name:'力量增幅',icon:'BALL.svg',kind:'attribute',limit:null,effect:'武器与铃术基础伤害 +20%',detail:'每次增加基础主弹及独立铃术基数D的20%，D以12起算，不套武器单弹伤害、角色直接伤害修正或分弹系数，同类加成相加；副弹、环铃、地铃和拾光受益，已部署地铃保留原伤害。可以继续选择，不以三次封顶。'},
 {id:'L1_RATE',name:'攻击节奏',icon:'MAG.svg',kind:'attribute',limit:null,effect:'武器射速与环铃转速、命中频率 +15%',detail:'累计倍率H=1+15%×次数；主武器射击间隔、环铃一周时间与同敌共享冷却均除以H，保留相位和冷却完成比例。装填、星环3秒窗口与移动不变，可以继续选择。'},
 {id:'L1_HEART',name:'元气满满',icon:'GUARD.svg',kind:'attribute',limit:null,effect:'生命上限 +15，恢复15生命',detail:'每次提高15生命上限，并立即恢复15生命；增量回复只发生一次。'},
 {id:'L1_RELOAD',name:'灵巧装填',icon:'MAG.svg',kind:'attribute',limit:null,effect:'自动装填速度 +20%',detail:'每次增加20%装填速度，时间为基础装填时间除以累计速度倍率。正在装填时保持完成比例，不提前补满弹匣。'},
 {id:'L1_RANGE',name:'远距感知',icon:'BALL.svg',kind:'attribute',limit:null,effect:'索敌射程 +15%',detail:'每次增加基础索敌半径的15%，弹速不变，弹丸寿命至少覆盖新射程。更容易把敌人引成一列贯穿。'},
 {id:'L1_MOVE',name:'轻巧猫步',icon:'MOVE.svg',kind:'attribute',limit:null,effect:'移动速度 +10%',detail:'每次增加初始移速的10%，不改变猫咪体型和受击范围。移动与自动射击、装填仍可同时进行。'},
 {id:'L1_SPLIT',name:'多重投射',icon:'BALL.svg',kind:'core',limit:1,effect:'主弹数 n → n+1，保持整轮基础伤害',detail:'在武器原生主弹数n上增加1颗、原扇面增加8°，单颗系数max(0.8,n/(n+1))，整轮伤害不降低。每齐射仍只消耗1发，副弹数量不变。伤害／射速累计两次后可选择彗星弹幕。'},
 {id:'L1_PIERCE',name:'贯穿弹芯',icon:'BALL.svg',kind:'core',limit:1,effect:'主弹多穿过1个目标，后续伤害70%',detail:'在武器原生穿透额度上增加1个目标，每个后续目标伤害递乘70%。通过走位把怪引成线，伤害／射程累计两次后可进阶。副弹不继承穿透。'},
 {id:'L1_ECHO',name:'尾弹回响',icon:'MAG.svg',kind:'core',limit:1,effect:'最后一发额外射出2颗回响副弹',detail:'弹匣最后一发附带左右各一颗回响，角度±18°，每颗为当前单颗主弹25%伤害。仍只扣根齐射1弹药；回响不再分弹或穿透，不递归触发。装填／射速累计两次后可进阶。'},
 {id:'L1_EVO_BARRAGE',name:'彗星弹幕',icon:'BALL.svg',kind:'evolution',limit:1,effect:'主弹数 n+1 → n+2，保留多重投射系数',detail:'在武器原生主弹数n上累计增加2颗、原扇面增加8°，每齐射1弹药；保留多重投射的max(0.8,n/(n+1))系数，只应用一次。需要分弹核心＋伤害／射速累计两次，选择后生效。'},
 {id:'L1_EVO_PIERCE',name:'长虹贯穿',icon:'BALL.svg',kind:'evolution',limit:1,effect:'主弹在原生额度上累计多穿2个目标',detail:'在原生额度上累计增加2个穿透目标，每个后续目标伤害递乘70%；同一敌人每颗弹最多命中一次。需要贯穿核心＋伤害／射程累计两次。孤立Boss不会凭空多受两次伤害。'},
 {id:'L1_EVO_CADENCE',name:'连奏风暴',icon:'MAG.svg',kind:'evolution',limit:1,effect:`装填后连续${GROWTH_NUMBERS.cadenceVolleys}次齐射，各附${GROWTH_NUMBERS.openingCount}颗${GROWTH_NUMBERS.openingDamage*100}%副弹`,detail:`真正完成自动装填后的${GROWTH_NUMBERS.cadenceVolleys}次实际根齐射，各附${GROWTH_NUMBERS.openingCount}颗${GROWTH_NUMBERS.openingDamage*100}%副弹，左右最外各偏${GROWTH_NUMBERS.openingSpread/2}°。尾弹独立。无目标或暂停不消费，新装填重置为${GROWTH_NUMBERS.cadenceVolleys}次。需要回响核心＋装填／射速累计两次。`},
 {id:'L1_SHOCK_BELL',name:'震荡回响',icon:'BALL.svg',kind:'attachment',limit:1,effect:'每次齐射首次主弹命中，震荡最多6个其他敌人',detail:'需要任一已持核心。每次根齐射的首次主弹实际命中敌人，产生32u震荡；最多6个其他存活敌人各受该次实际命中伤害35%，按距离、稳定出生ID选择。排除直接受击者，副弹与震荡不再触发。'},
 {id:'L1_RICOCHET',name:'折射弹道',icon:'BALL.svg',kind:'attachment',limit:1,effect:'主弹穿透用尽后转向一次，伤害×0.6',detail:'需要任一已持核心。每颗主弹用完原穿透额度后，转向120u内最近未命中的存活敌人一次，伤害为最后一次穿透伤害的60%。沿用同一弹丸、命中账与剩余寿命；下一次命中结束，无目标也结束。副弹不弹跳，孤立Boss不会反复受击。'},
 {id:'L1_TRAIL_BELL',name:'猫步留铃',icon:'MOVE.svg',kind:'core',limit:1,effect:'每移动180u留下一枚地铃',detail:'实际走位每180u留下12u地铃；0.25秒后布防，长期留存，最多6枚。敌人进入30u触发一次42u爆炸，最近最多6敌各受90%基础成长伤害；分弹不降低此伤害。满额新铃替换最早地铃，不引爆。相关属性：轻巧猫步、力量增幅。'},
 {id:'L1_ORBIT_BELL',name:'环身飞铃',icon:'BALL.svg',kind:'core',limit:3,effect:'环铃3级：2→3→4枚，伤害75%→100%→140%',detail:'每次选择提升1级，最高3级；1／2／3级分别有2／3／4枚16u飞铃，以60u半径、基础2.4秒一圈持续环绕，真实命中半径8u。同一敌人共享冷却分别为0.8／0.7／0.5秒，1／2／3级每次75%／100%／140%独立基础成长伤害D，射速倍率H同时缩短一周时间和共享冷却，装填时继续。升级保留转动相位和同敌冷却完成比例，不补伤害或拾光蓄能。飞铃不挡弹、不免伤，不触发其他配件。相关属性：力量增幅、攻击节奏、元气满满。'},
 {id:'L1_PICKUP_CHIME',name:'拾光共鸣',icon:'BALL.svg',kind:'attachment',limit:1,effect:'拾取8经验，下一次齐射附一颗75%副弹',detail:'需要任一已持核心。取得之后实际拾取的经验蓄能，8点充满，溢出蓄能不保留但经验照常全额获得。下次实际根齐射发出一颗75%基础成长伤害副弹，不分弹、穿透或触发其他能力；无目标、暂停或装填不消耗。'},
 {id:'L1_LIGHT_MAG',name:'轻装弹匣',icon:'MAG.svg',kind:'attachment',limit:1,effect:'基础弹匣减半向上取整，实际装填时间×0.8',detail:'需要尾弹回响。弹匣按基础容量减半向上取整，至少1发（12→6、4→2），更频繁触发尾弹与真实装填；先计算装填属性，再将时间乘0.8。取得时只截断多余余弹，不补弹；正在装填保持完成比例，不伪造开局或装填奖励。'},
 {id:'L1_DUO_TRAIL_CADENCE',name:'疾走铃阵',icon:'MOVE.svg',kind:'combination',limit:1,effect:'地铃长期留存，最多9枚；装填期间每60u留铃',detail:'选择后地铃持有上限6→9枚，长期留存；满额新铃替换最早一枚，不引爆。装填结束保留已有地铃。只有实际自动装填期间，留铃间距180→60u；切换保留路程完成比例。正常走位仍每180u留铃，停住与继续不会补放，伤害和布防时间不变。'},
 {id:'L1_DUO_STAR_RING',name:'巡游星环',icon:'BALL.svg',kind:'combination',limit:1,effect:'拾光实际蓄满，环铃扩大至80u、当前级伤害×1.5，持续3秒',detail:'选择后，拾光从未满到8经验的真实蓄满事件启动3秒星环，包含0.2秒扩出与0.2秒收回，当前等级的2／3／4枚环铃全程造成当前等级普通伤害×1.5（112.5%／150%／210%D），继承该级同敌0.8／0.7／0.5秒再除以射速倍率H的共享冷却。再次真实蓄满只刷新时间；升级不补蓄能或额外伤害。取得时已有满格不会补触发，孤立Boss没有经验则不会续时；原拾光副弹照常。'},
 {id:'A11',name:'弱点洞察',icon:'BALL.svg',kind:'attribute',limit:Math.ceil((GROWTH_NUMBERS.criticalChanceMax-GROWTH_NUMBERS.criticalChance)/GROWTH_NUMBERS.criticalChanceStep),effect:`主弹暴击率 +${GROWTH_NUMBERS.criticalChanceStep*100}个百分点，上限${GROWTH_NUMBERS.criticalChanceMax*100}%`,detail:`初始主弹暴击率${GROWTH_NUMBERS.criticalChance*100}%，每次增加${GROWTH_NUMBERS.criticalChanceStep*100}个百分点，上限${GROWTH_NUMBERS.criticalChanceMax*100}%；最后一次只增加剩余额度，达到上限后不再出现。每颗主弹生成时独立抽取一次，穿透与折射沿用同颗结果，已有弹丸不重新抽取；副弹、伙伴和独立技能不受益。`},
 {id:'A12',name:'致命一击',icon:'BALL.svg',kind:'attribute',limit:null,effect:`主弹暴击倍率 +${GROWTH_NUMBERS.criticalMultiplierStep.toFixed(1)}`,detail:`主弹暴击倍率由${GROWTH_NUMBERS.criticalMultiplier}起算，每次增加${GROWTH_NUMBERS.criticalMultiplierStep.toFixed(1)}，可持续重复选择。只提高真实暴击主弹的伤害，非暴击基伤不变；已有弹丸保留生成时的倍率，副弹、伙伴和独立技能不受益。`},
 {id:'M06',name:'集束校准',icon:'BALL.svg',kind:'attachment',limit:1,effect:`主弹最终总散角 ×${GROWTH_NUMBERS.clusterSpread}`,detail:`需要原生多弹主武器或已取得多重投射，且当前主弹有非零散角。先计算武器、多重投射与彗星弹幕，再把总散角乘${GROWTH_NUMBERS.clusterSpread}。弹数、每颗伤害和每次齐射耗弹不变；只收束主弹，横向覆盖缩小。`},
 {id:'C23',name:'节拍双击',icon:'BALL.svg',kind:'core',limit:1,effect:`每${GROWTH_NUMBERS.rhythmRoots}次齐射，${GROWTH_NUMBERS.rhythmDelay}秒后附1颗${GROWTH_NUMBERS.rhythmDamage*100}%副弹`,detail:'取得后从零计数，每次真正消耗1发的根齐射计一次，散弹仍只计一次；跨装填保留。延迟到时从猫咪当时中心沿原根方向发射，原目标死亡也照常发出。伤害读取触发根的单颗非暴击派生伤害；不额外扣弹、不穿透、不触发其他配件或节拍。相关属性：力量增幅、攻击节奏。'},
 {id:'M31',name:'节拍错峰',icon:'MAG.svg',kind:'attachment',limit:1,effect:`节拍延迟 ${GROWTH_NUMBERS.rhythmDelay} → ${GROWTH_NUMBERS.rhythmRetargetDelay}秒，到时重选最近敌人`,detail:'需要节拍双击；替换后续根齐射的节拍延迟，到时从猫咪当前中心，在触发时保存的射程内重选最近存活敌人，同距按出生顺序。不选择箱子，无敌人就跳过整次，不积压；只改变本次副弹，不改变未来主武器索敌。取得时不重置四拍计数、不赠送攻击，已经排定的节拍保持原样。'},
 {id:'E21',name:'节律弹幕',icon:'BALL.svg',kind:'combination',limit:1,effect:`节拍1颗${GROWTH_NUMBERS.rhythmDamage*100}% → ${GROWTH_NUMBERS.rhythmSequenceCount}颗各${GROWTH_NUMBERS.rhythmSequenceDamage*100}%副弹`,detail:`需要实际取得节拍双击＋多重投射，满足后仍须选中。替换后续节拍的单副弹，首段、＋${GROWTH_NUMBERS.rhythmSequenceStep}、＋${GROWTH_NUMBERS.rhythmSequenceStep*2}秒依次发射，固定角度−${GROWTH_NUMBERS.rhythmSequenceAngle}°／0°／＋${GROWTH_NUMBERS.rhythmSequenceAngle}°，各为触发根单颗非暴击伤害的${GROWTH_NUMBERS.rhythmSequenceDamage*100}%。节拍错峰只在首段重选，后两段沿同一首段方向；每段从当时猫咪中心发射，集束校准不收束此扇角。不会额外保留原单副弹，不额外扣弹或触发根齐射。`},
 {id:'A15',name:'飞行加速',icon:'BALL.svg',kind:'attribute',limit:null,effect:'投射弹速 +10%，同类相加',detail:'每次弹速增加10%，同类相加；V＝1＋0.1×次数，弹速为基础弹速×V，寿命为max(基础寿命／V，当前索敌射程／派生弹速)，保持同一射程下的最大直线飞行距离。只改变新生成主弹及读取武器弹速／寿命的副弹，已发弹与已排定节拍保留原参数，星灵不变。可以重复选择，不以三次封顶。'},
 {id:'M05',name:'返航轨迹',icon:'BALL.svg',kind:'attachment',limit:1,effect:'主弹去程结束后返回发射原点，回程打1个新目标',detail:'真实主弹投射武器即可选择，无需先取得核心。主弹去程达到当发索敌射程，或穿透及一次折射机会用尽后，沿直线返回发射原点；回程仅可命中1个全程尚未命中的新目标。伤害为去程末段非暴击本体的70%，沿用出生时暴击结果。使用同一弹丸，硬寿命最多为当发非返航寿命的2倍，到达原点附近8u或越界回收；副弹与星灵不返航，已发弹不补返航。'},
 {id:'M09',name:'逐敌增压',icon:'BALL.svg',kind:'attachment',limit:1,effect:'后续穿透目标伤害逐次由70%改为85%',detail:'需要主武器原生有额外穿透，或实际取得贯穿弹芯。逐目标伤害衰减由70%改为85%，不改变目标额度、首目标伤害或基础伤害；小鱼干原生即可选择。返航转换仍为70%，折射仍为60%，已发弹保留原衰减；不让副弹或星灵获得穿透。'},
 {id:'C18',name:'追猎标记',icon:'BALL.svg',kind:'core',limit:1,effect:'每4秒盯住射程内当前生命最高的敌人，主弹对其+15%',detail:'每4秒标记射程内当前生命最高的存活敌人4秒，同生命按出生ID稳定选择。主武器优先该目标，主弹实际直接命中伤害×1.15；副弹、伙伴、地铃、环铃不独立加成，震荡只按实际主弹伤害派生。可能放过近身小怪；标记离开射程时回到最近敌，回来可恢复优先。空窗口仍消耗4秒，不积压，不手动点选。'},
 {id:'M26',name:'标记传承',icon:'MAG.svg',kind:'attachment',limit:1,effect:'标记目标死亡，将剩余标记时间传给120u内另一敌人一次',detail:'需要实际取得追猎标记。标记目标真实死亡后，从死亡点120u内按当前生命最高、出生ID稳定选另一存活敌人；只传剩余时间，不重新续满4秒，每个窗口最多传承一次。新目标可以在玩家射程外，但不会因此越程开火；无候选或剩余时间耗尽时清除标记，等下一个正常窗口。'},
 {id:'M12',name:'热启动',icon:'MAG.svg',kind:'attachment',limit:1,effect:`真实装填完成后的前${GROWTH_NUMBERS.hotStartVolleys}次齐射，下一枪等待×${GROWTH_NUMBERS.hotStartIntervalMultiplier}`,detail:`选中后真实完成自动装填，获得${GROWTH_NUMBERS.hotStartVolleys}次热启动。每次真正耗弹的根齐射，将其建立的后续射击冷却乘${GROWTH_NUMBERS.hotStartIntervalMultiplier}；不提前装填后的首枪、不缩短装填、不额外发弹。空目标不消耗；多颗散弹仍只算一次，副弹和节拍不消耗。新一次装填重置${GROWTH_NUMBERS.hotStartVolleys}次，不叠加；开局与选卡前已完成的装填不追认。`},
 {id:'E23',name:'镜面回廊',icon:'BALL.svg',kind:'combination',limit:1,effect:'返航可再打去程旧敌，回程目标额度等于出发时的贯穿额度',detail:'需要实际选过贯穿弹芯＋返航轨迹，再选择本卡生效；雪团原生贯穿不代替已选核心。用同一颗弹丸直返固定发射原点，回程额度为出发时1＋额外穿透；每个出生ID每程最多一次，全程最多两次。回程首段为去程末段非暴击本体×0.7，后续仍按逐敌系数衰减；暴击沿用，标记在本次命中读取。回程不再折射，不额外耗弹或触发节拍，首次命中信用不重复。'},
];
// The normal courtyard admits these six; controlled fixtures opt in explicitly.
export const AREA_GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'A07',name:'技能专精',icon:'MAG.svg',kind:'attribute',limit:null,effect:'独立技能与原生星灵伤害 +25%',detail:'K＝1＋25%×次数，与力量分别相乘。独立技能以12及当前力量起算；原生星灵仅以原6×K，不新增力量收益。主弹、武器派生副弹和震荡不受益；已部署地铃保留伤害。可以重复选择，无额外次数上限。'},
 {id:'A08',name:'广域共振',icon:'BALL.svg',kind:'attribute',limit:null,effect:'区域半径、环铃轨道与铃体 +5%',detail:'Q＝1＋5%×次数。扩大震荡、地铃触发与爆炸、环铃轨道和铃体及脉冲半径；已有地铃保留部署范围，环铃保留相位、共享冷却与星环过渡。目标上限和频率不变，不改变武器索敌、弹丸、拾取或原生星灵。可以重复选择，无额外次数上限。'},
 {id:'A10',name:'灵敏拾取',icon:'MOVE.svg',kind:'attribute',limit:null,effect:'经验吸附启动半径 +10%',detail:'吸附启动半径＝40×（1＋10%×次数）u；领取8u、速度上限360u/s、96槽及满槽合并不变。已吸附经验继续跟随，不增加掉落或经验倍率，不立即领取。可以重复选择，无额外次数上限。'},
 {id:'C15',name:'脉冲领域',icon:'BALL.svg',kind:'core',limit:1,effect:'每3秒脚下脉冲，最多8敌各受70%技能伤害',detail:'取得后首次等待3秒，此后每3秒在当前角色物理中心释放48Q u瞬时脉冲。按敌中心距离、出生ID稳定选择最近至多8个存活敌人（含端点），每敌0.7S，S＝12×力量倍率×技能专精K。空目标照常消耗周期，装填期间继续；不打箱子，不暴击、不触发寒意、击退、控制或其他副弹。暂停及后台冻结，结束与重开清除。'},
 {id:'C16',name:'引力锚点',icon:'MAG.svg',kind:'core',limit:1,effect:'每5秒部署2秒锚点，最多牵引8普通敌，结束40%技能伤害',detail:'取得后首次等待5秒，此后每5秒从角色物理中心240u内选择已入院最近存活敌人，同距按出生ID，在其当时位置部署固定锚点；无目标消耗本次机会。半径60Q u，持续2秒，部署时冻结S和Q。最多牵引8个已入院、未冻结且当前AI正在步行的普通E01／E03／E04，只改方向，不增加实际速度；4u内停下。精英和Boss免拉，结束时最近最多8个存活敌人各受0.4S，含精英Boss。部署和牵引不造成伤害；不暴击、不触发寒意、标记或副弹。暂停及后台冻结，结束与重开清除。'},
 {id:'E16',name:'脉冲引爆',icon:'BALL.svg',kind:'combination',limit:1,effect:'有有效锚点时，将当次定时脉冲移到锚点',detail:'需要实际选择脉冲领域＋引力锚点，再选择本卡生效，无额外属性要求。C15原定3秒周期到时，若有尚未到期的本局锚点，只把这一发脉冲移到锚点中心；否则仍在角色脚下。保留当前48Q u、0.7S和8敌上限，不双发、不赠送脉冲、不重置任一周期、不提前引爆锚点。锚点活动区间含部署端、不含到期端；同帧先结束旧锚，再部署新锚，最后确定脉冲位置。'},
];
export const DEFENSE_GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'C12',name:'定点哨卫',icon:'BALL.svg',kind:'core',limit:1,effect:'每6秒脚下部署6秒哨卫，180u内自动射击',detail:'取得后等待6秒，随后每6秒在角色当前中心部署固定哨卫，持续6秒。每1/F秒选择自身180u内最近存活已入院敌人，同距按出生ID；首发等待完整间隔，空目标消耗机会。每弹为发射时60%技能S，600u/s、1秒寿命，方向锁定。受力量、技能专精和伙伴默契影响；不暴击、不打箱子、不触发主弹配件或其他副弹，广域共振不扩大180u。'},
 {id:'A16',name:'伙伴默契',icon:'MAG.svg',kind:'attribute',limit:null,effect:'原生星灵与定点哨卫攻击频率 +10%',detail:'需要原生星灵或实际取得定点哨卫。F＝1＋10%×次数，两类伙伴间隔除以F，升级保留完成比例，不赠攻击。哨卫部署与6秒寿命不变，有限寿命下离散总弹数可能不按10%增加；主弹和其他技能不变。可以重复选择，无额外次数上限。'},
 {id:'A13',name:'坚实皮毛',icon:'GUARD.svg',kind:'attribute',limit:null,effect:`护甲 +${DEFENSE.armorPerRank}，先减伤再由护盾和生命承受`,detail:`每次护甲增加${DEFENSE.armorPerRank}；护甲A令有效敌伤乘${DEFENSE.armorScale}／(${DEFENSE.armorScale}＋A)，随后依次扣护盾和生命。浮点结算，无最低1伤害或护甲暗上限；沿用共用受击间隔。可以重复选择，不以三次封顶。`},
 {id:'C13',name:'能量护盾',icon:'GUARD.svg',kind:'core',limit:1,effect:`护盾上限为最大生命${DEFENSE.shieldFraction*100}%，脱战${DEFENSE.shieldWaitSeconds}秒后每秒恢复上限${DEFENSE.shieldRatePerSecond*100}%`,detail:`首次取得满盾，不治疗生命。有效敌伤先护甲、再护盾、再生命；真实吸盾或生命实损都重新等待${DEFENSE.shieldWaitSeconds}秒，其后连续每秒恢复护盾上限${DEFENSE.shieldRatePerSecond*100}%。生命成长仅扩大盾上限，不补盾；精英生命恢复不补盾。暂停冻结，终局不恢复，重开清除。护盾不提供技能专精、广域共振或旧配件的核心资格。`},
 {id:'E14',name:'移动堡垒',icon:'BALL.svg',kind:'combination',limit:1,effect:'护盾为正时哨卫随行，附着新弹伤害打八折',detail:'需要实际选择定点哨卫＋能量护盾，再选择本卡生效；原生星灵不能代替哨卫。正盾时当前哨卫附着猫咪物理中心，破盾落在该帧猫咪中心并固定，盾恢复正值后同座可再附着。附着新弹为48%技能S，落地新弹恢复60%S，已发弹保留原伤害、方向和原点。取得时在场哨卫立即转换形态，空座仍等原6秒部署；不赠攻击、不重置部署、寿命或射击相位。原生星灵不打八折。'},
];
// Normal playtest and controlled pilots share these explicitly gated mechanisms.
export const SUSTAIN_GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'C21',name:'生命回路',icon:'GUARD.svg',kind:'core',limit:1,effect:`主弹对活敌实际伤害的${SUSTAIN.lifeDamageFraction*100}%回复生命，每有效秒最多最大生命${SUSTAIN.lifeCapFraction*100}%`,detail:`每颗根主弹对存活敌人的实际生命下降×${SUSTAIN.lifeDamageFraction*100}%请求回复生命，过量伤害不计。散弹每颗、贯穿不同目标及折射、返航的真实命中按原命中账分别计算。按floor(有效秒)划分窗口，每秒总额至多当前最大生命${SUSTAIN.lifeCapFraction*100}%，只消费实际回复，满生命不占额度，余量不结转；成长与精英治疗不重置。箱子、副弹（含拾光）、星灵、哨卫、地铃、环铃、震荡、脉冲及锚点均不触发；不治疗盾、不产生伤害或经验。此续航核心不提供技能专精、广域共振或旧攻击配件的核心资格。暂停、生命为0或终局不回复，重开清除。`},
 {id:'M10',name:'装填护罩',icon:'GUARD.svg',kind:'attachment',limit:1,effect:`真实开始自动装填时补护盾上限${SUSTAIN.reloadShieldPercent}%，实际补盾间隔至少${SUSTAIN.reloadShieldIntervalSeconds}秒`,detail:`需要实际取得能量护盾和真实弹匣。最后一发真正消耗并开始自动装填时，补min(当前护盾上限${SUSTAIN.reloadShieldPercent}%，缺失护盾)；两次实际正值补盾至少相隔${SUSTAIN.reloadShieldIntervalSeconds}秒有效战斗时间，达到间隔时可再次补盾。满盾不占冷却，受门禁的装填机会不积压；取得时已装填不追补，开局、选卡、容量变化、设置、暂停继续与装填结束均不伪造开始。只补盾不治生命、不清除原护盾恢复等待；轻装与热启动数值不变。补至正盾仅同步移动堡垒附着，不赠攻击、不改旧弹；暂停后台冻结，终局不恢复，重开清除。`},
];
export const CONTRACT_GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'R04',name:'术式专注',icon:'MAG.svg',kind:'tradeoff',limit:1,effect:`独立技能／伙伴伤害×${CONTRACT_NUMBERS.benefit}；武器主／副弹×${CONTRACT_NUMBERS.cost}`,detail:`与纯粹火力互斥，本局取得一次，确认后代价持续生效。至少完成${CONTRACT_NUMBERS.minimumPicks}次真实奖励确认，并同时拥有真实武器攻击和独立伤害源才可出现。独立技能及伙伴伤害×${CONTRACT_NUMBERS.benefit}；根主弹、贯穿／折射／返航及橘团首发、尾弹、连奏、节拍副弹×${CONTRACT_NUMBERS.cost}。拾光虽为副弹仍按独立技能；震荡继承实际主弹命中，不再乘一次。与力量G、技能K分别乘算，不直接改变生命／护盾回复、经验、寒意或牵引。已发飞弹、已部署地铃／锚点及已排定节拍保留原伤害；环铃命中、脉冲释放和伙伴真实开火读取当前伤害。`},
 {id:'R05',name:'纯粹火力',icon:'BALL.svg',kind:'tradeoff',limit:1,effect:`武器主／副弹伤害×${CONTRACT_NUMBERS.benefit}；独立技能／伙伴×${CONTRACT_NUMBERS.cost}`,detail:`与术式专注互斥，本局取得一次，确认后代价持续生效。至少完成${CONTRACT_NUMBERS.minimumPicks}次真实奖励确认，并同时拥有真实武器攻击和独立伤害源才可出现。根主弹、贯穿／折射／返航及橘团首发、尾弹、连奏、节拍副弹×${CONTRACT_NUMBERS.benefit}；独立技能及伙伴伤害×${CONTRACT_NUMBERS.cost}。拾光虽为副弹仍按独立技能；震荡继承实际主弹命中，不再乘一次。与力量G、技能K分别乘算，不直接改变生命／护盾回复、经验、寒意或牵引。已发飞弹、已部署地铃／锚点及已排定节拍保留原伤害；环铃命中、脉冲释放和伙伴真实开火读取当前伤害。`},
];
export const MOVEMENT_GROWTH_CARDS:readonly GrowthCard[]=[
 {id:'R06',name:'疾驰誓约',icon:'MOVE.svg',kind:'tradeoff',limit:1,effect:`实际自主移动时全伤害×${MOVEMENT.movingBenefit}；静止×${MOVEMENT.cost}`,detail:`与扎根誓约互斥，本局取得一次；至少完成${CONTRACT_NUMBERS.minimumPicks}次真实奖励确认且有实际攻击后可出现。只有实际自主走位才算移动；撞墙无位移算静止，镜头滚动不算移动。实际移动时武器与独立技能、伙伴伤害×${MOVEMENT.movingBenefit}，静止时×${MOVEMENT.cost}。可与术式专注或纯粹火力跨组相乘，各乘一次；震荡只继承父伤害。已发弹、已部署地铃／锚点与已排定节拍保留原伤害，环铃命中、脉冲释放和伙伴真实发射读取当前状态。不改变寒意、生命／护盾回复、经验或牵引；暂停、升级、后台冻结，重开清除。`},
 {id:'R07',name:'扎根誓约',icon:'GUARD.svg',kind:'tradeoff',limit:1,effect:`静止满${MOVEMENT.chargeSeconds}秒全伤害×${MOVEMENT.stationaryBenefit}；移动×${MOVEMENT.cost}`,detail:`与疾驰誓约互斥，本局取得一次；至少完成${CONTRACT_NUMBERS.minimumPicks}次真实奖励确认且有实际攻击后可出现。只有实际自主走位才算移动；撞墙无位移算静止，镜头滚动不算移动。移动时全伤害×${MOVEMENT.cost}；停下不足${MOVEMENT.chargeSeconds}秒维持原伤害，满${MOVEMENT.chargeSeconds}秒为×${MOVEMENT.stationaryBenefit}。取得时从0重新蓄势，不追认此前驻足；仅同一有效战斗时间累计，暂停、升级与后台不计时。可与术式专注或纯粹火力跨组相乘，各乘一次；震荡只继承父伤害。旧飞弹、地铃、锚点和排定节拍冻结原伤害；环铃命中、脉冲和伙伴真实发射读当前状态。寒意、生命／护盾回复、经验与牵引不乘，重开清除。`},
];
export const growthCards=(base?:RunConfig):readonly GrowthCard[]=>[...GROWTH_CARDS,...(base?.areaAbilities?.enabled?AREA_GROWTH_CARDS:[]),...(base?.defenseCompanions?.enabled?DEFENSE_GROWTH_CARDS:[]),...(base?.sustainRewards?.enabled?SUSTAIN_GROWTH_CARDS:[]),...(base?.rewardContracts?.enabled?CONTRACT_GROWTH_CARDS:[]),...(base?.movementContracts?.enabled?MOVEMENT_GROWTH_CARDS:[])];
export const growthCard=(id:string):GrowthCard|undefined=>GROWTH_CARDS.find(c=>c.id===id)||AREA_GROWTH_CARDS.find(c=>c.id===id)||DEFENSE_GROWTH_CARDS.find(c=>c.id===id)||SUSTAIN_GROWTH_CARDS.find(c=>c.id===id)||CONTRACT_GROWTH_CARDS.find(c=>c.id===id)||MOVEMENT_GROWTH_CARDS.find(c=>c.id===id);
export const GROWTH_CORES=['L1_SPLIT','L1_PIERCE','L1_ECHO','L1_TRAIL_BELL','L1_ORBIT_BELL','C23','C18','C15','C16','C12'] as const;
export const ABILITY_SUPPORTS=[{id:'trail',name:'猫步留铃',core:'L1_TRAIL_BELL',supports:['L1_MOVE','L1_DAMAGE']},{id:'orbit',name:'环身飞铃',core:'L1_ORBIT_BELL',supports:['L1_DAMAGE','L1_RATE','L1_HEART']},{id:'rhythm',name:'节拍双击',core:'C23',supports:['L1_DAMAGE','L1_RATE']}] as const;
export type RouteSpec={id:'barrage'|'pierce'|'cadence';name:string;core:AbilityId;evolution:AbilityId;supports:readonly AttributeId[]};
export const GROWTH_ROUTES:readonly RouteSpec[]=[
 {id:'barrage',name:'分弹清群',core:'L1_SPLIT',evolution:'L1_EVO_BARRAGE',supports:['L1_DAMAGE','L1_RATE']},
 {id:'pierce',name:'贯穿走位',core:'L1_PIERCE',evolution:'L1_EVO_PIERCE',supports:['L1_DAMAGE','L1_RANGE']},
 {id:'cadence',name:'装填爆发',core:'L1_ECHO',evolution:'L1_EVO_CADENCE',supports:['L1_RELOAD','L1_RATE']},
];
export const GROWTH_COMBINATIONS=[
 {id:'L1_DUO_TRAIL_CADENCE',requires:['L1_TRAIL_BELL','L1_ECHO']},
 {id:'L1_DUO_STAR_RING',requires:['L1_ORBIT_BELL','L1_PICKUP_CHIME']},
 {id:'E21',requires:['C23','L1_SPLIT']},
 {id:'E23',requires:['L1_PIERCE','M05']},
 {id:'E16',requires:['C15','C16']},
 {id:'E14',requires:['C12','C13']},
] as const;
export const CONTROLLED_GROWTH_RULES_VERSION='courtyard-growth-area-v13';
export const GROWTH_RULES_VERSION='courtyard-growth-defense-v14';
export const NORMAL_GROWTH_RULES_VERSION='courtyard-growth-normal50-v18';
export const SUSTAIN_GROWTH_RULES_VERSION='courtyard-growth-sustain-v15-controlled46-v1';
export const CONTRACT_GROWTH_RULES_VERSION='courtyard-growth-contracts-v16-controlled48-v1';
export const MOVEMENT_GROWTH_RULES_VERSION='courtyard-growth-movement-v17-controlled50-v1';
export const ORDINARY_XP:Readonly<Record<string,number>>=Object.freeze({E01:2,E03:2,E04:3});
export const PICKUP=Object.freeze({capacity:96,magnetRadius:40,collectRadius:8,speed:360});
