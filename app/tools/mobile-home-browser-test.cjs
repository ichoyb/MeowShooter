'use strict';
// Real player entry; host geometry is an explicit platform-contract fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.MOBILE_HOME_URL||'http://127.0.0.1:8934/',out=path.resolve(process.env.MOBILE_HOME_CHECK_DIR||path.join(__dirname,'../../.local/checks/mobile-visual-fit/browser'));
fs.mkdirSync(out,{recursive:true});const checks=[],errors=[];let browser;
const red=process.env.MOBILE_HOME_RED==='1';
async function inspect(p){return p.evaluate(()=>{
 const app=document.getElementById('app'),s=document.getElementById('page-scroll'),screen=document.getElementById('pages'),r=screen.getBoundingClientRect(),layout=JSON.parse(app.dataset.layout),bad=[],small=[],clipped=[];
 const content={top:r.top,bottom:r.bottom,left:r.left,right:r.right};
 for(const q of ['.r1-home-title','.r1-home-tools','.r1-home-scene','.r1-pair','.r1-level-caption','.r1-home-note','#page-footer']){const el=document.querySelector(q),a=el.getBoundingClientRect();if(a.top<r.top-1||a.bottom>r.bottom+1||a.left<r.left-2||a.right>r.right+2)clipped.push({q,top:a.top,bottom:a.bottom,left:a.left,right:a.right});}
 for(const b of screen.querySelectorAll('button')){const a=b.getBoundingClientRect();if(a.width<43.9||a.height<43.9)bad.push({text:b.textContent,w:a.width,h:a.height});}
 for(const el of screen.querySelectorAll('p,button,button strong,button span')){const a=el.getBoundingClientRect();if(a.width&&a.height&&parseFloat(getComputedStyle(el).fontSize)<14)small.push({text:el.textContent,size:getComputedStyle(el).fontSize});}
 return {layout,homeLayout:JSON.parse(app.dataset.homeLayout||'null'),scroll:{top:s.scrollTop,total:s.scrollHeight,client:s.clientHeight},bodyHeight:document.scrollingElement.scrollHeight,innerHeight:innerHeight,badButtons:bad,smallText:small,clipped,content};
 });}
