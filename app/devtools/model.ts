// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import type {RunConfig} from '../src/combat-config';
import type {BattleSnapshot} from '../src/battle';
import {growthCards,growthCardEligible,growthRank,growthRoutes,growthCombinations,contractIndependentSource,CONTRACT_NUMBERS,type GrowthId,type GrowthSnapshot} from '../src/progression';

export type DevtoolsSettings=Readonly<{inv:boolean;dmg:number;hp:number;spawn:number;xpm:number}>;
export const DEVTOOLS_DEFAULTS:DevtoolsSettings=Object.freeze({inv:false,dmg:1,hp:1,spawn:1,xpm:1});
export const DEVTOOLS_LIMITS=Object.freeze({dmg:{min:0,max:100},hp:{min:.1,max:100},spawn:{min:0,max:10},xpm:{min:0,max:100}});
export type DevtoolsSession={settings:DevtoolsSettings;spawnCarry:number;xpCarry:number;setSettings(settings:DevtoolsSettings):void};
export type DevtoolsReward={id:GrowthId;name:string;rank:number;limit:number|null;reason:string|null};
export type DevtoolsSnapshot={battle:BattleSnapshot;settings:DevtoolsSettings;active:boolean;ordinaryCap:number;rewards:DevtoolsReward[]};
export type DevtoolsController={read():DevtoolsSnapshot;clearInput():void;setSettings(settings:DevtoolsSettings):void;grant(id:GrowthId):boolean;experience(amount:number):boolean};

export function readDevtoolsSettings(params:URLSearchParams):{settings:DevtoolsSettings|null;errors:string[]} {
 const values:Record<string,number>={},errors:string[]=[];
 const inv=params.get('inv');
 if(inv!==null&&inv!=='0'&&inv!=='1')errors.push('inv 必须为 0 或 1');
 for(const key of ['dmg','hp','spawn','xpm'] as const){
  const raw=params.get(key),value=raw===null?1:Number(raw),{min,max}=DEVTOOLS_LIMITS[key];
  if(raw!==null&&raw.trim()===''||!Number.isFinite(value)||value<min||value>max)errors.push(key+' 必须为 '+min+'–'+max+' 的数值');
  values[key]=value;
 }
 return {settings:errors.length?null:{inv:inv==='1',dmg:values.dmg,hp:values.hp,spawn:values.spawn,xpm:values.xpm},errors};
}
export function writeDevtoolsSettings(url:URL,settings:DevtoolsSettings):URL {
 const next=new URL(url.href);
 for(const key of ['inv','dmg','hp','spawn','xpm'] as const)next.searchParams.set(key,key==='inv'?(settings.inv?'1':'0'):String(settings[key]));
 return next;
}
export function scaleCount(amount:number,multiplier:number,carry:number):{count:number;carry:number} {
 const total=amount*multiplier+carry,count=Math.floor(total+1e-9);
 return {count,carry:Math.max(0,total-count)};
}
export function scaleWeaponDamage(config:RunConfig,multiplier:number):RunConfig {
 return Object.freeze({...config,weapon:Object.freeze({...config.weapon,damage:config.weapon.damage*multiplier})});
}
export function rewardReason(id:GrowthId,base:RunConfig,growth:GrowthSnapshot):string|null {
 const {ranks,confirmedPicks}=growth,card=growthCards(base).find(card=>card.id===id)!;
 if(growthCardEligible(id,ranks,base,confirmedPicks))return null;
 if(card.limit!==null&&growthRank(ranks,id)>=card.limit)return '已达等级上限';
 if(id==='A11')return '暴击率已达上限';
 if(id==='A12')return '需要有效暴击率';
 if(id==='A16')return '需要原生星灵或定点哨卫';
 if(id==='A07'||id==='A08')return '需要可受益的独立技能'+(id==='A07'?'或伙伴':'或震荡回响');
 if(id==='M31')return '需要节拍双击';
 if(id==='M26')return '需要追猎标记';
 if(id==='M10')return '需要能量护盾与有效弹匣';
 if(id==='M09')return '需要有效贯穿';
 if(id==='M06')return '需要多弹且有散布的主武器';
 if(card.kind==='tradeoff'){
  const opposite={R04:'R05',R05:'R04',R06:'R07',R07:'R06'}[id as 'R04'|'R05'|'R06'|'R07'] as GrowthId;
  if(growthRank(ranks,opposite))return '与 '+growthCards(base).find(card=>card.id===opposite)!.name+' 互斥';
  if(confirmedPicks<CONTRACT_NUMBERS.minimumPicks)return '需要先确认 '+CONTRACT_NUMBERS.minimumPicks+' 次奖励（当前 '+confirmedPicks+'）';
  if((id==='R04'||id==='R05')&&!contractIndependentSource(base,ranks))return '需要独立技能或伙伴伤害源';
 }
 if(card.kind==='evolution'){
  const route=growthRoutes(ranks).find(route=>route.evolution===id)!;
  return '需要 '+growthCards(base).find(card=>card.id===route.core)!.name+'，及相关属性累计2次（当前 '+route.supportPicks+'）';
 }
 if(card.kind==='combination'){
  const combination=growthCombinations(ranks).find(combination=>combination.id===id)!;
  return '需要 '+combination.requires.filter(required=>!growthRank(ranks,required)).map(required=>growthCards(base).find(card=>card.id===required)!.name).join(' + ');
 }
 if(card.kind==='attachment')return id==='L1_LIGHT_MAG'?'需要尾弹回响':'需要已持有的攻击核心';
 return '当前角色或武器能力不满足：'+card.detail;
}
export function devtoolsRewards(base:RunConfig,growth:GrowthSnapshot,blocked:string|null):DevtoolsReward[] {
 return growthCards(base).map(card=>({id:card.id,name:card.name,rank:growthRank(growth.ranks,card.id),limit:card.limit,reason:rewardReason(card.id,base,growth)??blocked}));
}
