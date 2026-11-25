// Explicit historical five-capability baseline for retained controlled pilots.
// Normal player entry does not import this fixture and now enables all50.
import {courtyardRunConfig} from '../../src/level-config';
import type {RunConfig} from '../../src/combat-config';
export function controlledGrowthBase(run:RunConfig):RunConfig {
 const {growthPool,sustainRewards,rewardContracts,movementContracts,...base}=courtyardRunConfig(run);
 return {...base,projectileTraits:{enabled:true},projectileFlight:{enabled:true},huntTargeting:{enabled:true},areaAbilities:{enabled:true},defenseCompanions:{enabled:true},growthTuning:base.growthTuning??{attributePlan:'A',xpTarget:28}};
}

export function historicalNormalGrowthBase(run:RunConfig):RunConfig {return {...controlledGrowthBase(run),growthPool:'normal'};}
