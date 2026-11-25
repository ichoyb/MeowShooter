import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
const AnimationManager=require('phaser/src/animations/AnimationManager');
const AnimationState=require('phaser/src/animations/AnimationState');
const TweenManager=require('phaser/src/tweens/TweenManager');
const Emitter=require('eventemitter3');
const entry='src/g6-cat-presentation.ts';
let module={};
if(existsSync(entry)){
 const compiled=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'G6'});
 const scope={};runInNewContext(compiled.outputFiles[0].text,scope);module=scope.G6;
}

// Native AnimationState/AnimationManager/TweenManager perform timing and events.
// This thin non-rendering Sprite surface avoids inventing a browser in Node;
// image decoding and actual Canvas rendering are checked by the separate Scene.
function rig(){
 assert.equal(typeof module.G6CatPresentation,'function','G6 presentation must be implemented');
 const textures=new Map(),sprites=[];
 const manager={exists:key=>textures.has(key),get:key=>textures.get(key),getFrame:(key,frame)=>textures.get(key)?.get(frame),
  addSpriteSheet(key,image,{frameWidth,frameHeight}){const texture={key,get:name=>({name:name??0,texture,width:frameWidth,height:frameHeight,customPivot:false})};textures.set(key,texture);return texture;},
  addAtlasJSONArray(key,image,data){const texture={key,get:name=>{const f=data.frames.find(frame=>String(frame.filename)===String(name??0));return {name:name??0,texture,width:f.sourceSize.w,height:f.sourceSize.h,customPivot:false};}};textures.set(key,texture);return texture;},
  addImage(key){const texture={key,get:name=>({name:name??'__BASE',texture,width:128,height:128,customPivot:false})};textures.set(key,texture);return texture;}};
 const game={events:new Emitter(),textures:manager};
 const anims=new AnimationManager(game);game.events.emit('boot');
 const scene={sys:{events:new Emitter(),textures:manager,anims},anims,textures:manager};
 class Sprite extends Emitter{
  constructor(x,y,key,frame){super();this.scene=scene;this.x=x;this.y=y;this.anims=new AnimationState(this);this.setTexture(key,frame);this.flipX=false;this.rotation=0;this.visible=true;this.active=true;}
  setTexture(key,frame){this.texture=manager.get(key);return this.setFrame(frame);}
  setFrame(frame){this.frame=this.texture.get(frame);return this;}
  setSizeToFrame(){return this;}
  setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;}
  setDepth(depth){this.depth=depth;return this;}
  setVisible(v){this.visible=v;return this;}
  setPosition(x,y){this.x=x;this.y=y;return this;}
  setFlipX(v){this.flipX=v;return this;}
  setRotation(r){this.rotation=r;return this;}
  play(key,ignore){this.anims.play(key,ignore);return this;}
  stop(){this.anims.stop();return this;}
  destroy(){this.anims.destroy();this.anims=undefined;this.removeAllListeners();this.active=false;}
 }
 scene.add={sprite(x,y,key,frame){const sprite=new Sprite(x,y,key,frame);sprites.push(sprite);return sprite;}};
 scene.tweens=new TweenManager(scene);scene.sys.events.emit('boot');scene.sys.events.emit('start');
 const images={body:{},weapon:{},grip:{},head:{}};
 module.registerG6CatTextures(scene,images);
 const art=new module.G6CatPresentation(scene,170);
 art.reset(true,36);
 let time=0;
 const step=(ms=20)=>{time+=ms;scene.tweens.startTime-=ms;scene.tweens.tick();for(const s of sprites)if(s.active)s.anims.update(time,ms);};
 const advance=(ms)=>{for(let i=0;i<ms;i+=10)step(Math.min(10,ms-i));};
 const sync=(moved,speed=170,dx=1,position={x:180,y:160},aim={x:1,y:0})=>art.sync(position,{moved,actualSpeed:speed,horizontalDisplacement:dx},aim);
 const cleanup=()=>{art.destroy();scene.tweens.destroy();anims.destroy();};
 return {art,scene,sprites,textures,images,step,advance,sync,cleanup};
}

