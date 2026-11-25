import type PhaserType from 'phaser';
import type {RunConfig} from './combat-config';
import type {GrowthRanks} from './progression-content';
import type {Point} from './rules';
import {sentinelStats} from './sentinel-rules';
import type {MovementContext} from './contract-rules';
type Sprite=PhaserType.Physics.Arcade.Sprite;
type ShotFact={at:number;deploymentId:number;targetId:number;origin:Point;angle:number;damage:number;projectileId:number};
// One native non-physical Group and Graphics own the station. Clock callbacks
// record bounded ID facts; Arena consumes them only after old damage is settled.
export class SentinelAbilities {
 readonly group:PhaserType.GameObjects.Group;
 private station:PhaserType.GameObjects.Graphics;
 private timer:PhaserType.Time.TimerEvent|null=null;
 private shotTimer:PhaserType.Time.TimerEvent|null=null;
 private expiryTimer:PhaserType.Time.TimerEvent|null=null;
 private attempts=0;private deployments=0;private expirations=0;
 private opportunities=0;private emitted=0;private queries=0;
 private lastShot:ShotFact|null=null;
 constructor(private scene:PhaserType.Scene,private cat:Sprite,private config:()=>RunConfig,
  private nearby:(point:Point,radius:number)=>Sprite[],
  private fire:(origin:Point,angle:number,damage:number,speed:number,life:number,deploymentId:number)=>number|null,
  private effectiveNow:()=>number,private shieldNow:()=>number=()=>0,private movementContext:()=>MovementContext=()=>({moving:false,stationarySeconds:0}),
  private originalPresentation=true){
  this.group=scene.add.group({maxSize:1});this.station=scene.add.graphics().setDepth(1.3);
  this.group.add(this.station);this.reset();
 }
 private removeTimer(timer:PhaserType.Time.TimerEvent|null):void {
  if(timer){this.scene.time.removeEvent(timer);timer.destroy();}
 }
 private clearStation():void {
  this.removeTimer(this.shotTimer);this.shotTimer=null;
  this.removeTimer(this.expiryTimer);this.expiryTimer=null;
  this.station.clear();this.station.data?.reset();this.group.killAndHide(this.station);
  this.cat.setData({sentryShotDue:null,sentryShotCount:0,sentryExpiryDue:null});
 }
 private drawStation(attached:boolean):void {
  if(!this.originalPresentation)return;
  this.station.clear().fillStyle(0xa4e4ce,.75).fillEllipse(0,3,20,9).lineStyle(1.5,0x427e70,.95).strokeEllipse(0,3,20,9)
   .fillStyle(0xe4fff2,1).fillTriangle(-4,0,4,0,0,-9);
  if(attached)this.station.lineStyle(1.2,0xa4e4ce,.75).strokeEllipse(0,0,48,40);
 }
 private syncAttachment(ranks:GrowthRanks):void {
  if(!this.station.active)return;
  const attached=!!ranks.E14&&this.shieldNow()>0,wasAttached=this.station.getData('attached')===true;
  // A shield break lands at this frame's already settled Body center. Later
  // ground frames keep that point; positive shield reattaches the same object.
  if(attached||wasAttached){const p=this.cat.body!.center;this.station.setPosition(p.x,p.y);}
  if(attached!==wasAttached)this.drawStation(attached);
  this.station.setData('attached',attached);
 }
 ensure(ranks:GrowthRanks):void {
  if(!this.config().defenseCompanions?.enabled||!ranks.C12){this.clear();return;}
  this.syncAttachment(ranks);
  const stats=sentinelStats(this.config(),ranks);
  if(!this.timer)this.timer=this.scene.time.addEvent({delay:stats.deploySeconds*1000,loop:true,
   callback:()=>{this.cat.setData('sentryDeployDue',this.deployments+1);}});
  if(this.shotTimer){
   const delay=stats.intervalSeconds*1000;
   if(this.shotTimer.delay!==delay){
    // Native elapsed carries the completion fraction, including frame remainder.
    const startAt=this.shotTimer.getElapsed()/this.shotTimer.delay*delay,callback=this.shotTimer.callback;
    this.shotTimer.reset({delay,startAt,loop:true,callback});
   }
  }
 }
 update(ranks:GrowthRanks):void {
  this.ensure(ranks);
  const expired=this.cat.getData('sentryExpiryDue'),due=this.cat.getData('sentryDeployDue');
  const shotDue=this.cat.getData('sentryShotDue');let count=this.cat.getData('sentryShotCount')??0;
  const origin=shotDue&&this.station.active&&this.station.getData('id')===shotDue?{x:this.station.x,y:this.station.y}:null;
  const attached=this.station.getData('attached')===true;
  if(origin&&this.shotTimer&&this.timer&&((expired===shotDue)||due)){
   // Both native loops retain the current frame's remainder after dispatch.
   // Their difference locates the final pending shot relative to the old
   // six-second endpoint, even when expiry and several shots dispatch together.
   // Keep strictly earlier opportunities; an endpoint or later shot is spent.
   const boundaryRemainder=this.timer.getElapsed()-(due?0:this.timer.delay);
   const finalOffset=boundaryRemainder-this.shotTimer.getElapsed(),epsilon=1e-8*1000;
   if(finalOffset>=-epsilon)count-=Math.min(count,Math.floor((finalOffset+epsilon)/this.shotTimer.delay)+1);
  }
  this.cat.setData({sentryExpiryDue:null,sentryDeployDue:null,sentryShotDue:null,sentryShotCount:0});
  if(expired&&this.station.active&&this.station.getData('id')===expired){this.expirations++;this.clearStation();}
  if(due&&this.timer){
   // A deployment replaces only a station from the previous six-second window.
   // Dispatch order never lets its endpoint shot escape before expiry.
   if(this.station.active){this.expirations++;this.clearStation();}
   this.attempts++;const id=++this.deployments,stats=sentinelStats(this.config(),ranks),p=this.cat.body!.center;
   const remainder=this.timer.getElapsed();
   this.station.setPosition(p.x,p.y).setRotation(0).setActive(true).setVisible(this.originalPresentation).setAlpha(1);this.drawStation(false);
   this.station.setData({id,deployedAt:this.effectiveNow()-remainder/1000,range:stats.range,attached:false});
   this.syncAttachment(ranks);
   this.expiryTimer=this.scene.time.addEvent({delay:stats.durationSeconds*1000,startAt:remainder,
    callback:()=>{if(this.station.active&&this.station.getData('id')===id)this.cat.setData('sentryExpiryDue',id);}});
   this.shotTimer=this.scene.time.addEvent({delay:stats.intervalSeconds*1000,startAt:remainder,loop:true,
    callback:()=>{if(this.station.active&&this.station.getData('id')===id){this.cat.setData('sentryShotDue',id);this.cat.setData('sentryShotCount',(this.cat.getData('sentryShotCount')??0)+1);}}});
  }
  if(!shotDue||!origin)return;
  // Consume this frame's native dispatch count in full. No per-frame throttle,
  // no retained missed targets, and no parallel timer or historical shot list.
  this.opportunities+=count;
  for(let i=0;i<count;i++){
   this.queries++;
   const stats=sentinelStats(this.config(),ranks,attached,this.movementContext());
   const target=this.nearby(origin,stats.range).find(enemy=>!enemy.getData('entering')&&!enemy.getData('deathResolved'));
   if(!target)continue;
   const p=target.body!.center,angle=Math.atan2(p.y-origin.y,p.x-origin.x);
   if(this.station.active&&this.station.getData('id')===shotDue)this.station.setRotation(angle+Math.PI/2);
   const projectileId=this.fire(origin,angle,stats.damage,stats.speed,stats.lifeSeconds,shotDue);
   if(projectileId===null)continue;
   this.emitted++;this.lastShot={at:this.effectiveNow(),deploymentId:shotDue,targetId:target.getData('id'),origin,angle,damage:stats.damage,projectileId};
  }
 }

