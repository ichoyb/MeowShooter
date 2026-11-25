const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),out=path.resolve(process.env.G5_SCENE_DIR||path.join(app,'../.local/checks/g5-opening-20261105/scene')),port=process.env.G5_PORT||'9025';
const artifact=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8')),errors=[],sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');let browser,server;
(async()=>{try{
 server=spawn(process.execPath,[path.join(app,'tools/serve.mjs')],{cwd:app,env:{...process.env,APP_DIST:artifact.dist,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1100,height:950}});p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+port+'/g5-opening-checks.html');await p.waitForFunction(()=>window.g5OpeningReady||window.g5OpeningBootError);
 const gates=process.env.G5_GATES==='1';
 const result=await p.evaluate(gates=>window.g5OpeningBootError?{status:'FAIL',error:window.g5OpeningBootError}:gates?window.runG5GateChecks():window.runG5OpeningChecks(),gates);
 fs.writeFileSync(path.join(out,gates?'gates.json':'scene.json'),JSON.stringify({artifact,...result,errors,browser:browser.version(),runnerSHA256:sha(__filename),platform:'NOT_TESTED',phone:'NOT_TESTED'},null,2)+'\n');
 assert.equal(result.status,'PASS',result.error);assert.deepEqual(errors,[]);assert.equal(sha(path.join(artifact.dist,'assets/main.js')),artifact.mainSHA256);console.log('PASS actual G5 opening Scene '+result.checks.length);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server?.kill();}})();
