import type Phaser from 'phaser';
import type {AreaAbilities} from './area-abilities';
import type {Point} from './rules';

type AreaState = ReturnType<AreaAbilities['snapshot']>;
type RingStyle = 'pulse' | 'fused' | 'collapse' | 'shock';
const ink = {
  pulse: {edge:0x287d77, light:0xd9fff1, body:0x6bdbc3},
  fused: {edge:0x5360a6, light:0xefffee, body:0xa6baf5},
  collapse: {edge:0x65509c, light:0xe8d7ff, body:0x9e83e0},
  shock: {edge:0x9d6131, light:0xfff2c0, body:0xefb354},
};

/** Draws only authoritative cast/anchor facts from the independent G6 sample. */
export class G6AreaPresentation {
  private readonly anchor: Phaser.GameObjects.Graphics;
  private readonly flow: Phaser.GameObjects.Graphics;
  private readonly pulse: Phaser.GameObjects.Graphics;
  private readonly collapse: Phaser.GameObjects.Graphics;
  private readonly shocks: Phaser.GameObjects.Graphics[];
  private readonly shortLayers: Phaser.GameObjects.Graphics[];
  private enabled = true;
  private low = false;
  private anchorId: number | null = null;
  private seenPulse = 0;
  private seenBurst = 0;
  private nextShock = 0;
  private played = {pulse:0, fused:0, collapse:0, shock:0};
  private last: {style:RingStyle; x:number; y:number; radius:number} | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.anchor = scene.add.graphics().setDepth(1.12).setVisible(false);
    this.flow = scene.add.graphics().setDepth(1.14).setVisible(false);
    this.pulse = scene.add.graphics().setDepth(1.22).setVisible(false);
    this.collapse = scene.add.graphics().setDepth(1.21).setVisible(false);
    this.shocks = Array.from({length:8},()=>scene.add.graphics().setDepth(1.25).setVisible(false));
    this.shortLayers = [this.pulse,this.collapse,...this.shocks];
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.interrupt();
    this.anchor.setVisible(false);
    this.flow.setVisible(false);
    this.anchorId = null;
  }

  setQuality(quality: 'standard' | 'low'): void { this.low = quality === 'low'; }

  sync(state: AreaState | null, elapsed: number, fused: boolean, animate = true): void {
    const anchor = this.enabled ? state?.anchor : null;
    if (anchor) {
      if (anchor.id !== this.anchorId) {
        this.anchorId = anchor.id;
        this.drawAnchor(anchor, anchor.radius);
      }
      this.drawFlow(anchor, anchor.radius, elapsed);
    } else {
      this.anchorId = null;
      this.anchor.setVisible(false);
      this.flow.setVisible(false);
    }

    const burst = state?.lastBurst;
    if (burst && burst.id !== this.seenBurst) {
      this.seenBurst = burst.id;
      if (this.enabled && animate) this.show(this.collapse, burst, burst.radius, 'collapse');
    }
    const pulse = state?.lastPulse;
    if (pulse && pulse.id !== this.seenPulse) {
      this.seenPulse = pulse.id;
      if (this.enabled && animate) {
        const infused = fused && anchor && pulse.x === anchor.x && pulse.y === anchor.y;
        this.show(this.pulse, pulse, pulse.radius, infused ? 'fused' : 'pulse');
      }
    }
  }

  showShock(point: Point, radius: number): void {
    if (!this.enabled) return;
    const slot = this.shocks.find(g=>!g.visible) ?? this.shocks[this.nextShock++ % this.shocks.length];
    this.show(slot, point, radius, 'shock');
  }

  private drawAnchor(point: Point, radius: number): void {
    const g = this.anchor.clear().setPosition(point.x, point.y).setVisible(true);
    g.fillStyle(0x8c78c3,.08).fillCircle(0,0,radius);
    g.lineStyle(1,0x635698,.57).strokeCircle(0,0,radius);
    for (let i=0; i<6; i++) {
      const angle = Math.PI * i/3;
      g.lineStyle(2,0xd5b9fd,.72).beginPath()
        .arc(0,0,radius-1,angle-.21,angle+.21).strokePath();
      const tip = radius*.79, base = radius*.9;
      const x = Math.cos(angle), y = Math.sin(angle);
      g.lineStyle(1.35,0xe7ccff,.78).strokePoints([
        {x:x*base-y*3,y:y*base+x*3},{x:x*tip,y:y*tip},
        {x:x*base+y*3,y:y*base-x*3},
      ]);
    }
    g.fillStyle(0x3f3567,.42).fillEllipse(0,3,24,12);
    g.fillStyle(0x594585,.94).fillPoints([{x:0,y:-11},{x:7,y:0},{x:0,y:8},{x:-7,y:0}],true);
    g.fillStyle(0xcca8f5,.95).fillTriangle(-7,0,0,-11,0,3);
    g.fillStyle(0xffe9ff,.94).fillTriangle(0,-11,4,-3,0,0);
  }

  private drawFlow(point: Point, radius: number, elapsed: number): void {
    const g = this.flow.clear().setPosition(point.x, point.y).setVisible(true);
    const count = this.low ? 3 : 7;
    for (let i=0; i<count; i++) {
      const phase = (elapsed*.95+i/count)%1;
      const angle = i*Math.PI*2/count+phase*.55;
      const distance = radius*(.91-phase*.77);
      const x = Math.cos(angle), y = Math.sin(angle);
      g.lineStyle(1.25,0xc3a8ef,.52).lineBetween(x*distance,y*distance,x*(distance+5),y*(distance+5));
      g.fillStyle(0xf1e4ff,.9).fillCircle(x*distance,y*distance,1.6);
    }
  }

  private show(g: Phaser.GameObjects.Graphics, point: Point, radius: number, style: RingStyle): void {
    this.scene.tweens.killTweensOf(g);
    const {edge,light,body} = ink[style];
    g.clear().setPosition(point.x, point.y).setAlpha(1).setVisible(true);
    // This edge is already at the real hit radius on the damage frame.
    g.fillStyle(body,style==='shock' ? .09 : .14).fillCircle(0,0,radius);
    g.lineStyle(1.25,edge,.86).strokeCircle(0,0,radius);
    g.lineStyle(style==='fused'?2.1:1.5,light,.92).strokeCircle(0,0,radius-1.9);
    const marks = this.low ? 4 : 8;
    for (let i=0; i<marks; i++) {
      const angle = i*Math.PI*2/marks+Math.PI/8;
      const x = Math.cos(angle), y = Math.sin(angle);
      const inner = radius*(style==='shock' ? .77 : .64);
      const end = radius*.94;
      const wing = style==='shock' ? 2.6 : 4.3;
      g.fillStyle(body,.72).fillTriangle(x*end,y*end,x*inner-y*wing,y*inner+x*wing,x*inner+y*wing,y*inner-x*wing);
      g.lineStyle(1,light,.82).lineBetween(x*inner,y*inner,x*end,y*end);
    }
    if (style!=='shock') {
      const core = style==='fused' ? 12 : 8;
      g.lineStyle(1.25,light,.86).strokeCircle(0,0,core+5);
      g.fillStyle(body,.83).fillPoints([{x:0,y:-core},{x:core*.7,y:0},{x:0,y:core},{x:-core*.7,y:0}],true);
      g.fillStyle(light,.87).fillTriangle(-core*.7,0,0,-core,0,2);
    }
    this.played[style]++;
    this.last = {style,x:point.x,y:point.y,radius};
    const duration = style==='shock' ? 215 : 335;
    this.scene.tweens.add({targets:g,alpha:0,duration,ease:'Sine.easeOut',onComplete:()=>g.clear().setVisible(false)});
  }

  interrupt(): void {
    for (const layer of this.shortLayers) {
      this.scene.tweens.killTweensOf(layer);
      layer.clear().setVisible(false);
    }
  }

  reset(): void {
    this.interrupt();
    this.anchorId = null;
    this.anchor.setVisible(false);
    this.flow.setVisible(false);
    this.seenPulse = 0;
    this.seenBurst = 0;
    this.nextShock = 0;
    this.played = {pulse:0,fused:0,collapse:0,shock:0};
    this.last = null;
  }

  snapshot() {
    return {anchorId:this.anchorId, played:{...this.played}, last:this.last,
      activeShocks:this.shocks.filter(g=>g.visible).length,
      shortEffects:this.shortLayers.filter(g=>g.visible).length,objects:2+this.shortLayers.length,physicalBodies:0};
  }
}
