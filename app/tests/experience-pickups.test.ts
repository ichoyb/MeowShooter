import test from 'node:test';
import assert from 'node:assert/strict';
import * as Growth from '../src/progression';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
test('A10 changes only the 40u magnet start radius with no artificial purchase cap',()=>{
 const magnet=(Growth as any).pickupMagnetRadius;assert.equal(typeof magnet,'function');
 const base:RunConfig={...makeRunConfig('CAT01','W01','p2-basic'),areaAbilities:{enabled:true}} as RunConfig;
 const zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
 for(const [rank,radius] of [[0,40],[1,44],[2,48],[100,440]])assert.equal(magnet(base,{...zero,A10:rank}),radius);
 assert.equal(magnet({...base,areaAbilities:undefined},{...zero,A10:100}),40);
});
