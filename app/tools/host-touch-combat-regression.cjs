'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),version=process.env.CANDIDATE_VERSION||JSON.parse(fs.readFileSync(path.join(root,'app/package.json'))).version;
const config=require('./release-test-config.cjs')(root),dist=config.dist,manifest=config.candidate;
config.verify();
const out=process.env.HOST_TOUCH_QA_DIR||path.join(config.qa,'host-touch-runs',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});const checks=[],errors=[];let browser,server;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const action=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
async function check(name,fn){try{checks.push({name,status:'PASS',actual:await fn()});}catch(e){checks.push({name,status:'FAIL',error:String(e)});errors.push({name,error:String(e)});}fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({checks,errors},null,2));}
// Matches the observed receiver boundary: generic Event and plain touch records,
// followed by touch PointerEvent. This is a labelled local model, not live input.
async function host(p,type,points,changed=points,complete=false){return p.evaluate(({type,points,changed,complete})=>{const canvas=document.querySelector('canvas');const record=t=>({...t,...(complete===true||complete==='page'?{pageX:t.clientX+window.scrollX,pageY:t.clientY+window.scrollY}:{}),...(complete===true||complete==='target'?{target:canvas}:{})});const e=new Event(type,{bubbles:true,cancelable:true,composed:true});e.touches=points.map(record);e.targetTouches=e.touches;e.changedTouches=changed.map(record);canvas.dispatchEvent(e);const t=changed[0]||points[0];if(t&&typeof PointerEvent==='function')canvas.dispatchEvent(new PointerEvent({touchstart:'pointerdown',touchmove:'pointermove',touchend:'pointerup',touchcancel:'pointercancel'}[type],{bubbles:true,cancelable:true,composed:true,pointerType:'touch',pointerId:1,button:type==='touchmove'?-1:0,buttons:type==='touchstart'||type==='touchmove'?1:0,clientX:t.clientX,clientY:t.clientY}));return {prevented:e.defaultPrevented,trace:JSON.parse(document.getElementById('app').dataset.touchEvents||'[]')};},{type,points,changed,complete});}
const point=(identifier,clientX,clientY)=>({identifier,clientX,clientY,screenX:clientX,screenY:clientY});
async function fixture(fn,w=390,h=844,dpr=1){const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:dpr}),p=await ctx.newPage();try{await p.goto('http://127.0.0.1:8810/');await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await action(p,'start');if(await p.locator('button[data-action="chapter-skip"]:visible').count())await action(p,'chapter-skip');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>0);await fn(p,ctx);}finally{await ctx.close();}}
async function serve(directory){
 if(server)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
 server=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,PORT:'8810',APP_DIST:directory},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
}
let inputFixture;
(async()=>{try{
 const fixtureDist=path.join(out,'input-diagnostics-fixture');fs.cpSync(dist,fixtureDist,{recursive:true});
 const {build}=require('esbuild');
 await build(await require('./browser-fixture-options.cjs')(config,{outfile:path.join(fixtureDist,config.entryFile('main.js')),testInputDiagnostics:true}));
 inputFixture={scope:'INDEPENDENT_INPUT_DIAGNOSTICS_FIXTURE_NOT_PLAYER_CANDIDATE',testInputDiagnostics:true,mainSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtureDist,config.entryFile('main.js')))).digest('hex')};
 await serve(fixtureDist);browser=await chromium.launch({channel:'chrome',headless:true});
