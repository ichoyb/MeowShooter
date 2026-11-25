import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const AnimationManager=require('phaser/src/animations/AnimationManager');
const AnimationState=require('phaser/src/animations/AnimationState');
const TweenManager=require('phaser/src/tweens/TweenManager');
const Emitter=require('eventemitter3');
const Texture=require('phaser/src/textures/Texture');
const ParseAtlas=require('phaser/src/textures/parsers/JSONArray');
class Canvas {getContext(){return {drawImage(){},save(){},restore(){},translate(){},beginPath(){},rect(){},clip(){},clearRect(){},lineTo(){},moveTo(){},closePath(){},fill(){}};}}
globalThis.HTMLCanvasElement=Canvas;globalThis.window={};
const compiled=await build({entryPoints:['src/g6-held-walk.ts'],bundle:true,write:false,format:'iife',globalName:'G6'});
const scope={document:{createElement:()=>new Canvas()}};runInNewContext(compiled.outputFiles[0].text,scope);

function rig(cat='CAT02'){
 const textures=new Map(),sprites=[];
 const manager={get:key=>textures.get(key),getFrame:(key,frame)=>textures.get(key)?.get(frame),exists:key=>textures.has(key),
  create(key,image){const texture=new Texture(manager,key,image);textures.set(key,texture);return texture;},
  remove(key){textures.get(key)?.destroy();textures.delete(key);},removeKey(key){textures.delete(key);},
  addAtlasJSONArray(key,_image,data){const texture=this.create(key,{width:data.meta.size.w,height:data.meta.size.h});ParseAtlas(texture,0,data);return texture;}};
 const game={events:new Emitter(),textures:manager,renderer:null,config:{antialias:true}};manager.game=game;
 const anims=new AnimationManager(game);game.events.emit('boot');
 const scene={sys:{events:new Emitter(),textures:manager,anims},anims,textures:manager};
 class Sprite extends Emitter{
  constructor(x,y,key,frame){super();this.scene=scene;this.x=x;this.y=y;this.anims=new AnimationState(this);this.setTexture(key,frame);this.flipX=false;this.visible=true;this.active=true;}
  setTexture(key,frame){this.texture=manager.get(key);return this.setFrame(frame);}setFrame(frame){this.frame=typeof frame==='object'?frame:this.texture.get(frame);return this;}
  setSizeToFrame(){return this;}setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;}setDepth(v){this.depth=v;return this;}setVisible(v){this.visible=v;return this;}setPosition(x,y){this.x=x;this.y=y;return this;}setFlipX(v){this.flipX=v;return this;}setOrigin(x,y){this.originX=x;this.originY=y;return this;}setRotation(value){this.rotation=value;return this;}
  play(key){this.anims.play(key);return this;}stop(){this.anims.stop();return this;}destroy(){this.anims.destroy();this.anims=undefined;this.removeAllListeners();this.active=false;}
 }
 scene.add={sprite(x,y,key,frame){const sprite=new Sprite(x,y,key,frame);sprites.push(sprite);return sprite;}};
 scene.tweens=new TweenManager(scene);scene.sys.events.emit('boot');scene.sys.events.emit('start');
 scope.G6.registerG6HeldWalkTextures(scene,{CAT02:{},CAT03:{}});
 for(const [id,x,y,w,h]of[['CAT02',69,17,305,352],['CAT03',76,16,291,355]]){const t=manager.create(id,{width:w,height:h});t.add('body',0,0,0,w,h).setTrim(384,384,x,y,w,h);const hh=id==='CAT02'?178:208;t.add('h1-head',0,0,0,w,hh-y).setTrim(384,hh,x,y,w,hh-y);}
 const original=new Sprite(180,200,cat,'body').setDepth(3).setDisplaySize(42,42);
 const head=new Sprite(180,179,cat,'h1-head');
 const offset={x:0,y:0};const held={objects:()=>[original,null,null,head],setGaitOffset(next){original.setPosition(original.x+next.x-offset.x,original.y+next.y-offset.y);Object.assign(offset,next);}};
 const art=new scope.G6.G6HeldWalk(scene,held,{CAT02:160,CAT03:200});art.reset(true,cat,42);
 let time=0;
 const advance=ms=>{for(let left=ms;left>0;left-=10){const step=Math.min(left,10);time+=step;scene.tweens.startTime-=step;scene.tweens.tick();for(const s of sprites)if(s.active)s.anims.update(time,step);}};
 const sync=(moved,speed=cat==='CAT02'?160:200,dx=1)=>{if(moved&&dx)original.setFlipX(dx>0);art.sync({moved,actualSpeed:speed,horizontalDisplacement:dx});};
 const cleanup=()=>{art.destroy();original.destroy();head.destroy();scene.tweens.destroy();anims.destroy();};
 return {art,original,head,offset,scene,sprites,advance,sync,cleanup};
}

