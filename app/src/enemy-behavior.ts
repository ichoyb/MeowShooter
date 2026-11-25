import type {Point} from './rules';
import {BOSS_ENRAGE,BOSS_SCATTER,ENEMIES,type EnemyId,type SpecialId} from './level-config';
type BossAttack='dash'|'slam'|'scatter';
type BossReadable={dash:boolean;slam:boolean;scatter?:boolean};
export type EnemyState={phase:'chase'|'warning'|'dash'|'recover'|'between'|'slam-warning'|'scatter-warning'|'scatter-wait'|'arriving';until:number;nextAttack:number;direction:Point;flankAt:number;flankGoal:Point|null;segment:number;lastAttack:BossAttack|null;enraged:boolean;wasFrozen:boolean;scatterRounds:number;scatterRound:number;scatterCooldownUntil:number};
export function newEnemyState(id?:EnemyId,now=0):EnemyState{return {phase:'chase',until:id==='B01'?now+ENEMIES.B01.chase:0,nextAttack:0,direction:{x:0,y:-1},flankAt:0,flankGoal:null,segment:1,lastAttack:null,enraged:false,wasFrozen:false,scatterRounds:0,scatterRound:0,scatterCooldownUntil:0};}
export function stepEnemy(s:EnemyState,now:number,aim:Point,readable:boolean,blocked:boolean,spec:{warningSeconds:number;dashSeconds:number;recovery:number;attackInterval:number}=ENEMIES.E02):void {
 if(s.phase==='chase'){
  if(readable&&now+1e-8>=s.nextAttack){s.phase='warning';s.until=now+spec.warningSeconds;s.nextAttack=now+spec.attackInterval;s.direction={...aim};}
 }else if(s.phase==='warning'){
  // Shared single-dash commitment: later player/camera movement cannot re-aim or cancel it.
  if(now+1e-8>=s.until){s.phase='dash';s.until=now+spec.dashSeconds;}
 }else if(s.phase==='dash'){
  if(blocked||now+1e-8>=s.until){s.phase='recover';s.until=now+spec.recovery;}
 }else if(now+1e-8>=s.until){s.phase='chase';}
}
export function stepFlanker(s:EnemyState,now:number,distance:number):'direct'|'refresh'|'flank'{
 if(distance<=ENEMIES.E03.closeRange){s.flankGoal=null;return 'direct';}
 if(!s.flankGoal||now+1e-8>=s.flankAt){s.flankAt=now+ENEMIES.E03.flankSeconds;return 'refresh';}
 return 'flank';
}
export function stepFlower(s:EnemyState,now:number,distance:number,aim:Point,readable:boolean):{movement:number;fire:boolean}{
 const spec=ENEMIES.E04;
 if(s.phase==='warning'){
  if(!readable){s.phase='chase';return {movement:0,fire:false};}
  s.direction={...aim};
  if(now+1e-8>=s.until){s.phase='chase';return {movement:0,fire:true};}
  return {movement:0,fire:false};
 }
 const movement=distance>spec.far?1:distance<spec.near?-1:0;
 if(movement===0&&readable&&now+1e-8>=s.nextAttack){s.phase='warning';s.until=now+spec.warningSeconds;s.nextAttack=now+spec.attackInterval;s.direction={...aim};}
 return {movement:s.phase==='warning'?0:movement,fire:false};
}

export function chooseBossAttack(distance:number,readable:BossReadable,random:()=>number,scatterReady=false):BossAttack|null {
 if(scatterReady&&readable.scatter&&distance>=BOSS_SCATTER.near&&distance<=BOSS_SCATTER.far)return 'scatter';
 const near=distance<=ENEMIES.B01.nearRange;
 if(near&&readable.slam)return readable.dash?(random()<ENEMIES.B01.slamChance?'slam':'dash'):'slam';
 return readable.dash?'dash':null;
}
export const bossIsEnraged=(enraged:boolean,hpRatio:number):boolean=>enraged||hpRatio<=BOSS_ENRAGE.hpRatio;
export const bossScatterRounds=(enraged:boolean):number=>enraged?BOSS_SCATTER.enragedRounds:BOSS_SCATTER.rounds;
export function stepSpecial(id:SpecialId,s:EnemyState,now:number,aim:Point,readable:BossReadable,blocked:boolean,hpRatio:number,frozen:boolean,distance:number,random:()=>number):{slam:boolean;scatterRound:number}{
 const result={slam:false,scatterRound:0};
 if(id==='EL01'){
  if(frozen){if(!s.wasFrozen){s.phase='recover';s.until=now+ENEMIES.EL01.recovery;s.segment=1;}s.wasFrozen=true;return result;}
  s.wasFrozen=false;stepEnemy(s,now,aim,readable.dash,blocked,ENEMIES.EL01);return result;
 }
 const spec=ENEMIES.B01;
 if(!s.enraged&&bossIsEnraged(s.enraged,hpRatio)){s.enraged=true;if(s.phase==='recover')s.until=now+Math.max(0,s.until-now)*BOSS_ENRAGE.recoveryMultiplier;}
 const recover=(attack:BossAttack='dash')=>{s.phase='recover';s.until=now+(attack==='slam'?spec.slamRecovery:attack==='scatter'?BOSS_SCATTER.recovery:spec.dashRecovery)*(s.enraged?BOSS_ENRAGE.recoveryMultiplier:1);s.segment=1;s.lastAttack=attack;};
 const begin=()=>{
  const attack=chooseBossAttack(distance,readable,random,now+1e-8>=s.scatterCooldownUntil);if(!attack)return;
  s.lastAttack=attack;s.phase=attack==='slam'?'slam-warning':attack==='scatter'?'scatter-warning':'warning';s.until=now+(attack==='scatter'?BOSS_SCATTER.warningSeconds:spec.warningSeconds);
  if(attack!=='slam')s.direction={...aim};
  if(attack==='scatter'){s.scatterRounds=bossScatterRounds(s.enraged);s.scatterRound=0;s.scatterCooldownUntil=now+(s.enraged?BOSS_SCATTER.enragedCooldown:BOSS_SCATTER.cooldown);}
 };
 if(s.phase==='chase'){
  if(now+1e-8>=s.until)begin();
 }else if(s.phase==='warning'){
  s.direction={...aim};if(now+1e-8>=s.until){s.phase='dash';s.until=now+spec.dashSeconds;}
 }else if(s.phase==='dash'){
  if(blocked||now+1e-8>=s.until)recover();
 }else if(s.phase==='slam-warning'){
  if(now+1e-8>=s.until){result.slam=true;recover('slam');}
 }else if(s.phase==='scatter-warning'||s.phase==='scatter-wait'){
  if(now+1e-8>=s.until){
   result.scatterRound=++s.scatterRound;
   if(s.scatterRound<s.scatterRounds){s.phase='scatter-wait';s.until=now+BOSS_SCATTER.roundGap;}
   else recover('scatter');
  }
 }else if(s.phase==='recover'&&now+1e-8>=s.until){
  s.phase='chase';s.until=now+(s.lastAttack==='slam'?spec.chase:0);if(s.until<=now)begin();
 }
 return result;
}