// A held gesture survives GAME_OUT. Only actual release/cancel or lifecycle
// interruption ends ownership. These local tests deliver explicit end events;
// they do not claim to recover a release discarded by a remote simulator.
async function offset(p){await p.evaluate(()=>{Object.assign(document.getElementById('app').style,{position:'absolute',left:'70px',top:'25px',width:'390px',height:'844px'});window.dispatchEvent(new Event('resize'));});return p.locator('canvas').boundingBox();}
async function stillHeld(p){
 await p.waitForTimeout(70);const before=await state(p);
 assert.equal(before.moveHeld,true,'leaving canvas while held must retain ownership');
 assert.equal(before.engine.paused,false);assert.deepEqual(before.reasons,[]);
 await p.waitForTimeout(180);const after=await state(p);
 assert.equal(after.moveOwner,before.moveOwner);assert.equal(after.engine.paused,false);
 assert.ok(Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y)>15,'held direction must continue actual movement away from world bounds');
 return {before,after};
}
async function released(p){
 await p.waitForFunction(()=>!JSON.parse(document.getElementById('app').dataset.state).moveHeld,{},{timeout:1200});
 const before=await state(p);assert.deepEqual(before.engine.velocity,{x:0,y:0});assert.equal(before.engine.paused,false);
 assert.equal(before.engine.stickVisible,false);await p.waitForTimeout(100);const after=await state(p);
 assert.deepEqual(after.player,before.player);assert.ok(after.elapsed>before.elapsed);return after;
}
function outside(r,side,x,y){return {left:[r.x-10,y],right:[r.x+r.width+10,y],top:[x,r.y-10],bottom:[x,r.y+r.height+10]}[side];}
await fixture(async p=>{await check('diagnostics distinguish document mouse release from touch owner without inventing release',async()=>{
 const a=point(201,100,440),b=point(201,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);
 // Input handlers update the owner immediately; the DOM snapshot is published on the next scene frame.
 await p.waitForFunction(()=>{const s=JSON.parse(document.getElementById('app').dataset.state);return s.moveHeld&&s.moveOwner!==null;},{},{timeout:1200});
 const established=await state(p),owner=established.moveOwner;
 await p.evaluate(()=>document.body.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0,clientX:500,clientY:440})));
 await p.waitForFunction(before=>JSON.parse(document.getElementById('app').dataset.state).elapsed>before,established.elapsed,{timeout:1200});
 const s=await state(p),trace=await p.locator('#app').evaluate(e=>JSON.parse(e.dataset.battleInputEvents||'{}'));
 assert.equal(s.moveHeld,true,'unrelated mouse up must not cancel a touch owner');
 assert.equal(s.moveOwner,owner,'unrelated mouse up must preserve the established touch owner');
 assert.ok(trace.terminal?.some(e=>e.channel==='dom'&&e.type==='mouseup'&&e.target==='BODY'&&e.owner===s.moveOwner));
 assert.ok(trace.terminal?.some(e=>e.channel==='phaser'&&e.type==='up'&&e.pointerId===0&&e.owner===s.moveOwner));
 await host(p,'touchend',[],[b]);const stopped=await released(p);
 const end=await p.locator('#app').evaluate(e=>JSON.parse(e.dataset.battleInputEvents||'{}'));
 assert.ok(end.terminal.some(e=>e.channel==='phaser'&&e.type==='up'&&e.wasTouch&&e.owner===null));return {trace,end,stopped};
});});
await fixture(async p=>{await check('diagnostics retain terminal evidence during many moves and never consume events',async()=>{
 const a=point(202,100,440);await host(p,'touchstart',[a]);
 for(let i=0;i<45;i++)await host(p,'touchmove',[point(202,132+i/10,440)]);
 const held=await state(p),trace=await p.locator('#app').evaluate(e=>JSON.parse(e.dataset.battleInputEvents||'{}'));
 assert.equal(held.moveHeld,true);assert.ok(trace.terminal?.some(e=>e.channel==='dom'&&e.type==='touchstart'));
 assert.ok(trace.terminal.length<=32);assert.ok(trace.motion.length<=8);assert.ok(trace.sequence>45);
 await host(p,'touchend',[],[a]);return {trace,released:await released(p)};
});});
await fixture(async p=>{await check('delivered outside document touch release reaches Phaser and is observed',async()=>{
 const a=point(203,100,440),b=point(203,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);
 await p.evaluate(()=>{const e=new Event('touchend',{bubbles:true,cancelable:true});e.changedTouches=[{identifier:203,clientX:500,clientY:440,pageX:500,pageY:440,target:document.body}];e.touches=[];document.body.dispatchEvent(e);});
 const stopped=await released(p),trace=await p.locator('#app').evaluate(e=>JSON.parse(e.dataset.battleInputEvents||'{}'));
 assert.ok(trace.terminal?.some(e=>e.channel==='dom'&&e.type==='touchend'&&e.target==='BODY'));
 assert.ok(trace.terminal.some(e=>e.channel==='phaser'&&e.type==='up'&&e.owner===null));return {trace,stopped};
});});
// All subsequent checks use the verified player candidate, with diagnostics off.
await serve(dist);
for(const side of ['left','right','top','bottom'])await fixture(async p=>{
 await check('native mouse held beyond '+side+' continues until real outside up',async()=>{
  const r=await offset(p),x=r.x+120,y=r.y+440;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+32,y);
  await p.waitForTimeout(50);const end=outside(r,side,x,y);await p.mouse.move(...end);
  const held=await stillHeld(p);await p.mouse.up();return {end,held,released:await released(p)};
 });
},600,950);
for(const side of ['left','right','top','bottom'])await fixture(async p=>{
 await check('translated touch held beyond '+side+' continues until delivered touchend',async()=>{
  const r=await offset(p),x=r.x+100,y=r.y+440,a=point(101,x,y),b=point(101,x+32,y),end=point(101,...outside(r,side,x,y));
  await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(50);await host(p,'touchmove',[end]);
  const held=await stillHeld(p);await host(p,'touchend',[],[end]);return {held,released:await released(p)};
 });
},600,950);
await fixture(async p=>{await check('native mouse leave cannot terminate translated touch owner',async()=>{
 const r=await offset(p),x=r.x+100,y=r.y+440;await p.mouse.move(x,y);
 const a=point(102,x,y),b=point(102,x+32,y);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);
 await p.waitForTimeout(50);await p.mouse.move(r.x-10,y);const held=await stillHeld(p);
 await host(p,'touchend',[],[b]);return {held,released:await released(p)};
});},600,950);
await fixture(async p=>{await check('owner survives exit and returns to reverse without repress',async()=>{
 const r=await offset(p),a=point(103,r.x+100,r.y+440),b=point(103,r.x+132,r.y+440),end=point(103,r.x-10,r.y+440);
 await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(50);const owner=(await state(p)).moveOwner;
 await host(p,'touchmove',[end]);const held=await stillHeld(p);await host(p,'touchmove',[point(103,r.x+60,r.y+440)]);
 await p.waitForTimeout(100);const reversed=await state(p);assert.equal(reversed.moveOwner,owner);assert.ok(reversed.engine.velocity.x<0);
 await host(p,'touchend',[],[end]);return {held,reversed,released:await released(p)};
});},600,950);
await fixture(async p=>{await check('unrelated finger exit and release never ends primary gesture',async()=>{
 const r=await offset(p),a=point(104,r.x+100,r.y+440),b=point(104,r.x+132,r.y+440),other=point(105,r.x+250,r.y+450),end=point(105,r.x-10,r.y+450);
 await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(50);const owner=(await state(p)).moveOwner;
 await host(p,'touchstart',[b,other],[other]);await host(p,'touchmove',[b,end],[end]);await host(p,'touchend',[b],[end]);
 const held=await stillHeld(p);assert.equal(held.after.moveOwner,owner);await host(p,'touchend',[],[b]);return {held,released:await released(p)};
});},600,950);
await fixture(async(p,ctx)=>{await check('native touch held at edge stays owned until native touch end',async()=>{
 const r=await offset(p),x=r.x+100,y=r.y+440,c=await ctx.newCDPSession(p);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:106,x,y}]});
 await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:106,x:x+32,y}]});await p.waitForTimeout(50);
 await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:106,x:r.x-10,y}]});
 const held=await stillHeld(p);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});return {held,released:await released(p)};
});},600,950);
await fixture(async p=>{await check('observed edge trajectory retains direction and never invents release',async()=>{
 const r=await offset(p),a=point(107,r.x+100,r.y+440);await host(p,'touchstart',[a]);
 for(const dx of [5.725196312871002,2.6335933702382768,-.4580095723944485,-4.580146829238083,-7.671749771870807])await host(p,'touchmove',[point(107,r.x+dx,a.clientY)]);
 const held=await stillHeld(p);assert.ok(held.after.engine.velocity.x<0);await host(p,'touchend',[],[point(107,r.x-10,a.clientY)]);
 return {held,released:await released(p)};
});},600,950,1.5);
await fixture(async p=>{await check('real world bound stops position while hold survives and reversal works',async()=>{
 const a=point(108,100,440),b=point(108,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);
 await p.waitForFunction(()=>{const s=JSON.parse(document.getElementById('app').dataset.state);return s.player.x>=s.engine.world.width-s.catDisplay.width/2-.1;},{},{timeout:3000});
 await p.waitForTimeout(100);const bound=await state(p);assert.equal(bound.moveHeld,true);await p.waitForTimeout(100);const stays=await state(p);assert.deepEqual(stays.player,bound.player);
 await host(p,'touchmove',[point(108,68,440)]);await p.waitForTimeout(160);const reversed=await state(p);
 assert.equal(reversed.moveHeld,true);assert.ok(reversed.player.x<bound.player.x-10);await host(p,'touchend',[],[b]);return {bound,stays,reversed,released:await released(p)};
});});
await fixture(async p=>{await check('twelve actual outside releases permit fresh gestures without inheriting velocity',async()=>{
 const r=await offset(p),a=point(109,r.x+100,r.y+440),b=point(109,r.x+132,r.y+440),end=point(109,r.x-10,r.y+440),rows=[];
 for(let i=0;i<12;i++){await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(25);await host(p,'touchmove',[end]);
  const held=await state(p);assert.equal(held.moveHeld,true);await host(p,'touchend',[],[end]);const stopped=await released(p);
  await host(p,'touchmove',[b]);assert.equal((await state(p)).moveHeld,false);rows.push({held:held.moveOwner,stopped:stopped.player});}
 return rows;
});},600,950);
if(config.profile==='playtest')await fixture(async p=>{await check('held canvas exit preserves music; actual cancel freezes and clears input',async()=>{
 await action(p,'pause');await action(p,'end');await action(p,'confirm-end');if(config.runtime.courtyardEnabled){await action(p,'settings');if(!await p.locator('button[data-action="sound-enable"]').count()){await action(p,'close');const audio=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));if(!audio.settings.music)await action(p,'sound-toggle:music');await action(p,'settings');}if(await p.locator('button[data-action="sound-enable"]:visible').count())await action(p,'sound-enable');await action(p,'close');}else await action(p,'sound-enable');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.audio).ready);await action(p,'start');
 const r=await offset(p),a=point(110,r.x+100,r.y+440),b=point(110,r.x+132,r.y+440),end=point(110,r.x-10,r.y+440);
 await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(50);await host(p,'touchmove',[end]);const held=await stillHeld(p);
 const audio=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));assert.equal(audio.musicPlaying,true);assert.equal(audio.held,false);
 await host(p,'touchcancel',[],[end]);await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);
 const canceled=await state(p),silent=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));
 assert.equal(canceled.moveHeld,false);assert.ok(canceled.reasons.includes('inputLost'));assert.equal(silent.musicPlaying,false);return {held,audio,canceled,silent};
});},600,950);
if(!process.argv.includes('--boundary-only')){
await fixture(async(p,ctx)=>{await check('native CDP touch movement positive control',async()=>{const c=await ctx.newCDPSession(p),before=await state(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:100,y:440}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:132,y:440}]});await p.waitForTimeout(180);const held=await state(p);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(60);const released=await state(p);assert.ok(held.moveHeld&&held.player.x>before.player.x+5);assert.equal(released.moveHeld,false);return {before,held,released};});});
for(const complete of [false,true,'page','target'])await fixture(async p=>{await check(complete===true?'host complete coordinates positive control':complete==='page'?'host page coordinates with missing target':complete==='target'?'host target with missing page coordinates':'host client-only touch moves through real Phaser',async()=>{const before=await state(p),a=point(11,100,440),b=point(11,132,440);await host(p,'touchstart',[a],[a],complete);await host(p,'touchmove',[b],[b],complete);await p.waitForTimeout(180);const held=await state(p);await host(p,'touchend',[],[b],complete);await p.waitForTimeout(60);const released=await state(p);assert.ok(held.moveHeld,'touch must own movement');assert.ok(held.player.x>before.player.x+5,'movement displacement');assert.equal(released.moveHeld,false);return {before,held,released,trace:await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.touchEvents||'[]'))};});});
await fixture(async p=>{await check('plain multi-touch keeps owner and partial release does not hand over',async()=>{const a=point(21,100,440),b=point(21,132,440),other=point(22,300,450);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(100);const owner=(await state(p)).moveOwner;assert.notEqual(owner,null);await host(p,'touchstart',[b,other],[other]);assert.equal((await state(p)).moveOwner,owner);await host(p,'touchend',[other],[b]);await p.waitForTimeout(50);assert.equal((await state(p)).moveHeld,false);await host(p,'touchmove',[point(22,330,450)]);await p.waitForTimeout(50);assert.equal((await state(p)).moveHeld,false);await host(p,'touchend',[],[point(22,330,450)]);return await state(p);});});
await fixture(async p=>{await check('unrelated cancel preserves owner and owner cancel waits',async()=>{const a=point(31,100,440),b=point(31,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(90);assert.equal((await state(p)).moveHeld,true);await host(p,'touchcancel',[],[point(999,300,450)]);assert.equal((await state(p)).moveHeld,true);await host(p,'touchcancel',[],[b]);await p.waitForTimeout(50);const after=await state(p);assert.equal(after.moveHeld,false);assert.ok(after.reasons.includes('inputLost'));return after;});});
await fixture(async p=>{await check('plain HUD touch cannot move and release is clean',async()=>{const a=point(41,60,120),b=point(41,100,120);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(90);assert.equal((await state(p)).moveHeld,false);await host(p,'touchend',[],[b]);return await state(p);});});
await fixture(async p=>{await check('eight restarts free host pointers and preserve session quality',async()=>{await action(p,'pause');await action(p,'settings');await p.locator('#quality').selectOption('低');await action(p,'close');const paused=await state(p);await action(p,'resume');await p.waitForFunction(t=>JSON.parse(document.getElementById('app').dataset.state).elapsed>t,paused.elapsed);for(let i=0;i<8;i++){const before=await state(p),a=point(50+i,100,440),b=point(50+i,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(90);const held=await state(p);assert.ok(held.player.x>before.player.x+3,JSON.stringify({iteration:i,before,held,trace:await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.touchEvents||'[]'))}));await host(p,'touchend',[],[b]);await action(p,'pause');await action(p,'end');await action(p,'confirm-end');assert.equal((await state(p)).projectiles,0);await action(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>0);assert.equal((await state(p)).moveHeld,false);}return JSON.parse(await p.locator('#app').getAttribute('data-ui'));});});
for(const [w,h]of [[320,568],[360,640],[430,932]])await fixture(async p=>{await check(w+' client-only CSS coordinate movement',async()=>{const before=await state(p),y=h*.5,a=point(70,60,y),b=point(70,92,y);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(140);const held=await state(p);assert.ok(held.player.x>before.player.x+4);await host(p,'touchend',[],[b]);return {before:before.player,held:held.player};});},w,h);
await fixture(async p=>{await check('DPR3 preserves CSS dead zone and full throw',async()=>{const before=await state(p),a=point(81,100,440),dead=point(81,105,440),full=point(81,132,440);await host(p,'touchstart',[a]);await host(p,'touchmove',[dead]);await p.waitForTimeout(90);assert.equal((await state(p)).player.x,before.player.x);await host(p,'touchmove',[full]);await p.waitForTimeout(140);const held=await state(p);assert.ok(held.player.x>before.player.x+4);await host(p,'touchend',[],[full]);return {before:before.player,held:held.player,dpr:await p.evaluate(()=>devicePixelRatio)};});},390,844,3);
await fixture(async p=>{await check('offset canvas maps client coordinates and outside release stops',async()=>{await p.evaluate(()=>{const app=document.getElementById('app');Object.assign(app.style,{position:'absolute',left:'70px',top:'25px',width:'390px',height:'844px'});window.dispatchEvent(new Event('resize'));});const r=await p.locator('canvas').boundingBox(),before=await state(p),a=point(82,r.x+100,r.y+440),b=point(82,r.x+132,r.y+440);await host(p,'touchstart',[a]);await host(p,'touchmove',[b]);await p.waitForTimeout(140);const held=await state(p);assert.ok(held.moveHeld&&held.player.x>before.player.x+4);await host(p,'touchend',[],[point(82,-50,-50)]);await p.waitForTimeout(70);const released=await state(p);assert.equal(released.moveHeld,false);return {canvas:r,before:before.player,held:held.player,released:released.player};});},600,950);
}
}catch(e){errors.push({name:'harness',error:String(e)});}finally{if(browser)await browser.close();if(server)server.kill();const source='app/tools/host-touch-combat-regression.cjs',runtimeMainSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,config.entryFile('main.js')))).digest('hex'),runtimeMatchesManifest=manifest.files.find(f=>f.file===config.entryFile('main.js'))?.sha256===runtimeMainSha256;const report={candidate:config.identity,inputFixture,atUtc:new Date().toISOString(),status:errors.length?'FAIL':'PASS',candidateVersion:version,artifactKind:config.artifactKind,receipt:config.receipt,zipSha256:config.artifactKind==='archive'&&runtimeMatchesManifest?manifest.sha256:null,runtimeMainSha256,runtimeMatchesManifest,checks,errors,notApplicable:config.profile==='playtest'?[]:[{name:'held canvas exit preserves music; actual cancel freezes and clears input',reason:'release does not build runtime audio; shared input-cancellation checks still run'}],source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'),environment:'Isolated local Chrome actual Phaser; receiver key Event/plain-touch/PointerEvent sequence model, not actual platform or phone',unverifiedBoundary:'Held input survives canvas exit. Stop requires a real end/cancel or lifecycle interruption. These checks deliver releases; a host that discards release remains unresolved and must be tested separately on the actual platform and phone.'};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,status:report.status,checks:checks.length,errors}));process.exitCode=errors.length?1:0;}})();
