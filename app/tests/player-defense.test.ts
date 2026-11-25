import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/rules';
import * as Config from '../src/combat-config';
import {courtyardRunConfig,normalCourtyardRunConfig} from '../src/level-config';
import {RunGrowth,growthCards,growthCard,growthCardEligible,type GrowthRanks} from '../src/progression';
import {r1HUDValues} from '../src/ui/hud';
import {growthBuild,growthDetail,growthCardSummary} from '../src/ui/progression';

const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const legacy=()=>({...courtyardRunConfig(Config.makeRunConfig('CAT01','W01','p2-basic')),projectileTraits:{enabled:true as const},projectileFlight:{enabled:true as const},huntTargeting:{enabled:true as const},areaAbilities:{enabled:true as const}});
const base=()=>({...legacy(),defenseCompanions:{enabled:true as const}});
const session=(ranks:GrowthRanks={...zero,C13:1,A13:1})=>{const s=new Session(base());s.applyGrowth(ranks);return s;};
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const move=(s:Session,to:number)=>{const from=s.elapsed;s.advance(to-from);return from;};

test('real Session applies armor then shield then HP and returns exact incoming facts',()=>{
 const s=session();assert.equal(s.hp,90);assert.equal(s.snapshot().defense.shield,18);
 const first=s.damage(10);
 assert.deepEqual(first,{accepted:true,rawDamage:10,afterArmor:10*100/106,shieldAbsorbed:10*100/106,hpLost:0,shieldBroke:false});
 near(s.snapshot().defense.shield,8.566037735849056);assert.equal(s.hp,90);
 s.advance(.7);const second=s.damage(10);
 near(second.shieldAbsorbed,8.566037735849056);near(second.hpLost,.8679245283018888);
 assert.equal(second.shieldBroke,true);assert.equal(s.snapshot().defense.shield,0);near(s.hp,89.13207547169812);
 near(s.snapshot().defense.absorbedTotal,18);near(s.snapshot().defense.hpLostTotal,second.hpLost);
 assert.deepEqual(s.snapshot().defense.lastHit,second);assert.equal(s.snapshot().defense.lastEnemyAt,.7);
});
test('shield recovery has exact six-second boundary and settles each effective interval once',()=>{
 const s=session({...zero,C13:1});s.damage(18);
 assert.equal(s.settleShieldRecovery(move(s,6)),0);assert.equal(s.snapshot().defense.rechargeWait,0);
 near(s.settleShieldRecovery(move(s,6.5)),.9);near(s.snapshot().defense.shield,.9);
 assert.equal(s.settleShieldRecovery(6),0);assert.equal(s.settleShieldRecovery(7),0);
 near(s.settleShieldRecovery(move(s,7)),.9);
 near(s.settleShieldRecovery(move(s,16)),16.2);assert.equal(s.snapshot().defense.shield,18);
 assert.equal(s.settleShieldRecovery(move(s,17)),0);
});
test('same-frame enemy damage wins over a recovery opportunity and refreshes even on full shield absorption',()=>{
 const s=session({...zero,C13:1});s.damage(10);const from=move(s,7);const hit=s.damage(1);
 assert.equal(hit.hpLost,0);assert.equal(hit.shieldAbsorbed,1);assert.equal(s.settleShieldRecovery(from),0);
 assert.equal(s.snapshot().defense.lastEnemyAt,7);assert.equal(s.snapshot().defense.rechargeWait,6);
 near(s.settleShieldRecovery(move(s,13.5)),.9);
});
test('first C13 fills shield without HP healing and repeated growth cannot fill it again',()=>{
 const s=session(zero);s.damage(20);s.applyGrowth({...zero,C13:1});assert.equal(s.hp,70);assert.equal(s.snapshot().defense.shield,18);
 s.damage(10);s.applyGrowth({...zero,C13:1});assert.equal(s.snapshot().defense.shield,8);assert.equal(s.hp,70);
});
test('HP growth extends shield cap without filling it and elite healing changes HP alone',()=>{
 const s=session({...zero,C13:1});s.damage(28);s.applyGrowth({...zero,C13:1,L1_HEART:1});
 assert.equal(s.effectiveConfig.maxHp,105);assert.equal(s.hp,95);assert.equal(s.snapshot().defense.maxShield,21);assert.equal(s.snapshot().defense.shield,0);
 assert.equal(s.applyGrowthReward({...zero,C13:1,L1_HEART:1},.2),10);assert.equal(s.hp,105);assert.equal(s.snapshot().defense.shield,0);assert.equal(s.snapshot().defense.lastEnemyAt,0);
});
test('invalid hits are rejected without changing damage or recovery history',()=>{
 const s=session();const before=s.snapshot().defense;
 assert.equal(before.lastEnemyAt,null);assert.equal(before.lastHit,null);
 for(const damage of [NaN,Infinity,-Infinity,0,-1]){assert.equal(s.damage(damage).accepted,false);assert.deepEqual(s.snapshot().defense,before);}
 assert.equal(JSON.parse(JSON.stringify(s.snapshot())).defense.lastEnemyAt,null);
});
test('paused recovery consumes no elapsed time and never accumulates skipped intervals',()=>{
 const s=session({...zero,C13:1});s.damage(18);s.pause('menu');const before=s.snapshot();s.advance(30);
 assert.equal(s.damage(10).accepted,false);assert.equal(s.settleShieldRecovery(0),0);assert.deepEqual(s.snapshot(),before);
 s.resume();near(s.settleShieldRecovery(move(s,6.5)),.9);
 // A skipped settlement is not replayed from an arbitrarily old caller interval.
 move(s,10);near(s.settleShieldRecovery(9.5),.9);assert.equal(s.settleShieldRecovery(0),0);
});
test('lethal enemy hit settles immediately and cannot be healed or recovered after death',()=>{
 const s=session({...zero,C13:1});s.hp=1;s.damage(18);const from=move(s,7);const hit=s.damage(10);
 assert.equal(hit.hpLost,1);assert.equal(s.hp,0);assert.equal(s.result,'death');assert.equal(s.settleShieldRecovery(from),0);
 assert.equal(s.applyGrowthReward({...zero,C13:1,L1_HEART:1},1),false);assert.equal(s.damage(1).accepted,false);
 assert.equal(s.step(0,{x:1,y:0}),null);assert.equal(s.shots,0);
});
test('cleared and timed-out sessions never receive shield recovery',()=>{
 for(const finish of ['boss','duration'] as const){const b={...base(),durationSeconds:7,endCondition:finish},s=new Session(b);s.applyGrowth({...zero,C13:1});s.damage(18);move(s,7);if(finish==='boss')s.completeBoss();else s.step(0,null);assert.ok(s.result);assert.equal(s.settleShieldRecovery(6),0);assert.equal(s.snapshot().defense.shield,0);}
});
test('armor has no hidden cap or minimum damage and overkill totals report actual HP loss',()=>{
 const s=session({...zero,A13:1_000_000});const hit=s.damage(.01);
 near(hit.afterArmor,.01*100/6_000_100);assert.ok(hit.hpLost>0&&hit.hpLost<.01);assert.equal(hit.shieldAbsorbed,0);
 const other=session(zero);other.hp=.25;assert.equal(other.damage(100).hpLost,.25);assert.equal(other.snapshot().defense.hpLostTotal,.25);
});
test('without explicit defense capability existing damage and controlled39 metadata stay unchanged',()=>{
 const n=legacy(),s=new Session(n);s.applyGrowth({...zero,A13:100,C13:1});s.damage(10);
 assert.equal(s.hp,80);assert.equal(s.snapshot().defense.enabled,false);assert.equal(s.snapshot().defense.shield,0);assert.equal(s.snapshot().defense.multiplier,1);
 assert.equal(growthCards(n).length,39);assert.equal(new RunGrowth(1,()=>0,n).snapshot().rulesVersion,'courtyard-growth-area-v13-controlled-traits-flight-v2-hunt-v1-area-v2');
});
test('D2 retains A13/C13 in its explicit controlled scope and retains old qualification boundaries',()=>{
 const b=base();assert.equal(growthCards(b).length,44);assert.equal(growthCard('A13')?.icon,'GUARD.svg');assert.equal(growthCard('C13')?.icon,'GUARD.svg');
 assert.equal(growthCardEligible('A13',zero,b),true);assert.equal(growthCardEligible('A13',{...zero,A13:100},b),true);
 assert.equal(growthCardEligible('C13',zero,b),true);assert.equal(growthCardEligible('C13',{...zero,C13:1},b),false);
 for(const id of ['A13','C13'] as const)assert.equal(growthCardEligible(id,zero,legacy()),false);
 for(const id of ['A07','A08','L1_SHOCK_BELL','L1_RICOCHET','L1_PICKUP_CHIME'] as const)assert.equal(growthCardEligible(id,{...zero,C13:1},b),false,id);
 assert.match(new RunGrowth(1,()=>0,b).snapshot().rulesVersion,/-controlled-defense-v3$/);
});
test('defense capability uses the same playtest-only profile boundary',()=>{
 assert.equal(typeof Config.assertDefenseCompanionsProfile,'function');
 for(const profile of ['release','review'] as const)assert.throws(()=>Config.assertDefenseCompanionsProfile(base(),profile),/playtest/);
 assert.doesNotThrow(()=>Config.assertDefenseCompanionsProfile(base(),'playtest'));assert.doesNotThrow(()=>Config.assertDefenseCompanionsProfile(legacy(),'release'));
 for(const profile of ['release','review'] as const)assert.throws(()=>Config.assertDefenseCompanionsProfile(normalCourtyardRunConfig(Config.makeRunConfig('CAT01','W01','p2-basic')),profile),/playtest/);
});
test('enabled HUD and owned defense cards display current shield and armor without new HUD rows',()=>{
 const s=session();s.damage(10);const g={...new RunGrowth(1,()=>0,base()).snapshot(),ranks:{...zero,C13:1,A13:1},defense:s.snapshot().defense};
 const values=r1HUDValues({...s.snapshot(),durationSeconds:600,progression:g});assert.match(values.ammo,/盾9\/18/);assert.match(values.ammo,/甲5\.7%/);
 assert.doesNotMatch(r1HUDValues({...new Session(legacy()).snapshot(),durationSeconds:600}).ammo,/盾|减伤/);
 const owned=growthBuild(g,base(),{courtyard:true});assert.match(owned,/8\.566/);assert.match(owned,/18/);assert.match(owned,/5\.66%/);
 assert.match(growthDetail('A13',g,base(),{courtyard:true,source:'owned'}).body,/每次.*6/);
 assert.match(growthCardSummary('C13',g,base()).benefit,/18/);
});
