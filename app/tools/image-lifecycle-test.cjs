const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),root=path.dirname(app);
const out=path.resolve(process.env.LIFECYCLE_QA_OUT||path.join(root,'.local/checks/image-lifecycle',new Date().toISOString().replace(/[:.]/g,'-')));
fs.mkdirSync(out,{recursive:true});
(async()=>{
 process.chdir(app);process.env.BUILD_PROFILE='playtest';
 const {createBuildOptions}=await import(pathToFileURL(path.join(app,'tools/build-options.mjs')).href);
 const {build}=require(path.join(app,'node_modules/esbuild'));
 const {buildConfig}=await import(pathToFileURL(path.join(app,'tools/build-config.mjs')).href);
 const config=buildConfig(),dist=path.resolve(app,config.dist);
 const {buildOptions}=await createBuildOptions(config);
 const compiled=await build({...buildOptions,nodePaths:[path.join(app,'node_modules')],entryPoints:[path.join(app,'tests/fixtures/g8-image-lifecycle.ts')],outfile:path.join(out,'main.js'),write:false});
 const html='<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="stage" style="width:390px;height:844px"></div><script src="main.js"></script></body></html>';
 const requests=[];
 const server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname;requests.push(n);if(n==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(n==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].contents);}else{const p=path.resolve(dist,'.'+n);if(!p.startsWith(dist+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.png':'image/png','.svg':'image/svg+xml','.jpeg':'image/jpeg'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>document.body.dataset.qa,{timeout:30000});const report=await page.evaluate(()=>window.result);
  report.browser=browser.version();report.scope='CONTROLLED_NATIVE_LIFECYCLE_NOT_NATURAL_OR_DEVICE_ACCEPTANCE';report.runnerSHA256=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');report.fixtureSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(app,'tests/fixtures/g8-image-lifecycle.ts'))).digest('hex');report.errors=errors;report.requests=requests;report.sourceSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(app,'src/battle.ts'))).digest('hex');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,errors}));
  process.exitCode=report.status==='PASS'&&!errors.length?0:1;
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
