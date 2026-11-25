import type {GrowthRanks} from '../../src/progression';

type AttackBuild = {name:string; ranks:Partial<GrowthRanks>; tip:string};

const star = {L1_ORBIT_BELL:3,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1};
const sprint = {L1_TRAIL_BELL:1,L1_ECHO:1,L1_DUO_TRAIL_CADENCE:1};
const fusion = {C15:1,C16:1,E16:1};

const contractCore = {C15:1,A10:3};

export const attackBuilds = {
  ricochet: {name:'弹道 · 折射弹道',ranks:{L1_SPLIT:1,L1_RICOCHET:1},tip:'观察主弹命中后真正改向的位置。两只怪靠近时更容易看见折射闪点。'},
  return: {name:'弹道 · 返航轨迹',ranks:{M05:1},tip:'观察弹丸实际返航时的蓝绿色短尾；回程飞向当时的发射位置。'},
  mirror: {name:'弹道 · 镜面回廊',ranks:{L1_PIERCE:1,M05:1,E23:1},tip:'观察返航切换瞬间的紫色镜片，以及返回途中再次命中。'},
  tail: {name:'节奏 · 尾弹回响',ranks:{L1_ECHO:1},tip:'看到弹匣最后一发亮起，再观察两侧实际飞出的回响。'},
  rhythm: {name:'节奏 · 节拍双击',ranks:{C23:1},tip:'每四次实际主齐射，留意随后补发的副弹亮点。'},
  offbeat: {name:'节奏 · 节拍错峰',ranks:{C23:1,M31:1},tip:'边移动边观察延后从新位置打出的副弹；无敌人时不会补发。'},
  barrage: {name:'节奏 · 节律弹幕',ranks:{C23:1,L1_SPLIT:1,E21:1},tip:'数一下实际出手的三段短闪。怪物打完可点「补一波怪」。'},
  cadence: {name:'节奏 · 连奏风暴',ranks:{L1_ECHO:1,L1_RELOAD:2,L1_EVO_CADENCE:1},tip:'等一次完整装填，再看前三次齐射的紫色记号逐段点亮。'},
  hunt: {name:'追猎 · 追猎标记',ranks:{C18:1},tip:'小金冠只在真正被标记的怪物头顶出现；普通自动索敌依旧没有圆圈。'},
  transfer: {name:'追猎 · 标记传承',ranks:{C18:1,M26:1},tip:'打掉带金冠的怪物，观察短线把标记交给附近的另一只。'},
  spell: {name:'契约 · 术式专注',ranks:{...contractCore,R04:1},tip:'术式增强、武器减弱；观察实际脉冲中心亮起的术式纹样。'},
  weapon: {name:'契约 · 纯粹火力',ranks:{...contractCore,R05:1},tip:'武器增强、术式减弱；观察真实开火时的金色短闪。'},
  dash: {name:'契约 · 疾驰誓约',ranks:{...contractCore,R06:1},tip:'持续走位、停下或顶住边界，比较脚边短迹与实际倍率。'},
  root: {name:'契约 · 扎根誓约',ranks:{...contractCore,R07:1},tip:'站稳一秒，看脚边刻线蓄满；重新移动后刻线立即消失。'},
  orbit1: {name:'环铃 · 2枚',ranks:{L1_ORBIT_BELL:1},tip:'让敌人靠近飞铃的轨迹，观察单枚接触闪光。'},
  orbit2: {name:'环铃 · 3枚',ranks:{L1_ORBIT_BELL:2},tip:'3枚飞铃持续旋转，走位可把铃带到敌人身边。'},
  orbit3: {name:'环铃 · 4枚',ranks:{L1_ORBIT_BELL:3},tip:'观察4枚飞铃在移动、转向和装填时的轨迹。'},
  star: {name:'环铃 · 巡游星环',ranks:star,tip:'点「放经验」并实际拾取，观察飞铃向外展开再收回。'},
  trail: {name:'地铃 · 猫步留铃',ranks:{L1_TRAIL_BELL:1},tip:'沿一个方向持续走位留下地铃，再把追来的敌人引过去。'},
  sprint: {name:'地铃 · 疾走铃阵',ranks:sprint,tip:'装填期间继续走位，观察地铃间距缩短。'},
  area: {name:'区域 · 脉冲与引力锚',ranks:{C15:1,C16:1},tip:'浅绿脉冲从脚下释放，紫色锚点在敌群中牵引。'},
  fusion: {name:'区域 · 脉冲引爆',ranks:fusion,tip:'观察锚点存在时脉冲移到远处，以及锚点到期的紫色收束。'},
  shock: {name:'区域 · 震荡回响',ranks:{L1_SPLIT:1,L1_SHOCK_BELL:1},tip:'让怪聚在一起，看主弹命中后金色震荡范围。'},
  mixed: {name:'组合 · 同屏压力',ranks:{...star,...sprint,...fusion,L1_SHOCK_BELL:1},tip:'同时走位、装填与拾取经验，观察三类效果重叠时是否清楚。'},
} satisfies Record<string,AttackBuild>;

export type AttackBuildId = keyof typeof attackBuilds;
