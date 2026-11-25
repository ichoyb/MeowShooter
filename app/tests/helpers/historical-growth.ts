import {makeRunConfig,type RunConfig} from '../../src/combat-config';
import {courtyardRunConfig} from '../../src/level-config';

// Historical fixtures must name their five-capability baseline explicitly.
// Do not derive it from the current normal entry: that entry can admit new cards.
export function historicalNormal44Config(cat='CAT01',weapon='W01'):RunConfig {
 return Object.freeze({...courtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic')),growthPool:'normal' as const,
  projectileTraits:Object.freeze({enabled:true as const}),projectileFlight:Object.freeze({enabled:true as const}),
  huntTargeting:Object.freeze({enabled:true as const}),areaAbilities:Object.freeze({enabled:true as const}),
  defenseCompanions:Object.freeze({enabled:true as const}),growthTuning:Object.freeze({attributePlan:'A' as const,xpTarget:28 as const})});
}
export function controlled44Config(cat='CAT01',weapon='W01'):RunConfig {
 const {growthPool,...base}=historicalNormal44Config(cat,weapon);return Object.freeze(base);
}
