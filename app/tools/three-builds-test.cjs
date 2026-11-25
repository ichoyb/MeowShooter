const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.GROWTH_CHECK_DIR||path.join(root,'.local/checks/three-builds-20261024'));
const checks=[],errors=[],servers=[];let browser;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,id)=>p.locator('button[data-action="'+id+'"]:visible').last().click();
const routes=[{id:'barrage',core:'L1_SPLIT',support:'L1_DAMAGE',evo:'L1_EVO_BARRAGE',name:'彗星弹幕',draw:0},
 {id:'pierce',core:'L1_PIERCE',support:'L1_DAMAGE',evo:'L1_EVO_PIERCE',name:'长虹贯穿',draw:.5},
 {id:'cadence',core:'L1_ECHO',support:'L1_RELOAD',evo:'L1_EVO_CADENCE',name:'连奏风暴',draw:.99}];
async function serve(dir,port){const s=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,APP_DIST:dir,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});servers.push(s);await new Promise((r,j)=>{s.stdout.once('data',r);s.once('error',j);s.once('exit',c=>j(Error('server '+c)));});}
async function boot(p,url){p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');if(await p.locator('[data-action="sound-enable"]').count()){await click(p,'sound-enable');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.audio).ready);}await click(p,'start');}
async function choose(p,id){await p.locator('[data-action^="growth-select:"][data-action$="'+id+'"]').click();await p.locator('.growth-confirm button').click();}
function check(name,ok,value){assert(ok,name);checks.push({name,status:'PASS',value});console.log('PASS '+name);}
(async()=>{try{
 await serve(path.join(out,'fixture'),8821);await serve(path.join(out,'preview'),8822);browser=await chromium.launch({channel:'chrome',headless:true});
 const scene=await browser.newPage();await scene.goto('http://127.0.0.1:8821/checks.html');await scene.waitForFunction(()=>window.growthSceneReady||window.growthBootError);
 for(const name of ['runGrowthChecks','runMovingHitChecks','runThreeBuildsChecks']){const s=await scene.evaluate(n=>window[n](),name);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(s,null,2));check(name,s.status==='PASS',{count:s.checks.length,error:s.error});}await scene.close();
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['标准','低'])for(const route of routes){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true}),p=await ctx.newPage(),label=width+quality+route.id;await boot(p,'http://127.0.0.1:8821/ui.html');
  await p.evaluate(draw=>{const g=window.growthTestArena.growth;g.random=()=>draw;g.collect(66);},route.draw);await p.waitForSelector('.growth-choice');
  check(label+' first new ability and no automatic choice',await p.locator('.growth-card.core').count()===1&&await p.locator('.growth-confirm button').isDisabled(),(await state(p)).progression.offer);
  await p.evaluate(draw=>{window.growthTestArena.growth.random=()=>draw;},route.id==='cadence'?.99:0);
  await choose(p,route.core);await choose(p,route.support);await choose(p,route.support);
  const before=await state(p),offer=before.progression.offer;
  check(label+' two support picks grant eligibility, not free evolution',before.progression.routes.find(r=>r.id===route.id).eligible&&!before.progression.ranks[route.evo],before.progression.routes);
  await click(p,'growth-detail:'+route.evo);await p.getByText('可进阶',{exact:false}).waitFor();await click(p,'close');
  await click(p,'settings');await p.selectOption('#quality',quality);await click(p,'close');
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.getByText('等待明确继续',{exact:true}).waitFor();await click(p,'resume');
  check(label+' details, quality, background preserve the frozen offer',JSON.stringify((await state(p)).progression.offer)===JSON.stringify(offer),offer);
  const card=p.locator('[data-action^="growth-select:"][data-action$="'+route.evo+'"]');await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();
  check(label+' evolution has a usable touch target',box.width>=44&&box.height>=44,box);
  if(width===390&&quality==='标准')await p.screenshot({path:path.join(out,route.id+'-offer.png')});
  await choose(p,route.evo);await click(p,'pause');await click(p,'build');
  check(label+' owned build shows the correct evolution and repeated support',await p.getByText(route.name+' 已进阶',{exact:true}).count()===1,(await state(p)).progression.ranks);
  if(width===390&&quality==='标准')await p.screenshot({path:path.join(out,route.id+'-build.png')});
  await click(p,'close');await click(p,'end');await click(p,'confirm-end');await click(p,'start');const s=await state(p);
  check(label+' restart clears three routes and all burst counters',s.progression.level===1&&s.progression.routes.every(r=>!r.coreOwned)&&s.bursts.tailBursts===0&&s.bursts.openingBursts===0&&s.moveSpeed===180,s.progression);
  await ctx.close();
 }
 // Normal player build: only real keys, menu buttons and read-only diagnostics.
 // No injected XP, health, time, enemies or growth RNG. Follow whichever core appears.
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),p=await ctx.newPage();await boot(p,'http://127.0.0.1:8822/');
 const trace=[],deadline=Date.now()+210000;let held=[],latestLog=-20,route;
 const release=async()=>{for(const k of held)await p.keyboard.up(k);held=[];};
 while(Date.now()<deadline){const s=await state(p);if(s.result)break;
  if(s.progression.offer){await release();const offered=s.progression.offer.choices;
   if(!route)route=routes.find(r=>offered.includes(r.core));
   const priorities=route?[route.evo,route.core,...s.progression.routes.find(r=>r.id===route.id).supports,'L1_HEART','L1_MOVE']:['L1_DAMAGE','L1_RATE','L1_HEART'];
   const id=priorities.find(id=>offered.includes(id))||offered[0];trace.push({elapsed:s.elapsed,hp:s.hp,xp:s.progression.totalXP,choices:offered,chosen:id});
   await p.screenshot({path:path.join(out,'natural-choice-'+trace.length+'.png')});await choose(p,id);if(id===route?.evo)break;continue;}
  if(s.elapsed-latestLog>=20){console.log('NATURAL '+JSON.stringify({elapsed:s.elapsed,hp:s.hp,xp:s.progression.totalXP,kills:s.kills,route:route?.id}));latestLog=s.elapsed;}
  const orbs=s.pickups.orbs.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y));
  const goal=orbs[0]||{x:360+190*Math.cos(s.elapsed/9),y:720+280*Math.sin(s.elapsed/9)},enemy=s.targets.filter(t=>t.kind==='enemy');
  const dirs=[['d',1,0],['a',-1,0],['w',0,-1],['s',0,1],[['d','w'],.707,-.707],[['d','s'],.707,.707],[['a','w'],-.707,-.707],[['a','s'],-.707,.707]];let best;
  for(const [keys,dx,dy]of dirs){const q={x:s.player.x+dx*45,y:s.player.y+dy*45};let score=Math.hypot(q.x-goal.x,q.y-goal.y)*.06;
   if(q.x<26||q.x>694||q.y<30||q.y>1410)score+=1000;for(const e of enemy){const d=Math.hypot(q.x-e.x,q.y-e.y);score+=Math.max(0,65-d)**2*.04;}
   if(!best||score<best.score)best={score,keys:Array.isArray(keys)?keys:[keys]};}
  const next=Math.hypot(goal.x-s.player.x,goal.y-s.player.y)<6&&enemy.every(e=>Math.hypot(e.x-s.player.x,e.y-s.player.y)>65)?[]:best.keys;
  for(const k of held.filter(k=>!next.includes(k)))await p.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await p.keyboard.down(k);held=next;await p.waitForTimeout(90);
 }
 await release();const s=await state(p),evolved=!!route&&s.progression.routes.find(r=>r.id===route.id).evolved;
 fs.writeFileSync(path.join(out,'natural-route.json'),JSON.stringify({scope:'NORMAL_ENTRY_REAL_KILLS_PICKUP_AND_BUTTONS',route:route?.id,evolved,trace,final:s},null,2));
 check('normal player build reaches real pickup, choice and core',s.progression.totalXP>=8&&s.progression.routes.some(r=>r.coreOwned),{trace,hp:s.hp,elapsed:s.elapsed,evolved,result:s.result});
 check('normal player build has no fixture export',await p.evaluate(()=>typeof window.growthTestArena)==='undefined',true);
 if(!s.result&&!s.reasons.includes('menu'))await click(p,'pause');await p.screenshot({path:path.join(out,'natural-final.png')});await ctx.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'three-builds-browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),checks,pageErrors:errors},null,2));console.log('PASS three builds browser '+checks.length);
}catch(error){fs.writeFileSync(path.join(out,'three-builds-browser.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,checks,pageErrors:errors},null,2));console.error(error);process.exitCode=1;}finally{await browser?.close();for(const s of servers)s.kill();}})();
