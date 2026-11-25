import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {r1BattlePaths} from '../src/r1-art';
import {ImageBudget} from '../src/image-budget';

const detail='./assets/r1-restoration/courtyard-detail-v01.png';
const png=(file:string)=>{const bytes=readFileSync(file);return {bytes,naturalWidth:bytes.readUInt32BE(16),naturalHeight:bytes.readUInt32BE(20),complete:true};};

test('material replacement removes old source loads and retains named combat effect sources',()=>{
  assert.equal(r1BattlePaths.length,11);
  assert.ok(r1BattlePaths.includes('./assets/r1-restoration/native/courtyard-native-v01.png'));
  assert.deepEqual(r1BattlePaths.slice(-4),['./assets/battle-feedback/bell-hit.png','./assets/battle-feedback/ground.png','./assets/first-combat/bubble.png','./assets/first-combat/b01-dust.png']);
  assert.ok(!r1BattlePaths.some(path=>path.includes('/map/')||path.includes('courtyard-detail')));
});

test('current CAT01 sources are canonical and do not duplicate retired orange sheets',()=>{
  assert.equal(r1BattlePaths.length,11);
  assert.equal(new Set(r1BattlePaths).size,11);
  assert.ok(!r1BattlePaths.some(path=>/orange-(body|parts)/.test(path)));
  for(const part of ['body','weapon','head','grip'])assert.ok(r1BattlePaths.includes('./assets/g6-cat/'+part+'.png'));
});

test('courtyard material uses the approved candidate bytes and preserves the full shared 5MiB ledger reserve',()=>{
  const expected=[['./assets/r1-restoration/native/courtyard-native-v01.png',887,1774]] as const;
  const receipt=JSON.parse(readFileSync('../assets/art/low-poly-v1/environment/native-clarity-v01/provenance.json','utf8'));
  for(const [file,width,height] of expected){const source=png(file);assert.deepEqual([source.naturalWidth,source.naturalHeight],[width,height]);assert.equal(createHash('sha256').update(source.bytes).digest('hex'),receipt.files.find((f:any)=>file.endsWith(f.runtimePath)).sha256);}
  const budget=new ImageBudget(5*1024*1024);
  for(const path of r1BattlePaths)budget.register(path,png(path));
  for(const id of ['CAT01','CAT02','CAT03'])budget.register(id,png('assets/r1-restoration/ui-'+id+'.png'));
  for(const id of ['W01','W02','W04','BALL','MAG','GUARD','MOVE']){
    const svg=readFileSync('assets/ui/'+id+'.svg','utf8');
    budget.register(id,{naturalWidth:Number(svg.match(/\bwidth="(\d+)"/)![1]),naturalHeight:Number(svg.match(/\bheight="(\d+)"/)![1]),complete:true});
  }
  const snapshot=budget.snapshot();
  assert.equal(snapshot.sources.length,20);assert.equal(snapshot.sourceRGBA,3397008);
  assert.equal(snapshot.mode,'strict');assert.deepEqual(snapshot.warnings,[]);
  assert.equal(snapshot.backgroundRGBA,expected.reduce((total,[,w,h])=>total+w*h*4,0));
});

test('courtyard detail registration keeps four original 887x1774 source windows',()=>{
  assert.ok(existsSync('src/r1-art/courtyard-detail-v01.json'),'registered detail descriptor exists');
  const descriptor=JSON.parse(readFileSync('src/r1-art/courtyard-detail-v01.json','utf8'));
  assert.deepEqual(descriptor.sourceSize,{width:887,height:1774});
  assert.deepEqual(descriptor.regions.map((r:any)=>[r.x,r.y,r.width,r.height,r.atlasX,r.atlasY]),[
    [140,300,192,160,0,0],[660,700,96,160,192,0],[160,1245,192,160,0,160],[650,1450,106,160,192,160]
  ]);
});
