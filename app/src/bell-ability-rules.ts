import {GROWTH_NUMBERS as N} from './progression-content';
// Independent abilities share twelve as their base, never weapon or direct-projectile modifiers.
export {abilityDamage} from './area-ability-rules';
export function orbitStats(rank:number,rateRank=0,rateCoefficient:number=N.rate):{count:number;cooldown:number;period:number;haste:number;damageCoefficient:number} {
 const level=Math.max(0,Math.min(3,rank));
 const index=Math.max(0,level-1),haste=1+rateCoefficient*rateRank;
 return {count:level?N.orbitCount+level-1:0,cooldown:N.orbitCooldowns[index]/haste,period:N.orbitPeriod/haste,haste,damageCoefficient:level?N.orbitDamages[index]:0};
}
export function orbitContact(state:{orbitHitAt:number},now:number,rank=1,rateRank=0,rateCoefficient:number=N.rate):boolean {
 if(now+1e-8<state.orbitHitAt+orbitStats(rank,rateRank,rateCoefficient).cooldown)return false;
 state.orbitHitAt=now;return true;
}
// Remap at the rank/RATE change's effective battle time, including enemies no longer
// touching a bell. Completed cooldowns and unhit births keep their existing ledger.
export function remapOrbitCooldown(state:{orbitHitAt:number},now:number,from:number,to:number,fromRate=0,toRate=0,rateCoefficient:number=N.rate):void {
 if(!Number.isFinite(state.orbitHitAt))return;
 const old=orbitStats(from,fromRate,rateCoefficient).cooldown,elapsed=now-state.orbitHitAt;
 if(elapsed<old)state.orbitHitAt=now-Math.max(0,elapsed/old)*orbitStats(to,toRate,rateCoefficient).cooldown;
}
// Business credit only. Native Body/Geom/Clock/Tween own movement and entities.
export class BellAbilityState {
 private distance=0;private threshold:number=N.trailDistance;private charge=0;private lastVolley=0;private chimes=0;
 travel(distance:number,inputMovement:boolean,threshold:number=N.trailDistance):number[]{
  if(threshold!==this.threshold){this.distance=this.distance/this.threshold*threshold;this.threshold=threshold;}
  if(!inputMovement||!Number.isFinite(distance)||distance<=0)return [];
  const fractions:number[]=[];
  for(let next=threshold-this.distance;next<=distance+1e-8;next+=threshold)fractions.push(Math.min(1,next/distance));
  this.distance=(this.distance+distance)%threshold;if(this.distance<1e-8||threshold-this.distance<1e-8)this.distance=0;
  return fractions;
 }
 collect(amount:number,owned:boolean):boolean {const before=this.charge;if(owned&&Number.isInteger(amount)&&amount>0)this.charge=Math.min(N.chimeXP,this.charge+amount);return before<N.chimeXP&&this.charge===N.chimeXP;}
 onVolley(id:number,owned:boolean):boolean {
  if(id<=this.lastVolley)return false;this.lastVolley=id;
  if(!owned||this.charge<N.chimeXP)return false;this.charge=0;this.chimes++;return true;
 }
 reset():void {this.distance=0;this.threshold=N.trailDistance;this.charge=0;this.lastVolley=0;this.chimes=0;}
 snapshot(){return {trailDistance:this.distance,trailThreshold:this.threshold,charge:this.charge,chimes:this.chimes};}
}
