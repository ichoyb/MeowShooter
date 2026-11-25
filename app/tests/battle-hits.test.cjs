const { test } = require('node:test');
const assert = require('node:assert/strict');
const Body = require('phaser/src/physics/arcade/Body');
const Rectangle = require('phaser/src/geom/rectangle/Rectangle');
const hits = require('../src/battle-hits.cjs');

let nextId = 1;
function actor(x, y, kind = 'enemy', hp = 2) {
  const body = new Body({ defaults: {}, bounds: new Rectangle(0, 0, 360, 500) });
  body.setCircle(1); body.reset(x - 1, y - 1);
  const data = new Map([['id', nextId++], ['kind', kind], ['hp', hp], ['damage', 1], ['extraPierce', 0], ['pierceDamageMultiplier', .7],
    ['hitIds', new Set()], ['hitCount', 0], ['firstEnemyCredited', false], ['source', 'PRIMARY'], ['volleyId', 1], ['projectileId', 1]]);
  return { active: true, body, getData: key => data.get(key), setData: (key, value) => data.set(key, value) };
}

test('mirror return uses its own per-leg ledger and frozen initial allowance with descending damage',()=>{
 const shot=actor(100,80),one=actor(140,80,'enemy',100),two=actor(180,80,'enemy',100),fresh=actor(120,80,'enemy',100);
 for(const [k,v]of Object.entries({damage:12,nonCriticalDamage:12,extraPierce:1,returnEnabled:true,mirrorReturn:true,returnAllowance:2,flightPhase:'outbound',returnHitIds:new Set()}))shot.setData(k,v);
 const recycle=s=>{s.active=false;};
 assert.equal(hits.resolveHit(shot,one,recycle,{deferTerminal:true}).damage,12);assert(Math.abs(hits.resolveHit(shot,two,recycle,{deferTerminal:true}).damage-8.4)<1e-9);
 assert.equal(hits.beginReturn(shot,.7),true);assert.equal(hits.beginReturn(shot,.7),false);
 const first=hits.resolveHit(shot,two,recycle);assert(first,'outbound enemy must be eligible on return');assert(Math.abs(first.damage-5.88)<1e-9);assert.equal(first.firstEnemyHit,false);
 assert.equal(hits.resolveHit(shot,two,recycle),null,'return duplicate does not spend a slot');
 const second=hits.resolveHit(shot,one,recycle);assert(Math.abs(second.damage-4.116)<1e-9);assert.equal(shot.active,false);
 assert.equal(hits.resolveHit(shot,fresh,recycle),null);assert.equal(fresh.getData('hp'),100);assert.equal(shot.getData('returnHitIds').size,2);assert.equal(shot.getData('hitIds').size,2);
});
test('mirror return attenuation keeps critical and mark factors out of the next intrinsic base',()=>{
 const shot=actor(100,80),one=actor(140,80,'enemy',100),two=actor(180,80,'enemy',100);
 for(const [k,v]of Object.entries({damage:12,nonCriticalDamage:12,critical:true,criticalMultiplier:1.5,extraPierce:1,pierceDamageMultiplier:.85,returnEnabled:true,mirrorReturn:true,returnAllowance:2,flightPhase:'outbound',returnHitIds:new Set()}))shot.setData(k,v);
 hits.resolveHit(shot,one,()=>{},{deferTerminal:true,primaryTargetMultiplier:1.15});hits.resolveHit(shot,two,()=>{},{deferTerminal:true});hits.beginReturn(shot,.7);
 const first=hits.resolveHit(shot,two,()=>{},{primaryTargetMultiplier:1.15}),next=hits.resolveHit(shot,one,()=>{});
 assert(first&&next);assert(Math.abs(first.damage-12*.85*.7*1.5*1.15)<1e-9);assert(Math.abs(next.damage-12*.85*.7*.85*1.5)<1e-9);
 assert.equal(first.critical,true);assert.equal(next.critical,true);assert.equal(shot.getData('returnDamage'),12*.85*.7);
});

