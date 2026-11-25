'use strict';
// Fresh real-main bundles, isolated from candidate dist / ZIP and existing previews.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{build}=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),root=path.dirname(app),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const out=path.resolve(process.env.INPUT_DIAGNOSTICS_QA_OUT||path.join(root,'.local/checks/input-diagnostics',new Date().toISOString().replace(/[:.]/g,'-')));
const baseline=process.env.INPUT_DIAGNOSTICS_BASELINE;
if(baseline)assert.match(baseline,/^[a-f0-9]{40}$/,'baseline must be a real full commit');
fs.mkdirSync(out,{recursive:true});
const report={scope:'ISOLATED_REAL_MAIN_INPUT_CHECK_NOT_RELEASE_OR_PHONE_ACCEPTANCE',baseline:baseline||null,atUtc:new Date().toISOString(),checks:[],errors:[],platform:'NOT_TESTED',phone:'NOT_TESTED',minimumKernel:'NOT_TESTED',runnerSha256:sha(fs.readFileSync(__filename))};
const action=(page,id)=>page.locator('button[data-action="'+id+'"]:visible').last().click();
const state=page=>page.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
async function host(page,type,x=132){
  await page.evaluate(({type,x})=>{
    const canvas=document.querySelector('#stage canvas'),touch={identifier:201,clientX:x,clientY:440};
    const event=new Event(type,{bubbles:true,cancelable:true});
    // Intentionally missing page coordinates / target: the production adapter must still fill them.
    event.changedTouches=[touch];event.touches=type==='touchend'||type==='touchcancel'?[]:[touch];event.targetTouches=event.touches;canvas.dispatchEvent(event);
  },{type,x});
}
(async()=>{
 process.chdir(app);
 const {createBuildOptions}=await import('./build-options.mjs');
 const runtime=JSON.parse(fs.readFileSync('runtime-config.json','utf8'));
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
  for(const [profile,diagnostics]of [['release',false],['review',false],['playtest',false],['playtest',true]]){
   const name=profile+(diagnostics?'-test-fixture':'-player-default'),folder=path.join(out,name);
   fs.mkdirSync(path.join(folder,'assets'),{recursive:true});
   const config={profile,dist:folder,...runtime[profile]};
   const {buildOptions}=await createBuildOptions(config,{testInputDiagnostics:diagnostics});
   const plugins=baseline?[{name:'explicit-regression-baseline',setup(builder){builder.onLoad({filter:/[\\/]src[\\/](?:main|battle)\.ts$/},args=>({contents:execFileSync('git',['show',baseline+':app/src/'+path.basename(args.path)],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}),loader:'ts',resolveDir:path.join(app,'src')}));}}]:[];
   const compiled=await build({...buildOptions,plugins:[...plugins,...buildOptions.plugins]});
   const entry=path.join(folder,'assets/main.js');
   fs.writeFileSync(path.join(folder,'index.html'),fs.readFileSync('index.html','utf8').replace('data-build-profile="release"','data-build-profile="'+profile+'"'));
   fs.copyFileSync('style.css',path.join(folder,'assets/style.css'));
   await build({entryPoints:['src/boot.js'],bundle:true,format:'iife',platform:'browser',target:['es2017','chrome61'],minify:true,outfile:path.join(folder,'assets/boot.js')});
   const sources=Object.keys(compiled.metafile.inputs).filter(file=>!file.includes('node_modules')).map(file=>{
     const historical=baseline&&/^src\/(?:main|battle)\.ts$/.test(file);
     const bytes=historical?execFileSync('git',['show',baseline+':app/'+file],{cwd:root,windowsHide:true,maxBuffer:4*1024*1024}):fs.readFileSync(file);
     return{file,sha256:sha(bytes),source:historical?baseline:'current-worktree'};
   });
   const observed={name,profile,testInputDiagnostics:diagnostics,mainSha256:sha(fs.readFileSync(entry)),sources};
   fs.writeFileSync(path.join(folder,'build-inputs.json'),JSON.stringify(observed,null,2)+'\n');
   const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://local'),relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
    let file=path.resolve(folder,relative);
    if(!file.startsWith(folder+path.sep)){res.writeHead(403);res.end();return;}
    if(!fs.existsSync(file)){
      file=path.resolve(app,relative);
      if(relative.startsWith('assets/ui/')&&config.courtyardEnabled){const name=path.basename(relative);if(/^CAT0[123]\.png$/.test(name))file=path.join(app,'assets/r1-restoration/ui-'+name);if(name==='garden.jpeg')file=path.join(app,'assets/r1-restoration/entry-scene.jpeg');}
    }
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
   });
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   try{
    await page.addInitScript(()=>{
      window.inputTraceWrites=[];window.inputObservationListeners=[];
      const add=window.addEventListener;
      window.addEventListener=function(type,listener,options){if(options?.capture&&options?.passive&&['mousemove','pointermove','touchmove'].includes(type))window.inputObservationListeners.push(type);return add.call(this,type,listener,options);};
      new MutationObserver(records=>{for(const record of records)if(['data-input-events','data-touch-events','data-battle-input-events'].includes(record.attributeName))window.inputTraceWrites.push(record.attributeName);}).observe(document,{subtree:true,attributes:true});
    });
    // Neither URL parameters nor the DOM profile marker grant diagnostic permissions.
    await page.goto('http://127.0.0.1:'+server.address().port+'/?testInputDiagnostics=true&diagnostics=true');
    await page.waitForFunction(()=>document.getElementById('app')?.dataset.ready==='true',null,{timeout:20000});
    await page.evaluate(()=>{document.getElementById('app').dataset.testInputDiagnostics='true';});
    await page.mouse.move(40,400);await page.mouse.move(70,420);
    observed.idle=await page.evaluate(()=>({writes:window.inputTraceWrites.slice(),listeners:window.inputObservationListeners.slice()}));
    if(!diagnostics){assert.deepEqual(observed.idle.writes,[],'default mousemove must not write input traces');assert.deepEqual(observed.idle.listeners,[],'player must not register the passive window observer');}
    await action(page,'start');
    if(await page.locator('button[data-action="chapter-skip"]:visible').count())await action(page,'chapter-skip');
    await page.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>0);
    const before=await state(page);await host(page,'touchstart',100);await host(page,'touchmove');await page.waitForTimeout(150);const held=await state(page);
    assert.equal(held.moveHeld,true,'host touch must reach the actual Phaser owner');assert.ok(held.player.x>before.player.x+3,'actual Arcade movement must continue');
    await host(page,'touchend');await page.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).moveHeld);
    await host(page,'touchstart',100);await host(page,'touchmove');await host(page,'touchcancel');
    await page.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).reasons.includes('inputLost'));
    const cancelled=await state(page);assert.equal(cancelled.moveHeld,false);assert.equal(cancelled.engine.paused,true);
    observed.input=await page.evaluate(()=>{const d=document.getElementById('app').dataset;return{writes:window.inputTraceWrites,action:d.inputEvents?JSON.parse(d.inputEvents):null,touch:d.touchEvents?JSON.parse(d.touchEvents):null,battle:d.battleInputEvents?JSON.parse(d.battleInputEvents):null};});
    observed.before=before.player;observed.held=held.player;observed.cancelled={moveHeld:cancelled.moveHeld,reasons:cancelled.reasons};
    if(diagnostics){
      assert.ok(observed.input.action.some(e=>e.action==='start'&&e.outcome==='activated'));
      assert.ok(observed.input.touch.some(e=>e.normalized&&e.changedAfter.every(t=>t.hasTarget&&t.pageX!==null)));
      assert.ok(observed.input.battle.terminal.some(e=>e.channel==='phaser'&&e.canceled));
      assert.ok(observed.input.battle.terminal.some(e=>e.channel==='dom'&&e.type==='touchstart'));
    }else{assert.deepEqual(observed.input,{writes:[],action:null,touch:null,battle:null},'player input traces must remain absent after real movement/cancel');}
    assert.deepEqual(errors,[]);observed.status='PASS';
   }catch(error){observed.status='FAIL';observed.error=String(error);report.errors.push({name,error:String(error),pageErrors:errors});}
   finally{report.checks.push(observed);await context.close();await new Promise(resolve=>server.close(resolve));}
  }
 }catch(error){report.errors.push({name:'harness',error:String(error)});}
 finally{await browser?.close();report.status=report.checks.length===4&&!report.errors.length?'PASS':'FAIL';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,status:report.status,checks:report.checks.map(({name,status,error})=>({name,status,error})),errors:report.errors}));process.exitCode=report.status==='PASS'?0:1;}
})().catch(error=>{console.error(error);process.exitCode=1;});
