import type Phaser from 'phaser';
import type {EnemyId} from './level-config';
import type {EnemyState} from './enemy-behavior';
import bossArt from './boss-art.json';

// Display-only native nodes. Physics and damage remain on the owning Sprite.
export class EnemyPresentation {
 private root:Phaser.GameObjects.Container;
 private body:Phaser.GameObjects.Image;
 private feet:Phaser.GameObjects.Image;
 private second:Phaser.GameObjects.Image|null=null;
 private motion={float:0};
 private phase='';
 private id:EnemyId='E01';
 private size=32;
 private bossFace=-1;
 private drop:Phaser.Time.TimerEvent|null=null;
 private impactOffset=0;
 constructor(private scene:Phaser.Scene){
  this.feet=scene.add.image(0,0,'atlas','e02-feet');
  this.body=scene.add.image(0,0,'atlas','enemy-0');
  this.root=scene.add.container(0,0,[this.feet,this.body]).setDepth(1).setVisible(false);
 }
 objects():Phaser.GameObjects.Image[] {return [this.feet,this.body,...this.second?[this.second]:[]];}
 showImpactOffset(offset:number):void {this.root.x+=offset-this.impactOffset;this.impactOffset=offset;}
 clearImpactOffset():void {this.showImpactOffset(0);}
 reset(id:EnemyId,size:number):void {
  this.clear();this.id=id;this.size=size;this.phase='';this.motion.float=0;this.bossFace=-1;
  const origin=id==='E02'?124/128:.5;
  this.body.setTexture('atlas',id==='E01'?'enemy-0':id.toLowerCase()+'-body').setOrigin(.5,origin).setPosition(0,0).setAngle(0);
  this.feet.setTexture('atlas','e02-feet').setOrigin(.5,origin).setPosition(0,0).setScale(1).setAngle(0).setVisible(id!=='E01');
  const sourceSize=id==='B01'?256:128;
  this.root.setScale(size/sourceSize).setAngle(0).setAlpha(1).setVisible(true);this.second?.setVisible(false);
  if(id==='E01')this.scene.tweens.add({targets:this.motion,float:-1.2,duration:700,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  if(id==='E03'){
   this.feet.setTexture('enemy-parts','e03-tail').setOrigin(100/128,49/128).setPosition(36,-15);
   this.scene.tweens.add({targets:this.feet,angle:6,duration:500,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }
  if(id==='E04'){
   this.feet.setTexture('enemy-parts','e04-mouth').setOrigin(71.5/128,.5).setPosition(7.5,0);
   // Mouth is foreground; tail / feet remain behind their body.
   this.root.bringToTop(this.feet);
   this.scene.tweens.add({targets:this.root,angle:1.5,duration:850,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }else this.root.sendToBack(this.feet);
  if(id==='EL01'||id==='B01'){
   if(!this.second){this.second=this.scene.add.image(0,0,'enemy-parts','el01-arm-right');this.root.addAt(this.second,1);}
   const pivots=id==='EL01'?[[30,80,0,0],[108,81,0,0]]:[[62,162,0,124],[153,163,88,120]];
   [this.feet,this.second].forEach((part,i)=>{
    const [x,y,left,top]=pivots[i],approved=bossArt.paws[i];
    const px=id==='B01'?approved.pivot[0]:x,py=id==='B01'?approved.pivot[1]:y;
    part.setTexture('enemy-parts',id.toLowerCase()+(id==='EL01'?'-arm-':'-paw-')+(i?'right':'left')).setOrigin(id==='B01'?approved.origin[0]:(x-left)/128,id==='B01'?approved.origin[1]:(y-top)/128).setPosition(px-sourceSize/2,py-sourceSize/2).setScale(1).setAngle(0).setVisible(true).setData('restX',px-sourceSize/2).setData('restY',py-sourceSize/2);
    if(id==='B01')this.root.bringToTop(part);else this.root.sendToBack(part);
   });
  }
 }
 sync(x:number,y:number,state:EnemyState,vx=0,now=0):void {
  this.impactOffset=0;
  this.root.setPosition(x,y+(this.id==='E02'?this.size/2:0)+this.motion.float);
  this.root.alpha=state.phase==='arriving'?.45:1;
  if(this.id==='EL01'||this.id==='B01'){
   if(this.id==='B01'){
    if((state.phase==='warning'||state.phase==='dash')&&Math.abs(state.direction.x)>.01)this.bossFace=Math.sign(state.direction.x);
    else if(state.phase==='chase'&&Math.abs(vx)>.01)this.bossFace=Math.sign(vx);
    this.root.setScale(-this.bossFace*this.size/256,this.size/256);
    if(this.phase!==state.phase){const previous=this.phase;this.phase=state.phase;this.bossPose(state,previous,now);}
    return;
   }
   if(this.phase===state.phase)return;
   this.phase=state.phase;
   const parts=[this.feet,this.second!],scale=this.size/128;
   this.scene.tweens.killTweensOf([this.body,...parts]);this.body.y=0;
   for(const part of parts)part.setY(part.getData('restY')).setAngle(0);
   if(this.id==='EL01'&&state.phase==='warning')parts.forEach((part,i)=>this.scene.tweens.add({targets:part,y:part.getData('restY')-.5/scale,angle:i?-2:2,duration:650,ease:'Sine.InOut'}));
   return;
  }
  if(this.id==='E03'&&Math.abs(vx)>.01)this.root.scaleX=(vx>0?-1:1)*this.size/128;
  if(this.id==='E04'){
   if(Math.abs(state.direction.x)>.01)this.root.scaleX=(state.direction.x<0?-1:1)*this.size/128;
   if(state.phase!==this.phase){
    this.scene.tweens.killTweensOf(this.feet);
    if(state.phase==='warning')this.scene.tweens.add({targets:this.feet,scaleX:1.22,scaleY:1.16,duration:700,ease:'Sine.InOut'});
    else this.scene.tweens.add({targets:this.feet,scaleX:1,scaleY:1,duration:250,ease:'Sine.Out'});
    this.phase=state.phase;
   }
   return;
  }
  if(this.id!=='E02'||state.phase===this.phase)return;
  this.phase=state.phase;this.scene.tweens.killTweensOf([this.body,this.feet,this.motion]);
  const u=128/this.size;
  if(state.phase==='warning')this.scene.tweens.add({targets:this.body,y:u,duration:650,ease:'Sine.InOut'});
  else if(state.phase==='dash'){
   this.body.y=0;this.feet.y=0;
   this.scene.tweens.add({targets:this.motion,float:-6,duration:275,yoyo:true,ease:'Sine.Out'});
   this.scene.tweens.add({targets:this.feet,y:-.7*u,duration:160,yoyo:true,hold:230,ease:'Sine.InOut'});
  }else if(state.phase==='recover'){
   this.motion.float=0;this.feet.y=0;this.body.y=u;
   this.scene.tweens.add({targets:this.body,y:0,duration:330,ease:'Sine.InOut'});
  }else{this.body.y=0;this.feet.y=0;this.motion.float=0;}
 }
 private bossPose(state:EnemyState,previous:string,now:number):void {
  const parts=[this.feet,this.second!],u=256/this.size;
  this.drop?.remove(false);this.drop=null;this.scene.tweens.killTweensOf([this.body,...parts]);
  const rest=()=>{this.body.setPosition(0,0).setAngle(0).setScale(1);for(const p of parts)p.setPosition(p.getData('restX'),p.getData('restY')).setAngle(0).setScale(1);};
  if(state.phase==='warning'){
   rest();this.scene.tweens.add({targets:this.body,x:2*u,y:4.5*u,angle:2.5,duration:650,ease:'Sine.InOut'});
   parts.forEach((p,n)=>this.scene.tweens.add({targets:p,x:p.getData('restX')+u,y:p.getData('restY')+1.6*u,angle:n===0?5:-5,duration:650,ease:'Sine.InOut'}));
  }else if(state.phase==='dash'){
   this.scene.tweens.add({targets:this.body,x:-3*u,y:1.2*u,angle:-4,duration:130,ease:'Cubic.Out'});
   parts.forEach((p,n)=>this.scene.tweens.add({targets:p,x:p.getData('restX')-u,y:p.getData('restY')-1.6*u,angle:n===0?-6:-3,duration:130,ease:'Cubic.Out'}));
  }else if(state.phase==='slam-warning'){
   rest();this.scene.tweens.add({targets:this.body,y:-.8*u,duration:850,ease:'Sine.InOut'});
   parts.forEach((p,n)=>this.scene.tweens.add({targets:p,y:p.getData('restY')-7*u,angle:n===0?6:-6,duration:850,ease:'Sine.InOut'}));
   this.drop=this.scene.time.delayedCall(Math.max(0,(state.until-now)*1000-80),()=>{
    this.drop=null;for(const p of parts){this.scene.tweens.killTweensOf(p);this.scene.tweens.add({targets:p,y:p.getData('restY'),angle:0,duration:80,ease:'Cubic.In'});}
   });
  }else if(state.phase==='recover'&&previous==='dash'){
   this.scene.tweens.chain({targets:this.body,tweens:[{x:-4.5*u,y:3*u,angle:-6,duration:80,ease:'Quad.Out'},{x:.8*u,y:1.5*u,angle:1.5,duration:180,ease:'Sine.InOut'},{x:0,y:0,angle:0,duration:200,ease:'Sine.Out'}]});
   parts.forEach((p,n)=>this.scene.tweens.chain({targets:p,tweens:[{x:p.getData('restX')-2*u,y:p.getData('restY')+.5*u,angle:n===0?-9:-6,duration:60,ease:'Quad.Out'},{x:p.getData('restX'),y:p.getData('restY'),angle:0,duration:230,ease:'Sine.Out'}]}));
  }else{
   rest();
  }
 }
 landSlam():void {
  if(this.id!=='B01')return;this.scene.tweens.killTweensOf(this.body);this.body.setPosition(0,0).setAngle(0);
  this.scene.tweens.chain({targets:this.body,tweens:[{y:2*256/this.size,duration:90,ease:'Sine.Out'},{y:0,duration:380,ease:'Sine.InOut'}]});
 }
 bossAnchors(){
  if(this.id!=='B01'||!this.second)return null;
  const coreMatrix=this.body.getWorldTransformMatrix();
  return {x:this.root.x,y:this.root.y,face:this.bossFace,core:bossArt.core.map(([x,y])=>coreMatrix.transformPoint(x,y)),palms:[this.feet,this.second].map((p,n)=>p.getWorldTransformMatrix().transformPoint(...bossArt.paws[n].contact as [number,number]))};
 }
 // Native Image bounds include the complete logical E01 art quad and float.
 bounds():Phaser.Geom.Rectangle {return this.body.getBounds();}
 mouthPoint():{x:number;y:number}|null {
  if(this.id!=='E04')return null;
  const point=this.feet.getWorldTransformMatrix().transformPoint(0,0);
  return {x:point.x,y:point.y};
 }
 clear():void {this.clearImpactOffset();this.drop?.remove(false);this.drop=null;this.scene.tweens.killTweensOf([this.root,this.body,this.feet,this.motion,...(this.second?[this.second]:[])]);this.root.setVisible(false);}
 snapshot(){return {visible:this.root.visible,id:this.id,phase:this.phase,size:this.size,jump:this.motion.float,bodyY:this.body.y,bodyX:this.body.x,bodyAngle:this.body.angle,bodyScale:{x:this.body.scaleX,y:this.body.scaleY},feetY:this.feet.y,partX:this.feet.x,partFrame:this.feet.frame.name,partAngle:this.feet.angle,partScale:{x:this.feet.scaleX,y:this.feet.scaleY},second:this.second?{visible:this.second.visible,frame:this.second.frame.name,y:this.second.y,angle:this.second.angle}:null,bossRevision:this.id==='B01'?'charge-motion-v2+ dust-plume-96-v3':null,bossFace:this.bossFace,palms:this.bossAnchors()?.palms??null,mouth:this.mouthPoint()};}
}
