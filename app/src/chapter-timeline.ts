import type Phaser from 'phaser';
import {CHAPTER_DURATION,type ChapterKind} from './ui/chapter-motion';
// A single native presentation Scene. The Arena stays paused throughout a film.
export function createChapterTimeline(game:Phaser.Game,Scene:typeof Phaser.Scene){
 const key='N1ChapterPresentation';
 let tween:Phaser.Tweens.Tween|null=null,time=0,kind:ChapterKind='opening',playing=false,ready=false,disposed=false;
 let frame:(seconds:number)=>void=()=>{},complete:()=>void=()=>{},pending=false;
 class ChapterScene extends Scene{
  constructor(){super({key,active:false});}
  create(){ready=true;if(pending)begin();else this.scene.pause();}
 }
 const scene=new ChapterScene();game.scene.add(key,scene,false);
 function begin(){
  if(disposed||!pending)return;pending=false;playing=true;scene.scene.resume();
  const duration=CHAPTER_DURATION[kind];
  tween=scene.tweens.addCounter({from:time,to:duration,duration:Math.max(1,(duration-time)*1000),ease:'Linear',
   onUpdate:(value:Phaser.Tweens.Tween)=>{if(!playing)return;time=Number(value.getValue());frame(time);},
   onComplete:()=>{if(!playing)return;time=duration;playing=false;tween=null;frame(time);complete();}});
 }
 function pause(){pending=false;if(tween){time=Number(tween.getValue());tween.remove();tween=null;}playing=false;if(ready)scene.scene.pause();return time;}
 return {
  start(value:ChapterKind,at:number,onFrame:(seconds:number)=>void,onComplete:()=>void){if(disposed)return;pause();kind=value;time=Math.max(0,Math.min(CHAPTER_DURATION[kind],at));frame=onFrame;complete=onComplete;pending=true;
   if(ready)begin();else game.scene.run(key);},
  pause,
  stop(){pause();time=0;frame=()=>{};complete=()=>{};},
  snapshot:()=>({kind,time,playing,pending,scene:key,active:ready&&scene.scene.isActive(),tweens:ready?scene.tweens.getTweens().length:0}),
  dispose(){if(disposed)return;pause();disposed=true;game.scene.remove(key);}
 };
}
export type ChapterTimeline=ReturnType<typeof createChapterTimeline>;
