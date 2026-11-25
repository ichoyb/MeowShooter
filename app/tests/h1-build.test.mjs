import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import chapterScenes from '../src/ui/chapter-scenes.json' with {type:'json'};
import g6BattleAssets from '../src/r1-art/g6-battle-paths.json' with {type:'json'};
import {imageDimensions} from '../tools/image-dimensions.mjs';

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const version = JSON.parse(readFileSync('package.json')).version;
test('WebP derivatives and source PNGs match the recorded dimensions and fingerprints',()=>{
  const entries=JSON.parse(readFileSync('ASSET_SOURCES.json')).runtimeWebPDelivery.entries;
  assert.equal(new Set(entries.map(entry=>entry.output)).size,entries.length);
  assert.equal(entries.filter(entry=>entry.mode==='q95').length,1);
  for(const entry of entries){
    const expected={width:entry.width,height:entry.height};
    const output=readFileSync(entry.output),original=readFileSync(entry.source);
    assert.equal(sha(entry.output),entry.sha256,entry.output);
    assert.equal(sha(entry.source),entry.sourceSHA256,entry.source);
    assert.deepEqual(imageDimensions(output,'.webp'),expected,entry.output);
    assert.deepEqual(imageDimensions(original,'.png'),expected,entry.source);
    assert.equal(output.length,entry.bytes);
    assert.equal(output.includes(Buffer.from('VP8L')),entry.mode==='lossless',entry.output);
  }
});
for (const profile of ['playtest', 'release', 'review']) {
  test(`H1 ${profile}: real normal build uses its approved profile-specific sources`, () => {
    const result = spawnSync(process.execPath, ['tools/build.mjs'], {env:{...process.env, BUILD_PROFILE:profile}, encoding:'utf8', windowsHide:true});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const dist = ({playtest:'dist-playtest-', release:'dist-', review:'dist-review-'})[profile] + version;
    const verifyBitmap=(logicalName,source=logicalName)=>{
      const output=dist+'/'+logicalName.replace(/\.png$/,'.webp');
      assert.equal(sha(output),sha(source.replace(/\.png$/,'.webp')));
      assert.equal(existsSync(dist+'/'+logicalName),false,'original PNG is not duplicated in the candidate');
    };
    if(profile==='playtest') {
      assert.equal(existsSync(dist+'/assets/cat.png'),false);
      for(const name of ['enemies.png','held-weapons.png','native/courtyard-native-v01.png'])verifyBitmap('assets/r1-restoration/'+name);
      for(const name of ['orange-body.png','orange-parts.png'])assert.equal(existsSync(dist+'/assets/r1-restoration/'+name),false,'obsolete CAT01 decoded source must not remain in the normal package');
      for(const file of ['atlas.png',...['body-0.png','body-1.png','weapon.png','grip.png','head.png'].map(name=>'cat01-pilot/'+name),'first-combat/parts.png',...['FIRE','FROST','SHOCK','SUMMON'].map(name=>'ui/'+name+'.svg')])assert.equal(existsSync(dist+'/assets/'+file),false,file);
    } else for(const file of ['assets/cat.png','assets/atlas.png'])verifyBitmap(file);
    for (const id of ['CAT01','CAT02','CAT03']) {
      const file='assets/ui/'+id+'.png';
      verifyBitmap(file,profile==='playtest'?'assets/r1-restoration/ui-'+id+'.png':file);
    }
    assert.equal(sha(dist+'/assets/ui/garden.jpeg'),sha(profile==='playtest'?'assets/r1-restoration/entry-scene.jpeg':'assets/ui/garden.jpeg'));
    assert.equal(existsSync(dist+'/assets/r1-restoration/entry-scene.jpeg'),false,'entry plate occupies only the existing CSS background slot');
    const bundle=readFileSync(dist+'/assets/main.js','utf8');
    assert.equal(bundle.includes('assets/g6-cat/body.png'),profile==='playtest','G6 loader stays in playtest');
    assert.equal(bundle.includes('G6 held walk reference speed'),profile==='playtest','G6 walk renderer stays in playtest');
    if (profile === 'playtest') {
      const record=JSON.parse(readFileSync('../.local/builds/'+version+'/'+profile+'/'+profile+'-build-record.json'));
      assert.equal(record.imageBudget.sourceRGBA,JSON.parse(readFileSync('ASSET_SOURCES.json')).cat01RoundBodyAdoption.nonBackgroundSourceRGBA);
      assert.equal(record.imageBudget.sources.length,27);
      assert.equal(record.imageBudget.mode,'strict');
      assert.equal(record.imageBudget.backgrounds.filter(row=>!Object.values(chapterScenes).includes(row.file)).reduce((n,row)=>n+row.bytes,0),7328392,'original courtyard backgrounds stay byte-for-byte budget equivalent');
      const story=record.imageBudget.backgrounds.filter(row=>Object.values(chapterScenes).includes(row.file));
      assert.equal(story.length,4);for(const row of story){assert.equal(row.width,768);assert.equal(row.height,1152);assert.equal(sha(dist+'/'+row.file),sha('assets/narrative/'+row.file.split('/').at(-1)));}
      assert.equal(record.imageBudget.backgroundRGBA,7328392+4*768*1152*4,'package source sum is not the one-scene runtime peak');
      assert.ok(record.imageBudget.headroom>=131072);
      for(const file of g6BattleAssets)verifyBitmap(file);
      assert.deepEqual(record.imageBudget.warnings,[]);
      for(const source of record.imageBudget.sources)assert.ok(source.width<=512&&source.height<=512);
      for(const file of ['battle-feedback/bell-hit.png','battle-feedback/ground.png','first-combat/bubble.png','first-combat/b01-dust.png'])verifyBitmap('assets/'+file);
      for(const id of ['W01','W02','W04','BALL','MAG','GUARD','MOVE'])assert.equal(sha(dist+'/assets/ui/'+id+'.svg'),sha('assets/ui/'+id+'.svg'));
      assert.ok(!record.modules.some(name => name.includes('tests/fixtures/')));
    } else for(const file of g6BattleAssets)assert.equal(existsSync(dist+'/'+file.replace(/\.png$/,'.webp')),false,file);
  });
}
