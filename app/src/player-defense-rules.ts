// Pure business formulas; Scene effective time is the only time source.
export const DEFENSE_NUMBERS=Object.freeze({armorPerRank:6,armorScale:100,shieldFraction:.2,shieldWaitSeconds:6,shieldRatePerSecond:.1});
export const armorPoints=(rank:number):number=>DEFENSE_NUMBERS.armorPerRank*rank;
export const armorMultiplier=(rank:number):number=>DEFENSE_NUMBERS.armorScale/(DEFENSE_NUMBERS.armorScale+armorPoints(rank));
export const shieldCapacity=(maxHp:number):number=>DEFENSE_NUMBERS.shieldFraction*maxHp;
export const shieldRecovery=(cap:number,from:number,to:number,lastEnemyAt:number):number=>
 cap*DEFENSE_NUMBERS.shieldRatePerSecond*Math.max(0,to-Math.max(from,lastEnemyAt+DEFENSE_NUMBERS.shieldWaitSeconds));
export type IncomingDamageFact=Readonly<{
 accepted:boolean;rawDamage:number;afterArmor:number;shieldAbsorbed:number;hpLost:number;shieldBroke:boolean;
}>;
export type DefenseSnapshot={
 enabled:boolean;armor:number;multiplier:number;shield:number;maxShield:number;rechargeWait:number;
 lastEnemyAt:number|null;absorbedTotal:number;hpLostTotal:number;lastHit:IncomingDamageFact|null;
};
