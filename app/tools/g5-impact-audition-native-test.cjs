const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.G5_AUDIO_DIR||'../.local/checks/g5-impact-audition-20261105/green-v01'),port=process.env.G5_AUDIO_PORT||'9041';
let browser,server;const checks=[],errors=[];const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const fingerprint=channels=>{let h=2166136261;for(const c of channels)for(const b of Buffer.from(c.buffer,c.byteOffset,c.byteLength)){h^=b;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
(async()=>{try{
 const artifact=JSON.parse(fs.readFileSync(path.join(out,'audio-build.json'),'utf8'));
 server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,APP_DIST:artifact.fixture,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
 browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>{window.impactContexts=0;const C=window.AudioContext;window.AudioContext=class extends C{constructor(...a){super(...a);window.impactContexts++;}};});
 await p.goto('http://127.0.0.1:'+port+'/audio-audition.html');await p.waitForFunction(()=>window.g5AudioReady||window.g5AudioError);
 await check('selected hit variant has an isolated public audition API',async()=>assert.equal(await p.evaluate(()=>typeof window.g5AudioAudition.selectImpact),'function'));
 const api=await import(pathToFileURL(path.join(out,'reference-api.mjs'))),bank=api.createAuditionBank(),expected=Object.fromEntries(['original','thick','crisp'].map(v=>[v,fingerprint(bank.hit(v))]));
 const s=()=>p.evaluate(()=>window.g5AudioAudition.snapshot());
 await check('real variant button lazily creates one context and only selected hit buffer',async()=>{
  assert.equal(await p.evaluate(()=>window.impactContexts),0);await p.locator('[data-impact="thick"]').click();await p.waitForFunction(()=>window.g5AudioAudition.snapshot().ready);const a=await s();assert.equal(a.selectedImpact,'thick');assert.equal(a.activeImpact,'thick');assert.equal(a.hitBufferFingerprint,expected.thick);assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert.equal(a.hitBufferCount,1);assert.equal(a.trace.filter(t=>t.status==='played').slice(-1)[0].id,'hit');assert(a.candidatePcmPlusActiveAudioBufferBytes<=524288);
 });
 await check('changing while a hit is sounding retires its native sources and all three hit Sounds',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.selectImpact('original'));const before=await s();assert.equal(before.effectsPlaying,1);await p.locator('[data-impact="crisp"]').click();const a=await s();assert.equal(a.activeImpact,'crisp');assert.equal(a.hitBufferFingerprint,expected.crisp);assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert.equal(a.effectsPlaying,1);assert.equal(a.retiredHitSources,0);assert.equal(a.hitBufferCount,1);
 });
 await check('paused mix is cancelled by variant selection and only the selected single sound plays',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.play('crowded'));await p.waitForFunction(()=>window.g5AudioAudition.snapshot().elapsed>900);await p.locator('#pause').click();await p.locator('[data-impact="thick"]').click();const a=await s();assert.equal(a.playing,false);assert.equal(a.timerEvents,0);assert.equal(a.activeImpact,'thick');assert.equal(a.effectsPlaying,1);assert.equal(a.trace.filter(t=>t.status==='played').length,1);
 });
 await check('rapid choices, including prepare in flight, play only the latest selected hit',async()=>{
  await p.evaluate(async()=>{const a=window.g5AudioAudition;await Promise.all([a.selectImpact('original'),a.selectImpact('thick'),a.selectImpact('crisp')]);});let a=await s();assert.equal(a.activeImpact,'crisp');assert.equal(a.hitBufferFingerprint,expected.crisp);assert.equal(a.effectsPlaying,1);assert.equal(a.trace.filter(t=>t.status==='played').length,1);
  const q=await browser.newPage();q.on('pageerror',e=>errors.push(String(e)));await q.goto('http://127.0.0.1:'+port+'/audio-audition.html');await q.waitForFunction(()=>window.g5AudioReady);await q.evaluate(async()=>{const a=window.g5AudioAudition;await Promise.all([a.selectImpact('original'),a.selectImpact('thick'),a.selectImpact('crisp')]);});a=await q.evaluate(()=>window.g5AudioAudition.snapshot());assert.equal(a.activeImpact,'crisp');assert.equal(a.effectsPlaying,1);assert.equal(a.hitBufferFingerprint,expected.crisp);await q.close();
 });
 await check('twenty changes keep one context, sixteen native Sounds, twelve buffers and candidate budget',async()=>{
  for(let i=0;i<20;i++){const v=['original','thick','crisp'][i%3];await p.evaluate(v=>window.g5AudioAudition.selectImpact(v,false),v);const a=await s();assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert.equal(a.hitBufferCount,1);assert.equal(a.hitBufferFingerprint,expected[v]);assert.equal(a.retiredHitSources,0);assert(a.candidatePcmPlusActiveAudioBufferBytes<=524288);}assert.equal(await p.evaluate(()=>window.impactContexts),1);
 });
 await check('old total comparison keeps original PCM and returns to selected hit in candidate mode',async()=>{
  await p.evaluate(()=>window.g5AudioAudition.selectImpact('thick',false));await p.selectOption('#comparison','old');let a=await s();assert.equal(a.selectedImpact,'thick');assert.equal(a.activeImpact,'original');assert.equal(a.hitBufferFingerprint,expected.original);assert.equal(a.effectsPlaying,0);await p.selectOption('#comparison','candidate');a=await s();assert.equal(a.activeImpact,'thick');assert.equal(a.hitBufferFingerprint,expected.thick);
 });
 await check('three weapons use the selected single native buffer with unchanged rate and gain differences',async()=>{
  for(const weapon of ['W01','W04','W02']){await p.evaluate(w=>{const a=window.g5AudioAudition;a.configure({weapon:w});return a.selectImpact('crisp',false);},weapon);await p.evaluate(()=>{const a=window.g5AudioAudition;a.enable();a.event({type:'contact'});});const a=await s(),hit=a.trace.find(t=>t.status==='played'&&t.id==='hit');assert.equal(hit.rate,({W01:1,W04:1.06,W02:.94})[weapon]);assert.equal(hit.gain,({W01:.8,W04:.7,W02:.78})[weapon]);assert.equal(a.hitBufferFingerprint,expected.crisp);assert.equal(a.hitBufferCount,1);}
 });
 await check('full selected-A crowded mix retains limits, original Boss music and complete cleanup',async()=>{
  await p.evaluate(async()=>{const a=window.g5AudioAudition;await a.selectImpact('thick',false);a.configure({track:'boss',weapon:'W02'});return a.play('crowded');});await p.waitForFunction(()=>window.g5AudioAudition.snapshot().elapsed>=14000,{},{timeout:20000});const a=await s();assert.equal(a.activeImpact,'thick');assert.equal(a.activeSources,0);assert.equal(a.timerEvents,0);assert(a.maxEffectsPlaying<=8);assert(a.maxMusicSources<=2);assert.equal(a.entryPlayedCount,1);assert.equal(a.oldPcmDoubleRenderEqual,true);fs.writeFileSync(path.join(out,'impact-native-timeline.json'),JSON.stringify(a,null,2));
 });
 await check('variant buttons fit four sizes and dispose frees current native/cache resources',async()=>{
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]){await p.setViewportSize({width,height});const a=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('[data-impact]')].map(b=>({text:b.textContent,height:b.getBoundingClientRect().height}))}));assert.equal(a.overflow,false);assert(a.buttons.every(b=>b.height>=44));await p.screenshot({path:path.join(out,`impact-${width}x${height}.png`),fullPage:true});}await p.evaluate(()=>window.g5AudioAudition.dispose());await p.waitForFunction(()=>window.g5AudioAudition.snapshot().contextState==='closed');const a=await s();assert.equal(a.nativeSounds,0);assert.equal(a.audioBuffers,0);assert.equal(a.activeSources,0);
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'impact-native.json'),JSON.stringify({status:'PASS',artifact,browser:browser.version(),expectedPCM_FNV1a:expected,checks,pageErrors:errors},null,2));console.log('PASS impact native '+checks.length);
}catch(e){fs.writeFileSync(path.join(out,'impact-native-failure-'+Date.now()+'.json'),JSON.stringify({error:String(e),checks,pageErrors:errors},null,2));console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
