import test from 'node:test';
import assert from 'node:assert/strict';
import {SliceSpawns,COMBAT_SLICE,ENEMIES,SPAWN_STAGES,COURTYARD_LEVEL,ArrivalReinforcements,spawnStageAt} from '../src/level-config';
import {CourtyardLevel} from '../src/level-rules';
test('ten-minute encounters remain due across skipped frames, alive elites never block the Boss',()=>{
 assert.equal(COURTYARD_LEVEL.duration,600);const l:any=new CourtyardLevel();
 assert.equal(l.pending(149.999),null);assert.equal(l.pending(150),'EL01');assert(l.markSpawned('EL01',150,11));
 assert.equal(l.pending(299.999),null);assert.equal(l.pending(450),'EL01');assert(l.markSpawned('EL01',450,12));assert.equal(l.pending(450),'B01');assert(l.markSpawned('B01',450,13));
 assert.equal(l.pending(599.999),null);const s=l.snapshot(450);assert.deepEqual(s.encounters.map((e:any)=>e.encounterId),['elite-1','elite-2','boss-1']);assert.equal(s.encounters.filter((e:any)=>e.spawnedAt!==null).length,3);assert.equal(s.eliteAt,150);assert.equal(s.eliteDefeatedAt,null);
 l.defeated('EL01',451,'elite-2',12);assert.equal(l.snapshot(451).encounters[1].defeatedAt,451);assert.equal(l.eliteDefeatedAt,null);
 assert.equal(new CourtyardLevel().pending(600),null);
});
test('six ordinary stages have exact caps, type limits, reset cycles and no deadline spawn',()=>{
 assert.deepEqual(SPAWN_STAGES.map(s=>[s.start,s.end,s.interval,s.cap]),[[3,60,3,8],[60,150,1.8,12],[150,240,1.2,16],[240,330,.95,20],[330,450,.7,26],[450,600,.9,20]]);
 assert.deepEqual(SPAWN_STAGES.map((s:any)=>[s.typeCaps.E03,s.typeCaps.E04]),[[0,0],[2,0],[2,1],[3,1],[3,2],[2,2]]);
 assert.equal(spawnStageAt(600),undefined);assert.equal(new SliceSpawns().take(600),null);
});
test('arrival quotas belong to independent encounter IDs and preserve each finite arrival window',()=>{
 const r:any=new ArrivalReinforcements();assert(r.begin('EL01',150,'elite-1',11));assert(r.begin('EL01',150,'elite-2',12));assert(!r.begin('EL01',151,'elite-1',99));
 assert.deepEqual(r.dueEncounters(151.2),['elite-1','elite-2']);r.attempt(151.2,true,'elite-1');r.attempt(151.2,false,'elite-2');
 assert.deepEqual(r.dueEncounters(151.7),['elite-1','elite-2']);assert.deepEqual(r.dueEncounters(159.2),[]);assert.equal(r.snapshot(160).encounters.length,2);
});
test('slice keeps 42u display separate from the three contact calibration candidates',()=>{
 assert.equal(COMBAT_SLICE.displaySize,42);assert.deepEqual(COMBAT_SLICE.contactCandidates,[8,10,12]);
 assert.equal(ENEMIES.E01.hp,48);assert.equal(ENEMIES.E02.hp,60);assert.equal(ENEMIES.E02.radius,12);
});
test('E02 is retired from every production spawn cycle with stage-boundary slots',()=>{
 assert(SPAWN_STAGES.every(stage=>!stage.cycle.includes('E02')));
 const s=new SliceSpawns();assert.equal(s.take(2.99),null);assert.equal(s.take(3),'E01');assert.equal(s.take(3),null);
 assert.equal(s.take(27),'E01');assert.equal(s.take(30),'E01');assert.equal(s.take(33),'E01');assert.equal(s.take(36),'E01');assert.equal(s.take(39),'E01');
 assert.equal(s.take(160),'E01');
});
test('long frames skip obsolete slots and do not accumulate full-capacity spawns',()=>{
 const s=new SliceSpawns();assert.equal(s.take(28),'E01');assert.equal(s.take(31),'E01');assert.equal(s.take(42),'E01');assert.equal(s.take(42),null);
 assert.equal(new SliceSpawns().take(3),'E01');
});

import {courtyardRunConfig} from '../src/level-config';
import {makeRunConfig} from '../src/combat-config';
test('cross-weapon courtyard keeps native scatter and piercing cadence, only orange is tuned',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const base=makeRunConfig(cat,weapon,'p2-basic'),run=courtyardRunConfig(base);
  assert.equal(run.durationSeconds,600);assert.equal(run.weapon.intervalSeconds,cat==='CAT01'?.8:base.weapon.intervalSeconds);
  assert.equal(run.weapon.reloadSeconds,cat==='CAT01'?2.4:base.weapon.reloadSeconds);
  assert.equal(run.passive,base.passive);assert.equal(run.weapon.pellets,base.weapon.pellets);
  assert.equal(run.weapon.extraPierce,base.weapon.extraPierce);assert.equal(courtyardRunConfig(run),run);
 }
});
