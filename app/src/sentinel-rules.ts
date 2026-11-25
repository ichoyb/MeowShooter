import type {RunConfig} from './combat-config';
import type {GrowthRanks} from './progression-content';
import {abilityDamage} from './area-ability-rules';
import type {MovementContext} from './contract-rules';
export const companionFrequency=(ranks:GrowthRanks):number=>1+.1*(ranks.A16??0);
export function sentinelStats(base:RunConfig,ranks:GrowthRanks,attached=false,context?:MovementContext){
 return {deploySeconds:6,durationSeconds:6,range:180,intervalSeconds:1/companionFrequency(ranks),damage:.6*abilityDamage(base,ranks,context)*(attached?.8:1),speed:600,lifeSeconds:1};
}
