import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionOnboarding} from '../src/onboarding';
const facts=(patch:any={})=>({elapsed:0,travel:0,primaryShots:0,droppedXP:0,collectedXP:0,offerId:null,confirmedPicks:0,danger:false,...patch});
test('movement compacts but never times out; actual 12u completes it',()=>{
 const s=new SessionOnboarding();s.startRun();s.expire('move');assert.equal(s.snapshot().hint?.kind,'move');assert.equal(s.snapshot().hint?.compact,true);assert.equal(s.snapshot().completed.move,false);
 s.observe(facts({travel:11.99}));assert.equal(s.snapshot().hint?.kind,'move');s.observe(facts({travel:12}));assert.equal(s.snapshot().hint?.kind,'fire');
});
test('facts ahead of current instruction complete without repeated work',()=>{
 const s=new SessionOnboarding();s.startRun();s.observe(facts({primaryShots:1,collectedXP:2,droppedXP:2,confirmedPicks:1}));assert.equal(s.snapshot().hint?.kind,'move');
 s.observe(facts({travel:12,primaryShots:1,collectedXP:2,droppedXP:2,confirmedPicks:1}));assert.equal(s.snapshot().hint,null);
});
test('XP waits for actual uncollected drop and upgrade for real offer',()=>{
 const s=new SessionOnboarding();s.startRun();s.observe(facts({travel:12,primaryShots:1}));assert.equal(s.snapshot().hint,null);
 s.observe(facts({travel:12,primaryShots:1,droppedXP:2}));assert.equal(s.snapshot().hint?.kind,'xp');s.expire('xp');assert.equal(s.snapshot().hint?.compact,true);
 s.observe(facts({travel:12,primaryShots:1,droppedXP:2,collectedXP:2,offerId:1}));assert.equal(s.snapshot().hint?.kind,'upgrade');assert.equal(s.snapshot().completed.upgrade,false);
 s.observe(facts({travel:12,primaryShots:1,droppedXP:2,collectedXP:2,confirmedPicks:1}));assert.equal(s.snapshot().completed.upgrade,true);
});
test('pause compacts current step, danger and actual hurt suppress temporarily',()=>{
 const s=new SessionOnboarding();s.startRun();s.clearTransient();assert.equal(s.snapshot().hint?.compact,true);
 s.observe(facts({danger:true}));assert.equal(s.snapshot().hint,null);s.observe(facts({danger:false}));assert.equal(s.snapshot().hint?.kind,'move');
 s.hurt(4);s.observe(facts({elapsed:4.5}));assert.equal(s.snapshot().hint,null);s.observe(facts({elapsed:5.3}));assert.equal(s.snapshot().hint?.kind,'move');
});
test('skip does not complete; restart preserves actual completed steps',()=>{
 const s=new SessionOnboarding();s.startRun();s.skip();assert.equal(s.snapshot().hint,null);assert.equal(s.snapshot().completed.move,false);
 s.startRun();assert.equal(s.snapshot().hint?.kind,'move');s.observe(facts({travel:12,primaryShots:1}));s.startRun();assert.equal(s.snapshot().completed.move,true);assert.equal(s.snapshot().completed.fire,true);assert.equal(s.snapshot().hint,null);
});

test('real offer takes display priority without completing movement',()=>{
 const s=new SessionOnboarding();s.startRun();s.observe(facts({offerId:1}));assert.equal(s.snapshot().hint?.kind,'upgrade');assert.equal(s.snapshot().completed.move,false);
 s.observe(facts({confirmedPicks:1}));assert.equal(s.snapshot().hint?.kind,'move');
});
