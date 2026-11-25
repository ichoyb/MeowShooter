import type Phaser from 'phaser';
import type {G6CatMovement} from './g6-cat-presentation';
import type {HeldHeroPresentation} from './held-hero-presentation';
import packedFrames from './r1-art/g6-packed-frames.json';
import presenceFrames from './r1-art/held-presence-frames.json';
declare function require(path: string): any;
const CanvasPool = require('phaser/src/display/canvas/CanvasPool') as typeof Phaser.Display.Canvas.CanvasPool;

const textureKeys = {CAT02: 'g6-cat02-walk', CAT03: 'g6-cat03-walk'} as const;
type HeldCat = keyof typeof textureKeys;
const cats = ['CAT02', 'CAT03'] as const;
const bodySourceSize = 384;
const patchTop = 288;
const seamOverlap = 12;
const frameCount = 12;
const frameRate = 18;
const easeMs = 100;
const upperFrameName = 'g6-held-upper';
const headFrameName = 'g6-held-masked-head';

export function registerG6HeldWalkTextures(scene: Phaser.Scene, images: Record<HeldCat, HTMLImageElement>): void {
  for (const cat of cats) {
    const key = textureKeys[cat];
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.addAtlasJSONArray(key, images[cat], packedFrames[cat]);
    if (!texture) throw new Error('Could not register G6 held walk texture: ' + key);
  }
}

/** Local paw/tail frames, rigid held layers, and one rooted native scarf Sprite. */
export class G6HeldWalk {
  private readonly sourceBody: Phaser.GameObjects.Image;
  private readonly sourceHead: Phaser.GameObjects.Image;
  private readonly legs: Phaser.GameObjects.Sprite;
  private readonly scarf: Phaser.GameObjects.Sprite;
  private readonly upperTextures = new Map<HeldCat, Phaser.Textures.Texture>();

  objects(): Phaser.GameObjects.Sprite[] {return [this.legs, this.scarf];}
  private originalFrame: Phaser.Textures.Frame | null = null;
  private originalHeadFrame: Phaser.Textures.Frame | null = null;
  private transitionTween: Phaser.Tweens.Tween | null = null;
  private readonly pose = {amount: 0};
  private transition: 'idle' | 'starting' | 'steady' | 'stopping' = 'idle';
  private enabled = false;
  private modern = true;
  private paused = false;
  private destroyed = false;
  private catId: HeldCat = 'CAT02';
  private actualSpeed = 0;
  private walkFrames = 0;
  private gaitOffset = {x:0,y:0};

  constructor(private readonly scene: Phaser.Scene, private readonly held: HeldHeroPresentation,
    private readonly referenceSpeeds: Record<HeldCat, number>) {
    this.sourceBody = held.objects()[0];
    this.sourceHead = held.objects()[3];
    for (const cat of cats) {
      if (!(referenceSpeeds[cat] > 0) || !Number.isFinite(referenceSpeeds[cat])) {
        throw new RangeError('G6 held walk reference speed must be positive: ' + cat);
      }
      const key = textureKeys[cat];
      if (!scene.anims.exists(key)) {
        scene.anims.create({key, frames: Array.from({length: frameCount}, (_, frame) => ({key, frame})),
          frameRate, repeat: -1});
      }
    }
    this.legs = scene.add.sprite(0, 0, textureKeys.CAT02, 0).setDepth(this.sourceBody.depth - .01).setVisible(false);
    this.scarf = scene.add.sprite(0, 0, textureKeys.CAT02, 24).setDepth(this.sourceBody.depth + .01).setVisible(false);
    this.legs.on('animationupdate', this.onWalkFrame);
  }

  private readonly onWalkFrame = (): void => {
    this.walkFrames++;
    this.paint();
  };

  private clearTransition(): void {
    this.transitionTween?.remove();
    this.transitionTween = null;
  }

  reset(enabled: boolean, catId: HeldCat, displaySize = 36): void {
    if (this.destroyed) return;
    this.clearTransition();
    this.restoreBody();
    this.held.setGaitOffset({x:0,y:0});
    this.gaitOffset = {x:0,y:0};
    this.enabled = enabled;
    this.catId = catId;
    this.paused = false;
    this.actualSpeed = this.walkFrames = this.pose.amount = 0;
    this.transition = 'idle';
    this.legs.anims.resume();
    this.legs.stop().setTexture(textureKeys[catId], 0).setDisplaySize(displaySize, displaySize);
    const scarf = presenceFrames.actors[catId].scarf;
    this.scarf.setTexture(textureKeys[catId], scarf.frame).setDisplaySize(displaySize, displaySize)
      .setOrigin(scarf.root[0] / bodySourceSize, scarf.root[1] / bodySourceSize).setRotation(0).setVisible(false);
    if (enabled) this.upperTexture();
    this.legs.anims.timeScale = 0;
    this.paint();
  }

