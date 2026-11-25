'use strict';
// Normal bundle + separately labelled native Scene fixture. Never import in player code.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.N1_MOTION_OUT||path.join(root,'.local/checks/n1-m3-runtime-20261117/browser'));
const normal=process.env.N1_NORMAL_URL,controlled=process.env.N1_SCENE_URL;
assert(normal&&controlled,'Explicit normal and controlled URLs required');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],contexts=[];let browser;
const ui=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui));
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const audio=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));
const frame=(p,expected)=>p.waitForFunction(v=>JSON.parse(document.getElementById('app').dataset.ui).frame.startsWith(v),expected);
const act=(p,id)=>p.locator('button[data-action="'+id+'"]:visible').last().click();
const tick=(p,ms)=>p.evaluate(ms=>window.N1Test.tick(ms),ms);
const motion=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.ui).narrative.motion);
async function check(name,scope,fn,p){try{const detail=await fn();checks.push({name,scope,status:'PASS',detail});console.log('PASS '+name);}catch(e){if(p)await p.screenshot({path:path.join(out,'FAIL-'+name+'.png')}).catch(()=>{});checks.push({name,scope,status:'FAIL',error:String(e),stack:e.stack});throw e;}}
async function open(fixture=false,viewport={width:390,height:844}){
 const c=await browser.newContext({viewport,deviceScaleFactor:1}),p=await c.newPage();contexts.push(c);
 await p.addInitScript(()=>{const Native=window.AudioContext;window.contextCreations=0;window.AudioContext=class extends Native{constructor(...a){super(...a);window.contextCreations++;}};});
 p.on('pageerror',e=>errors.push({url:p.url(),error:String(e)}));await p.goto(fixture?controlled:normal);
 await p.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true');
 if(fixture){await p.waitForFunction(()=>window.N1Test?.ready);await p.evaluate(()=>{window.N1Test.hold();window.N1Test.isolate();});}else assert.equal(await p.evaluate(()=>typeof window.N1Test),'undefined');
 return p;
}
async function start(p){await act(p,'start');if((await ui(p)).frame==='N1-OPEN')await act(p,'chapter-skip');await frame(p,'PAGE-06');}
async function home(p){const u=await ui(p);if(u.inProbe){if(!u.frame.startsWith('LAYER-02'))await act(p,'pause');await act(p,'end');await act(p,'confirm-end');}else await act(p,'home');await frame(p,'PAGE-02');}
async function playing(p){await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).narrative.motion?.playing);}
async function special(p,due){await tick(p,due*1000-(await state(p)).elapsed*1000);await tick(p,1201);await p.evaluate(()=>window.N1Test.parkSpecials());}
async function choose(p,card,xp){const o=await p.evaluate(({card,xp})=>window.N1Test.offer(card,xp),{card,xp});await frame(p,'PAGE-07');const offer=o.state.progression.offer,key=o.state.progression.runId+'.'+offer.id;await act(p,'growth-select:'+key+'.'+card);await act(p,'growth-confirm:'+key+'.'+card);await frame(p,'N1-RECEIPT');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).frame==='PAGE-06-S01');return state(p);}
(async()=>{try{
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const p=await open();
 await check('normal-complete-18s-real-opening','NORMAL_REAL_TIME',async()=>{
  const paths=[];p.on('response',r=>{if(r.url().includes('/story/'))paths.push({url:r.url(),status:r.status()});});
  await act(p,'start');await playing(p);const before=await state(p);assert.equal((await ui(p)).inProbe,false);
  await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.ui).narrative.motion?.time>=10,{},{timeout:25000});
  const gate=await ui(p);assert.equal(gate.narrative.images.path,'./story/ch01-gate.jpeg');assert.equal(gate.narrative.images.width,768);assert.equal((await state(p)).elapsed,before.elapsed);
  assert.equal((await audio(p)).story.buffers,2);assert.equal(await p.locator('[data-chapter-art] img').count(),1);
  await p.screenshot({path:path.join(out,'normal-gate.png')});await frame(p,'PAGE-06');const live=await state(p),a=await audio(p);
  assert.equal(live.durationSeconds,600);assert.match(live.progression.rulesVersion,/50/);assert.equal(a.story.buffers,0);assert.equal(a.currentTrack,'courtyard');assert.equal(await p.evaluate(()=>window.contextCreations),1);
  assert.equal(new Set(paths.map(x=>x.url)).size,3);assert(paths.every(x=>x.status===200));return {paths,live: {elapsed:live.elapsed,display:live.catDisplay,duration:live.durationSeconds,rules:live.progression.rulesVersion},story:a.story,contexts:1};
 },p);
 await check('normal-pause-settings-summary-return','NORMAL_REAL_UI',async()=>{
  await act(p,'pause');const frozen=(await state(p)).elapsed;await act(p,'settings');await act(p,'close');await frame(p,'LAYER-02');await p.waitForTimeout(200);assert.equal((await state(p)).elapsed,frozen);
  const summary=p.locator('button[data-action="run-summary"]:visible');if(await summary.count()){await summary.click();await act(p,'close');await frame(p,'LAYER-02');}
  await act(p,'resume');await frame(p,'PAGE-06');await home(p);return {frozen};
 },p);
 await check('normal-replay-mute-pause-background-restore','NORMAL_REAL_UI_SYNTHETIC_VISIBILITY',async()=>{
  const before=await state(p);await act(p,'chapter-replay');await playing(p);await p.waitForTimeout(250);await act(p,'chapter-toggle');const paused=await motion(p);await p.waitForTimeout(200);assert.equal((await motion(p)).time,paused.time);
  await act(p,'chapter-toggle');await playing(p);await act(p,'chapter-sound');await playing(p);assert.equal((await audio(p)).settings.music,false);assert.equal((await audio(p)).story.playing,false);await act(p,'chapter-sound');await playing(p);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await motion(p);await p.waitForTimeout(150);assert.equal((await motion(p)).time,hidden.time);assert.equal((await audio(p)).story.buffers,0);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(100);assert.equal((await motion(p)).playing,false);await act(p,'chapter-toggle');await playing(p);assert((await motion(p)).time>=hidden.time);
  await act(p,'chapter-skip');await frame(p,'PAGE-02');assert.equal((await state(p)).elapsed,before.elapsed);assert.equal((await ui(p)).inProbe,false);return {paused:paused.time,hidden:hidden.time,contexts:await p.evaluate(()=>window.contextCreations)};
 },p);
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']])await check('normal-three-cat-'+cat,'NORMAL_REAL_UI',async()=>{await act(p,'select');await act(p,'choose:'+cat);await act(p,'confirm-select');await start(p);const s=await state(p);assert.equal(s.catId,cat);assert.equal(s.weaponId,weapon);assert.equal(s.catDisplay.width,42);assert.equal(s.catDisplay.height,42);await home(p);return {cat,weapon,display:s.catDisplay};},p);
 await check('normal-twenty-replays-and-runs-bounded','NORMAL_REAL_UI',async()=>{
  const counts=[];for(let i=0;i<20;i++){await act(p,'chapter-replay');await playing(p);await act(p,'chapter-skip');await frame(p,'PAGE-02');const u=await ui(p),a=await audio(p);counts.push({story:a.story.buffers,sounds:a.nativeSounds,buffers:a.audioBuffers,tweens:u.narrative.motion?.timeline.tweens||0});await start(p);assert.equal((await state(p)).progression.confirmedPicks,0);await home(p);}assert(counts.every(v=>JSON.stringify(v)===JSON.stringify(counts[0])));return counts;
 },p);
 await p.context().close();
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['标准','低']){
  const q=await open(false,{width,height});await check('layout-'+width+'-'+(quality==='低'?'low':'standard'),'NORMAL_REAL_UI',async()=>{
   if(quality==='低'){await act(q,'settings');await q.locator('#quality').selectOption('低');await act(q,'close');}
   await act(q,'start');await playing(q);await act(q,'chapter-toggle');const geometry=await q.locator('.n1-motion button,.n1-movie-controls button,.n1-movie-frame').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,x:r.x,y:r.y,w:r.width,h:r.height,visible:r.x>=-.5&&r.right<=innerWidth+.5&&r.y>=-.5&&r.bottom<=innerHeight+.5};}));assert(geometry.every(r=>r.visible&&r.h>=44&&r.w>=44),JSON.stringify(geometry));const overflow=await q.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1);assert.equal(overflow,false);await q.screenshot({path:path.join(out,'opening-'+width+'-'+(quality==='低'?'low':'standard')+'.png')});return geometry;
  },q);await q.context().close();
 }
 const f=await open();await check('normal-image-failure-retry-and-skip-pending','NORMAL_CONTROLLED_NETWORK',async()=>{
  await f.route('**/story/ch01-fish.jpeg',r=>r.abort());await act(f,'start');await f.locator('[data-action="chapter-retry"]').waitFor();assert.equal((await motion(f)).playing,false);assert.equal((await ui(f)).narrative.images.active,false);
  await f.unroute('**/story/ch01-fish.jpeg');await act(f,'chapter-retry');await playing(f);assert.equal((await ui(f)).narrative.images.width,768);await act(f,'chapter-skip');await frame(f,'PAGE-06');await home(f);
  let release;const blocked=new Promise(r=>release=r);await f.route('**/story/ch01-fish.jpeg',async r=>{await blocked;await r.continue().catch(()=>{});});await act(f,'chapter-replay');await f.waitForTimeout(100);await act(f,'chapter-skip');release();await f.waitForTimeout(200);assert.equal((await ui(f)).frame,'PAGE-02-S01');assert.equal((await ui(f)).narrative.images.active,false);assert.equal((await audio(f)).story.buffers,0);return {retry:'PASS',lateImage:'NO_RESURRECTION'};
 },f);await f.context().close();
 const c=await open(true);await start(c);
 await check('controlled-real-upgrade-and-elite-transactions','CONTROLLED_NATIVE_MAIN',async()=>{
  const pick=await choose(c,'L1_DAMAGE');assert.equal(pick.progression.confirmedPicks,1);await special(c,150);const defeat=await c.evaluate(()=>window.N1Test.defeat('EL01'));await tick(c,16);await frame(c,'PAGE-07');const s=await state(c),o=s.progression.offer,card=o.choices[0],key=s.progression.runId+'.'+o.id;assert.equal(o.source,'elite');await act(c,'growth-select:'+key+'.'+card);await act(c,'growth-confirm:'+key+'.'+card);await frame(c,'N1-RECEIPT');const t=(await state(c)).elapsed;await tick(c,1000);assert.equal((await state(c)).elapsed,t);await frame(c,'PAGE-06');return {defeat,picks:(await state(c)).progression.confirmedPicks,elapsed:t};
 },c);
 await home(c);await start(c);
 await check('controlled-native-600s-timeout-no-success-story','CONTROLLED_NATIVE_MAIN_NOT_WALL_TIME',async()=>{for(const due of [150,300,450])await special(c,due);const before=await state(c);assert.equal(before.level.bossAt,450);await tick(c,600000-before.elapsed*1000);await tick(c,1);const s=await state(c);assert.equal(s.elapsed,600);assert.equal(s.result,'timeout');assert.equal((await ui(c)).narrative.motion,null);return {elapsed:s.elapsed,result:s.result};},c);
 await act(c,'restart');
 await check('controlled-boss-clear-24s-ending-and-replay','CONTROLLED_NATIVE_MAIN_REAL_STORY_SECONDS',async()=>{
  for(const due of [150,300,450])await special(c,due);await c.evaluate(()=>window.N1Test.defeat('B01'));await tick(c,16);await frame(c,'N1-END');const s=await state(c);assert.equal(s.result,'cleared');await playing(c);
  // The fixture owns the native loop; advance only its paused-Arena presentation Scene.
  for(let i=0;i<510&&(await ui(c)).frame==='N1-END';i++){await tick(c,50);await c.waitForTimeout(50);}await frame(c,'PAGE-08');assert.equal((await state(c)).elapsed,s.elapsed);assert.equal((await audio(c)).story.buffers,0);assert.equal((await ui(c)).narrative.endingRead,true);assert.doesNotMatch(await c.locator('#page-scroll').innerText(),/角色已解锁/);
  await act(c,'chapter-ending-replay');await playing(c);for(let i=0;i<130;i++){await tick(c,50);await c.waitForTimeout(50);}await c.screenshot({path:path.join(out,'ending-plaque.png')});assert.equal((await ui(c)).narrative.images.path,'./story/ch01-plaque.jpeg');assert.equal((await audio(c)).story.kind,'ending');await act(c,'chapter-skip');await frame(c,'PAGE-08');assert.equal((await state(c)).elapsed,s.elapsed);return {result:s.result,elapsed:s.elapsed,ending:'24_NATIVE_SECONDS',contexts:await c.evaluate(()=>window.contextCreations)};
 },c);
 await act(c,'restart');await check('controlled-twenty-death-restarts-no-old-story','CONTROLLED_NATIVE_MAIN',async()=>{const counts=[];for(let i=0;i<20;i++){await c.evaluate(()=>window.N1Test.damage(100000));await tick(c,0);assert.equal((await state(c)).result,'death');assert.equal((await ui(c)).narrative.motion,null);await act(c,'restart');assert.equal((await state(c)).elapsed,0);counts.push(await c.evaluate(()=>window.N1Test.counts()));}assert(counts.every(v=>JSON.stringify(v)===JSON.stringify(counts[0])));return counts;},c);
 assert.deepEqual(errors,[]);
 }catch(e){console.error(e);process.exitCode=1;}finally{for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({atUtc:new Date().toISOString(),normalURL:normal,controlledURL:controlled,browser:browser?.version(),status:process.exitCode?'FAIL':'PASS',checks,errors,platform:'NOT_TESTED',phone:'NOT_TESTED'},null,2)+'\n');console.log(JSON.stringify({pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,out}));}})();
