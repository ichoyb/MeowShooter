import type {RunConfig,WeaponId} from './combat-config';
export type EnemyId = 'E01' | 'E02' | 'E03' | 'E04' | 'EL01' | 'B01';
export type SpecialId='EL01'|'B01';
export const COURTYARD_LEVEL=Object.freeze({id:'courtyard-first-level-v14',duration:600,eliteTimes:Object.freeze([150,300]),bossAt:450,arrival:1.2,incomingHitIntervalSeconds:.7,shotInterval:.8,cat01MoveSpeed:170,cat01ReloadSeconds:2.4});
export function courtyardRunConfig(run:RunConfig):RunConfig {
 if(run.rulesVersion.endsWith('-'+COURTYARD_LEVEL.id))return run;
 return Object.freeze({...run,moveSpeed:run.catId==='CAT01'?COURTYARD_LEVEL.cat01MoveSpeed:run.moveSpeed,endCondition:'boss' as const,durationSeconds:COURTYARD_LEVEL.duration,
  rulesVersion:run.rulesVersion+'-'+COURTYARD_LEVEL.id,weapon:Object.freeze({...run.weapon,intervalSeconds:run.weaponId==='W01'?COURTYARD_LEVEL.shotInterval:run.weapon.intervalSeconds,reloadSeconds:run.catId==='CAT01'?COURTYARD_LEVEL.cat01ReloadSeconds:run.weapon.reloadSeconds})});
}
const NORMAL_COURTYARD_STARTER_DAMAGE:Readonly<Partial<Record<WeaponId,number>>>=Object.freeze({W04:29,W02:7.5});
// Normal playtest entry only; controlled fixtures keep courtyardRunConfig and
// their explicit capabilities. The marker records scope, never grants a card.
export function normalCourtyardRunConfig(run:RunConfig):RunConfig {
 if(run.rulesVersion.startsWith('diagnostic-'))throw new Error('Normal courtyard growth requires p2-basic, not diagnostic.');
 const courtyard=courtyardRunConfig(run);
 const damage=NORMAL_COURTYARD_STARTER_DAMAGE[courtyard.weaponId]??courtyard.weapon.damage;
 const weapon=damage===courtyard.weapon.damage?courtyard.weapon:Object.freeze({...courtyard.weapon,damage});
 if(weapon===courtyard.weapon&&courtyard.growthPool==='normal'&&courtyard.projectileTraits?.enabled&&courtyard.projectileFlight?.enabled&&courtyard.huntTargeting?.enabled&&courtyard.areaAbilities?.enabled&&courtyard.defenseCompanions?.enabled&&courtyard.sustainRewards?.enabled&&courtyard.rewardContracts?.enabled&&courtyard.movementContracts?.enabled&&courtyard.growthTuning)return courtyard;
 return Object.freeze({...courtyard,weapon,growthPool:'normal' as const,projectileTraits:Object.freeze({enabled:true as const}),projectileFlight:Object.freeze({enabled:true as const}),huntTargeting:Object.freeze({enabled:true as const}),areaAbilities:Object.freeze({enabled:true as const}),defenseCompanions:Object.freeze({enabled:true as const}),
  sustainRewards:Object.freeze({enabled:true as const}),rewardContracts:Object.freeze({enabled:true as const}),movementContracts:Object.freeze({enabled:true as const}),
  growthTuning:Object.freeze({...courtyard.growthTuning??{attributePlan:'A' as const,xpTarget:28 as const}})});
}
const G7_RULES = '-balance-g7-v1';
const OPENING_POWER = Object.freeze({volleys:3,multiplier:1.35});
const SPIRIT_MARK = Object.freeze({seconds:3,multiplier:1.5});
export function courtyardBalanceRunConfig(run:RunConfig):RunConfig {
 const normal = normalCourtyardRunConfig(run);
 const levelSuffix = '-'+COURTYARD_LEVEL.id;
 if(normal.rulesVersion.endsWith(G7_RULES+levelSuffix))return normal;
 const rulesVersion=normal.rulesVersion.slice(0,-levelSuffix.length)+G7_RULES+levelSuffix;
 if(normal.catId==='CAT01')return Object.freeze({...normal,rulesVersion,maxHp:95,moveSpeed:185,openingPower:OPENING_POWER,
  weapon:Object.freeze({...normal.weapon,damage:16,intervalSeconds:.68,ammoCapacity:8,reloadSeconds:1.8})});
 if(normal.catId==='CAT02')return Object.freeze({...normal,rulesVersion,moveSpeed:175});
 return Object.freeze({...normal,rulesVersion,spiritMark:SPIRIT_MARK});
}
export const COMBAT_SLICE = Object.freeze({id:'courtyard-ordinary-combat-v1',displaySize:42,boundarySize:36,
  contactCandidates:[8,10,12] as const, previewContactRadius:12, duration:160});
