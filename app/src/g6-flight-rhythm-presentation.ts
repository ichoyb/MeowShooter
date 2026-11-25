import type Phaser from 'phaser';
import type {Point} from './rules';

type Graphics = Phaser.GameObjects.Graphics;
type Sprite = Phaser.Physics.Arcade.Sprite;
type Quality = 'standard' | 'low';
type ShotMark = {point: Point; angle: number; volleyId: number};
type FlightMark = {point: Point; angle: number; projectileId: number};
type RhythmMark = ShotMark & {step: number; steps: number; retarget: boolean};
type OpeningMark = ShotMark & {step: number};
const shortSlots = 16;
const mint = 0x91ecd2;
const teal = 0x307f79;
const ice = 0xc5f4ff;
const violet = 0xa78de3;
const gold = 0xfbd18b;
const warm = 0xc57a42;
const cream = 0xfff4cf;
const mirrorFacet = [{x:8,y:0},{x:0,y:-5},{x:-8,y:0},{x:0,y:5}];
const sparkFacet = [{x:0,y:-6},{x:2,y:-1},{x:6,y:0},{x:2,y:2},{x:0,y:5},{x:-2,y:2},{x:-5,y:0},{x:-2,y:-1}];

function flightBody(shot: Sprite): Phaser.Physics.Arcade.Body | null {
  const body = shot.body as Phaser.Physics.Arcade.Body | null;
  return shot.active && body?.enable ? body : null;
}

function bodyAngle(body: Phaser.Physics.Arcade.Body): number {
  return Math.atan2(body.velocity.y,body.velocity.x);
}

