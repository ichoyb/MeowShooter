import type Phaser from 'phaser';
import {chooseHuntTarget,chooseHuntTransfer,getMarkedTarget,type HuntCandidate} from './hunt-targeting';
import {GROWTH_NUMBERS as N} from './progression-content';
import type {Point} from './rules';

type Mark={targetId:number|null;transferred:boolean};
export type HuntMarkSnapshot={enabled:boolean;targetId:number|null;remainingSeconds:number;transferred:boolean;windows:number;transfers:number;boostedHits:number;bonusDamage:number};
export const emptyHuntMark=():HuntMarkSnapshot=>({enabled:false,targetId:null,remainingSeconds:0,transferred:false,windows:0,transfers:0,boostedHits:0,bonusDamage:0});

// One business birth ID on the owner; the native Clock owns its whole window.
// Candidate coordinates are read from the actual Group, never mirrored here.
export class HuntMark{
 private timer:Phaser.Time.TimerEvent|null=null;
 private readonly graphic:Phaser.GameObjects.Graphics;
 private enabled=false;private transferEnabled=false;
 private windows=0;private transfers=0;private boostedHits=0;private bonusDamage=0;
 constructor(private readonly scene:Phaser.Scene,private readonly owner:Phaser.GameObjects.GameObject,
  private readonly candidates:()=>HuntCandidate[],private readonly origin:()=>Point,private readonly range:()=>number){
  this.graphic=scene.add.graphics().setDepth(1.1).setVisible(false);
  this.owner.setData('huntMark',{targetId:null,transferred:false});
  scene.events.once('shutdown',()=>this.clear());
 }
 private get mark():Mark{return this.owner.getData('huntMark');}
 private setMark(targetId:number|null,transferred=false):void{this.owner.setData('huntMark',{targetId,transferred});}
 private chooseWindow():void{
  if(!this.enabled)return;
  this.windows++;
  this.setMark(chooseHuntTarget(this.origin(),this.candidates(),this.range())?.id??null);
 }
 update(enabled:boolean,transferEnabled:boolean):void{
  if(!enabled){if(this.enabled)this.clear();return;}
  this.transferEnabled=transferEnabled;
  if(!this.enabled){
   this.enabled=true;this.chooseWindow();
   this.timer=this.scene.time.addEvent({delay:N.huntPeriodSeconds*1000,loop:true,callback:()=>this.chooseWindow()});
  }
  const mark=this.mark;
  if(mark.targetId!==null&&!this.candidates().some(t=>t.id===mark.targetId&&t.alive&&t.hp>0))this.setMark(null,mark.transferred);
 }
 preferredTarget():HuntCandidate|null{
  return this.enabled&&this.remaining()>0?getMarkedTarget(this.origin(),this.candidates(),this.mark.targetId,this.range()):null;
 }
 multiplier(targetId:number,source:string,kind:string):number{
  return this.enabled&&this.remaining()>0&&source==='PRIMARY'&&kind==='enemy'&&targetId===this.mark.targetId?N.huntDamageMultiplier:1;
 }
 recordHit(damage:number,multiplier:number):void{
  if(multiplier>1){this.boostedHits++;this.bonusDamage+=damage-damage/multiplier;}
 }
 died(birthId:number,position:Point):HuntCandidate|null{
  const mark=this.mark;
  if(!this.enabled||birthId!==mark.targetId)return null;
  if(this.remaining()<=0||!this.transferEnabled||mark.transferred){this.setMark(null,mark.transferred);return null;}
  const next=chooseHuntTransfer(position,this.candidates(),birthId);
  this.setMark(next?.id??null,!!next);
  if(next)this.transfers++;
  return next;
 }
 private remaining():number{return this.enabled&&this.timer?Math.max(0,this.timer.getRemaining()/1000):0;}
 draw():void{
  this.graphic.clear().setVisible(false);
  if(!this.enabled||this.mark.targetId===null||this.remaining()<=0)return;
  const t=this.candidates().find(t=>t.id===this.mark.targetId&&t.alive&&t.hp>0);if(!t)return;
  const r=18,arm=5;this.graphic.setVisible(true).lineStyle(1.5,0xf0b34b,.9);
  for(const sx of [-1,1])for(const sy of [-1,1]){
   this.graphic.lineBetween(t.x+sx*r,t.y+sy*(r-arm),t.x+sx*r,t.y+sy*r);
   this.graphic.lineBetween(t.x+sx*r,t.y+sy*r,t.x+sx*(r-arm),t.y+sy*r);
  }
  this.graphic.fillStyle(0xf8ce71,.9).fillPoints([{x:t.x,y:t.y-r-7},{x:t.x+3,y:t.y-r-4},{x:t.x,y:t.y-r-1},{x:t.x-3,y:t.y-r-4}],true);
 }
 snapshot():HuntMarkSnapshot{
  return {enabled:this.enabled,targetId:this.mark.targetId,remainingSeconds:this.remaining(),transferred:this.mark.transferred,windows:this.windows,transfers:this.transfers,boostedHits:this.boostedHits,bonusDamage:this.bonusDamage};
 }
 clear():void{
  if(this.timer){this.scene.time.removeEvent(this.timer);this.timer.destroy();this.timer=null;}
  this.enabled=false;this.transferEnabled=false;this.windows=0;this.transfers=0;this.boostedHits=0;this.bonusDamage=0;
  this.owner.data?.set('huntMark',{targetId:null,transferred:false});
  if(this.graphic.scene)this.graphic.clear().setVisible(false);
 }
}
