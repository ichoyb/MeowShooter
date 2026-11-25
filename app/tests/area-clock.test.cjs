const test=require('node:test');
const assert=require('node:assert/strict');
const Clock=require('phaser/src/time/Clock');
const EventEmitter=require('phaser/src/events/EventEmitter');
const nativeClock=()=>new Clock({sys:{events:new EventEmitter()}});

test('native startAt carries a looping deployment remainder through pending insertion into a two-second expiry',()=>{
 const clock=nativeClock();let due=false,expired=false;
 const deploy=clock.addEvent({delay:5000,loop:true,callback:()=>{due=true;}});
 clock.preUpdate();clock.update(5037,5037);
 assert(due);assert.equal(deploy.getElapsed(),37);
 const expiry=clock.addEvent({delay:2000,startAt:deploy.getElapsed(),callback:()=>{expired=true;}});
 assert.equal(expiry.delay,2000);assert.equal(expiry.getRemaining(),1963);
 assert(clock._pendingInsertion.includes(expiry));assert(!expired);
 clock.preUpdate();clock.update(6999,1962);assert(!expired);assert.equal(expiry.getRemaining(),1);
 clock.preUpdate();clock.update(7000,1);assert(expired);assert.equal(expiry.getRemaining(),0);
});

test('native Clock pause freezes the same shifted expiry and resumes only its remaining game time',()=>{
 const clock=nativeClock();let expired=false;
 const expiry=clock.addEvent({delay:2000,startAt:37,callback:()=>{expired=true;}});
 clock.preUpdate();clock.update(500,500);const remaining=expiry.getRemaining();
 clock.paused=true;clock.preUpdate();clock.update(10500,10000);
 assert.equal(expiry.getRemaining(),remaining);assert(!expired);
 clock.paused=false;clock.preUpdate();clock.update(11962,1462);assert(!expired);
 clock.preUpdate();clock.update(11963,1);assert(expired);
});