test('marked primary bonus applies at actual hit after critical without contaminating pierce or return bases',()=>{
 const shot=actor(100,80),one=actor(120,80,'enemy',100),two=actor(150,80,'enemy',100),fresh=actor(160,80,'enemy',100);
 for(const [key,value]of Object.entries({damage:12,nonCriticalDamage:12,critical:true,criticalMultiplier:1.5,extraPierce:1,returnEnabled:true,flightPhase:'outbound'}))shot.setData(key,value);
 const recycle=s=>{s.active=false;};
 const first=hits.resolveHit(shot,one,recycle,{deferTerminal:true,primaryTargetMultiplier:1.15});
 assert(Math.abs(first.damage-20.7)<1e-9);assert.equal(first.nonCriticalDamage,12);
 assert.equal(first.targetMultiplier,1.15);assert.equal(shot.getData('flightLastDamage'),12);
 const second=hits.resolveHit(shot,two,recycle,{deferTerminal:true});
 assert(Math.abs(second.damage-12.6)<1e-9);assert(Math.abs(second.nonCriticalDamage-8.4)<1e-9);
 hits.beginReturn(shot,.7);const back=hits.resolveHit(shot,fresh,recycle,{primaryTargetMultiplier:1.15});
 assert(Math.abs(back.damage-10.143)<1e-9);assert(Math.abs(back.nonCriticalDamage-5.88)<1e-9);
});

test('marked bonus never applies to secondary, summon or object hits',()=>{
 for(const source of ['SECONDARY','SUMMON']){
  const shot=actor(100,80),target=actor(120,80,'enemy',100);shot.setData('damage',12);shot.setData('source',source);
  const hit=hits.resolveHit(shot,target,s=>{s.active=false;},{primaryTargetMultiplier:1.15});assert.equal(hit.damage,12);assert.equal(hit.targetMultiplier,1);
 }
 const shot=actor(100,80),box=actor(120,80,'object',100);shot.setData('damage',12);
 assert.equal(hits.resolveHit(shot,box,s=>{s.active=false;},{primaryTargetMultiplier:1.15}).damage,12);
});

test('flight return keeps the full hit ledger and permits only one new target at70percent of the last noncritical path',()=>{
 const shot=actor(100,80),one=actor(120,80,'enemy',100),two=actor(150,80,'enemy',100),fresh=actor(160,80,'enemy',100);
 shot.setData('damage',12);shot.setData('extraPierce',1);shot.setData('returnEnabled',true);shot.setData('flightPhase','outbound');
 let recycled=0;const recycle=s=>{s.active=false;recycled++;};
 const first=hits.resolveHit(shot,one,recycle,{deferTerminal:true}),second=hits.resolveHit(shot,two,recycle,{deferTerminal:true});
 assert.equal(first.damage,12);assert(Math.abs(second.damage-8.4)<1e-9);assert.equal(recycled,0);
 assert.equal(hits.beginReturn(shot,.7),true);assert.equal(hits.beginReturn(shot,.7),false);
 assert.equal(shot.getData('hitCount'),2);assert.equal(shot.getData('hitIds').size,2);
 assert.equal(hits.resolveHit(shot,one,recycle),null);const back=hits.resolveHit(shot,fresh,recycle,{deferTerminal:true});
 assert(Math.abs(back.damage-5.88)<1e-9);assert.equal(back.firstEnemyHit,false);assert.equal(recycled,1);
 assert.equal(hits.resolveHit(shot,actor(170,80,'enemy',100),recycle),null);
});

