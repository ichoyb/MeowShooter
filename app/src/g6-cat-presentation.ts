import type Phaser from 'phaser';
import type {Point} from './rules';
import {g6CatFrames} from './g6-cat-frames';
import packedFrames from './r1-art/g6-packed-frames.json';

export const g6CatTextureKeys = {
  body: 'g6-cat01-body', weapon: 'g6-cat01-weapon', grip: 'g6-cat01-grip', head: 'g6-cat01-head',
} as const;
export type G6CatImages = Record<keyof typeof g6CatTextureKeys, HTMLImageElement>;
export type G6CatMovement = {moved: boolean | null; horizontalDisplacement: number; actualSpeed: number};

/** Register the adopted layered images once per Game, sharing decoded sources. */
export function registerG6CatTextures(scene: Phaser.Scene, images: G6CatImages): void {
  for (const part of ['body', 'weapon'] as const) {
    const key = g6CatTextureKeys[part];
    if (!scene.textures.exists(key)) scene.textures.addAtlasJSONArray(key, images[part], packedFrames[part]);
  }
  if (!scene.textures.exists(g6CatTextureKeys.grip)) scene.textures.addSpriteSheet(g6CatTextureKeys.grip, images.grip, {frameWidth:32,frameHeight:32});
  if (!scene.textures.exists(g6CatTextureKeys.head)) scene.textures.addImage(g6CatTextureKeys.head, images.head);
}

const animations = {idle: 'g6-cat01-idle', walk: 'g6-cat01-walk', fire: 'g6-cat01-fire'} as const;
// This small local recoil follows native weapon frames. It never touches body/head.
const recoilByWeaponFrame = [0, .15, .6, .35, .2, .05, 0, 0] as const;

/** Normal courtyard art. Consumes actual movement and volley facts only. */
export class G6CatPresentation {
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly weapon: Phaser.GameObjects.Sprite;
  private readonly grip: Phaser.GameObjects.Sprite;
  private readonly head: Phaser.GameObjects.Sprite;

  objects(): Phaser.GameObjects.Sprite[] {return [this.body,this.weapon,this.grip,this.head];}
  private transitionTween: Phaser.Tweens.Tween | null = null;
  private transition: 'idle' | 'starting' | 'steady' | 'stopping' = 'idle';
  private enabled = false;
  private visible = true;
  private paused = false;
  private destroyed = false;
  private displaySize = 36;
  private wantedMoving = false;
  private actualSpeed = 0;
  private flipX = false;
  private volleys = 0;
  private movingVolleys = 0;
  private walkFrames = 0;
  private position: Point = {x: 0, y: 0};
  private aim: Point = {x: -1, y: 0};

  constructor(private readonly scene: Phaser.Scene, private readonly referenceSpeed: number) {
    if (!(referenceSpeed > 0) || !Number.isFinite(referenceSpeed)) throw new RangeError('G6 referenceSpeed must be positive');
    for (const motion of ['idle', 'walk'] as const) {
      if (!scene.anims.exists(animations[motion])) scene.anims.create({key: animations[motion],
        frames: g6CatFrames.body.filter(frame => frame.name.startsWith(motion + '-'))
          .map(frame => ({key: g6CatTextureKeys.body, frame: frame.index})),
        frameRate: motion === 'idle' ? g6CatFrames.idleFPS : g6CatFrames.walkFPS, repeat: -1});
    }
    if (!scene.anims.exists(animations.fire)) scene.anims.create({key: animations.fire,
      frames: [1, 2, 3, 4, 5, 6, 7].map(frame => ({key: g6CatTextureKeys.weapon, frame})),
      frameRate: g6CatFrames.fireFPS, repeat: 0});
    this.body = scene.add.sprite(0, 0, g6CatTextureKeys.body, 0).setDepth(3).setVisible(false);
    this.weapon = scene.add.sprite(0, 0, g6CatTextureKeys.weapon, 0).setDepth(3.1).setVisible(false);
    this.grip = scene.add.sprite(0, 0, g6CatTextureKeys.grip, 0).setDepth(3.2).setVisible(false);
    this.head = scene.add.sprite(0, 0, g6CatTextureKeys.head).setDepth(3.3).setVisible(false);
    this.body.on('animationupdate', this.onBodyFrame);
    this.weapon.on('animationupdate', this.placeParts);
    this.weapon.on('animationcomplete-' + animations.fire, this.onFireComplete);
  }

  private readonly onBodyFrame = (animation: Phaser.Animations.Animation): void => {
    if (animation.key === animations.walk) this.walkFrames++;
    this.placeParts();
  };

  private readonly onFireComplete = (): void => {
    this.weapon.setFrame(0);
    this.placeParts();
  };

  private clearTransition(): void {
    this.transitionTween?.remove();
    this.transitionTween = null;
  }

  private easeWalk(moving: boolean): void {
    this.clearTransition();
    if (moving && this.body.anims.currentAnim?.key !== animations.walk) {
      this.body.play(animations.walk);
      this.body.anims.timeScale = 0;
    }
    this.transition = moving ? 'starting' : 'stopping';
    this.transitionTween = this.scene.tweens.add({targets: this.body.anims,
      timeScale: moving ? this.actualSpeed / this.referenceSpeed : 0,
      duration: g6CatFrames.transitionMs, ease: 'Sine.easeOut',
      onComplete: () => {
        this.transitionTween = null;
        if (moving) this.transition = 'steady';
        else {
          this.transition = 'idle';
          this.body.play(animations.idle);
          this.body.anims.timeScale = 1;
        }
        this.placeParts();
      }});
  }

