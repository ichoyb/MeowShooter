// Code guarded by __DEVTOOLS__ serves the local developer tools only; official builds compile it out.
declare const __DEVTOOLS__:boolean;
import type {RunConfig,GrowthTuning} from './combat-config';
import {GROWTH_CARDS,GROWTH_ROUTES,GROWTH_COMBINATIONS,ABILITY_SUPPORTS,GROWTH_CORES,GROWTH_NUMBERS as N,growthNumbers,GROWTH_RULES_VERSION,CONTROLLED_GROWTH_RULES_VERSION,SUSTAIN_GROWTH_RULES_VERSION,CONTRACT_GROWTH_RULES_VERSION,ORDINARY_XP,growthCards,growthCard,type GrowthId,type GrowthRanks} from './progression-content';
import {contractMultipliers,contractEligible,stanceMultiplier,CONTRACT_NUMBERS,type MovementContext} from './contract-rules';
import {MOVEMENT_GROWTH_RULES_VERSION,NORMAL_GROWTH_RULES_VERSION} from './progression-content';
export {contractMultipliers,contractIndependentSource,contractEligible,stanceMultiplier,CONTRACT_NUMBERS,MOVEMENT_CONTRACT_NUMBERS} from './contract-rules';
export type {MovementContext} from './contract-rules';
export {MOVEMENT_GROWTH_RULES_VERSION,NORMAL_GROWTH_RULES_VERSION,MOVEMENT_GROWTH_CARDS} from './progression-content';
import {areaAttributeEligible} from './area-ability-rules';
import {projectileTraitStats} from './projectile-traits';
export {projectileTraitStats,rollProjectileTraits} from './projectile-traits';
export {GROWTH_CARDS,GROWTH_ROUTES,GROWTH_COMBINATIONS,GROWTH_NUMBERS,GROWTH_RULES_VERSION,SUSTAIN_GROWTH_RULES_VERSION,CONTRACT_GROWTH_RULES_VERSION,growthNumbers,ATTRIBUTE_PLANS,AREA_GROWTH_CARDS,DEFENSE_GROWTH_CARDS,SUSTAIN_GROWTH_CARDS,CONTRACT_GROWTH_CARDS,growthCards,growthCard} from './progression-content';
export type {GrowthId,GrowthRanks} from './progression-content';
export {WeaponBursts} from './weapon-bursts';
export {BellModifiers} from './bell-modifiers';
export {BellAbilityState,abilityDamage,orbitContact,orbitStats,remapOrbitCooldown} from './bell-ability-rules';
export {skillMultiplier,areaMultiplier,pickupMagnetRadius,nativeSpiritDamage,abilityGeometry,pulseStats,anchorStats,anchorPullEligible,pulsePosition} from './area-ability-rules';
export {companionFrequency,sentinelStats} from './sentinel-rules';
export type GrowthOffer={id:number;choices:GrowthId[];source:'experience'|'elite';encounterId?:string;birthId?:number};
export const growthRank=(ranks:GrowthRanks,id:GrowthId):number=>ranks[id]??0;
export function growthCombinations(ranks:GrowthRanks){return GROWTH_COMBINATIONS.map(c=>({...c,owned:growthRank(ranks,c.id)>0,eligible:!growthRank(ranks,c.id)&&c.requires.every(id=>growthRank(ranks,id)>0)}));}
export function growthExplorationWeight(id:GrowthId,ranks:GrowthRanks,recentDeclined:readonly (readonly GrowthId[])[]):number {
 if(!['core','attachment'].includes(growthCard(id)?.kind??''))return 1;
 const completes=GROWTH_COMBINATIONS.some(c=>!growthRank(ranks,c.id)&&c.requires.some(required=>required===id)&&c.requires.every(required=>required===id||growthRank(ranks,required)>0));
 return (completes?2:1)*(recentDeclined.some(ids=>ids.includes(id))?.5:1);
}
export function growthRoutes(ranks:GrowthRanks){
 return [...GROWTH_ROUTES.map(route=>{
  const coreOwned=growthRank(ranks,route.core)>0,evolved=growthRank(ranks,route.evolution)>0;
  const supportPicks=route.supports.reduce((n,id)=>n+growthRank(ranks,id),0);
  return {...route,coreOwned,evolved,supportPicks,eligible:coreOwned&&supportPicks>=2&&!evolved};
 }),...ABILITY_SUPPORTS.map(route=>({...route,evolution:null,coreOwned:growthRank(ranks,route.core)>0,evolved:false,supportPicks:route.supports.reduce((n,id)=>n+growthRank(ranks,id),0),eligible:false}))];
}
export const barrageProgress=(ranks:GrowthRanks)=>growthRoutes(ranks)[0];
export function experienceNeeded(level:number,target:GrowthTuning['xpTarget']=28):number{return Math.ceil(8+({20:3.75,28:1.7,36:.9}[target])*(level-1));}
export function dropExperience(enemyId:string):number{return ORDINARY_XP[enemyId]??0;}
export function growthCapabilities(base?:RunConfig):{projectile:boolean;magazine:boolean}{
 if(!base)return {projectile:true,magazine:true};
 const w=base.weapon,positive=(n:number)=>Number.isFinite(n)&&n>0;
 return {projectile:Number.isInteger(w.pellets)&&w.pellets>0&&[w.damage,w.intervalSeconds,w.bulletSpeed,w.bulletLifeSeconds,w.targetRange].every(positive)&&
  Number.isInteger(w.extraPierce)&&w.extraPierce>=0&&positive(w.pierceDamageMultiplier)&&Number.isFinite(w.spreadDegrees)&&w.spreadDegrees>=0,
  magazine:Number.isInteger(w.ammoCapacity)&&w.ammoCapacity>0&&positive(w.reloadSeconds)};
}
export function growthCardEligible(id:GrowthId,ranks:GrowthRanks,base?:RunConfig,confirmedPicks=0):boolean{
 const card=growthCards(base).find(c=>c.id===id);if(!card||(card.limit!==null&&growthRank(ranks,id)>=card.limit))return false;
 if(id==='A16')return base?.passive==='spirit'||growthRank(ranks,'C12')>0;
 if(id==='A07'||id==='A08')return !!base&&areaAttributeEligible(id,base,ranks);
 const {projectile,magazine}=growthCapabilities(base);
 if(id==='R04'||id==='R05'||id==='R06'||id==='R07')return contractEligible(id,ranks,base,projectile,confirmedPicks);
 if(id==='C21')return projectile&&!!base?.sustainRewards?.enabled;
 if(id==='M10')return magazine&&!!base?.sustainRewards?.enabled&&!!base.defenseCompanions?.enabled&&growthRank(ranks,'C13')>0;
 if(id==='C18'||id==='M26')return projectile&&!!base?.huntTargeting?.enabled&&(id==='C18'||growthRank(ranks,'C18')>0);
 if(id==='M12')return projectile&&magazine&&!!base?.projectileFlight?.enabled;
 if(id==='E23'&&(!projectile||!base?.projectileFlight?.enabled))return false;
 if(['A15','M05','M09'].includes(id)){
  if(!projectile||!base?.projectileFlight?.enabled)return false;
  return id!=='M09'||base.weapon.extraPierce>0||growthRank(ranks,'L1_PIERCE')>0;
 }
 if(['A11','A12','M06','C23','M31','E21'].includes(id)){
  if(!projectile||!base?.projectileTraits?.enabled)return false;
  if(id==='A11')return projectileTraitStats(base,ranks).criticalChance<N.criticalChanceMax;
  if(id==='A12')return projectileTraitStats(base,ranks).criticalChance>0;
  if(id==='C23')return true;
  if(id==='M31')return growthRank(ranks,'C23')>0;
  if(id==='E21')return growthCombinations(ranks).some(c=>c.id===id&&c.eligible);
  return (base.weapon.pellets>1||growthRank(ranks,'L1_SPLIT')>0)&&
   base.weapon.spreadDegrees+(growthRank(ranks,'L1_SPLIT')?N.splitSpread:0)>0;
 }
 if(!projectile&&['L1_SPLIT','L1_PIERCE','L1_ECHO','L1_EVO_BARRAGE','L1_EVO_PIERCE','L1_EVO_CADENCE','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME','L1_RANGE','L1_LIGHT_MAG','L1_DUO_TRAIL_CADENCE','L1_DUO_STAR_RING'].includes(id))return false;
 if(!magazine&&['L1_ECHO','L1_EVO_CADENCE','L1_LIGHT_MAG','L1_DUO_TRAIL_CADENCE','L1_RELOAD'].includes(id))return false;
 if(card.kind==='evolution')return growthRoutes(ranks).some(r=>r.evolution===id&&r.eligible);
 if(card.kind==='combination')return growthCombinations(ranks).some(c=>c.id===id&&c.eligible);
 if(card.kind==='attachment')return id==='L1_LIGHT_MAG'?growthRank(ranks,'L1_ECHO')>0:GROWTH_CORES.some(core=>growthRank(ranks,core)>0);
 return true;
}
export function deriveGrowthConfig(base:RunConfig,ranks:GrowthRanks,context?:MovementContext):RunConfig{
 const attributes=growthNumbers(base.growthTuning?.attributePlan);
 const split=growthRank(ranks,'L1_SPLIT')>0,barrage=split&&growthRank(ranks,'L1_EVO_BARRAGE')>0;
 const pierce=growthRank(ranks,'L1_PIERCE')>0,pierceEvolved=pierce&&growthRank(ranks,'L1_EVO_PIERCE')>0;
 const range=base.weapon.targetRange*(1+attributes.range*growthRank(ranks,'L1_RANGE'));
 const splitDamage=Math.max(N.splitDamage,base.weapon.pellets/(base.weapon.pellets+1));
 const spread=base.weapon.spreadDegrees+(split?N.splitSpread:0);
 const cluster=base.projectileTraits?.enabled&&growthRank(ranks,'M06')>0&&(base.weapon.pellets>1||split)&&spread>0;
 const flight=!!base.projectileFlight?.enabled,speedMultiplier=flight?1+N.flightSpeed*growthRank(ranks,'A15'):1;
 const speed=base.weapon.bulletSpeed*speedMultiplier;
 const pressure=flight&&growthRank(ranks,'M09')>0&&(base.weapon.extraPierce>0||pierce);
 return Object.freeze({...base,maxHp:base.maxHp+attributes.heart*ranks.L1_HEART,moveSpeed:base.moveSpeed*(1+attributes.move*growthRank(ranks,'L1_MOVE')),weapon:Object.freeze({...base.weapon,
  damage:base.weapon.damage*(1+attributes.damage*ranks.L1_DAMAGE)*(split?splitDamage:1)*contractMultipliers(base,ranks).weapon*stanceMultiplier(base,ranks,context),
  pellets:base.weapon.pellets+(split?barrage?2:1:0),spreadDegrees:spread*(cluster?N.clusterSpread:1),
  extraPierce:base.weapon.extraPierce+(pierce?pierceEvolved?2:1:0),
  pierceDamageMultiplier:pressure?N.pressuredPierce:base.weapon.pierceDamageMultiplier,
  targetRange:range,bulletSpeed:speed,bulletLifeSeconds:Math.max(base.weapon.bulletLifeSeconds/speedMultiplier,range/speed),
  ammoCapacity:growthRank(ranks,'L1_LIGHT_MAG')?Math.max(1,Math.ceil(base.weapon.ammoCapacity/2)):base.weapon.ammoCapacity,
  reloadSeconds:base.weapon.reloadSeconds/(1+attributes.reload*growthRank(ranks,'L1_RELOAD'))*(growthRank(ranks,'L1_LIGHT_MAG')?N.lightReload:1),
  intervalSeconds:base.weapon.intervalSeconds/(1+attributes.rate*ranks.L1_RATE)})});
}
export class RunGrowth{
 declare devtoolsGrant?:(id:GrowthId,commit:(ranks:GrowthRanks,source:GrowthOffer['source'])=>number|false)=>boolean;
 private level=1;private xp=0;private totalXP=0;private pending=0;private sequence=0;private confirmedPicks=0;
 private ranks:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
 private recentDeclined:GrowthId[][]=[];
 private offer:GrowthOffer|null=null;private evolutionViews:Partial<Record<GrowthId,number>>={};
 private eliteQueue:{encounterId:string;birthId:number}[]=[];private eliteSeen=new Set<string>();private eliteBirths=new Set<number>();
 private eliteRewards:{offerId:number;encounterId:string;birthId:number;cardId:GrowthId;recovered:number}[]=[];
 constructor(readonly runId:number,private random:()=>number,private base?:RunConfig){
  if(__DEVTOOLS__)this.devtoolsGrant=(id,commit)=>!this.offer&&this.commitReward(id,'experience',commit)!==false;
 }
 private commitReward(id:GrowthId,source:GrowthOffer['source'],commit?:(ranks:GrowthRanks,source:GrowthOffer['source'])=>number|false):number|false {
  if(!growthCardEligible(id,this.ranks,this.base,this.confirmedPicks))return false;
  const next={...this.ranks,[id]:growthRank(this.ranks,id)+1};
  const recovered=commit?commit(next,source):0;if(recovered===false)return false;
  this.ranks=next;this.confirmedPicks++;
  return recovered;
 }
 queueElite(encounterId:string,birthId:number):boolean {
  if(!encounterId||!Number.isInteger(birthId)||birthId<1||this.eliteSeen.has(encounterId)||this.eliteBirths.has(birthId))return false;
  this.eliteSeen.add(encounterId);this.eliteBirths.add(birthId);this.eliteQueue.push({encounterId,birthId});
  this.eliteQueue.sort((a,b)=>a.encounterId.localeCompare(b.encounterId)||a.birthId-b.birthId);return true;
 }
 openOffer():void {this.ensureOffer();}
 clearPending():void {this.pending=0;this.eliteQueue=[];this.offer=null;}
 collect(amount:number):void{
  if(!Number.isInteger(amount)||amount<=0){this.ensureOffer();return;}
  this.xp+=amount;this.totalXP+=amount;
  while(this.xp>=experienceNeeded(this.level,this.base?.growthTuning?.xpTarget)){this.xp-=experienceNeeded(this.level++,this.base?.growthTuning?.xpTarget);this.pending++;}
  this.ensureOffer();
 }
 private ensureOffer():void{
  if(this.offer||(!this.pending&&!this.eliteQueue.length))return;
  const routes=growthRoutes(this.ranks),owned=routes.filter(r=>r.coreOwned),hasCore=GROWTH_CORES.some(core=>growthRank(this.ranks,core)>0)||!!this.base?.sustainRewards?.enabled&&growthRank(this.ranks,'C21')>0,eligible=routes.filter((r):r is typeof r & {evolution:NonNullable<typeof r.evolution>}=>r.eligible&&r.evolution!==null);
  const allLegal=growthCards(this.base).filter(c=>growthCardEligible(c.id,this.ranks,this.base,this.confirmedPicks));
  const contracts=allLegal.filter(c=>c.kind==='tradeoff').map(c=>c.id),legal=allLegal.filter(c=>c.kind!=='tradeoff').map(c=>c.id);
  const combinations=growthCombinations(this.ranks),advanced:GrowthId[]=[...eligible.map(r=>r.evolution),...combinations.filter(c=>c.eligible).map(c=>c.id)].filter(id=>legal.includes(id));
  const choices:GrowthId[]=[],take=(pool:GrowthId[])=>pool[Math.min(pool.length-1,Math.floor(Math.max(0,this.random())*pool.length))];
  const offense=(id:GrowthId)=>!['L1_HEART','L1_MOVE'].includes(id);
  const cores=legal.filter(id=>growthCard(id)!.kind==='core'&&!growthRank(this.ranks,id));
  const explore=(pool:GrowthId[])=>{
   const weights=pool.map(id=>growthExplorationWeight(id,this.ranks,this.recentDeclined));
   let draw=Math.max(0,Math.min(1,this.random()))*weights.reduce((n,w)=>n+w,0);
   for(let i=0;i<pool.length;i++){draw-=weights[i];if(draw<0)return pool[i];}return pool[pool.length-1];
  };
  if(advanced.length){
   advanced.sort((a,b)=>(this.evolutionViews[a]??0)-(this.evolutionViews[b]??0)||a.localeCompare(b));
   const id=advanced[0];choices.push(id);this.evolutionViews[id]=(this.evolutionViews[id]??0)+1;
  }else if(hasCore){
   const related=legal.filter(id=>owned.some(r=>(r.supports as readonly string[]).includes(id))||(id==='L1_ORBIT_BELL'&&growthRank(this.ranks,id)>0));
   choices.push(take(related.length?related:legal.filter(offense)));
  }else choices.push(cores.length?(this.sequence<2?take(cores):explore(cores)):take(legal.filter(offense)));
  if(contracts.length&&this.random()<CONTRACT_NUMBERS.offerChance)choices.push(take(contracts));
  else if(hasCore){
   const exploration=legal.filter(id=>!choices.includes(id)&&!growthRank(this.ranks,id)&&['core','attachment'].includes(growthCard(id)!.kind));
   if(exploration.length)choices.push(explore(exploration));
  }
  while(choices.length<3&&choices.length<legal.length){
   const general=legal.filter(id=>!choices.includes(id)&&growthCard(id)!.kind==='attribute');
   choices.push(take(general.length?general:legal.filter(id=>!choices.includes(id))));
  }
  for(let i=choices.length-1;i>0;i--){const j=Math.min(i,Math.floor(Math.max(0,this.random())*(i+1)));[choices[i],choices[j]]=[choices[j],choices[i]];}
  const elite=this.eliteQueue[0];this.offer={id:++this.sequence,choices,source:elite?'elite':'experience',...(elite||{})};
 }
 confirm(runId:number,offerId:number,id:string,commit?:(ranks:GrowthRanks,source:GrowthOffer['source'])=>number|false):boolean{
  const card=growthCards(this.base).find(c=>c.id===id);
  if(runId!==this.runId||!this.offer||this.offer.id!==offerId||!card||!this.offer.choices.includes(card.id))return false;
  const source=this.offer.source??'experience';
  const recovered=this.commitReward(card.id,source,commit);if(recovered===false)return false;
  this.recentDeclined.push(this.offer.choices.filter(id=>id!==card.id));if(this.recentDeclined.length>2)this.recentDeclined.shift();
  if(source==='elite'){
   const index=this.eliteQueue.findIndex(e=>e.encounterId===this.offer!.encounterId&&e.birthId===this.offer!.birthId);
   if(index>=0)this.eliteQueue.splice(index,1);
   this.eliteRewards.push({offerId,encounterId:this.offer.encounterId!,birthId:this.offer.birthId!,cardId:card.id,recovered});
  }else this.pending--;
  this.offer=null;this.ensureOffer();return true;
 }
 snapshot(){
 const complete=this.base?.projectileTraits?.enabled&&this.base.projectileFlight?.enabled&&this.base.huntTargeting?.enabled&&this.base.areaAbilities?.enabled&&this.base.defenseCompanions?.enabled;
 const movement50=complete&&this.base?.sustainRewards?.enabled&&this.base.rewardContracts?.enabled&&this.base.movementContracts?.enabled;
 const contracts48=complete&&this.base?.sustainRewards?.enabled&&this.base.rewardContracts?.enabled&&!this.base.movementContracts?.enabled;
 const sustain46=complete&&this.base?.sustainRewards?.enabled&&!this.base.rewardContracts?.enabled&&!this.base.movementContracts?.enabled;
 const normal=this.base?.growthPool==='normal'&&complete&&!this.base.sustainRewards?.enabled&&!this.base.rewardContracts?.enabled&&!this.base.movementContracts?.enabled;
 const normal50=this.base?.growthPool==='normal'&&movement50;
 const scope=normal?'':this.base?.defenseCompanions?.enabled?'-controlled-defense-v3':'-controlled'+(this.base?.projectileTraits?.enabled?'-traits':'')+(this.base?.projectileFlight?.enabled?'-flight-v2':'')+(this.base?.huntTargeting?.enabled?'-hunt-v1':'')+(this.base?.areaAbilities?.enabled?'-area-v2':'');
 return {runId:this.runId,rulesVersion:normal50?NORMAL_GROWTH_RULES_VERSION:movement50?MOVEMENT_GROWTH_RULES_VERSION:contracts48?CONTRACT_GROWTH_RULES_VERSION:sustain46?SUSTAIN_GROWTH_RULES_VERSION:(normal?GROWTH_RULES_VERSION:CONTROLLED_GROWTH_RULES_VERSION)+scope+(this.base?.sustainRewards?.enabled?'-sustain-v1':'')+(this.base?.rewardContracts?.enabled?'-contracts-v1':'')+(this.base?.movementContracts?.enabled?'-movement-v1':''),attributePlan:this.base?.growthTuning?.attributePlan??'A',xpTarget:this.base?.growthTuning?.xpTarget??28,level:this.level,xp:this.xp,nextXP:experienceNeeded(this.level,this.base?.growthTuning?.xpTarget),totalXP:this.totalXP,confirmedPicks:this.confirmedPicks,pending:this.pending+this.eliteQueue.length,
  ranks:{...this.ranks},projectileTraits:projectileTraitStats(this.base,this.ranks),routes:growthRoutes(this.ranks),combinations:growthCombinations(this.ranks).filter(c=>(c.id!=='E23'||!!this.base?.projectileFlight?.enabled)&&(c.id!=='E16'||!!this.base?.areaAbilities?.enabled)&&(c.id!=='E14'||!!this.base?.defenseCompanions?.enabled)),barrage:barrageProgress(this.ranks),offer:this.offer?{...this.offer,choices:this.offer.choices.slice()}:null,elitePending:this.eliteQueue.map(e=>({...e})),eliteRewards:this.eliteRewards.map(e=>({...e})),exhausted:false};}
}
export type GrowthSnapshot=ReturnType<RunGrowth['snapshot']>&{defense?:import('./player-defense-rules').DefenseSnapshot;sentry?:{active:number;station:{attached:boolean}|null};sustain?:import('./sustain-rules').SustainSnapshot;contracts?:MovementContext&{enabled:boolean;stationarySince:number|null;stance:number}};
