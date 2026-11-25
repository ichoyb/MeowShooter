import test from 'node:test';
import assert from 'node:assert/strict';
import {inOpeningSpawnWindow,SliceSpawns,spawnStageAt,SPAWN_STAGES} from '../src/level-config';
import {r1HUDValues} from '../src/ui/hud';
test('opening moves exactly the original first slot and birth quota to the first battle frame',()=>{
 const s=new SliceSpawns({opening:true});
 assert.equal(s.take(.033),'E01');s.recordBirth(.033);
 assert.equal(s.take(2.99),null);assert.equal(s.take(3),null);assert.equal(s.take(5.99),null);
 assert.equal(s.take(6),'E01');assert.equal(s.take(6),null);assert.equal(s.snapshot()[0].planned,2);assert.equal(s.snapshot()[0].spawned,1);
 assert.equal(s.take(9),'E01');assert.equal(s.take(60),'E01');assert.equal(s.take(61.8),'E01');
 assert.equal(s.snapshot()[1].planned,2);assert.equal(SPAWN_STAGES[0].start,3);
});
test('opening produces the same ordinary quota and later stage sequence as the historical schedule',()=>{
 const opening=new SliceSpawns({opening:true}),historical=new SliceSpawns();assert.equal(opening.take(0),'E01');
 for(let t=3;t<60;t+=3){const old=historical.take(t),next=opening.take(t);assert.equal(next,t===3?null:old);}
 assert.equal(opening.snapshot()[0].planned,historical.snapshot()[0].planned);
 for(let t=60;t<600;t+=.05)assert.equal(opening.take(t),historical.take(t));
});
test('opening eligibility and capacity share the first regular stage boundary',()=>{
 assert.equal(inOpeningSpawnWindow(-.001),false);
 assert.equal(inOpeningSpawnWindow(0),true);
 assert.equal(inOpeningSpawnWindow(2.999),true);
 assert.equal(inOpeningSpawnWindow(3),false);
 assert.equal(spawnStageAt(2.999),undefined);
 assert.equal(spawnStageAt(2.999,true),SPAWN_STAGES[0]);
 assert.equal(spawnStageAt(3,true),SPAWN_STAGES[0]);
 const spawns=new SliceSpawns({opening:true});
 spawns.recordBirth(0);
 spawns.recordBirth(3,true);
 assert.deepEqual(spawns.snapshot()[0],{start:3,planned:0,spawned:2,reinforcements:1});
});
test('unowned defenses stay absent while an owned depleted shield remains visible',()=>{
 const s={durationSeconds:600,ammo:12,ammoCapacity:12,reloadLeft:0,defense:{enabled:true,shield:0,maxShield:0,armor:0,multiplier:1}};
 assert.equal(r1HUDValues(s).ammo,'弹12/12');
 assert.equal(r1HUDValues({...s,defense:{...s.defense,maxShield:18}}).ammo,'弹12/12 盾0/18');
 assert.equal(r1HUDValues({...s,defense:{...s.defense,armor:6,multiplier:100/106}}).ammo,'弹12/12 甲5.7%');
});
import {onboardingMarkup} from '../src/ui/hud';
test('onboarding markup keeps drag cue passthrough and offers explicit tutorial skip',()=>{
 assert.equal(onboardingMarkup(null),'');
 const p=onboardingMarkup({kind:'move',text:'拖动任意空白处移动 · 自动攻击',dragCue:true});assert.match(p,/拖动任意空白处移动 · 自动攻击/);assert.match(p,/onboarding-drag/);assert.match(p,/data-action="tutorial-skip"/);assert.equal((p.match(/<button/g)||[]).length,1);
 assert.doesNotMatch(onboardingMarkup({kind:'xp',text:'靠近星光，获得经验',dragCue:false}),/onboarding-drag/);
});
