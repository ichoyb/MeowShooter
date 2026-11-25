import type Phaser from 'phaser';
import type {IncomingDamageFact} from './player-defense-rules';
declare function require(path:string):any;
const CanvasPool=require('phaser/src/display/canvas/CanvasPool') as typeof Phaser.Display.Canvas.CanvasPool;

type VisiblePart=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;
type SharedSource={
  source:Phaser.Textures.TextureSource;texture:Phaser.Textures.Texture;outlineTexture:Phaser.Textures.Texture;
  frames:Map<Phaser.Textures.Frame,Phaser.Textures.Frame>;outlineFrames:Map<Phaser.Textures.Frame,Phaser.Textures.Frame>;owners:number;
  canvasBytes:number;imageDataBytes:number;prepareMs:number;
};
type Pulse={source:VisiblePart;kind:'player'|'target';target:string|number;strength:number};
const sourceCaches=new WeakMap<Phaser.Textures.TextureManager,Map<Phaser.Textures.TextureSource,SharedSource>>();
let nextTexture=0;
const playerLimit=6,targetLimit=8,targetPartLimit=32,targetGateLimit=32;
const playerGateMs=180,targetGateMs=100;

function prepareOutline(scene:Phaser.Scene,source:Phaser.Textures.TextureSource,white:HTMLCanvasElement):Phaser.Textures.Texture {
  const key='impact-outline-'+(++nextTexture);
  let outline:HTMLCanvasElement|undefined,scratch:HTMLCanvasElement|undefined;
  try{
    outline=CanvasPool.create2D(scene.textures,source.width,source.height);
    scratch=CanvasPool.create2D(scene.textures,source.width,source.height);
    const core=scratch.getContext('2d')!;
    core.drawImage(white,0,0);core.globalCompositeOperation='destination-in';
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])core.drawImage(white,dx,dy);
    // Lossless packed frames can touch with no padding. Their neighboring
    // pixels are not part of this silhouette: remove each cut's inner border
    // from the erosion kernel. Ignore nested crops (head/upper body) so their
    // internal split does not paint an extra stripe across the whole actor.
    const frames=Object.values(source.texture.frames).filter(frame=>frame.source===source&&frame.name!=='__BASE')
      .sort((a,b)=>b.cutWidth*b.cutHeight-a.cutWidth*a.cutHeight);
    const regions:{x:number;y:number;w:number;h:number}[]=[];
    for(const frame of frames){
      const region={x:frame.canvasData.x,y:frame.canvasData.y,w:frame.cutWidth,h:frame.cutHeight};
      if(regions.some(other=>region.x>=other.x&&region.y>=other.y&&region.x+region.w<=other.x+other.w&&region.y+region.h<=other.y+other.h))continue;
      regions.push(region);
      const {x,y,w,h}=region;
      core.clearRect(x,y,w,1);core.clearRect(x,y+h-1,w,1);core.clearRect(x,y,1,h);core.clearRect(x+w-1,y,1,h);
    }
    const ctx=outline.getContext('2d')!;
    ctx.drawImage(white,0,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(scratch,0,0);
    ctx.globalCompositeOperation='source-in';ctx.fillStyle='#dce5df';ctx.fillRect(0,0,source.width,source.height);
    ctx.globalCompositeOperation='source-over';
    const texture=scene.textures.create(key,outline);
    if(!texture)throw new Error('Could not prepare native impact outline');
    texture.add('__BASE',0,0,0,source.width,source.height);
    texture.source[0].resolution=source.resolution;texture.source[0].scaleMode=source.scaleMode;
    return texture;
  }catch(error){
    if(outline){
      const registered=scene.textures.exists(key)?scene.textures.get(key):null;
      if(registered?.source[0]?.image===outline)scene.textures.remove(key);else CanvasPool.remove(outline);
    }
    throw error;
  }finally{if(scratch)CanvasPool.remove(scratch);}
}