test('flight return preserves one critical decision after85percent pierce and never creates first-hit credit twice',()=>{
 const shot=actor(100,80),targets=Array.from({length:4},(_,i)=>actor(120+i*30,80,'enemy',100));
 for(const [key,value]of Object.entries({damage:28.8,nonCriticalDamage:28.8,critical:true,criticalMultiplier:1.5,extraPierce:2,pierceDamageMultiplier:.85,returnEnabled:true,flightPhase:'outbound'}))shot.setData(key,value);
 const recycle=s=>{s.active=false;};const forward=targets.slice(0,3).map(t=>hits.resolveHit(shot,t,recycle,{deferTerminal:true}));
 for(const [i,n]of [43.2,36.72,31.212].entries())assert(Math.abs(forward[i].damage-n)<1e-8);
 hits.beginReturn(shot,.7);const back=hits.resolveHit(shot,targets[3],recycle);assert(Math.abs(back.damage-21.8484)<1e-8);assert.equal(back.critical,true);assert.equal(back.firstEnemyHit,false);
 const miss=actor(100,80);miss.setData('damage',12);miss.setData('returnEnabled',true);miss.setData('flightPhase','outbound');hits.beginReturn(miss,.7);
 assert(Math.abs(hits.resolveHit(miss,actor(120,80,'enemy',100),recycle).damage-8.4)<1e-9);
});

test('flight return after one ricochet defers terminal recycle and keeps its60percent intrinsic path factor',()=>{
 const shot=actor(100,80),one=actor(120,80,'enemy',100),two=actor(150,80,'enemy',100),fresh=actor(170,80,'enemy',100);
 shot.setData('damage',12);shot.setData('returnEnabled',true);shot.setData('flightPhase','outbound');
 let recycled=0;const recycle=s=>{s.active=false;recycled++;};hits.resolveHit(shot,one,recycle,{deferTerminal:true});
 shot.setData('ricocheted',true);shot.setData('ricochetDamage',7.2);
 assert(Math.abs(hits.resolveHit(shot,two,recycle,{deferTerminal:true}).damage-7.2)<1e-9);assert.equal(recycled,0);
 hits.beginReturn(shot,.7);assert(Math.abs(hits.resolveHit(shot,fresh,recycle).damage-5.04)<1e-9);assert.equal(recycled,1);
});

test('flight return origin clipping uses the native path fraction and stops at8u instead of damaging behind origin',()=>{
 const shot=actor(90,80);shot.setData('flightPhase','return');shot.setData('flightOrigin',{x:100,y:80});
 shot.body.prev.set(129,79);assert(Math.abs(hits.returnStopFraction(shot,8)-.55)<1e-9);
 shot.body.prev.set(99,79);assert.equal(hits.returnStopFraction(shot,8),0);
 shot.setData('flightPhase','outbound');assert.equal(hits.returnStopFraction(shot,8),null);
});

test('one critical primary keeps its noncritical base across pierce, reports its flag and never double multiplies ricochet',()=>{
 const shot=actor(100,80),targets=[1,2,3,4].map(n=>actor(100+n*30,80,'enemy',100));
 shot.setData('damage',12);shot.setData('nonCriticalDamage',12);shot.setData('critical',true);shot.setData('criticalMultiplier',1.5);shot.setData('extraPierce',2);
 let recycled=0;const recycle=p=>{p.active=false;p.body.enable=false;recycled++;};
 const results=targets.slice(0,3).map(t=>hits.resolveHit(shot,t,recycle,{deferTerminal:true}));
 for(const [i,expected] of [18,12.6,8.82].entries()){assert(Math.abs(results[i].damage-expected)<1e-9);assert.equal(results[i].critical,true);assert(Math.abs(results[i].nonCriticalDamage-[12,8.4,5.88][i])<1e-9);}
 assert.equal(hits.resolveHit(shot,targets[0],recycle),null);assert.equal(recycled,0);assert.equal(shot.getData('nonCriticalDamage'),12);
 shot.setData('ricocheted',true);shot.setData('ricochetDamage',results[2].nonCriticalDamage*.6);
 const bounce=hits.resolveHit(shot,targets[3],recycle);assert(Math.abs(bounce.damage-5.292)<1e-9);assert.equal(bounce.critical,true);assert.equal(recycled,1);
 assert.equal(results[0].damage*.35,6.3);
});