export const ENEMIES = Object.freeze({
 E01:{hp:48,speed:54,size:26,radius:12,contact:8,maxCount:18,frame:'enemy-0'},
 // Retained only for the approved historical art / controlled motion fixture.
 E02:{hp:60,speed:50,size:36,radius:12,contact:10,maxCount:1,frame:'enemy-e02',dashSpeed:220,dashSeconds:.55,warningSeconds:.9,recovery:.8,attackInterval:4.5},
 E03:{hp:36,speed:96,size:32,radius:11,contact:8,maxCount:2,frame:'enemy-e03',flankSeconds:1.2,flankOffset:90,closeRange:70},
 E04:{hp:48,speed:32,size:36,radius:12,contact:8,maxCount:1,frame:'enemy-e04',near:140,far:200,warningSeconds:.9,attackInterval:3.5},
 EL01:{hp:480,speed:48,size:52,radius:18,contact:12,maxCount:2,frame:'elite-el01',dashDamage:16,dashSpeed:200,dashSeconds:.8,warningSeconds:1,recovery:1.1,attackInterval:3.6},
 B01:{hp:1500,speed:45,size:96,radius:32,contact:12,maxCount:1,frame:'boss-b01',dashDamage:18,dashSpeed:240,dashSeconds:1.1,warningSeconds:1.05,chase:1.5,dashRecovery:1.2,slamRecovery:1.6,slamRadius:112,slamDamage:20,nearRange:124,slamChance:.6},
});
export const ENEMY_BUBBLE=Object.freeze({size:12,radius:4,speed:140,life:2.5,damage:10,maxCount:16});
export const BOSS_ENRAGE=Object.freeze({hpRatio:.5,recoveryMultiplier:.8});
export const BOSS_SCATTER=Object.freeze({near:150,far:260,warningSeconds:1.1,angles:Object.freeze([-48,-24,0,24,48]),
 speed:110,life:null,lifeMode:'world-boundary' as const,size:14,radius:5,damage:12,rounds:1,enragedRounds:2,cooldown:10,enragedCooldown:8,roundGap:.55,secondOffset:12,recovery:1.6});
