import type PhaserType from 'phaser';
import Runtime from './phaser-entry.cjs';
import type {RunConfig} from './combat-config';
import type {GrowthRanks} from './progression-content';
import {anchorPullEligible,anchorStats,areaMultiplier,abilityDamage,pulsePosition,pulseStats} from './area-ability-rules';
import type {Point} from './rules';
import type {MovementContext} from './contract-rules';
const Phaser=Runtime as typeof PhaserType;
type Sprite=PhaserType.Physics.Arcade.Sprite;
type AnchorFact={id:number;x:number;y:number;radius:number;damage:number;birth:number;skill:number;q:number;targets:number};
type AreaCast={id:number;x:number;y:number;radius:number;damage:number;targets:number[];actualDamage:number;hits:{id:number;actualDamage:number}[]};
type PullFact={id:number;beforeSpeed:number;speed:number;distance:number};
// Clock callbacks only record facts. Arena prepares expiry/deployment before
// native physics, then applies burst/pulse damage after same-frame player damage.
export class AreaAbilities {
 private originalPresentation=true;
 setOriginalPresentation(enabled:boolean):void {this.originalPresentation=enabled;}
 readonly group:PhaserType.GameObjects.Group;
 private pulse:PhaserType.GameObjects.Graphics;
 private anchor:PhaserType.GameObjects.Graphics;
 private timer:PhaserType.Time.TimerEvent|null=null;
 private anchorTimer:PhaserType.Time.TimerEvent|null=null;
 private tween:PhaserType.Tweens.Tween|null=null;
 private anchorTween:PhaserType.Tweens.Tween|null=null;
 private casts=0;private hits=0;private damage=0;
 private attempts=0;private deployments=0;private bursts=0;
 private pulseHits=0;private pulseDamage=0;private burstHits=0;private burstDamage=0;
 private pendingBurst:AnchorFact|null=null;
 private lastPulse:AreaCast|null=null;private lastBurst:AreaCast|null=null;
 private lastPull:{targets:PullFact[]}|null=null;
 private queries={deploy:0,pull:0,pulse:0,burst:0};
 constructor(private scene:PhaserType.Scene,private cat:Sprite,private config:()=>RunConfig,
  private nearby:(point:Point,radius:number)=>Sprite[],
  private hit:(enemy:Sprite,damage:number,effect:string,castId:number)=>number,
  private effectiveNow:()=>number,private movementContext:()=>MovementContext=()=>({moving:false,stationarySeconds:0})){
  this.group=scene.add.group({maxSize:2});
  this.pulse=scene.add.graphics().setDepth(1.2);this.anchor=scene.add.graphics().setDepth(1.15);
  this.group.addMultiple([this.pulse,this.anchor]);this.reset();
 }
 private get expiry():PhaserType.Time.TimerEvent|null {return this.anchor.getData('expiry')??null;}
 private removeTimer(timer:PhaserType.Time.TimerEvent|null):void {
  if(timer){this.scene.time.removeEvent(timer);timer.destroy();}
 }
 private clearAnchor():void {
  this.removeTimer(this.expiry);
  if(this.anchorTween){this.anchorTween.stop();this.anchorTween.remove();this.anchorTween=null;}
  this.anchor.clear();this.anchor.data?.reset();this.group.killAndHide(this.anchor);
  this.cat.setData('areaAnchorExpiryDue',null);
 }
 ensure(ranks:GrowthRanks):void {
  if(!this.config().areaAbilities?.enabled){this.clear();return;}
  if(ranks.C15){
   if(!this.timer)this.timer=this.scene.time.addEvent({delay:pulseStats(this.config(),ranks).intervalSeconds*1000,loop:true,
    callback:()=>{this.cat.setData('areaPulseDue',true);}});
  }else{
   this.removeTimer(this.timer);this.timer=null;this.cat.setData('areaPulseDue',false);
  }
  if(ranks.C16){
   if(!this.anchorTimer)this.anchorTimer=this.scene.time.addEvent({delay:anchorStats(this.config(),ranks).intervalSeconds*1000,loop:true,
    callback:()=>{this.cat.setData('areaAnchorDeployDue',true);}});
  }else{
   this.removeTimer(this.anchorTimer);this.anchorTimer=null;this.cat.setData('areaAnchorDeployDue',false);
   this.clearAnchor();this.pendingBurst=null;this.lastPull=null;
  }
 }
 private anchorFact():AnchorFact {
  const a=this.anchor;
  return {id:a.getData('id'),x:a.x,y:a.y,radius:a.getData('radius'),damage:a.getData('damage'),birth:a.getData('birth'),skill:a.getData('skill'),q:a.getData('q'),targets:a.getData('targets')};
 }
 prepare(ranks:GrowthRanks):void {
  this.ensure(ranks);
  const expired=this.cat.getData('areaAnchorExpiryDue');
  this.cat.setData('areaAnchorExpiryDue',null);
  if(expired&&this.anchor.active&&expired===this.anchor.getData('id')){
   this.pendingBurst=this.anchorFact();this.clearAnchor();
  }
  if(!this.cat.getData('areaAnchorDeployDue'))return;
  this.cat.setData('areaAnchorDeployDue',false);this.attempts++;
  const stats=anchorStats(this.config(),ranks),p=this.cat.body!.center;
  this.queries.deploy++;
  const target=this.nearby(p,stats.range).find(e=>!e.getData('entering')&&!e.getData('deathResolved'));
  if(!target)return;
  this.clearAnchor();const position=target.body!.center,id=++this.deployments;
  this.anchor.setPosition(position.x,position.y).setScale(1).setAlpha(.85).setActive(true).setVisible(this.originalPresentation)
   .fillStyle(0x73d4cc,.08).fillCircle(0,0,stats.radius).lineStyle(1.5,0x66c2c5,.85).strokeCircle(0,0,stats.radius)
   .lineStyle(2,0xe1ffed,.95).strokeCircle(0,0,4).lineBetween(-7,0,7,0).lineBetween(0,-7,0,7);
  // Geometry and native expiry are established before physics. Damage binds
  // after that same frame's Body movement, before any new area damage occurs.
  this.anchor.setData({id,radius:stats.radius,damage:0,damagePending:true,birth:target.getData('id'),skill:0,q:areaMultiplier(this.config(),ranks),targets:stats.targets});
  // Clock has already kept this deployment's frame overrun in the looping
  // TimerEvent. Native startAt carries it into the pending one-shot, keeping
  // the nominal 5+2 phase without another deadline or a manual countdown.
  const expiry=this.scene.time.addEvent({delay:stats.durationSeconds*1000,startAt:this.anchorTimer!.getElapsed(),callback:()=>{
   if(this.anchor.active&&this.anchor.getData('id')===id)this.cat.setData('areaAnchorExpiryDue',id);
  }});
  this.anchor.setData('expiry',expiry);
  if(this.originalPresentation)this.anchorTween=this.scene.tweens.add({targets:this.anchor,alpha:.45,duration:400,yoyo:true,repeat:-1});
 }
 beforePhysics(ranks:GrowthRanks,dt:number):void {
  this.lastPull=null;
  if(!this.config().areaAbilities?.enabled||!ranks.C16||!this.anchor.active||dt<=0)return;
  const a=this.anchorFact(),arrival=anchorStats(this.config(),ranks).arrivalRadius,now=this.effectiveNow();
  this.queries.pull++;
  const targets=this.nearby(a,a.radius).filter(enemy=>{
   const body=enemy.body as PhaserType.Physics.Arcade.Body;
   return anchorPullEligible({enemyId:enemy.getData('enemyId'),active:enemy.active,hp:enemy.getData('hp'),
    deathResolved:!!enemy.getData('deathResolved'),entering:!!enemy.getData('entering'),
    frozen:now+1e-8<(enemy.getData('chill')?.frozenUntil??0),speed:body.velocity.length()});
  }).slice(0,a.targets);
  const facts:PullFact[]=[],circle=new Phaser.Geom.Circle(a.x,a.y,arrival);
  for(const enemy of targets){
   const body=enemy.body as PhaserType.Physics.Arcade.Body,beforeSpeed=body.velocity.length();
   const offset=new Phaser.Math.Vector2(a).subtract(body.center),distance=offset.length();
   const speed=Phaser.Geom.Circle.Contains(circle,body.center.x,body.center.y)?0:Math.min(beforeSpeed,(distance-arrival)/dt);
   offset.normalize().scale(speed);enemy.setVelocity(offset.x,offset.y);
   facts.push({id:enemy.getData('id'),beforeSpeed,speed,distance});
  }
  this.lastPull={targets:facts};
 }
 private cast(point:Point,radius:number,damage:number,limit:number,effect:string,id:number):AreaCast {
  const targets=this.nearby(point,radius).slice(0,limit),record:AreaCast={id,x:point.x,y:point.y,radius,damage,targets:targets.map(e=>e.getData('id')),actualDamage:0,hits:[]};
  for(const enemy of targets){
   if(!enemy.active||enemy.getData('hp')<=0||enemy.getData('deathResolved'))continue;
   const birth=enemy.getData('id'),actual=this.hit(enemy,damage,effect,id);
   if(actual>0){this.hits++;this.damage+=actual;record.actualDamage+=actual;record.hits.push({id:birth,actualDamage:actual});}
  }
  return record;
 }
 private showPulse(point:Point,radius:number,color:number):void {
  if(!this.originalPresentation)return;
  if(this.tween){this.tween.stop();this.tween.remove();this.tween=null;}
  const pulse=this.pulse;
  pulse.clear().setPosition(point.x,point.y).setScale(.45).setAlpha(.8).setVisible(true).setActive(true)
   .lineStyle(2,color,.9).strokeCircle(0,0,radius);
  this.tween=this.scene.tweens.add({targets:pulse,alpha:0,scaleX:1,scaleY:1,duration:240,
   onComplete:()=>{this.tween=null;pulse.clear();this.group.killAndHide(pulse);}});
 }
 update(ranks:GrowthRanks):void {
  this.ensure(ranks);
  if(this.anchor.active&&this.anchor.getData('damagePending')){
   const skill=abilityDamage(this.config(),ranks,this.movementContext());
   this.anchor.setData({skill,damage:anchorStats(this.config(),ranks,this.movementContext()).damage,damagePending:false});
  }
  if(this.pendingBurst){
   const a=this.pendingBurst;this.pendingBurst=null;this.bursts++;this.queries.burst++;
   const record=this.cast(a,a.radius,a.damage,a.targets,'ANCHOR_BURST',a.id);
   this.lastBurst=record;this.burstHits+=record.hits.length;this.burstDamage+=record.actualDamage;
   this.showPulse(a,a.radius,0x85cfb5);
  }
  if(!this.cat.getData('areaPulseDue'))return;
  this.cat.setData('areaPulseDue',false);
  const p=pulsePosition(ranks,this.cat.body!.center,this.anchor.active?this.anchor:null),stats=pulseStats(this.config(),ranks,this.movementContext()),id=++this.casts;
  this.queries.pulse++;const record=this.cast(p,stats.radius,stats.damage,stats.targets,'PULSE_FIELD',id);
  this.lastPulse=record;this.pulseHits+=record.hits.length;this.pulseDamage+=record.actualDamage;
  this.showPulse(p,stats.radius,0xb6e5e2);
 }
 clear():void {
  this.removeTimer(this.timer);this.timer=null;this.removeTimer(this.anchorTimer);this.anchorTimer=null;
  if(this.tween){this.tween.stop();this.tween.remove();this.tween=null;}
  this.clearAnchor();this.cat.setData({areaPulseDue:false,areaAnchorDeployDue:false,areaAnchorExpiryDue:null});
  this.pendingBurst=null;this.lastPulse=null;this.lastBurst=null;this.lastPull=null;
  this.pulse.clear();this.group.killAndHide(this.pulse);
 }
 reset():void {
  this.clear();this.casts=0;this.hits=0;this.damage=0;this.attempts=0;this.deployments=0;this.bursts=0;
  this.pulseHits=0;this.pulseDamage=0;this.burstHits=0;this.burstDamage=0;
  this.queries={deploy:0,pull:0,pulse:0,burst:0};
 }
 destroy():void {this.clear();this.group.clear(true,true);this.group.destroy();}
 private timerSnapshot(timer:PhaserType.Time.TimerEvent|null){return timer?{delay:timer.delay,elapsed:timer.elapsed,remaining:timer.getRemaining()}:null;}
 private recordSnapshot(record:AreaCast|null){return record?{...record,targets:record.targets.slice(),hits:record.hits.map(h=>({...h}))}:null;}
 snapshot(){
  const expiry=this.expiry;
  return {enabled:!!this.config().areaAbilities?.enabled,owned:!!this.timer,anchorOwned:!!this.anchorTimer,
   casts:this.casts,hits:this.hits,damage:this.damage,attempts:this.attempts,deployments:this.deployments,bursts:this.bursts,
   pulseHits:this.pulseHits,pulseDamage:this.pulseDamage,burstHits:this.burstHits,burstDamage:this.burstDamage,
   pending:!!this.cat.getData('areaPulseDue'),pendingDeploy:!!this.cat.getData('areaAnchorDeployDue'),pendingExpiry:!!this.cat.getData('areaAnchorExpiryDue'),pendingBurst:!!this.pendingBurst,
   active:this.group.countActive(true),total:this.group.getLength(),timer:this.timerSnapshot(this.timer),anchorTimer:this.timerSnapshot(this.anchorTimer),expiryTimer:this.timerSnapshot(expiry),
   timers:Number(!!this.timer)+Number(!!this.anchorTimer)+Number(!!expiry),tweens:Number(!!this.tween)+Number(!!this.anchorTween),
   anchor:this.anchor.active?{...this.anchorFact(),remaining:expiry?.getRemaining()??0}:null,
   queries:{...this.queries},lastPull:this.lastPull?{targets:this.lastPull.targets.map(t=>({...t}))}:null,
   lastPulse:this.recordSnapshot(this.lastPulse),lastBurst:this.recordSnapshot(this.lastBurst)};
 }
}