test('nonprimary damage never inherits forged critical metadata and direct critical kills settle once',()=>{
 for(const source of ['SECONDARY','SUMMON']){const shot=actor(100,80),target=actor(110,80,'enemy',50);
  shot.setData('source',source);shot.setData('damage',9);shot.setData('critical',true);shot.setData('criticalMultiplier',2.5);
  const result=hits.resolveHit(shot,target,p=>{p.active=false;});assert.equal(result.damage,9);assert.equal(result.critical,false);
 }
 const shot=actor(100,80),target=actor(110,80,'enemy',18);shot.setData('damage',12);shot.setData('critical',true);shot.setData('criticalMultiplier',1.5);
 let recycled=0;const recycle=p=>{p.active=false;recycled++;};const first=hits.resolveHit(shot,target,recycle);
 assert.equal(first.killed,true);assert.equal(target.getData('hp'),0);assert.equal(hits.resolveHit(shot,target,recycle),null);assert.equal(recycled,1);
});

test('terminal primary may defer recycling once for ricochet without replenishing pierce or clearing hit ids',()=>{
 const shot=actor(100,80),first=actor(120,80,'enemy',100),second=actor(150,80,'enemy',100),last=actor(180,80,'enemy',100);
 shot.setData('damage',12);shot.setData('extraPierce',1);let recycled=0;
 const recycle=p=>{p.active=false;p.body.enable=false;recycled++;};
 assert.equal(hits.resolveHit(shot,first,recycle,{deferTerminal:true}).exhausted,false);
 const r=hits.resolveHit(shot,second,recycle,{deferTerminal:true});assert(Math.abs(r.damage-8.4)<1e-8);assert.equal(r.exhausted,true);assert.equal(recycled,0);
 shot.setData('ricocheted',true);shot.setData('ricochetDamage',r.damage*.6);
 assert.equal(hits.resolveHit(shot,first,recycle),null);
 const bounced=hits.resolveHit(shot,last,recycle);assert(Math.abs(bounced.damage-5.04)<1e-8);assert.equal(recycled,1);
 assert.equal(shot.getData('extraPierce'),1);assert.equal(shot.getData('hitIds').size,3);
});

test('disabled projectiles share one damage and recycle path without repeated credit', () => {
  const shot = actor(150, 80), target = actor(150, 80);
  let recycled = 0;
  const recycle = projectile => { projectile.active = false; projectile.body.enable = false; recycled++; };
  assert.equal(hits.resolveHit(shot, target, recycle).damage, 1);
  assert.equal(hits.resolveHit(shot, target, recycle), null);
  assert.equal(target.getData('hp'), 1); assert.equal(recycled, 1);
});

test('configured primary damage stays floating point and repeat contacts do not spend another pierce', () => {
  const shot = actor(150, 80), target = actor(150, 80, 'enemy', 48);
  shot.setData('damage', 32 * .9); shot.setData('extraPierce', 2);
  let recycled = 0;
  const recycle = () => recycled++;
  const result = hits.resolveHit(shot, target, recycle);
  assert.equal(target.getData('hp'), 19.2);
  assert.equal(result.source, 'PRIMARY'); assert.equal(result.damage, 28.8);
  assert.equal(result.firstEnemyHit, true); assert.equal(result.killed, false);
  assert.equal(result.targetId, target.getData('id')); assert.deepEqual(result.position, { x: 150, y: 80 });
  assert.equal(hits.resolveHit(shot, target, recycle), null); assert.equal(recycled, 0);
  assert.equal(shot.getData('hitCount'), 1);
});

