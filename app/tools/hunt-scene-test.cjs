const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.env.HUNT_CHECK_DIR||'../.local/checks/hunt-pilot-20261102'),port=process.env.HUNT_SCENE_PORT||'8962';let browser,server;const errors=[];
(async()=>{try{
 server=spawn(process.execPath,[path.join(__dirname,'serve.mjs')],{cwd:path.resolve(__dirname,'..'),env:{...process.env,APP_DIST:path.join(dir,'scene-dist'),PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port+'/hunt-checks.html');await page.waitForFunction(()=>window.huntChecksReady||window.huntChecksBootError);
 const result=await page.evaluate(()=>window.huntChecksBootError?{status:'FAIL',error:window.huntChecksBootError}:window.runHuntChecks());
 const artifact=JSON.parse(fs.readFileSync(path.join(dir,'hunt-build.json'),'utf8'));
 fs.writeFileSync(path.join(dir,process.env.HUNT_REPORT||'hunt-scene.json'),JSON.stringify({browser:browser.version(),artifact,...result,pageErrors:errors},null,2)+'\n');
 assert.equal(result.status,'PASS',result.error);assert.deepEqual(errors,[]);console.log('PASS actual hunt Scene '+result.checks.length);
 }catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
