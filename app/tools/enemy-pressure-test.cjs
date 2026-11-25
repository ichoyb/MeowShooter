const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.PRESSURE_CHECK_DIR||path.join(root,'.local/checks/enemy-pressure-20261024'));
(async()=>{let browser;const errors=[],s=spawn(process.execPath,['tools/serve.mjs'],{cwd:path.join(root,'app'),env:{...process.env,APP_DIST:path.join(out,'fixture'),PORT:'8831'},windowsHide:true,stdio:['ignore','pipe','pipe']});try{
 await new Promise((resolve,reject)=>{s.stdout.once('data',resolve);s.once('error',reject);s.once('exit',c=>reject(Error('server '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:390,height:900}});p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:8831/checks.html');await p.waitForFunction(()=>window.sliceFixture||document.getElementById('result').textContent.includes('Error'));
 const names=(process.env.PRESSURE_SUITES||'runEnemyPressureChecks').split(','),results=[];
 for(const name of names){const value=await p.evaluate(n=>window[n](),name);results.push({name,...value});}
 const result=results.length===1?results[0]:{status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',suites:results};result.browser=browser.version();result.pageErrors=errors;
 if(errors.length)result.status='FAIL';fs.writeFileSync(path.join(out,process.env.PRESSURE_RESULT||'d1-scene.json'),JSON.stringify(result,null,2));
 // Render the real controlled Scene through Phaser's normal renderer; a slept
 // loop otherwise leaves a black canvas even when all physical checks ran.
 for(const half of [false,true]){
  await p.evaluate(half=>{const {a,battle,g,start,step,position}=window.sliceFixture;start();a.spawns.take=()=>null;a.fireVolley=()=>{};a.cameras.main.stopFollow();position(a.cat,500,720);const b=a.placeSliceEnemy('B01',300,720);b.setData('hp',half?battle.snapshot().boss.maxHp*.5:10000);b.getData('behavior').until=0;step(40);g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();},half);
  await p.locator('#stage').screenshot({path:path.join(out,half?'d1-scatter-two-round.png':'d1-scatter-one-round.png')});
 }
 console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
 }catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();s.kill();}})();
