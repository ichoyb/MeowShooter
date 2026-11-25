// Independent preset review page. Never imported by the normal game entry.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMY_BUBBLE} from '../../src/level-config';
import type {GrowthRanks} from '../../src/progression';
import type {CatId} from '../../src/combat-config';
type Preset={name:string;ranks:Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 baseline:{name:'无防御 · 0次投入',ranks:{},description:'真实敌弹10伤直接扣生命，作为对照。没有护甲或护盾。'},
 armor:{name:'坚实皮毛 · 1次投入',ranks:{A13:1},description:'6护甲，10伤→9.434伤。没有最低1点伤害限制，不设统一三次上限。早期收益比生命＋15保守，先观察长期承伤差别。'},
 shield:{name:'能量护盾 · 1次投入',ranks:{C13:1},description:'护盾为最大生命20%，先吸收再扣生命。最后一次有效受伤后等6秒，再每秒回复护盾上限10%；盾吸收也会重置等待。'},
 mixed:{name:'护盾＋护甲×2 · 3次投入',ranks:{C13:1,A13:2},description:'12护甲先减伤，再由护盾吸收。与相同3次投入的护盾＋生命×2对照；不会提高主武器伤害或移动速度。'},
 health:{name:'护盾＋生命×2 · 3次投入',ranks:{C13:1,L1_HEART:2},description:'最大生命＋30，取得护盾时填满新的20%上限。与护甲方案等投入；局中点“生命＋15”只扩大盾上限，不补当前盾。'},
 repeat:{name:'护盾＋护甲×4 · 5次投入',ranks:{C13:1,A13:4},description:'24护甲，约19.35%减伤；展示护甲可超过三次叠加。盾被打空后仍需等6秒，不会因破盾立刻恢复。'}
};
const w=window as any,round=(n:number)=>Number(n.toFixed(2));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,description=document.getElementById('description')!,stats=document.getElementById('stats')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard',ranks:any={},lastAbsorbed=0;
 const draw=(s:any)=>{
  stage.dataset.state=JSON.stringify(s);if(!started)return;
  const d=s.defense,cap=d?.maxShield??0;
  document.getElementById('health')!.textContent=`生命 ${round(s.hp)} / ${s.maxHp}`;
  document.getElementById('shield')!.textContent=`护盾 ${round(d?.shield??0)} / ${round(cap)}`;
  document.getElementById('health-fill')!.style.width=(s.hp/s.maxHp*100)+'%';
  document.getElementById('shield-fill')!.style.width=(cap?(d.shield/cap*100):0)+'%';
  stats.textContent=`${d.armor}护甲 · 减伤${round((1-d.multiplier)*100)}% · 已吸收${round(d.absorbedTotal)} · 生命实损${round(d.hpLostTotal)}`;
  const paused=s.engine.paused;
  status.textContent=s.result?'本局结束，请重开。':paused?'已暂停；点击“继续”才恢复。':!cap?'拖动走位，点击“10伤泡泡”做受击对照。':d.shield>=cap-.001?'护盾已满；试试连续受击，再走开等待恢复。':d.rechargeWait>0?`回盾等待 ${d.rechargeWait.toFixed(1)}秒；再次受伤会重新计时。`:`正在回盾，每秒${round(cap*.1)}；生命不会随盾恢复。`;
  for(const id of ['bubble','heart','heal']) (document.getElementById(id) as HTMLButtonElement).disabled=paused||!!s.result;
  if(d.absorbedTotal!==lastAbsorbed){lastAbsorbed=d.absorbedTotal;const h=d.lastHit;document.getElementById('last-hit')!.textContent=h?`最近受击：原伤${round(h.rawDamage)} → 减伤后${round(h.afterArmor)}，盾吸收${round(h.shieldAbsorbed)}，生命损失${round(h.hpLost)}`:'';}
 };
 const f=await createTraitFixture(stage,draw);
 for(const [key,p]of Object.entries(presets))scheme.add(new Option(p.name,key));scheme.value='shield';
 const wait=async(test:()=>boolean)=>{const until=performance.now()+8000;while(!test()){if(performance.now()>until)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{
  started=false;stage.dataset.ready='false';const previous=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...f.config(cat.value as CatId),areaAbilities:{enabled:true},defenseCompanions:{enabled:true}} as any);
  await wait(()=>!!f.session&&f.session!==previous);ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...p.ranks};f.install(ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;
  for(const [dx,dy]of [[-65,-90],[65,-110],[110,40]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);e.body.moves=false;}}
  lastAbsorbed=0;document.getElementById('last-hit')!.textContent='';description.textContent=p.description;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.scope='controlled-presets';started=true;f.layout();draw(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.defenseSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());
 document.getElementById('bubble')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused)return;const p=f.a.cat.body.center;f.a.enemyBubble({x:p.x,y:p.y-65},{x:0,y:1},ENEMY_BUBBLE);});
 document.getElementById('heart')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused)return;ranks={...ranks,L1_HEART:ranks.L1_HEART+1};f.install(ranks);draw(f.battle.snapshot());});
 document.getElementById('heal')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused)return;f.session!.applyGrowthReward(ranks,.2);draw(f.battle.snapshot());});
 document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));
 document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.defenseFixture=f;w.defenseStart=start;w.defenseSampleReady=true;status.textContent='已就绪；默认护盾方案，点开始观察。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.defenseSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
