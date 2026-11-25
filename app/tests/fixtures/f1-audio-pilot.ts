// Review-only choreography around the real Arena. Never included in a ZIP.
import {createBattle, type BattleSnapshot} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import type Phaser from 'phaser';
import {runAudioChecks} from './f1-audio-checks';
const stage=document.getElementById('stage')!,status=document.getElementById('status')!;
declare function require(path:string):any;
const w=window as any;
const position=(actor:any,x:number,y:number)=>{actor.body.reset(x,y);actor.body.updateFromGameObject();actor.body.prev.copy(actor.body.position);actor.body.prevFrame.copy(actor.body.position);};
let a:any;
async function createCapturedBattle(...args:Parameters<typeof createBattle>){
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),graphics=factory.prototype.graphics;
 factory.prototype.graphics=function(...params:any[]){a=this.scene;return graphics.apply(this,params);};
 try{return await createBattle(...args);}finally{factory.prototype.graphics=graphics;}
}

const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function boot(){
  const cats=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('./assets/ui/'+id+'.png')));
  let started=false,done=false,paused=false,checking=false,request=0,quality:'standard'|'low'='standard';
  const timers=new Set<Phaser.Time.TimerEvent>();
  const battle=await createCapturedBattle(stage,{onState(s){
    stage.dataset.state=JSON.stringify(s);
    if(!started)return;
    if(battle.audio)stage.dataset.audio=JSON.stringify(battle.audio.snapshot());
    const soundError=battle.audio?.snapshot().error;
    status.textContent=`${paused?'已暂停':done?'小样结束，可重播':'受控实战小样'} · ${Math.min(10,s.elapsed).toFixed(1)} / 10秒 · 生命 ${s.hp}/${s.maxHp}${soundError?' · 声音暂不可用：'+soundError:''}`;
    document.getElementById('events')!.textContent=`真实命中 ${s.feedback?.hits??0} · 击败 ${s.feedback?.defeats??0} · 受伤 ${s.feedback?.hurts??0} · 伤害数字 ${s.feedback?.numbersTotal??0}`;
    capture(s);
    if(s.elapsed>=10&&!done){done=true;battle.pause('menu');}
  },onInterrupt(){paused=true;battle.pause('menu');},onFinish(){}},{CAT01:cats[0],CAT02:cats[1],CAT03:cats[2]});
  function later(ms:number,fn:()=>void){const t=a.time.delayedCall(ms,()=>{timers.delete(t);fn();});timers.add(t);}
  const captured=new Set<string>();
  function capture(s:BattleSnapshot){
    for(const [name,count] of [['hit',s.feedback?.hits],['defeat',s.feedback?.defeats],['hurt',s.feedback?.hurts]] as const){
      if(!count||captured.has(name))continue;captured.add(name);
      later(45,()=>{try{const picture=document.getElementById('frame-'+name) as HTMLImageElement;picture.src=a.game.canvas.toDataURL('image/png');picture.dataset.actualFrame='true';}catch{document.getElementById('capture-note')!.textContent='当前环境不支持相位截帧，请直接播放小样。';}});
    }
  }
  function layout(){const height=360*stage.clientHeight/stage.clientWidth;battle.setBounds({top:18,bottom:height-20});battle.setInputArea({left:0,right:360,top:18,bottom:height-20},stage.clientWidth/360,[]);}
  function target(x:number,y:number){const enemy=a.place(a.enemies,x,.3,'enemy');if(enemy){position(enemy,x,y);enemy.body.moves=false;}return enemy;}
  async function play(){
    const token=++request;
    await battle.audio?.enable();
    if(token!==request)return;
    for(const timer of timers){a.time.removeEvent(timer);timer.destroy();}timers.clear();
    started=false;done=false;paused=false;captured.clear();
    for(const name of ['hit','defeat','hurt']){const img=document.getElementById('frame-'+name) as HTMLImageElement;img.removeAttribute('src');delete img.dataset.actualFrame;}
    battle.setPresentation({quality});
    const base=makeRunConfig('CAT01','W01','p2-basic');
    battle.start(Object.freeze({...base,scenario:Object.freeze({...base.scenario,spawnIntervalSeconds:10000})}));layout();
    for(const group of [a.enemies,a.objects,a.projectiles])for(const actor of group.getChildren())a.recycle(actor,group);
    started=true;target(a.cat.x+88,a.cat.y-65);
    later(300,()=>{a.keys.D.isDown=true;});later(950,()=>a.clearInput());
    later(1900,()=>{target(a.cat.x-95,a.cat.y-72);a.keys.A.isDown=true;});later(2550,()=>a.clearInput());
    later(3900,()=>target(a.cat.x+75,a.cat.y-45));
    later(5800,()=>target(a.cat.x,a.cat.y));later(5950,()=>{a.keys.D.isDown=true;});later(6500,()=>a.clearInput());
    later(7600,()=>target(a.cat.x-95,a.cat.y-80));
  }
  document.getElementById('play')!.addEventListener('click',play);
  document.getElementById('checks')!.addEventListener('click',()=>{if(checking)return;checking=true;request++;started=false;done=true;for(const timer of timers){a.time.removeEvent(timer);timer.destroy();}timers.clear();const controls=Array.from(document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('button,input,select'));controls.forEach(el=>el.disabled=true);void runAudioChecks(battle,a,position,document.getElementById('qa-results')!).finally(()=>{checking=false;controls.forEach(el=>el.disabled=false);});});
  document.getElementById('music')!.addEventListener('change',event=>battle.audio?.configure({music:(event.target as HTMLInputElement).checked}));
  document.getElementById('effects')!.addEventListener('change',event=>battle.audio?.configure({effects:(event.target as HTMLInputElement).checked}));
  document.getElementById('stop')!.addEventListener('click',()=>{request++;paused=true;battle.pause('menu');battle.audio?.pause('stop');});
  document.getElementById('pause')!.addEventListener('click',()=>{if(done||!started)return;if(paused){paused=false;battle.resume();}else{request++;paused=true;battle.pause('menu');}});
  document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;battle.setPresentation({quality});if(started)void play();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){request++;battle.audio?.pause('background');if(started&&!done){paused=true;battle.pause('background');}}});
  window.addEventListener('blur',()=>{request++;battle.audio?.pause('inputLost');if(started&&!done){paused=true;battle.pause('inputLost');}});
  window.addEventListener('resize',()=>{battle.setPresentation({quality});layout();});
  const bootControls=Array.from(document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('button,input,select'));bootControls.forEach(el=>el.disabled=false);stage.dataset.ready='true';
  battle.audio?.setLocation('silent');status.textContent='已准备好，点击播放10秒小样后开启声音。';
}
boot().catch(error=>{status.textContent='小样加载失败：'+String(error);});
