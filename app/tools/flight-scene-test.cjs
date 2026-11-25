const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.env.FLIGHT_CHECK_DIR||'../.local/checks/g4-2b-flight-20261028'),port=process.env.FLIGHT_SCENE_PORT||'8916';let browser,server;const errors=[];
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:path.join(dir,'scene-dist'),PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 for(const [name,ready,run]of [['flight','flightChecksReady','runFlightChecks'],['rhythm','rhythmChecksReady','runRhythmChecks'],['projectile-traits','traitsChecksReady','runProjectileTraitsChecks']]){
  await page.goto('http://127.0.0.1:'+port+'/'+name+'-checks.html');await page.waitForFunction(key=>window[key]||window[key.replace('Ready','BootError')],ready);
  const result=await page.evaluate(({ready,run})=>window[ready.replace('Ready','BootError')]?{status:'FAIL',error:window[ready.replace('Ready','BootError')]}:window[run](),{ready,run});
  const artifact=JSON.parse(fs.readFileSync(path.join(dir,'flight-build.json'),'utf8'));
  fs.writeFileSync(path.join(dir,name==='flight'&&process.env.FLIGHT_REPORT?process.env.FLIGHT_REPORT:name+'-scene.json'),JSON.stringify({browser:browser.version(),artifact:{...artifact,executedChecks:name,executedChecksSHA256:artifact.checksSHA256[name]},...result,pageErrors:errors},null,2)+'\n');
  assert.equal(result.status,'PASS',result.error);assert.deepEqual(errors,[]);console.log('PASS actual '+name+' Scene '+result.checks.length);
 }
}catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
