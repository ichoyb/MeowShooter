import type Phaser from 'phaser';
import type {HuntMarkSnapshot} from './hunt-mark';
import type {Point} from './rules';
import {MOVEMENT_CONTRACT_NUMBERS, type MovementContext} from './contract-rules';

type MarkTarget = Point & {height:number};
type ContractState = MovementContext & {stance:number};
type Pulse = Point & {id:number};
type Ink = Phaser.GameObjects.Graphics;

export class G6HuntContractPresentation {
  private readonly mark:Ink;
  private readonly link:Ink;
  private readonly stance:Ink;
  private readonly skill:Ink;
  private readonly weapon:Ink;
  private readonly transients:Ink[];
  private enabled = true;
  private low = false;
  private seenPulse = 0;
  private markedId:number|null = null;
  private stanceState:'dash'|'charging'|'rooted'|null = null;
  private counts = {transfers:0, skill:0, weapon:0};
  private lastTransfer:{from:Point; to:Point}|null = null;

  constructor(private readonly scene:Phaser.Scene) {
    this.mark = scene.add.graphics().setDepth(2.35).setVisible(false);
    this.link = scene.add.graphics().setDepth(2.34).setVisible(false);
    this.stance = scene.add.graphics().setDepth(1.13).setVisible(false);
    this.skill = scene.add.graphics().setDepth(1.25).setVisible(false);
    this.weapon = scene.add.graphics().setDepth(2.2).setVisible(false);
    this.transients = [this.link,this.skill,this.weapon];
  }

