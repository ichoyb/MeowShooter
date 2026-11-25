import {COURTYARD_LEVEL,type SpecialId} from './level-config';
// Stable encounter facts only. Native Group owns objects; Scene Clock owns retries.
export class CourtyardLevel {
 eliteAt:number|null=null;eliteDefeatedAt:number|null=null;bossAt:number|null=null;bossDefeated=false;
 private encounters=[...COURTYARD_LEVEL.eliteTimes.map((dueAt,i)=>({encounterId:'elite-'+(i+1),enemyId:'EL01' as SpecialId,dueAt,spawnedAt:null as number|null,birthId:null as number|null,defeatedAt:null as number|null})),{encounterId:'boss-1',enemyId:'B01' as SpecialId,dueAt:COURTYARD_LEVEL.bossAt,spawnedAt:null as number|null,birthId:null as number|null,defeatedAt:null as number|null}];
 next(now:number){if(now+1e-8>=COURTYARD_LEVEL.duration||this.bossDefeated)return null;return this.encounters.find(e=>e.spawnedAt===null&&now+1e-8>=e.dueAt)??null;}
 pending(now:number):SpecialId|null{return this.next(now)?.enemyId??null;}
 markSpawned(id:SpecialId,now:number,birthId=0):boolean {
  const e=this.next(now);if(!e||e.enemyId!==id)return false;e.spawnedAt=now;e.birthId=birthId;
  if(e.encounterId==='elite-1')this.eliteAt=now;if(id==='B01')this.bossAt=now;return true;
 }
 defeated(id:SpecialId,now:number,encounterId?:string,birthId?:number):boolean {
  const e=this.encounters.find(e=>e.enemyId===id&&e.spawnedAt!==null&&e.defeatedAt===null&&(!encounterId||e.encounterId===encounterId)&&(birthId===undefined||e.birthId===birthId));
  if(!e)return false;e.defeatedAt=now;if(e.encounterId==='elite-1')this.eliteDefeatedAt=now;if(id==='B01')this.bossDefeated=true;return true;
 }
 snapshot(now:number){return {eliteAt:this.eliteAt,eliteDefeatedAt:this.eliteDefeatedAt,bossAt:this.bossAt,bossDefeated:this.bossDefeated,pending:this.pending(now),encounters:this.encounters.map(e=>({...e}))};}
}
