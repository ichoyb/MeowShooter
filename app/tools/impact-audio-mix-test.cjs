// Actual native playback matrix; offline metrics are recorded separately.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.IMPACT_MIX_QA_OUT||'../.local/checks/combat-impact-audio-20261112/mix-qa');
const url=process.env.IMPACT_AUDIO_URL||'http://127.0.0.1:9056/';
fs.mkdirSync(out,{recursive:true});
const checks=[],pageErrors=[],runs=[];let browser;
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 p.on('pageerror',e=>pageErrors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.impactAudioReady);
 await check('four viewports retain reachable controls with no horizontal overflow',async()=>{
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]]){
   await p.setViewportSize({width,height});const a=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('button,select,input[type=range],summary')].map(e=>({tag:e.tagName,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(x=>x.w&&x.h)}));assert.equal(a.overflow,false);assert(a.controls.every(c=>c.w>=44&&c.h>=44));
  }await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'audition-390.png'),fullPage:true});
 });
 await check('trusted page buttons play the labelled critical and important sound',async()=>{
  await p.locator('#enable').click();await p.waitForFunction(()=>window.impactAudioAudition.snapshot().ready);
  for(const weapon of ['W01','W04','W02']){await p.locator(`[data-critical-weapon="${weapon}"]`).click();const a=await p.evaluate(()=>window.impactAudioAudition.snapshot());assert.equal(a.settings.weapon,weapon);assert.equal(a.trace.filter(t=>t.status==='played').at(-1).id,'critical');}
  for(const id of ['hurt','shield-break']){await p.locator(`[data-sound="${id}"]`).click();const a=await p.evaluate(()=>window.impactAudioAudition.snapshot());assert.equal(a.trace.filter(t=>t.status==='played').at(-1).id,id);}
  await p.locator('#stop').click();
 });
 for(const weapon of ['W01','W04','W02'])for(const density of ['sparse','crowded'])await check(`${weapon} complete ${density} with ${density==='sparse'?'courtyard':'Boss A'} and distinct survival cues`,async()=>{
  await p.evaluate(({weapon,density})=>{const a=window.impactAudioAudition;a.configure({weapon,comparison:'candidate',track:density==='sparse'?'courtyard':'boss',music:true,effects:true,muted:false});return a.play(density);},{weapon,density});
  await p.waitForFunction(()=>window.impactAudioAudition.snapshot().elapsed>=14000,null,{timeout:20000});
  const a=await p.evaluate(()=>window.impactAudioAudition.snapshot());
  assert.equal(a.timerEvents,0);assert.equal(a.activeSources,0);assert.equal(a.nativeSounds,16);assert.equal(a.audioBuffers,12);assert(a.maxEffectsPlaying<=8);assert(a.maxMusicSources<=2);
  const played=a.trace.filter(t=>t.status==='played');
  const at=ms=>played.filter(t=>t.plannedAt===ms).map(t=>t.id);
  assert(!at(4500).includes('hurt'));assert(!at(4500).includes('shield-break'));assert(at(5800).includes('shield-break'));assert(at(8200).includes('hurt'));assert(at(10800).includes('hurt'));assert(!at(10800).includes('shield-break'));
  assert(played.some(t=>t.id==='critical'));assert(a.candidatePcmPlusActiveAudioBufferBytes<=512*1024);
  if(density==='crowded')assert(a.dropped>0);
  runs.push(a);fs.writeFileSync(path.join(out,weapon+'-'+density+'.json'),JSON.stringify(a,null,2));
 });
 await p.evaluate(()=>window.impactAudioAudition.dispose());assert.deepEqual(pageErrors,[]);
 fs.writeFileSync(path.join(out,'mix-qa.json'),JSON.stringify({status:'PASS',atUtc:new Date().toISOString(),browser:browser.version(),url,checks,pageErrors,runs:runs.map(a=>({weapon:a.settings.weapon,mode:a.mode,played:a.played,dropped:a.dropped,maxEffectsPlaying:a.maxEffectsPlaying,maxMusicSources:a.maxMusicSources,candidatePcmPlusActiveAudioBufferBytes:a.candidatePcmPlusActiveAudioBufferBytes,pcm:a.pcm})),audibility:'Native sources, buffers and timing observed; no human subjective or phone claim'},null,2));
}catch(e){fs.writeFileSync(path.join(out,'mix-qa-failure.json'),JSON.stringify({error:String(e),checks,pageErrors},null,2));console.error(e);process.exitCode=1;}finally{await browser?.close();}})();
