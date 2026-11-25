// Explicitly controlled comparison. Not part of the normal main or a ZIP.
import {createTraitFixture} from './projectile-traits-sample';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
type Preset={name:string;ranks:(cat:CatId)=>Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 baseline:{name:'原生武器 · 0次投入',ranks:()=>({}),description:'不带本批卡片。先观察原生弹数、逐敌衰减和自动装填，再与热启动比较。'},
 heat:{name:'仅热启动 · 1次投入',ranks:()=>({M12:1}),description:'真实装填完成后，前两次齐射建立的后续等待缩短25%。首轮仍按原节奏打完整弹匣，装填不缩短。'},
 returning:{name:'贯穿＋普通返航 · 2次投入',ranks:()=>({L1_PIERCE:1,M05:1}),description:'同一弹丸回发射原点，只能伤害一个去程未打过的新目标。原来沿线打过的靶不再受伤。'},
 mirror:{name:'贯穿＋镜面返航 · 3次投入',ranks:()=>({L1_PIERCE:1,M05:1,E23:1}),description:'回程可以再打去程旧敌，每程最多一次。回程额度等于出发时1＋额外穿透，末段本体×70%起算，再逐敌衰减。'},
 line5:{name:'往返长线 · 5次投入',ranks:()=>({L1_PIERCE:1,M05:1,M09:1,E23:1,A15:1}),description:'贯穿＋返航＋逐敌增压＋镜面＋一级弹速。穿透后保留85%伤害，返程更快；走位拉线，射程不额外增加。'},
 hunt5:{name:'追猎集束 · 5次投入',ranks:cat=>cat==='CAT03'?{C18:1,M06:1,A11:1,A12:1,M12:1}:{C18:1,L1_SPLIT:1,M06:1,A11:1,M12:1},description:'集中主弹打高生命目标，代价是覆盖缩窄。铃铛／小鱼干先投入多重才能集束；鱼骨原生5颗，省下这次投入改选暴击倍率。'},
 reload5:{name:'装填爆发 · 5次投入',ranks:()=>({L1_ECHO:1,L1_RELOAD:1,L1_RATE:1,L1_EVO_CADENCE:1,M12:1}),description:'尾弹＋一级装填＋一级射速＋连奏风暴＋热启动。连奏在装填后的前三次齐射追加副弹，替换橘团原生装填首发副弹；弹匣容量保持。'}
};
const w=window as any;
async function boot(){
 const stage=document.getElementById('stage')!,hud=document.getElementById('hud')!,status=document.getElementById('status')!,description=document.getElementById('description')!,ranksText=document.getElementById('ranks')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const f=await createTraitFixture(stage,s=>{if(!started)return;stage.dataset.state=JSON.stringify(s);
  hud.textContent=`生命 ${Math.ceil(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 弹药 ${s.ammo}/${s.ammoCapacity} · ${s.reloadLeft>0?'装填 '+s.reloadLeft.toFixed(1)+'秒':'热启动余 '+s.hotStartRemaining+'次'}`;
  status.textContent=`${s.result?'本局结束，可重开':s.engine.paused?'已暂停，请点继续':'按住战场拖动走位，或用WASD'}；返航 ${s.projectileFlight.returns}次、回程命中 ${s.projectileFlight.returnHits}次。`;
 });
 for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='mirror';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{
  const old=f.session,p=presets[scheme.value],ranks=p.ranks(cat.value as CatId);started=false;f.battle.setPresentation({quality});f.battle.start({...f.config(cat.value as CatId),projectileFlight:{enabled:true},huntTargeting:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(ranks);f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;for(const [dx,dy]of [[40,0],[90,0],[140,0],[-100,85],[-100,-85]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',5000);e.body.moves=false;}}
  description.textContent=p.description;const c=f.session!.effectiveConfig;
  ranksText.textContent=`${Object.values(ranks).reduce((sum,n)=>sum+(n??0),0)}次预置投入 · 主弹${c.weapon.pellets}颗 · 间隔${Number(c.weapon.intervalSeconds.toFixed(3))}秒 · ${ranks.M12?'热启动后续'+Number((c.weapon.intervalSeconds*.75).toFixed(3))+'秒':'未取得热启动'} · 装填${Number(c.weapon.reloadSeconds.toFixed(3))}秒`;
  stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;started=true;f.layout();
 }catch(error){w.returnUpgradesStartError=String(error);status.textContent='启动失败：'+String(error);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('quality')!.addEventListener('change',event=>{quality=(event.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.returnUpgradesFixture=f;w.returnUpgradesStart=start;w.returnUpgradesReady=true;
 description.textContent='建议先对比普通返航和镜面返航，再试热启动。切猫或方案后点“开始／重开”。';ranksText.textContent='静止靶对照；实际武器、被动、自动射击和装填节奏保持。';status.textContent='热启动要等一次真实装填后观察：铃铛首轮约需11秒，小鱼干／鱼骨更早。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(error=>{w.returnUpgradesBootError=String(error);document.getElementById('status')!.textContent='加载失败：'+String(error);});
