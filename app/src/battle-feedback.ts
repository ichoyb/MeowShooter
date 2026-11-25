import type Phaser from 'phaser';
import type { Point } from './rules';
import type { IncomingDamageFact } from './player-defense-rules';

type Contact={source:string;weaponId:string;critical:boolean};
type ContactKind='bell'|'fish'|'bone'|'neutral';

// F1 pilot only. These non-physical visuals never produce a combat event.
export class BattleFeedback {
  private readonly effects: Phaser.GameObjects.Group;
  private readonly numbers: Phaser.GameObjects.Group;
  private numbersTotal = 0;
  private criticalNumbersTotal = 0;
  private numberOrder = 0;
  private numberBounds = { top: 0, bottom: 500, left: 0, right: 360 };
  private readonly hurtRing: Phaser.GameObjects.Graphics;
  private readonly shieldBreak: Phaser.GameObjects.Graphics;
  private readonly edge={hurtEdgeAlpha:0};
  private readonly trail={hpTrailRatio:1};
  private readonly xp={xpPulse:0};
  private health={hp:0,maxHp:0};
  private effectOrder=0;
  private enabled = false;
  private quality: 'standard' | 'low' = 'standard';
  private refinedContacts=false;
  private hits = 0;
  private defeats = 0;
  private hurts = 0;

