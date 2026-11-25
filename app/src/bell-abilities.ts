import type PhaserType from 'phaser';
import Runtime from './phaser-entry.cjs';
import {BellAbilityState,orbitContact,orbitStats,remapOrbitCooldown} from './bell-ability-rules';
import {GROWTH_NUMBERS as N,type GrowthRanks} from './progression-content';
import type {Point} from './rules';
const Phaser=Runtime as typeof PhaserType;
type Image=PhaserType.GameObjects.Image;
type Sprite=PhaserType.Physics.Arcade.Sprite;
type State=BellAbilityState&{placed:number;explosions:number;orbitHits:number;replaced:number;sequence:number};
export type BellTrailFact=Point&{birth:number;blastRadius:number;armed:boolean};
type BellPresentationObserver={
  land(mark:BellTrailFact):void;
  retire(mark:BellTrailFact):void;
  blast(mark:BellTrailFact):void;
  orbitHit(point:Point):void;
};
const trailFact=(bell:Image):BellTrailFact=>({x:bell.x,y:bell.y,birth:bell.getData('birth'),blastRadius:bell.getData('blastRadius'),armed:!!bell.getData('armed')});
// All entities belong to native Scene Groups. Per-entity arm/damage and
// enemy contact cooldown live on Data Managers, never in parallel entity tables.
export class BellAbilities {
 readonly trails:PhaserType.GameObjects.Group;readonly orbits:PhaserType.GameObjects.Group;
 private rateCoefficient:number=N.rate;
 setRateCoefficient(value:number):void{this.rateCoefficient=value;}
 private areaScale=1;
 private areaPreview=false;
 private observer:BellPresentationObserver|null=null;
 observePresentation(observer:BellPresentationObserver|null):void {this.observer=observer;}
 private trailOutline:PhaserType.GameObjects.Graphics|null=null;
 setAreaPreview(enabled:boolean):void {
  this.areaPreview=enabled;
  if(enabled)this.drawTrailPreview();
  else if(this.trailOutline){this.trailOutline.clear();this.trailOutline.destroy();this.trailOutline=null;}
 }
 private drawTrailPreview():void {
  if(!this.areaPreview)return;
  if(!this.trails.countActive(true)){this.trailOutline?.clear().setVisible(false).setActive(false);return;}
  if(!this.trailOutline)this.trailOutline=this.scene.add.graphics().setDepth(.65);
  const outline=this.trailOutline.clear().setVisible(true).setActive(true).lineStyle(1,0xd8e5cb,.3);
  // Static trail positions and frozen trigger radii need a redraw only when a
  // native Group member is deployed or recycled, never a second entity ledger.
  for(const bell of this.images(this.trails))if(bell.active)outline.strokeCircle(bell.x,bell.y,bell.getData('triggerRadius'));
 }
 setAreaMultiplier(value:number):void{
  if(value===this.areaScale)return;this.areaScale=value;
  for(const bell of this.images(this.orbits))if(bell.active)bell.setDisplaySize(N.orbitSize*value,N.orbitSize*value);
  this.positionOrbits();
 }
 private orbitRank=0;private orbitRate=0;private updates=0;
 private orbitTween:PhaserType.Tweens.Tween|null=null;
 private radiusTween:PhaserType.Tweens.Tween|null=null;
 private starReturn:PhaserType.Time.TimerEvent|null=null;private starEnd:PhaserType.Time.TimerEvent|null=null;
 constructor(private scene:PhaserType.Scene,private cat:Sprite,
  private nearby:(point:Point,radius:number)=>Sprite[],private damage:(enemy:Sprite,damage:number,effect:string)=>void|number){
  this.trails=scene.add.group({classType:Phaser.GameObjects.Image,maxSize:N.duoTrailMax});
  this.orbits=scene.add.group({classType:Phaser.GameObjects.Image,maxSize:N.orbitMax});
  this.reset();
 }
 get state():State{return this.cat.getData('bellAbilities');}
 private images(group:PhaserType.GameObjects.Group):Image[]{return group.getChildren() as Image[];}
 private removeTrail(bell:Image):void {
  const timer=bell.getData('armTimer') as PhaserType.Time.TimerEvent|null;if(timer){this.scene.time.removeEvent(timer);timer.destroy();bell.setData('armTimer',null);}
  this.trails.killAndHide(bell);
  this.drawTrailPreview();
 }
 reset():void {
  this.clear();const state=new BellAbilityState() as State;
  Object.assign(state,{placed:0,explosions:0,orbitHits:0,replaced:0,sequence:0});this.cat.setData('bellAbilities',state);
 }
 clear():void {
  this.setAreaPreview(false);
  this.clearStar();this.orbitRank=0;this.orbitRate=0;this.updates=0;this.cat.setData({orbitRadius:N.orbitRadius,starActive:false});
  if(this.orbitTween){this.orbitTween.stop();this.orbitTween.remove();this.orbitTween=null;}
  for(const bell of this.images(this.trails))this.removeTrail(bell);
  for(const bell of this.images(this.orbits))this.orbits.killAndHide(bell);
 }
 private clearStar():void {
  if(this.radiusTween){this.radiusTween.stop();this.radiusTween.remove();this.radiusTween=null;}
  for(const timer of [this.starReturn,this.starEnd])if(timer){this.scene.time.removeEvent(timer);timer.destroy();}
  this.starReturn=null;this.starEnd=null;
 }
 collect(amount:number,ranks:GrowthRanks):void {
  if(!this.state.collect(amount,!!ranks.L1_PICKUP_CHIME)||!ranks.L1_DUO_STAR_RING)return;
  this.clearStar();this.cat.setData('starActive',true);
  const radius=(to:number)=>{this.radiusTween=this.scene.tweens.add({targets:this.cat.data.values,orbitRadius:to,duration:N.starTransition*1000,onComplete:()=>{this.radiusTween=null;}});};
  radius(N.starRadius);
  this.starReturn=this.scene.time.delayedCall((N.starSeconds-N.starTransition)*1000,()=>{this.starReturn=null;radius(N.orbitRadius);});
  this.starEnd=this.scene.time.delayedCall(N.starSeconds*1000,()=>{
   this.starEnd=null;this.cat.setData('starActive',false);
   if(this.radiusTween){this.radiusTween.stop();this.radiusTween.remove();this.radiusTween=null;}
   this.cat.setData('orbitRadius',N.orbitRadius);
  });
 }
 ensure(ranks:GrowthRanks,now:number):void {
  const rank=ranks.L1_ORBIT_BELL??0,rate=ranks.L1_RATE;if(!rank||(rank===this.orbitRank&&rate===this.orbitRate))return;
  if(this.orbitRank){
   this.scene.physics.world.bodies.iterate(body=>{
    const enemy=body.gameObject as Sprite;
    if(enemy?.active&&enemy.getData('kind')==='enemy'){
     const state={orbitHitAt:enemy.getData('orbitHitAt')??-Infinity};
     remapOrbitCooldown(state,now,this.orbitRank,rank,this.orbitRate,rate,this.rateCoefficient);enemy.setData('orbitHitAt',state.orbitHitAt);
    }
    return true;
   });
  }
  const stats=orbitStats(rank,rate,this.rateCoefficient),count=stats.count;
  while(this.orbits.countActive(true)<count){
   const bell=this.orbits.get(0,0,'atlas','bell') as Image;
   bell.setTexture('atlas','bell').setDisplaySize(N.orbitSize*this.areaScale,N.orbitSize*this.areaScale).setDepth(3.5).setVisible(true).setActive(true).setData('contactFrom',this.updates+1);
  }
  if(rank!==this.orbitRank)this.images(this.orbits).filter(b=>b.active).forEach((bell,index)=>bell.setData('phase',index*Math.PI*2/count));
  this.orbitRank=rank;this.orbitRate=rate;
  if(!this.orbitTween)this.orbitTween=this.scene.tweens.addCounter({from:0,to:Math.PI*2,duration:N.orbitPeriod*1000,repeat:-1});
  this.orbitTween.setTimeScale(stats.haste);
  this.positionOrbits();
 }
 private positionOrbits():void {
  if(!this.orbitTween)return;const p=this.cat.body!.center,angle=this.orbitTween.getValue()??0,radius=(this.cat.getData('orbitRadius') as number)*this.areaScale;
  for(const bell of this.images(this.orbits))if(bell.active){
   bell.setPosition(p.x+radius,p.y);
   Phaser.Math.RotateAroundDistance(bell,p.x,p.y,angle+bell.getData('phase'),radius);
  }
 }
 place(point:Point,damage:number,max:number=N.trailMax,areaScale=this.areaScale):void {
  if(this.trails.countActive(true)>=max){
   const oldest=this.images(this.trails).filter(b=>b.active).sort((a,b)=>a.getData('birth')-b.getData('birth'))[0];
   this.removeTrail(oldest);this.state.replaced++;this.observer?.retire(trailFact(oldest));
  }
  const bell=this.trails.get(point.x,point.y,'atlas','bell') as Image;
  bell.data?.reset();bell.setTexture('atlas','bell').setPosition(point.x,point.y).setDisplaySize(N.trailSize,N.trailSize).setDepth(.8).setVisible(true).setActive(true).setAlpha(.55);
  bell.setData({birth:++this.state.sequence,armed:false,damage,triggerRadius:N.trailTrigger*areaScale,blastRadius:N.trailRadius*areaScale,armTimer:null});this.state.placed++;
  const arm=this.scene.time.delayedCall(N.trailArm*1000,()=>{bell.setData('armTimer',null);if(bell.active){bell.setData('armed',true);bell.setAlpha(1);}});bell.setData('armTimer',arm);
  this.drawTrailPreview();
  this.observer?.land(trailFact(bell));
 }
 travel(from:Point,to:Point,input:boolean,ranks:GrowthRanks,damage:number,reloading=false):void {
  if(!ranks.L1_TRAIL_BELL)return;
  const line=new Phaser.Geom.Line(from.x,from.y,to.x,to.y);
  const combo=!!ranks.L1_DUO_TRAIL_CADENCE,threshold=combo&&reloading?N.duoTrailDistance:N.trailDistance;
  for(const fraction of this.state.travel(Phaser.Math.Distance.BetweenPoints(from,to),input,threshold))this.place(line.getPoint(fraction),damage,combo?N.duoTrailMax:N.trailMax);
 }
 update(ranks:GrowthRanks,damage:number,now:number):void {
  this.updates++;this.ensure(ranks,now);this.positionOrbits();
  for(const bell of this.images(this.trails))if(bell.active&&bell.getData('armed')&&this.nearby(bell,bell.getData('triggerRadius')).length){
   // Capture targets and frozen D before recycle, then the one actual damage
   // callback owns defeat/drop. Cosmetic feedback cannot gate the explosion.
   const targets=this.nearby(bell,bell.getData('blastRadius')).slice(0,N.trailTargets),hit=bell.getData('damage')*N.trailDamage;
   this.removeTrail(bell);this.state.explosions++;for(const enemy of targets)this.damage(enemy,hit,'TRAIL_BELL');
   this.observer?.blast(trailFact(bell));
  }
  for(const bell of this.images(this.orbits))if(bell.active&&bell.getData('contactFrom')<=this.updates){
   const contacts=this.scene.physics.overlapCirc(bell.x,bell.y,N.orbitHitRadius*this.areaScale,true,false)
    .map(body=>body.gameObject as Sprite).filter(e=>e?.active&&e.getData('kind')==='enemy'&&e.getData('hp')>0)
    .sort((a,b)=>a.getData('id')-b.getData('id'));
   for(const enemy of contacts){
    const state={orbitHitAt:enemy.getData('orbitHitAt')??-Infinity};
    if(!orbitContact(state,now,this.orbitRank,this.orbitRate,this.rateCoefficient))continue;
    enemy.setData('orbitHitAt',state.orbitHitAt);this.state.orbitHits++;
    const point=this.observer&&enemy.body?{x:enemy.body.center.x,y:enemy.body.center.y}:null;
    const actual=this.damage(enemy,damage*orbitStats(this.orbitRank,this.orbitRate,this.rateCoefficient).damageCoefficient*(this.cat.getData('starActive')?N.starDamage:1),'ORBIT_BELL');
    if(point&&typeof actual==='number'&&actual>0)this.observer?.orbitHit(point);
   }
  }
 }
 snapshot(){return {...this.state.snapshot(),placed:this.state.placed,explosions:this.state.explosions,replaced:this.state.replaced,orbitHits:this.state.orbitHits,
  orbitRank:this.orbitRank,orbitCooldown:orbitStats(this.orbitRank,this.orbitRate,this.rateCoefficient).cooldown,orbitHaste:orbitStats(this.orbitRank,this.orbitRate,this.rateCoefficient).haste,orbitPeriod:orbitStats(this.orbitRank,this.orbitRate,this.rateCoefficient).period,orbitDamageCoefficient:orbitStats(this.orbitRank,this.orbitRate,this.rateCoefficient).damageCoefficient,orbitAngle:this.orbitTween?.getValue()??0,orbitRadius:(this.cat.getData('orbitRadius') as number)*this.areaScale,starActive:!!this.cat.getData('starActive'),
  areaMultiplier:this.areaScale,orbitDisplaySize:N.orbitSize*this.areaScale,orbitHitRadius:N.orbitHitRadius*this.areaScale,
  trailPreview:{enabled:this.areaPreview,objects:this.trailOutline?1:0,visible:this.trailOutline?.visible??false,
   circles:this.trailOutline?.visible?this.images(this.trails).filter(b=>b.active).map(b=>({birth:b.getData('birth'),x:b.x,y:b.y,radius:b.getData('triggerRadius')})):[]},
  trails:this.images(this.trails).filter(b=>b.active).map(b=>({x:b.x,y:b.y,armed:!!b.getData('armed'),damage:b.getData('damage'),triggerRadius:b.getData('triggerRadius'),blastRadius:b.getData('blastRadius'),birth:b.getData('birth')})),
  orbits:this.images(this.orbits).filter(b=>b.active).map(b=>({x:b.x,y:b.y,phase:b.getData('phase'),width:b.displayWidth})),
  groups:{trails:{active:this.trails.countActive(true),total:this.trails.getLength()},orbits:{active:this.orbits.countActive(true),total:this.orbits.getLength()}}};}
}
