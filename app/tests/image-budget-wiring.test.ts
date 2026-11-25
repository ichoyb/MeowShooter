import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ImageBudget} from '../src/image-budget';
import {registerUIAsset} from '../src/ui/assets';

test('UI registration and combat share the same decoded-object ledger',()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})}});
  try{
    const budget=new ImageBudget(128),image={complete:true,naturalWidth:4,naturalHeight:4} as HTMLImageElement;
    // Extra argument is intentionally ignored by the old implementation: the
    // assertion exposes its separate, UI-only accounting before wiring changes.
    (registerUIAsset as Function)('ledger-shared.png',image,budget);
    assert.equal(budget.snapshot().sourceRGBA,64);
    budget.register('combat-same-source',image);
    assert.equal(budget.snapshot().sourceRGBA,64);
    budget.register('second-object-same-path',{complete:true,naturalWidth:4,naturalHeight:4});
    assert.throws(()=>budget.register('third',{complete:true,naturalWidth:1,naturalHeight:1}),/预算/);
  }finally{if(old)Object.defineProperty(globalThis,'document',old);else delete (globalThis as any).document;}
});

test('all eleven SVG sources have explicit 84px intrinsic dimensions',()=>{
  for(const name of ['W01','W02','W04','BALL','MAG','FIRE','FROST','SHOCK','SUMMON','GUARD','MOVE']){
    const svg=readFileSync('assets/ui/'+name+'.svg','utf8');
    assert.match(svg,/<svg[^>]*\bwidth="84"/);assert.match(svg,/<svg[^>]*\bheight="84"/);
  }
});