test('pierce damages three different entities by 1/.7/.49, including a crate, then stops', () => {
  const shot = actor(100, 80), targets = [actor(140, 80, 'object', 100), actor(180, 80, 'enemy', 100), actor(220, 80, 'enemy', 100), actor(260, 80, 'enemy', 100)];
  shot.setData('damage', 28.8); shot.setData('extraPierce', 2);
  let recycled = 0;
  const recycle = projectile => { recycled++; projectile.active = false; projectile.body.enable = false; };
  const results = targets.map(target => hits.resolveHit(shot, target, recycle));
  for (const [index, expected] of [28.8, 20.16, 14.112].entries()) {
    assert.ok(Math.abs(results[index].damage - expected) < 1e-9);
  }
  assert.equal(results[3], null);
  assert.deepEqual(results.slice(0, 3).map(result => result.firstEnemyHit), [false, true, false]);
  assert.equal(targets[3].getData('hp'), 100); assert.equal(recycled, 1);
});

function targetBody(target, radius) {
  const x = target.body.center.x, y = target.body.center.y;
  target.body.gameObject = null;
  target.body.setCircle(radius); target.body.reset(x - radius, y - radius); target.body.gameObject = target;
  return target;
}
function spatialCandidates(sweeps = [], endpoints = []) {
  return { overlapRect: () => sweeps.map(target => target.body), overlapCirc: () => endpoints.map(target => target.body) };
}

test('path candidates sort only Arcade-authorized bodies by circle entry then stable ID', () => {
  const shot = actor(100, 80), far = targetBody(actor(250, 80), 18), near = targetBody(actor(160, 80, 'object'), 21);
  const tieHigh = targetBody(actor(210, 80), 18), tieLow = targetBody(actor(210, 80), 18);
  tieHigh.setData('id', 90); tieLow.setData('id', 20);
  shot.body.prev.set(99, 79); shot.body.position.set(249, 79); shot.body.updateCenter();
  const candidates = hits.hitCandidates(shot, spatialCandidates([tieHigh, near, tieLow], [far]));
  assert.deepEqual(candidates.map(candidate => candidate.target.getData('id')), [near.getData('id'), 20, 90, far.getData('id')]);
  assert.equal(candidates[0].distance, 39); assert.equal(candidates[3].path, 'overlap');
  assert.deepEqual(hits.hitCandidates(shot, spatialCandidates()), []);
});

test('only supplied endpoint candidates hit zero-length paths and start-inside queries sort at zero', () => {
  const shot = actor(150, 80), target = targetBody(actor(150, 80), 18);
  assert.equal(hits.hitCandidates(shot, spatialCandidates([], [target]))[0].distance, 0);
  assert.deepEqual(hits.hitCandidates(shot, spatialCandidates()), []);
  shot.body.prev.set(149, 79); shot.body.position.set(249, 79); shot.body.updateCenter();
  assert.equal(hits.hitCandidates(shot, spatialCandidates([target]))[0].distance, 0);
});

test('path geometry consumes actual Body radius and excludes other DataManager kinds', () => {
  const shot = actor(100, 80), target = targetBody(actor(150, 91), 10), nonTarget = targetBody(actor(150, 80, 'projectile'), 18);
  shot.body.prev.set(99, 79); shot.body.position.set(199, 79); shot.body.updateCenter();
  assert.deepEqual(hits.hitCandidates(shot, spatialCandidates([target, nonTarget])), []);
  targetBody(target, 12);
  assert.equal(hits.hitCandidates(shot, spatialCandidates([target])).length, 1);
});

test('a moving flanker crossed by a bell at 60FPS still takes damage after leaving the static path', () => {
  // A 620u/s bell travels 10.333u while a 96u/s E03 moves 1.6u away.
  // At impact their relative segment enters radius 11; the final enemy circle
  // alone misses the whole horizontal projectile segment.
  const shot=actor(110+1/3,100),target=targetBody(actor(105,111.6,'enemy',36),11);
  shot.body.prev.set(99,99);target.body.prev.set(94,99);
  const physics={overlapCirc:()=>[],overlapRect:(x,y,w,h)=>
    target.body.left<=x+w&&target.body.right>=x&&target.body.top<=y+h&&target.body.bottom>=y?[target.body]:[]};
  const candidates=hits.hitCandidates(shot,physics,1.6);
  assert.equal(candidates.length,1);assert.equal(candidates[0].target,target);
  assert.equal(hits.resolveHit(shot,target,()=>{}).damage,1);
  assert.equal(target.getData('hp'),35);
});

