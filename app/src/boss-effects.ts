import type Phaser from 'phaser';
import Runtime from './phaser-entry.cjs';
import type {EnemyState} from './enemy-behavior';
import type {EnemyPresentation} from './enemy-presentation';
import type {Point} from './rules';
import {ENEMIES} from './level-config';

type Anchors=NonNullable<ReturnType<EnemyPresentation['bossAnchors']>>;
type DustMode='launch'|'trail'|'stop'|'palm'|'plume';
export const BOSS_DUST_FRAME=64;
// One B01 display, using native bounded emitters / Group / Clock / Tween only.
export class BossEffects {
 private contact:Phaser.GameObjects.Particles.ParticleEmitter;
 private dust:Phaser.GameObjects.Particles.ParticleEmitter;
 private stones:Phaser.GameObjects.Group;
 private core:Phaser.GameObjects.Graphics;
 private pending:Phaser.Time.TimerEvent|null=null;
 private phase='';private owner:number|null=null;private low=false;private enabled=true;private entered=false;
 private anchors:Anchors|null=null;private direction:Point={x:-1,y:0};
 private origin:Point={x:0,y:0};
 private fx={charge:0,burst:0,ring:0,ringLife:0,dust:0,dustLife:0,stopKick:0};
 private entryLight={gain:0};
 private slams=0;private stops=0;private entries=0;
 constructor(private scene:Phaser.Scene,private ground:Phaser.GameObjects.Graphics,private trail:Phaser.GameObjects.Graphics,private touch:Phaser.GameObjects.Graphics){
  this.core=scene.add.graphics().setDepth(1.2);
  this.contact=scene.add.particles(0,0,'boss-dust',this.emitterConfig('launch',2)).setDepth(1.1);
  this.dust=scene.add.particles(0,0,'boss-dust',this.emitterConfig('trail',6)).setDepth(.95);
  for(const e of [this.contact,this.dust])e.addEmitZone({source:new Runtime.Geom.Rectangle(0,0,0,0),type:'random'});
  this.stones=scene.add.group({maxSize:8});
  for(let n=0;n<8;n++){
   const g=scene.add.graphics().setDepth(1.3).setActive(false).setVisible(false).setData('slot',n),s=[1.5,2.2,1.1,2.8,1.6,2.1,1.3,2.6][n];
   g.fillStyle(0x5e586b,.9).fillPoints([{x:-s,y:0},{x:-s*.45,y:-s},{x:s*.6,y:-s*.7},{x:s,y:s*.5},{x:-s*.6,y:s}],true).fillStyle(n%3?0xb5a986:0x9584a3,.95).fillTriangle(-s*.45,-s,s*.6,-s*.7,0,s*.35);this.stones.add(g);
  }
 }
 private emitterConfig(mode:DustMode,cap:number):Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  const palm=mode==='palm',plume=mode==='plume',trail=mode==='trail',stop=mode==='stop';
  const sourceScale=24/BOSS_DUST_FRAME; // Same authored world extents, finer source sampling.
  return {frame:{frames:[2,0,3,1],cycle:true},emitting:false,maxAliveParticles:cap,
   lifespan:palm?{min:350,max:550}:plume?{min:360,max:440}:stop?480:trail?(this.low?190:210):260,
   speedX:0,speedY:0,accelerationX:0,accelerationY:palm?9:trail?12:28,
   scaleX:{start:(palm?1.1:plume?1.9*ENEMIES.B01.slamRadius/96:trail?.9:1.4)*sourceScale,end:(palm?2.4:plume?4*ENEMIES.B01.slamRadius/96:trail?2.6:3.8)*sourceScale},
   scaleY:{start:(palm?.6:plume?1.6*ENEMIES.B01.slamRadius/96:trail?.8:1.5)*sourceScale,end:(palm?1.15:plume?5*ENEMIES.B01.slamRadius/96:trail?2.7:4.8)*sourceScale},
   alpha:{start:palm?.78:trail?.72:.86,end:0,ease:'Sine.In'},rotate:{min:-12,max:12},blendMode:'NORMAL'};
 }
 private configureDust(e:Phaser.GameObjects.Particles.ParticleEmitter,mode:DustMode,cap:number){
  // setConfig reloads the native range operations; omit emitZone so it is not appended again.
  e.killAll();e.setConfig(this.emitterConfig(mode,cap));e.radial=false;
 }
 configure(low:boolean,enabled:boolean):void {if(this.low!==low||this.enabled!==enabled)this.clear();this.low=low;this.enabled=enabled;}
 sync(id:number,anchors:Anchors,state:EnemyState):void {
  if(this.owner!==id){this.clear();this.owner=id;this.phase='';this.entered=false;}
  this.anchors=anchors;this.direction={...state.direction};
  if(!this.entered&&Runtime.Geom.Intersects.RectangleToRectangle(this.scene.cameras.main.worldView,new Runtime.Geom.Rectangle(anchors.x-48,anchors.y-48,96,96))){
   this.entered=true;if(this.enabled)this.enter();
  }
  if(this.phase!==state.phase){
   this.phase=state.phase;
   if(this.enabled){
    if(state.phase==='warning'||state.phase==='slam-warning'){
     this.scene.tweens.killTweensOf(this.fx);Object.assign(this.fx,{charge:0,burst:0});this.scene.tweens.add({targets:this.fx,charge:state.phase==='warning'?.9:1,duration:state.phase==='warning'?1000:1030,ease:'Sine.In'});
    }else if(state.phase==='dash')this.launchCharge();
    else if(state.phase==='recover'){this.scene.tweens.killTweensOf(this.fx);this.fx.charge=0;}
   }
  }
  this.draw();
 }
 private enter():void {
  this.entries++;this.entryLight.gain=1;this.scene.tweens.add({targets:this.entryLight,gain:0,duration:600,ease:'Sine.Out'});
  this.configureDust(this.contact,'palm',2);for(const [n,p]of this.anchors!.palms.entries())this.emit(this.contact,p,n?9:-9,-8);
 }
 private point(along:number,side:number):Point {
  const a=this.anchors!,d=this.direction;return {x:a.x+d.x*along,y:a.y+d.y*along+side};
 }
 private emit(e:Phaser.GameObjects.Particles.ParticleEmitter,p:Point,vx:number,vy:number):void {
  e.speedX=vx;e.speedY=vy;e.radial=false;e.emitParticleAt(p.x,p.y,1);
 }
 private chargeTrail():void {
  if(!this.enabled||this.phase!=='dash'||!this.anchors)return;
  for(let n=0;n<2;n++){const p=this.point(-27,n?43:20),d=this.direction;this.emit(this.dust,p,-d.x*(26+n*8),-d.y*(26+n*8)-(10+n*6));}
 }
 private launchCharge():void {
  this.configureDust(this.contact,'launch',2);this.configureDust(this.dust,'trail',6);
  this.fx.burst=1;this.scene.tweens.add({targets:this.fx,burst:0,duration:320,ease:'Cubic.Out'});
  if(!this.low)for(let n=0;n<2;n++){const p=this.point(-28,n?43:22),d=this.direction;this.emit(this.contact,p,-d.x*48,-d.y*48-(14+n*9));}
  this.pending?.remove(false);this.pending=this.scene.time.addEvent({delay:this.low?240:120,startAt:this.low?120:0,repeat:Math.max(0,Math.floor(ENEMIES.B01.dashSeconds*1000/(this.low?240:120))-1),callback:()=>this.chargeTrail()});
  if(!this.low)this.throwStones('launch');
 }
 stop(anchors:Anchors,direction:Point):void {
  this.pending?.remove(false);this.pending=null;this.anchors=anchors;this.direction={...direction};this.phase='recover';
  if(!this.enabled)return;this.stops++;Object.assign(this.fx,{charge:0,dust:0,dustLife:1,stopKick:1});
  this.scene.tweens.add({targets:this.fx,dust:1,dustLife:0,duration:300,ease:'Cubic.Out'});this.scene.tweens.add({targets:this.fx,stopKick:0,duration:180,ease:'Quad.Out'});
  this.configureDust(this.dust,'stop',6);this.dust.accelerationX=-direction.x*75;this.dust.accelerationY=28-direction.y*75;
  for(let n=0;n<(this.low?2:4);n++){const side=this.low?[30,46][n]:[28,34,42,48][n],p=this.point(42,side);this.emit(this.dust,p,direction.x*(42+n*9),direction.y*(42+n*9)-(20+n*5));}
  if(!this.low)this.throwStones('stop');
 }
 slam(anchors:Anchors):void {
  this.clear();this.anchors=anchors;this.origin={x:anchors.x,y:anchors.y};this.phase='recover';
  if(!this.enabled)return;this.slams++;Object.assign(this.fx,{charge:0,burst:1,ring:0,ringLife:1});
  this.scene.tweens.add({targets:this.fx,ring:1,duration:450,ease:'Cubic.Out'});
  this.scene.tweens.add({targets:this.fx,ringLife:0,delay:90,duration:360,ease:'Linear'});
  this.scene.tweens.add({targets:this.fx,burst:0,duration:220,ease:'Quad.Out'});
  this.configureDust(this.contact,'palm',2);this.configureDust(this.dust,'plume',6);
  if(!this.low){for(const p of anchors.palms)this.emit(this.contact,{x:p.x,y:p.y-1},(p.x-anchors.x)*.4,-12);this.throwStones('slam');}
  this.pending=this.scene.time.delayedCall(90,()=>{
   this.pending=null;if(!this.enabled)return;
   for(const [n,angle]of (this.low?[.12,3.34]:[.05,1.07,2.12,3.2,4.25,5.31]).entries()){
    const r=(n%2?45:48)*ENEMIES.B01.slamRadius/96;this.emit(this.dust,{x:this.origin.x+Math.cos(angle)*r,y:this.origin.y+Math.sin(angle)*r},Math.cos(angle)*30,Math.sin(angle)*21-38);
   }
  });
 }
 private throwStones(kind:'launch'|'stop'|'slam'):void {
  const a=this.anchors!,d=this.direction;
  for(const obj of this.stones.getChildren()){
   const g=obj as Phaser.GameObjects.Graphics,n=g.getData('slot') as number;if(kind==='launch'&&n>=4)continue;
   this.scene.tweens.killTweensOf(g);const p=kind==='launch'?this.point(-27,n%2?43:22):a.palms[n%2],slam=kind==='slam';
   const dx=slam?[-23,17,-36,32,-15,40,-31,23][n]:d.x*(kind==='stop'?10+(n%4)*6:-(12+(n%4)*5));
   const dy=slam?[11,15,-5,7,17,-2,3,19][n]:d.y*(kind==='stop'?10+(n%4)*6:-(12+(n%4)*5))+[4,-5,8,-3,7,-4,3,6][n];
   const up=slam?[16,23,12,26,19,14,22,17][n]:8+(n%4)*4;
   g.setPosition(p.x,p.y).setAngle(n*29).setScale(1).setAlpha(1).setActive(true).setVisible(true);
   this.scene.tweens.add({targets:g,x:p.x+dx,angle:g.angle+(n%2?120:-110),duration:slam?370+n*13:310,ease:'Cubic.Out'});
   this.scene.tweens.chain({targets:g,tweens:[{y:p.y-up,duration:slam?100+n*7:95+n*4,ease:'Quad.Out'},{y:p.y+dy,duration:slam?170+n*9:105+n*3,ease:'Quad.In'},{alpha:0,duration:slam?130:100,ease:'Sine.Out'}],onComplete:()=>this.stones.killAndHide(g)});
  }
 }
 private draw():void {
  for(const g of [this.ground,this.trail,this.touch,this.core])g.clear().setPosition(0,0).setAlpha(1).setScale(1).setRotation(0);if(!this.enabled||!this.anchors)return;
  const a=this.anchors,d=this.direction,power=this.fx.charge*.45+this.fx.burst*.8+this.entryLight.gain*.45;
  if(power>0)this.core.fillStyle(0xb6ffe4,Math.min(.7,power)).fillPoints(a.core,true).lineStyle(1.4,0xd1ffeb,Math.min(.9,power+.1)).strokePoints(a.core,true);
  if(this.entryLight.gain>0)this.touch.lineStyle(1.1,0xafbda1,this.entryLight.gain*.35).strokeEllipse(a.x,a.y+46,83+(1-this.entryLight.gain)*10,11+(1-this.entryLight.gain)*5);
  if(this.phase==='dash')for(let n=0;n<2;n++){const from=this.point(-17,n?44:22),to=this.point(-43,n?46:24);this.trail.lineStyle(.8,0x8a7962,.25).lineBetween(from.x,from.y,to.x,to.y);}
  if(this.fx.dustLife>0){for(let n=0;n<2;n++){const from=this.point(11,45-n*8),to=this.point(42,47-n*8);this.touch.lineStyle(1.1-n*.3,0x8a7962,this.fx.dustLife*.45).lineBetween(from.x,from.y,to.x,to.y);}}
  if(this.fx.stopKick>0)for(const p of a.palms)this.touch.fillStyle(0xd7c39d,this.fx.stopKick*.7).fillEllipse(p.x+d.x*3,p.y+d.y*3,14,4);
  this.drawSlam();
 }
 private drawSlam():void {
  const life=this.fx.ringLife;if(life<=0||!this.anchors)return;
  const g=this.ground,t=this.fx.ring,burst=this.fx.burst,x=this.origin.x,cy=this.origin.y,gy=cy+41,range=12+(ENEMIES.B01.slamRadius-12)*Math.min(1,t/.88);
  g.fillStyle(0x776086,life*.045).fillCircle(x,cy,range).lineStyle(.7,0x988c79,life*.16).strokeCircle(x,cy,range-.35);
  const fractures=this.low?5:7;
  for(let n=0;n<fractures;n++){
   const angle=n*Math.PI*2/fractures+.2+(n%3)*.15,far=range*(.72+(n%3)*.07),bend=n%2?1:-1;
   const pts=[.18,.4,.62,.8,.94].map((f,k)=>{const ang=angle+[0,.09,-.055,.07,0][k]*bend;return {x:x+Math.cos(ang)*far*f,y:cy+Math.sin(ang)*far*f};});
   g.lineStyle(1.35,0x504258,life*.72).strokePoints(pts,false).lineStyle(.45,0xbcf4d4,life*.56).strokePoints(pts,false);
   const fork=pts[2],end=pts[3],turn=angle+bend*.32;g.lineStyle(.7,0x6b536b,life*.68).lineBetween(fork.x,fork.y,end.x+Math.cos(turn)*5,end.y+Math.sin(turn)*5);
  }
  const r=9+67*t,ry=r*.24;
  for(const [start,end]of [[-.12,.55],[.78,1.62],[1.88,2.27],[2.52,3.05],[3.64,4.24],[4.75,5.67]]){
   for(const glow of [false,true]){
    g.lineStyle(glow?1.1:1.8+1.8*(1-t),glow?0xc8f7d9:0x5c526a,life*(glow?.8:.56)).beginPath();
    for(let k=0;k<=12;k++){const ang=start+(end-start)*k/12,xx=x+Math.cos(ang)*(r-(glow?2:0)),yy=gy+Math.sin(ang)*(ry-(glow?1:0));k?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.strokePath();
   }
  }
  for(const [n,p]of this.anchors.palms.entries()){
   this.touch.fillStyle(0x625469,life*.18).fillEllipse(p.x,p.y+2,14+18*t,4+4*t);
   if(burst>.02){const peak=burst**2;this.touch.fillStyle(0x5a5373,peak*.8).fillEllipse(p.x,p.y+1,26,9).fillStyle(0xf1ffe1,peak*.96).fillPoints([{x:p.x-13,y:p.y},{x:p.x-4,y:p.y-3},{x:p.x-7,y:p.y-14},{x:p.x,y:p.y-5},{x:p.x+4,y:p.y-17},{x:p.x+5,y:p.y-3},{x:p.x+15,y:p.y},{x:p.x+3,y:p.y+3},{x:p.x,y:p.y+6},{x:p.x-3,y:p.y+2}],true);}
   for(const [k,ang]of [.2,.88,1.62,2.52].entries()){const len=8+(12+k*3)*t,xx=p.x+Math.cos(ang+n*.16)*len,yy=p.y+Math.sin(ang)*len*.37;this.touch.lineStyle(k%2?1.3:.9,0x706174,life*.62).beginPath().moveTo(p.x,p.y).lineTo((p.x+xx)/2+2,(p.y+yy)/2-1).lineTo(xx,yy).strokePath();}
  }
 }
 clear():void {
  this.pending?.remove(false);this.pending=null;this.scene.tweens.killTweensOf([this.fx,this.entryLight]);this.entryLight.gain=0;Object.assign(this.fx,{charge:0,burst:0,ring:0,ringLife:0,dust:0,dustLife:0,stopKick:0});
  this.contact.killAll();this.dust.killAll();for(const g of this.stones.getChildren()){this.scene.tweens.killTweensOf(g);this.stones.killAndHide(g);}
  for(const g of [this.ground,this.trail,this.touch,this.core])g.clear();
 }
 reset():void {this.clear();this.phase='';this.owner=null;this.anchors=null;this.entered=false;this.slams=0;this.stops=0;this.entries=0;}
 snapshot(){return {phase:this.phase,slams:this.slams,stops:this.stops,entries:this.entries,entryGlow:this.entryLight.gain,enabled:this.enabled,low:this.low,emitters:2,activeParticles:this.contact.getAliveParticleCount()+this.dust.getAliveParticleCount(),pooledParticles:this.contact.getParticleCount()+this.dust.getParticleCount(),emitZones:[this.contact.emitZones.length,this.dust.emitZones.length],allocatedStones:this.stones.getLength(),activeStones:this.stones.countActive(true),pending:!!this.pending&&!this.pending.hasDispatched,slamRadius:ENEMIES.B01.slamRadius,impactRadius:this.fx.ringLife>0?12+(ENEMIES.B01.slamRadius-12)*Math.min(1,this.fx.ring/.88):0,fx:{...this.fx}};}
}
