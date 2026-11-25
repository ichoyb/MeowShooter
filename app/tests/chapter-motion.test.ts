import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterMoment,chapterMotionMarkup,CHAPTER_DURATION} from '../src/ui/chapter-motion';
test('adopted opening uses approved reaction and gate; live handoff has no frozen screenshot',()=>{
 assert.equal(CHAPTER_DURATION.opening,18);assert.equal(CHAPTER_DURATION.ending,24);
 assert.equal(chapterMoment('opening',0,'CAT01').art,'fish');
 assert.equal(chapterMoment('opening',4.3,'CAT01').art,'reaction');
 assert.equal(chapterMoment('opening',10,'CAT01').art,'gate');
 for(const cat of ['CAT01','CAT02','CAT03'] as const){const m=chapterMoment('opening',17.8,cat);assert.equal(m.handoff,true);assert.match(m.speaker,/小满|听雪|乌舟/);}
 const p=chapterMotionMarkup('opening',false);assert.match(p.body,/data-chapter-art/);assert.match(p.footer,/chapter-toggle/);assert.match(p.body,/chapter-skip/);assert.doesNotMatch(p.body+p.footer,/battle-reference|iframe|CAT01\.png|解锁成功/);
});
test('ending reveals only the approved first chapter clue, with a future chapter teaser',()=>{
 const first=chapterMoment('ending',0,'CAT01');assert.equal(first.art,'plaque');assert.match(first.line,/院门/);
 const clue=chapterMoment('ending',6,'CAT01');assert.equal(clue.address,true);assert.match(clue.line,/弯钉/);
 assert.match(chapterMoment('ending',15,'CAT01').line,/不记得/);
 assert.match(chapterMoment('ending',20,'CAT01').subline,/风炉街/);
 for(const t of [0,6,12,15,20,24])assert.doesNotMatch(JSON.stringify(chapterMoment('ending',t,'CAT01')),/解锁|断灯|守灯人|引路兽|两端应答/);
});
