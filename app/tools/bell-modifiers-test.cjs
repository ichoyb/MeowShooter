const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.GROWTH_CHECK_DIR||'../.local/checks/bell-modifiers-20261024');
const checks=[],errors=[],port=process.env.SCENE_PORT||'8835';let browser,server;
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:path.join(out,'fixture'),PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port+'/checks.html');await page.waitForFunction(()=>window.growthSceneReady||window.growthBootError);
 for(const name of (process.env.SCENE_CHECKS||'runOrbitMainBuildChecks,runOrbitHasteMovementChecks,runOrbitMainBuildDamageChecks,runGrowthChecks,runMovingHitChecks,runThreeBuildsChecks,runBellModifierChecks,runBellAbilityChecks,runBellAbilityBudgetChecks,runBellMovementRoomChecks,runBellTweenResumeChecks,runOrbitRankChecks,runOrbitRankCapacityChecks,runOrbitStarRankChecks,runBellCombinationChecks,runBellCombinationDisposeChecks').split(',')){
  const result=await page.evaluate(name=>window[name](),name);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2));
  checks.push({name,...result});assert.equal(result.status,'PASS',name+': '+result.error);console.log('PASS '+name+' '+result.checks.length);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'bell-modifiers-scene.json'),JSON.stringify({status:'PASS',browser:browser.version(),checks,pageErrors:errors},null,2));
}catch(error){fs.writeFileSync(path.join(out,'bell-modifiers-scene.json'),JSON.stringify({status:'FAIL',error:String(error),checks,pageErrors:errors},null,2));console.error(error);process.exitCode=1;}
finally{await browser?.close();server?.kill();}})();