test('an enemy arriving after the projectile passed is not a false static-circle hit',()=>{
 const shot=actor(110+1/3,100),target=targetBody(actor(105,110.7,'enemy',36),11);
 shot.body.prev.set(99,99);target.body.prev.set(94,101.3);
 assert.deepEqual(hits.hitCandidates(shot,spatialCandidates([target]),1.6),[]);
});

test('a moving enemy can cross a stationary bell between endpoints without widening its body',()=>{
 const shot=actor(100,100),target=targetBody(actor(105,100,'enemy',36),2);
 target.body.prev.set(93,98);
 assert.equal(hits.hitCandidates(shot,spatialCandidates([target]),10).length,1);
});

test('five independent shotgun pellets may damage one enemy once each without rounded damage', () => {
  const target = actor(150, 80, 'enemy', 48);
  for (let i = 0; i < 5; i++) {
    const shot = actor(150, 80); shot.setData('damage', 8); shot.setData('projectileId', i + 1);
    const recycle = projectile => { projectile.active = false; projectile.body.enable = false; };
    assert.equal(hits.resolveHit(shot, target, recycle).damage, 8);
    assert.equal(hits.resolveHit(shot, target, recycle), null);
  }
  assert.equal(target.getData('hp'), 8);
});

test('a sub-unit damage stays sub-unit and disabled targets cannot be credited twice', () => {
  const shot = actor(150, 80), target = actor(150, 80, 'enemy', .05);
  shot.setData('damage', .1); shot.setData('extraPierce', 2);
  const first = hits.resolveHit(shot, target, () => {});
  assert.equal(first.damage, .1); assert.equal(first.killed, true);
  assert.equal(target.getData('hp'), 0);
  assert.equal(hits.resolveHit(actor(150, 80), target, () => {}), null);
});

test('explicit pierce attenuation affects later damage without changing first-enemy credit', () => {
  const shot = actor(100, 80), targets = [actor(140, 80, 'object', 100), actor(180, 80, 'enemy', 100), actor(220, 80, 'enemy', 100)];
  shot.setData('damage', 20); shot.setData('extraPierce', 2); shot.setData('pierceDamageMultiplier', .5);
  const results = targets.map(target => hits.resolveHit(shot, target, () => {}));
  assert.deepEqual(results.map(result => result.damage), [20, 10, 5]);
  assert.deepEqual(results.map(result => result.firstEnemyHit), [false, true, false]);
});


test('SENTRY passes objects without consuming hit ledger and reports effect plus actual HP loss',()=>{
 const shot=actor(100,80),box=actor(110,80,'object',100),enemy=actor(120,80,'enemy',2);
 shot.setData('source','SUMMON');shot.setData('effect','SENTRY');shot.setData('damage',7.2);
 let recycled=0;const recycle=s=>{s.active=false;recycled++;};
 assert.equal(hits.resolveHit(shot,box,recycle),null);assert.equal(box.getData('hp'),100);assert.equal(shot.getData('hitIds').size,0);assert.equal(recycled,0);
 const hit=hits.resolveHit(shot,enemy,recycle,{primaryTargetMultiplier:1.15});assert.equal(hit.effect,'SENTRY');assert.equal(hit.damage,7.2);assert.equal(hit.actualDamage,2);assert.equal(hit.critical,false);assert.equal(hit.targetMultiplier,1);assert.equal(recycled,1);
});
test('ordinary hit damage keeps overkill semantics while actualDamage measures HP decrease',()=>{
 const shot=actor(1,1),target=actor(2,1,'enemy',.25);shot.setData('damage',12);const result=hits.resolveHit(shot,target,()=>{});
 assert.equal(result.damage,12);assert.equal(result.actualDamage,.25);
});
