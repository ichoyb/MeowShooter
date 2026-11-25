const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const vm=require('node:vm');
const Clock=require('phaser/src/time/Clock');
const EventEmitter=require('phaser/src/events/EventEmitter');
const DataManager=require('phaser/src/data/DataManager');
const compiled={exports:{}};
vm.runInNewContext(buildSync({entryPoints:[require('node:path').join(__dirname,'../src/sentinel-abilities.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,{module:compiled,exports:compiled.exports});
const {SentinelAbilities}=compiled.exports;
// Native Clock and DataManager run unchanged. Only drawing and Group collection
// calls use Node adapters: browser Scene coverage separately checks real Graphics.
class Graphic extends EventEmitter {
 constructor(){super();this.data=new DataManager(this);this.active=true;this.x=0;this.y=0;}
 setData(key,value){this.data.set(key,value);return this;}getData(key){return this.data.get(key);}
 setDepth(){return this;}clear(){return this;}setPosition(x,y){this.x=x;this.y=y;return this;}
 setRotation(){return this;}setActive(value){this.active=value;return this;}setVisible(){return this;}setAlpha(){return this;}
 fillStyle(){return this;}fillEllipse(){return this;}lineStyle(){return this;}strokeEllipse(){return this;}fillTriangle(){return this;}
}
class Collection {
 add(graphic){this.graphic=graphic;}killAndHide(graphic){graphic.setActive(false);}countActive(){return Number(this.graphic.active);}getLength(){return 1;}
}
function fixture(rank,options={}){
 const clock=new Clock({sys:{events:new EventEmitter()}}),cat=new Graphic();cat.body={center:{x:360,y:600}};
 let now=0,shield=options.shield??0;const shots=[],ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,C12:1,A16:rank,...options.ranks};
 const target=new Graphic();target.body={center:{x:500,y:600}};target.setData({id:1,entering:false,deathResolved:false});
 const scene={time:clock,add:{group:()=>new Collection(),graphics:()=>new Graphic()}};
 const manager=new SentinelAbilities(scene,cat,()=>({defenseCompanions:{enabled:true},areaAbilities:{enabled:true}}),()=>[target],
  (origin,angle,damage,speed,life,deploymentId)=>{shots.push({at:now,origin:{...origin},deploymentId,damage});return shots.length;},()=>now/1000,()=>shield);
 manager.ensure(ranks);
 return {manager,cat,shots,ranks,clock,setShield(value){shield=value;},get now(){return now;},step(dt=50){now+=dt;clock.preUpdate();clock.update(now,dt);manager.update(ranks);}};
}
for(const [rank,expected]of [[32,25],[42,31],[250,155]])test('native Clock keeps all pre-expiry opportunities for A16x'+rank,()=>{
 const f=fixture(rank);for(let i=0;i<240;i++)f.step();
 const first=f.shots.filter(shot=>shot.deploymentId===1);assert.equal(first.length,expected);
 assert.equal(f.manager.snapshot().deployments,2);assert.equal(f.manager.snapshot().expirations,1);
 assert.equal(f.manager.snapshot().timers,3);
});
test('expiry-frame old shot keeps old origin while the new station waits its full interval',()=>{
 const f=fixture(32);for(let i=0;i<239;i++)f.step();f.cat.body.center.x=460;f.step();
 const last=f.shots.at(-1);assert.equal(f.shots.length,25);assert.equal(last.deploymentId,1);assert.equal(last.origin.x,360);assert.equal(last.at,12000);
 assert.equal(f.manager.snapshot().station.id,2);assert.equal(f.manager.snapshot().station.x,460);
 f.step(50);assert.equal(f.shots.length,25);
});
test('native exact endpoint is excluded and never becomes a new-station shot',()=>{
 const f=fixture(0);for(let i=0;i<240;i++)f.step();assert.equal(f.shots.length,5);assert(f.shots.every(shot=>shot.deploymentId===1&&shot.at<12000));
 for(let i=0;i<19;i++)f.step();assert.equal(f.shots.length,5);f.step();assert.equal(f.shots.length,6);assert.equal(f.shots.at(-1).deploymentId,2);assert.equal(f.shots.at(-1).at,13000);
});
test('native remainder carries pre-expiry shot eligibility through 30Hz and irregular frames',()=>{
 for(const frames of [[1000/30],[50,17,8,41,1000/30,23]])for(const [rank,expected]of [[32,25],[42,31],[0,5]]){
  const f=fixture(rank);for(let i=0;f.now<12050;i++)f.step(frames[i%frames.length]);
  assert.equal(f.shots.filter(shot=>shot.deploymentId===1).length,expected,JSON.stringify({frames,rank,shots:f.shots}));
 }
});

test('phase-preserving A16 upgrade also retains the old station last eligible expiry-frame opportunity',()=>{
 const f=fixture(0);for(let i=0;i<189;i++)f.step();assert.equal(f.shots.length,3);
 f.ranks.A16=32;f.manager.ensure(f.ranks);assert.equal(f.shots.length,3,'upgrading never grants an immediate attack');
 for(let i=189;i<240;i++)f.step();assert.equal(f.shots.length,14);assert.equal(f.shots.at(-1).at,12000);assert.equal(f.shots.at(-1).deploymentId,1);
 assert.equal(f.manager.snapshot().station.id,2);
});

test('E14 confirmation with two seconds left attaches immediately and preserves every native timer phase',()=>{
 const f=fixture(0,{shield:18});for(let i=0;i<200;i++)f.step();const before=f.manager.snapshot(),count=f.shots.length;
 f.cat.body.center={x:420,y:640};f.ranks.E14=1;f.manager.ensure(f.ranks);const after=f.manager.snapshot();
 assert.equal(after.station.attached,true);assert.equal(after.station.x,420);assert.equal(after.station.y,640);assert.equal(after.station.id,before.station.id);
 for(const key of ['timer','shotTimer','expiryTimer','deployments','expirations','opportunities','emitted','timers'])assert.deepEqual(after[key],before[key],key);
 assert.equal(f.shots.length,count);for(let i=0;i<20;i++)f.step();assert.equal(f.shots.at(-1).damage,5.76);
 for(let i=0;i<20;i++)f.step();assert.equal(f.manager.snapshot().expirations,1);assert.equal(f.manager.snapshot().station.id,2);
});
test('positive shield follows actual Body center, breaking lands this frame and recovery reattaches the same station',()=>{
 const f=fixture(0,{shield:18,ranks:{C13:1,E14:1}});for(let i=0;i<120;i++)f.step();
 f.cat.body.center={x:420,y:640};f.step();assert.deepEqual([f.manager.snapshot().station.x,f.manager.snapshot().station.y],[420,640]);
 f.cat.body.center={x:450,y:680};f.setShield(0);f.step();let s=f.manager.snapshot();assert.equal(s.station.attached,false);assert.deepEqual([s.station.x,s.station.y],[450,680]);
 f.cat.body.center={x:500,y:700};for(let i=0;i<18;i++)f.step();assert(Math.abs(f.shots.at(-1).damage-7.2)<1e-9);assert.deepEqual(f.shots.at(-1).origin,{x:450,y:680});
 const before=f.manager.snapshot();f.setShield(.1);f.manager.ensure(f.ranks);s=f.manager.snapshot();assert.equal(s.station.id,before.station.id);assert.equal(s.station.attached,true);assert.equal(s.station.x,500);assert.deepEqual(s.shotTimer,before.shotTimer);assert.deepEqual(s.expiryTimer,before.expiryTimer);
 for(let i=0;i<20;i++)f.step();assert.equal(f.shots.at(-1).damage,5.76);assert.deepEqual(f.shots.at(-1).origin,{x:500,y:700});assert(Math.abs(f.shots.at(-2).damage-7.2)<1e-9,'old projectile damage stays frozen');
});
test('E14 without an active station waits the original deployment and never gifts an attack',()=>{
 const f=fixture(0,{shield:18,ranks:{C13:1}});for(let i=0;i<80;i++)f.step();const timer=f.manager.snapshot().timer;
 f.ranks.E14=1;f.manager.ensure(f.ranks);assert.equal(f.manager.snapshot().station,null);assert.deepEqual(f.manager.snapshot().timer,timer);assert.equal(f.shots.length,0);
 for(let i=0;i<40;i++)f.step();assert.equal(f.manager.snapshot().station.attached,true);assert.equal(f.shots.length,0);for(let i=0;i<20;i++)f.step();assert.equal(f.shots.length,1);
});
test('attached expiry-frame opportunities retain the old ID, current old center and attached damage',()=>{
 const f=fixture(32,{shield:18,ranks:{C13:1,E14:1}});for(let i=0;i<239;i++)f.step();f.cat.body.center={x:460,y:630};f.step();
 const last=f.shots.at(-1);assert.equal(f.shots.length,25);assert.equal(last.deploymentId,1);assert.deepEqual(last.origin,{x:460,y:630});assert.equal(last.damage,5.76);assert.equal(f.manager.snapshot().station.id,2);assert.equal(f.manager.snapshot().station.attached,true);
 f.step(50);assert.equal(f.shots.length,25);
 const exact=fixture(0,{shield:18,ranks:{C13:1,E14:1}});for(let i=0;i<240;i++)exact.step();assert.equal(exact.shots.length,5);assert(exact.shots.every(s=>s.at<12000));
});