  constructor(private readonly scene: Phaser.Scene, image: HTMLImageElement) {
    scene.textures.addImage('f1-hit', image);
    this.effects = scene.add.group({ defaultKey: 'f1-hit', maxSize: 8 });
    this.effects.createMultiple({ key: 'f1-hit', quantity: 8, active: false, visible: false });
    this.numbers = scene.add.group({ maxSize: 8 });
    for (let i = 0; i < 8; i++) this.numbers.add(scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#fff8da',
      stroke: '#64513c', strokeThickness: 3, padding: { x: 3, y: 2 }
    }).setOrigin(.5).setDepth(4.4).setActive(false).setVisible(false));
    this.hurtRing = scene.add.graphics().setDepth(2.8).setVisible(false);
    this.hurtRing.lineStyle(2, 0xbd546c, .9).strokeEllipse(0, 0, 48, 16);
    this.shieldBreak=scene.add.graphics().setDepth(4.3).setVisible(false);
    this.shieldBreak.lineStyle(2,0x71dfe1,.9);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2+.18;this.shieldBreak.beginPath().arc(0,0,22,angle,angle+.8).strokePath();}
    // Bake a few tiny, immutable native Graphics once. Canvas does not render
    // Sprite tint; source colors therefore live in the real drawn pixels.
    const drawing=scene.add.graphics();
    for(const kind of ['bell','fish','bone','neutral'] as const)for(const critical of [false,true]){
      if(kind==='bell'&&!critical)continue;
      drawing.clear().save().scaleCanvas(2,2);const color=critical?0xf4c95d:kind==='fish'?0x7fe1ea:kind==='bone'?0xfff3d6:0xc8c5ed;
      drawing.lineStyle(critical?4:3,color,1);
      if(critical){for(let i=0;i<8;i++){const angle=i*Math.PI/4,r=i%2?9:24;const x=32+Math.cos(angle)*r,y=32+Math.sin(angle)*r;if(i===0)drawing.beginPath().moveTo(x,y);else drawing.lineTo(x,y);}drawing.closePath().strokePath();}
      else if(kind==='fish'){drawing.beginPath().moveTo(32,8).lineTo(32,56).moveTo(10,32).lineTo(54,32).moveTo(17,17).lineTo(47,47).moveTo(17,47).lineTo(47,17).strokePath();}
      else if(kind==='bone'){drawing.beginPath().moveTo(12,32).lineTo(24,32).moveTo(40,32).lineTo(52,32).moveTo(25,12).lineTo(29,23).moveTo(35,41).lineTo(39,52).strokePath();drawing.fillStyle(color).fillCircle(32,32,5);}
      else drawing.strokeCircle(32,32,17).fillStyle(color).fillCircle(32,32,4);
      drawing.restore().generateTexture('g5-contact-'+kind+(critical?'-critical':''),128,128);
    }
    drawing.destroy();
  }

  configure(enabled: boolean, quality: 'standard' | 'low',refinedContacts=false): void {
    if (this.enabled !== enabled || this.quality !== quality) this.clear();
    this.enabled = enabled; this.quality = quality;
    this.refinedContacts=refinedContacts;
  }

  layout(bounds: { top: number; bottom: number; left?: number; right?: number }): void {
    this.numberBounds = { top: bounds.top, bottom: bounds.bottom, left: bounds.left ?? 0, right: bounds.right ?? 360 };
    // Text canvases rasterize at the actual buffer pixels per world unit.
    // Camera zoom includes both render density and the CSS viewport scale.
    for (const text of this.numbers.getChildren() as Phaser.GameObjects.Text[]) {
      if (text.style.resolution !== this.scene.cameras.main.zoom) text.setResolution(this.scene.cameras.main.zoom);
      // Phaser 3.90 Text.setResolution updates its canvas/style, while Canvas
      // batchSprite reads TextureSource.resolution to recover world dimensions.
      text.frame.source.resolution = text.style.resolution;
      if (text.active) { this.scene.tweens.killTweensOf(text); this.numbers.killAndHide(text); }
    }
  }

  damage(position: Point, damage: number, player = false, protagonist?: Point, critical = false): void {
    if (!this.enabled || !Number.isFinite(damage) || damage <= 0) return;
    this.numbersTotal++;
    const marked=critical&&!player;if(marked)this.criticalNumbersTotal++;
    const entries = this.numbers.getChildren() as Phaser.GameObjects.Text[];
    let text = entries.find(entry => !entry.active);
    const priority=player?2:marked?1:0;
    if (!text) text = entries.filter(entry => (entry.getData('priority')??0)<=priority)
      .sort((a, b) => a.getData('priority')-b.getData('priority')||a.getData('order') - b.getData('order'))[0];
    // All eight slots may be protected player damage. Ordinary hits then have
    // no visual slot; the combat result has already been applied independently.
    if (!text && player) text = entries.slice().sort((a, b) => a.getData('order') - b.getData('order'))[0];
    if (!text) return;
    this.scene.tweens.killTweensOf(text);
    text.setText((damage < .01 ? '<0.01' : String(Number(damage.toFixed(2))))+(marked?'!':''))
      .setFontSize(marked?22:16).setScale(marked?.85:1).setColor(player ? '#f79bb1' : marked?'#f4c95d':'#fff8da').setAlpha(1).setActive(true).setVisible(true)
      .setData('player', player).setData('critical',marked).setData('priority',priority).setData('peakScale',marked?1.15:1).setData('order', ++this.numberOrder);
    // Reserve the native pop's largest footprint, including at world edges and
    // beside the protagonist. Text.width itself does not include Tween scale.
    const footprint=text.getData('peakScale') as number;
    const halfWidth = text.width * footprint / 2, halfHeight = text.height * footprint / 2;
    const left = this.numberBounds.left + halfWidth, rightEdge = this.numberBounds.right - halfWidth;
    let x = Math.max(left, Math.min(rightEdge, position.x));
    let desiredY = position.y - (player ? 49 : 32);
    // Nearby enemy hits must also leave the protagonist face unobscured.
    if (protagonist && Math.abs(x - protagonist.x) < halfWidth + 25 &&
      desiredY + halfHeight > protagonist.y - 38 && desiredY - halfHeight < protagonist.y - 3) {
      desiredY = protagonist.y - 39 - halfHeight;
    }
    const y = Math.max(this.numberBounds.top + halfHeight + 24,
      Math.min(this.numberBounds.bottom - halfHeight, desiredY));
    const face = protagonist ?? (player ? position : undefined);
    if (face && Math.abs(x - face.x) < halfWidth + 30 &&
      y + halfHeight > face.y - 39 && y - 24 - halfHeight < face.y + 10) {
      const right = face.x + 31 + halfWidth;
      x = right <= rightEdge ? right : Math.max(left, face.x - 31 - halfWidth);
    }
    // A real volley can land PRIMARY and SECONDARY at the same point. Keep
    // each event readable instead of combining their damage into one label.
    const baseX = x;
    for (let offset = 0; offset < 16; offset++) {
      const distance = Math.ceil(offset / 2) * (text.width * footprint + 5) * (offset % 2 ? -1 : 1);
      const candidate = Math.max(left, Math.min(rightEdge, baseX + distance));
      const coversFace = face && Math.abs(candidate - face.x) < halfWidth + 30 &&
        y + halfHeight > face.y - 39 && y - 24 - halfHeight < face.y + 10;
      const overlapsNumber = entries.some(other => other !== text && other.active &&
        Math.abs(candidate - other.x) < (text!.width * footprint + other.width * (other.getData('peakScale')??1)) / 2 + 3 &&
        Math.abs(y - other.y) < (text!.height * footprint + other.height * (other.getData('peakScale')??1)) / 2 + 3);
      if (!coversFace && !overlapsNumber) { x = candidate; break; }
    }
    text.setPosition(x, y);
    if(marked)this.scene.tweens.add({targets:text,scale:1.15,duration:45,ease:'Quad.easeOut',onComplete:()=>{
      this.scene.tweens.add({targets:text,scale:1,duration:45,ease:'Quad.easeOut'});
    }});
    this.scene.tweens.add({ targets: text, y: y - 24, alpha: 0, duration: 500, ease: 'Quad.easeOut',
      onComplete: () => this.numbers.killAndHide(text!) });
  }

  private take(priority = 0): Phaser.GameObjects.Sprite | null {
    let sprite = this.effects.get() as Phaser.GameObjects.Sprite | null;
    if (!sprite) {
      const oldest = (this.effects.getChildren() as Phaser.GameObjects.Sprite[]).filter(s=>(s.getData('priority')??0)<=priority)
        .sort((a,b)=>a.getData('priority')-b.getData('priority')||a.getData('order')-b.getData('order'))[0];
      if (oldest) { this.scene.tweens.killTweensOf(oldest); this.effects.killAndHide(oldest); sprite = this.effects.get(); }
    }
    if (!sprite) return null;
    this.scene.tweens.killTweensOf(sprite);
    sprite.data?.reset();sprite.setData({priority,order:++this.effectOrder});
    return sprite.stop().setActive(true).setVisible(true).setAlpha(1).setRotation(0).setFlip(false, false).setOrigin(.5);
  }

  hit(position: Point,contact:Contact={source:'PRIMARY',weaponId:'W01',critical:false}): void {
    if (!this.enabled) return;
    this.hits++;
    const sprite = this.take(contact.critical?2:0); if (!sprite) return;
    const kind:ContactKind=contact.source==='PRIMARY'||contact.source==='SECONDARY'?contact.weaponId==='W01'?'bell':contact.weaponId==='W04'?'fish':'bone':'neutral';
    const size=contact.critical?28:20,duration=contact.critical?180:160;
    sprite.setTexture(kind==='bell'&&!contact.critical?'f1-hit':'g5-contact-'+kind+(contact.critical?'-critical':''))
      .setPosition(position.x, position.y).setDisplaySize(size,size).setDepth(4.2).setData({effect:'contact',kind,critical:contact.critical,size,duration});
    const first=contact.critical?50:60;
    this.scene.tweens.add({ targets: sprite, alpha: 0,
      duration, ease: this.refinedContacts?(p:number)=>{
        const ms=p*duration;return ms<=first?.65*ms/first:.65+.35*(ms-first)/(duration-first);
      }:'Quad.easeOut', onComplete: () => this.effects.killAndHide(sprite) });
  }

  defeat(target: Phaser.GameObjects.Sprite): void {
    if (!this.enabled) return;
    this.defeats++;
    const ghost = this.take(-1); if (!ghost) return;
    ghost.setTexture(target.texture.key, target.frame.name).setPosition(target.x, target.y)
      .setDisplaySize(target.displayWidth, target.displayHeight).setFlip(target.flipX, target.flipY).setDepth(1.1);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: this.quality === 'standard' ? 200 : 160,
      onComplete: () => this.effects.killAndHide(ghost) });
  }

  hurt(position: Point): void {
    if (!this.enabled) return;
    this.hurts++; this.scene.tweens.killTweensOf(this.hurtRing);
    this.follow(position); this.hurtRing.setVisible(true).setAlpha(1);
    this.scene.tweens.add({ targets: this.hurtRing, alpha: 0, duration: 160,
      onComplete: () => this.hurtRing.setVisible(false) });
  }

  syncHealth(hp:number,maxHp:number):void {
    if(hp>this.health.hp||maxHp!==this.health.maxHp){this.scene.tweens.killTweensOf(this.trail);this.trail.hpTrailRatio=hp/maxHp;}
    this.health={hp,maxHp};
  }

  incoming(fact:IncomingDamageFact,position:Point,hp:number,maxHp:number):void {
    if(!this.enabled||!fact.accepted)return;
    if(fact.shieldBroke){this.scene.tweens.killTweensOf(this.shieldBreak);this.shieldBreak.setPosition(position.x,position.y+10).setAlpha(1).setScale(1).setVisible(true);
      this.scene.tweens.add({targets:this.shieldBreak,alpha:0,scale:1.2,duration:180,onComplete:()=>this.shieldBreak.setVisible(false)});}
    if(fact.hpLost<=0)return;
    this.hurt(position);this.damage(position,fact.hpLost,true);
    this.scene.tweens.killTweensOf(this.edge);this.edge.hurtEdgeAlpha=this.quality==='low'?.10:.13;
    this.scene.tweens.add({targets:this.edge,hurtEdgeAlpha:0,duration:160});
    this.scene.tweens.killTweensOf(this.trail);
    this.trail.hpTrailRatio=Math.max(this.trail.hpTrailRatio,(hp+fact.hpLost)/maxHp);
    this.health={hp,maxHp};
    this.scene.tweens.add({targets:this.trail,hpTrailRatio:hp/maxHp,duration:350,ease:'Quad.easeIn'});
  }

  collectXP(amount:number):void {
    if(!this.enabled||amount<=0)return;
    this.scene.tweens.killTweensOf(this.xp);this.xp.xpPulse=1;
    this.scene.tweens.add({targets:this.xp,xpPulse:0,duration:180});
  }

  follow(position: Point): void { this.hurtRing.setPosition(position.x, position.y + 22);this.shieldBreak.setPosition(position.x,position.y+10); }

  clear(): void {
    for (const text of this.numbers.getChildren()) {
      this.scene.tweens.killTweensOf(text); this.numbers.killAndHide(text);
    }
    for (const object of this.effects.getChildren()) {
      this.scene.tweens.killTweensOf(object); this.effects.killAndHide(object);
    }
    this.scene.tweens.killTweensOf(this.hurtRing); this.hurtRing.setVisible(false);
    this.scene.tweens.killTweensOf(this.shieldBreak);this.shieldBreak.setVisible(false);
    for(const value of [this.edge,this.trail,this.xp])this.scene.tweens.killTweensOf(value);this.edge.hurtEdgeAlpha=0;this.xp.xpPulse=0;
    this.trail.hpTrailRatio=this.health.maxHp>0?this.health.hp/this.health.maxHp:1;
  }

  reset(): void { this.clear();this.health={hp:0,maxHp:0};this.trail.hpTrailRatio=1; this.hits = 0; this.defeats = 0; this.hurts = 0; this.numbersTotal = 0; this.criticalNumbersTotal = 0; this.numberOrder = 0;this.effectOrder=0; }
  snapshot() { return { enabled: this.enabled, quality: this.quality, hits: this.hits, defeats: this.defeats, hurts: this.hurts,
    active: this.effects.countActive(true), allocated: this.effects.getLength(), hurtVisible: this.hurtRing.visible,
    hud:{...this.edge,...this.trail,...this.xp},shieldBreakVisible:this.shieldBreak.visible,independentGraphics:2,
    contactDetails:(this.effects.getChildren() as Phaser.GameObjects.Sprite[]).filter(s=>s.active&&s.getData('effect')==='contact').map(s=>({kind:s.getData('kind') as ContactKind,critical:s.getData('critical') as boolean,size:s.getData('size') as number,duration:s.getData('duration') as number,x:s.x,y:s.y})),
    numbersActive: this.numbers.countActive(true), numbersAllocated: this.numbers.getLength(), numbersTotal: this.numbersTotal,criticalNumbersTotal:this.criticalNumbersTotal,
    numberDetails: (this.numbers.getChildren() as Phaser.GameObjects.Text[]).filter(text => text.active)
      .sort((a, b) => a.getData('order') - b.getData('order')).map(text => ({ text: text.text, player: text.getData('player') as boolean,critical:text.getData('critical') as boolean,color:text.style.color,fontSize:text.style.fontSize,
        scale:text.scaleX,order: text.getData('order') as number, x: text.x, y: text.y, width: text.width, height: text.height, resolution: text.style.resolution, sourceResolution: text.frame.source.resolution })),
    physicalBodies: 0, interactiveObjects: 0 }; }
}
