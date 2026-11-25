// Review-only choreography around the real Arena. Never included in a ZIP.
import {createBattle, type BattleSnapshot} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
import type Phaser from 'phaser';
const stage=document.getElementById('stage')!,status=document.getElementById('status')!;
const w=window as any;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
async function boot(){
  const cats=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('./assets/ui/'+id+'.png')));
  let started=false,done=false,paused=false,quality:'standard'|'low'='standard';
  const timers=new Set<Phaser.Time.TimerEvent>();
  const battle=await createBattle(stage,{onState(s){
    stage.dataset.state=JSON.stringify(s);
    if(!started)return;
    status.textContent=`${paused?'已暂停':done?'小样结束，可重播':'受控实战小样'} · ${Math.min(10,s.elapsed).toFixed(1)} / 10秒 · 生命 ${s.hp}/${s.maxHp}`;
    document.getElementById('events')!.textContent=`真实命中 ${s.feedback?.hits??0} · 击败 ${s.feedback?.defeats??0} · 受伤 ${s.feedback?.hurts??0} · 伤害数字 ${s.feedback?.numbersTotal??0}`;
    capture(s);
    if(s.elapsed>=10&&!done){done=true;battle.pause('menu');}
  },onInterrupt(){paused=true;battle.pause('menu');},onFinish(){}},{CAT01:cats[0],CAT02:cats[1],CAT03:cats[2]});
  const a=w.qaArena as any;
  function later(ms:number,fn:()=>void){const t=a.time.delayedCall(ms,()=>{timers.delete(t);fn();});timers.add(t);}
  const captured=new Set<string>();
  function capture(s:BattleSnapshot){
    for(const [name,count] of [['hit',s.feedback?.hits],['defeat',s.feedback?.defeats],['hurt',s.feedback?.hurts]] as const){
      if(!count||captured.has(name))continue;captured.add(name);
      later(45,()=>{try{const picture=document.getElementById('frame-'+name) as HTMLImageElement;picture.src=a.game.canvas.toDataURL('image/png');picture.dataset.actualFrame='true';}catch{document.getElementById('capture-note')!.textContent='当前环境不支持相位截帧，请直接播放小样。';}});
    }
  }
  function layout(){const height=360*stage.clientHeight/stage.clientWidth;battle.setBounds({top:18,bottom:height-20});battle.setInputArea({left:0,right:360,top:18,bottom:height-20},stage.clientWidth/360,[]);}
  function target(x:number,y:number){const enemy=a.place(a.enemies,x,.3,'enemy');if(enemy){w.qaPosition(enemy,x,y);enemy.body.moves=false;}return enemy;}
  function play(){
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
  document.getElementById('pause')!.addEventListener('click',()=>{if(done)return;if(paused){paused=false;battle.resume();}else{paused=true;battle.pause('menu');}});
  document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;play();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!done){paused=true;battle.pause('background');}});
  window.addEventListener('resize',()=>{battle.setPresentation({quality});layout();});
  play();
}
boot().catch(error=>{status.textContent='小样加载失败：'+String(error);});
