import type Phaser from 'phaser';
type Sprite=Phaser.Physics.Arcade.Sprite;
// Group owns every projectile. Only the still-unfired business quota lives here
// and on its attack owner; ordinary flowers must use this same acquisition gate.
export class BossProjectileSlots {
 reserved=0;
 constructor(private readonly group:Phaser.Physics.Arcade.Group){}
 get available():number{return this.group.getTotalFree()-this.reserved;}
 reserve(owner:Sprite,count:number):boolean{
  if(owner.getData('reservedProjectiles')||count>this.available)return false;
  owner.setData('reservedProjectiles',count);this.reserved+=count;return true;
 }
 release(owner:Sprite):void{
  this.reserved-=owner.getData('reservedProjectiles')??0;owner.setData('reservedProjectiles',0);
 }
 get(x:number,y:number,owner?:Sprite):Sprite|null{
  const quota=owner?.getData('reservedProjectiles')??0;
  if(owner?quota<=0:this.available<=0)return null;
  const shot=this.group.get(x,y,'enemy-bubble') as Sprite|null;if(!shot)return null;
  if(owner){owner.setData('reservedProjectiles',quota-1);this.reserved--;}
  return shot;
 }
}
