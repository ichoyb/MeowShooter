import Phaser from '../../src/phaser-entry.cjs';
import {ImpactPresentation} from '../../src/impact-presentation';
import type {IncomingDamageFact} from '../../src/player-defense-rules';
declare function require(path:string):any;
const NativeCanvasPool=require('phaser/src/display/canvas/CanvasPool');

const w = window as any;
const fact = (hpLost=10, accepted=true, shieldAbsorbed=0):IncomingDamageFact =>
  ({accepted, rawDamage:hpLost+shieldAbsorbed, afterArmor:hpLost+shieldAbsorbed, shieldAbsorbed, hpLost, shieldBroke:shieldAbsorbed>0});

class NativeImpactScene extends Phaser.Scene {
  create() {
    const scene = this as any;
    this.game.loop.sleep();
    let now=0;
    scene.tweens.getDelta=()=>5;
    const effects=new ImpactPresentation(scene);
    const texture=scene.textures.createCanvas('impact-native-source',32,32);
    const context=texture.context as CanvasRenderingContext2D;
    context.fillStyle='#244e77';context.fillRect(3,2,6,9);
    context.fillStyle='rgba(20,30,40,.5)';context.fillRect(9,5,4,7);
    context.fillStyle='#653920';context.fillRect(20,18,8,5);
    const trim=texture.add('trim',0,2,1,12,12);trim.setTrim(24,30,4,7,12,12);
    const packed=texture.add('packed',0,18,16,12,10);packed.setTrim(22,26,3,8,12,10);
    const rotated=texture.add('rotated',0,2,1,12,12);rotated.setTrim(24,30,4,7,12,12);rotated.rotated=true;rotated.updateUVsInverted();
    const pivot=texture.add('pivot',0,2,1,12,12);pivot.customPivot=true;pivot.pivotX=.2;pivot.pivotY=.7;
    const part=scene.add.sprite(76,64,'impact-native-source','trim').setOrigin(.2,.7).setScale(1.7,.9).setDepth(3.2);
    effects.prepare([part]);
    const step=(milliseconds=5)=>{for(let i=0;i<milliseconds/5;i++){now+=5;scene.game.scene.update(now,5);effects.sync();}};
    const active=()=>{
      const entries:any[]=[];
      const collect=(items:any[])=>{for(const item of items){if(item.getData?.('impact-source')&&item.active)entries.push(item);if(item.list)collect(item.list);}};
      collect(scene.children.list);return entries;
    };
    const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
    const reset=()=>{effects.clear();effects.configure(true,'standard',.45);part.setVisible(true).setAlpha(1).setFrame('trim');};
    const render=(object:any)=>{
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ctx=canvas.getContext('2d')!;
      const renderer=scene.game.renderer,previous=renderer.currentContext;
      scene.cameras.main.preRender();renderer.currentContext=ctx;
      renderer.batchSprite(object,object.frame,scene.cameras.main);renderer.currentContext=previous;
      return ctx.getImageData(0,0,160,160).data;
    };
    const checks:any[]=[];
    const check=(name:string,fn:()=>void)=>{try{fn();checks.push({name,pass:true});}catch(error){checks.push({name,pass:false,error:String(error)});}};
    w.runImpactNativeChecks=()=>{
      scene.game.loop.sleep();now=scene.time.now;
      check('real native Scene gates rejected, shield-only, zero and NaN facts',()=>{
        reset();for(const f of [fact(0),fact(0,true,10),fact(10,false),fact(NaN)])assert(!effects.playerDamage(f,[part]),'non-HP fact accepted');
        assert(effects.snapshot().playerActive===0,'non-HP overlay exists');
        assert(effects.playerDamage(fact(),[part]),'actual HP loss did not light');assert(active().length===1,'one visible source must have one native overlay');
        assert(!effects.playerDamage(fact(),[part]),'180ms gate must suppress repeated light');
        step(110);assert(effects.snapshot().playerActive===0,'105ms pulse did not end');assert(!effects.playerDamage(fact(),[part]),'gate ends before 180ms');
        step(70);assert(effects.playerDamage(fact(),[part]),'180ms fresh fact did not light');
      });
      check('native Tween rises at 15ms, falls by 105ms, and does not extend on repeated facts',()=>{
        reset();effects.configure(true,'standard',.70);effects.playerDamage(fact(),[part]);step(15);
        let overlay=active()[0];assert(overlay.alpha>.69&&overlay.alpha<=.70,'.70 peak missing at 15ms');step(35);
        const before=overlay.alpha;assert(before>0&&before<.70,'native fall missing');assert(!effects.playerDamage(fact(),[part]),'repeat restarted pulse');
        step(60);assert(active().length===0,'repeat extended total pulse');
      });
      check('pulse begins on the first subsequent native display step without a blank initialization frame',()=>{
        reset();effects.playerDamage(fact(),[part]);step(5);assert(active()[0].alpha>0,'first native display step stayed blank');
      });
      check('player known hidden leg part joins the same bounded pulse on walk start and hides on stop',()=>{
        reset();const legs=scene.add.sprite(part.x,part.y,'impact-native-source','packed').setVisible(false);
        effects.prepare([legs]);effects.playerDamage(fact(),[part,legs]);step(20);
        const overlay=active().find((object:any)=>object.getData('impact-source')===legs);
        assert(overlay&&!overlay.visible,'hidden known player part did not reserve a non-drawing slot');
        part.setFrame('packed');legs.setVisible(true).setFrame('trim');effects.sync();
        assert(overlay.visible&&overlay.alpha>0&&overlay.frame.cutX===legs.frame.cutX,'newly visible native leg did not join current pulse');
        legs.setVisible(false);part.setFrame('trim');effects.sync();assert(!overlay.visible,'stopped leg stayed emphasized');
        assert(effects.snapshot().playerActive===2,'same player pulse created extra slots');effects.clear();legs.destroy();
      });
      check('trim, packed, rotated Canvas frames, custom pivot and both flips have exact native alpha silhouette',()=>{
        for(const name of ['trim','packed','rotated','pivot'])for(const flipX of [false,true])for(const flipY of [false,true]){
          reset();part.setFrame(name).setOrigin(.2,.7).setFlip(flipX,flipY).setRotation(.41).setScale(1.7,.9);
          effects.playerDamage(fact(),[part]);step(20);const overlay=active()[0];
          assert(overlay,'overlay missing');const oldAlpha=overlay.alpha;overlay.setAlpha(part.alpha);
          const sourcePixels=render(part),whitePixels=render(overlay);overlay.setAlpha(oldAlpha);
          let count=0;for(let i=0;i<sourcePixels.length;i+=4){assert(sourcePixels[i+3]===whitePixels[i+3],name+' silhouette mismatch at '+i);if(whitePixels[i+3]){count++;assert(whitePixels[i]>240&&whitePixels[i+1]>240&&whitePixels[i+2]>240,'derived pixel is not white');}}
          assert(count>10,'empty native draw');
        }
      });
      check('sync follows changing native animation frame transform alpha filter depth without touching source',()=>{
        reset();effects.playerDamage(fact(),[part]);step(20);part.setFrame('packed').setPosition(52,71).setRotation(-.3).setScale(-.8,1.4).setOrigin(.13,.81).setFlip(true,false).setAlpha(.6).setDepth(7.2).setScrollFactor(.7,.8);part.cameraFilter=4;
        effects.sync();const overlay=active()[0];
        for(const key of ['x','y','rotation','scaleX','scaleY','displayOriginX','displayOriginY','flipX','flipY','scrollFactorX','scrollFactorY','cameraFilter'])assert(overlay[key]===(part as any)[key],key+' not synchronized');
        assert(overlay.depth>part.depth&&overlay.depth<part.depth+.001,'local source depth not preserved');
        assert(overlay.frame.cutX===part.frame.cutX&&overlay.frame.x===part.frame.x,'frame not synchronized');
        assert(overlay.alpha<=.6*.45,'source alpha not respected');assert(part.alpha===.6&&part.depth===7.2,'source changed');
        part.setVisible(false);effects.sync();assert(!overlay.visible,'hidden source remains flashed');
      });
      check('native sprite animation phase continues while overlay tracks actual frame',()=>{
        reset();part.setAlpha(1);scene.anims.create({key:'impact-native-anim',frames:[{key:texture.key,frame:'trim'},{key:texture.key,frame:'packed'}],frameRate:100,repeat:-1});
        part.play('impact-native-anim');effects.playerDamage(fact(),[part]);step(30);effects.sync();
        assert(part.anims.isPlaying,'source animation stopped');assert(active()[0].frame.cutX===part.frame.cutX,'animated frame lagged');part.stop();
      });
      check('native parent Container inherits mirrored transform alpha visibility and multi-camera exclusion',()=>{
        reset();const parent=scene.add.container(71,63).setScale(-1.3,.8).setRotation(.32).setAlpha(.6);
        const nested=scene.add.container(12,-5).setScale(.9,1.1).setRotation(-.21).setAlpha(.8);parent.add(nested);
        const body=scene.add.image(-5,8,'impact-native-source','packed').setAlpha(.7).setOrigin(.3,.8).setFlip(true,true).setScale(.9,1.2);
        nested.add(body);effects.prepare([body]);effects.targetHit('container',[body],true);step(20);const overlay=active()[0];
        assert(overlay.parentContainer===nested,'overlay lost native parent');assert(nested.getIndex(overlay)===nested.getIndex(body)+1,'overlay lost local draw order');
        const overlayAlpha=overlay.alpha;
        const draw=(white:boolean)=>{
          body.setVisible(!white);overlay.setVisible(white).setAlpha(body.alpha);
          const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
          const renderer=scene.game.renderer,previous=renderer.currentContext;renderer.currentContext=canvas.getContext('2d');
          scene.cameras.main.preRender();parent.renderCanvas(renderer,parent,scene.cameras.main);renderer.currentContext=previous;
          return canvas.getContext('2d')!.getImageData(0,0,160,160).data;
        };
        const sourcePixels=draw(false),whitePixels=draw(true);let nonempty=0;
        for(let i=3;i<sourcePixels.length;i+=4){assert(sourcePixels[i]===whitePixels[i],'nested transformed alpha silhouette mismatch at '+i);if(sourcePixels[i])nonempty++;}
        assert(nonempty>10,'nested transform did not render');body.setVisible(true);overlay.setAlpha(overlayAlpha);effects.sync();
        const cameras=[scene.cameras.main,scene.cameras.add(0,0,160,160),scene.cameras.add(0,0,160,160)];
        parent.cameraFilter=cameras[1].id|cameras[2].id;body.cameraFilter=cameras[2].id;effects.sync();
        for(const camera of cameras)assert(overlay.willRender(camera)===body.willRender(camera),'child camera filtering mismatch');
        // Native rendering tests parent.willRender before entering its children.
        assert(!parent.willRender(cameras[1])&&!parent.willRender(cameras[2]),'parent camera filter lost');
        const renderer=scene.game.renderer,batch=renderer.batchSprite,draws:any[]=[];
        renderer.batchSprite=function(object:any,frame:any,camera:any,...rest:any[]){if(object===body||object===overlay)draws.push({overlay:object===overlay,camera:camera.id});return batch.call(this,object,frame,camera,...rest);};
        try{scene.cameras.render(renderer,{getChildren:()=>[parent]});}finally{renderer.batchSprite=batch;}
        assert(draws.length===2&&draws.every(draw=>draw.camera===cameras[0].id),'native camera rendering duplicated parent parts');
        parent.setVisible(false);effects.sync();assert(!overlay.visible,'invisible parent remained emphasized');
        effects.clear();assert(overlay.parentContainer===null,'clear retained parent ownership');
        for(const camera of cameras.slice(1))scene.cameras.remove(camera);parent.destroy();
      });
      check('container list reorder keeps adjacent overlay and native removal returns pooled slot to root',()=>{
        reset();const parent=scene.add.container(70,60),body=scene.add.image(0,0,'impact-native-source','trim');
        parent.add(body);effects.prepare([body]);effects.targetHit('reorder',[body]);step(20);const overlay=active()[0];
        parent.bringToTop(body);effects.sync();assert(parent.getIndex(overlay)===parent.getIndex(body)+1,'bringToTop detached overlay order');
        effects.clear();assert(overlay.parentContainer===null&&scene.children.exists(overlay),'native parent removal did not restore display list');
        effects.playerDamage(fact(),[part]);step(20);const reused=active()[0];assert(reused.parentContainer===null&&scene.children.exists(reused),'root pulse reused invisible container slot');
        effects.clear();parent.destroy();
      });
      check('destroying an active parent removes native group children without stale pulse callbacks',()=>{
        reset();const parent=scene.add.container(20,20),body=scene.add.image(0,0,'impact-native-source','trim');parent.add(body);
        effects.targetHit('destroy-parent',[body]);step(20);assert(active().length===1,'active child missing');parent.destroy();step(120);assert(effects.snapshot().targetPartsActive===0,'destroyed child survived in Group');
      });
      check('low and reduced motion keep same shape and use at most .16 contrast',()=>{
        for(const reduced of [false,true]){reset();effects.configure(true,reduced?'standard':'low',.70,reduced);effects.playerDamage(fact(),[part]);step(20);const overlay=active()[0];assert(overlay.alpha>0&&overlay.alpha<=.16,'low contrast alpha exceeded');assert(overlay.scaleX===part.scaleX&&overlay.scaleY===part.scaleY,'low setting changed shape');}
      });
      check('low and reduced motion draw only the inner silhouette edge with a transparent opaque center',()=>{
        for(const reduced of [false,true]){
          reset();effects.configure(true,reduced?'standard':'low',.70,reduced);effects.playerDamage(fact(),[part]);step(15);
          const overlay=active()[0],canvas=overlay.frame.source.image as HTMLCanvasElement;
          const pixels=canvas.getContext('2d')!.getImageData(0,0,32,32).data;
          const alpha=(x:number,y:number)=>pixels[(y*32+x)*4+3];
          assert(alpha(5,6)===0,'flat opaque interior still filled');assert(alpha(3,5)>0,'inner silhouette edge missing');
          assert(alpha(2,5)===0,'outline expanded outside source silhouette');
          assert(pixels[(5*32+3)*4]>=190,'inner edge is not a pale highlight');
          const source=context.getImageData(0,0,32,32).data;
          for(let i=3;i<pixels.length;i+=4)assert(pixels[i]<=source[i],'inner outline expanded source alpha');
        }
      });
      check('packed frame neighbors cannot erase their inner boundaries and scratch canvases are immediately pooled',()=>{
        reset();const packedSource=scene.textures.createCanvas('impact-packed-outline-source',16,8);
        packedSource.context.fillStyle='#40576a';packedSource.context.fillRect(0,0,16,8);
        packedSource.add('left',0,0,0,8,8).setTrim(12,12,2,2,8,8);
        packedSource.add('right',0,8,0,8,8).setTrim(12,12,2,2,8,8);
        const left=scene.add.image(30,30,packedSource.key,'left'),right=scene.add.image(55,30,packedSource.key,'right');
        const packedEffects=new ImpactPresentation(scene);
        try{
        const poolBefore=NativeCanvasPool.total();packedEffects.prepare([left,right]);
        assert(NativeCanvasPool.total()-poolBefore===2,'white/outline must retain exactly two canvases; scratch leaked');
        packedEffects.configure(true,'low');packedEffects.playerDamage(fact(),[left,right]);step(15);packedEffects.sync();
        const overlays=active();assert(overlays.length===2,'packed native overlays missing');
        const canvas=overlays[0].frame.source.image as HTMLCanvasElement;
        assert(canvas===overlays[1].frame.source.image,'same packed source duplicated outline canvas');
        const pixels=canvas.getContext('2d')!.getImageData(0,0,16,8).data;
        const alpha=(x:number,y:number)=>pixels[(y*16+x)*4+3];
        assert(alpha(7,4)>0&&alpha(8,4)>0,'packed cut boundary sampled opaque neighboring frame');
        assert(alpha(3,4)===0&&alpha(12,4)===0,'packed flat interiors still filled');
        }finally{packedEffects.destroy();left.destroy();right.destroy();}
      });
      check('native Groups bound player 6, enemy 8 targets and 32 parts without unbounded gates',()=>{
        reset();const parts=Array.from({length:10},(_,i)=>scene.add.image(20+i,20,'impact-native-source','trim'));
        effects.playerDamage(fact(),[...parts,parts[0]]);assert(effects.snapshot().playerActive===6,'player cap not six');
        for(let i=0;i<1000;i++)effects.targetHit(i,parts,false);
        const s=effects.snapshot();assert(s.targetActive<=8&&s.targetPartsActive<=32&&s.targetGateEntries<=32,'enemy or gate cap exceeded');
        assert(s.targetPartsActive===32,'enemy parts budget not filled');effects.clear();for(const p of parts)p.destroy();
      });
      check('shared white and outline source cache counts both Canvas backings without ImageData copies',()=>{
        reset();part.setAlpha(1).setVisible(true);effects.playerDamage(fact(),[part]);step(20);const before=effects.snapshot();
        const original=CanvasRenderingContext2D.prototype.getImageData;let reads=0;
        CanvasRenderingContext2D.prototype.getImageData=function(...args:any[]){reads++;return original.apply(this,args as any);};
        try{for(let i=0;i<60;i++){part.setFrame(i%2?'trim':'packed');effects.sync();}}finally{CanvasRenderingContext2D.prototype.getImageData=original;}
        assert(reads===0,'sync reads pixels');assert(before.cacheSources===1,'same source duplicated');assert(before.derivedCanvasBytes===8192&&before.derivedImageDataBytes===0,'white and outline backing bytes not accounted');
        const other=new ImpactPresentation(scene);other.configure(true,'standard');other.playerDamage(fact(),[part]);assert(other.snapshot().cacheSources===1,'second owner duplicated source');
        const sourceCount=scene.textures.getTextureKeys().length;other.destroy();assert(scene.textures.getTextureKeys().length===sourceCount,'one owner removed shared source');
      });
      check('explicit preparation keeps new source allocation and pixel reads outside impact and frame sync',()=>{
        reset();const next=scene.textures.createCanvas('impact-native-secondary',16,16);next.context.fillStyle='#342742';next.context.fillRect(0,0,16,16);
        const extra=scene.add.image(20,20,next.key);
        assert(!effects.playerDamage(fact(),[extra]),'unprepared source must be skipped');
        const prepRead=CanvasRenderingContext2D.prototype.getImageData;let preparationReads=0;
        CanvasRenderingContext2D.prototype.getImageData=function(...args:any[]){preparationReads++;return prepRead.apply(this,args as any);};
        try{effects.prepare([extra]);}finally{CanvasRenderingContext2D.prototype.getImageData=prepRead;}
        assert(preparationReads===0,'preparation needlessly reads pixels');
        const createCanvas=NativeCanvasPool.create2D,read=CanvasRenderingContext2D.prototype.getImageData;let allocations=0,reads=0;
        NativeCanvasPool.create2D=function(...args:any[]){allocations++;return createCanvas.apply(this,args);};
        CanvasRenderingContext2D.prototype.getImageData=function(...args:any[]){reads++;return read.apply(this,args as any);};
        try{assert(effects.playerDamage(fact(),[extra]),'prepared source did not light');step(20);effects.sync();assert(reads===0&&allocations===0,'impact or sync performs pixel work');}
        finally{NativeCanvasPool.create2D=createCanvas;CanvasRenderingContext2D.prototype.getImageData=read;effects.clear();extra.destroy();}
      });
      for(const failure of ['white-draw','white-context-null','scratch-draw','outline-context-throw','white-register-null','white-register-after','outline-register-after','outline-add-frame'])check('failed native preparation releases every owned canvas and texture: '+failure,()=>{
        reset();const key='impact-failure-source-'+failure;
        const original=scene.textures.createCanvas(key,16,16);original.context.fillStyle='#354763';original.context.fillRect(0,0,16,16);
        const image=scene.add.image(20,20,key),controller=new ImpactPresentation(scene);
        const createPool=NativeCanvasPool.create2D,draw=CanvasRenderingContext2D.prototype.drawImage,getContext=HTMLCanvasElement.prototype.getContext,createTexture=scene.textures.create;
        const canvases:HTMLCanvasElement[]=[],registered:string[]=[],poolBefore=NativeCanvasPool.total();let drawCalls=0,caught=false;
        NativeCanvasPool.create2D=function(...args:any[]){const canvas=createPool.apply(this,args);canvases.push(canvas);return canvas;};
        CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){drawCalls++;if((failure==='white-draw'&&drawCalls===1)||(failure==='scratch-draw'&&drawCalls===2))throw Error('injected '+failure);return draw.apply(this,args as any);};
        HTMLCanvasElement.prototype.getContext=function(...args:any[]):any{if(failure==='white-context-null'&&this===canvases[0])return null;if(failure==='outline-context-throw'&&this===canvases[1])throw Error('injected outline context');return getContext.apply(this,args as any);};
        scene.textures.create=function(textureKey:string,...args:any[]){
          if(failure==='white-register-null'&&textureKey.startsWith('impact-white-'))return null;
          const texture=createTexture.call(this,textureKey,...args);registered.push(textureKey);
          if((failure==='white-register-after'&&textureKey.startsWith('impact-white-'))||(failure==='outline-register-after'&&textureKey.startsWith('impact-outline-')))throw Error('injected post-register');
          if(failure==='outline-add-frame'&&textureKey.startsWith('impact-outline-'))texture.add=()=>{throw Error('injected frame registration');};
          return texture;
        };
        try{
          try{controller.prepare([image]);}catch{caught=true;}
          controller.destroy();assert(caught,'native preparation failure was swallowed');assert(controller.snapshot().cacheSources===0,'failed cache became owned');
          assert(NativeCanvasPool.total()===poolBefore,'failed preparation leaked native CanvasPool ownership');
          assert(canvases.length>0&&canvases.every(canvas=>canvas.width===1&&canvas.height===1),'failed derived backing was not released');
          assert(registered.every(textureKey=>!scene.textures.exists(textureKey)),'failed texture registration survived');
          assert(original.source[0].image.width===16&&original.source[0].image.height===16,'failure cleanup recycled the original');
        }finally{
          NativeCanvasPool.create2D=createPool;CanvasRenderingContext2D.prototype.drawImage=draw;HTMLCanvasElement.prototype.getContext=getContext;scene.textures.create=createTexture;
          controller.destroy();for(const textureKey of registered)if(scene.textures.exists(textureKey))scene.textures.remove(textureKey);
          for(const canvas of canvases)NativeCanvasPool.remove(canvas);image.destroy();scene.textures.remove(key);
        }
      });
      check('successful prepared source keeps two-owner white and outline ownership until the last destroy',()=>{
        reset();const key='impact-two-owner-source',original=scene.textures.createCanvas(key,16,16);original.context.fillRect(0,0,16,16);
        const image=scene.add.image(0,0,key),first=new ImpactPresentation(scene),second=new ImpactPresentation(scene),before=NativeCanvasPool.total();
        try{
          first.prepare([image]);second.prepare([image]);assert(NativeCanvasPool.total()-before===2,'two owners duplicated prepared white/outline');
          first.destroy();assert(NativeCanvasPool.total()-before===2&&second.snapshot().cacheSources===1,'first destroy released a shared canvas');
          second.configure(true,'low');assert(second.playerDamage(fact(),[image]),'surviving owner lost its native outline');second.sync();
          second.destroy();assert(NativeCanvasPool.total()===before,'last owner did not release both canvases');assert(original.source[0].image.width===16,'last owner recycled original source');
        }finally{first.destroy();second.destroy();image.destroy();scene.textures.remove(key);}
      });
      check('clear cancels native tweens, clears gates and reuses bounded allocations for 20 resets',()=>{
        let baseline=-1;for(let i=0;i<20;i++){reset();part.setVisible(true).setAlpha(1);effects.playerDamage(fact(),[part]);effects.targetHit('target',[part],true);effects.clear();step(200);const s=effects.snapshot();assert(s.playerActive===0&&s.targetPartsActive===0&&s.targetGateEntries===0,'old pulse or gate survived clear');if(baseline<0)baseline=s.allocated;assert(s.allocated===baseline,'allocation grew on reset');}
      });
      check('destroy releases last cache ownership, Group children and all native callbacks',()=>{
        reset();effects.playerDamage(fact(),[part]);effects.targetHit('target',[part],true);
        const canvases=scene.textures.getTextureKeys().filter((key:string)=>/^impact-(white|outline)-/.test(key)).map((key:string)=>scene.textures.get(key).source[0].image);
        effects.destroy();effects.destroy();step(200);
        const s=effects.snapshot();assert(s.allocated===0&&s.cacheSources===0,'destroy retained objects/cache');assert(!scene.textures.getTextureKeys().some((key:string)=>/^impact-(white|outline)-/.test(key)),'derived texture still registered');assert(active().length===0,'overlay callback survived destroy');
        assert(canvases.every((canvas:HTMLCanvasElement)=>canvas.width===1&&canvas.height===1),'native CanvasPool did not release backing');
        assert(texture.source[0].image.width===32&&texture.source[0].image.height===32,'original source was recycled');
      });
      return {status:checks.every(c=>c.pass)?'PASS':'FAIL',engine:'Phaser '+Phaser.VERSION,renderer:scene.game.renderer.type,scope:'REAL_NATIVE_CANVAS_SCENE_NOT_ACTUAL_ARENA_OR_DEVICE',checks};
    };
    w.impactNativeReady=true;
  }
}
new Phaser.Game({type:Phaser.CANVAS,width:160,height:160,parent:'stage',banner:false,audio:{noAudio:true},scene:NativeImpactScene});