for(const cat of ['CAT02','CAT03']){
 test(cat+' adds one isolated scarf Sprite and restores original textures after stopping',()=>{
  const r=rig(cat);r.sync(true);r.advance(150);r.sync(true);
  assert.equal(r.art.objects().length,2,'native paw and scarf render objects');
  assert.equal(r.art.snapshot().scarfVisible,true);
  assert.ok(Math.abs(r.art.snapshot().scarfRotation)>.001);
  assert(r.original.frame instanceof require('phaser/src/textures/Frame'));
  assert.equal(r.original.frame.texture,r.original.texture);
  assert.equal(r.head.frame.texture,r.head.texture);
  assert.notEqual(r.original.texture.key,cat);
  r.sync(false);r.advance(120);
  assert.equal(r.original.texture.key,cat);assert.equal(r.original.frame.name,'body');
  assert.equal(r.art.snapshot().scarfVisible,false);r.cleanup();
 });
 test(cat+' prepares the masked source before impact and restores the exact native body/head frames even if preparation fails',()=>{
  const r=rig(cat),body=r.original.frame,head=r.head.frame;let prepared;
  r.art.prepareImpact({prepare(parts){prepared=parts.map(p=>p.frame);for(const p of parts)assert.equal(p.frame.texture,p.texture);}});
  assert.equal(prepared[0].texture.key,'g6-held-masked-'+cat);
  assert.equal(r.original.frame,body);assert.equal(r.head.frame,head);
  assert.throws(()=>r.art.prepareImpact({prepare(){throw Error('controlled prepare failure');}}),/controlled prepare failure/);
  assert.equal(r.original.frame,body);assert.equal(r.head.frame,head);
  r.sync(true);r.advance(160);r.sync(true);const angle=r.art.snapshot().scarfRotation;
  r.sync(true,cat==='CAT02'?160:200,-1);
  assert.equal(r.art.snapshot().scarfRotation,-angle,'mirror follows the same phase');
  r.art.setVisible(false);assert.equal(r.original.frame,body);assert.equal(r.head.frame,head);
  assert.equal(r.original.texture.key,cat);assert.equal(r.head.texture.key,cat);
  assert.equal(r.art.snapshot().cacheCount,1);r.cleanup();
 });
 test(cat+' actual zero displacement at a wall returns scarf and gait to the original idle frames',()=>{
  const r=rig(cat);r.sync(true);r.advance(200);r.sync(false,0,0);r.advance(120);
  assert.equal(r.art.snapshot().transition,'idle');assert.equal(r.art.snapshot().scarfVisible,false);
  assert.equal(r.original.frame.name,'body');assert.equal(r.head.frame.name,'h1-head');
  assert.equal(r.original.frame.texture,r.original.texture);r.cleanup();
 });
 test(cat+' native gait adds a rigid hip offset and retains its sole physical anchor',()=>{
  const r=rig(cat);r.sync(true);r.advance(200);r.sync(true);
  assert.ok(Math.hypot(r.offset.x,r.offset.y)>.1,'hip must follow authored gait');
  assert.equal(r.art.snapshot().bodyPosition.x,180);assert.equal(r.art.snapshot().bodyPosition.y,200);
  assert.equal(r.art.snapshot().bodyDisplay.width,42);assert.equal(r.art.snapshot().physicalBodies,0);r.cleanup();
 });
 test(cat+' reversal and a new displacement update preserve phase through100ms start and stop',()=>{
  const r=rig(cat);r.sync(true,cat==='CAT02'?80:100);r.advance(120);assert.equal(r.art.snapshot().walkTimeScale,.5);
  const before=r.art.snapshot();r.sync(true,cat==='CAT02'?160:200,-1);assert.equal(r.art.snapshot().gaitProgress,before.gaitProgress);assert.equal(r.art.snapshot().flipX,false);
  r.sync(true,0,0);assert.equal(r.art.snapshot().transition,'stopping');r.advance(120);assert.equal(r.art.snapshot().motion,'idle');assert.equal(r.offset.x,0);assert.equal(r.offset.y,0);assert.equal(r.original.frame.name,'body');r.cleanup();
 });
 test(cat+' pause and twenty restarts retain two native render Sprites and clear all presentation offsets',()=>{
  const r=rig(cat);r.sync(true);r.advance(30);r.art.pause(true);const before=r.art.snapshot();r.advance(2000);assert.equal(r.art.snapshot().gaitProgress,before.gaitProgress);
  r.art.pause(false);r.advance(120);assert.equal(r.art.snapshot().transition,'steady');
  r.art.setVisible(false);assert.equal(r.offset.x,0);assert.equal(r.offset.y,0);r.art.setVisible(true);
  for(let i=0;i<20;i++){r.art.reset(true,cat,42);r.sync(true);r.advance(30);r.art.reset(false,cat,42);}r.advance(20);
  assert.equal(r.offset.x,0);assert.equal(r.offset.y,0);assert.equal(r.scene.tweens.getTweens().length,0);assert.equal(r.sprites.length,2);r.cleanup();
 });
}
