// Isolated scenery regression; current normal-Arena matrix lives in r1-map.ts.
import type Phaser from 'phaser';
import Runtime from '../../src/phaser-entry.cjs';
import {CourtyardScenery} from '../../src/courtyard-scenery';
const P=Runtime as typeof Phaser,w=window as any,checks:any[]=[];
const check=(name:string,ok:unknown,observed:unknown)=>{checks.push({name,status:ok?'PASS':'FAIL',observed});if(!ok)throw Error(name);};
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
Promise.all([... [0,1].map(i=>'./assets/r1-restoration/map/map-0-'+i+'.png'),'./assets/r1-restoration/courtyard-detail-v01.png'].map(load)).then(sources=>{
 class Fixture extends P.Scene {
  create():void {
   const camera=this.cameras.main;camera.setZoom(.5).centerOn(360,720);camera.preRender();
   const scenery=new CourtyardScenery(this,camera,sources.slice(0,2),sources[2]),cache=(scenery as any).cache;
   w.t1SetQuality=(quality:'standard'|'low')=>{scenery.layout(true,quality,{top:0,bottom:1440},1440);camera.preRender();this.game.renderer.preRender();this.game.scene.render(this.game.renderer);this.game.renderer.postRender();};
   try{
    w.t1SetQuality('standard');const before=scenery.snapshot(),count=this.children.length,keys=this.textures.getTextureKeys();
    check('C keeps complete base and four separate native detail images',before.visualRevision==='courtyard-background-c-v01'&&before.artImages===5&&before.mapCache.stitchCount===2&&before.mapCache.refreshCount===1,before);
    check('scenery is decorative and keeps720x1440 playable world',before.worldWidth===720&&before.worldHeight===1440&&this.physics.world.bodies.size===0&&this.children.getChildren().every(object=>!(object as any).input),before);
    for(let i=0;i<100;i++){w.t1SetQuality(i%2?'standard':'low');camera.centerOn(360,i%2?300:1100);camera.preRender();scenery.syncCamera();}
    check('100 quality and camera switches retain texture set and2 source copies',this.children.length===count&&JSON.stringify(this.textures.getTextureKeys())===JSON.stringify(keys)&&(scenery as any).cache===cache&&scenery.snapshot().mapCache.stitchCount===2,scenery.snapshot());
    scenery.layout(false,'standard',{top:0,bottom:1440},1440);check('disabled scenery hides its map and shadow',this.children.getChildren().every(object=>!(object as any).visible),scenery.snapshot());
    camera.centerOn(360,720);w.t1SetQuality('standard');w.t1Scenery=scenery;w.t1Result={status:'PASS',checks,scope:'Real Phaser isolated scenery; not normal gameplay or phone acceptance'};
   }catch(error){w.t1Result={status:'FAIL',error:String(error),checks};}
   document.getElementById('result')!.textContent=JSON.stringify(w.t1Result,null,2);
  }
 }
 w.t1Game=new P.Game({type:P.CANVAS,width:360,height:720,parent:'stage',backgroundColor:'#dbe7c0',audio:{noAudio:true},physics:{default:'arcade',arcade:{debug:false}},scene:Fixture,banner:false});
}).catch(error=>{w.t1Result={status:'ERROR',error:String(error)};});
