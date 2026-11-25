const {mkdirSync,writeFileSync}=require('node:fs');
const {resolve,join}=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

(async()=>{
 const output=resolve(process.env.IMPACT_NATIVE_DIR||'../.local/checks/combat-impact-pilot-20261112/native-'+Date.now());
 mkdirSync(output,{recursive:true});
 const {createBuildOptions}=await import(pathToFileURL(resolve('tools/build-options.mjs')));
 const {build}=require('esbuild');
 const {buildOptions}=await createBuildOptions({profile:'playtest',courtyardEnabled:true,combatSliceEnabled:false,dist:output});
 await build({...buildOptions,entryPoints:['tests/fixtures/impact-presentation-native.ts'],outfile:join(output,'fixture.js'),minify:false});
 writeFileSync(join(output,'index.html'),'<!doctype html><html><body><div id="stage"></div><script src="fixture.js"></script></body></html>');
 const server=createServer(async(req,res)=>{try{const file=req.url==='/fixture.js'?'fixture.js':'index.html';res.setHeader('content-type',file.endsWith('.js')?'application/javascript':'text/html');res.end(await readFile(join(output,file)));}catch(error){res.statusCode=500;res.end(String(error));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.impactNativeReady);
  const report=await page.evaluate(()=>window.runImpactNativeChecks());report.browser=browser.version();report.pageErrors=errors;
  report.fixtureSHA256=createHash('sha256').update(await readFile(join(output,'fixture.js'))).digest('hex');
  writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));
  for(const check of report.checks)console.log((check.pass?'PASS ':'FAIL ')+check.name+(check.error?' '+check.error:''));
  console.log(JSON.stringify({status:report.status,output,browser:report.browser}));
  assert.equal(report.status,'PASS');assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
