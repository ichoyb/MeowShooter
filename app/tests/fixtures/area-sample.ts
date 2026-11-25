// Controlled local comparison only; never imported by normal main.
import {createTraitFixture} from './projectile-traits-sample';
import {abilityDamage} from '../../src/bell-ability-rules';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
type Preset={name:string;ranks:Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 pulse:{name:'脉冲领域 · 1次投入',ranks:{C15:1},description:'首次等待3秒，然后每3秒释放近身脉冲。基础48u，每敌8.4伤害，最近最多8个目标。装填时照常运行。'},
 skill:{name:'脉冲＋技能专精 · 2次投入',ranks:{C15:1,A07:1},description:'脉冲8.4→10.5伤害，主武器伤害保持。技能专精每次＋25%独立技能伤害，可反复选择。'},
 strength:{name:'脉冲＋力量增幅 · 2次投入',ranks:{C15:1,L1_DAMAGE:1},description:'相同投入对比：力量让脉冲8.4→10.08，同时提高主武器伤害；专精第一次技能增伤更高。'},
 wide:{name:'脉冲＋广域共振×2 · 3次投入',ranks:{C15:1,A08:2},description:'脉冲48→52.8u，伤害仍8.4；提高覆盖，不增加目标上限或攻击频率。'},
 orbit:{name:'环铃＋脉冲 · 2次投入',ranks:{L1_ORBIT_BELL:1,C15:1},description:'对照原始环铃60u轨道、16u铃体、8u接触范围。两种技能都使用独立基础伤害。'},
 close5:{name:'近身持续 · 5次投入',ranks:{L1_ORBIT_BELL:1,C15:1,A07:2,A08:1},description:'环铃＋脉冲＋两次专精＋一次范围：脉冲12.6伤害、50.4u；环铃13.5伤害、63u轨道。'},
 pickup:{name:'灵敏拾取×2 · 2次投入',ranks:{A10:2},description:'吸附起点40→48u，领取仍8u。点击“补充经验”可在身边40／44／48／56u放置各2点经验，对比吸附；未进入范围的经验继续留在原地。'},
 pickupBase:{name:'拾取基线 · 0次投入',ranks:{},description:'40u开始吸附，8u领取，经验不增发。与两次灵敏拾取对照，观察44／48u的经验是否开始追随。'},
 recycle5:{name:'走位回收 · 5次投入',ranks:{L1_TRAIL_BELL:1,L1_PICKUP_CHIME:1,A07:1,A10:2},description:'猫步留铃＋拾光＋一次专精＋两次拾取。地铃每敌13.5、拾光11.25伤害，吸附48u；移动180u才放地铃，实际拾取8经验才蓄满。'},
 repeat:{name:'反复叠加 · 13次投入',ranks:{C15:1,A07:4,A08:4,A10:4},description:'展示属性超过三次：专精×4、范围×4、拾取×4，脉冲16.8伤害、57.6u，吸附56u。未设置统一三次封顶。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!,stats=document.getElementById('stats')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard',dropId=100000;
 const f=await createTraitFixture(stage,s=>{if(!started)return;stage.dataset.state=JSON.stringify(s);const area=(s as any).areaAbilities;
  hud.textContent=`${Math.ceil(s.hp)}/${s.maxHp}生命 · ${s.elapsed.toFixed(1)}秒 · 弹药${s.ammo}/${s.ammoCapacity}`;
  status.textContent=`${s.result?'本局结束，可重开':s.engine.paused?'已暂停，请明确继续':'按住战场拖动／WASD移动'} · 脉冲${area?.casts??0}次 · 已拾取${s.pickups?.collectedXP??0}经验`;
 });
 for(const [id,p] of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='pulse';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const addXP=()=>{if(!started||f.battle.snapshot().engine.paused)return;const p=f.a.cat.body.center;for(const [dx,dy] of [[40,0],[0,44],[-48,0],[0,-56]])f.a.pickups.drop(++dropId,'E01',{x:p.x+dx,y:p.y+dy});};
 const start=async()=>{if(busy)return;busy=true;try{
  const previous=f.session,p=presets[scheme.value];started=false;f.battle.setPresentation({quality});
  f.battle.start({...f.config(cat.value as CatId),projectileFlight:{enabled:true},huntTargeting:{enabled:true},areaAbilities:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==previous);f.install(p.ranks);f.a.areas?.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;
  if(!scheme.value.startsWith('pickup'))for(const [dx,dy]of [[35,-15],[45,15],[70,-20],[100,0],[140,0],[-40,30],[-65,-25]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);e.body.moves=false;}}
  const r={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...p.ranks},d=abilityDamage(f.session!.runConfig,r),q=1+.05*(r.A08??0);
  description.textContent=p.description;stats.textContent=`${Object.values(p.ranks).reduce((sum,n)=>sum+(n??0),0)}次预置投入 · 技能基数${Number(d.toFixed(3))} · ${r.C15?`脉冲${Number((.7*d).toFixed(3))}／${Number((48*q).toFixed(2))}u`:'未持有脉冲'} · 吸附${40*(1+.1*(r.A10??0))}u`;
  stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;started=true;f.layout();stage.dataset.state=JSON.stringify(f.battle.snapshot());
 }catch(e){w.areaSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());document.getElementById('xp')!.addEventListener('click',addXP);
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.areaFixture=f;w.areaStart=start;w.areaReady=true;description.textContent='先点开始观察脉冲，再切换方案、猫咪并重开。';stats.textContent='独立受控预览，不计作正常掉卡或数值平衡验收。';status.textContent='已就绪；请选择方案后开始。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.areaSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