  reset(enabled = true, displaySize = 36): void {
    if (this.destroyed) return;
    this.clearTransition();
    this.enabled = enabled;
    this.visible = true;
    this.paused = false;
    this.displaySize = displaySize;
    this.wantedMoving = false;
    this.actualSpeed = 0;
    this.transition = 'idle';
    this.flipX = false;
    this.volleys = this.movingVolleys = this.walkFrames = 0;
    const scale = displaySize / g6CatFrames.sourceUnits;
    this.body.anims.resume();
    this.weapon.anims.resume();
    this.body.stop().setTexture(g6CatTextureKeys.body, 0).setDisplaySize(displaySize, displaySize);
    this.weapon.stop().setTexture(g6CatTextureKeys.weapon, 0)
      .setDisplaySize(scale * g6CatFrames.weaponSourceUnits, scale * g6CatFrames.weaponSourceUnits);
    this.grip.setDisplaySize(scale * g6CatFrames.gripSourceUnits, scale * g6CatFrames.gripSourceUnits);
    this.head.setDisplaySize(displaySize, displaySize);
    this.body.anims.timeScale = this.weapon.anims.timeScale = 1;
    this.setVisible(true);
    if (enabled) this.body.play(animations.idle);
    this.placeParts();
  }

  setVisible(visible: boolean): void {
    if (this.destroyed) return;
    this.visible = visible;
    for (const part of [this.body, this.weapon, this.grip, this.head]) part.setVisible(this.enabled && visible);
  }

  sync(position: Point, movement: G6CatMovement, aim: Point): void {
    if (!this.enabled || this.destroyed) return;
    this.position = {x: position.x, y: position.y};
    if (!this.paused && movement.moved !== null) {
      this.actualSpeed = movement.actualSpeed;
      const moving = movement.moved && movement.actualSpeed > .00001;
      if (moving && Math.abs(movement.horizontalDisplacement) > .00001) this.flipX = movement.horizontalDisplacement > 0;
      if (moving !== this.wantedMoving) {
        this.wantedMoving = moving;
        this.easeWalk(moving);
      } else if (moving) {
        const rate = movement.actualSpeed / this.referenceSpeed;
        if (this.transitionTween) this.transitionTween.updateTo('timeScale', rate, false);
        else this.body.anims.timeScale = rate;
      }
      this.aim = {x: aim.x, y: aim.y};
    }
    this.placeParts();
  }

  fire(): void {
    if (!this.enabled || this.paused || this.destroyed) return;
    this.volleys++;
    if (this.wantedMoving) this.movingVolleys++;
    this.weapon.play(animations.fire);
    this.placeParts();
  }

  pause(paused: boolean): void {
    if (this.destroyed || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.clearTransition();
      this.body.anims.pause();
      this.weapon.anims.pause();
    } else {
      this.body.anims.resume();
      this.weapon.anims.resume();
      if (this.transition === 'starting' || this.transition === 'stopping') this.easeWalk(this.wantedMoving);
    }
  }

  private readonly placeParts = (): void => {
    if (this.destroyed) return;
    const frame = g6CatFrames.body[Number(this.body.frame.name)];
    const scale = this.displaySize / g6CatFrames.sourceUnits;
    const mirror = this.flipX ? -1 : 1;
    const angle = Math.atan2(this.aim.y, this.aim.x);
    const recoil = recoilByWeaponFrame[Number(this.weapon.frame.name)] * this.displaySize / 36;
    const x = this.position.x + mirror * frame.grip.x * scale - Math.cos(angle) * recoil;
    const y = this.position.y + frame.grip.y * scale - Math.sin(angle) * recoil;
    const releaseAngle = g6CatFrames.releaseAngleDeg * Math.PI / 180;
    this.body.setPosition(this.position.x, this.position.y).setFlipX(this.flipX);
    this.weapon.setPosition(x, y).setFlipX(this.flipX)
      .setRotation(angle - (this.flipX ? Math.PI - releaseAngle : releaseAngle));
    this.grip.setFrame(frame.gripIndex).setPosition(x, y).setFlipX(this.flipX);
    this.head.setPosition(this.position.x + mirror * frame.head.x * scale, this.position.y + frame.head.y * scale)
      .setFlipX(this.flipX).setRotation(0);
  };

  snapshot() {
    return {active: this.enabled && !this.destroyed, visible: this.visible, paused: this.paused,
      motion: this.body.anims?.currentAnim?.key === animations.walk ? 'walk' : 'idle',
      facing: this.flipX ? 'right' : 'left', flipX: this.flipX, transition: this.transition,
      actualSpeed: this.actualSpeed, referenceSpeed: this.referenceSpeed,
      gaitProgress: this.body.anims?.getProgress() ?? 0, walkTimeScale: this.body.anims?.timeScale ?? 0,
      bodyFrame: this.body.frame.name, bodyPlaying: this.body.anims?.isPlaying ?? false,
      bodyPosition: {x: this.body.x, y: this.body.y}, bodyDisplay: {width: this.body.displayWidth, height: this.body.displayHeight},
      headPosition: {x: this.head.x, y: this.head.y}, headRotation: this.head.rotation,
      weaponFrame: this.weapon.frame.name, weaponPlaying: this.weapon.anims?.isPlaying ?? false,
      weaponPosition: {x: this.weapon.x, y: this.weapon.y}, gripPosition: {x: this.grip.x, y: this.grip.y},
      volleys: this.volleys, movingVolleys: this.movingVolleys, walkFrames: this.walkFrames,
      visualObjects: this.destroyed ? 0 : 4, physicalBodies: 0};
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearTransition();
    this.body.off('animationupdate', this.onBodyFrame);
    this.weapon.off('animationupdate', this.placeParts);
    this.weapon.off('animationcomplete-' + animations.fire, this.onFireComplete);
    this.destroyed = true;
    for (const part of [this.body, this.weapon, this.grip, this.head]) part.destroy();
  }
}
