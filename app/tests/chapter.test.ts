import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterClues,chapterFrames,chapterMarkup,chapterResult} from '../src/ui/chapter';

test('approved first chapter has manual opening and ending with shared scene sources',()=>{
 assert.equal(chapterFrames.opening.length,3);assert.equal(chapterFrames.ending.length,3);
 assert.equal(chapterFrames.opening[0].art,chapterFrames.opening[1].art);
 for(const kind of ['opening','ending'] as const)for(let i=0;i<3;i++){
  const p=chapterMarkup(kind,i,false);assert.match(p.body,/data-chapter-art/);
  assert.match(p.footer,/chapter-next/);assert.match(p.body,/chapter-skip/);
  assert.doesNotMatch(p.body+p.footer,/示例数据|解锁成功|永久保存|iframe|canvas/);
 }
});
test('chapter clues require actual encounter facts, never elapsed time or merely elite arrival',()=>{
 const s:any={result:null,elapsed:599,level:{bossAt:null,encounters:[{enemyId:'EL01',spawnedAt:150,defeatedAt:null}]}};
 assert.deepEqual(chapterClues(s),[]);
 s.level.encounters[0].defeatedAt=170;assert.equal(chapterClues(s).length,1);
 s.level.encounters.push({enemyId:'EL01',spawnedAt:300,defeatedAt:340});assert.equal(chapterClues(s).length,2);
 s.level.bossAt=450;assert.equal(chapterClues(s).length,3);
 for(const result of ['death','timeout']){s.result=result;assert.doesNotMatch(chapterResult(s,true),/风炉街七号|认出.*笔迹|庭院守住/);}
 s.result='cleared';assert.match(chapterResult(s,true),/风炉街七号/);
});
test('result uses actual encounters and different responses for death, timeout and clear',()=>{
 const empty:any={result:'death',level:null};assert.match(chapterResult(empty,false),/先回灯下/);
 assert.doesNotMatch(chapterResult(empty,false),/已击退.*精英|已遇见.*巨兽/);
 assert.match(chapterResult({...empty,result:'timeout'},false),/时间|雾还没有散/);
 assert.match(chapterResult({...empty,result:'cleared'},true),/院门|门牌/);
 assert.notEqual(chapterResult(empty,false,1),chapterResult(empty,false,2));
 assert.equal(chapterResult(empty,false,1),chapterResult(empty,false,3));
});
