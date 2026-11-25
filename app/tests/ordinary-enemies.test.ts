import test from 'node:test';
import assert from 'node:assert/strict';
import {SliceSpawns,ENEMIES,COMBAT_SLICE} from '../src/level-config';
import {newEnemyState,stepFlower as flower,stepFlanker as flank} from '../src/enemy-behavior';
const right={x:1,y:0},left={x:-1,y:0};
test('four ordinary enemies retain approved values and a 160-second local flow',()=>{
 assert.equal(COMBAT_SLICE.duration,160);
 assert.deepEqual([ENEMIES.E03?.hp,ENEMIES.E03?.speed,ENEMIES.E03?.radius],[36,96,11]);
 assert.deepEqual([ENEMIES.E04?.hp,ENEMIES.E04?.speed],[48,32]);
});
test('six phases reset rotation, E03 first appears at 67.2 and E04 at 157.2',()=>{
 const s=new SliceSpawns();
 for(const [now,id] of [[60,'E01'],[61.8,'E01'],[63.6,'E01'],[65.4,'E01'],[67.2,'E03'],[150,'E01'],[151.2,'E01'],[152.4,'E01'],[153.6,'E01'],[154.8,'E01'],[156,'E03'],[157.2,'E04']] as const)assert.equal(s.take(now),id);
 assert.equal(s.take(157.2),null);assert.equal(s.take(240),'E01');
});
test('E03 refreshes a flank goal only each 1.2s and pursues directly within 70u',()=>{
 const s=newEnemyState();assert.equal(flank(s,0,100),'refresh');s.flankGoal={x:70,y:90};
 assert.equal(flank(s,1.199,100),'flank');assert.equal(flank(s,1.2,100),'refresh');assert.equal(flank(s,1.3,70),'direct');
 assert.equal(s.flankGoal,null);assert.equal(flank(s,1.31,90),'refresh');
});
test('E04 stands at 140–200u, approaches far targets and retreats from close ones',()=>{
 for(const [distance,movement] of [[139,-1],[140,0],[200,0],[201,1]]){
  const s=newEnemyState();s.nextAttack=10;
  assert.equal(flower(s,0,distance,right,true).movement,movement);
 }
});
test('E04 has a full warning then one shot, locks only the emitted trajectory',()=>{
 const s=newEnemyState();assert.equal(flower(s,0,160,right,true).fire,false);assert.equal(s.phase,'warning');
 assert.equal(flower(s,.899,160,left,true).fire,false);assert.equal(flower(s,.9,160,left,true).fire,true);
 assert.deepEqual(s.direction,left);assert.equal(flower(s,.9,160,right,true).fire,false);
 assert.equal(flower(s,3.499,160,right,true).fire,false);assert.equal(s.phase,'chase');
 flower(s,3.5,160,right,true);assert.equal(s.phase,'warning');
});
test('unreadable E04 warnings cancel, retain cooldown and do not queue a shot',()=>{
 const s=newEnemyState();flower(s,0,160,right,true);assert.equal(flower(s,.4,160,right,false).fire,false);assert.equal(s.phase,'chase');
 assert.equal(flower(s,1,160,right,true).fire,false);assert.equal(s.phase,'chase');assert.equal(s.nextAttack,3.5);
});
