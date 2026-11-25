import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRunConfig,type RunConfig} from '../src/combat-config';
import * as Combat from '../src/combat-config';
import * as Growth from '../src/progression';
import {growthChange,growthBuild,growthDetail} from '../src/ui/progression';
import {Session} from '../src/rules';
const zero={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const pilot=(cat='CAT01',weapon='W01')=>({...makeRunConfig(cat,weapon,'p2-basic'),projectileTraits:Object.freeze({enabled:true as const})}) as RunConfig;
const stats=(base:RunConfig,ranks:any=zero)=>(Growth as any).projectileTraitStats(base,ranks);
const roll=(source:string,damage:number,base:RunConfig,ranks:any,random:()=>number)=>(Growth as any).rollProjectileTraits(source,damage,base,ranks,random);
test('release and review explicitly reject the controlled opt-in before starting a session',()=>{
 assert.equal(typeof (Combat as any).assertProjectileTraitsProfile,'function');
 const validate=(base:RunConfig,profile:string)=>(Combat as any).assertProjectileTraitsProfile(base,profile);
 for(const profile of ['release','review'])assert.throws(()=>validate(pilot(),profile),/playtest/);
 assert.doesNotThrow(()=>validate(pilot(),'playtest'));
 for(const profile of ['release','review','playtest'])assert.doesNotThrow(()=>validate(makeRunConfig('CAT01','W01','p2-basic'),profile));
});
test('A1 controlled opt-in alone enables real 5 percent / 1.5 primary criticals',()=>{
 assert.equal(typeof (Growth as any).projectileTraitStats,'function');
 assert.equal(typeof (Growth as any).rollProjectileTraits,'function');
 assert.deepEqual(stats(pilot()),{enabled:true,criticalChance:.05,criticalMultiplier:1.5});
 let calls=0;const random=()=>{calls++;return 0;};
 assert.deepEqual(roll('PRIMARY',12,makeRunConfig('CAT01','W01','p2-basic'),zero,random),{critical:false,criticalMultiplier:1,nonCriticalDamage:12});assert.equal(calls,0);
 const critical=roll('PRIMARY',12,pilot(),zero,random),ordinary=roll('PRIMARY',12,pilot(),zero,()=>.05);
 assert.deepEqual(critical,{critical:true,criticalMultiplier:1.5,nonCriticalDamage:12});
 assert.equal(critical.nonCriticalDamage*critical.criticalMultiplier,18);assert.equal(ordinary.critical,false);assert.equal(calls,1);
});
test('A11 adds ten percentage points through the sixth partial increment and then is ineligible',()=>{
 for(const [rank,chance] of [[0,.05],[1,.15],[2,.25],[3,.35],[4,.45],[5,.55],[6,.6],[20,.6]]){
  assert(Math.abs(stats(pilot(),{...zero,A11:rank}).criticalChance-chance)<1e-10);
  assert.equal(Growth.growthCardEligible('A11' as any,{...zero,A11:rank} as any,pilot()),rank<6);
 }
});
test('A12 adds one to the critical multiplier without capping or changing noncritical base damage',()=>{
 for(const rank of [1,3,12]){const ranks={...zero,A12:rank},r=roll('PRIMARY',12,pilot(),ranks,()=>0);
  assert.equal(r.criticalMultiplier,1.5+rank);assert.equal(r.nonCriticalDamage,12);assert(Growth.growthCardEligible('A12' as any,ranks as any,pilot()));}
 const r=roll('PRIMARY',12,pilot(),{...zero,A12:1},()=>0);assert.equal(r.nonCriticalDamage*r.criticalMultiplier,30);
 assert.equal(Growth.deriveGrowthConfig(pilot(),{...zero,A11:5,A12:3} as any).weapon.damage,12);
});
test('each shotgun primary draws independently while every secondary, summon and area skips the critical stream',()=>{
 const b=pilot('CAT03','W02'),draws=[0,.05,.01,.99,.02];let calls=0;
 const shots=draws.map(()=>roll('PRIMARY',8,b,zero,()=>draws[calls++]));assert.deepEqual(shots.map(s=>s.critical),[true,false,true,false,true]);assert.equal(calls,5);
 for(const source of ['SECONDARY','SUMMON','AREA'])assert.deepEqual(roll(source,9,b,{...zero,A11:6,A12:2},()=>{throw Error('unexpected reroll');}),{critical:false,criticalMultiplier:1,nonCriticalDamage:9});
});
test('M06 requires actual spread plus native multiple pellets or acquired split, and changes only final primary spread',()=>{
 const b=pilot(),fish=pilot('CAT03','W02');
 assert.equal(Growth.growthCardEligible('M06' as any,zero,b),false);assert.equal(Growth.growthCardEligible('M06' as any,zero,fish),true);
 assert.equal(Growth.growthCardEligible('M06' as any,{...zero,L1_SPLIT:1},b),true);
 assert.equal(Growth.growthCardEligible('M06' as any,zero,{...fish,weapon:{...fish.weapon,spreadDegrees:0}}),false);
 assert.equal(Growth.growthCardEligible('M06' as any,{...zero,M06:1} as any,fish),false);
 for(const [base,ranks,spread] of [[fish,zero,9],[b,{...zero,L1_SPLIT:1},2],[fish,{...zero,L1_SPLIT:1,L1_EVO_BARRAGE:1},11]] as const){
  const before=Growth.deriveGrowthConfig(base,ranks),after=Growth.deriveGrowthConfig(base,{...ranks,M06:1} as any);
  assert.equal(after.weapon.spreadDegrees,spread);assert.equal(after.weapon.pellets,before.weapon.pellets);assert.equal(after.weapon.damage,before.weapon.damage);
  assert.equal(after.weapon.ammoCapacity,before.weapon.ammoCapacity);assert.equal(after.weapon.damage*after.weapon.pellets,before.weapon.damage*before.weapon.pellets);
 }
});
test('new IDs register only these six cards and normal twenty-card offers reject the gated items',()=>{
 const ids=['A11','A12','M06','C23','M31','E21'];assert.equal(Growth.GROWTH_CARDS.length,33);
 for(const id of ids){assert(Growth.GROWTH_CARDS.some(c=>c.id===id));assert(!Growth.growthCardEligible(id as any,zero,makeRunConfig('CAT03','W02','p2-basic')));}

 for(let seed=0;seed<40;seed++){
  const g=new Growth.RunGrowth(seed,()=>seed/40,makeRunConfig('CAT03','W02','p2-basic'));g.collect(1000);
  for(let n=0;n<12;n++){const o=g.snapshot().offer!;assert(o.choices.every(id=>!ids.includes(id)));assert(g.confirm(seed,o.id,o.choices[0]));}
 }
 const g:any=new Growth.RunGrowth(7,()=>0,pilot());g.collect(8);g.offer={id:9,choices:['A11','A12','L1_DAMAGE'],source:'experience'};
 assert(g.confirm(7,9,'A11'));assert.equal(g.snapshot().ranks.A11,1);
 g.ranks={...zero,A11:6};g.offer={id:10,choices:['A11'],source:'experience'};assert(!g.confirm(7,10,'A11'));
 const invalid={...pilot(),weapon:{...pilot().weapon,pellets:0}};
 assert(!Growth.growthCardEligible('A11' as any,zero,invalid));assert(!Growth.growthCardEligible('A12' as any,zero,invalid));
});
test('UI states actual final A11 increment, uncapped A12 and M06 spread and preserves the new attribute detail',()=>{
 const g:any=new Growth.RunGrowth(1,()=>0,pilot());g.ranks={...zero,A11:5,A12:4};const s=g.snapshot();
 assert.match(growthChange('A11' as any,s,pilot()),/55.*60/);assert.match(growthChange('A12' as any,s,pilot()),/5\.5.*6\.5/);
 assert.match(growthChange('M06' as any,s,pilot('CAT03','W02')),/36.*9/);assert.match(growthBuild(s),/55%/);assert.match(growthBuild(s),/5\.5/);
 for(const id of ['A11','A12'])assert(!growthDetail(id,s).body.includes('undefined'));
 assert.match(growthDetail('A11',s).body,/60%/);assert.match(growthDetail('A12',s).body,/1\.0/);
});
test('stored projectile decisions survive later picks and pause while a new session restarts derived growth',()=>{
 const b=pilot(),session=new Session(b),old=roll('PRIMARY',12,b,zero,()=>0);
 session.pause('menu');session.applyGrowth({...zero,A11:6,A12:1,M06:1} as any);session.advance(1);
 assert.equal(session.elapsed,0);assert.deepEqual(old,{critical:true,criticalMultiplier:1.5,nonCriticalDamage:12});
 assert.equal(stats(session.runConfig,{...zero,A11:6,A12:1}).criticalMultiplier,2.5);
 const restarted=new Session(b);assert.equal(stats(restarted.runConfig).criticalChance,.05);assert.equal(restarted.effectiveConfig.weapon.spreadDegrees,0);
});
test('critical random consumption cannot affect offers when reward inputs and the offer random stream stay identical',()=>{
 const sequences:string[][][]=[];
 for(const criticalDraw of [0,1]){let n=12345;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const g=new Growth.RunGrowth(1,random,pilot());g.collect(1000);const choices:string[][]=[];
  for(let k=0;k<12;k++){for(let j=0;j<k;j++)roll('PRIMARY',12,pilot(),zero,()=>criticalDraw);const o=g.snapshot().offer!;choices.push(o.choices.slice());g.confirm(1,o.id,o.choices[0]);}sequences.push(choices);
 }assert.deepEqual(sequences[0],sequences[1]);
});
