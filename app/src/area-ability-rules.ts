// Code guarded by __DEVTOOLS__ serves the local developer tools only; official builds compile it out.
declare const __DEVTOOLS__:boolean;
import type {RunConfig} from './combat-config';
import type {Point} from './rules';
import {GROWTH_NUMBERS as N,PICKUP,growthNumbers,type GrowthRanks} from './progression-content';
import {contractMultipliers,stanceMultiplier,type MovementContext} from './contract-rules';
export const skillMultiplier=(base:RunConfig,ranks:GrowthRanks):number=>1+(base.areaAbilities?.enabled ? .25*(ranks.A07??0) : 0);
export const areaMultiplier=(base:RunConfig,ranks:GrowthRanks):number=>1+(base.areaAbilities?.enabled ? .05*(ranks.A08??0) : 0);
export const pickupMagnetRadius=(base:RunConfig,ranks:GrowthRanks):number=>PICKUP.magnetRadius*(1+(base.areaAbilities?.enabled ? .1*(ranks.A10??0) : 0));
export const abilityDamage=(base:RunConfig,ranks:GrowthRanks,context?:MovementContext):number=>{
 const damage=12*(1+growthNumbers(base.growthTuning?.attributePlan).damage*ranks.L1_DAMAGE)*skillMultiplier(base,ranks)*contractMultipliers(base,ranks).skill*stanceMultiplier(base,ranks,context);
 return __DEVTOOLS__?damage*(context?.devtoolsDamage??1):damage;
};
export const nativeSpiritDamage=(base:RunConfig,ranks:GrowthRanks,context?:MovementContext):number=>{
 const damage=base.spirit.damage*skillMultiplier(base,ranks)*contractMultipliers(base,ranks).skill*stanceMultiplier(base,ranks,context);
 return __DEVTOOLS__?damage*(context?.devtoolsDamage??1):damage;
};
export function areaAttributeEligible(id:'A07'|'A08',base:RunConfig,ranks:GrowthRanks):boolean {
 if(!base.areaAbilities?.enabled)return false;
 const actual=['L1_TRAIL_BELL','L1_ORBIT_BELL','C15','C16'] as const;
 return actual.some(id=>(ranks[id]??0)>0)||(id==='A07'?!!ranks.L1_PICKUP_CHIME||base.passive==='spirit'||!!(base.defenseCompanions?.enabled&&ranks.C12):!!ranks.L1_SHOCK_BELL);
}
export function abilityGeometry(base:RunConfig,ranks:GrowthRanks){
 const q=areaMultiplier(base,ranks);
 return {shockRadius:N.shockRadius*q,trailTrigger:N.trailTrigger*q,trailRadius:N.trailRadius*q,
  orbitRadius:N.orbitRadius*q,starRadius:N.starRadius*q,orbitSize:N.orbitSize*q,orbitHitRadius:N.orbitHitRadius*q,pulseRadius:48*q,anchorRadius:60*q};
}
export function pulseStats(base:RunConfig,ranks:GrowthRanks,context?:MovementContext){
 return {intervalSeconds:3,radius:abilityGeometry(base,ranks).pulseRadius,targets:8,damage:.7*abilityDamage(base,ranks,context)};
}
export function anchorStats(base:RunConfig,ranks:GrowthRanks,context?:MovementContext){
 return {intervalSeconds:5,durationSeconds:2,range:240,radius:abilityGeometry(base,ranks).anchorRadius,targets:8,arrivalRadius:4,damage:.4*abilityDamage(base,ranks,context)};
}
export function anchorPullEligible(enemy:{enemyId:string;active:boolean;hp:number;deathResolved:boolean;entering:boolean;frozen:boolean;speed:number}):boolean {
 return ['E01','E03','E04'].includes(enemy.enemyId)&&enemy.active&&enemy.hp>0&&!enemy.deathResolved&&!enemy.entering&&!enemy.frozen&&enemy.speed>0;
}
export function pulsePosition(ranks:GrowthRanks,feet:Point,anchor:Point|null):Point {
 return ranks.C15&&ranks.C16&&ranks.E16&&anchor?anchor:feet;
}
