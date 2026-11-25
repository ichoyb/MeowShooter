import type PhaserType from 'phaser';
import Runtime from './phaser-entry.cjs';
import {dropExperience} from './progression';
import {PICKUP} from './progression-content';
const Phaser=Runtime as typeof PhaserType;
type Sprite=PhaserType.Physics.Arcade.Sprite;
type Body=PhaserType.Physics.Arcade.Body;
const body=(s:Sprite)=>s.body as Body;

// Arcade owns positions/velocity and Group owns reuse. Data Manager owns orb values.
export class ExperiencePickups {
 readonly group:PhaserType.Physics.Arcade.Group;
 private claimed=new Set<number>();private sequence=0;private dropped=0;private collected=0;
 constructor(private scene:PhaserType.Scene){this.group=scene.physics.add.group({classType:Phaser.Physics.Arcade.Sprite,maxSize:PICKUP.capacity});}
 private all():Sprite[]{return this.group.getChildren() as Sprite[];}
 private active():Sprite[]{return this.all().filter(s=>s.active&&body(s).enable);}
 drop(deathId:number,enemyId:string,position:{x:number;y:number}):void {
  const amount=dropExperience(enemyId);if(!amount||this.claimed.has(deathId))return;
  this.claimed.add(deathId);this.dropped+=amount;
  const orb=this.group.get(position.x,position.y,'atlas','spirit-shot') as Sprite|null;
  if(!orb){
   const nearest=this.active().sort((a,b)=>new Phaser.Math.Vector2(a).distanceSq(position)-new Phaser.Math.Vector2(b).distanceSq(position)||a.getData('orbId')-b.getData('orbId'))[0];
   nearest.setData('xp',nearest.getData('xp')+amount);return;
  }
  this.scene.tweens.killTweensOf(orb);
  orb.data?.reset();orb.setTexture('atlas','spirit-shot').setDisplaySize(12,12).setDepth(1.4).setAlpha(1).setAngle(0);
  orb.enableBody(true,position.x,position.y,true,true).setVelocity(0,0);
  body(orb).setCircle(1/Math.abs(orb.scaleX));body(orb).setOffset(orb.width/2-body(orb).halfWidth/Math.abs(orb.scaleX),orb.height/2-body(orb).halfHeight/Math.abs(orb.scaleY));
  body(orb).updateFromGameObject();body(orb).prev.copy(body(orb).position);body(orb).prevFrame.copy(body(orb).position);
  orb.setData({orbId:++this.sequence,xp:amount,magnet:false});
 }
 beforePhysics(player:Sprite,seconds:number,magnetRadius:number=PICKUP.magnetRadius):void {
  const center=body(player).center,zone=new Phaser.Geom.Circle(center.x,center.y,magnetRadius);
  for(const orb of this.active()){
   if(Phaser.Geom.Circle.Contains(zone,body(orb).center.x,body(orb).center.y))orb.setData('magnet',true);
   if(orb.getData('magnet')){
    const distance=new Phaser.Math.Vector2(body(orb).center).distance(center);
    this.scene.physics.moveToObject(orb,center,Math.min(PICKUP.speed,seconds>0?distance/seconds:0));
   }
  }
 }
 collect(player:Sprite):number {
  const cat=body(player),zone=new Phaser.Geom.Circle(0,0,PICKUP.collectRadius);let amount=0;
  for(const orb of this.active()){
   const b=body(orb),x=b.center.x-cat.center.x,y=b.center.y-cat.center.y;
   const path=new Phaser.Geom.Line(b.prev.x+b.halfWidth-cat.prev.x-cat.halfWidth,b.prev.y+b.halfHeight-cat.prev.y-cat.halfHeight,x,y);
   if(Phaser.Geom.Circle.Contains(zone,x,y)||Phaser.Geom.Intersects.LineToCircle(path,zone)){
    amount+=orb.getData('xp');this.scene.tweens.killTweensOf(orb);orb.setAlpha(1).setVelocity(0,0).disableBody(true,true);this.group.killAndHide(orb);
   }
  }
  this.collected+=amount;return amount;
 }
 reset():void {for(const orb of this.all()){this.scene.tweens.killTweensOf(orb);orb.setAlpha(1).setVelocity(0,0).disableBody(true,true);this.group.killAndHide(orb);}this.claimed.clear();this.sequence=0;this.dropped=0;this.collected=0;}
 snapshot(){const active=this.active();return {active:active.length,total:this.group.getLength(),droppedXP:this.dropped,collectedXP:this.collected,
  groundXP:active.reduce((sum,orb)=>sum+orb.getData('xp'),0),orbs:active.map(o=>({id:o.getData('orbId'),x:body(o).center.x,y:body(o).center.y,xp:o.getData('xp'),magnet:o.getData('magnet')}))};}
}
