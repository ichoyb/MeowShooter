import type Phaser from 'phaser';
import type {DefenseSnapshot,IncomingDamageFact,Point} from './rules';

type Station=Readonly<{id:number;x:number;y:number;attached:boolean}>;
type Shot=Readonly<{deploymentId:number;angle:number}>;

const shieldOutline = [
 {x:0,y:-25},{x:18,y:-19},{x:24,y:-5},{x:21,y:14},
 {x:0,y:24},{x:-21,y:14},{x:-24,y:-5},{x:-18,y:-19},
];
const shieldInner = shieldOutline.map(({x,y})=>({x:x*.82,y:y*.82}));
const shieldTones = [0xd8fff1,0xb6f2eb,0x5dabb8,0x91d9dc,0x65bbc4,0x8ed8db,0xc5f5ed,0xeafff4];
const shieldRestAlpha = .86;
const cannonScale = 18/64;
const carriedOffset = {x:26,y:-14};
const starMarkOutline = [{x:0,y:-6},{x:2,y:-2},{x:6,y:0},{x:2,y:2},{x:0,y:6},{x:-2,y:2},{x:-6,y:0},{x:-2,y:-2}];

/** G6 opt-in art pilot. No damage, targeting, random, collision, or rule clock. */
export class G6RewardPresentation {
 private enabled=true;
 private player:Point={x:0,y:0};
 private quality:'standard'|'low'='standard';
 private leaves:Phaser.GameObjects.Group;
 private labels:Phaser.GameObjects.Group;
 private shield:Phaser.GameObjects.Graphics;
 private guard:Phaser.GameObjects.Container;
 private hull:Phaser.GameObjects.Image;
 private cannon:Phaser.GameObjects.Image;
 private muzzle:Phaser.GameObjects.Graphics;
 private guardBase:Phaser.GameObjects.Graphics;
 private spirit:Phaser.GameObjects.Image;
 private spiritMark:Phaser.GameObjects.Graphics;
 private spiritFlash:Phaser.GameObjects.Image;
 private spiritShots=0;
 private seenSpiritShots=0;
 private reloadBursts=0;
 private lastReloadAmount=0;
 private guardAttached=false;
 private guardOffset:Point={x:0,y:0};
 private healTimer:Phaser.Time.TimerEvent|null=null;
 private pendingHealing=0;
 private healOrigin:Point={x:0,y:0};
 private healBatches=0;
 private displayedHealing=0;
 private shieldBreaks=0;
 private shieldValue=0;
 private stationId:number|null=null;
 private seenShots=0;
 private guardedShots=0;
 private retirements=0;

