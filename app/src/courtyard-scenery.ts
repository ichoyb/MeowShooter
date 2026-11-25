import type Phaser from 'phaser';
import type {Point} from './rules';
import {COURTYARD} from './arena-layout';
const ART={x:-152,y:-304,width:1024,height:2048},KEY='courtyard-native-painting';
// Original continuous composition. Source pixels go directly to a native Image;
// there is no map CanvasTexture, material pattern, or viewport raster in between.
export class CourtyardScenery{
  private readonly map:Phaser.GameObjects.Image;
  private readonly shadows:Phaser.GameObjects.Graphics;
  private enabled=false;private quality:'standard'|'low'='standard';
  private readonly sourceSize:{width:number;height:number};
  constructor(private readonly scene:Phaser.Scene,_camera:Phaser.Cameras.Scene2D.Camera,source:HTMLImageElement){
    this.sourceSize={width:source.naturalWidth,height:source.naturalHeight};
    scene.events.once('shutdown',()=>{if(scene.textures.exists(KEY))scene.textures.remove(KEY);});
    scene.textures.addImage(KEY,source);
    this.map=scene.add.image(ART.x,ART.y,KEY).setOrigin(0).setDisplaySize(ART.width,ART.height).setDepth(-3).setVisible(false);
    this.shadows=scene.add.graphics().setDepth(.5);
  }
  backgroundObjects():Phaser.GameObjects.GameObject[]{return [this.map];}
  layout(enabled:boolean,quality:'standard'|'low',_bounds:{top:number;bottom:number},_height:number):void{
    this.enabled=enabled;this.quality=quality;this.map.setVisible(enabled);this.shadows.clear().setVisible(enabled);
  }
  syncCamera():void{/* The existing native Camera renders the fixed Image. */}
  drawShadows(cat:Point,actors:readonly {x:number;y:number;kind:string}[]):void{
    this.shadows.clear();if(!this.enabled)return;
    const draw=(x:number,y:number,width:number)=>{this.shadows.fillStyle(0x52633d,.04).fillEllipse(x,y,width+5,10).fillStyle(0x52633d,.09).fillEllipse(x,y,width,7);};
    draw(cat.x,cat.y+16,20);if(this.quality==='standard')for(const actor of actors)draw(actor.x,actor.y+(actor.kind==='enemy'?15:19),actor.kind==='enemy'?25:31);
  }
  snapshot(){
    return {enabled:this.enabled,quality:this.quality,textured:this.enabled,visualRevision:'courtyard-continuous-native-v01',
      physicalBodies:0,interactiveObjects:0,worldWidth:COURTYARD.width,worldHeight:COURTYARD.height,
      artImages:1,artFrames:1,staticLayers:1,landmarkGroups:4,sourceSize:{...this.sourceSize},
      basePixelsAcross360u:this.sourceSize.width*360/ART.width,mapSources:{count:1,totalRGBA:this.sourceSize.width*this.sourceSize.height*4},
      artBounds:{...ART},playableBounds:{x:0,y:0,width:COURTYARD.width,height:COURTYARD.height},
      mapCache:{persistentRGBAEstimate:0,createCount:0,route:'HTMLImageElement to native Phaser Image and existing Camera; no generated raster cache'}
    };
  }
}
