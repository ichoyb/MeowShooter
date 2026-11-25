const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
assert(fs.existsSync(path.resolve('tests/fixtures/g5-audio-audition.ts')),'missing isolated native audio audition fixture');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.G5_AUDIO_DIR||'../.local/checks/g5-audio-audition-20261105/green'),port=process.env.G5_AUDIO_PORT||'9031';
let browser,server;const errors=[],checks=[];
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{checks.push({name,pass:true});console.log('PASS '+name);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
 const artifact=JSON.parse(fs.readFileSync(path.join(out,'audio-build.json'),'utf8'));
 server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,APP_DIST:artifact.fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);server.once('exit',c=>j(Error('server '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 await p.addInitScript(()=>{window.g5ContextCount=0;const C=window.AudioContext;window.AudioContext=class extends C{constructor(...args){super(...args);window.g5ContextCount++;}};});
 p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+port+'/audio-audition.html');await p.waitForFunction(()=>window.g5AudioReady||window.g5AudioError);assert.equal(await p.evaluate(()=>window.g5AudioError),undefined);
 const s=()=>p.evaluate(()=>window.g5AudioAudition.snapshot());
 await check('no eager AudioContext before a real gesture',async()=>assert.equal(await p.evaluate(()=>window.g5ContextCount),0));
 await p.locator('#enable').click();await p.waitForFunction(()=>window.g5AudioAudition.snapshot().ready);
 await check('one context, sixteen native Sounds, shared twelve buffers and candidate budget',async()=>{const a=await s();assert.equal(await p.evaluate(()=>window.g5ContextCount),1);assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert(a.pcm.extraPcmPlusAudioBufferBytes<=524288);assert.equal(a.oldPcmDoubleRenderEqual,true);assert.equal(a.uniqueNativeBufferCount,12);});
 await check('single audition ends a paused sequence instead of implicitly resuming its future requests',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.play('crowded'));await wait(700);await p.evaluate(()=>window.g5AudioAudition.pause());await p.evaluate(()=>window.g5AudioAudition.single('fish-shot'));const a=await s();fs.writeFileSync(path.join(out,'single-after-pause-'+Date.now()+'.json'),JSON.stringify(a,null,2));assert.equal(a.playing,false);assert.equal(a.timerEvents,0);assert.equal(a.trace.filter(t=>t.status==='played').slice(-1)[0].id,'fish-shot');
 });
 await check('critical / ordinary and break / HP-loss selection in native playback',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.stop();a.enable();a.event({type:'contact',critical:true});a.event({type:'damage',hpLost:3,shieldBroke:true});});
  const a=await s();assert.deepEqual(a.trace.filter(t=>t.status==='played').slice(-2).map(t=>t.id),['critical','hurt']);assert.equal(a.trace.some(t=>t.id==='shield-break'),false);
 });
 await check('busy same-kind voices use clones then drop; no source restart',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.stop();a.enable();for(let i=0;i<6;i++)a.request({id:'hurt',rate:1,gain:1,priority:4},true);});const a=await s();assert.equal(a.effectsPlaying,2);assert.equal(a.trace.filter(t=>t.status==='played').length,2);assert.equal(a.trace.filter(t=>t.reason==='kind-busy').length,4);
 });
 await check('eight concurrent FX and danger preemption of lower priority',async()=>{
  const a=await p.evaluate(()=>{const a=window.g5AudioAudition;a.stop();a.enable();for(const id of ['slingshot','fish-shot','bone-shot','hit','hit','hit','defeat','xp'])a.request({id,rate:1,gain:1,priority:id==='xp'||id==='defeat'?1:2},true);a.request({id:'critical',rate:1,gain:1,priority:3},true);a.request({id:'hurt',rate:1,gain:1,priority:4},true);return a.snapshot();});assert.equal(a.effectsPlaying,8);assert(a.maxEffectsPlaying<=8);assert(a.preemptions>=2);assert.equal(a.trace.filter(t=>t.status==='played').slice(-1)[0].id,'hurt');
 });
 await check('native hit flavors share one buffer and exact rates',async()=>{
  for(const weapon of ['W01','W04','W02']){await p.evaluate(w=>{const a=window.g5AudioAudition;a.stop();a.configure({weapon:w});a.enable();a.event({type:'contact'});},weapon);const a=await s();assert.equal(a.trace.filter(t=>t.status==='played').slice(-1)[0].rate,({W01:1,W04:1.06,W02:.94})[weapon]);assert.equal(a.hitBufferCount,1);}
 });
 await check('native hit/crit/XP/defeat gates reject early and never queue',async()=>{
  for(const [id,gap] of [['hit',80],['critical',120],['defeat',100],['xp',120]]){await p.evaluate(id=>{const a=window.g5AudioAudition;a.stop();a.enable();a.request({id,rate:1,gain:1,priority:2});a.request({id,rate:1,gain:1,priority:2});},id);let a=await s();assert.equal(a.trace.filter(t=>t.status==='played').length,1);assert.equal(a.trace.filter(t=>t.reason==='gate').length,1);await wait(gap+35);a=await s();assert.equal(a.trace.filter(t=>t.status==='played').length,1);}
 });
 await check('music duck multiplies settings and Boss fade; pause does not replay entry',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.stop();a.configure({track:'boss',musicVolume:.5});a.enable();});await p.waitForFunction(()=>window.g5AudioAudition.snapshot().track==='boss-loop');
  const before=await s();assert.equal(before.entryPlayedCount,1);await p.evaluate(()=>window.g5AudioAudition.event({type:'damage',hpLost:4}));await p.waitForFunction(()=>window.g5AudioAudition.snapshot().duckGain<=.701);let a=await s();assert(Math.abs(a.musicTargetVolume-.5*a.musicBaseGain*a.duckGain)<.000001);fs.writeFileSync(path.join(out,'duck-during-boss-fade.json'),JSON.stringify(a,null,2));
  // AudioParam.value can lag a changing Tween by a render quantum; inspect actual gain once each native Tween settles.
  await p.waitForFunction(()=>{const s=window.g5AudioAudition.snapshot();return s.musicBaseGain===1&&s.duckGain===1&&Math.abs(s.musicActualVolume-.5)<.002;});
  await p.evaluate(()=>window.g5AudioAudition.event({type:'damage',hpLost:4}));await p.waitForFunction(()=>{const s=window.g5AudioAudition.snapshot();return s.duckGain===.7&&Math.abs(s.musicActualVolume-.35)<.002;});
  await p.evaluate(()=>window.g5AudioAudition.configure({musicVolume:.4}));await p.waitForFunction(()=>{const s=window.g5AudioAudition.snapshot();return s.duckGain===1&&Math.abs(s.musicActualVolume-.4)<.002;});a=await s();assert.equal(a.musicTargetVolume,.4);await p.evaluate(()=>window.g5AudioAudition.pause());await wait(170);a=await s();assert.equal(a.activeSources,0);await p.locator('#continue').click();await wait(130);a=await s();assert.equal(a.track,'boss-loop');assert.equal(a.entryPlayedCount,before.entryPlayedCount);
 });
 await check('music mute, FX mute and master mute clear sources and preserve settings',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.configure({music:false});a.event({type:'damage',hpLost:1});a.configure({effects:false});});let a=await s();assert.equal(a.activeSources,0);assert.equal(a.settings.musicVolume,.4);
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.configure({music:true,effects:true,track:'courtyard'});a.configure({muted:true});});a=await s();assert.equal(a.activeSources,0);assert.equal(a.held,true);await p.evaluate(()=>window.g5AudioAudition.configure({muted:false}));a=await s();assert.equal(a.activeSources,0);await p.locator('#continue').click();await wait(80);a=await s();assert.equal(a.track,'courtyard');assert.equal(a.settings.musicVolume,.4);
 });
 await check('real-time timeline pauses without backlog; stop cancels pending requests',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.configure({track:'off',weapon:'W01'});return a.play('crowded');});await wait(2200);await p.locator('#pause').click();const a=await s();await wait(430);let b=await s();assert.equal(b.elapsed,a.elapsed);assert.equal(b.trace.length,a.trace.length);assert.equal(b.activeSources,0);await p.locator('#continue').click();await wait(100);b=await s();assert(b.elapsed<a.elapsed+300);assert(b.trace.slice(a.trace.length).every(t=>t.plannedAt===null||(t.plannedAt>=a.elapsed-50&&t.plannedAt<=b.elapsed+50)),JSON.stringify({pausedElapsed:a.elapsed,resumedElapsed:b.elapsed,newRequests:b.trace.slice(a.trace.length)}));await p.locator('#stop').click();const c=await s();await wait(230);assert.equal((await s()).trace.length,c.trace.length);assert.equal((await s()).timerEvents,0);
 });
 await check('complete fourteen-second native crowded timeline has no late backlog or trailing sources',async()=>{
  await p.evaluate(()=>{const a=window.g5AudioAudition;a.configure({weapon:'W02',comparison:'candidate',track:'courtyard'});return a.play('crowded');});await p.waitForFunction(()=>window.g5AudioAudition.snapshot().elapsed>=14000,{},{timeout:20000});const a=await s();assert(a.played>50);assert(a.dropped>0);assert.equal(a.activeSources,0);assert.equal(a.timerEvents,0);assert(a.maxEffectsPlaying<=8);assert(a.maxMusicSources<=2);assert(a.trace.filter(t=>t.plannedAt!==null).every(t=>Math.abs(t.plannedAt-t.elapsed)<=65));fs.writeFileSync(path.join(out,'native-full-timeline.json'),JSON.stringify(a,null,2));
 });
 await check('twenty restarts retain exact object and buffer counts',async()=>{
  for(let i=0;i<20;i++)await p.evaluate(()=>window.g5AudioAudition.play('sparse'));const a=await s();assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert.equal(await p.evaluate(()=>window.g5ContextCount),1);await p.evaluate(()=>window.g5AudioAudition.stop());
 });
 await check('concurrent enable then stop cancels stale prepare and playback',async()=>{
  const q=await browser.newPage();q.on('pageerror',e=>errors.push(String(e)));await q.goto('http://127.0.0.1:'+port+'/audio-audition.html');await q.waitForFunction(()=>window.g5AudioReady);await q.evaluate(async()=>{const a=window.g5AudioAudition;const x=a.enable(),y=a.enable();a.stop();await Promise.all([x,y]);});const a=await q.evaluate(()=>window.g5AudioAudition.snapshot());assert.equal(a.nativeSounds,0);assert.equal(a.activeSources,0);assert.equal(a.held,true);await q.close();
 });
 await check('background requires explicit continue and clears active sources',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.play('sparse'));await wait(750);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));let a=await s();assert.equal(a.activeSources,0);assert.equal(a.held,true);await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await wait(200);assert.equal((await s()).activeSources,0);
 });
 const layouts=[];await check('four CSS sizes keep 14px labels, 44px controls and all controls scroll reachable',async()=>{
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]){await p.setViewportSize({width,height});const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,font:parseFloat(getComputedStyle(document.body).fontSize),controls:[...document.querySelectorAll('button,select,input[type=range]')].map(e=>({id:e.id,h:e.getBoundingClientRect().height})),scrollHeight:document.documentElement.scrollHeight}));assert.equal(layout.overflow,false);assert(layout.font>=14);assert(layout.controls.every(c=>c.h>=44));await p.locator('[data-sound="xp"]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,`audition-${width}x${height}.png`),fullPage:true});layouts.push({width,height,...layout});}
 });
 const final=await s();await check('dispose closes owned context and removes native/cache references',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.dispose());await wait(150);const a=await s();assert.equal(a.disposed,true);assert.equal(a.nativeSounds,0);assert.equal(a.audioBuffers,0);assert.equal(a.activeSources,0);assert.equal(a.contextState,'closed');
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'audio-native.json'),JSON.stringify({status:'PASS',browser:browser.version(),artifact,checks,layouts,final,pageErrors:errors,liveAudioCapture:false,audibility:'Native AudioBufferSource states and context times observed; listening judgement pending'},null,2));console.log('PASS native audio '+checks.length);
}catch(e){fs.writeFileSync(path.join(out,'audio-native-failure-'+Date.now()+'.json'),JSON.stringify({error:String(e),checks,pageErrors:errors},null,2));console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();