  /** Run after HeldHeroPresentation.sync so the native body defines center and facing. */
  sync(movement: G6CatMovement): void {
    if (!this.enabled || this.destroyed) return;
    if (!this.paused && movement.moved !== null) {
      this.actualSpeed = movement.moved ? movement.actualSpeed : 0;
      const moving = this.actualSpeed > .00001;
      const anims = this.legs.anims;
      anims.timeScale = moving ? this.actualSpeed / this.referenceSpeeds[this.catId] : 0;
      if (moving && (this.transition === 'idle' || this.transition === 'stopping')) {
        anims.resume();
        if (this.transition === 'idle') this.legs.play(textureKeys[this.catId]);
        this.easePose(true);
      } else if (!moving && (this.transition === 'starting' || this.transition === 'steady')) {
        anims.pause();
        this.easePose(false);
      }
    }
    this.paint();
  }

  private easePose(moving: boolean): void {
    this.clearTransition();
    this.transition = moving ? 'starting' : 'stopping';
    this.transitionTween = this.scene.tweens.add({targets: this.pose, amount: moving ? 1 : 0,
      duration: easeMs, ease: 'Sine.easeInOut', onUpdate: this.paint,
      onComplete: () => {
        this.transitionTween = null;
        this.transition = moving ? 'steady' : 'idle';
        if (!moving) this.legs.stop();
        this.paint();
      }});
  }

  setVisible(modern: boolean): void {
    if (this.destroyed) return;
    this.modern = modern;
    this.paint();
  }

  pause(paused: boolean): void {
    if (this.destroyed || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.legs.anims.pause();
      this.transitionTween?.pause();
    } else {
      if (this.transition === 'starting' || this.transition === 'steady') this.legs.anims.resume();
      this.transitionTween?.resume();
    }
  }

  private restoreBody(): void {
    if (this.originalFrame && this.sourceBody.frame?.name === upperFrameName) {
      this.sourceBody.setTexture(this.originalFrame.texture.key, this.originalFrame.name);
    }
    if (this.originalHeadFrame && this.sourceHead.frame?.name === headFrameName) {
      this.sourceHead.setTexture(this.originalHeadFrame.texture.key, this.originalHeadFrame.name);
    }
    this.originalFrame = null;
    this.originalHeadFrame = null;
  }

