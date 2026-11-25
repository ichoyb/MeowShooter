const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm');
const ts=require('typescript'),Clock=require('phaser/src/time/Clock'),EventEmitter=require('phaser/src/events/EventEmitter');

// Execute the actual Arena cleanup method against the installed native Clock.
// No fake timer semantics and no rewrite of the application build or entry.
function cleanup(){
  const ast=ts.createSourceFile('battle.ts',readFileSync('src/battle.ts','utf8'),ts.ScriptTarget.Latest,true);
  let method;function visit(node){if(ts.isMethodDeclaration(node)&&node.name.getText(ast)==='clearOnboarding')method=node;ts.forEachChild(node,visit);}visit(ast);
  assert.ok(method,'actual Arena cleanup must exist');
  const code=ts.transpileModule('class Fixture {'+method.getText(ast)+'}; globalThis.fixture=new Fixture();',{compilerOptions:{target:ts.ScriptTarget.ES2017}}).outputText;
  const context={onboarding:{clearTransient(){}}};runInNewContext(code,context);return context.fixture;
}
for(const phase of ['pending','active'])test('paused onboarding cleanup synchronously removes its '+phase+' native timer',()=>{
  const clock=new Clock({sys:{events:new EventEmitter()}}),arena=cleanup();let calls=0;
  const timer=clock.delayedCall(4000,()=>calls++);
  if(phase==='active')clock.preUpdate();
  clock.paused=true;arena.time=clock;arena.onboardingTimer=timer;arena.onboardingTimerKind='move';
  arena.clearOnboarding();
  assert.equal(clock._active.length,0);assert.equal(clock._pendingInsertion.length,0);
  assert.equal(clock._pendingRemoval.length,0);assert.equal(timer.callback,undefined);
  assert.equal(arena.onboardingTimer,null);assert.equal(arena.onboardingTimerKind,null);
  clock.paused=false;clock.preUpdate();clock.update(5000,5000);assert.equal(calls,0);
});

test('real onboarding highlights the nearest live XP with exported native point distance and stable ties',()=>{
  const ast=ts.createSourceFile('battle.ts',readFileSync('src/battle.ts','utf8'),ts.ScriptTarget.Latest,true);
  let method;function visit(node){if(ts.isMethodDeclaration(node)&&node.name.getText(ast)==='observeOnboarding')method=node;ts.forEachChild(node,visit);}visit(ast);
  assert.ok(method);
  const code=ts.transpileModule('class Fixture {'+method.getText(ast)+'}; globalThis.fixture=new Fixture();',{compilerOptions:{target:ts.ScriptTarget.ES2017}}).outputText;
  const context={session:{elapsed:1,result:null},onboarding:{observe(){},snapshot:()=>({hint:{kind:'xp'}})},
    summaries:{current:()=>null},children:g=>g,active:o=>o.active,
    Phaser:{Math:{Distance:{BetweenPointsSquared:require('phaser/src/math/distance/DistanceBetweenPointsSquared')}}}};
  runInNewContext(code,context);const arena=context.fixture;
  const orb=(id,x,active=true)=>({active,x,y:100,getData:()=>id,setAlpha(){}});
  const later=orb(3,105),first=orb(1,95),inactive=orb(0,100,false);
  let calls=0,selected;
  Object.assign(arena,{isOpening:()=>true,cat:{x:100,y:100},sourceCounts:{PRIMARY:1},onboardingTravel:12,
    pickups:{snapshot:()=>({droppedXP:3,collectedXP:0}),group:[orb(9,130),later,inactive,first]},
    growth:{snapshot:()=>({offer:null,confirmedPicks:0})},bossSnapshot:()=>null,syncOnboardingTimer(){},
    tweens:{add(options){calls++;selected=options.targets;return {};}}});
  arena.observeOnboarding();arena.observeOnboarding();
  assert.equal(selected,first);assert.equal(calls,1);assert.equal(context.session.elapsed,1);
});
