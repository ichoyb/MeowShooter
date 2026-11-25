// Preset comparison only; the production main never imports this entry.
import {createTraitFixture} from './projectile-traits-sample';
import {abilityDamage} from '../../src/bell-ability-rules';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
type Preset={name:string;ranks:Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 anchor:{name:'仅引力锚点 · 1次投入',ranks:{C16:1},description:'取得后等5秒，240u内最近敌人的当前位置生成固定锚点，持续2秒。60u内最多牵引8只普通怪；结束时爆炸4.8伤害。'},
 separate:{name:'锚点＋脉冲 · 2次投入',ranks:{C15:1,C16:1},description:'未融合：脉冲始终在脚下，每3秒一次；锚点每5秒尝试放置，结束爆炸独立。先看脚下保护与远端聚怪。'},
 fused:{name:'脉冲引爆 · 3次投入',ranks:{C15:1,C16:1,E16:1},description:'已融合：有效锚点存在时，定时脉冲移至锚点；否则仍在脚下。没有双发、不赠送攻击，不重置3秒／5秒周期。'},
 remote5:{name:'远端聚怪 · 5次投入',ranks:{C15:1,C16:1,E16:1,A07:1,A08:1},description:'融合＋技能专精＋广域共振：脉冲10.5伤害、50.4u；锚点结束6伤害、63u。各武器都用同一技能基数。'},
 remoteStrength5:{name:'远端聚怪＋力量 · 5次投入',ranks:{C15:1,C16:1,E16:1,L1_DAMAGE:1,A08:1},description:'等投入替换一次专精为力量：脉冲10.08、锚点5.76，同时提高主武器伤害。原生星灵不新增力量收益。'},
 close5:{name:'近身持续 · 5次投入',ranks:{L1_ORBIT_BELL:1,C15:1,A07:2,A08:1},description:'环铃＋脉冲＋两次专精＋一次范围：脉冲12.6、环铃13.5伤害，保留脚下覆盖；没有锚点或聚怪。'},
 recycle5:{name:'走位回收 · 5次投入',ranks:{L1_TRAIL_BELL:1,L1_PICKUP_CHIME:1,A07:1,A10:2},description:'地铃＋拾光＋一次专精＋两次拾取：地铃13.5、拾光11.25伤害、吸附48u。移动才留铃，实际拾取8经验才蓄满。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!,stats=document.getElementById('stats')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,mode=document.getElementById('mode') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard',dropId=300000;
 const f=await createTraitFixture(stage,s=>{if(!started)return;stage.dataset.state=JSON.stringify(s);const a=(s as any).areaAbilities,anchor=a?.anchor;
  hud.textContent=`${Math.ceil(s.hp)}/${s.maxHp}生命 · ${s.elapsed.toFixed(1)}秒 · 弹药${s.ammo}/${s.ammoCapacity}`;
  status.textContent=`${s.result?'本局结束，可重开':s.engine.paused?'已暂停，请点继续':'拖动／WASD走位'} · ${a?.owned?'脉冲'+a.casts+'次':'未持有脉冲'} · ${anchor?'锚点在场':a?.anchorOwned?'锚点等待中':'未持有锚点'}`;
 });
 for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='fused';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{
  const previous=f.session,p=presets[scheme.value];started=false;f.battle.setPresentation({quality});f.battle.start({...f.config(cat.value as CatId),projectileFlight:{enabled:true},huntTargeting:{enabled:true},areaAbilities:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==previous);f.install(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;
  const formation=mode.value==='fixed'?[[100,0],[120,0],[110,25],[120,-25],[140,30],[150,-20],[-120,60],[-140,-40]]:[[140,0],[170,0],[150,35],[160,-35],[190,30],[200,-20],[-160,60],[-180,-40]];
  for(const [dx,dy]of formation){
   const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);if(mode.value==='fixed')e.body.moves=false;}
  }
  const r={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...p.ranks},d=abilityDamage(f.session!.runConfig,r),q=1+.05*(r.A08??0);
  description.textContent=p.description;stats.textContent=`${Object.values(p.ranks).reduce((sum,n)=>sum+(n??0),0)}次预置 · ${r.C15?'脉冲'+Number((.7*d).toFixed(3))+'／'+Number((48*q).toFixed(2))+'u':'未持有脉冲'} · ${r.C16?'锚点'+Number((.4*d).toFixed(3))+'／'+Number((60*q).toFixed(2))+'u':'未持有锚点'}`;
  stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.mode=mode.value;started=true;f.layout();stage.dataset.state=JSON.stringify(f.battle.snapshot());
 }catch(e){w.anchorSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('xp')!.addEventListener('click',()=>{if(started&&!f.battle.snapshot().engine.paused){const p=f.a.cat.body.center;for(let n=0;n<4;n++)f.a.pickups.drop(++dropId,'E01',{x:p.x+15+n*2,y:p.y});}});
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.anchorFixture=f;w.anchorStart=start;w.anchorReady=true;description.textContent='先用固定靶看第6秒远端脉冲，再切换走位群怪观察聚拢。切角色、方案或靶场后点重开。';stats.textContent='三种武器分别体验相同投入；受控预置不计作自然成长或平衡验收。';status.textContent='已就绪，请点开始。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.anchorSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
