// Independent controlled preview. Never imported by the player entry or ZIP.
import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>;description:string;cats?:CatId[]}>= {
 baseline:{name:'原生武器 · 0次投入',ranks:{},description:'先打最近的小怪；与追猎对照，观察把火力交给大怪后留下的近身压力。'},
 mark:{name:'追猎标记 · 1次投入',ranks:{C18:1},description:'每4秒标记射程内当前生命最高的敌人；主弹优先它，直接命中＋15%。离开射程改打近敌，回来后恢复优先。'},
 relay:{name:'追猎＋传承 · 2次投入',ranks:{C18:1,M26:1},description:'标记敌真正死亡后，向死亡位置120u内当前生命最高敌人传一次剩余时间，不延长窗口。'},
 pierce:{name:'追猎＋贯穿 · 2次投入',ranks:{C18:1,L1_PIERCE:1},description:'向大怪射击时沿线清小怪。小鱼干原生贯穿仍保留；15%只修正命中当前标记的那一段。'},
 ricochet:{name:'追猎＋折射 · 2次投入',ranks:{C18:1,L1_RICOCHET:1},description:'主武器盯大怪，折射继续寻找近邻。折射基数不会带走旧目标的15%加成。'},
 critical:{name:'追猎＋暴击 · 3次投入',ranks:{C18:1,A11:1,A12:1},description:'15%暴击率、2.5倍暴击；标记的直接增伤另计。观察大怪伤害尖峰与身边小怪的取舍。'},
 focus:{name:'追猎＋集束 · 2次投入',ranks:{C18:1,M06:1},cats:['CAT03'],description:'鱼骨原生5颗散角36°收至9°，更集中打大怪，但横向覆盖变窄；星灵不独立获得标记增伤。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const f=await createTraitFixture(stage,s=>{
  if(!started)return;stage.dataset.state=JSON.stringify(s);
  const h=s.huntingMark;
  hud.textContent=`生命 ${Math.ceil(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 弹匣 ${s.ammo} · 标记 ${h.targetId===null?'无':'#'+h.targetId} ${h.enabled?h.remainingSeconds.toFixed(1)+'秒':''}`;
  status.textContent=`${s.result?'本局结束，可重开':s.engine.paused?'已暂停，请点继续':'按住战场任意位置拖动走位'}；增伤命中 ${h.boostedHits}，传承 ${h.transfers}次。`;
 });
 const refresh=()=>{const old=scheme.value;scheme.replaceChildren();for(const [id,p]of Object.entries(presets))if(!p.cats||p.cats.includes(cat.value as CatId))scheme.add(new Option(p.name,id));scheme.value=Array.from(scheme.options).some(o=>o.value===old)?old:'mark';};
 refresh();scheme.value='mark';cat.addEventListener('change',refresh);
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}};
 const start=async()=>{if(busy)return;busy=true;try{
  const old=f.session,p=presets[scheme.value];started=false;f.battle.setPresentation({quality});f.battle.start({...f.config(cat.value as CatId),huntTargeting:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(p.ranks);
  // Only the disclosed opening and reward flow are controlled. The selected
  // cats, weapon stats, real native time, AI speeds and incoming damage remain.
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin={x:f.a.cat.body.center.x,y:f.a.cat.body.center.y};
  const targets=[{dx:22,dy:54,hp:48},{dx:65,dy:-102,hp:180},{dx:132,dy:-110,hp:120},{dx:-85,dy:105,hp:72},{dx:-120,dy:-85,hp:96}];
  const ids:number[]=[];for(const t of targets){const e=f.a.placeSliceEnemy('E01',origin.x+t.dx,origin.y+t.dy);if(e){e.setData('hp',t.hp);ids.push(e.getData('id'));}}
  stage.dataset.targets=JSON.stringify(ids);stage.dataset.preset=scheme.value;stage.dataset.cat=cat.value;description.textContent=p.description;started=true;f.layout();
 }catch(error){status.textContent='启动失败：'+String(error);w.huntStartError=String(error);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>{void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用');});
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.huntFixture=f;w.huntStart=start;w.huntReady=true;description.textContent=presets.mark.description;status.textContent='推荐先比较「原生武器」与「追猎标记」，再试传承；每次重开恢复同一开场。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(error=>{w.huntBootError=String(error);document.getElementById('status')!.textContent='加载失败：'+String(error);});
