import test from 'node:test';
import assert from 'node:assert/strict';
import {newEnemyState,stepEnemy} from '../src/enemy-behavior';
const right={x:1,y:0},left={x:-1,y:0};
test('E02 warns for .9s, locks direction, charges .55s then recovers .8s',()=>{
 const s=newEnemyState();stepEnemy(s,0,right,true,false);assert.equal(s.phase,'warning');
 stepEnemy(s,.4,left,true,false);assert.deepEqual(s.direction,right);
 stepEnemy(s,.899,left,true,false);assert.equal(s.phase,'warning');stepEnemy(s,.9,left,true,false);assert.equal(s.phase,'dash');assert.deepEqual(s.direction,right);
 stepEnemy(s,1,left,true,false);assert.deepEqual(s.direction,right);stepEnemy(s,1.45,left,true,false);assert.equal(s.phase,'recover');
 stepEnemy(s,2.249,left,true,false);assert.equal(s.phase,'recover');stepEnemy(s,2.25,left,true,false);assert.equal(s.phase,'chase');
 stepEnemy(s,4.499,left,true,false);assert.equal(s.phase,'chase');stepEnemy(s,4.5,left,true,false);assert.equal(s.phase,'warning');
});
test('E02 requires a readable start but committed warning finishes despite lost visibility',()=>{
 const s=newEnemyState();stepEnemy(s,0,right,false,false);assert.equal(s.phase,'chase');
 stepEnemy(s,1,right,true,false);stepEnemy(s,1.2,left,false,false);assert.equal(s.phase,'warning');assert.equal(s.until,1.9);assert.deepEqual(s.direction,right);assert.equal(s.nextAttack,5.5);
 stepEnemy(s,1.9,left,false,false);assert.equal(s.phase,'dash');assert.deepEqual(s.direction,right);
 stepEnemy(s,2.4,left,false,false);assert.equal(s.phase,'dash');stepEnemy(s,2.45,left,false,false);assert.equal(s.phase,'recover');assert.equal(s.nextAttack,5.5);
});
test('E02 world-boundary dash stops without restarting cooldown',()=>{
 const d=newEnemyState();stepEnemy(d,0,right,true,false);stepEnemy(d,.9,right,true,false);stepEnemy(d,1,right,true,true);assert.equal(d.phase,'recover');
 assert.equal(d.nextAttack,4.5);
});
test('unchanged effective time freezes a phase and long frames never chain multiple phases',()=>{
 const s=newEnemyState();stepEnemy(s,0,right,true,false);stepEnemy(s,.4,right,true,false);stepEnemy(s,.4,right,true,false);assert.equal(s.phase,'warning');
 stepEnemy(s,20,right,true,false);assert.equal(s.phase,'dash');assert.equal(s.until,20.55);
});