  private upperTexture(): Phaser.Textures.Texture {
    const known = this.upperTextures.get(this.catId);
    if (known) return known;
    const frame = this.sourceBody.frame, source = frame.source;
    const canvas = CanvasPool.create2D(this, source.width, source.height);
    const key = 'g6-held-masked-' + this.catId;
    try {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source.image as CanvasImageSource, 0, 0);
      // Exact source-raster runs only remove scarf pixels; no face/fur pixels
      // are read back or painted during movement, fire, or impact.
      ctx.save();ctx.translate(-frame.x + frame.cutX, -frame.y + frame.cutY);ctx.beginPath();
      const scarf = presenceFrames.actors[this.catId].scarf;
      for (const [x,y,width] of scarf.maskSpans) ctx.rect(x,y,width,1);
      ctx.clip();ctx.clearRect(0,0,bodySourceSize,bodySourceSize);
      for (const patch of scarf.underpaint) {
        ctx.beginPath();patch.polygon.forEach(([x,y],index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));ctx.closePath();
        const [r,g,b,a] = patch.rgba;ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;ctx.fill();
      }
      ctx.restore();
      const texture = this.scene.textures.create(key, canvas);
      if (!texture) throw new Error('Could not prepare held scarf upper texture: ' + key);
      const height = patchTop + seamOverlap - frame.y;
      texture.add(upperFrameName,0,frame.cutX,frame.cutY,frame.cutWidth,height)!
        .setTrim(frame.realWidth,frame.realHeight,frame.x,frame.y,frame.cutWidth,height);
      const head = this.sourceHead.frame;
      texture.add(headFrameName,0,head.cutX,head.cutY,head.cutWidth,head.cutHeight)!
        .setTrim(head.realWidth,head.realHeight,head.x,head.y,head.cutWidth,head.cutHeight);
      texture.source[0].resolution = source.resolution;
      texture.source[0].scaleMode = source.scaleMode;
      this.upperTextures.set(this.catId,texture);
      return texture;
    } catch (error) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      else CanvasPool.remove(canvas);
      throw error;
    }
  }

  /** Warm the immutable masked source through the existing impact cache. */
  prepareImpact(impact: {prepare(parts: readonly Phaser.GameObjects.Image[]): void}): void {
    if (!this.enabled || this.destroyed) return;
    const body = this.sourceBody.frame, head = this.sourceHead.frame;
    try {
      const texture = this.upperTexture();
      this.sourceBody.setTexture(texture.key,upperFrameName);
      this.sourceHead.setTexture(texture.key,headFrameName);
      impact.prepare([this.sourceBody,this.sourceHead]);
    } finally {
      this.sourceBody.setTexture(body.texture.key,body.name);
      this.sourceHead.setTexture(head.texture.key,head.name);
    }
  }

  private useUpperBody(): void {
    if (this.sourceBody.frame.name === upperFrameName) return;
    this.originalFrame = this.sourceBody.frame;
    this.originalHeadFrame = this.sourceHead.frame;
    const texture = this.upperTexture();
    this.sourceBody.setTexture(texture.key,upperFrameName);
    this.sourceHead.setTexture(texture.key,headFrameName);
  }

  private readonly paint = (): void => {
    const phase = this.legs.anims.currentFrame;
    const show = this.enabled && this.modern && this.sourceBody.visible && !!phase && this.pose.amount >= .25;
    const center = {x:this.sourceBody.x-this.gaitOffset.x,y:this.sourceBody.y-this.gaitOffset.y};
    this.legs.setPosition(center.x, center.y).setFlipX(this.sourceBody.flipX).setVisible(show);
    this.scarf.setVisible(show);
    if (show) {
      this.useUpperBody();
      // Discrete half-travel poses let the paws ease back to the exact idle body.
      const frame = Number(phase.textureFrame) + (this.pose.amount < .75 ? frameCount : 0);
      if (Number(this.legs.frame.name) !== frame) this.legs.setFrame(frame);
      const offset = presenceFrames.actors[this.catId].poses[frame];
      const scale = this.sourceBody.displayWidth / bodySourceSize;
      this.gaitOffset = {x:offset.x*scale*(this.sourceBody.flipX?-1:1),y:offset.y*scale};
      const scarf = presenceFrames.actors[this.catId].scarf, mirror = this.sourceBody.flipX ? -1 : 1;
      this.scarf.setPosition(center.x+this.gaitOffset.x+(scarf.root[0]-bodySourceSize/2)*scale*mirror,
        center.y+this.gaitOffset.y+(scarf.root[1]-bodySourceSize/2)*scale)
        .setFlipX(this.sourceBody.flipX)
        .setOrigin(this.sourceBody.flipX?1-scarf.root[0]/bodySourceSize:scarf.root[0]/bodySourceSize,scarf.root[1]/bodySourceSize)
        .setRotation(scarf.angles[Number(phase.textureFrame)]*this.pose.amount*mirror);
    } else {
      this.restoreBody();
      this.gaitOffset = {x:0,y:0};
    }
    this.held.setGaitOffset(this.gaitOffset);
  };

  snapshot() {
    const anims = this.legs.anims;
    const walkingAnimation = !this.destroyed && this.legs.visible;
    return {active: this.enabled && !this.destroyed, catId: this.catId,
      visible: this.enabled && this.modern && !this.destroyed, walkVisible: walkingAnimation, walkingAnimation,
      paused: this.paused, motion: this.transition === 'idle' ? 'idle' : 'walk', transition: this.transition,
      facing: this.legs.flipX ? 'right' : 'left', flipX: this.legs.flipX,
      actualSpeed: this.actualSpeed, referenceSpeed: this.referenceSpeeds[this.catId],
      gaitProgress: anims?.getProgress() ?? 0, walkTimeScale: anims?.timeScale ?? 0,
      bodyFrame: this.legs.frame?.name ?? null, walkFrames: this.walkFrames,
      bodyPosition: {x: this.legs.x, y: this.legs.y},
      bodyDisplay: {width: this.sourceBody.displayWidth, height: this.sourceBody.displayHeight},
      gaitOffset: {...this.gaitOffset},
      scarfVisible: !this.destroyed && this.scarf.visible, scarfFrame: this.scarf.frame?.name ?? null,
      scarfRotation: this.scarf.rotation, cacheCount: this.upperTextures.size,
      derivedCanvasBytes: [...this.upperTextures.values()].reduce((sum,texture)=>sum+texture.source[0].width*texture.source[0].height*4,0),
      imageDataResidentBytes: 0,
      visualObjects: this.destroyed ? 0 : 2, physicalBodies: 0};
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearTransition();
    this.restoreBody();
    this.held.setGaitOffset({x:0,y:0});
    this.gaitOffset = {x:0,y:0};
    this.destroyed = true;
    this.legs.off('animationupdate', this.onWalkFrame);
    this.legs.destroy();
    this.scarf.destroy();
    for (const texture of this.upperTextures.values()) this.scene.textures.remove(texture.key);
    this.upperTextures.clear();
  }
}
