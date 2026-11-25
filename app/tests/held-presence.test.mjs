import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

test('normal CAT01 adopts approved round-body pose/anchors and retains the independent weapon',async()=>{
 const adopted=JSON.parse(readFileSync('../assets/art/low-poly-v1/cat01/review/round-body-motion-v01/runtime/frames.json'));
 const result=await build({entryPoints:['src/g6-cat-frames.ts'],bundle:true,write:false,format:'iife',globalName:'Frames'});
 const scope={};runInNewContext(result.outputFiles[0].text,scope);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.Frames.g6CatFrames.body)),JSON.parse(JSON.stringify(adopted.body)));
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 assert.equal(sha('assets/g6-cat/body.png'),sha('../assets/art/low-poly-v1/cat01/review/round-body-motion-v01/runtime/body.png'));
 for(const part of ['head','grip'])assert.equal(sha('assets/g6-cat/'+part+'.png'),sha('../assets/art/low-poly-v1/cat01/review/round-body-motion-v01/runtime/'+part+'.png'));
 assert.equal(sha('assets/g6-cat/weapon.png'),'d99dada13902ead89604b5becc424bd083d6d1a82133472570152430a1aaafee');
});

test('held hero can apply a rigid gait offset without changing fixed pairing or resetting a real weapon volley',async()=>{
 const result=await build({entryPoints:['src/held-hero-presentation.ts'],bundle:true,write:false,format:'iife',globalName:'Held'});
 const scope={};runInNewContext(result.outputFiles[0].text,scope);
 const objects=[];
 const image=()=>{const o={x:0,y:0,rotation:0,frame:{name:'body'},setDepth(){return this;},setVisible(){return this;},setFlipX(){return this;},setOrigin(){return this;},setScale(){return this;},setAlpha(){return this;},setTexture(_key,frame){this.frame.name=frame;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(a){this.rotation=a;return this;}};objects.push(o);return o;};
 const tweens=[];const scene={textures:{get:()=>({has:()=>true})},add:{image},tweens:{killTweensOf(){},add(tween){tweens.push(tween);}}};
 const held=new scope.Held.HeldHeroPresentation(scene);held.reset(true,'CAT02',42);held.sync({x:180,y:200},true,1,{x:1,y:0});held.fire();
 const before=held.snapshot(),positions=objects.map(o=>({x:o.x,y:o.y}));
 assert.equal(typeof held.setGaitOffset,'function','held render layers need a rigid gait offset');
 held.setGaitOffset({x:.2,y:-.6});
 objects.forEach((o,i)=>{assert.equal(o.x,positions[i].x+.2);assert.equal(o.y,positions[i].y-.6);});
 assert.equal(held.snapshot().volleys,before.volleys);assert.equal(tweens.length,1);assert.equal(objects[3].rotation,0);
 held.sync({x:181,y:201},true,-1,{x:-1,y:0});assert.equal(held.snapshot().bodyPosition.x,181.2);
 held.setGaitOffset({x:0,y:0});assert.equal(held.snapshot().bodyPosition.x,181);
 held.reset(true,'CAT03',42);assert.equal(held.snapshot().weaponId,'W02');assert.equal(held.snapshot().bodyPosition.x,181);
});
