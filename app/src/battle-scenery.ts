import type Phaser from 'phaser';
import Runtime from './phaser-entry.cjs';
import type { BattleBounds } from './battle-geometry';
import type { Point } from './rules';
const P = Runtime as typeof Phaser;

export class BattleScenery {
  private readonly grass: Phaser.GameObjects.TileSprite;
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly shadows: Phaser.GameObjects.Graphics;
  private enabled = false;
  private quality: 'standard' | 'low' = 'standard';

  constructor(scene: Phaser.Scene, image: HTMLImageElement) {
    scene.textures.addImage('f1-ground', image);
    this.ground = scene.add.graphics().setDepth(-2);
    this.grass = scene.add.tileSprite(0, 0, 360, 500, 'f1-ground').setOrigin(0).setDepth(-3);
    this.shadows = scene.add.graphics().setDepth(.5);
  }

  layout(enabled: boolean, quality: 'standard' | 'low', bounds: BattleBounds, height: number): void {
    this.enabled = enabled; this.quality = quality;
    this.ground.clear(); this.shadows.clear(); this.grass.setVisible(false);
    if (!enabled) return;
    this.grass.setSize(360, height).setVisible(quality === 'standard');
    const top = bounds.top, span = bounds.bottom - top;
    const curve = new P.Curves.CubicBezier(new P.Math.Vector2(133, top - 30), new P.Math.Vector2(285, top + span * .28),
      new P.Math.Vector2(112, top + span * .65), new P.Math.Vector2(190, height + 30));
    const centers = curve.getPoints(32);
    // A low-contrast decorative ribbon, not a path or movement constraint.
    const ribbon = [...centers.map(p => ({ x: p.x - 34, y: p.y })), ...centers.slice().reverse().map(p => ({ x: p.x + 34, y: p.y }))];
    this.ground.fillStyle(0xe8e6bc, .76).fillPoints(ribbon, true);
    this.ground.lineStyle(1.2, 0x9bb986, .45).lineBetween(12, top, 12, bounds.bottom).lineBetween(348, top, 348, bounds.bottom);
    if (quality === 'standard') {
      for (const y of [top + 35, top + span * .46, bounds.bottom - 26]) for (const x of [10, 350]) {
        const sign = x < 180 ? 1 : -1;
        this.ground.lineStyle(1.3, 0x8cab77, .6).lineBetween(x, y + 12, x + sign * 3, y - 8);
        this.ground.fillStyle(0x9dbe85, .65).fillEllipse(x + sign * 7, y - 2, 12, 5).fillEllipse(x - sign * 3, y + 4, 10, 4);
        if (y < bounds.bottom - 40) {
          this.ground.fillStyle(0xfff5cf, .8).fillCircle(x + sign * 9, y - 12, 3.5)
            .fillStyle(0xe9bb76, .8).fillCircle(x + sign * 9, y - 12, 1.4);
        }
      }
    }
  }

  drawShadows(cat: Point, actors: readonly { x: number; y: number; kind: string }[]): void {
    this.shadows.clear(); if (!this.enabled) return;
    const draw = (x: number, y: number, width: number) => {
      this.shadows.fillStyle(0x52633d, .04).fillEllipse(x, y, width + 5, 10)
        .fillStyle(0x52633d, .09).fillEllipse(x, y, width, 7);
    };
    draw(cat.x, cat.y + 23, 27);
    if (this.quality === 'standard') for (const actor of actors) draw(actor.x, actor.y + (actor.kind === 'enemy' ? 15 : 19), actor.kind === 'enemy' ? 25 : 31);
  }

  snapshot() { return { enabled: this.enabled, quality: this.quality, textured: this.enabled && this.quality === 'standard', physicalBodies: 0, interactiveObjects: 0 }; }
}
