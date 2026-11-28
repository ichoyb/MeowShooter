import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';

const cats=['CAT01','CAT02','CAT03'];
async function readBalance(plugins=[]){
 const {outputFiles:[bundle],metafile}=await build({define:{__DEVTOOLS__:'false'},entryPoints:['tools/courtyard-balance-data.ts'],
  bundle:true,platform:'node',format:'esm',write:false,metafile:true,plugins});
 assert(!Object.keys(metafile.inputs).some(name=>/phaser-entry|node_modules\/phaser|src\/battle\.ts$/.test(name)));
 const {readCourtyardBalance}=await import('data:text/javascript;base64,'+Buffer.from(bundle.contents).toString('base64'));
 return readCourtyardBalance(cats);
}

test('balance export reads the resolved normal configuration, eligibility, tuning and time boundaries',async()=>{
 const data=await readBalance();
 assert.deepEqual(data.profiles.map(p=>[p.base.catId,p.effective.weaponId,p.effective.maxHp,p.effective.moveSpeed]),
  [['CAT01','W01',95,185],['CAT02','W04',100,175],['CAT03','W02',120,162]]);
 assert.equal(data.rulesVersion,'courtyard-growth-normal50-v18');
 assert.equal(data.cards.length,50);
 assert.equal(new Set(data.cards.map(card=>card.id)).size,50);
 assert(data.cards.every(card=>card.numeric));
 assert.deepEqual(data.profiles.map((_,i)=>data.cards.filter(c=>c.eligible[i]).length),[25,26,28]);
 assert.deepEqual(data.cards.find(c=>c.id==='E23').requires,['L1_PIERCE','M05']);
 assert.equal(data.cards.find(c=>c.id==='L1_EVO_CADENCE').supportPicks,2);
 assert.deepEqual(data.xp[27],[28,29,54,879]);
 assert.deepEqual(data.reinforcement,{eliteQuota:6,bossQuota:8,interval:.5,window:8});
 assert.match(data.cards.find(c=>c.id==='C13').numeric,/20%.*6秒.*10%/);
 assert.match(data.cards.find(c=>c.id==='M10').numeric,/15%.*2秒/);
});

test('export follows changed source values in both its numeric reward row and derived previews',async()=>{
 const change={
  name:'test-only-balance-tuning',setup(builder){
   builder.onLoad({filter:/[\\/]progression-content\.ts$/},async({path})=>{
    const original=await readFile(path,'utf8');
    const contents=original.replace('magnetRadius:40','magnetRadius:50').replace('criticalChanceStep:.1','criticalChanceStep:.2');
    assert.notEqual(contents,original);
    return {contents,loader:'ts'};
   });
  }
 };
 const data=await readBalance([change]);
 assert.equal(data.pickup.magnetRadius,50);
 assert.match(data.cards.find(c=>c.id==='A10').numeric,/50u/);
 assert.match(data.cards.find(c=>c.id==='A11').numeric,/20个百分点/);
 assert.equal(data.criticalPicks,3);
});
