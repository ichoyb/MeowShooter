// Development-only direct encounter. Never imported by the game entry or packaged.
import {createBattle,type BattleController,type BattleSnapshot} from '../../src/battle';
import {makeRunConfig} from '../../src/combat-config';
declare function require(path:string):any;
const w=window as any,$=(id:string)=>document.getElementById(id)!,stage=$('stage');
let battle:BattleController,arena:any,busy=false,last:BattleSnapshot|null=null;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('图片加载失败'));i.src=src;});
function status(s:BattleSnapshot){
 last=s;$('hp').textContent=Math.ceil(s.hp)+' / '+s.maxHp;$('boss-hp').textContent=s.boss?Math.ceil(s.boss.hp)+' / '+s.boss.maxHp:'—';
 const labels:Record<string,string>={arriving:'重甲雾核入场',chase:'重甲追逐',warning:'冲锋蓄力',dash:'冲锋',recover:'回稳', 'slam-warning':'抬掌蓄力'};
 $('phase').textContent=s.result==='cleared'?'守护成功':s.result==='death'?'本次倒下了':s.result==='timeout'?'时间结束':s.reasons.length?'已暂停':labels[s.boss?.phase||'']||'准备好后开始';
 $('pause').textContent=s.reasons.length?'继续':'暂停';$('pause').toggleAttribute('disabled',!s.boss||!!s.result);
 $('stage').dataset.snapshot=JSON.stringify(s);if(battle?.audio)$('stage').dataset.audio=JSON.stringify(battle.audio.snapshot());
}
function layout(){if(!battle)return;const h=360*stage.clientHeight/stage.clientWidth;battle.setBounds({top:0,bottom:h});battle.setInputArea({left:0,right:360,top:0,bottom:h},battle.cssPixelsPerLogicalUnit,[]);}
async function begin(){
 if(busy)return;busy=true;($('play') as HTMLButtonElement).disabled=true;
 try{
  battle.start(makeRunConfig('CAT01','W01','p2-basic'));arena.spawns.take=()=>null;
  // Isolate the approved encounter without changing production director rules or time.
  arena.level.pending=()=>arena.level.bossAt===null?'B01':null;
  if(battle.audio)await battle.audio.enable();
  if(!battle.snapshot().reasons.length)arena.enterSpecial('B01',{x:430,y:650});
  $('hint').textContent='拖动走位／WASD，自动攻击与装填。';layout();
 }catch(e){$('hint').textContent=e instanceof Error?e.message:String(e);}
 finally{busy=false;($('play') as HTMLButtonElement).disabled=false;}
}
async function boot(){
 const cats=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('assets/ui/'+id+'.png')));
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),original=factory.prototype.graphics;
 factory.prototype.graphics=function(...args:any[]){arena=this.scene;return original.apply(this,args);};
 try{battle=await createBattle(stage,{onState:status,onInterrupt:r=>battle?.pause(r),onFinish:status,onResize:layout},{CAT01:cats[0],CAT02:cats[1],CAT03:cats[2]});}
 finally{factory.prototype.graphics=original;}
 $('play').onclick=()=>void begin();$('pause').onclick=()=>{if(last?.reasons.length)battle.resume();else battle.pause('menu');};
 $('quality').onchange=e=>battle.setPresentation({quality:(e.target as HTMLSelectElement).value as 'standard'|'low'});
 $('music').onchange=e=>battle.audio?.configure({music:(e.target as HTMLInputElement).checked});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)battle.pause('background');});window.addEventListener('blur',()=>battle.pause('inputLost'));
 window.addEventListener('pagehide',()=>battle.dispose());window.addEventListener('resize',layout);
 w.bossPreview={battle,arena,begin};$('hint').textContent='开发小样：点击开始进入Boss战，省略前半关。';layout();($('play') as HTMLButtonElement).disabled=false;
}
boot().catch(e=>{$('hint').textContent=String(e);});
