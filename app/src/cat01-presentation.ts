import type Phaser from 'phaser';
import { cat01Frames } from './cat01-frames';
import type { Point } from './rules';

export type Cat01PoseFrames = {
  body: Readonly<Record<string,{texture:string;index:number;gripIndex:number;grip:Point;head:Point}>>;
  bodySourceUnits:number;bodySourceHeight:number;bodyOffsetSourceY:number;
  headSourceUnits:number;weaponSourceUnits:number;gripSourceUnits:number;
  idleFPS:number;walkFPS:number;fireFPS:number;releaseAngleDeg:number;
};

// Art only: native Sprite animations consume physical movement and real volleys.
// This class never advances rules, moves a Body, or emits a projectile.
export class Cat01Presentation {
  private body: Phaser.GameObjects.Sprite;
  private weapon: Phaser.GameObjects.Sprite;
  private grip: Phaser.GameObjects.Sprite;
  private head: Phaser.GameObjects.Sprite;
  private enabled = false;
  private displaySize = 58;
  private motion: 'idle' | 'walk' = 'idle';
  private flipX = false;
  private volleys = 0;
  private walkFrames = 0;
  private movingVolleys = 0;
  private readonly partsByFrame = new Map<string, { grip: { x: number; y: number }; head: { x: number; y: number }; gripIndex: number }>();

  constructor(scene: Phaser.Scene, images: readonly HTMLImageElement[] | null, private readonly frames:Cat01PoseFrames=cat01Frames) {
    if (images) {
    ['cat01-body-0', 'cat01-body-1', 'cat01-weapon'].forEach((key, i) => {
      scene.textures.addSpriteSheet(key, images[i], { frameWidth: i === 2 ? 64 : 128, frameHeight: i === 2 ? 64 : 80 });
    });
    scene.textures.addSpriteSheet('cat01-grip', images[3], { frameWidth: 32, frameHeight: 32 });
    scene.textures.addImage('cat01-head', images[4]);
    }
    const bodyFrames = Object.entries(this.frames.body);
    for (const [, value] of bodyFrames) this.partsByFrame.set(value.texture + ':' + value.index, value);
    for (const motion of ['idle', 'walk'] as const) {
      scene.anims.create({ key: 'cat01-' + motion,
        frames: bodyFrames.filter(([name]) => name.startsWith(motion + '-')).map(([, value]) => ({ key: value.texture, frame: value.index })),
        frameRate: motion === 'idle' ? this.frames.idleFPS : this.frames.walkFPS, repeat: -1 });
    }
    scene.anims.create({ key: 'cat01-fire', frames: [1, 2, 3, 4, 5, 6, 7].map(frame => ({ key: 'cat01-weapon', frame })), frameRate: this.frames.fireFPS, repeat: 0 });
    this.body = scene.add.sprite(0, 0, 'cat01-body-0', 0).setDepth(3).setVisible(false);
    this.weapon = scene.add.sprite(0, 0, 'cat01-weapon', 0).setDepth(3.1).setVisible(false);
    this.grip = scene.add.sprite(0, 0, 'cat01-grip', 0).setDepth(3.2).setVisible(false);
    this.head = scene.add.sprite(0, 0, 'cat01-head', images ? '__BASE' : 'head').setDepth(3.3).setVisible(false);
    this.weapon.on('animationcomplete-cat01-fire', () => this.weapon.setFrame(0));
    this.body.on('animationupdate', (animation: Phaser.Animations.Animation) => { if (animation.key === 'cat01-walk') this.walkFrames++; });
  }

  reset(enabled: boolean, displaySize = 58): void {
    this.displaySize = displaySize;
    const scale=displaySize/this.frames.bodySourceUnits;
    this.body.setDisplaySize(displaySize,scale*this.frames.bodySourceHeight);
    this.weapon.setDisplaySize(scale*this.frames.weaponSourceUnits,scale*this.frames.weaponSourceUnits);
    this.grip.setDisplaySize(scale*this.frames.gripSourceUnits,scale*this.frames.gripSourceUnits);
    this.head.setDisplaySize(scale*this.frames.headSourceUnits,scale*this.frames.headSourceUnits);
    this.enabled = enabled; this.motion = 'idle'; this.flipX = false; this.volleys = 0; this.walkFrames = 0; this.movingVolleys = 0;
    this.body.stop().setTexture('cat01-body-0', 0).setVisible(enabled);
    this.weapon.stop().setTexture('cat01-weapon', 0).setVisible(enabled);
    this.grip.setVisible(enabled); this.head.setVisible(enabled);
    if (enabled) this.body.play('cat01-idle');
  }

  fire(): void {
    if (!this.enabled) return;
    if (this.body.anims.currentAnim?.key === 'cat01-walk') this.movingVolleys++;
    this.volleys++; this.weapon.play('cat01-fire');
  }

  sync(position: Point, moved: boolean | null, horizontalDisplacement: number, aim: Point): void {
    if (!this.enabled) return;
    if (moved !== null) { this.motion = moved ? 'walk' : 'idle'; this.body.play('cat01-' + this.motion, true); }
    // Approved source faces left. Only actual horizontal movement changes facing;
    // stopping, vertical movement and paused layout updates keep the last pose.
    if (moved !== null && Math.abs(horizontalDisplacement) > .00001) this.flipX = horizontalDisplacement > 0;
    const flip = this.flipX;
    const scale=this.displaySize/this.frames.bodySourceUnits;
    this.body.setPosition(position.x, position.y + this.frames.bodyOffsetSourceY * scale).setFlipX(flip);
    const parts = this.partsByFrame.get(this.body.texture.key + ':' + this.body.frame.name)!, grip = parts.grip;
    const releaseAngle = this.frames.releaseAngleDeg * Math.PI / 180;
    this.weapon.setPosition(position.x + (flip ? -grip.x : grip.x) * scale, position.y + grip.y * scale)
      .setFlipX(flip).setRotation(Math.atan2(aim.y, aim.x) - (flip ? Math.PI - releaseAngle : releaseAngle));
    this.grip.setFrame(parts.gripIndex).setPosition(this.weapon.x, this.weapon.y).setFlipX(flip);
    this.head.setPosition(position.x + (flip ? -parts.head.x : parts.head.x) * scale, position.y + parts.head.y * scale).setFlipX(flip);
  }

  snapshot() {
    return { active: this.enabled, motion: this.motion, facing: this.flipX ? 'right' : 'left', flipX: this.flipX, volleys: this.volleys, walkFrames: this.walkFrames, movingVolleys: this.movingVolleys,
      bodyAnimation: this.body.anims.currentAnim?.key ?? null, bodyPlaying: this.body.anims.isPlaying,
      bodyTexture: this.body.texture.key, bodyFrame: this.body.frame.name,
      bodyPosition: { x: this.body.x, y: this.body.y - this.frames.bodyOffsetSourceY * this.displaySize / this.frames.bodySourceUnits }, bodyDisplay: { width: this.head.displayWidth, height: this.head.displayHeight },
      weaponFrame: this.weapon.frame.name, weaponPlaying: this.weapon.anims.isPlaying,
      visualObjects: 4, physicalBodies: 0 };
  }
}
