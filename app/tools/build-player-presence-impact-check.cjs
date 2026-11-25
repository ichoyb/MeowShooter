// Actual accepted HP loss on each comparison side; prepare must precede hits.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const assert=require('node:assert/strict');
const url=process.env.PRESENCE_URL||'http://127.0.0.1:9073/motion.html';
const out=process.env.PRESENCE_CHECK_DIR||'../.local/checks/player-presence-impact';
mkdirSync(out,{recursive:true});
const checks=[],errors=[],sides=[];
let browser,page;
const check=(name,condition,details)=>{checks.push({name,pass:!!condition,details});assert.ok(condition,name+' '+JSON.stringify(details));};
(async()=>{
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(url);await page.waitForFunction(()=>window.presenceReady||window.presenceError);
  check('boot succeeds',!await page.evaluate(()=>window.presenceError),await page.evaluate(()=>window.presenceError));
  const initial=await page.evaluate(()=>window.presence.snapshot().battle.impact);
  for(const modern of [false,true,false,true]){
   await page.evaluate(()=>window.presence.start());
   await page.waitForFunction(()=>window.presence.f.a.scene.isActive());
   const result=await page.evaluate(modern=>{
    const p=window.presence,a=p.f.a;p.setMode(modern);
    const selected=p.snapshot(),before=selected.battle.impact;
    const damage=a.incomingEnemyDamage(1),after=p.snapshot();
    return {modern,damage,before,after:after.battle.impact,hpBefore:selected.battle.hp,hpAfter:after.battle.hp,objects:after.objects};
   },modern);
   sides.push(result);
   check((modern?'refined':'current')+' actual accepted HP loss',result.damage.accepted&&result.damage.hpLost===1&&result.hpAfter===result.hpBefore-1,result.damage);
   check((modern?'refined':'current')+' all four layers receive native flash',result.after.playerActive===4&&result.after.unpreparedPartsSkipped===result.before.unpreparedPartsSkipped,result);
   check((modern?'refined':'current')+' hit allocates no new source Canvas',result.after.cacheSources===result.before.cacheSources&&result.after.derivedCanvasBytes===result.before.derivedCanvasBytes,{before:result.before,after:result.after});
  }
  const final=await page.evaluate(()=>window.presence.snapshot().battle.impact);
  const known=sides.slice(1);
  check('known-side switches/restarts keep prepared cache stable',known.every(s=>s.after.cacheSources===final.cacheSources&&s.after.derivedCanvasBytes===final.derivedCanvasBytes),sides.map(s=>s.after));
  check('no page errors',errors.length===0,errors);
  const build=JSON.parse(readFileSync(path.join(path.dirname(out),'preview/presence-build.json'),'utf8'));
  const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
  const record={url,browser:await browser.version(),sampleSHA256:build.sampleSHA256,sourceSHA256:sha('tests/fixtures/player-presence-sample.ts'),checkSHA256:sha(__filename),checks,errors,sides,
   cacheBudget:{initial,final,additionalSources:final.cacheSources-initial.cacheSources,additionalCanvasBytes:final.derivedCanvasBytes-initial.derivedCanvasBytes},notTested:['Android','iOS','Xiaohongshu container','Chrome61','visual acceptance']};
  writeFileSync(path.join(out,'report.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,report:path.join(out,'report.json'),cacheBudget:record.cacheBudget}));
 }catch(error){
  writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,sides,state:page?await page.evaluate(()=>window.presence.snapshot()).catch(()=>null):null},null,2)+'\n');throw error;
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

