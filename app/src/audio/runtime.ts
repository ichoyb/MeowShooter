import type Phaser from 'phaser';
import {createAudioSession} from './session';
// @ts-expect-error Official generated JS is checked by SHA at build time.
import {createCombatSampleBank} from './combat-synthesis.mjs';
// @ts-expect-error Approved source scores use the same pinned lazy vendor build.
import {renderChapterStems} from './chapter-synthesis.mjs';
export function createRuntimeAudio(game:Phaser.Game,Manager:typeof Phaser.Sound.WebAudioSoundManager,getScene:()=>Phaser.Scene|null=()=>null){
 const samples=createCombatSampleBank({impact:true});const session=createAudioSession({samples:{...samples,story:renderChapterStems},cache:game.cache.audio,
  makeTween(config){const scene=getScene();if(!scene)throw Error('Boss音乐转场缺少当前Scene');return scene.tweens.add(config);},
  makeDelay(ms,callback){const scene=getScene();if(!scene)throw Error('声音延时缺少当前Scene');const event=scene.time.delayedCall(ms,callback);return {remove(){scene.time.removeEvent(event);event.destroy();}};},
  makeContext(){if(!window.AudioContext)throw Error('当前环境不支持 Web Audio');return new AudioContext();},
  makeManager(context){
   const previous=game.config.audio.context;let native:Phaser.Sound.WebAudioSoundManager;
   try{game.config.audio.context=context;native=new Manager(game);}finally{game.config.audio.context=previous;}
   // This app resumes only on explicit continue. Native VISIBLE schedules an
   // uncancellable delayed resume, which could outlive our owned Context.
   game.events.off('visible',(native as any).onGameVisible,native);
   native.pauseOnBlur=false;
   // This manager is explicitly owned here, rather than game.sound (noAudio).
   // Remove BaseSoundManager's once listener before manually destroying it.
   return {get sounds(){return (native as any).sounds;},get locked(){return native.locked;},get mute(){return native.mute;},set mute(v){native.mute=v;},get volume(){return native.volume;},set volume(v){native.volume=v;},add(key){return native.add(key) as any;},remove(sound){return native.remove(sound as any);},stopAll(){native.stopAll();},destroy(){
    game.events.off('destroy',native.destroy,native);
    const old=game.config.audio.context;try{game.config.audio.context=context;native.destroy();}finally{game.config.audio.context=old;}
   }};
  },
 });return {...session,snapshot(){return {...session.snapshot(),pcm:samples.info()};}};
}
