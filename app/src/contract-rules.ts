import type {RunConfig} from './combat-config';
import type {GrowthRanks} from './progression-content';
export type ContractId='R04'|'R05'|'R06'|'R07';
export type MovementContext=Readonly<{moving:boolean;stationarySeconds:number}>;
export const MOVEMENT_CONTRACT_NUMBERS=Object.freeze({movingBenefit:1.25,cost:.8,stationaryBenefit:1.4,chargeSeconds:1,minimumDistance:1e-4});
export function stanceMultiplier(base:RunConfig,ranks:GrowthRanks,context:MovementContext={moving:false,stationarySeconds:0}):number {
 if(!base.movementContracts?.enabled)return 1;
 if(ranks.R06)return context.moving?MOVEMENT_CONTRACT_NUMBERS.movingBenefit:MOVEMENT_CONTRACT_NUMBERS.cost;
 if(ranks.R07)return context.moving?MOVEMENT_CONTRACT_NUMBERS.cost:context.stationarySeconds+1e-8>=MOVEMENT_CONTRACT_NUMBERS.chargeSeconds?MOVEMENT_CONTRACT_NUMBERS.stationaryBenefit:1;
 return 1;
}
export const CONTRACT_NUMBERS=Object.freeze({benefit:1.35,cost:.8,minimumPicks:4,offerChance:.2});
// Families follow the numerical base: pickup chimes use skill S even though
// their projectile source is SECONDARY. Shock already inherits the real hit.
export function contractMultipliers(base:RunConfig,ranks:GrowthRanks):{weapon:number;skill:number}{
 if(!base.rewardContracts?.enabled)return {weapon:1,skill:1};
 if(ranks.R04)return {weapon:CONTRACT_NUMBERS.cost,skill:CONTRACT_NUMBERS.benefit};
 if(ranks.R05)return {weapon:CONTRACT_NUMBERS.benefit,skill:CONTRACT_NUMBERS.cost};
 return {weapon:1,skill:1};
}
export function contractIndependentSource(base:RunConfig,ranks:GrowthRanks):boolean{
 return base.passive==='spirit'||!!(ranks.L1_TRAIL_BELL||ranks.L1_ORBIT_BELL||ranks.L1_PICKUP_CHIME)||
  !!(base.areaAbilities?.enabled&&(ranks.C15||ranks.C16))||!!(base.defenseCompanions?.enabled&&ranks.C12);
}
export function contractEligible(id:ContractId,ranks:GrowthRanks,base:RunConfig|undefined,projectile:boolean,confirmedPicks:number):boolean{
 if(id==='R06'||id==='R07')return !!base?.movementContracts?.enabled&&projectile&&confirmedPicks>=CONTRACT_NUMBERS.minimumPicks&&
  !ranks[id]&&!ranks[id==='R06'?'R07':'R06'];
 return !!base?.rewardContracts?.enabled&&projectile&&confirmedPicks>=CONTRACT_NUMBERS.minimumPicks&&
  !ranks[id]&&!ranks[id==='R04'?'R05':'R04']&&contractIndependentSource(base,ranks);
}
