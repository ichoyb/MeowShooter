import type {RunConfig} from './combat-config';
import {GROWTH_NUMBERS as N,type GrowthRanks} from './progression-content';

// Business rules only. The Scene owns an independent native random stream.
export function projectileTraitStats(base:RunConfig|undefined,ranks:GrowthRanks){
 const enabled=base?.projectileTraits?.enabled===true;
 return {enabled,criticalChance:enabled?Math.min(N.criticalChanceMax,N.criticalChance+N.criticalChanceStep*(ranks.A11??0)):0,
  criticalMultiplier:enabled?N.criticalMultiplier+N.criticalMultiplierStep*(ranks.A12??0):1};
}
export function rollProjectileTraits(source:string,damage:number,base:RunConfig,ranks:GrowthRanks,random:()=>number){
 const stats=projectileTraitStats(base,ranks);
 if(source!=='PRIMARY'||!stats.enabled)return {critical:false,criticalMultiplier:1,nonCriticalDamage:damage};
 return {critical:random()<stats.criticalChance,criticalMultiplier:stats.criticalMultiplier,nonCriticalDamage:damage};
}