// Immutable source images are whitened once, never read back or re-painted at
// impact/sync time. Each controller owns a reference until its Scene shuts down.
// Native Texture supports Canvas sources without CanvasTexture's unused
// getImageData snapshot. TextureSource.destroy returns only this derived canvas
// to Phaser's CanvasPool; the original image is never owned by this cache.
function prepareSource(scene:Phaser.Scene,source:Phaser.Textures.TextureSource):SharedSource {
  let cache=sourceCaches.get(scene.textures);
  if(!cache){cache=new Map();sourceCaches.set(scene.textures,cache);}
  const known=cache.get(source);if(known)return known;
  const started=performance.now();
  const key='impact-white-'+(++nextTexture);
  let canvas:HTMLCanvasElement|undefined,outlineTexture:Phaser.Textures.Texture|undefined;
  try{
    canvas=CanvasPool.create2D(scene.textures,source.width,source.height);
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(source.image as CanvasImageSource,0,0);
    ctx.globalCompositeOperation='source-in';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,source.width,source.height);
    ctx.globalCompositeOperation='source-over';
    const texture=scene.textures.create(key,canvas);
    if(!texture)throw new Error('Could not prepare native impact texture');
    texture.add('__BASE',0,0,0,source.width,source.height);
    texture.source[0].resolution=source.resolution;texture.source[0].scaleMode=source.scaleMode;
    outlineTexture=prepareOutline(scene,source,canvas);
    const shared={source,texture,outlineTexture,frames:new Map(),outlineFrames:new Map(),owners:0,canvasBytes:source.width*source.height*8,
      imageDataBytes:0,prepareMs:performance.now()-started};
    cache.set(source,shared);return shared;
  }catch(error){
    if(outlineTexture)scene.textures.remove(outlineTexture.key);
    if(canvas){
      // create can fail before returning even after registration. Only remove
      // a registry entry whose actual source is this newly owned canvas.
      const registered=scene.textures.exists(key)?scene.textures.get(key):null;
      if(registered?.source[0]?.image===canvas)scene.textures.remove(key);else CanvasPool.remove(canvas);
    }
    throw error;
  }
}

function derivedFrame(shared:SharedSource,source:Phaser.Textures.Frame,outline=false):Phaser.Textures.Frame {
  const frames=outline?shared.outlineFrames:shared.frames,texture=outline?shared.outlineTexture:shared.texture;
  const known=frames.get(source);if(known)return known;
  const name='part-'+frames.size;
  const frame=texture.add(name,0,source.cutX,source.cutY,source.cutWidth,source.cutHeight)!;
  // Frame.clone deep-copies native trim/sourceSize/drawImage metadata. In 3.90
  // Canvas batchSprite deliberately ignores rotated UVs, so preserve the exact
  // existing Canvas cut rather than un-rotating a frame only in the overlay.
  const clone=source.clone();
  Object.assign(frame,clone,{texture,source:texture.source[0],sourceIndex:0,name,
    customPivot:source.customPivot,pivotX:source.pivotX,pivotY:source.pivotY,autoRound:source.autoRound});
  frames.set(source,frame);return frame;
}

export class ImpactPresentation {
  private readonly overlays:Phaser.GameObjects.Group;
  private readonly ownedSources=new Set<SharedSource>();
  private readonly targetGates=new Map<string|number,number>();
  private enabled=false;
  private quality:'standard'|'low'='standard';
  private peakAlpha:.45|.70=.45;
  private reducedMotion=false;
  private nextPlayerAt=-Infinity;
  private destroyed=false;
  private playerPeak=0;
  private targetPeak=0;
  private targetPartsPeak=0;
  private unpreparedPartsSkipped=0;

  constructor(private readonly scene:Phaser.Scene) {
    this.overlays=scene.add.group({maxSize:playerLimit+targetPartLimit});
    scene.events.once('shutdown',this.destroy,this);
  }

  configure(enabled:boolean,quality:'standard'|'low',peakAlpha:.45|.70=.45,reducedMotion=false):void {
    if(this.destroyed)return;
    if(this.enabled!==enabled||this.quality!==quality||this.peakAlpha!==peakAlpha||this.reducedMotion!==reducedMotion)this.clear();
    this.enabled=enabled;this.quality=quality;this.peakAlpha=peakAlpha;this.reducedMotion=reducedMotion;
  }

  // Call once after creating the current actor/target parts, before combat.
  // Preparing every source page also covers a native animation's page changes.
  prepare(parts:readonly VisiblePart[]):void {
    if(this.destroyed)return;
    for(const part of parts)for(const source of part.texture.source){
      const shared=prepareSource(this.scene,source);
      if(!this.ownedSources.has(shared)){this.ownedSources.add(shared);shared.owners++;}
    }
  }

  private prepared(source:Phaser.Textures.TextureSource):SharedSource|undefined {
    const shared=sourceCaches.get(this.scene.textures)?.get(source);
    if(shared&&!this.ownedSources.has(shared)){this.ownedSources.add(shared);shared.owners++;}
    return shared;
  }

  playerDamage(fact:IncomingDamageFact,visibleParts:readonly VisiblePart[]):boolean {
    if(!this.enabled||this.destroyed||!fact.accepted||!Number.isFinite(fact.hpLost)||fact.hpLost<=0||this.scene.time.now<this.nextPlayerAt)return false;
    const started=this.begin('player','player',visibleParts,playerLimit,this.peakAlpha,105);
    if(started)this.nextPlayerAt=this.scene.time.now+playerGateMs;
    return started;
  }

