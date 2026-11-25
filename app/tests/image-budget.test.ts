import test from 'node:test';
import assert from 'node:assert/strict';
import limits from '../asset-budget.json';
import {ImageBudget} from '../src/image-budget';
const source=(width=128,height=128)=>({naturalWidth:width,naturalHeight:height,complete:true});

test('declared backgrounds are counted separately, deduplicated and released',()=>{
 const budget=new ImageBudget(5242880),painting=source(887,1774);
 budget.register('./assets/r1-restoration/native/courtyard-native-v01.png',painting);
 budget.register('./assets/r1-restoration/native/courtyard-native-v01.png',painting);
 assert.equal(budget.snapshot().sourceRGBA,0);
 assert.equal(budget.snapshot().backgroundRGBA,6294152);
 assert.equal(budget.snapshot().backgrounds.length,1);
 assert.equal(budget.snapshot().mode,'strict');
 budget.release(painting);assert.equal(budget.snapshot().backgroundRGBA,0);
});

test('all three profiles enforce the same5MiB non-background budget',()=>{
 for(const profile of ['playtest','release','review'] as const){
  assert.equal(limits.sourceRGBALimits[profile],5*1024*1024);
  assert.equal(limits.sourceBudgetModes[profile],'strict');
 }
 assert.equal(limits.maxSourceEdge,512);
});

test('a source cannot evade the sprite budget by changing its registered classification',()=>{
 const budget=new ImageBudget(5242880),image=source(4,4);
 budget.register('sprite',image);
 assert.throws(()=>budget.register('assets/ui/garden.jpeg',image),/分类/);
 assert.equal(budget.snapshot().sourceRGBA,64);
 assert.equal(budget.snapshot().backgroundRGBA,0);
});
test('exact byte budget passes and one byte less rejects the same decoded source',()=>{
 const image=source(4,4),fits=new ImageBudget(64),overflow=new ImageBudget(63);
 fits.register('UI',image);assert.equal(fits.snapshot().sourceRGBA,64);
 assert.throws(()=>overflow.register('battle',image),/预算/);
 assert.equal(overflow.snapshot().sourceRGBA,0);assert.equal(overflow.snapshot().sources.length,0);
});
test('the actual 5MiB boundary is inclusive and the next source is rejected',()=>{
 const budget=new ImageBudget(limits.sourceRGBALimits.playtest);
 for(let i=0;i<5;i++)budget.register('sheet-'+i,source(512,512));
 assert.equal(budget.snapshot().sourceRGBA,5242880);
 assert.throws(()=>budget.register('one-pixel',source(1,1)),/预算/);
});
test('the same source shared by UI and Phaser is counted once',()=>{
 const image=source(),budget=new ImageBudget(65536);
 budget.register('UI-CAT01',image);budget.register('Phaser-CAT01',image);
 assert.equal(budget.snapshot().sourceRGBA,65536);assert.equal(budget.snapshot().sources.length,1);
});
test('a second decoded object at the same path is not hidden by path deduplication',()=>{
 const budget=new ImageBudget(65536);
 budget.register('CAT01.png',source());
 assert.throws(()=>budget.register('CAT01.png',source()),/预算/);
});
test('UI and battle sources share one total rather than each receiving a full budget',()=>{
 const budget=new ImageBudget(100000);
 budget.register('ui',source());assert.throws(()=>budget.register('battle',source()),/预算/);
});
for(const image of [source(513,1),source(1,513),source(0,1),source(1,0),source(NaN,1),source(1.5,1),{...source(),complete:false}]){
 test('invalid decoded dimensions or pending image fails without counting '+JSON.stringify(image),()=>{
  const budget=new ImageBudget(5242880);assert.throws(()=>budget.register('invalid',image),/图片/);
  assert.equal(budget.snapshot().sourceRGBA,0);
 });
}
test('failed-load cleanup releases accounting; a retry does not accumulate old pixels',()=>{
 const budget=new ImageBudget(65536),first=source(),retry=source();
 budget.register('failed-batch',first);budget.release(first);budget.release(first);
 budget.register('retry',retry);assert.equal(budget.snapshot().sourceRGBA,65536);
});
test('a registered source cannot silently change dimensions',()=>{
 const budget=new ImageBudget(5242880),image=source();budget.register('cat',image);image.naturalWidth=256;
 assert.throws(()=>budget.register('cat',image),/尺寸改变/);assert.equal(budget.snapshot().sourceRGBA,65536);
});
test('snapshots contain source measurements, never image handles or host addresses',()=>{
 const budget=new ImageBudget(65536),image=source();Object.defineProperty(image,'src',{get(){throw Error('Do not read host addresses');}});
 budget.register('measured',image);const snapshot=budget.snapshot();
 assert.deepEqual(snapshot.sources,[{name:'measured',width:128,height:128,bytes:65536}]);
 snapshot.sources[0].width=1;assert.equal(budget.snapshot().sources[0].width,128);
});