 clear():void {
  this.removeTimer(this.timer);this.timer=null;this.clearStation();
  this.cat.setData('sentryDeployDue',null);
 }
 reset():void {
  this.clear();this.attempts=0;this.deployments=0;this.expirations=0;this.opportunities=0;this.emitted=0;this.queries=0;this.lastShot=null;
 }
 destroy():void {this.clear();this.group.clear(true,true);this.group.destroy();}
 private timerSnapshot(timer:PhaserType.Time.TimerEvent|null){return timer?{delay:timer.delay,elapsed:timer.getElapsed(),remaining:timer.getRemaining()}:null;}
 snapshot(){
  return {enabled:!!this.config().defenseCompanions?.enabled,owned:!!this.timer,active:this.group.countActive(true),total:this.group.getLength(),
   timers:Number(!!this.timer)+Number(!!this.shotTimer)+Number(!!this.expiryTimer),tweens:0,
   attempts:this.attempts,deployments:this.deployments,expirations:this.expirations,opportunities:this.opportunities,emitted:this.emitted,queries:this.queries,
   pendingDeploy:!!this.cat.getData('sentryDeployDue'),pendingShot:!!this.cat.getData('sentryShotDue'),pendingShotCount:this.cat.getData('sentryShotCount')??0,pendingExpiry:!!this.cat.getData('sentryExpiryDue'),
   timer:this.timerSnapshot(this.timer),shotTimer:this.timerSnapshot(this.shotTimer),expiryTimer:this.timerSnapshot(this.expiryTimer),
   station:this.station.active?{id:this.station.getData('id'),x:this.station.x,y:this.station.y,deployedAt:this.station.getData('deployedAt'),range:this.station.getData('range'),attached:this.station.getData('attached')===true,remaining:this.expiryTimer?.getRemaining()??0}:null,
   lastShot:this.lastShot?{...this.lastShot,origin:{...this.lastShot.origin}}:null};
 }
}