 constructor(private scene:Phaser.Scene){
  this.leaves=scene.add.group({maxSize:8});
  this.labels=scene.add.group({maxSize:4});
  for(let i=0;i<8;i++)this.leaves.add(scene.add.image(0,0,'g6-leaf').setDepth(4).setActive(false).setVisible(false));
  for(let i=0;i<4;i++)this.labels.add(scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'12px',fontStyle:'bold',color:'#d9ffe8',stroke:'#235a47',strokeThickness:2}).setOrigin(.5).setDepth(6).setActive(false).setVisible(false));
  this.shield=scene.add.graphics().setDepth(3.5).setVisible(false);
  this.guardBase=scene.add.graphics();
  this.hull=scene.add.image(0,-2,'g6-guard').setDisplaySize(30,30);
  this.cannon=scene.add.image(8,3,'g6-cannon').setScale(cannonScale).setOrigin(.22,.5);
  this.muzzle=scene.add.graphics()
   .fillStyle(0xf6c876,.9).fillPoints([{x:8,y:0},{x:2,y:2},{x:-1,y:5},{x:-3,y:1},{x:-5,y:0},{x:-3,y:-1},{x:-1,y:-5},{x:2,y:-2}],true)
   .fillStyle(0xfffce3,1).fillCircle(0,0,2.4).setAlpha(0);
  this.guard=scene.add.container(0,0,[this.guardBase,this.cannon,this.hull,this.muzzle]).setDepth(2.8).setVisible(false);
  this.spirit=scene.add.image(0,0,'g6-spirit').setDisplaySize(28,28).setDepth(3).setVisible(false);
  this.spiritMark=scene.add.graphics().setDepth(5).setVisible(false)
   .fillStyle(0xfaf1ff).fillPoints(starMarkOutline,true).lineStyle(1.5,0x7851a6).strokePoints(starMarkOutline,true);
  this.spiritFlash=scene.add.image(0,0,'g6-spirit').setDepth(5).setVisible(false);
  this.drawGuardBase();
 }
 setQuality(quality:'standard'|'low'){this.quality=quality;}
 setEnabled(value:boolean){
  if(this.enabled===value)return;
  this.interrupt();this.enabled=value;
  this.shield.setVisible(false);this.guard.setVisible(false);this.shieldValue=0;this.stationId=null;
  this.spirit.setVisible(false);this.spiritMark.setVisible(false);
 }
 heal(amount:number,origin:Point){
  if(!this.enabled||!Number.isFinite(amount)||amount<=0)return;
  this.pendingHealing+=amount;this.healOrigin={...origin};
  if(!this.healTimer)this.healTimer=this.scene.time.delayedCall(250,()=>{
   const actual=this.pendingHealing;this.pendingHealing=0;this.healTimer=null;
   if(!this.enabled||actual<=0)return;
   this.healBatches++;this.displayedHealing+=actual;
   const label=this.labels.getFirstDead(false) as Phaser.GameObjects.Text|null;
   if(label){
    label.setText('+'+Number(actual.toFixed(2))).setColor('#d9ffe8').setStroke('#235a47',2)
     .setPosition(this.player.x,this.player.y-28).setAlpha(1).setScale(1).setActive(true).setVisible(true);
    this.scene.tweens.add({targets:label,y:label.y-12,alpha:0,duration:750,ease:'Sine.easeOut',onComplete:()=>this.labels.killAndHide(label)});
   }
   const count=this.quality==='low'?1:3;
   for(let i=0;i<count;i++){
    const leaf=this.leaves.getFirstDead(false) as Phaser.GameObjects.Image|null;if(!leaf)break;
    const near={x:this.player.x+(i-1)*14,y:this.player.y+14};
    const far=Math.hypot(this.healOrigin.x-this.player.x,this.healOrigin.y-this.player.y)>8?this.healOrigin:near;
    leaf.setTexture('g6-leaf').setPosition(far.x+(i-1)*5,far.y+i*4).setDisplaySize(8,11).setRotation((i-1)*.6).setAlpha(.9).setActive(true).setVisible(true);
    this.scene.tweens.add({targets:leaf,x:this.player.x,y:this.player.y-2,alpha:0,angle:leaf.angle+65,duration:400+i*40,ease:'Sine.easeInOut',onComplete:()=>this.leaves.killAndHide(leaf)});
   }
  });
 }
 reloadShield(actual:number,weapon:Point,player:Point){
  if(!this.enabled||!Number.isFinite(actual)||actual<=0)return;
  this.reloadBursts++;
  this.lastReloadAmount=actual;
  const side=weapon.x<player.x?-1:1;
  const label=this.labels.getFirstDead(false) as Phaser.GameObjects.Text|null;
  if(label){
   label.setText('盾 +'+Number(actual.toFixed(2))).setColor('#e2fdff').setStroke('#245e79',2)
    .setPosition(player.x+side*25,player.y-21).setAlpha(1).setScale(1).setActive(true).setVisible(true);
   this.scene.tweens.add({targets:label,y:label.y-12,alpha:0,duration:660,ease:'Sine.easeOut',onComplete:()=>this.labels.killAndHide(label)});
  }
  const count=this.quality==='low'?1:3;
  for(let i=0;i<count;i++){
   const shard=this.leaves.getFirstDead(false) as Phaser.GameObjects.Image|null;
   if(!shard)break;
   shard.setTexture('g6-shard').setPosition(weapon.x,weapon.y+(i-1)*4)
    .setDisplaySize(7,7).setRotation(side*(i-1)*.4).setAlpha(1).setActive(true).setVisible(true);
   const fromX=shard.x-player.x,fromY=shard.y-player.y;
   const toX=side*(17+i*2),toY=-12+i*8;
   this.scene.tweens.add({targets:shard,alpha:0,duration:155+i*27,ease:'Sine.easeOut',
    onUpdate:()=>shard.setPosition(this.player.x+toX+(fromX-toX)*shard.alpha,this.player.y+toY+(fromY-toY)*shard.alpha),
    onComplete:()=>this.leaves.killAndHide(shard)});
  }
 }
 syncSpirit(origin:Point|null,emitted:number,elapsed:number,animate=true){
  this.spirit.setVisible(this.enabled&&origin!==null);
  if(this.enabled&&origin){
   const bob=this.quality==='low'?0:Math.sin(elapsed*Math.PI*2/1.8)*1.5;
   this.spirit.setPosition(origin.x,origin.y+bob);
   if(animate&&emitted>this.seenSpiritShots){
    this.spiritShots++;
    this.scene.tweens.killTweensOf(this.spirit);
    this.spirit.setDisplaySize(31,31).setAlpha(1);
    this.scene.tweens.add({targets:this.spirit,scaleX:28/96,scaleY:28/96,alpha:.93,duration:190,ease:'Sine.easeOut'});
   }
  }
  this.seenSpiritShots=emitted;
 }
 syncSpiritMark(position:Point|null){
  this.spiritMark.setVisible(this.enabled&&position!==null);
  if(position)this.spiritMark.setPosition(position.x,position.y);
 }
 flashSpiritMark(position:Point){
  if(!this.enabled)return;
  this.scene.tweens.killTweensOf(this.spiritFlash);
  this.spiritFlash.setPosition(position.x,position.y).setDisplaySize(13,13).setAlpha(.85).setVisible(true);
  this.scene.tweens.add({targets:this.spiritFlash,scaleX:21/96,scaleY:21/96,alpha:0,duration:150,
   onComplete:()=>this.spiritFlash.setVisible(false)});
 }
 incoming(fact:IncomingDamageFact){
  if(!this.enabled||!fact.accepted||fact.shieldAbsorbed<=0)return;
  this.scene.tweens.killTweensOf(this.shield);
  this.shield.setScale(1.07).setAlpha(1);
  this.scene.tweens.add({targets:this.shield,scaleX:1,scaleY:1,alpha:shieldRestAlpha,duration:200,ease:'Sine.easeOut'});
  if(!fact.shieldBroke)return;
  this.shieldBreaks++;
  for(let i=0;i<4;i++){
   const shard=this.leaves.getFirstDead(false) as Phaser.GameObjects.Image|null;if(!shard)break;
   const angle=(i+.5)*Math.PI/2,x=Math.cos(angle),y=Math.sin(angle);
   const size=i%2===0?10:8;
   shard.setTexture('g6-shard').setPosition(this.player.x+x*20,this.player.y+2+y*19).setDisplaySize(size,size)
    .setRotation(angle).setAlpha(.95).setActive(true).setVisible(true);
   this.scene.tweens.add({targets:shard,x:shard.x+x*13,y:shard.y+y*13,alpha:0,angle:shard.angle+(i%2===0?40:-40),
    duration:290,ease:'Sine.easeOut',onComplete:()=>this.leaves.killAndHide(shard)});
  }
 }
 private drawShield(ratio:number){
  // Colour stays on the glass rim. The face and hands sit in the clear centre.
  this.shield.fillStyle(0xcffef2,.05*ratio).fillPoints(shieldInner,true);
  for(let i=0;i<shieldOutline.length;i++){
   const next=(i+1)%shieldOutline.length;
   const a=shieldOutline[i],b=shieldOutline[next],c=shieldInner[next],d=shieldInner[i];
   this.shield.fillStyle(shieldTones[i],.28+.37*ratio).fillPoints([a,b,c,d],true);
   this.shield.fillStyle(0xf5fff4,.12+.27*ratio).fillPoints([a,b,d],true);
  }
  this.shield.lineStyle(1.2,0x23677d,.36+.29*ratio).strokePoints(shieldOutline,true);
  this.shield.lineStyle(.9,0xeafff9,.36+.45*ratio).strokePoints(shieldInner,true);
  this.shield.lineStyle(1,0xffffe6,.35+.55*ratio)
   .lineBetween(-12,-21,-4,-24).lineBetween(-19,-15,-22,-8);
 }
 private aimGuard(angle:number){
  // The side mount keeps the visor clear as the barrel tracks actual shots.
  const side=Math.cos(angle)>=0?1:-1;
  this.cannon.setPosition(side*9,3).setRotation(angle);
 }
 private drawGuardBase(){
  const base=this.guardBase.clear();
  if(this.guardAttached){
   base.fillStyle(0x4ba7ba,.26).fillEllipse(0,12,25,8)
    .lineStyle(1.2,0xc2f8ee,.86).strokeEllipse(0,12,22,6)
    .fillStyle(0xffedb3,.9).fillTriangle(-4,16,4,16,0,20);
  }else{
   base.fillStyle(0x285b52,.12).fillEllipse(0,12,32,11)
    .fillStyle(0x285b52,.18).fillEllipse(0,12,23,7);
  }
 }
 private retireGuard(animate:boolean){
  if(this.stationId===null)return;
  this.retirements++;
  this.scene.tweens.killTweensOf([this.hull,this.cannon,this.muzzle,this.guardOffset]);
  this.muzzle.setAlpha(0);
  const ghost=animate?this.leaves.getFirstDead(false) as Phaser.GameObjects.Image|null:null;
  if(ghost){
   ghost.setTexture('g6-guard').setPosition(this.guard.x,this.guard.y-2).setDisplaySize(30,30).setRotation(0).setAlpha(.4).setActive(true).setVisible(true);
   this.scene.tweens.add({targets:ghost,y:ghost.y+5,alpha:0,duration:160,onComplete:()=>this.leaves.killAndHide(ghost)});
  }
  this.stationId=null;
 }
 sync(player:Point,defense:DefenseSnapshot,station:Station|null,emitted:number,lastShot:Shot|null,animateEntry=true){
  this.player={...player};
  if(!this.enabled){this.seenShots=emitted;return;}
  const positive=defense.shield>0,ratio=defense.maxShield>0?defense.shield/defense.maxShield:0;
  if(positive&&this.shieldValue<=0){
   this.scene.tweens.killTweensOf(this.shield);
   this.shield.setScale(animateEntry ? .82 : 1).setAlpha(animateEntry ? .8 : shieldRestAlpha);
   if(animateEntry)this.scene.tweens.add({targets:this.shield,scaleX:1,scaleY:1,alpha:shieldRestAlpha,duration:220,ease:'Sine.easeOut'});
  }
  this.shieldValue=defense.shield;
  this.shield.clear().setPosition(player.x,player.y+2).setVisible(positive);
  if(positive)this.drawShield(ratio);
  if(!station){
   this.retireGuard(animateEntry);
   this.guard.setVisible(false);this.seenShots=emitted;return;
  }
  // Real expiry and redeployment can occur in one update: retire at the OLD position.
  if(station.id!==this.stationId)this.retireGuard(animateEntry);
  const newStation=station.id!==this.stationId;
  if(newStation){
   this.stationId=station.id;
   this.guardAttached=station.attached;
   Object.assign(this.guardOffset,station.attached?carriedOffset:{x:0,y:0});
   this.drawGuardBase();
   this.hull.setY(animateEntry ? 3 : -2).setAlpha(animateEntry ? .2 : 1);this.cannon.setScale(cannonScale);
   this.aimGuard(0);
   if(animateEntry)this.scene.tweens.add({targets:this.hull,y:-2,alpha:1,duration:220,ease:'Back.easeOut'});
  }else if(this.guardAttached!==station.attached){
   this.guardAttached=station.attached;
   this.drawGuardBase();
   this.scene.tweens.killTweensOf(this.guardOffset);
   this.guardOffset.x=this.guard.x-station.x;
   this.guardOffset.y=this.guard.y-station.y;
   const target=station.attached?carriedOffset:{x:0,y:0};
   if(animateEntry)this.scene.tweens.add({targets:this.guardOffset,x:target.x,y:target.y,duration:180,ease:'Sine.easeOut'});
   else Object.assign(this.guardOffset,target);
  }
  this.guard.setPosition(station.x+this.guardOffset.x,station.y+this.guardOffset.y).setVisible(true);
  if(lastShot?.deploymentId===station.id){
   this.aimGuard(lastShot.angle);
   if(animateEntry&&emitted>this.seenShots){
    this.guardedShots++;
    this.scene.tweens.killTweensOf([this.cannon,this.muzzle]);
    this.cannon.setScale(cannonScale);
    this.scene.tweens.add({targets:this.cannon,scaleX:15/64,scaleY:19/64,duration:60,yoyo:true,ease:'Sine.easeOut'});
    const tip=12;
    this.muzzle.setPosition(this.cannon.x+Math.cos(lastShot.angle)*tip,this.cannon.y+Math.sin(lastShot.angle)*tip)
     .setRotation(lastShot.angle).setAlpha(1).setScale(.7);
    this.scene.tweens.add({targets:this.muzzle,alpha:0,scaleX:1.12,scaleY:1.12,duration:125,ease:'Sine.easeOut'});
   }
  }
  this.seenShots=emitted;
 }
 interrupt(){
  if(this.healTimer){this.scene.time.removeEvent(this.healTimer);this.healTimer.destroy();this.healTimer=null;}
  this.pendingHealing=0;
  for(const group of [this.leaves,this.labels])for(const child of group.getChildren()){
   this.scene.tweens.killTweensOf(child);group.killAndHide(child);
  }
  this.scene.tweens.killTweensOf([this.shield,this.hull,this.cannon,this.muzzle,this.guardOffset,this.spirit,this.spiritFlash]);
  this.spiritFlash.setVisible(false);
  const offset=this.guardAttached?carriedOffset:{x:0,y:0};
  if(this.guard.visible)this.guard.setPosition(this.guard.x-this.guardOffset.x+offset.x,this.guard.y-this.guardOffset.y+offset.y);
  Object.assign(this.guardOffset,offset);
  this.shield.setScale(1).setAlpha(shieldRestAlpha);
  this.hull.setY(-2).setAlpha(1);this.cannon.setScale(cannonScale);this.muzzle.setAlpha(0);
  this.spirit.setDisplaySize(28,28).setAlpha(.93);
 }
 reset(){
  this.interrupt();this.guard.setVisible(false);this.shield.setVisible(false);
  this.spirit.setVisible(false);this.spiritMark.setVisible(false);
  this.stationId=null;this.seenShots=0;this.shieldValue=0;
  this.healBatches=0;this.displayedHealing=0;this.shieldBreaks=0;this.guardedShots=0;this.retirements=0;
  this.spiritShots=0;this.seenSpiritShots=0;this.reloadBursts=0;this.lastReloadAmount=0;
 }
 snapshot(){return {enabled:this.enabled,pendingHealing:this.pendingHealing,healBatches:this.healBatches,displayedHealing:this.displayedHealing,
  shieldVisible:this.shield.visible,shieldValue:this.shieldValue,shieldBreaks:this.shieldBreaks,stationId:this.stationId,guardVisible:this.guard.visible,guardedShots:this.guardedShots,retirements:this.retirements,
  guardAttached:this.guard.visible&&this.guardAttached,guardPosition:{x:this.guard.x,y:this.guard.y},
  spiritVisible:this.spirit.visible,spiritShots:this.spiritShots,reloadBursts:this.reloadBursts,lastReloadAmount:this.lastReloadAmount,
  spiritMarkVisible:this.spiritMark.visible,activeEffects:this.leaves.countActive(true)+this.labels.countActive(true)+Number(this.muzzle.alpha>0)+Number(this.spiritFlash.visible),
  objects:this.leaves.getLength()+this.labels.getLength()+this.guard.length+5,physicalBodies:0,pendingTimers:Number(!!this.healTimer)};}
 destroy(){this.reset();this.leaves.clear(true,true);this.leaves.destroy();this.labels.clear(true,true);this.labels.destroy();this.shield.destroy();this.guard.destroy(true);this.spirit.destroy();this.spiritMark.destroy();this.spiritFlash.destroy();}
}
