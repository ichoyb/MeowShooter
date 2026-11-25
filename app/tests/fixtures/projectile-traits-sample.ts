// Local controlled review entry. The normal main never imports this module.
import {createBattle,type BattleSnapshot} from '../../src/battle';
import {makeRunConfig,type CatId} from '../../src/combat-config';
import {Session} from '../../src/rules';
import type {GrowthRanks} from '../../src/progression';
declare function require(path:string):any;
const w=window as any;
const image=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
export async function createTraitFixture(stage:HTMLElement,onState:(s:BattleSnapshot)=>void=()=>{},enableG6=false){
 const images:any={};for(const id of ['CAT01','CAT02','CAT03'])images[id]=await image('./assets/ui/'+id+'.png');
 const factory=require('phaser/src/gameobjects/GameObjectFactory'),graphics=factory.prototype.graphics;let arena:any,session:Session|undefined;
 factory.prototype.graphics=function(...args:any[]){arena=this.scene;return graphics.apply(this,args);};
 let battle:Awaited<ReturnType<typeof createBattle>>;
 try{battle=await createBattle(stage,{onState,onInterrupt(){battle.pause('menu');},onFinish:onState},images,undefined,enableG6);}
 finally{factory.prototype.graphics=graphics;}
 const advance=Session.prototype.advance;
 Session.prototype.advance=function(dt:number){session=this;return advance.call(this,dt);};
 const config=(cat:CatId,enabled=true)=>Object.freeze({...makeRunConfig(cat,cat==='CAT01'?'W01':cat==='CAT02'?'W04':'W02','p2-basic'),...(enabled?{projectileTraits:Object.freeze({enabled:true as const})}:{})});
 const install=(ranks:Partial<GrowthRanks>)=>{
  if(!session)throw Error('Session has not advanced');
  const complete={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...ranks};
  arena.growth.ranks=complete;session.applyGrowth(complete);arena.syncProjectileCapacity();arena.abilities.ensure(complete,session.elapsed);
 };
 const layout=()=>{if(!stage.clientWidth)return;const height=360*stage.clientHeight/stage.clientWidth;battle.setBounds({top:18,bottom:height-18});battle.setInputArea({left:0,right:360,top:18,bottom:height-18},stage.clientWidth/360,[]);};
 layout();
 return {battle,a:arena,g:arena.game,config,install,layout,get session(){return session;}};
}

const presets:Record<string,{name:string;enabled:boolean;ranks:Partial<GrowthRanks>;cats?:CatId[]}>={
 legacy:{name:'旧基线 · 无暴击 · 0次投入',enabled:false,ranks:{}},
 critical:{name:'基础暴击 · 5% / 1.5倍 · 0次投入',enabled:true,ranks:{}},
 growth:{name:'暴击成长 · 25% / 3.5倍 · 4次投入',enabled:true,ranks:{A11:2,A12:2}},
 spread:{name:'鱼骨原生散射 · 36° · 0次投入',enabled:true,ranks:{},cats:['CAT03']},
 focus:{name:'仅M06集束 · 鱼骨9° · 1次投入',enabled:true,ranks:{M06:1},cats:['CAT03']},
 mixed:{name:'多重＋集束＋暴击 · 6次投入',enabled:true,ranks:{L1_SPLIT:1,M06:1,A11:2,A12:2}}
};
async function bootSample(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,current='准备中',quality:'standard'|'low'='standard';
 const fixture=await createTraitFixture(stage,s=>{
  if(!started)return;
  const t=s.projectileTraits;stage.dataset.state=JSON.stringify(s);
  const label=`生命 ${Math.ceil(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 弹匣 ${s.ammo} · 暴击 ${(t.criticalChance*100).toFixed(0)}% ×${t.criticalMultiplier.toFixed(1)}`;
  if(hud.textContent!==label)hud.textContent=label;
  const stopped=s.engine.paused?'已暂停，请点继续':s.result?'本局结束，可重开':'正常战斗，可在庭院拖动走位';
  const note=`${current}；${stopped}。主弹抽取${t.rolls}，暴击弹${t.criticalRolls}，暴击命中${t.criticalHits}。`;
  if(status.textContent!==note)status.textContent=note;
 });
 const {battle,a,g}=fixture;
 const refresh=()=>{
  const selected=scheme.value;scheme.replaceChildren();
  for(const [key,p] of Object.entries(presets)){if(p.cats&&!p.cats.includes(cat.value as CatId))continue;const o=new Option(p.name,key);scheme.add(o);}
  scheme.value=Array.from(scheme.options).some(o=>o.value===selected)?selected:(cat.value==='CAT03'?'spread':'critical');
 };
 cat.value='CAT03';refresh();scheme.value='spread';cat.addEventListener('change',refresh);
 const wait=async(predicate:()=>boolean)=>{const end=performance.now()+8000;while(!predicate()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{
  if(busy)return;busy=true;
  try{
   const p=presets[scheme.value],previous=fixture.session;
   started=false;battle.setPresentation({quality});battle.start(fixture.config(cat.value as CatId,p.enabled));
   await wait(()=>!!fixture.session&&fixture.session!==previous);
   fixture.install(p.ranks);
   // Preset review only: disable reward transactions in this fixture, while
   // leaving enemy damage, native time, movement and actual pickups intact.
   a.growth.collect=()=>{};a.growth.queueElite=()=>false;
   current=p.name+`；${fixture.session!.effectiveConfig.weapon.pellets}颗／齐射，总散角${fixture.session!.effectiveConfig.weapon.spreadDegrees}°`;
   started=true;fixture.layout();stage.dataset.preset=scheme.value;
  }catch(e){status.textContent=String(e);}finally{busy=false;}
 };
 document.getElementById('start')!.addEventListener('click',()=>void start());
 document.getElementById('pause')!.addEventListener('click',()=>battle.pause('menu'));
 document.getElementById('resume')!.addEventListener('click',()=>battle.resume());
 document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;battle.setPresentation({quality});fixture.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>{void battle.audio?.enable().then(()=>{const s=battle.audio!.snapshot();(document.getElementById('sound') as HTMLButtonElement).textContent=s.ready?'声音已开启':'声音不可用';if(s.error)status.textContent=s.error;});});
 window.addEventListener('resize',fixture.layout);window.addEventListener('blur',()=>{if(started)battle.pause('inputLost');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)battle.pause('background');});
 w.traitsFixture=fixture;w.traitsStart=start;w.traitsReady=true;status.textContent='准备好。先看鱼骨36°原生散射，再切换「仅M06集束」重开。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
if(location.pathname.endsWith('traits-sample.html'))void bootSample().catch(e=>{w.traitsBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
