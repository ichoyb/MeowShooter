import type {RunConfig} from './combat-config';
import {GROWTH_NUMBERS as N,type GrowthRanks} from './progression-content';
export type BurstEffect='BASE_SECONDARY'|'TAIL_ECHO'|'OPENING_BURST'|'PICKUP_CHIME'|'RHYTHM'|'SENTRY';
export type BurstShot={angle:number;damage:number;effect:BurstEffect};
export type RhythmIntent=Readonly<{delay:number;retarget:boolean;range:number;speed:number;life:number;segments:readonly Readonly<{offset:number;angle:number;damage:number}>[]}>;
export class WeaponBursts {
 private lastVolley=0;private tails=0;private openings=0;private reloads=0;private remaining=0;
 private lastRhythmVolley=0;private rhythmCounter=0;private rhythmTriggers=0;
 onRhythmVolley(config:RunConfig,ranks:GrowthRanks,facts:{id:number}):RhythmIntent|null{
  if(facts.id<=this.lastRhythmVolley)return null;this.lastRhythmVolley=facts.id;
  if(!config.projectileTraits?.enabled||!ranks.C23)return null;
  if(++this.rhythmCounter<N.rhythmRoots)return null;this.rhythmCounter=0;this.rhythmTriggers++;
  const sequence=!!ranks.L1_SPLIT&&!!ranks.E21,damage=config.weapon.damage*config.directDamageMultiplier;
  const segments=Array.from({length:sequence?N.rhythmSequenceCount:1},(_,i)=>Object.freeze({offset:sequence?i*N.rhythmSequenceStep:0,
   angle:sequence?-N.rhythmSequenceAngle+2*N.rhythmSequenceAngle*i/(N.rhythmSequenceCount-1):0,damage:damage*(sequence?N.rhythmSequenceDamage:N.rhythmDamage)}));
  return Object.freeze({delay:ranks.M31?N.rhythmRetargetDelay:N.rhythmDelay,retarget:!!ranks.M31,range:config.weapon.targetRange,
   speed:config.weapon.bulletSpeed,life:config.weapon.bulletLifeSeconds,segments:Object.freeze(segments)});
 }
 onVolley(config:RunConfig,ranks:GrowthRanks,facts:{id:number;ammo:number;reloads:number;opening:boolean}):BurstShot[]{
  if(facts.id<=this.lastVolley)return [];this.lastVolley=facts.id;
  const shots:BurstShot[]=[],damage=config.weapon.damage*config.directDamageMultiplier;
  const cadence=(ranks.L1_ECHO??0)>0&&(ranks.L1_EVO_CADENCE??0)>0;
  if(facts.reloads>this.reloads){this.reloads=facts.reloads;this.remaining=cadence?N.cadenceVolleys:0;}
  if(cadence&&this.remaining>0){
    for(let i=0;i<N.openingCount;i++)shots.push({angle:-N.openingSpread/2+N.openingSpread*i/(N.openingCount-1),damage:damage*N.openingDamage,effect:'OPENING_BURST'});
    this.openings++;this.remaining--;
  }else if(facts.opening&&config.passive==='reload-secondary')shots.push({angle:0,damage:damage*config.secondary.damageMultiplier,effect:'BASE_SECONDARY'});
  if((ranks.L1_ECHO??0)>0&&facts.ammo===0){
   for(let i=0;i<N.tailCount;i++)shots.push({angle:-N.tailAngle+2*N.tailAngle*i/(N.tailCount-1),damage:damage*N.tailDamage,effect:'TAIL_ECHO'});
   this.tails++;
  }
  return shots;
 }
 clearRhythm():void {this.lastRhythmVolley=0;this.rhythmCounter=0;this.rhythmTriggers=0;}
 snapshot(){return {tailBursts:this.tails,openingBursts:this.openings,cadenceRemaining:this.remaining,rhythmCounter:this.rhythmCounter,rhythmTriggers:this.rhythmTriggers};}
}