  setEnabled(enabled:boolean):void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.interrupt();
    this.mark.clear().setVisible(false);
    this.stance.clear().setVisible(false);
    this.markedId = null;
    this.stanceState = null;
  }

  setQuality(quality:'standard'|'low'):void { this.low = quality === 'low'; }

  syncMark(state:HuntMarkSnapshot|null, target:MarkTarget|null, inRange:boolean):void {
    const g = this.mark.clear().setVisible(false);
    this.markedId = null;
    if (!this.enabled || !target || !state?.enabled || state.targetId === null || state.remainingSeconds <= 0) return;
    this.markedId = state.targetId;
    g.setPosition(target.x,target.y-target.height/2-6).setVisible(true);
    const alpha = inRange ? .98 : .65;
    const ink = state.transferred ? 0xf7d388 : 0xffe9a3;
    g.fillStyle(0x604535,alpha).fillPoints([
      {x:-8,y:-4},{x:-4,y:-1},{x:0,y:-7},{x:4,y:-1},{x:8,y:-4},
      {x:5,y:5},{x:-5,y:5},
    ],true);
    g.fillStyle(ink,alpha).fillPoints([
      {x:-5.7,y:-2},{x:-2.6,y:.2},{x:0,y:-4},{x:2.6,y:.2},{x:5.7,y:-2},
      {x:3.8,y:3},{x:-3.8,y:3},
    ],true);
    if (!this.low && state.transferred) g.fillStyle(0xfff5d3,alpha).fillCircle(0,1,1.35);
  }

  transfer(from:Point,to:Point):void {
    if (!this.enabled) return;
    this.counts.transfers++;
    this.lastTransfer = {from:{...from},to:{...to}};
    const mx = (from.x+to.x)/2, my = (from.y+to.y)/2-12;
    const g = this.link.clear().setVisible(true);
    g.lineStyle(2.8,0x8d603c,.52).strokePoints([from,{x:mx,y:my},to]);
    g.lineStyle(1.2,0xffe9a2,.93).strokePoints([from,{x:mx,y:my},to]);
    g.fillStyle(0xfff2b8,.97).fillPoints([
      {x:mx,y:my-4},{x:mx+3,y:my},{x:mx,y:my+4},{x:mx-3,y:my},
    ],true);
    this.fade(g,190);
  }

  syncContract(point:Point, displacement:Point, state:ContractState, dash:boolean, root:boolean,
    spell:boolean, pulse:Pulse|null, animate:boolean):void {
    if (pulse && pulse.id !== this.seenPulse) {
      this.seenPulse = pulse.id;
      if (this.enabled && spell && animate) this.spellPulse(pulse);
    }
    const g = this.stance.clear().setVisible(false);
    this.stanceState = null;
    if (!this.enabled) return;
    if (dash && state.moving) {
      const length = Math.hypot(displacement.x,displacement.y);
      if (length === 0) return;
      this.stanceState = 'dash';
      const dx = displacement.x/length, dy = displacement.y/length;
      const x = point.x-dx*17, y = point.y+9-dy*14;
      g.setPosition(x,y).setVisible(true);
      g.lineStyle(1.8,0x306a59,.77).lineBetween(dx*5,dy*5,-dx*6,-dy*6);
      g.lineStyle(1,0xd5ffe5,.95).lineBetween(dx*4,dy*4,-dx*5,-dy*5);
      if (!this.low) g.lineBetween(-dx*8+dy*4,-dy*8-dx*4,-dx*13+dy*4,-dy*13-dx*4);
    }
    if (root && !state.moving) {
      const ratio = Math.min(1,state.stationarySeconds/MOVEMENT_CONTRACT_NUMBERS.chargeSeconds);
      const rooted = state.stance === MOVEMENT_CONTRACT_NUMBERS.stationaryBenefit;
      this.stanceState = rooted ? 'rooted' : 'charging';
      g.setPosition(point.x,point.y+15).setVisible(true);
      g.lineStyle(2,0x5e6e46,.68).lineBetween(-8,0,8,0);
      if (ratio>0) g.lineStyle(1.4,0xffed9f,.98).lineBetween(-8,0,-8+16*ratio,0);
      if (rooted) {
        g.fillStyle(0xf5d875,.96).fillTriangle(-9,0,-5,-3,-5,3).fillTriangle(9,0,5,-3,5,3);
        if (!this.low) g.lineStyle(1,0x739851,.7).lineBetween(-11,3,-7,3).lineBetween(7,3,11,3);
      }
    }
  }

  weaponVolley(point:Point,direction:Point):void {
    if (!this.enabled) return;
    this.counts.weapon++;
    const g = this.weapon.clear().setPosition(point.x,point.y).setVisible(true);
    const angle = Math.atan2(direction.y,direction.x);
    for (const offset of this.low ? [0] : [-.24,0,.24]) {
      const x = Math.cos(angle+offset), y = Math.sin(angle+offset);
      g.lineStyle(2.8,0xbd7340,.74).lineBetween(x*16,y*16,x*25,y*25);
      g.lineStyle(1.3,0xffefa8,1).lineBetween(x*17,y*17,x*23,y*23);
    }
    this.fade(g,120);
  }

  private spellPulse(point:Point):void {
    this.counts.skill++;
    const g = this.skill.clear().setPosition(point.x,point.y).setVisible(true);
    g.lineStyle(1.4,0xe3fff0,.94).strokePoints([
      {x:0,y:-11},{x:9,y:0},{x:0,y:11},{x:-9,y:0},
    ],true);
    for (const x of this.low ? [0] : [-13,0,13]) {
      g.fillStyle(0x246f6c,.82).fillTriangle(x-3,2,x+3,2,x,-5);
      g.fillStyle(0xb5ffdd,1).fillTriangle(x-1.5,1,x+1.5,1,x,-3);
    }
    this.fade(g,210);
  }

  private fade(g:Ink,duration:number):void {
    this.scene.tweens.killTweensOf(g);
    g.setAlpha(1);
    this.scene.tweens.add({targets:g,alpha:0,duration,ease:'Quad.easeIn',onComplete:()=>{g.clear().setVisible(false);}});
  }

  interrupt():void {
    for (const g of this.transients) {
      this.scene.tweens.killTweensOf(g);
      g.clear().setVisible(false);
    }
  }

  reset():void {
    this.interrupt();
    this.mark.clear().setVisible(false);
    this.stance.clear().setVisible(false);
    this.seenPulse = 0;
    this.markedId = null;
    this.stanceState = null;
    this.counts = {transfers:0,skill:0,weapon:0};
    this.lastTransfer = null;
  }

  snapshot() {
    return {markedId:this.markedId,stance:this.stanceState,counts:{...this.counts},lastTransfer:this.lastTransfer,
      activeTransients:this.transients.filter(g=>g.visible).length};
  }
}
