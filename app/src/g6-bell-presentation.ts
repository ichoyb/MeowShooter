import type Phaser from 'phaser';
import type {BellAbilities, BellTrailFact} from './bell-abilities';
import {GROWTH_NUMBERS as N} from './progression-content';
import type {Point} from './rules';

type Graphics = Phaser.GameObjects.Graphics;
type Image = Phaser.GameObjects.Image;
type BellState = ReturnType<BellAbilities['snapshot']>;
type Quality = 'standard' | 'low';
const amber = 0xf8be58;
const cream = 0xffefb0;
const metalEdge = 0x6b3925;
const bellShape = [
  {x:-7.6,y:3.5}, {x:-5.8,y:.4}, {x:-5.1,y:-3.4}, {x:-3.1,y:-5.8},
  {x:2.8,y:-5.8}, {x:5,y:-3.6}, {x:5.9,y:.5}, {x:7.6,y:3.5},
  {x:5.2,y:5.1}, {x:-5.2,y:5.1},
];
const bellFacet = [
  {x:-5.7,y:1.9}, {x:-4.4,y:-3.1}, {x:-2.4,y:-4.9}, {x:.5,y:-4.9}, {x:-1.1,y:2.4},
];
const starShape = [
  {x:0,y:-1}, {x:.23,y:-.24}, {x:1,y:0}, {x:.23,y:.24},
  {x:0,y:1}, {x:-.23,y:.24}, {x:-1,y:0}, {x:-.23,y:-.24},
];
const decorationSlots = 12;

function drawBell(g: Graphics, bright: boolean): void {
  g.lineStyle(1.4, metalEdge, 1).strokeCircle(0,-6.1,1.4);
  g.fillStyle(metalEdge,1).fillEllipse(0,5,5.2,5.4);
  g.fillStyle(bright ? cream : 0xdb9450,1).fillEllipse(0,5.7,3.1,2.5);
  g.fillStyle(bright ? amber : 0xba773d,1).fillPoints(bellShape,true);
  g.fillStyle(bright ? 0xffdb85 : 0xd79956,1).fillPoints(bellFacet,true);
  g.fillStyle(bright ? 0xc07735 : 0x966039,1).fillRect(-6,2.7,12,1.7);
  g.lineStyle(1,metalEdge,.95).strokePoints(bellShape,true);
  g.lineStyle(.85,bright ? 0xfff8cb : 0xeabb74,.95).lineBetween(-3.8,-2.7,-3.1,-4);
}

function drawStar(g: Graphics, x: number, y: number, size: number, alpha: number): void {
  g.save().translateCanvas(x,y).scaleCanvas(size,size)
    .fillStyle(cream,alpha).fillPoints(starShape,true).restore();
}

