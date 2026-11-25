const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.GROWTH_CHECK_DIR||path.join(root,'.local/checks/barrage-build-20261024'));
const checks=[],errors=[],servers=[];let browser;
const state=p=>p.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
const click=(p,id)=>p.locator('button[data-action="'+id+'"]:visible').last().click();
async function serve(dir,port){const child=spawn(process.execPath,[path.join(root,'app/tools/serve.mjs')],{cwd:path.join(root,'app'),env:{...process.env,APP_DIST:dir,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});servers.push(child);await new Promise((r,j)=>{child.stdout.once('data',r);child.once('error',j);child.once('exit',c=>j(Error('server '+c)));});}
async function boot(p,url){p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');if(await p.locator('[data-action="sound-enable"]').count()){await click(p,'sound-enable');await p.waitForFunction(()=>JSON.parse(document.getElementById('app').dataset.audio).ready);}await click(p,'start');}
async function choose(p,id){await p.locator('[data-action^="growth-select:"][data-action$="'+id+'"]').click();await p.locator('.growth-confirm button').click();}
function check(name,ok,value){assert(ok,name);checks.push({name,status:'PASS',value});console.log('PASS '+name);}
(async()=>{try{
 await serve(path.join(out,'fixture'),8816);await serve(path.join(out,'preview'),8817);browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['标准','低']){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true}),p=await ctx.newPage();await boot(p,'http://127.0.0.1:8816/ui.html');
  await p.evaluate(()=>{window.growthTestArena.growth.random=()=>0;window.growthTestArena.growth.collect(40);});await p.waitForSelector('.growth-choice');
  check(width+quality+' first menu offers a real new ability',await p.locator('.growth-card.core').count()===1,(await state(p)).progression.offer);
  await choose(p,'L1_SPLIT');await choose(p,'L1_DAMAGE');await choose(p,'L1_RATE');
  let s=await state(p);check(width+quality+' core and two supports unlock but do not auto-grant evolution',s.progression.barrage.eligible&&!s.progression.ranks.L1_EVO_BARRAGE,s.progression);
  await p.evaluate(()=>window.growthTestArena.growth.collect(26));await p.locator('.growth-card.evolution').waitFor();
  const offer=(await state(p)).progression.offer;await click(p,'growth-detail:L1_EVO_BARRAGE');await p.getByText('可进阶',{exact:false}).waitFor();await click(p,'close');
  await click(p,'settings');await p.selectOption('#quality',quality);await click(p,'close');
  check(width+quality+' detail and quality keep evolution offer frozen',JSON.stringify((await state(p)).progression.offer)===JSON.stringify(offer),(await state(p)).engine.quality);
  const card=p.locator('[data-action^="growth-select:"][data-action$="L1_EVO_BARRAGE"]');await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();check(width+quality+' evolution is readable and clickable',box.width>=44&&box.height>=44,box);
  if(width===390&&quality==='标准')await p.screenshot({path:path.join(out,'evolution-offer.png')});
  await choose(p,'L1_DAMAGE');await p.evaluate(()=>window.growthTestArena.growth.collect(35));await p.locator('.growth-card.evolution').waitFor();
  check(width+quality+' declining evolution preserves next offer eligibility',(await state(p)).progression.barrage.eligible,(await state(p)).progression.offer);
  await choose(p,'L1_EVO_BARRAGE');await p.evaluate(()=>window.growthTestArena.growth.collect(101));await p.waitForSelector('.growth-choice');await choose(p,'L1_DAMAGE');
  const text=await p.locator('[data-action^="growth-select:"][data-action$="L1_DAMAGE"]').textContent();check(width+quality+' fourth attribute purchase is offered with useful values',text.includes('第4次')&&!text.includes('/3'),text);await choose(p,'L1_DAMAGE');
  await click(p,'pause');await click(p,'build');check(width+quality+' build shows evolved route and cumulative repeatable bonus',await p.getByText('响亮铃声 已选4次',{exact:true}).count()===1&&await p.getByText('彗星弹幕 已进阶',{exact:true}).count()===1,(await state(p)).progression.ranks);
  if(width===390&&quality==='标准')await p.screenshot({path:path.join(out,'evolved-build.png')});
  await click(p,'close');await click(p,'end');await click(p,'confirm-end');await click(p,'start');s=await state(p);
  check(width+quality+' restart clears core, evolution and all stacks',s.progression.level===1&&!s.progression.barrage.coreOwned&&!s.progression.barrage.evolved&&s.progression.ranks.L1_DAMAGE===0,s.progression);
  await ctx.close();
 }
 // Actual player build: only keys/buttons and read-only diagnostics, no XP,
 // enemy, time, scene or health mutation. This is not the controlled UI case.
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),p=await ctx.newPage();await boot(p,'http://127.0.0.1:8817/');
 const trace=[],deadline=Date.now()+180000;let held=[],latestLog=-20;
 const release=async()=>{for(const k of held)await p.keyboard.up(k);held=[];};
 while(Date.now()<deadline){
  const s=await state(p);if(s.result)break;
  if(s.progression.offer){
   await release();const id=['L1_EVO_BARRAGE','L1_SPLIT','L1_DAMAGE','L1_RATE','L1_HEART'].find(id=>s.progression.offer.choices.includes(id));
   trace.push({elapsed:s.elapsed,hp:s.hp,level:s.progression.level,choices:s.progression.offer.choices,chosen:id});
   if(id==='L1_SPLIT')await p.screenshot({path:path.join(out,'natural-core.png')});
   if(id==='L1_EVO_BARRAGE')await p.screenshot({path:path.join(out,'natural-evolution.png')});
   await choose(p,id);if(id==='L1_EVO_BARRAGE')break;continue;
  }
  if(s.elapsed-latestLog>=20){console.log('NATURAL '+JSON.stringify({elapsed:s.elapsed,hp:s.hp,xp:s.progression.totalXP,kills:s.kills}));latestLog=s.elapsed;}
  const orbs=s.pickups.orbs.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y));
  const goal=orbs[0]||{x:360+190*Math.cos(s.elapsed/9),y:720+280*Math.sin(s.elapsed/9)};
  const enemy=s.targets.filter(t=>t.kind==='enemy'),dirs=[['d',1,0],['a',-1,0],['w',0,-1],['s',0,1],[['d','w'],.707,-.707],[['d','s'],.707,.707],[['a','w'],-.707,-.707],[['a','s'],-.707,.707]];
  let best=null;
  for(const [keys,dx,dy]of dirs){const q={x:s.player.x+dx*45,y:s.player.y+dy*45};let score=Math.hypot(q.x-goal.x,q.y-goal.y)*.06;
   if(q.x<26||q.x>694||q.y<30||q.y>1410)score+=1000;
   for(const e of enemy){const d=Math.hypot(q.x-e.x,q.y-e.y);score+=Math.max(0,65-d)**2*.04;}
   if(!best||score<best.score)best={score,keys:Array.isArray(keys)?keys:[keys]};
  }
  const next=Math.hypot(goal.x-s.player.x,goal.y-s.player.y)<6&&enemy.every(e=>Math.hypot(e.x-s.player.x,e.y-s.player.y)>65)?[]:best.keys;
  for(const k of held.filter(k=>!next.includes(k)))await p.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await p.keyboard.down(k);held=next;await p.waitForTimeout(90);
 }
 await release();let s=await state(p);fs.writeFileSync(path.join(out,'natural-route.json'),JSON.stringify({scope:'NORMAL_ENTRY_REAL_KILLS_PICKUP_AND_BUTTONS',trace,final:s},null,2));
 check('normal entry reaches full evolution through real XP pickups',s.progression.barrage.evolved&&!s.result&&s.progression.totalXP>=66,{trace,hp:s.hp,elapsed:s.elapsed});
 check('normal entry has no fixture export',await p.evaluate(()=>typeof window.growthTestArena)==='undefined',true);
 const shots=s.shots,primary=s.sourceCounts.PRIMARY;
 await p.waitForFunction(old=>{const s=JSON.parse(document.getElementById('app').dataset.state);return s.shots>old;},shots,{timeout:10000});s=await state(p);
 check('natural evolved volley adds three real primary shots',s.sourceCounts.PRIMARY-primary===3,{shots:s.shots,primary:s.sourceCounts.PRIMARY-primary});
 await click(p,'pause');await p.screenshot({path:path.join(out,'natural-evolved-combat.png')});await ctx.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'barrage-browser.json'),JSON.stringify({status:'PASS',browser:browser.version(),checks,pageErrors:errors},null,2));
 console.log('PASS barrage browser '+checks.length);
}catch(error){fs.writeFileSync(path.join(out,'barrage-browser.json'),JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,checks,pageErrors:errors},null,2));console.error(error);process.exitCode=1;}finally{await browser?.close();for(const s of servers)s.kill();}})();
