import {historicalNormalGrowthBase as normalCourtyardRunConfig} from './controlled-growth-base';
// Controlled companion comparison only. Never imported by normal main.
import {createTraitFixture} from './projectile-traits-sample';
import type {CatId} from '../../src/combat-config';
import type {GrowthRanks} from '../../src/progression';
type Preset={name:string;ranks:Partial<GrowthRanks>;description:string;cats?:CatId[]};
const presets:Record<string,Preset>={
 native:{name:'原生基线 · 0次投入',ranks:{},description:'只用原主武器与被动。墨团有原生星灵；橘团／雪团不会免费获得伙伴。'},
 fixed:{name:'固定哨卫 · 1次投入',ranks:{C12:1},description:'首次6秒部署，之后每6秒换座；存6秒，首发再等1秒，基础一座5发。180u以内自动选敌，单发7.2。走远后它留原地，不跟随。'},
 tempo:{name:'哨卫＋伙伴默契 · 2次投入',ranks:{C12:1,A16:1},description:'伙伴攻击频率＋10%；哨卫间隔1→0.909秒，一座6秒可发6次。墨团星灵1.5→1.364秒；主武器射速、装填和6秒部署周期保持。'},
 specialist:{name:'哨卫＋技能专精 · 2次投入',ranks:{C12:1,A07:1},description:'哨卫单发7.2→9，频率不变；墨团原星灵6→7.5。主武器不加伤，旧弹保留发出时的数值。'},
 strength:{name:'哨卫＋力量 · 2次投入',ranks:{C12:1,L1_DAMAGE:1},description:'哨卫单发7.2→8.64，同时强化主武器。原星灵不吃力量；与专精对照同样2次投入。'},
 spirit:{name:'仅星灵＋伙伴默契 · 1次投入',ranks:{A16:1},cats:['CAT03'],description:'仅墨团原星灵受益，间隔1.5→1.364秒、单发仍6。不赠送哨卫、不缩短鱼骨攻击或装填。'},
 defend5:{name:'定点防守 · 5次投入',ranks:{C12:1,C13:1,A13:2,A16:1},description:'哨卫＋护盾＋护甲×2＋伙伴默契。围绕火力点走位；12护甲，盾为最大HP20%，不能把固定哨卫当随行伙伴。'},
 defendHealth5:{name:'定点防守・换生命 · 5次投入',ranks:{C12:1,C13:1,A13:1,L1_HEART:1,A16:1},description:'与定点防守等投入：把一次6护甲换生命＋15。伤害、发弹不变，对照盾容量和承伤。'},
 anchor5:{name:'阵地协作 · 5次投入',ranks:{C12:1,C16:1,A07:1,A16:1,A13:1},description:'哨卫＋引力锚点＋专精＋伙伴默契＋护甲。哨卫单发9，锚点聚拢普通怪；没有盾、脉冲或移动融合。'},
 anchorStrength5:{name:'阵地协作・换力量 · 5次投入',ranks:{C12:1,C16:1,L1_DAMAGE:1,A16:1,A13:1},description:'同5次投入把专精换力量：哨卫9→8.64，主武器得到增伤，墨团星灵7.5→6。'},
 weapon5:{name:'主武器协同 · 5次投入',ranks:{C12:1,C13:1,A16:1,L1_DAMAGE:2},description:'哨卫＋护盾＋伙伴默契＋力量×2。主弹与哨卫同时提高；哨卫单发10.08，原星灵仍6。'},
 weaponSkill5:{name:'主武器协同・换专精 · 5次投入',ranks:{C12:1,C13:1,A16:1,L1_DAMAGE:1,A07:1},description:'同5次投入把一次力量换专精：哨卫10.08→10.8、星灵6→7.5；主武器少一份力量。'},
 repeat:{name:'伙伴默契×4 · 5次投入',ranks:{C12:1,A16:4},description:'展示超过三次叠加：伙伴频率＋40%。哨卫约0.714秒／发，墨团星灵约1.071秒／发；不改部署和寿命。'}
};
const w=window as any,round=(n:number)=>Number(n.toFixed(2));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,desc=document.getElementById('description')!,stats=document.getElementById('stats')!,metrics=document.getElementById('metrics')!;
 const cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,targets=document.getElementById('targets') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const f=await createTraitFixture(stage,s0=>{const s=s0 as any;stage.dataset.state=JSON.stringify(s);if(!started)return;
  const z=s.sentry,d=s.companionDiagnostics;
  document.getElementById('hud')!.textContent=`生命${round(s.hp)}/${s.maxHp} · ${s.elapsed.toFixed(1)}秒 · 盾${round(s.defense.shield)}/${round(s.defense.maxShield)}`;
  stats.textContent=`哨卫：${z.station?'在场 · 固定阵地':z.owned?'等待部署':'未持有'} · 部署${z.deployments}次 · 发射${z.emitted}枚`;
  metrics.textContent=`哨卫命中${d.sentry.hits}／实伤${round(d.sentry.actualDamage)}`+(s.catId==='CAT03'?` · 星灵命中${d.spirit.hits}／实伤${round(d.spirit.actualDamage)}`:'');
  status.textContent=s.result?'本局结束，可重开。':s.engine.paused?'已暂停；明确点击继续才恢复。':z.owned?'拖动走位，观察哨卫留在部署位置；6秒一轮，不需手动控制。':'原生武器与被动对照；切换方案后重开。';
 });
 const refresh=()=>{const selected=scheme.value;scheme.replaceChildren();for(const [id,p]of Object.entries(presets))if(!p.cats||p.cats.includes(cat.value as CatId))scheme.add(new Option(p.name,id));scheme.value=Array.from(scheme.options).some(o=>o.value===selected)?selected:'tempo';};refresh();scheme.value='tempo';cat.addEventListener('change',refresh);
 const wait=async(test:()=>boolean)=>{const until=performance.now()+8000;while(!test()){if(performance.now()>until)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{started=false;stage.dataset.ready='false';const previous=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...normalCourtyardRunConfig(f.config(cat.value as CatId)),defenseCompanions:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==previous);f.install(p.ranks);f.a.sentries.ensure(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;for(const [dx,dy]of [[-70,-90],[80,-100],[145,40],[220,20]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);e.body.moves=targets.value==='moving';}}
  desc.textContent=p.description;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.targetMode=targets.value;stage.dataset.scope='controlled-presets';started=true;f.layout();stage.dataset.state=JSON.stringify(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.companionSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});
 document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.companionFixture=f;w.companionStart=start;w.companionSampleReady=true;status.textContent='已就绪，默认哨卫＋伙伴默契；请点开始。';
 for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.companionSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