/** Presentation of actual Arena projectile emissions and transitions. */
export class G6FlightRhythmPresentation {
  private readonly trails: Graphics;
  private readonly flashes: Phaser.GameObjects.Group;
  readonly cameraObjects: Phaser.GameObjects.GameObject[];
  private projectiles: Phaser.Physics.Arcade.Group | null = null;
  private enabled = true;
  private finished = false;
  private quality: Quality = 'standard';
  private activeTrails = 0;
  private ricochets = 0;
  private returns = 0;
  private mirrorReturns = 0;
  private rhythmShots = 0;
  private tailRoots = 0;
  private echoShots = 0;
  private openingShots = 0;
  private openingVolleys = 0;
  private lastRicochet: FlightMark | null = null;
  private lastReturn: (FlightMark & {mirror: boolean}) | null = null;
  private lastRhythm: RhythmMark | null = null;
  private lastTail: ShotMark | null = null;
  private lastEcho: ShotMark | null = null;
  private lastOpening: OpeningMark | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.trails = scene.add.graphics().setDepth(3.65).setVisible(false);
    this.flashes = scene.add.group({maxSize:shortSlots});
    for(let i=0;i<shortSlots;i++)
      this.flashes.add(scene.add.graphics().setDepth(3.85).setActive(false).setVisible(false));
    this.cameraObjects = [this.trails,...this.flashes.getChildren()];
  }

  attach(projectiles: Phaser.Physics.Arcade.Group): void {
    this.projectiles = projectiles;
  }

  setEnabled(enabled: boolean): void {
    if(this.enabled===enabled)return;
    this.enabled=enabled;
    this.interrupt();
    this.sync();
  }

  setQuality(quality: Quality): void {
    if(this.quality===quality)return;
    this.quality=quality;
    this.interrupt();
    this.sync();
  }

  sync(): void {
    this.trails.clear();
    this.activeTrails=0;
    if(this.enabled&&!this.finished&&this.projectiles){
      for(const shot of this.projectiles.getChildren() as Sprite[]){
        if(!shot.active||shot.getData('flightPhase')!=='return')continue;
        const body=flightBody(shot);
        if(!body||!(body.velocity.x||body.velocity.y))continue;
        this.activeTrails++;
        this.drawTrail(body,!!shot.getData('mirrorReturn'));
      }
    }
    this.trails.setVisible(this.activeTrails>0);
  }

  private drawTrail(body: Phaser.Physics.Arcade.Body, mirror: boolean): void {
    const g=this.trails,low=this.quality==='low';
    g.save().translateCanvas(body.center.x,body.center.y).rotateCanvas(bodyAngle(body));
    if(mirror){
      g.lineStyle(2.7,0x556b9b,.72).lineBetween(-20,-3,-7,-3).lineBetween(-20,3,-7,3)
        .lineStyle(1.35,ice,.92).lineBetween(-19,-3,-7,-3).lineBetween(-19,3,-7,3);
      if(!low)g.lineStyle(1,violet,.76).lineBetween(-23,0,-16,0);
    }else{
      g.lineStyle(3,teal,.7).lineBetween(-18,0,-7,0)
        .lineStyle(1.5,mint,.93).lineBetween(-17,0,-7,0);
      if(!low)g.lineStyle(1.2,mint,.8).lineBetween(-15,-3,-11,0).lineBetween(-15,3,-11,0);
    }
    g.restore();
  }

  private flash(mark: FlightMark | ShotMark, duration: number): Graphics | null {
    const g=this.flashes.getFirstDead(false) as Graphics | null;
    if(!g)return null;
    g.clear().setPosition(mark.point.x,mark.point.y).setAlpha(1).setActive(true).setVisible(true);
    this.scene.tweens.add({targets:g,alpha:0,duration,ease:'Sine.easeOut',onComplete:()=>this.flashes.killAndHide(g)});
    return g;
  }

  ricochet(mark: FlightMark, incoming: number): void {
    if (!this.enabled || this.finished) return;
    this.ricochets++;
    this.lastRicochet=mark;
    const g=this.flash(mark,155);
    if(!g)return;
    g.fillStyle(warm,.82).fillPoints(sparkFacet,true)
      .fillStyle(cream,1).fillCircle(0,0,2.3);
    if(this.quality==='standard'){
      g.save().rotateCanvas(incoming).lineStyle(1.5,warm,.85).lineBetween(-11,0,-3,0).restore()
        .save().rotateCanvas(mark.angle).lineStyle(1.6,gold,.95).lineBetween(3,0,12,0).restore();
    }
  }

  returned(mark: FlightMark, mirror: boolean): void {
    if (!this.enabled || this.finished) return;
    this.returns++;
    this.lastReturn={...mark,mirror};
    if(!mirror)return;
    this.mirrorReturns++;
    const g=this.flash(mark,145);
    if(!g)return;
    g.save().rotateCanvas(mark.angle)
      .fillStyle(0x7693d2,.87).fillPoints(mirrorFacet,true)
      .lineStyle(1.35,ice,1).strokePoints(mirrorFacet,true)
      .lineStyle(1.25,ice,.96).lineBetween(0,-5,0,5);
    if(this.quality==='standard')g.lineStyle(1.1,violet,.85).lineBetween(-11,-4,-13,-1).lineBetween(-11,4,-13,1);
    g.restore();
  }

  rhythm(mark: RhythmMark): void {
    if (!this.enabled || this.finished) return;
    this.rhythmShots++;
    this.lastRhythm=mark;
    const g=this.flash(mark,115);
    if(!g)return;
    g.save().rotateCanvas(mark.angle);
    const color=mark.retarget?ice:mint,edge=mark.retarget?0x52678e:teal;
    g.lineStyle(2.9,edge,.76).lineBetween(19,-4,22,0).lineBetween(22,0,19,4)
      .lineStyle(1.5,color,1).lineBetween(19,-4,22,0).lineBetween(22,0,19,4);
    if(mark.retarget)g.lineStyle(1.2,color,.8).lineBetween(24,-3,26,0).lineBetween(26,0,24,3);
    if(mark.steps>1)
      for(let i=0;i<mark.step;i++)g.fillStyle(color,1).fillCircle(17,-4+i*4,1.1);
    g.restore();
  }

  tail(mark: ShotMark): void {
    if (!this.enabled || this.finished) return;
    this.tailRoots++;
    this.lastTail=mark;
    const g=this.flash(mark,100);
    if(!g)return;
    g.save().rotateCanvas(mark.angle)
      .lineStyle(3,warm,.88).lineBetween(17,0,23,0)
      .lineStyle(1.45,cream,1).lineBetween(18,0,23,0).restore();
  }

  echo(mark: ShotMark): void {
    if (!this.enabled || this.finished) return;
    this.echoShots++;
    this.lastEcho=mark;
    const g=this.flash(mark,170);
    if(!g)return;
    g.save().rotateCanvas(mark.angle)
      .lineStyle(2.7,warm,.73).lineBetween(20,-1.8,25,-1.8).lineBetween(20,1.8,25,1.8)
      .lineStyle(1.15,gold,.97).lineBetween(20,-1.8,25,-1.8).lineBetween(20,1.8,25,1.8).restore();
  }

  opening(mark: OpeningMark): void {
    if (!this.enabled || this.finished) return;
    if(this.lastOpening?.volleyId!==mark.volleyId)this.openingVolleys++;
    this.openingShots++;
    this.lastOpening=mark;
    const g=this.flash(mark,132);
    if(!g)return;
    g.save().rotateCanvas(mark.angle)
      .lineStyle(2.6,0x624786,.84).lineBetween(21,-2,26,0).lineBetween(26,0,21,2)
      .lineStyle(1.45,violet,.98).lineBetween(21,-2,26,0).lineBetween(26,0,21,2);
    for(let i=0;i<mark.step;i++)g.fillStyle(0xf2ddff,.97).fillCircle(19-i*2.6,0,.9);
    g.restore();
  }

  interrupt(): void {
    for(const g of this.flashes.getChildren() as Graphics[]){
      if(!g.active)continue;
      this.scene.tweens.killTweensOf(g);
      g.clear();
      this.flashes.killAndHide(g);
    }
  }

  finish(): void {
    this.finished=true;
    this.interrupt();
    this.sync();
  }

  reset(): void {
    this.finish();
    this.finished=false;
    this.ricochets=this.returns=this.mirrorReturns=this.rhythmShots=this.tailRoots=this.echoShots=this.openingShots=this.openingVolleys=0;
    this.lastRicochet=this.lastReturn=this.lastRhythm=this.lastTail=this.lastEcho=this.lastOpening=null;
  }

  snapshot() {
    return {
      enabled:this.enabled,quality:this.quality,activeTrails:this.activeTrails,
      ricochets:this.ricochets,returns:this.returns,mirrorReturns:this.mirrorReturns,rhythmShots:this.rhythmShots,
      tailRoots:this.tailRoots,echoShots:this.echoShots,openingShots:this.openingShots,openingVolleys:this.openingVolleys,
      lastRicochet:this.lastRicochet,lastReturn:this.lastReturn,lastRhythm:this.lastRhythm,
      lastTail:this.lastTail,lastEcho:this.lastEcho,lastOpening:this.lastOpening,
      activeShortEffects:this.flashes.countActive(true),maxEffects:shortSlots,objects:this.cameraObjects.length,physicalBodies:0,
    };
  }

  destroy(): void {
    this.finish();
    this.projectiles=null;
    this.flashes.clear(true,true);
    this.flashes.destroy();
    this.trails.destroy();
  }
}