  targetHit(id:string|number,visibleParts:readonly VisiblePart[],critical=false):boolean {
    if(!this.enabled||this.destroyed)return false;
    this.pruneGates();
    if(this.targetGates.has(id)||this.targetGates.size>=targetGateLimit)return false;
    const snapshot=this.counts();
    if(snapshot.targetActive>=targetLimit||snapshot.targetPartsActive>=targetPartLimit)return false;
    const started=this.begin('target',id,visibleParts,targetPartLimit-snapshot.targetPartsActive,critical?.32:.20,80);
    if(started)this.targetGates.set(id,this.scene.time.now+targetGateMs);
    return started;
  }

  private isVisible(source:VisiblePart):boolean {
    if(!source.scene||!source.active||!source.visible||source.alpha<=0||source.getData('impact-source'))return false;
    for(let parent=source.parentContainer;parent;parent=parent.parentContainer)if(!parent.active||!parent.visible||parent.alpha<=0)return false;
    return true;
  }

  private begin(kind:Pulse['kind'],target:Pulse['target'],parts:readonly VisiblePart[],limit:number,peak:number,duration:number):boolean {
    let count=0;
    const seen=new Set<VisiblePart>();
    for(const source of parts){
      if(count>=limit)break;
      // The player's known parts (at most six) may switch between body and
      // native leg patches during this same pulse. Reserve those slots now;
      // sync alone decides whether they draw. Targets only reserve visible parts.
      const eligible=kind==='player'?!!source.scene&&source.active&&!source.getData('impact-source'):this.isVisible(source);
      if(seen.has(source)||!eligible)continue;
      seen.add(source);
      const shared=this.prepared(source.frame.source);
      if(!shared){this.unpreparedPartsSkipped++;continue;}
      const frame=derivedFrame(shared,source.frame,this.quality==='low'||this.reducedMotion);
      let overlay=this.overlays.getFirstDead(false) as Phaser.GameObjects.Image|null;
      if(!overlay){
        if(this.overlays.isFull())break;
        overlay=this.scene.add.image(0,0,frame.texture.key,frame.name).setVisible(false).setActive(false);
        this.overlays.add(overlay);
      }
      const pulse:Pulse={source,kind,target,strength:0};
      overlay.setData('impact-source',source).setData('impact-pulse',pulse).setActive(true);
      this.syncPart(overlay,pulse);
      const nativeOverlay=overlay;
      const strength=this.quality==='low'||this.reducedMotion?Math.min(.16,peak):peak;
      // One native Tween avoids a chain transition adding a display frame to
      // this very short pulse. Its easing rises for 15ms then fades to zero.
      const tween=this.scene.tweens.add({targets:pulse,strength,duration,
        ease:(progress:number)=>progress*duration<=15?progress*duration/15:
          1-Math.sin(((progress*duration-15)/(duration-15))*Math.PI/2),
        onUpdate:()=>{if(nativeOverlay.active)this.syncPart(nativeOverlay,pulse);},onComplete:()=>this.release(nativeOverlay)});
      overlay.setData('impact-tween',tween);
      // Initialize native TweenData at zero elapsed time now, so the first
      // subsequent engine step can draw the rise instead of a blank setup frame.
      tween.forward(0);
      count++;
    }
    const active=this.counts();
    this.playerPeak=Math.max(this.playerPeak,active.playerActive);this.targetPeak=Math.max(this.targetPeak,active.targetActive);this.targetPartsPeak=Math.max(this.targetPartsPeak,active.targetPartsActive);
    return count>0;
  }

  private syncPart(overlay:Phaser.GameObjects.Image,pulse:Pulse):void {
    const source=pulse.source;
    if(!source.scene){this.release(overlay);return;}
    const shared=this.prepared(source.frame.source);
    if(!shared){this.unpreparedPartsSkipped++;this.release(overlay);return;}
    const frame=derivedFrame(shared,source.frame,this.quality==='low'||this.reducedMotion);
    if(overlay.frame!==frame)overlay.setTexture(frame.texture.key,frame.name);
    const parent=source.parentContainer;
    if(overlay.parentContainer!==parent){overlay.parentContainer?.remove(overlay);if(parent)parent.add(overlay);}
    // Container depth is list order, not child.depth. Staying immediately after
    // the real part inherits parent rotation/flip/alpha/masks and camera filters.
    if(parent){
      const sourceIndex=parent.getIndex(source),overlayIndex=parent.getIndex(overlay);
      if(overlayIndex!==sourceIndex+1)parent.moveTo(overlay,sourceIndex+(overlayIndex<sourceIndex?0:1));
    }
    overlay.setPosition(source.x,source.y).setScale(source.scaleX,source.scaleY).setRotation(source.rotation)
      .setOrigin(source.originX,source.originY).setDisplayOrigin(source.displayOriginX,source.displayOriginY)
      .setFlip(source.flipX,source.flipY).setScrollFactor(source.scrollFactorX,source.scrollFactorY)
      .setDepth(source.depth+.000001).setAlpha(source.alpha*pulse.strength).setVisible(this.isVisible(source));
    overlay.cameraFilter=source.cameraFilter;
    if(source.mask)overlay.setMask(source.mask);else overlay.clearMask();
    if(source.isCropped){const crop=(source as VisiblePart&{_crop:{x:number;y:number;width:number;height:number}})._crop;overlay.setCrop(crop.x,crop.y,crop.width,crop.height);}else overlay.setCrop();
    frame.texture.source[0].resolution=source.frame.source.resolution;
    frame.texture.source[0].scaleMode=source.frame.source.scaleMode;
  }

