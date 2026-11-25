import {historicalNormalGrowthBase as normalCourtyardRunConfig} from './controlled-growth-base';
// Controlled D3 preset page. Normal main never imports this entry.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMY_BUBBLE} from '../../src/level-config';
import {sentinelStats} from '../../src/sentinel-rules';
import type {CatId} from '../../src/combat-config';
import type {GrowthRanks} from '../../src/progression';
type Preset={name:string;ranks:Partial<GrowthRanks>;description:string};
const presets:Record<string,Preset>={
 native:{name:'原生基线 · 0次投入',ranks:{},description:'只有原主武器和角色被动。墨团有原生星灵，其他猫不会免费得到伙伴。'},
 before:{name:'盾＋哨卫，未融合 · 2次投入',ranks:{C12:1,C13:1},description:'盾保护玩家，哨卫仍固定在部署处，单发7.2。仅持双前置不会免费融合。'},
 mobile:{name:'移动堡垒 · 3次投入',ranks:{C12:1,C13:1,E14:1},description:'有盾时同一哨卫随行，单发5.76；破盾后落地，后续新弹恢复7.2，回盾后可再随行。第一座仍等6秒，首发再等1秒。'},
 fixed5:{name:'定点防守 · 5次投入',ranks:{C12:1,C13:1,A13:2,A16:1},description:'哨卫＋盾＋护甲×2＋伙伴默契。12护甲；固定哨卫每0.909秒7.2伤害。离开火力点不会带走它。'},
 health5:{name:'定点防守・换生命 · 5次投入',ranks:{C12:1,C13:1,A13:1,A16:1,L1_HEART:1},description:'同5次投入，将一次6护甲换成15生命，盾上限也随最大HP变化；不增加哨卫伤害或频率。'},
 mobile5:{name:'移动堡垒＋专精 · 5次投入',ranks:{C12:1,C13:1,E14:1,A07:1,A16:1},description:'哨卫＋盾＋融合＋专精＋伙伴默契。随行7.2／落地9，0.909秒一次，无额外护甲；与另两条5次投入路线比较。'},
 strength5:{name:'移动堡垒・换力量 · 5次投入',ranks:{C12:1,C13:1,E14:1,L1_DAMAGE:1,A16:1},description:'同5次投入，将专精换力量：随行6.912／落地8.64，主武器也增伤；墨团原星灵仍6，不吃力量。'},
 anchor5:{name:'阵地协作 · 5次投入',ranks:{C12:1,C16:1,A07:1,A16:1,A13:1},description:'哨卫＋锚点＋专精＋伙伴默契＋护甲。固定哨卫9，锚点聚普通怪；没有盾、融合、脉冲或免费进阶。'},
 anchorStrength5:{name:'阵地协作・换力量 · 5次投入',ranks:{C12:1,C16:1,L1_DAMAGE:1,A16:1,A13:1},description:'同5次投入把专精换力量：哨卫9→8.64，主武器增伤，墨团原星灵7.5→6。'}
};
const w=window as any,round=(n:number)=>Number(n.toFixed(3));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,targets=document.getElementById('targets') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const draw=(s:any)=>{stage.dataset.state=JSON.stringify(s);if(!started)return;const z=s.sentry,d=s.defense,part=s.companionDiagnostics,attached=!!z.station?.attached;
  document.getElementById('hud')!.textContent=`生命${round(s.hp)}/${s.maxHp} · 护盾${round(d.shield)}/${round(d.maxShield)} · ${s.elapsed.toFixed(1)}秒`;
  document.getElementById('stats')!.textContent=`哨卫：${z.station?attached?'随行・新弹八折':'落地定点・新弹原伤':z.owned?'等待6秒部署':'未持有'} · 发射${z.emitted}枚`;
  document.getElementById('metrics')!.textContent=`命中${part.sentry.hits} · 实伤${round(part.sentry.actualDamage)}${s.catId==='CAT03'?` · 星灵实伤${round(part.spirit.actualDamage)}`:''}`;
  const base=w.fortressFusionFixture.session.runConfig,ground=sentinelStats(base,s.progression.ranks).damage,mobile=sentinelStats(base,s.progression.ranks,true).damage;
  document.getElementById('damage')!.textContent=z.station?`当前新弹${round(attached?mobile:ground)}伤害 · ${round(1/(1+.1*(s.progression.ranks.A16||0)))}秒／次`:z.owned?`待部署：落地${round(ground)}${s.progression.ranks.E14?'／随行'+round(mobile):''}伤害`:'原生武器／被动对照';
  status.textContent=s.result?'本局结束，请重开。':s.engine.paused?'已暂停；点击继续才恢复。':d.rechargeWait>0?`回盾还等${d.rechargeWait.toFixed(1)}秒；再次受伤会重新等待。`:'拖动走位，观察附着／落地。回盾后仍活着的哨卫可再随行。';
  (document.getElementById('bubble') as HTMLButtonElement).disabled=s.engine.paused||!!s.result;
 };
 const f=await createTraitFixture(stage,draw);w.fortressFusionFixture=f;for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='mobile5';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{started=false;stage.dataset.ready='false';const previous=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...normalCourtyardRunConfig(f.config(cat.value as CatId)),defenseCompanions:{enabled:true}});await wait(()=>!!f.session&&f.session!==previous);f.install(p.ranks);f.a.sentries.ensure(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;const origin=f.a.cat.body.center;
  for(const [dx,dy]of [[-70,-90],[80,-100],[145,40],[220,20]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);e.body.moves=targets.value==='moving';}}
  document.getElementById('description')!.textContent=p.description;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.targetMode=targets.value;stage.dataset.scope='controlled-presets';started=true;f.layout();draw(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.fortressFusionSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('bubble')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused||f.session?.result)return;const p=f.a.cat.body.center;f.a.enemyBubble({x:p.x,y:p.y-65},{x:0,y:1},ENEMY_BUBBLE);});
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.fortressFusionSampleReady=true;status.textContent='默认移动堡垒＋专精，点击开始。';for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.fortressFusionSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
