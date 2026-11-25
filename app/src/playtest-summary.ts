import type {CatId,WeaponId} from './combat-config';
export type PlaytestOutcome='playing'|'restarted'|'abandoned'|'cleared'|'death'|'timeout'|'survived';
export type DamageSource='E01_CONTACT'|'E02_CONTACT'|'E02_DASH'|'E03_CONTACT'|'E04_CONTACT'|'E04_PROJECTILE'|'EL01_CONTACT'|'EL01_DASH'|'B01_CONTACT'|'B01_DASH'|'B01_SLAM'|'B01_PROJECTILE';
export type PlaytestSummary=Readonly<{runId:number;catId:CatId;weaponId:WeaponId;elapsed:number;level:number;upgrades:number;eliteRewards:number;bossEncountered:boolean;outcome:PlaytestOutcome;deathSource:DamageSource|null;first:Readonly<{move:number|null;enemy:number|null;hit:number|null;pickup:number|null;upgrade:number|null}>}>;
type Facts={elapsed:number;travel:number;collectedXP:number;level:number;confirmedPicks:number;eliteRewards:number;bossEncountered:boolean;result:string|null};
type Mutable={-readonly[K in keyof PlaytestSummary]:K extends 'first'?{-readonly[P in keyof PlaytestSummary['first']]:number|null}:PlaytestSummary[K]};
const copy=(v:Mutable|null):PlaytestSummary|null=>v?{...v,first:{...v.first}}:null;
// Only current and most recent completed run; no identity, clock, storage or network.
export class SessionPlaytestSummaries {
 private value:Mutable|null=null;private last:Mutable|null=null;private lethal:DamageSource|null=null;
 start(runId:number,catId:CatId,weaponId:WeaponId):void {this.end('restarted');this.lethal=null;this.value={runId,catId,weaponId,elapsed:0,level:1,upgrades:0,eliteRewards:0,bossEncountered:false,outcome:'playing',deathSource:null,first:{move:null,enemy:null,hit:null,pickup:null,upgrade:null}};}
 observe(f:Facts):void {const v=this.value;if(!v||v.outcome!=='playing')return;v.elapsed=f.elapsed;v.level=f.level;v.eliteRewards=f.eliteRewards;v.upgrades=Math.max(0,f.confirmedPicks-f.eliteRewards);v.bossEncountered ||= f.bossEncountered;
  if(f.travel>1e-5&&v.first.move===null)v.first.move=f.elapsed;if(f.collectedXP>0&&v.first.pickup===null)v.first.pickup=f.elapsed;if(v.upgrades>0&&v.first.upgrade===null)v.first.upgrade=f.elapsed;
  if(f.result&&['cleared','death','timeout','survived'].includes(f.result)){v.outcome=f.result as PlaytestOutcome;v.deathSource=f.result==='death'?this.lethal:null;}
 }
 visibleEnemy(at:number):void {if(this.value?.outcome==='playing'&&this.value.first.enemy===null)this.value.first.enemy=at;}
 primaryHit(at:number):void {if(this.value?.outcome==='playing'&&this.value.first.hit===null)this.value.first.hit=at;}
 damage(source:DamageSource|undefined,accepted:boolean,hpLost:number,hpAfter:number):void {if(this.value?.outcome==='playing'&&accepted&&hpLost>0&&hpAfter<=0)this.lethal=source??null;}
 end(reason:'restarted'|'abandoned'):void {if(!this.value)return;if(this.value.outcome==='playing')this.value.outcome=reason;this.last={...this.value,first:{...this.value.first}};this.value=null;this.lethal=null;}
 current():PlaytestSummary|null {return copy(this.value);}
 previous():PlaytestSummary|null {return copy(this.last);}
}
