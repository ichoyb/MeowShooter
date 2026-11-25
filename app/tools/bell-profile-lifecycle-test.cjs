const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(app,'package.json'))).version;
const out=path.resolve(process.env.GROWTH_CHECK_DIR||path.join(app,'../.local/checks/bell-modifiers-20261024'));
const checks=[],pageErrors=[];let browser,server;
const state=page=>page.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(page,id)=>page.locator('button[data-action="'+id+'"]:visible').last().click();
async function serve(folder,port){server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:folder,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});}
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [index,profile] of ['release','review'].entries()){
  const build=spawnSync(process.execPath,['tools/build.mjs'],{cwd:app,env:{...process.env,BUILD_PROFILE:profile},windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const folder=path.join(out,'profile-'+profile);fs.cpSync(path.join(app,(profile==='release'?'dist-':'dist-review-')+version),folder,{recursive:true});
  await serve(folder,8838+index);const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(3500);page.on('pageerror',error=>pageErrors.push({profile,error:String(error)}));
  try{
   await page.goto('http://127.0.0.1:'+(8838+index)+'/');await page.waitForFunction(()=>document.getElementById('app').dataset.ready==='true',null,{timeout:3500});
   checks.push({profile,name:'normal entry reaches ready with real Phaser canvas',pass:await page.locator('#stage canvas').count()===1});
   await click(page,'start');await page.waitForFunction(()=>{const s=JSON.parse(document.getElementById('app').dataset.state);return s.view==='play'&&s.elapsed>.05;});let s=await state(page);
   assert.equal(s.progression,null);assert.equal(s.reloadSeconds,1.4);assert.equal(s.reloadIndicator.visible,false);assert.equal(s.engine.arenaMode,'single-screen');checks.push({profile,name:'real start advances original P2 battle',pass:true,elapsed:s.elapsed,rulesVersion:s.rulesVersion});
   await click(page,'pause');await page.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);const frozen=(await state(page)).elapsed;await page.waitForTimeout(180);assert.equal((await state(page)).elapsed,frozen);
   await click(page,'resume');await page.waitForFunction(time=>{const s=JSON.parse(document.getElementById('app').dataset.state);return !s.engine.paused&&s.elapsed>time;},frozen);checks.push({profile,name:'real pause freezes and resume advances battle',pass:true});
   await click(page,'pause');await click(page,'end');await click(page,'confirm-end');await click(page,'start');s=await state(page);assert(s.elapsed<1);assert.equal(s.hp,s.maxHp);assert(s.bellModifiers.activeVolleys<=s.shots);assert.equal(s.reloadIndicator.visible,false);checks.push({profile,name:'real end and restart reset battle without errors',pass:true,elapsed:s.elapsed,hp:s.hp});
  }catch(error){checks.push({profile,name:'profile lifecycle',pass:false,error:String(error),visibleText:(await page.locator('body').innerText()).slice(0,800)});}
  finally{await page.close();server.kill();server=null;}
 }
 const result={status:checks.every(c=>c.pass)&&!pageErrors.length?'PASS':'FAIL',browser:browser.version(),scope:'NORMAL_RELEASE_REVIEW_UI_NO_FIXTURE_MUTATION',checks,pageErrors};fs.writeFileSync(path.join(out,process.env.PROFILE_RESULT||'profile-lifecycle.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
}catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