/** Draws bell facts after native gameplay commits them. */
export class G6BellPresentation {
  private readonly ground: Graphics;
  private readonly flight: Graphics;
  private readonly blasts: Phaser.GameObjects.Group;
  private readonly decoration: Phaser.GameObjects.Group;
  readonly cameraObjects: Phaser.GameObjects.GameObject[];
  private ability: BellAbilities | null = null;
  private current: BellState | null = null;
  private groundRevision = '';
  private enabled = true;
  private finished = false;
  private quality: Quality = 'standard';
  private lastLanding: BellTrailFact | null = null;
  private lastBlast: BellTrailFact | null = null;
  private lastReplacement: BellTrailFact | null = null;
  private lastOrbitHit: Point | null = null;
  private landings = 0;
  private trailBlasts = 0;
  private replacements = 0;
  private orbitFlashes = 0;
  private blastCursor = 0;
  private decorationCursor = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(.78).setVisible(false);
    this.flight = scene.add.graphics().setDepth(3.5).setVisible(false);
    this.blasts = this.createPool(N.duoTrailMax);
    this.decoration = this.createPool(decorationSlots);
    this.cameraObjects = [this.ground,this.flight,...this.blasts.getChildren(),...this.decoration.getChildren()];
  }

  private createPool(size: number): Phaser.GameObjects.Group {
    const group = this.scene.add.group({maxSize:size});
    for(let i=0;i<size;i++)group.add(this.scene.add.graphics().setActive(false).setVisible(false));
    return group;
  }

  bind(ability: BellAbilities | null): void {
    if (this.ability === ability) return;
    this.clearPersistent();
    this.interrupt();
    this.ability?.observePresentation(null);
    this.ability = ability;
    ability?.observePresentation(this);
  }

  setEnabled(enabled: boolean): void {
    if(this.enabled===enabled)return;
    this.enabled=enabled;
    this.interrupt();
    this.sync(this.ability?.snapshot()??null);
  }

  setQuality(quality: Quality): void {
    if(this.quality===quality)return;
    this.quality=quality;
    this.clearPool(this.decoration);
    this.sync(this.current);
  }

  sync(state: BellState | null, _elapsed?: number): void {
    if(!this.enabled||this.finished||!state){
      this.clearPersistent();
      return;
    }
    this.current=state;
    this.showOriginals(false);
    // Each native deployment freezes its point, so the ground draw only needs
    // rebuilding for a new deployment, removal or a real Clock arm transition.
    const armed=state.trails.reduce((mask,trail,index)=>mask|(Number(trail.armed)<<index),0);
    const revision=`${state.placed}/${state.explosions}/${state.trails.length}/${armed}`;
    if(revision!==this.groundRevision){
      this.groundRevision=revision;
      this.ground.clear().setVisible(state.trails.length>0);
      for(const trail of state.trails)this.drawGroundBell(this.ground,trail);
    }
    this.flight.clear().setVisible(state.orbits.length>0);
    const star=state.starActive;
    for(const bell of state.orbits){
      const angle=state.orbitAngle+bell.phase;
      if(this.quality==='standard'){
        const trailLength=bell.width*(star ? .87 : .73);
        drawStar(this.flight,bell.x+Math.sin(angle)*trailLength,bell.y-Math.cos(angle)*trailLength,star ? 3.4 : 1.8,star ? .85 : .47);
      }
      this.flight.save().translateCanvas(bell.x,bell.y).rotateCanvas(Math.sin(angle)*.24)
        .scaleCanvas(bell.width/16,bell.width/16);
      drawBell(this.flight,true);
      if(star)drawStar(this.flight,5.4,-4.7,2.7,1);
      this.flight.restore();
    }
  }

  private drawGroundBell(g: Graphics, trail: Point & {armed: boolean}): void {
    g.save().translateCanvas(trail.x,trail.y).scaleCanvas(N.trailSize/16,N.trailSize/16);
    g.fillStyle(0x543d29,.28).fillEllipse(0,6.8,18,5);
    if(trail.armed){
      g.fillStyle(amber,.29).fillEllipse(0,5.8,23,8);
      g.lineStyle(1.3,0x6b4828,.9).lineBetween(-10,3,-7,5).lineBetween(10,3,7,5);
      g.lineStyle(1,cream,1).lineBetween(-10,2,-7,4).lineBetween(10,2,7,4);
    }
    drawBell(g,trail.armed);
    g.restore();
  }

  private showOriginals(visible: boolean): void {
    if(!this.ability)return;
    for(const group of [this.ability.trails,this.ability.orbits])
      for(const bell of group.getChildren() as Image[])
        if(bell.active&&bell.visible!==visible)bell.setVisible(visible);
  }

  private clearPersistent(): void {
    this.showOriginals(true);
    this.current=null;
    this.groundRevision='';
    this.ground.clear().setVisible(false);
    this.flight.clear().setVisible(false);
  }

  private effect(group: Phaser.GameObjects.Group, point: Point, depth: number, duration: number, alpha=1): Graphics {
    let g=group.getFirstDead(false) as Graphics | null;
    if(!g){
      const cursor=group===this.blasts?this.blastCursor++:this.decorationCursor++;
      g=group.getChildren()[cursor%group.getLength()] as Graphics;
      this.scene.tweens.killTweensOf(g);
    }
    g.clear().setPosition(point.x,point.y).setDepth(depth).setAlpha(alpha).setActive(true).setVisible(true);
    this.scene.tweens.add({targets:g,alpha:0,duration,ease:'Sine.easeOut',onComplete:()=>group.killAndHide(g)});
    return g;
  }

  land(mark: BellTrailFact): void {
    if (!this.enabled || this.finished) return;
    this.landings++;
    this.lastLanding=mark;
    const g=this.effect(this.decoration,mark,.77,190);
    g.lineStyle(1,amber,.8).lineBetween(-4,-10,-2,-6).lineBetween(4,-10,2,-6)
      .fillStyle(0xc59c65,.7).fillEllipse(0,6,15,4);
    if(this.quality==='standard')drawStar(g,6,-5,1.5,.7);
  }

  retire(mark: BellTrailFact): void {
    if (!this.enabled || this.finished) return;
    this.replacements++;
    this.lastReplacement=mark;
    const g=this.effect(this.decoration,mark,.76,175,.42);
    this.drawGroundBell(g,{x:0,y:0,armed:mark.armed});
  }

  blast(mark: BellTrailFact): void {
    if (!this.enabled || this.finished) return;
    this.trailBlasts++;
    this.lastBlast=mark;
    const g=this.effect(this.blasts,mark,1.05,290);
    const r=mark.blastRadius;
    // Draw the actual full radius on the first frame, then fade in place.
    g.setData('trailMark',mark);
    g.fillStyle(0xf6ac55,.2).fillCircle(0,0,r)
      .lineStyle(3.4,0x804327,.62).strokeCircle(0,0,r)
      .lineStyle(1.8,cream,.96).strokeCircle(0,0,r);
    drawStar(g,0,0,8,1);
    const rays=this.quality==='low'?4:8;
    for(let i=0;i<rays;i++){
      const angle=(i+.5)*Math.PI*2/rays, x=Math.cos(angle), y=Math.sin(angle);
      g.lineStyle(2.2,amber,.9).lineBetween(x*r*.37,y*r*.37,x*r*.68,y*r*.68);
      if(this.quality==='standard')drawStar(g,x*r*.78,y*r*.78,2.9,.9);
    }
  }

  orbitHit(point: Point): void {
    if (!this.enabled || this.finished) return;
    this.orbitFlashes++;
    this.lastOrbitHit=point;
    const g=this.effect(this.decoration,point,3.7,160);
    g.fillStyle(0xb26328,.52).fillCircle(0,0,5);
    drawStar(g,0,0,7.8,1);
    if(this.quality==='standard'){
      drawStar(g,-8,4,2,.85);
      drawStar(g,7,-5,2.5,.9);
    }
  }

  private clearPool(group: Phaser.GameObjects.Group): void {
    for(const item of group.getChildren() as Graphics[]){
      this.scene.tweens.killTweensOf(item);
      item.clear();
      item.data?.reset();
      group.killAndHide(item);
    }
  }

  interrupt(): void {
    this.clearPool(this.blasts);
    this.clearPool(this.decoration);
  }

  finish(): void {
    this.finished=true;
    this.interrupt();
    this.clearPersistent();
  }

  reset(): void {
    this.finish();
    this.finished=false;
    this.lastLanding=this.lastBlast=this.lastReplacement=this.lastOrbitHit=null;
    this.landings=this.trailBlasts=this.replacements=this.orbitFlashes=0;
    this.blastCursor=this.decorationCursor=0;
  }

  snapshot() {
    const activeBlasts=this.blasts.countActive(true);
    const activeDecorations=this.decoration.countActive(true);
    const blastOrigins=(this.blasts.getChildren() as Graphics[])
      .filter(g=>g.active).map(g=>g.getData('trailMark') as BellTrailFact);
    return {
      enabled:this.enabled,quality:this.quality,
      orbitCount:this.current?.orbits.length??0,trailCount:this.current?.trails.length??0,
      armedTrails:this.current?.trails.filter(bell=>bell.armed).length??0,
      orbitRadius:this.current?.orbitRadius??null,starActive:this.current?.starActive??false,
      landings:this.landings,trailBlasts:this.trailBlasts,replacements:this.replacements,orbitFlashes:this.orbitFlashes,
      lastLanding:this.lastLanding,lastBlast:this.lastBlast,lastReplacement:this.lastReplacement,lastOrbitHit:this.lastOrbitHit,
      blastOrigins,activeBlasts,activeDecorations,activeEffects:activeBlasts+activeDecorations,
      maxEffects:N.duoTrailMax+decorationSlots,objects:this.cameraObjects.length,physicalBodies:0,
    };
  }

  destroy(): void {
    this.finish();
    this.ability?.observePresentation(null);
    this.ability=null;
    for(const group of [this.blasts,this.decoration]){
      group.clear(true,true);
      group.destroy();
    }
    this.ground.destroy();
    this.flight.destroy();
  }
}
