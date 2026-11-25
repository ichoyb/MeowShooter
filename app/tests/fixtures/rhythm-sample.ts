// Explicit local review fixture. Never imported by the normal main entry.
import {createTraitFixture} from './projectile-traits-sample';
import type {BattleSnapshot} from '../../src/battle';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';

type Preset={name:string;ranks:Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 baseline:{name:'基础武器 · 0次投入',ranks:{},description:'基础暴击5%／1.5倍，不带节拍，供对照。'},
 double:{name:'节拍双击 · 1次投入',ranks:{C23:1},description:'每4次实际齐射，0.18秒后沿原方向追加1枚60%副弹。'},
 stagger:{name:'双击＋错峰 · 2次投入',ranks:{C23:1,M31:1},description:'追加延至0.50秒，到时重新选最近敌人；没有目标就跳过。'},
 triplet:{name:'多重＋节律弹幕 · 3次投入',ranks:{C23:1,L1_SPLIT:1,E21:1},description:'第四拍追加3枚30%副弹，按−12°／0°／＋12°依次扫出，替换单发。'},
 staggerTriplet:{name:'节律弹幕＋错峰 · 4次投入',ranks:{C23:1,L1_SPLIT:1,E21:1,M31:1},description:'0.50秒时重选目标，再以0.06秒间隔完成三段；移动中从当时位置发射。'},
 tail:{name:'尾弹＋轻装＋双击 · 3次投入',ranks:{L1_ECHO:1,L1_LIGHT_MAG:1,C23:1},description:'尾弹跟弹匣，节拍跟4次齐射，两种节奏分别计算。'},
 mixed:{name:'暴击＋集束＋节律 · 9次投入',ranks:{C23:1,L1_SPLIT:1,E21:1,M31:1,M06:1,A11:2,A12:2},description:'主弹25%／3.5倍暴击与集束；节律副弹不暴击，也不被集束收窄。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,current:Preset=presets.double,quality:'standard'|'low'='standard';
 const fixture=await createTraitFixture(stage,(s:BattleSnapshot)=>{
  if(!started)return;
  stage.dataset.state=JSON.stringify(s);
  const r=s.rhythm;
  hud.textContent=`生命 ${Math.ceil(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 弹匣 ${s.ammo} · 节拍 ${r.counter}/4`;
  const state=s.result?'本局结束，可重开':s.engine.paused?'已暂停，请点继续':'可在庭院拖动走位';
  status.textContent=`${state}。节拍触发${r.triggers}次，已发${r.emitted}枚，待发${r.pending}；${current.name}。`;
 });
 const {battle}=fixture;
 for(const [key,p]of Object.entries(presets))scheme.add(new Option(p.name,key));
 scheme.value='double';
 const wait=async(predicate:()=>boolean)=>{const end=performance.now()+8000;while(!predicate()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{
  if(busy)return;busy=true;
  try{
   const p=presets[scheme.value],previous=fixture.session;started=false;
   battle.setPresentation({quality});battle.start(fixture.config(cat.value as CatId,true));
   await wait(()=>!!fixture.session&&fixture.session!==previous);
   fixture.install(p.ranks);
   // Preselected review only; no fake rewards, invincibility or clock changes.
   fixture.a.growth.collect=()=>{};fixture.a.growth.queueElite=()=>false;
   current=p;description.textContent=p.description;started=true;fixture.layout();stage.dataset.preset=scheme.value;stage.dataset.cat=cat.value;
  }catch(error){status.textContent='启动失败：'+String(error);}finally{busy=false;}
 };
 document.getElementById('start')!.addEventListener('click',()=>void start());
 document.getElementById('pause')!.addEventListener('click',()=>battle.pause('menu'));
 document.getElementById('resume')!.addEventListener('click',()=>battle.resume());
 document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;battle.setPresentation({quality});fixture.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>{void battle.audio?.enable().then(()=>{const audio=battle.audio!.snapshot();document.getElementById('sound')!.textContent=audio.ready?'声音已开':'声音不可用';if(audio.error)status.textContent=audio.error;});});
 window.addEventListener('resize',fixture.layout);window.addEventListener('blur',()=>{if(started)battle.pause('inputLost');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)battle.pause('background');});
 w.rhythmFixture=fixture;w.rhythmStart=start;w.rhythmReady=true;
 description.textContent=presets.double.description;status.textContent='选择方案后点开始／重开；建议先看双击，再对比错峰与节律弹幕。';
 for(const control of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))control.disabled=false;
}
void boot().catch(error=>{w.rhythmBootError=String(error);document.getElementById('status')!.textContent='加载失败：'+String(error);});
