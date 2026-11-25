import type Phaser from 'phaser';
import h1Art from './h1-art.json';
import type {Point} from './rules';

type HeldCat = keyof typeof h1Art.actors;

// Presentation consumes final Arcade displacement and actual fireVolley events.
// The existing hidden Arcade cat remains the sole body and projectile origin.
export class HeldHeroPresentation {
  private readonly body: Phaser.GameObjects.Image;
  private readonly weapon: Phaser.GameObjects.Image;
  private readonly grip: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly pose = {distance:0,alpha:1};
  private enabled = false;
  private catId: HeldCat = 'CAT02';
  private displaySize = 36;
  private flipX = false;
  private motion: 'idle' | 'moving' = 'idle';
  private state: 'idle' | 'fire' = 'idle';
  private volleys = 0;
  private aimAngle = -Math.PI / 2;
  private gaitOffset: Point = {x:0,y:0};

  constructor(private readonly scene: Phaser.Scene) {
    for (const id of ['CAT02','CAT03'] as const) {
      const {x,y,w,h}=h1Art.actors[id].headFrame;
      if (!scene.textures.get('cat-'+id).has('h1-head')) scene.textures.get('cat-'+id).add('h1-head',0,x,y,w,h);
    }
    this.body=scene.add.image(0,0,'cat-CAT02',scene.textures.get('cat-CAT02').has('body')?'body':'__BASE').setDepth(3).setVisible(false);
    this.weapon=scene.add.image(0,0,'h1-art','h1-weapon-W04').setDepth(3.1).setVisible(false);
    this.grip=scene.add.image(0,0,'h1-art','h1-grip-CAT02').setDepth(3.2).setVisible(false);
    this.head=scene.add.image(0,0,'cat-CAT02','h1-head').setOrigin(.5,0).setDepth(3.3).setVisible(false);
  }

  objects(): Phaser.GameObjects.Image[] {return [this.body,this.weapon,this.grip,this.head];}

  reset(enabled: boolean, catId: HeldCat = 'CAT02', displaySize = 36): void {
    this.setGaitOffset({x:0,y:0});
    this.scene.tweens.killTweensOf(this.pose);
    this.pose.distance=0;this.pose.alpha=1;
    this.enabled=enabled;this.catId=catId;this.displaySize=displaySize;
    this.flipX=false;this.motion='idle';this.state='idle';this.volleys=0;this.aimAngle=-Math.PI/2;
    const mapping=h1Art.actors[catId];
    this.body.setTexture('cat-'+catId,this.scene.textures.get('cat-'+catId).has('body')?'body':'__BASE').setDisplaySize(displaySize,displaySize);
    this.weapon.setTexture('h1-art',mapping.weaponFrame).setOrigin(mapping.weaponOrigin[0],mapping.weaponOrigin[1])
      .setDisplaySize(displaySize*mapping.weaponSizeRatio,displaySize*mapping.weaponSizeRatio).setAlpha(1);
    this.grip.setTexture('h1-art',mapping.gripFrame).setDisplaySize(displaySize*mapping.gripSizeRatio,displaySize*mapping.gripSizeRatio);
    this.head.setTexture('cat-'+catId,'h1-head').setScale(displaySize/384);
    for(const object of this.objects())object.setVisible(enabled).setFlipX(false);
  }

  fire(): void {
    if(!this.enabled)return;
    this.scene.tweens.killTweensOf(this.pose);
    this.volleys++;this.state='fire';this.pose.distance=0;this.pose.alpha=1;
    const throwing=this.catId==='CAT02';
    this.scene.tweens.add({targets:this.pose,distance:throwing?4.5:-1.6,alpha:throwing?.18:1,
      duration:throwing?85:65,yoyo:true,ease:'Sine.easeOut',
      onComplete:()=>{this.pose.distance=0;this.pose.alpha=1;this.state='idle';}});
  }

  /** Translate the authored layers rigidly; the Arcade body and volley stay independent. */
  setGaitOffset(offset: Point): void {
    const dx=offset.x-this.gaitOffset.x,dy=offset.y-this.gaitOffset.y;
    for(const object of this.objects())object.setPosition(object.x+dx,object.y+dy);
    this.gaitOffset={x:offset.x,y:offset.y};
  }

  sync(position:Point,moved:boolean|null,horizontalDisplacement:number,aim:Point):void {
    if(!this.enabled)return;
    if(moved!==null)this.motion=moved?'moving':'idle';
    if(moved!==null&&Math.abs(horizontalDisplacement)>.00001)this.flipX=horizontalDisplacement>0;
    const mapping=h1Art.actors[this.catId],flip=this.flipX,scale=this.displaySize;
    this.aimAngle=Math.atan2(aim.y,aim.x);
    const visual={x:position.x+this.gaitOffset.x,y:position.y+this.gaitOffset.y};
    const x=visual.x+(flip?-mapping.grip[0]:mapping.grip[0])*scale,y=visual.y+mapping.grip[1]*scale;
    this.body.setPosition(visual.x,visual.y).setFlipX(flip);
    this.weapon.setPosition(x+Math.cos(this.aimAngle)*this.pose.distance,y+Math.sin(this.aimAngle)*this.pose.distance)
      // Native Image flip reflects around its frame center. Mirror the origin
      // as well so the authored off-center grip stays at the same world point.
      .setOrigin(flip?1-mapping.weaponOrigin[0]:mapping.weaponOrigin[0],mapping.weaponOrigin[1])
      .setFlipX(flip).setRotation(this.aimAngle-(flip?Math.PI-mapping.releaseAngle:mapping.releaseAngle)).setAlpha(this.pose.alpha);
    this.grip.setPosition(x,y).setFlipX(flip);
    this.head.setPosition(visual.x,visual.y-scale/2).setFlipX(flip);
  }

  snapshot() {
    return {active:this.enabled,catId:this.catId,weaponId:h1Art.actors[this.catId].weaponId,
      state:this.state,motion:this.motion,walkingAnimation:false,facing:this.flipX?'right':'left',flipX:this.flipX,
      volleys:this.volleys,weaponFrame:this.weapon.frame.name,aimAngle:this.aimAngle,weaponRotation:this.weapon.rotation,
      pose:{...this.pose},display:{width:this.body.displayWidth,height:this.body.displayHeight},
      bodyPosition:{x:this.body.x,y:this.body.y},weaponPosition:{x:this.weapon.x,y:this.weapon.y},
      visualObjects:4,physicalBodies:0,interactiveObjects:0};
  }
}