async function validate(p){const v=await inspect(p);assert(v.scroll.total<=v.scroll.client+1,`home must fit one screen: overflow ${v.scroll.total-v.scroll.client}px`);assert.equal(v.bodyHeight,v.innerHeight);assert.deepEqual(v.badButtons,[]);assert.deepEqual(v.smallText,[]);assert.deepEqual(v.clipped,[]);await p.evaluate(()=>{document.getElementById('page-scroll').scrollTop=500;window.scrollTo(0,500);});assert.equal(await p.locator('#page-scroll').evaluate(e=>e.scrollTop),0);return v;}
async function check(name,fn){try{const observed=await fn();checks.push({name,status:'PASS',observed});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:String(e)});throw e;}}
async function boot({width=390,height=844,dpr=2,top=44,bottom=24,host=null,cat='CAT01'}={}){
 const c=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:true}),p=await c.newPage();p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(String(e)));
 await c.addInitScript(({top,bottom,host})=>{
  document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--safe-area-inset-top',top+'px');document.documentElement.style.setProperty('--safe-area-inset-bottom',bottom+'px');});
  window.__windowCalls=0;if(host)window.xhs={launchOptions:{miniToolEnv:{buildVersion:host.version||9510001}},miniTool:{getWindowInfo:()=>{window.__windowCalls++;return host.fail?Promise.reject(Error('fixture native unavailable')):new Promise(resolve=>setTimeout(()=>resolve(host.info),host.delay||0));}}};
 },{top,bottom,host});
 await p.goto(url+'?cat='+cat);await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');await p.waitForTimeout(80);return {c,p};
}
const click=(p,a)=>p.locator('button[data-action="'+a+'"]:visible').last().click();
(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});try{
 if(red){const {c,p}=await boot();await p.screenshot({path:path.join(out,'red-home.png')});await check('RED original390x844 safe44/24 must be one screen',()=>validate(p));await c.close();}
 else{
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const dpr of [1,2,3])for(const low of [false,true]){
   await check(`home ${width}x${height} dpr${dpr} ${low?'low':'standard'} safe44/24`,async()=>{const {c,p}=await boot({width,height,dpr});if(low){await click(p,'settings');await p.locator('#quality').selectOption('低');await click(p,'close');}const v=await validate(p);if(dpr===2&&!low)await p.screenshot({path:path.join(out,`home-${width}x${height}.png`)});await c.close();return v;});
  }
  for(const [width,height,top,bottom] of [[390,844,0,0],[390,844,92,24],[412,911,32,24],[412,780,32,24],[430,932,44,34],[1440,900,0,0],[1920,1080,0,0]])await check(`extra viewport ${width}x${height} safe${top}/${bottom}`,async()=>{const {c,p}=await boot({width,height,top,bottom});const v=await validate(p);await c.close();return v;});
  const rect=(l,t,w,h)=>({left:l,top:t,right:l+w,bottom:t+h,width:w,height:h});
  const info={pixelRatio:3,windowWidth:390,windowHeight:844,safeArea:rect(0,30,390,790),menuButtons:{back:rect(12,46,36,36),me:null,share:rect(342,46,36,36)}};
  for(const [label,host,expected] of [['native', {info},90],['native logical coordinates ×0.5',{info:{...info,windowWidth:780,windowHeight:1688,safeArea:rect(0,60,780,1580),menuButtons:{back:rect(24,92,72,72),me:null,share:null}}},90],['native hidden buttons',{info:{...info,menuButtons:{back:null,me:null,share:null}}},38],['native rejected',{fail:true},108],['old client ignores unsupported native method',{version:9480001,info},108]]){
   await check(label,async()=>{const {c,p}=await boot({host});const v=await validate(p);assert(Math.abs(v.homeLayout.top-expected)<1,JSON.stringify(v.homeLayout));assert.equal(v.layout.contentTop,108,'home native geometry must not change existing battle layout contract');const calls=await p.evaluate(()=>window.__windowCalls);assert.equal(calls,host.version===9480001?0:1);await c.close();return {layout:v.layout,homeLayout:v.homeLayout,calls};});
  }
  await check('delayed native response redraws the existing cat canvas after size changes',async()=>{const {c,p}=await boot({width:390,height:640,host:{delay:400,info:{...info,windowHeight:640,safeArea:rect(0,30,390,586)}}});const before=await p.locator('.r1-home-cat canvas').getAttribute('data-asset-paint-key');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.homeLayout).source==='native-window');const v=await validate(p);const canvas=await p.locator('.r1-home-cat canvas').evaluate(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.assetPaintKey,width:e.width,height:e.height,w:r.width,h:r.height};});const size=Math.round(384*Math.min(1,canvas.w*2/384,canvas.h*2/384));assert.equal(canvas.key,size+'x'+size);assert.equal(canvas.width,canvas.height);await c.close();return {before,after:canvas,homeLayout:v.homeLayout};});
  await check('home resize preserves one-screen and all three real cat entries navigate',async()=>{const cats=[];for(const cat of ['CAT01','CAT02','CAT03']){const {c,p}=await boot({cat});await validate(p);await click(p,'select');await click(p,'cancel-select');await validate(p);await click(p,'book');await click(p,'back');await validate(p);await click(p,'help');await click(p,'back');await validate(p);await p.setViewportSize({width:430,height:932});await p.waitForTimeout(100);await validate(p);await p.setViewportSize({width:844,height:390});await p.waitForTimeout(50);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);await validate(p);await click(p,'start');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).elapsed>.3);await click(p,'pause');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.state).engine.paused);const s=await p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));assert.equal(s.catId,cat);assert.equal(s.weaponId,{CAT01:'W01',CAT02:'W04',CAT03:'W02'}[cat]);assert.equal(s.catDisplay.width,36);cats.push({cat:s.catId,weapon:s.weaponId,display:s.catDisplay,browserRotationReturn:true});await c.close();}return {cats,shortLandscapeLayout:'NOT_TESTED',phoneRotation:'NOT_TESTED'};});
 }
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(path.join(out,red?'red.json':'report.json'),JSON.stringify({browser:browser.version(),scope:'LOCAL_NORMAL_PLAYER_AND_EXPLICIT_HOST_GEOMETRY_FIXTURES_NOT_DEVICE',url,checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
