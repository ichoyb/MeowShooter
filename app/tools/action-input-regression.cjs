'use strict';
// Isolated component regression. Composite events are an explicit model, not
// a captured Xiaohongshu event trace. The actual-container observations are separate.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),config=require('./release-test-config.cjs')(root),manifest=config.candidate;
config.verify();
const out=path.resolve(root,process.env.INPUT_QA_OUT||path.join(config.qa,'input-runs',new Date().toISOString().replace(/[:.]/g,'-')));
const crypto=require('node:crypto'),source='src/ui/action-input.ts',sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'app',source))).digest('hex');
assert.equal(manifest.sourceFiles.find(f=>f.file===source)?.sha256,sourceSha256,'isolated component must be the source packaged into this candidate');
fs.mkdirSync(out,{recursive:true});
const fixture=buildSync({stdin:{contents:`import {bindActionInput} from './src/ui/action-input';
window.fixtureReset=(replace=true)=>{document.body.innerHTML='<button data-action="close">Close</button>';window.activations=[];window.releases=[];window.inputEvents=[];window.replaceButton=replace;};
window.fixtureReset();
document.addEventListener('touchend',e=>window.releases.push({type:e.type,prevented:e.defaultPrevented}));
bindActionInput(document,'button[data-action]',b=>{window.activations.push(b.dataset.action);if(window.replaceButton)document.body.innerHTML='<button data-action="underlying">Underlying</button>';},record=>window.inputEvents.push(record));`,resolveDir:path.join(root,'app'),sourcefile:'fixture.ts'},bundle:true,write:false,format:'iife',target:'es2017'}).outputFiles[0].text;
const html='<!doctype html><html><head><style>button{position:absolute;left:40px;top:80px;width:140px;height:50px}</style></head><body><script src="./fixture.js"></script></body></html>';
let browser;const checks=[];
fs.writeFileSync(path.join(out,'fixture.js'),fixture);fs.writeFileSync(path.join(out,'fixture.html'),html);
const model=async(p,{kind='touch',finish='end',cap=false,replace=true,click=true,lateMouseDown=false}={})=>p.evaluate(({kind,finish,cap,replace,click,lateMouseDown})=>{
 window.fixtureReset(replace);const old=document.querySelector('button'),point={clientX:110,clientY:105},trace=[];
 function send(el,e){trace.push({type:e.type,target:el.dataset.action,cap:e.sourceCapabilities?.firesTouchEvents??null});el.dispatchEvent(e);}
 if(kind==='pointer'){
  send(old,new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:1,...point}));
  send(old,new PointerEvent('pointer'+(finish==='end'?'up':'cancel'),{bubbles:true,cancelable:true,pointerType:'touch',pointerId:1,...point}));
 }else{
  const t=new Touch({identifier:1,target:old,...point});
  send(old,new TouchEvent('touchstart',{bubbles:true,cancelable:true,changedTouches:[t],touches:[t]}));
  if(finish==='drag')send(old,new TouchEvent('touchmove',{bubbles:true,cancelable:true,changedTouches:[new Touch({identifier:1,target:old,clientX:130,clientY:105})],touches:[t]}));
  send(old,new TouchEvent(finish==='cancel'?'touchcancel':'touchend',{bubbles:true,cancelable:true,changedTouches:[t],touches:[]}));
 }
 if(click){const b=document.querySelector('button');if(lateMouseDown)send(b,new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,...point}));const e=new MouseEvent('click',{bubbles:true,cancelable:true,detail:1,...point});Object.defineProperty(e,'sourceCapabilities',{value:cap===null?null:{firesTouchEvents:cap}});send(b,e);}
 return {trace,actions:window.activations,releases:window.releases};
},{kind,finish,cap,replace,click,lateMouseDown});
// Model the receiver actually read from the deployed simulator DOM. Its tap
// MouseEvent init omits detail and sourceCapabilities, so click.detail is zero.
const receiverModel=async(p,{replace=true,finish='end'}={})=>p.evaluate(({replace,finish})=>{
 window.fixtureReset(replace);const old=document.querySelector('button'),point={clientX:110,clientY:105},touch={identifier:1,target:old,...point},trace=[];
 function send(el,e){trace.push({type:e.type,target:el.dataset.action,detail:e.detail??null,trusted:e.isTrusted,cap:e.sourceCapabilities?.firesTouchEvents??null});el.dispatchEvent(e);}
 function touchEvent(type,touches){const e=new Event(type,{bubbles:true,cancelable:true,composed:true});Object.assign(e,{touches,targetTouches:touches,changedTouches:[touch]});send(old,e);}
 touchEvent('touchstart',[touch]);send(old,new PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,pointerType:'touch',pointerId:1,...point}));
 if(finish==='drag'){const e=new Event('touchmove',{bubbles:true,cancelable:true,composed:true});Object.assign(e,{touches:[touch],changedTouches:[{...touch,clientX:130}]});send(old,e);}
 touchEvent(finish==='cancel'?'touchcancel':'touchend',[]);send(old,new PointerEvent(finish==='cancel'?'pointercancel':'pointerup',{bubbles:true,cancelable:true,composed:true,pointerType:'touch',pointerId:1,...point}));
 const b=document.elementFromPoint(point.clientX,point.clientY).closest('button');for(const type of ['mousemove','mousedown','mouseup','click'])send(b,new MouseEvent(type,{bubbles:true,cancelable:true,composed:true,view:window,button:0,buttons:0,...point}));
 return {trace,actions:window.activations,releases:window.releases};
},{replace,finish});
async function check(name,fn){try{checks.push({name,status:'PASS',observed:await fn()});}catch(e){checks.push({name,status:'FAIL',error:String(e)});}fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(checks,null,2));}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto(pathToFileURL(path.join(out,'fixture.html')).href);
 for(const spec of [{kind:'touch',cap:false,replace:true},{kind:'touch',cap:false,replace:false},{kind:'pointer',cap:false,replace:true},{kind:'touch',cap:true,replace:true},{kind:'touch',cap:null,replace:true},{kind:'touch',cap:false,replace:true,lateMouseDown:true}]){
  await check('one activation: '+JSON.stringify(spec),async()=>{const r=await model(p,spec);assert.deepEqual(r.actions,['close'],JSON.stringify(r));return r;});
 }
 for(const finish of ['drag','cancel'])await check(finish+' followed by mouse-labelled click stays inert',async()=>{const r=await model(p,{finish,cap:false,replace:false});assert.deepEqual(r.actions,[],JSON.stringify(r));return r;});
 for(const replace of [true,false])await check('actual receiver zero-detail tap activates once: repaint='+replace,async()=>{const r=await receiverModel(p,{replace});assert.deepEqual(r.actions,['close'],JSON.stringify(r));assert.equal(r.trace.at(-1).detail,0);return r;});
 for(const finish of ['drag','cancel'])await check('actual receiver zero-detail '+finish+' stays inert',async()=>{const r=await receiverModel(p,{replace:false,finish});assert.deepEqual(r.actions,[],JSON.stringify(r));return r;});
 await check('diagnostic snapshot identifies zero-detail synthetic click suppression',async()=>{await receiverModel(p);const events=await p.evaluate(()=>window.inputEvents),last=events.at(-1);assert.equal(last.type,'click');assert.equal(last.detail,0);assert.equal(last.trusted,false);assert.equal(last.firesTouchEvents,null);assert.equal(last.outcome,'suppressed');assert.equal(last.action,'underlying');return events;});
 await check('new actual mouse press after touch is a new operation',async()=>{await model(p,{click:false});await p.locator('button').click();const a=await p.evaluate(()=>window.activations);assert.deepEqual(a,['close','underlying']);return a;});
 await check('native mouse repeated clicks remain available',async()=>{await p.evaluate(()=>window.fixtureReset(false));await p.locator('button').click();await p.locator('button').click();const a=await p.evaluate(()=>window.activations);assert.deepEqual(a,['close','close']);return a;});
 await check('keyboard activation after touch remains available',async()=>{await model(p,{click:false});await p.locator('button').press('Enter');const a=await p.evaluate(()=>window.activations);assert.deepEqual(a,['close','underlying']);return a;});
 await check('native Space activation after touch remains available',async()=>{await model(p,{click:false});await p.locator('button').press('Space');assert.deepEqual(await p.evaluate(()=>window.activations),['close','underlying']);});
 await check('touch release is not cancelled before engine observers',async()=>{const r=await model(p,{click:false});assert.deepEqual(r.releases,[{type:'touchend',prevented:false}]);return r;});
 await check('pen release waits for the native click',async()=>{await p.evaluate(()=>{window.fixtureReset(false);const b=document.querySelector('button');for(const type of ['pointerdown','pointerup'])b.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'pen',pointerId:7,clientX:110,clientY:105}));});assert.deepEqual(await p.evaluate(()=>window.activations),[]);await p.locator('button').click();assert.deepEqual(await p.evaluate(()=>window.activations),['close']);});
 }catch(e){checks.push({name:'harness setup/runtime',status:'FAIL',error:String(e)});}finally{if(browser)await browser.close();const report={candidate:config.identity,atUtc:new Date().toISOString(),status:checks.length&&checks.every(c=>c.status==='PASS')?'PASS':'FAIL',profile:manifest.profile,artifactKind:config.artifactKind,receipt:config.receipt,zipSha256:config.artifactKind==='archive'?manifest.sha256:null,source,sourceSha256,environment:'Isolated local Chrome file fixture, shared action-input source matched to candidate manifest; labelled synthetic composite events plus native mouse/keyboard checks. Not the complete packaged app or platform acceptance.',checks};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,status:report.status,checks:checks.length,failed:checks.filter(c=>c.status==='FAIL')}));process.exitCode=report.status==='PASS'?0:1;}})();
