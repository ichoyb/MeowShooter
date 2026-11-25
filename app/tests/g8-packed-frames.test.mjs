import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

test('G6 native atlas registration uses preserved logical frames after lossless packing', async () => {
  for (const [entry, method, images, keys] of [
    ['src/g6-cat-presentation.ts', 'registerG6CatTextures', {body:{}, weapon:{}, grip:{}, head:{}}, ['g6-cat01-body','g6-cat01-weapon']],
    ['src/g6-held-walk.ts', 'registerG6HeldWalkTextures', {CAT02:{},CAT03:{}}, ['g6-cat02-walk','g6-cat03-walk']],
  ]) {
    const result = await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'Art'});
    const scope={};runInNewContext(result.outputFiles[0].text,scope);
    const atlases=[];
    const scene={textures:{exists:()=>false,
      addAtlasJSONArray(key,image,data){atlases.push({key,image,data});return {};},
      addSpriteSheet(){return {get:()=>({setTrim(){}})};},addImage(){},
    }};
    scope.Art[method](scene,images);
    assert.deepEqual(atlases.map(a=>a.key),keys,'packed sheets must use native trimmed atlas frames');
    for (const {data} of atlases) {
      assert.ok(data.meta.size.w<=512&&data.meta.size.h<=512);
      for (const f of data.frames) {
        assert.ok(f.trimmed);assert.equal(f.rotated,false);
        assert.ok(f.spriteSourceSize.x+f.frame.w<=f.sourceSize.w);
        assert.ok(f.spriteSourceSize.y+f.frame.h<=f.sourceSize.h);
      }
    }
  }
});

test('the historical G8 export retains original source hashes and80complete frame proofs', () => {
  const receipt=JSON.parse(readFileSync('../assets/art/low-poly-v1/g8-lossless-runtime.source.json','utf8'));
  let frames=0;
  const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
  for (const sheet of receipt.sheets) {
    assert.equal(sha('../'+sheet.source),sheet.sourceSHA256);
    // Three motion atlases are superseded by presence-v01. Preserve the old
    // receipt and its original source proof; current runtime hashes are below.
    if(!['app/assets/g6-cat/body.png','app/assets/g6-held/cat02-walk.png','app/assets/g6-held/cat03-walk.png'].includes(sheet.runtime))assert.equal(sha(sheet.runtime.replace(/^app\//,'')),sheet.sha256);
    assert.ok(sheet.size.every(size=>size<=512));
    for(const frame of sheet.frames){assert.equal(frame.restoredRGBAEqual,true);frames++;}
  }
  assert.equal(frames,80);
  assert.ok(receipt.rgbaAfter<receipt.rgbaBefore);
});

test('the current presence adoption binds all three runtime atlases and native frame descriptors',()=>{
  const records=JSON.parse(readFileSync('ASSET_SOURCES.json'));
  const adopted=records.playerStrideAdoption,round=records.cat01RoundBodyAdoption;
  assert.ok(adopted,'the authorized stronger motion needs its own current adoption map, preserving the previous receipt');
  assert.equal(adopted.date,'2026-11-16');assert.equal(adopted.runtimeFiles.length,3);
  const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
  for(const file of adopted.runtimeFiles){
    if(!round||file.runtimePath!=='assets/g6-cat/body.png')assert.equal(sha(file.runtimePath),file.sha256);
    assert.equal(sha('../'+file.sourcePath),file.sourceSHA256);
    assert.ok(file.width<=512&&file.height<=512);
  }
  if(!round)assert.equal(sha(adopted.descriptor),adopted.descriptorSHA256);
  else assert.equal(sha(adopted.descriptor),round.descriptors.find(file=>file.path===adopted.descriptor).sha256);
  assert.equal(sha(adopted.heldPoseDescriptor),adopted.heldPoseDescriptorSHA256);
  assert.equal(adopted.supersedes,'playerPresenceAdoption');assert.equal(adopted.nonBackgroundSourceRGBA+adopted.sourceHeadroom,5242880);assert.ok(adopted.sourceHeadroom>=131072);
});
