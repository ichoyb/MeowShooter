import Phaser from 'phaser';
import {Cat01Presentation} from '../../src/cat01-presentation';
import body0 from '../../src/r1-art/cat01-body-0.json';
import body1 from '../../src/r1-art/cat01-body-1.json';
import weapon from '../../src/r1-art/cat01-weapon.json';
import grip from '../../src/r1-art/cat01-grip.json';
import head from '../../src/r1-art/cat01-head.json';
const w=window as any,stage=document.getElementById('stage')!,status=document.getElementById('status')!;
const loadImage=(path:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片加载失败：'+path));image.src=path;});
const sourceNames=['terrain-v01.png','props-v01.png','old/orange-body.png','old/orange-parts.png','old/map/map-0-0.png','old/map/map-0-1.png','old/map/map-overscan.png','old/courtyard-detail-v01.png'];
const state={quality:'standard',mode:'new',tour:false,paused:false,center:{x:335,y:720},width:390,height:844};
const W=720,H=1440,CELL=96;
let game:Phaser.Game,scene:MaterialScene;
class MaterialScene extends Phaser.Scene{
 art!:Cat01Presentation;newObjects:Phaser.GameObjects.GameObject[]=[];oldObjects:Phaser.GameObjects.GameObject[]=[];
 layers:Phaser.GameObjects.TileSprite[]=[];patterns:Phaser.Textures.CanvasTexture[]=[];masks:Phaser.Display.Masks.GeometryMask[]=[];
 tick=0;touch:{id:number,x:number,y:number,cx:number,cy:number}|null=null;cacheCreates=0;
 constructor(private images:HTMLImageElement[]){super('material-pilot');}
 create(){
  sourceNames.forEach((name,i)=>this.textures.addImage(name,this.images[i]));
  this.textures.addAtlasJSONArray('cat01-body-0',this.images[2],body0);this.textures.addAtlasJSONArray('cat01-body-1',this.images[2],body1);
  this.textures.addAtlasJSONArray('cat01-weapon',this.images[3],weapon);this.textures.addAtlasJSONArray('cat01-grip',this.images[3],grip);this.textures.addAtlasJSONArray('cat01-head',this.images[3],head);
  this.makePatterns();const ground=this.makeTiles(0).setAlpha(.22);this.newObjects.push(ground);
  // Native geometry masks expose a textured road, not a painted flat polygon.
  for(const [extra,alpha] of [[0,1]]){
   const layer=this.makeTiles(1).setAlpha(alpha),shape=this.make.graphics({x:0,y:0});shape.fillStyle(0xffffff).beginPath();
   const edge=(y:number,side:number)=>this.roadX(y)+side*(43+extra+2.3*Math.sin(y*.21)+1.1*Math.sin(y*.67));
   shape.moveTo(edge(-24,-1),-24);for(let y=-24;y<=H+24;y+=4)shape.lineTo(edge(y,-1),y);for(let y=H+24;y>=-24;y-=4)shape.lineTo(edge(y,1),y);shape.closePath().fillPath();
   const mask=shape.createGeometryMask();layer.setMask(mask);this.masks.push(mask);this.newObjects.push(layer);
  }
  const atlas=this.textures.get('props-v01.png');atlas.add('wall',0,0,45,512,190);atlas.add('flowers',0,8,244,264,228);atlas.add('shrub',0,270,242,240,238);
  this.prop('wall',180,315,182,190/512*182);
  this.prop('flowers',253,645,77,228/264*77);this.prop('shrub',491,813,68,238/240*68);
  this.prop('flowers',451,1041,55,228/264*55);this.prop('shrub',184,1100,59,238/240*59);
  this.prop('shrub',101,406,63,238/240*63);this.prop('flowers',530,439,64,228/264*64);
  const cache=this.textures.createCanvas('old-map',408,1020)!;cache.context.drawImage(this.images[4],0,0);cache.context.drawImage(this.images[5],0,512);cache.refresh();this.cacheCreates++;
  this.oldObjects.push(this.add.image(-152,-304,'old/map/map-overscan.png').setOrigin(0).setDisplaySize(1024,2048));
  this.oldObjects.push(this.add.image(0,-256,'old-map').setOrigin(0).setDisplaySize(720,1800));
  const oldAtlas=this.textures.get('old/courtyard-detail-v01.png');const points=[[140,300],[660,700],[160,1245],[650,1450]],widths=[192,96,192,106];
  points.forEach(([x,y],i)=>{oldAtlas.add('detail'+i,0,i%2*192,Math.floor(i/2)*160,widths[i],160);this.oldObjects.push(this.add.image(-152+x*1024/887,-304+y*1024/887,'old/courtyard-detail-v01.png','detail'+i).setOrigin(0).setScale(1024/887));});
  this.art=new Cat01Presentation(this,null);this.art.reset(true,36);this.art.sync({x:336,y:785},false,0,{x:1,y:0});
  this.newObjects.forEach(object=>(object as any).setDepth(-5));this.oldObjects.forEach(object=>(object as any).setDepth(-5));
  this.setMode('new');this.layout();
  const input=game.canvas;
  input.addEventListener('pointerdown',event=>{if(state.paused)return;this.touch={id:event.pointerId,x:event.clientX,y:event.clientY,cx:state.center.x,cy:state.center.y};input.setPointerCapture(event.pointerId);state.tour=false;syncControls();});
  input.addEventListener('pointermove',event=>{if(!this.touch||this.touch.id!==event.pointerId)return;const rect=input.getBoundingClientRect();state.center.x=this.touch.cx-(event.clientX-this.touch.x)*360/rect.width;state.center.y=this.touch.cy-(event.clientY-this.touch.y)*360/rect.width;this.cameraPosition();});
  const release=(event:PointerEvent)=>{if(this.touch?.id===event.pointerId)this.touch=null;};input.addEventListener('pointerup',release);input.addEventListener('pointercancel',release);input.addEventListener('lostpointercapture',release);
  w.terrainSample={snapshot:()=>this.snapshot(),setCenter:(x:number,y:number)=>{state.center={x,y};this.cameraPosition();},setQuality:(quality:string)=>{state.quality=quality;this.layout();},setMode:(mode:string)=>this.setMode(mode),setSize:(width:number,height:number)=>setSize(width,height),setPaused:(paused:boolean)=>setPaused(paused),setTour:(tour:boolean)=>{state.tour=tour;syncControls();}};
  w.terrainScene=this;w.terrainReady=true;
 }
 roadX(y:number){return 365+115*Math.sin((y-340)/240);}
 makePatterns(){
  for(let index=0;index<2;index++){
   const pattern=this.textures.createCanvas('material-pattern-'+index,504,504)!,ctx=pattern.context;
   // Technical mirror-repeat cache, identical source detail, not generated art.
   for(let y=0;y<2;y++)for(let x=0;x<2;x++){ctx.save();ctx.translate(x?504:0,y?504:0);ctx.scale(x?-1:1,y?-1:1);ctx.drawImage(this.images[0],index*256+2,2,252,252,0,0,252,252);ctx.restore();}
   pattern.refresh();this.patterns.push(pattern);
  }
 }
 makeTiles(index:number){
  const layer=this.add.tileSprite(0,0,390,844,'material-pattern-'+index).setOrigin(0);this.layers.push(layer);return layer;
 }
 prop(frame:string,x:number,y:number,width:number,height:number){
  const shadow=this.add.graphics().fillStyle(0x355332,.12).fillEllipse(x+4,y+height*.38,width*.82,height*.22);this.newObjects.push(shadow);
  this.newObjects.push(this.add.image(x,y,'props-v01.png',frame).setDisplaySize(width,height));
 }
 setMode(mode:string){state.mode=mode;this.newObjects.forEach(object=>(object as any).setVisible(mode==='new'));this.oldObjects.forEach(object=>(object as any).setVisible(mode==='old'));syncControls();}
 layout(){if(!this.cameras?.main)return;const rect=stage.getBoundingClientRect(),density=state.quality==='standard'?Math.min(Math.max(devicePixelRatio,1),2):1;const width=Math.round(rect.width*density),height=Math.round(rect.height*density);game.scale.resize(width,height);this.cameras.main.setOrigin(.5,.5).setViewport(0,0,width,height).setZoom(width/360);this.cameraPosition();}
 cameraPosition(){const camera=this.cameras.main,viewH=camera.height/camera.zoom;state.center.x=Phaser.Math.Clamp(state.center.x,180,W-180);state.center.y=Phaser.Math.Clamp(state.center.y,viewH/2,H-viewH/2);camera.centerOn(state.center.x,state.center.y);camera.preRender();
  const top=camera.getWorldPoint(0,0),materialScale=CELL/252;
  for(const layer of this.layers){
   // TileSprite's intermediate canvas uses final render pixels, not360 logical
   // pixels. This avoids reintroducing the original low-density raster bug.
   layer.setPosition(top.x,top.y).setSize(camera.width,camera.height).setScale(1/camera.zoom).setTileScale(materialScale*camera.zoom).setTilePosition(top.x/materialScale,top.y/materialScale);
  }
 }
 update(_time:number,delta:number){if(state.paused)return;if(state.tour){this.tick+=Math.min(delta,60);state.center.x=360+140*Math.sin(this.tick/7300);state.center.y=720+280*Math.sin(this.tick/10200);this.cameraPosition();}this.art?.sync({x:336,y:785},false,0,{x:1,y:0});if(this.art)status.textContent=(state.mode==='new'?'新材质':'当前背景')+' · '+Math.round(stage.clientWidth)+' CSS px · Canvas '+game.canvas.width+'×'+game.canvas.height+' · 360u视野';}
 snapshot(){return {state:JSON.parse(JSON.stringify(state)),css:{width:stage.clientWidth,height:stage.clientHeight},canvas:{width:game.canvas.width,height:game.canvas.height},dpr:devicePixelRatio,view:{x:this.cameras.main.getWorldPoint(0,0).x,y:this.cameras.main.getWorldPoint(0,0).y,width:this.cameras.main.width/this.cameras.main.zoom,height:this.cameras.main.height/this.cameras.main.zoom},objects:this.children.length,tileSprites:this.layers.length,patterns:this.patterns.length,patternCacheRGBA:this.patterns.reduce((n,t)=>n+t.canvas!.width*t.canvas!.height*8,0),tileSpriteCacheRGBA:this.layers.reduce((n,t)=>n+(t.canvas!.width*t.canvas!.height+t.fillCanvas.width*t.fillCanvas.height)*4,0),tilePixelSizes:this.layers.map(t=>({width:t.canvas!.width,height:t.canvas!.height,scale:t.scaleX,tileScale:t.tileScaleX})),maskCount:this.masks.length,cacheCreates:this.cacheCreates,cacheRGBA:408*1020*4*2,textureKeys:this.textures.getTextureKeys(),cat:this.art.snapshot(),touch:!!this.touch,backgroundRGBA:1572864};}
}
function syncControls(){for(const id of ['new','old'])document.getElementById(id)!.setAttribute('aria-pressed',String(state.mode===id));document.getElementById('tour')!.setAttribute('aria-pressed',String(state.tour));document.getElementById('pause')!.setAttribute('aria-pressed',String(state.paused));document.getElementById('pause')!.textContent=state.paused?'继续':'暂停';}
function setPaused(paused:boolean){state.paused=paused;if(scene){scene.touch=null;if(paused)game.scene.pause('material-pilot');else game.scene.resume('material-pilot');}syncControls();}
function setSize(width:number,height:number){state.width=width;state.height=height;const actualWidth=Math.min(width,window.innerWidth-20);stage.style.width=actualWidth+'px';stage.style.height=Math.round(height*actualWidth/width)+'px';(stage.parentElement as HTMLElement).style.width=actualWidth+'px';scene?.layout();}
Promise.all(sourceNames.map(name=>loadImage('./assets/'+name))).then(images=>{scene=new MaterialScene(images);game=new Phaser.Game({type:Phaser.CANVAS,parent:stage,width:390,height:844,backgroundColor:'#b9ce70',scale:{mode:Phaser.Scale.NONE,autoCenter:Phaser.Scale.NO_CENTER},render:{antialias:true,pixelArt:false,roundPixels:false},audio:{noAudio:true},scene});
 for(const id of ['new','old'])document.getElementById(id)!.onclick=()=>scene.setMode(id);
 document.getElementById('tour')!.onclick=()=>{state.tour=!state.tour;syncControls();};document.getElementById('pause')!.onclick=()=>setPaused(!state.paused);
 document.getElementById('home')!.onclick=()=>{state.tour=false;state.center={x:335,y:720};scene.cameraPosition();syncControls();};document.getElementById('wall')!.onclick=()=>{state.tour=false;state.center={x:230,y:400};scene.cameraPosition();syncControls();};
 document.getElementById('quality')!.onchange=event=>{state.quality=(event.target as HTMLSelectElement).value;scene.layout();};document.getElementById('size')!.onchange=event=>{const [width,height]=(event.target as HTMLSelectElement).value.split(',').map(Number);setSize(width,height);};
 window.addEventListener('resize',()=>setSize(state.width,state.height));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true);});setSize(390,844);
}).catch(error=>{document.getElementById('error')!.textContent=String(error);w.terrainError=String(error);});