  sync():void {
    if(this.destroyed)return;
    for(const child of this.overlays.getChildren() as Phaser.GameObjects.Image[])if(child.active)this.syncPart(child,child.getData('impact-pulse'));
    this.pruneGates();
  }

  private pruneGates():void {for(const [id,until] of this.targetGates)if(until<=this.scene.time.now)this.targetGates.delete(id);}

  private release(overlay:Phaser.GameObjects.Image):void {
    if(!overlay.scene)return;
    const tween=overlay.getData('impact-tween') as Phaser.Tweens.Tween|undefined;
    if(tween){overlay.setData('impact-tween',null);tween.stop();}
    overlay.setActive(false).setVisible(false).setData('impact-source',null).setData('impact-pulse',null);
    overlay.clearMask();
    overlay.parentContainer?.remove(overlay);
    overlay.setTexture('__DEFAULT');
  }

  private counts(){
    let playerActive=0,targetPartsActive=0;
    const targets=new Set<Pulse['target']>();
    for(const child of this.overlays.getChildren())if(child.active){const pulse=child.getData('impact-pulse') as Pulse;if(pulse.kind==='player')playerActive++;else{targetPartsActive++;targets.add(pulse.target);}}
    return {playerActive,targetPartsActive,targetActive:targets.size};
  }

  clearTarget(id:string|number):void {
    if(this.destroyed)return;
    for(const child of this.overlays.getChildren() as Phaser.GameObjects.Image[])if(child.active){
      const pulse=child.getData('impact-pulse') as Pulse;
      if(pulse.kind==='target'&&pulse.target===id)this.release(child);
    }
    this.targetGates.delete(id);
  }

  clear():void {
    if(this.destroyed)return;
    for(const child of this.overlays.getChildren() as Phaser.GameObjects.Image[])if(child.active)this.release(child);
    this.targetGates.clear();this.nextPlayerAt=-Infinity;
  }

  destroy():void {
    if(this.destroyed)return;
    this.clear();this.destroyed=true;
    this.scene.events.off('shutdown',this.destroy,this);
    this.overlays.destroy(true,true);
    const cache=sourceCaches.get(this.scene.textures);
    for(const shared of this.ownedSources)if(--shared.owners===0){cache?.delete(shared.source);shared.frames.clear();shared.outlineFrames.clear();this.scene.textures.remove(shared.texture.key);this.scene.textures.remove(shared.outlineTexture.key);}
    this.ownedSources.clear();
  }

  snapshot(){
    let derivedCanvasBytes=0,derivedImageDataBytes=0,sourceRGBABytes=0,prepareMs=0;
    for(const shared of this.ownedSources){derivedCanvasBytes+=shared.canvasBytes;derivedImageDataBytes+=shared.imageDataBytes;sourceRGBABytes+=shared.source.width*shared.source.height*4;prepareMs+=shared.prepareMs;}
    return {...this.destroyed?{playerActive:0,targetPartsActive:0,targetActive:0}:this.counts(),enabled:this.enabled&&!this.destroyed,
      quality:this.quality,reducedMotion:this.reducedMotion,peakAlpha:this.peakAlpha,
      allocated:this.destroyed?0:this.overlays.getLength(),targetGateEntries:this.targetGates.size,
      playerPeak:this.playerPeak,targetPeak:this.targetPeak,targetPartsPeak:this.targetPartsPeak,
      cacheSources:this.ownedSources.size,sourceRGBABytes,derivedCanvasBytes,derivedImageDataBytes,
      derivedWhiteCanvasBytes:derivedCanvasBytes/2,derivedOutlineCanvasBytes:derivedCanvasBytes/2,
      preparationScratchPeakBytes:Math.max(0,...Array.from(this.ownedSources,shared=>shared.canvasBytes/2)),
      derivedTotalBytes:derivedCanvasBytes+derivedImageDataBytes,prepareMs,unpreparedPartsSkipped:this.unpreparedPartsSkipped};
  }
}
