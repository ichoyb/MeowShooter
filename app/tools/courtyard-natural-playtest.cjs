// Browser-tool function. Actual normal entry and native keyboard input only;
// no Scene access, HP/time/spawn mutation, gameplay seed or speed override.
async (page) => {
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8875/');
 await page.waitForFunction(()=>document.getElementById('app').dataset.ready==='true');
 await page.locator('button[data-action="sound-enable"]').click();await page.locator('button[data-action="start"]').click();
 const r=globalThis.courtyardNaturalRun={status:'RUNNING',startedUtc:new Date().toISOString(),trace:[],firstSeen:{},bossPhases:{},samples:0,hold:false,keys:[],screenshots:[],errors:[],method:'Normal player entry; native keyboard walking reacts to actual enemy positions and visible warnings. Real pause/quality/resize checks may interrupt; no Scene/time/HP/spawn mutation.'};
 const began=Date.now();let busy=false,reviewedBoss=false,completed=false;
 // Browser-tool calls have separate JS globals. Page bindings preserve access
 // to this test record and hold control across those calls; never bundled.
 await page.exposeFunction('__courtyardNaturalReadV2',()=>JSON.parse(JSON.stringify(r)));
 await page.exposeFunction('__courtyardNaturalControlV2',async(action)=>{if(action==='resume'){r.hold=false;r.status='RUNNING';}else if(action==='stop')await r.stop();});
 page.on('pageerror',e=>r.errors.push(String(e)));
 const release=async()=>{for(const key of r.keys)await page.keyboard.up(key);r.keys=[];};
 const timer=setInterval(async()=>{
  if(busy||completed||r.hold)return;busy=true;
  try{
   const s=await page.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));r.samples++;
   for(const e of s.enemyBehaviors||[])if(!r.firstSeen[e.enemyId])r.firstSeen[e.enemyId]={elapsed:s.elapsed,id:e.id};
   if(s.boss)r.bossPhases[s.boss.phase]=(r.bossPhases[s.boss.phase]||0)+1;
   if(!r.trace.length||Math.floor(s.elapsed/5)!==Math.floor(r.trace[r.trace.length-1].elapsed/5)||s.result)r.trace.push({wallSeconds:(Date.now()-began)/1000,elapsed:s.elapsed,hp:s.hp,kills:s.kills,shots:s.shots,player:s.player,enemies:s.enemyBehaviors,boss:s.boss,enemyProjectiles:s.enemyProjectiles.length,view:s.view});
   if(s.result){
    completed=true;clearInterval(timer);await release();r.status='COMPLETE';r.result=s;r.wallSeconds=(Date.now()-began)/1000;
    r.audioAtFinish=await page.evaluate(()=>JSON.parse(document.getElementById('app').dataset.audio));r.resultText=await page.locator('#page-scroll').textContent();
    const file='D:/Projects/Cat-save-world/.local/worktrees/courtyard-combat-local/.local/checks/elite-boss-local/natural-result.png';await page.screenshot({path:file});r.screenshots.push(file);return;
   }
   if(Date.now()-began>390000){completed=true;clearInterval(timer);await release();r.status='TIME_LIMIT';return;}
   if(s.boss&&!reviewedBoss&&s.boss.phase!=='arriving'){
    reviewedBoss=true;r.hold=true;await release();await page.locator('button[data-action="pause"]').click();r.status='BOSS_PAUSED_FOR_UI';r.bossPause=await page.evaluate(()=>JSON.parse(document.getElementById('app').dataset.state));
    const file='D:/Projects/Cat-save-world/.local/worktrees/courtyard-combat-local/.local/checks/elite-boss-local/natural-boss.png';await page.screenshot({path:file});r.screenshots.push(file);return;
   }
   if(s.engine.paused){r.status='UNEXPECTED_PAUSE';r.hold=true;r.pause=s;await release();return;}
   const targets=s.targets.filter(t=>t.kind==='enemy'),special=s.boss?targets.find(t=>t.id===s.boss.id):targets.find(t=>s.enemyBehaviors.some(e=>e.id===t.id&&e.enemyId==='EL01'));
   const center=special||{x:360,y:720},dx=s.player.x-center.x,dy=s.player.y-center.y,d=Math.max(1,Math.hypot(dx,dy)),desired=special?170:180;
   let vx=-dy/d*.65+dx/d*(desired-d)*.025,vy=dx/d*.65+dy/d*(desired-d)*.025;
   for(const target of targets){const x=s.player.x-target.x,y=s.player.y-target.y,n=Math.max(1,Math.hypot(x,y));if(n<140){vx+=x/n*(140-n)/35;vy+=y/n*(140-n)/35;}
    const e=s.enemyBehaviors.find(e=>e.id===target.id);if(n<280&&e&&(e.phase==='warning'||e.phase==='dash')&&e.enemyId!=='E04'){const tx=-y/n,ty=x/n,side=tx*(360-s.player.x)+ty*(720-s.player.y)>=0?1:-1;vx+=tx*side*2;vy+=ty*side*2;}}
   if(s.player.x<60)vx+=2;if(s.player.x>660)vx-=2;if(s.player.y<60)vy+=2;if(s.player.y>1380)vy-=2;
   const keys=[];if(vx>.2)keys.push('KeyD');if(vx<-.2)keys.push('KeyA');if(vy>.2)keys.push('KeyS');if(vy<-.2)keys.push('KeyW');
   if(JSON.stringify(keys)!==JSON.stringify(r.keys)){await release();for(const key of keys)await page.keyboard.down(key);r.keys=keys;}
  }catch(error){r.errors.push(String(error));r.status='ERROR';completed=true;clearInterval(timer);await release();}
  finally{busy=false;}
 },150);
 r.stop=async()=>{completed=true;clearInterval(timer);await release();};
 return {status:r.status,method:r.method,duration:300};
}
