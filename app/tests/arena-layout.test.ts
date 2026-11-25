import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COURTYARD, chooseCourtyardSpawn, inputBufferPoint} from '../src/arena-layout';
import {BattleInput} from '../src/battle-geometry';

test('courtyard has a fixed two by two map and an exterior entry gap', () => {
  assert.deepEqual(COURTYARD, {width:720,height:1440,spawnGap:48,minSpawnDistance:180});
});
test('birth rejects camera-ring and interior points and accepts only the courtyard exterior perimeter', () => {
  const view={x:180,y:420,width:360,height:600}, player={x:360,y:720};
  assert.equal(chooseCourtyardSpawn([{x:360,y:600},{x:132,y:600},{x:-20,y:720},{x:-80,y:720}],view,player),null);
  for(const point of [{x:-48,y:720},{x:768,y:720},{x:360,y:-48},{x:360,y:1488}])assert.deepEqual(chooseCourtyardSpawn([point],view,player),point);
});
test('birth still avoids the full visible field and a player near the garden edge', () => {
  const view={x:-90,y:-90,width:450,height:700};
  assert.equal(chooseCourtyardSpawn([{x:-48,y:250},{x:80,y:-48}],view,{x:29,y:29}),null);
  assert.deepEqual(chooseCourtyardSpawn([{x:768,y:250}],view,{x:29,y:29}),{x:768,y:250});
  assert.equal(chooseCourtyardSpawn([{x:-48,y:720}],{x:180,y:500,width:360,height:400},{x:18,y:720}),null);
});
test('spawn respects distance and consumes at most eight candidates without mutation', () => {
  const blocked=Array.from({length:8},()=>({x:360,y:720})),valid={x:-48,y:650};
  assert.equal(chooseCourtyardSpawn([...blocked,valid],{x:180,y:420,width:360,height:600},{x:360,y:720}),null);
  assert.deepEqual(valid,{x:-48,y:650});
  assert.equal(chooseCourtyardSpawn([{x:NaN,y:600},{x:Infinity,y:600}],{x:180,y:420,width:360,height:600},{x:360,y:720}),null);
});
test('same screen drag has the same speed under buffer density 1 and 2', () => {
  for(const density of [1,2]) {
    const zoom=density*390/360, a=inputBufferPoint(90*density,320*density,zoom), b=inputBufferPoint(122*density,320*density,zoom);
    const input=new BattleInput();input.beginTouch(1,a.x,a.y,{left:0,right:360,top:0,bottom:900},390/360);
    input.moveTouch(1,b.x,b.y);assert.ok(Math.abs(input.movementVector().x-1)<1e-10);
    // Camera scroll is deliberately absent from the screen intent transform.
    input.moveTouch(1,b.x,b.y);assert.equal(input.movementVector().y,0);
    input.releaseTouch(1);assert.deepEqual(input.movementVector(),{x:0,y:0});
  }
});
