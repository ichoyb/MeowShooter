// Local browser verification, not a platform/mobile acceptance result.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const root=path.resolve('..'),out=path.join(root,'.local/checks/terrain-material-pilot-20261031'),checks=[],errors=[];
const check=(name,pass,details)=>{checks.push({name,pass:!!pass,details});if(!pass)throw Error(name);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});let report;
try{
 for(const dpr of [1,2,3]){
  const context=await browser.newContext({viewport:{width:1180,height:1080},deviceScaleFactor:dpr});const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:8945/');await page.waitForFunction(()=>window.terrainReady);
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932]])for(const quality of ['standard','low']){
   const before=await page.evaluate(({width,height})=>{window.terrainSample.setSize(width,height);window.terrainSample.setCenter(337,722);return window.terrainSample.snapshot();},{width,height});
   const state=await page.evaluate(quality=>{window.terrainSample.setQuality(quality);return window.terrainSample.snapshot();},quality);
   const density=quality==='low'?1:Math.min(dpr,2);
   check(`matrix ${width}/${height}/DPR${dpr}/${quality}`,state.canvas.width===width*density&&state.canvas.height===height*density&&Math.abs(state.view.width-360)<1e-4&&Math.abs(state.view.x-before.view.x)<1e-4&&Math.abs(state.view.y-before.view.y)<1e-4,{before:before.view,state});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const raster=await page.evaluate(()=>window.terrainSample.snapshot());
   check('native intermediate raster keeps final density '+width+'/'+dpr+'/'+quality,raster.tilePixelSizes.every(size=>size.width===raster.canvas.width&&size.height===raster.canvas.height),{sizes:raster.tilePixelSizes,patternCacheRGBA:raster.patternCacheRGBA,tileSpriteCacheRGBA:raster.tileSpriteCacheRGBA,stage:raster.canvas});
   const coordinate=await page.evaluate(()=>{const scene=window.terrainScene,camera=scene.cameras.main;camera.preRender();const point=camera.getWorldPoint(0,0),r=camera.worldView;return {point:{x:point.x,y:point.y},view:{x:r.x,y:r.y},spriteWidth:scene.layers[0].width,canvasWidth:scene.game.canvas.width,tileScale:scene.layers[0].tileScaleX,zoom:camera.zoom};});
   check('native texture matches screen transform '+width+'/'+dpr+'/'+quality,Math.abs(coordinate.point.x-coordinate.view.x)<=1.001&&Math.abs(coordinate.point.y-coordinate.view.y)<=1.001&&coordinate.spriteWidth===coordinate.canvasWidth&&Math.abs(coordinate.tileScale/coordinate.zoom-96/252)<1e-6,coordinate);
  }
  if(dpr===2){
   await page.evaluate(()=>{window.terrainSample.setSize(390,844);window.terrainSample.setQuality('standard');window.terrainSample.setCenter(335,720);});
   for(const mode of ['new','old']){await page.locator('#'+mode).click();await pause(90);await page.locator('#stage').screenshot({path:path.join(out,mode+'-home-final.png')});}
   await page.locator('#new').click();await page.locator('#wall').click();await pause(90);await page.locator('#stage').screenshot({path:path.join(out,'new-wall-final.png')});
   await page.locator('#home').click();const baseline=await page.evaluate(()=>window.terrainSample.snapshot());
   await page.locator('#tour').click();await pause(400);const after=await page.evaluate(()=>window.terrainSample.snapshot());check('native camera patrol changes actual viewport',Math.abs(after.view.x-baseline.view.x)>1,after.view);
   await page.locator('#pause').click();const frozen=await page.evaluate(()=>window.terrainSample.snapshot());await pause(350);const frozenAfter=await page.evaluate(()=>window.terrainSample.snapshot());
   check('pause freezes patrol and existing cat animation',frozen.view.x===frozenAfter.view.x&&frozen.view.y===frozenAfter.view.y&&frozen.cat.bodyFrame===frozenAfter.cat.bodyFrame,{frozen,frozenAfter});
   await page.selectOption('#quality','low');let switched=await page.evaluate(()=>window.terrainSample.snapshot());check('quality while paused preserves view',Math.abs(switched.view.x-frozen.view.x)<1e-4&&Math.abs(switched.view.y-frozen.view.y)<1e-4,{before:frozen.view,after:switched.view});
   await page.locator('#pause').click();await page.locator('#home').click();const rect=await page.locator('#stage').boundingBox();
   const start=await page.evaluate(()=>window.terrainSample.snapshot());await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+65,rect.y+rect.height/2+80,{steps:10});await page.mouse.up();await pause(60);const moved=await page.evaluate(()=>window.terrainSample.snapshot());await pause(200);const stopped=await page.evaluate(()=>window.terrainSample.snapshot());
   check('drag moves camera and release stops with no owner',Math.abs(moved.view.x-start.view.x)>30&&!stopped.touch&&moved.view.x===stopped.view.x&&moved.view.y===stopped.view.y,{start:start.view,moved:moved.view,stopped:stopped.view});
   const stable=await page.evaluate(()=>{const before=window.terrainSample.snapshot();for(let i=0;i<20;i++){window.terrainSample.setMode(i%2?'old':'new');window.terrainSample.setQuality(i%2?'low':'standard');window.terrainSample.setCenter(180+(i%3)*180,450+(i%2)*500);}return {before,after:window.terrainSample.snapshot()};});
   check('20 switches allocate no new textures caches objects',stable.before.objects===stable.after.objects&&stable.before.cacheCreates===stable.after.cacheCreates&&JSON.stringify(stable.before.textureKeys)===JSON.stringify(stable.after.textureKeys),stable);
   const inventory=await page.evaluate(()=>{const scene=window.terrainScene;return {images:scene.images.map(image=>({path:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight,rgba:image.naturalWidth*image.naturalHeight*4})),mapCacheRGBA:scene.snapshot().cacheRGBA,newBackgroundObjects:scene.newObjects.length,newBackgroundHasPhysics:scene.newObjects.some(object=>!!object.body),newBackgroundHasInput:scene.newObjects.some(object=>!!object.input),maskCount:scene.masks.length,stageRGBA:scene.game.canvas.width*scene.game.canvas.height*4,patternCacheRGBA:scene.snapshot().patternCacheRGBA,tileSpriteCacheRGBA:scene.snapshot().tileSpriteCacheRGBA,tilePixelSizes:scene.snapshot().tilePixelSizes,extraRasterTextures:scene.textures.getTextureKeys().filter(key=>scene.textures.get(key).source[0]?.isCanvas)};});
   check('source dimensions budget and explicit native cache inventory',inventory.images.every(image=>image.width<=512&&image.height<=512)&&inventory.images.slice(0,2).reduce((n,image)=>n+image.rgba,0)===1572864&&!inventory.newBackgroundHasPhysics&&!inventory.newBackgroundHasInput&&inventory.extraRasterTextures.includes('old-map')&&inventory.extraRasterTextures.includes('material-pattern-0'),inventory);
   await page.evaluate(()=>{window.terrainSample.setMode('new');window.terrainSample.setQuality('standard');window.terrainSample.setCenter(335,720);});
   // Pixel coverage independent of screenshot aesthetics: ground must cover all
   // viewport interior. First broken camera-origin fixture exposed huge flat gaps.
   const coverage=await page.evaluate(()=>{const scene=window.terrainScene,c=scene.game.canvas,ctx=c.getContext('2d');const d=ctx.getImageData(0,0,c.width,c.height).data;let bg=0,total=0,maxRun=0,run=0;for(let y=5;y<c.height-5;y++){run=0;for(let x=5;x<c.width-5;x++){const i=(y*c.width+x)*4;total++;if(d[i]===185&&d[i+1]===206&&d[i+2]===112){bg++;run++;maxRun=Math.max(maxRun,run);}else run=0;}}return {bg,total,fraction:bg/total,maxRun};});
   check('no uncovered rectangular viewport region',coverage.fraction<.02&&coverage.maxRun<80,coverage);
   await page.screenshot({path:path.join(out,'preview-page.png'),fullPage:true});
  }
  check('no visible load error DPR'+dpr,(await page.locator('#error').textContent())==='',await page.locator('#error').textContent());await context.close();
 }
 check('no browser runtime exceptions',errors.length===0,errors);
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const protection=JSON.parse(fs.readFileSync(path.join(root,'.local/checks/art-clarity-package-20261031/inputs-before.json')));const changed=Object.entries(protection).filter(([file,hash])=>sha(path.join(root,file))!==hash).map(([file])=>file);
 check('300 previously frozen game inputs unchanged',Object.keys(protection).length===300&&changed.length===0,{count:Object.keys(protection).length,changed});
 const zip='D:/Projects/Cat-save-world/artifacts/art-clarity-playtest-20261031/cat-save-world-art-clarity-playtest-20261031.zip';check('previous delivered ZIP unchanged',sha(zip)==='fc994a4cfa4290b8aaa4f5ceec62b250c566f93c7483d7219e946795ebbfb410',{sha256:sha(zip)});
 report={status:'PASS',scope:'Independent material sample only; not normal game, phone, platform or performance acceptance',browser:browser.version(),date:'2026-10-31',checks,errors};
}catch(error){report={status:'FAIL',error:String(error),stack:error.stack,checks,errors};process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:checks.length,error:report.error}));}})();