test('G6 registers four independent shared textures and reset preserves 36u / zero physical bodies',()=>{
 const r=rig();module.registerG6CatTextures(r.scene,r.images);
 assert.equal(r.textures.size,4);assert.deepEqual([...r.textures.keys()].sort(),['g6-cat01-body','g6-cat01-grip','g6-cat01-head','g6-cat01-weapon']);
 const s=r.art.snapshot();assert.equal(s.bodyDisplay.width,36);assert.equal(s.bodyDisplay.height,36);assert.equal(s.visualObjects,4);assert.equal(s.physicalBodies,0);assert.equal(s.motion,'idle');r.cleanup();
});
test('actual speed scales native gait; start uses a 100ms presentation transition',()=>{
 const r=rig();r.sync(true,85);assert.equal(r.art.snapshot().transition,'starting');
 r.advance(120);assert.equal(r.art.snapshot().walkTimeScale,.5);assert.equal(r.art.snapshot().transition,'steady');
 r.sync(true,255);assert.equal(r.art.snapshot().walkTimeScale,1.5);assert.equal(r.art.snapshot().bodyPosition.x,180);r.cleanup();
});
test('quick reversal and moving fire retain native gait phase and rigid head',()=>{
 const r=rig();r.sync(true);r.advance(370);r.sync(true);
 const before=r.art.snapshot();r.sync(true,170,-1);const reversed=r.art.snapshot();
 assert.equal(reversed.gaitProgress,before.gaitProgress);assert.equal(reversed.bodyFrame,before.bodyFrame);assert.equal(reversed.facing,'left');
 r.art.fire();const fired=r.art.snapshot();assert.equal(fired.bodyFrame,before.bodyFrame);assert.equal(fired.gaitProgress,before.gaitProgress);assert.equal(fired.movingVolleys,1);
 assert.equal(fired.headRotation,0);r.advance(70);r.sync(true,170,-1);assert.ok(r.art.snapshot().weaponPlaying);assert.equal(r.art.snapshot().headRotation,0);r.cleanup();
});
test('stop and wall-zero motion reach idle within the native transition without moving position',()=>{
 const r=rig();r.sync(true);r.advance(300);r.sync(true,0,0);assert.equal(r.art.snapshot().transition,'stopping');
 r.advance(120);r.sync(false,0,0);const s=r.art.snapshot();assert.equal(s.motion,'idle');assert.equal(s.bodyPosition.x,180);assert.equal(s.bodyPosition.y,160);r.cleanup();
});
test('visibility toggles keep hidden comparison animation and counters alive',()=>{
 const r=rig();r.sync(true);r.advance(120);r.art.setVisible(false);const before=r.art.snapshot();r.advance(300);r.art.fire();
 const hidden=r.art.snapshot();assert.equal(hidden.visible,false);assert.notEqual(hidden.bodyFrame,before.bodyFrame);assert.equal(hidden.volleys,1);
 r.art.setVisible(true);assert.equal(r.art.snapshot().bodyFrame,hidden.bodyFrame);assert.equal(r.art.snapshot().volleys,1);r.cleanup();
});
test('pause clears transition callbacks, freezes animations and ignores fire without catch-up',()=>{
 const r=rig();r.sync(true);r.advance(30);r.art.pause(true);const before=r.art.snapshot();r.advance(3000);r.art.fire();
 const after=r.art.snapshot();assert.equal(after.bodyFrame,before.bodyFrame);assert.equal(after.gaitProgress,before.gaitProgress);assert.equal(after.volleys,before.volleys);assert.equal(r.scene.tweens.getTweens().length,0);
 r.sync(null,0,0,{x:190,y:170});assert.equal(r.art.snapshot().bodyPosition.x,190);assert.equal(r.art.snapshot().gaitProgress,before.gaitProgress);
 r.art.pause(false);r.advance(120);assert.equal(r.art.snapshot().transition,'steady');assert.equal(r.art.snapshot().walkTimeScale,1);r.cleanup();
});
test('twenty resets clear native callbacks and reset direction without accumulating objects',()=>{
 const r=rig();for(let i=0;i<20;i++){r.sync(true);r.advance(20);r.art.fire();r.art.reset(true,36);r.step();assert.equal(r.art.snapshot().volleys,0);assert.equal(r.art.snapshot().facing,'left');assert.equal(r.art.snapshot().motion,'idle');assert.equal(r.scene.tweens.getTweens().length,0);}
 assert.equal(r.sprites.length,4);r.cleanup();assert.equal(r.sprites.filter(s=>s.active).length,0);
});
test('destroy removes native animation listeners and owned Tweens while keeping shared textures',()=>{
 const r=rig();r.sync(true);r.art.fire();r.art.destroy();assert.equal(r.scene.tweens.getTweens().length,0);assert.equal(r.sprites.filter(s=>s.active).length,0);assert.equal(r.textures.size,4);assert.equal(r.art.snapshot().visualObjects,0);
 r.art.destroy();r.scene.tweens.destroy();r.scene.anims.destroy();
});
