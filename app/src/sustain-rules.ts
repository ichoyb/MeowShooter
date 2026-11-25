// Pure sustain amounts. The Session owns the one effective clock and budgets.
export const SUSTAIN_NUMBERS=Object.freeze({eliteHealFraction:.2,lifeDamageFraction:.02,lifeCapFraction:.02,reloadShieldPercent:15,reloadShieldIntervalSeconds:2});
export const hpAfterMaxGrowth=(hp:number,previousMaxHp:number,maxHp:number):number=>
 Math.min(maxHp,hp+Math.max(0,maxHp-previousMaxHp));
export const hpAfterRewardRecovery=(hp:number,maxHp:number,fraction:number):number=>
 Math.min(maxHp,hp+maxHp*fraction);
export const lifeCircuitLimit=(maxHp:number):number=>maxHp*SUSTAIN_NUMBERS.lifeCapFraction;
export const lifeCircuitRecovery=(actualDamage:number,hp:number,maxHp:number,usedThisSecond:number):number=>
 Math.max(0,Math.min(actualDamage*SUSTAIN_NUMBERS.lifeDamageFraction,maxHp-hp,lifeCircuitLimit(maxHp)-usedThisSecond));
export const reloadShieldRecovery=(shield:number,maxShield:number):number=>Math.max(0,Math.min(maxShield*SUSTAIN_NUMBERS.reloadShieldPercent/100,maxShield-shield));
export const reloadShieldReady=(now:number,lastActualAt:number):boolean=>now-lastActualAt>=SUSTAIN_NUMBERS.reloadShieldIntervalSeconds;
export type SustainHitFact=Readonly<{source:string;targetKind:string;actualDamage:number;effect?:string}>;
export type SustainSnapshot={
 enabled:boolean;lifeCircuitOwned:boolean;reloadShieldOwned:boolean;hpRecoveredTotal:number;shieldRecoveredTotal:number;
 lifeWindowSecond:number;lifeUsedThisSecond:number;lifeRemainingThisSecond:number;lifeLimitPerSecond:number;
 reloadShieldLastAt:number|null;reloadShieldReady:boolean;reloadStarts:number;
};