export const SPAWN_STAGES:readonly {start:number;end:number;interval:number;cap:number;typeCaps:Readonly<Record<'E01'|'E03'|'E04',number>>;cycle:readonly EnemyId[]}[]=[
 {start:3,end:60,interval:3,cap:8,typeCaps:{E01:8,E03:0,E04:0},cycle:['E01']},
 {start:60,end:150,interval:1.8,cap:12,typeCaps:{E01:12,E03:2,E04:0},cycle:['E01','E01','E01','E01','E03']},
 {start:150,end:240,interval:1.2,cap:16,typeCaps:{E01:16,E03:2,E04:1},cycle:['E01','E01','E01','E01','E01','E03','E04']},
 {start:240,end:330,interval:.95,cap:20,typeCaps:{E01:20,E03:3,E04:1},cycle:['E01','E01','E01','E01','E01','E03','E04']},
 {start:330,end:450,interval:.7,cap:26,typeCaps:{E01:26,E03:3,E04:2},cycle:['E01','E01','E01','E01','E03','E03','E04']},
 {start:450,end:600,interval:.9,cap:20,typeCaps:{E01:20,E03:2,E04:2},cycle:['E01','E01','E01','E01','E01','E03','E04']},
];
export const inOpeningSpawnWindow=(now:number):boolean=>now>=0&&now<SPAWN_STAGES[0].start;
export const spawnStageAt=(now:number,opening=false)=>
 opening&&inOpeningSpawnWindow(now)?SPAWN_STAGES[0]:SPAWN_STAGES.find(stage=>now>=stage.start&&now<stage.end);
// Business schedule only: the Scene supplies its single effective battle time.
export class SliceSpawns {
 constructor(private options:{opening?:boolean}={}){}
 private openingTaken=false;
 private previous='';private counts=SPAWN_STAGES.map(s=>({start:s.start,planned:0,spawned:0,reinforcements:0}));
 recordBirth(now:number,reinforcement=false):void {
  const stage=spawnStageAt(now,this.options.opening);
  if(!stage)return;
  const count=this.counts[SPAWN_STAGES.indexOf(stage)];count.spawned++;if(reinforcement)count.reinforcements++;
 }
 snapshot(){return this.counts.map(s=>({...s}));}
 take(now:number):EnemyId|null {
  if(this.options.opening&&inOpeningSpawnWindow(now)){if(this.openingTaken)return null;this.openingTaken=true;this.counts[0].planned++;return 'E01';}
  const stage=spawnStageAt(now);if(!stage)return null;
  const slot=Math.floor((now-stage.start+1e-8)/stage.interval),key=stage.start+':'+slot;
  if(this.options.opening&&stage===SPAWN_STAGES[0]&&slot===0)return null;
  if(key===this.previous)return null;
  this.previous=key;this.counts[SPAWN_STAGES.indexOf(stage)].planned++;return stage.cycle[slot%stage.cycle.length];
 }
}

// One finite arrival quota. The Scene supplies effective time and acknowledges
// successful native Group births, so there is no extra clock or entity mirror.
export class ArrivalReinforcements {
 private entries:{encounter:SpecialId;encounterId:string;birthId:number;start:number;next:number;quota:number;spawned:number}[]=[];
 begin(id:SpecialId,now:number,encounterId:string=id,birthId=0):boolean {
  if(this.entries.some(e=>e.encounterId===encounterId))return false;
  const start=now+COURTYARD_LEVEL.arrival;this.entries.push({encounter:id,encounterId,birthId,start,next:start,quota:id==='EL01'?6:8,spawned:0});return true;
 }
 dueEncounters(now:number):string[]{return this.entries.filter(e=>e.spawned<e.quota&&now+1e-8>=e.next&&now<e.start+8).map(e=>e.encounterId);}
 due(now:number):boolean{return this.dueEncounters(now).length>0;}
 attempt(now:number,success:boolean,encounterId=this.dueEncounters(now)[0]):void {
  const e=this.entries.find(e=>e.encounterId===encounterId);if(!e||!this.dueEncounters(now).includes(encounterId))return;e.next=now+.5;if(success)e.spawned++;
 }
 clear():void {this.entries=[];}
 snapshot(now:number){const encounters=this.entries.map(e=>({encounter:e.encounter,encounterId:e.encounterId,birthId:e.birthId,remaining:e.quota-e.spawned,spawned:e.spawned,expired:e.spawned<e.quota&&now>=e.start+8,startsAt:e.start,expiresAt:e.start+8}));const latest=encounters[encounters.length-1];return {...(latest??{encounter:null,remaining:0,spawned:0,expired:false,startsAt:null,expiresAt:null}),encounters};}
}
