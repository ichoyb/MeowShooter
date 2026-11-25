// Deliberately separate from the normal main entry. Presets are disclosed.
import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>;description:string}>={
 baseline:{name:'原生武器 · 0次投入',ranks:{},description:'不带本批能力，保留原生弹数、贯穿、被动及5%基础暴击。'},
 speed:{name:'飞行加速×3 · 3次投入',ranks:{A15:3},description:'弹速＋30%，最大直线距离保持；对照远处及移动目标的命中。'},
 returning:{name:'仅返航 · 1次投入',ranks:{M05:1},description:'打完去程返回发射原点，只能命中一个全程新目标，不会再打旧目标。'},
 pierce:{name:'仅贯穿 · 1次投入',ranks:{L1_PIERCE:1},description:'在原生额度上多穿过一个目标，逐目标伤害保留70%。'},
 line:{name:'贯穿＋返航 · 2次投入',ranks:{L1_PIERCE:1,M05:1},description:'走位拉出长线，穿出后回扫新怪；回程不跟随猫咪当前所在位置。'},
 pressure:{name:'贯穿＋返航＋增压 · 3次投入',ranks:{L1_PIERCE:1,M05:1,M09:1},description:'后续贯穿伤害保留85%；与上一方案对照清理排队怪物。'},
 fast:{name:'三项混搭 · 4次投入',ranks:{L1_PIERCE:1,M05:1,M09:1,A15:1},description:'增加一级弹速；三种武器仍保留各自的弹数、弹匣、装填和原生被动。'},
 bounce:{name:'贯穿＋折射＋返航 · 3次投入',ranks:{L1_PIERCE:1,L1_RICOCHET:1,M05:1},description:'去程额度用尽后先折射一次，折射结束再返航；沿用同颗弹丸与命中记录。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,current=presets.pressure,quality:'standard'|'low'='standard';
 const f=await createTraitFixture(stage,s=>{
  if(!started)return;stage.dataset.state=JSON.stringify(s);
  hud.textContent=`生命 ${Math.ceil(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 弹匣 ${s.ammo} · 弹速 ${Math.round(s.weaponStats.bulletSpeed)}u/s`;
  const note=s.result?'本局结束，可重开':s.engine.paused?'已暂停，请点继续':'按住战场拖动走位';
  status.textContent=`${note}；已返航${s.projectileFlight.returns}次，回程命中${s.projectileFlight.returnHits}次。`;
 });
 for(const [key,p]of Object.entries(presets))scheme.add(new Option(p.name,key));scheme.value='pressure';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}};
 const start=async()=>{if(busy)return;busy=true;try{
  const old=f.session,p=presets[scheme.value];started=false;f.battle.setPresentation({quality});f.battle.start({...f.config(cat.value as CatId),projectileFlight:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(p.ranks);f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  current=p;description.textContent=p.description;started=true;f.layout();stage.dataset.preset=scheme.value;stage.dataset.cat=cat.value;
 }catch(error){status.textContent='启动失败：'+String(error);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>{void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用');});
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.flightFixture=f;w.flightStart=start;w.flightReady=true;description.textContent=current.description;status.textContent='选择猫咪与方案后点开始；推荐先对比贯穿＋返航，再加逐敌增压。';
 for(const control of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))control.disabled=false;
}
void boot().catch(error=>{w.flightBootError=String(error);document.getElementById('status')!.textContent='加载失败：'+String(error);});
