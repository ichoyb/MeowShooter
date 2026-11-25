import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionPlaytestSummaries} from '../src/playtest-summary';
const facts=(extra:any={})=>({elapsed:0,travel:0,collectedXP:0,level:1,confirmedPicks:0,eliteRewards:0,bossEncountered:false,result:null,...extra});
test('first facts come from this run and zero timestamps remain valid',()=>{
 const s=new SessionPlaytestSummaries();s.start(1,'CAT01','W01');s.visibleEnemy(0);s.primaryHit(0);s.observe(facts({elapsed:2,travel:.1}));
 assert.equal(s.current()!.first.enemy,0);assert.equal(s.current()!.first.hit,0);assert.equal(s.current()!.first.move,2);assert.equal(s.current()!.first.pickup,null);
 s.observe(facts({elapsed:3,travel:12,collectedXP:1,level:2,confirmedPicks:1}));s.observe(facts({elapsed:9,collectedXP:4,confirmedPicks:2}));
 assert.equal(s.current()!.first.pickup,3);assert.equal(s.current()!.first.upgrade,3);
});
test('elite confirmation differs from experience upgrade; queued offers grant nothing',()=>{
 const s=new SessionPlaytestSummaries();s.start(1,'CAT02','W04');s.observe(facts({elapsed:150,confirmedPicks:1,eliteRewards:1}));
 assert.equal(s.current()!.upgrades,0);assert.equal(s.current()!.eliteRewards,1);assert.equal(s.current()!.first.upgrade,null);
 s.observe(facts({elapsed:151,confirmedPicks:2,eliteRewards:1}));assert.equal(s.current()!.first.upgrade,151);
});
test('only accepted lethal HP loss supplies death source',()=>{
 const s=new SessionPlaytestSummaries();s.start(1,'CAT03','W02');s.damage('B01_SLAM',false,0,0);s.damage('E01_CONTACT',true,2,10);s.observe(facts({result:'death'}));assert.equal(s.current()!.deathSource,null);
 const other=new SessionPlaytestSummaries();other.start(2,'CAT01','W01');other.damage('B01_SLAM',true,10,0);other.observe(facts({result:'death'}));assert.equal(other.current()!.deathSource,'B01_SLAM');
});
test('restart retains one previous run and clears first facts',()=>{
 const s=new SessionPlaytestSummaries();s.start(1,'CAT01','W01');s.observe(facts({elapsed:12,travel:20,collectedXP:2}));s.start(2,'CAT02','W04');assert.equal(s.previous()!.outcome,'restarted');assert.equal(s.previous()!.elapsed,12);assert.equal(s.current()!.first.move,null);
 s.end('abandoned');assert.equal(s.previous()!.runId,2);assert.equal(s.current(),null);s.start(3,'CAT03','W02');assert.equal(s.previous()!.runId,2);
});
test('timeout, win and snapshots are actual outcomes and defensive copies',()=>{
 const s=new SessionPlaytestSummaries();s.start(1,'CAT01','W01');s.observe(facts({elapsed:600,result:'timeout',bossEncountered:true}));const c=s.current()!;assert.equal(c.outcome,'timeout');assert.equal(c.bossEncountered,true);(c.first as any).move=999;assert.equal(s.current()!.first.move,null);
 s.start(2,'CAT02','W04');assert.equal(s.previous()!.outcome,'timeout');s.observe(facts({elapsed:480,result:'cleared'}));assert.equal(s.current()!.outcome,'cleared');
});
