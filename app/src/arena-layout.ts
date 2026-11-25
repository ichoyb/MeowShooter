import type {Point} from './rules';

export const COURTYARD = Object.freeze({width:720,height:1440,spawnGap:48,minSpawnDistance:180});
export type VisibleField = {x:number;y:number;width:number;height:number};

// Eligibility for a birth, not collision/separation. Candidate points themselves
// are generated on a Phaser.Geom.Rectangle perimeter by the Scene.
export function chooseCourtyardSpawn(candidates:readonly Point[],view:VisibleField,player:Point,limits?:{gap:number;minDistance:number}):Point|null {
  const {width,height}=COURTYARD;
  const gap=limits?.gap??COURTYARD.spawnGap,minSpawnDistance=limits?.minDistance??COURTYARD.minSpawnDistance;
  for(const point of candidates.slice(0,8)) {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
    if(point.x<-gap||point.y<-gap||point.x>width+gap||point.y>height+gap)continue;
    if(point.x>-gap&&point.x<width+gap&&point.y>-gap&&point.y<height+gap)continue;
    if(point.x>view.x-gap&&point.x<view.x+view.width+gap&&point.y>view.y-gap&&point.y<view.y+view.height+gap)continue;
    if(Math.hypot(point.x-player.x,point.y-player.y)<minSpawnDistance)continue;
    return {x:point.x,y:point.y};
  }
  return null;
}

// Phaser's pointer/Scale have already converted DOM coordinates to buffer
// pixels. Movement intent is in the fixed screen plane, without world scroll.
export function inputBufferPoint(x:number,y:number,zoom:number):Point { return {x:x/zoom,y:y/zoom}; }
