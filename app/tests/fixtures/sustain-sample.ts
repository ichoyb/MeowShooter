import {controlledGrowthBase} from './controlled-growth-base';
// P1 controlled presets. This entry is never imported by the normal game.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMY_BUBBLE} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
import type {GrowthRanks} from '../../src/progression';
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>;description:string}>={
 output5:{name:'主弹输出 · 5次投入',ranks:{L1_DAMAGE:2,L1_RATE:1,L1_PIERCE:1,A11:1},description:'力量×2、节奏、贯穿、弱点；不带回血或护盾。与主弹续航相比，将生命回路换成一次力量。'},
 life5:{name:'生命回路 · 5次投入',ranks:{C21:1,L1_DAMAGE:1,L1_RATE:1,L1_PIERCE:1,A11:1},description:'生命回路、力量、节奏、贯穿、弱点。先用测试泡泡造成真实生命损失，再看主弹回血；副弹、伙伴不回血。'},
 shield5:{name:'装填防守 · 5次投入',ranks:{C13:1,M10:1,L1_ECHO:1,L1_LIGHT_MAG:1,L1_RELOAD:1},description:'护盾、装填护罩、尾弹、轻装、装填。真实换匣补盾；两次实际回复至少隔2秒。没有生命回路，不恢复生命。'},
 mobile5:{name:'堡垒补盾 · 5次投入',ranks:{C12:1,C13:1,E14:1,M10:1,L1_RELOAD:1},description:'哨卫、护盾、移动堡垒、装填护罩、装填。破盾落地，换匣补成正盾后同座恢复随行；不赠送哨弹。'}
};
const w=window as any,number=(n:number)=>Number(n.toFixed(3));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,targets=document.getElementById('targets') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const draw=(s:any)=>{stage.dataset.state=JSON.stringify(s);if(!started)return;const d=s.defense,z=s.sustain;
  document.getElementById('hud')!.textContent=`生命 ${number(s.hp)}/${s.maxHp} · 盾 ${number(d.shield)}/${number(d.maxShield)} · ${s.elapsed.toFixed(1)}秒`;
  document.getElementById('stats')!.textContent=`实际回血 ${number(z.hpRecoveredTotal)} · 装填补盾 ${number(z.shieldRecoveredTotal)} · 换匣 ${z.reloadStarts}次`;
  document.getElementById('metrics')!.textContent=z.lifeCircuitOwned?`当前固定秒回血 ${number(z.lifeUsedThisSecond)}/${number(z.lifeLimitPerSecond)} · 无过量伤害收益`:z.reloadShieldOwned?`每次最多 ${number(d.maxShield*.15)}盾 · 至少间隔2秒 · ${z.reloadShieldReady?'已就绪':'等待有效间隔'}`:'输出基线：无续航回复';
  document.getElementById('damage')!.textContent=`${s.ammo}/${s.ammoCapacity}发 · 装填${number(s.reloadSeconds)}秒${s.sentry.owned?' · 哨卫'+(s.sentry.station?s.sentry.station.attached?'随行':'定点':'等待部署'):''}`;
  status.textContent=s.result?'本局结束，可以重开。':s.engine.paused?'已暂停，点击继续才恢复。':'拖动／WASD走位；泡泡可躲，恢复来自真实命中与换匣。';
  (document.getElementById('bubble') as HTMLButtonElement).disabled=s.engine.paused||!!s.result;
 };
 const f=await createTraitFixture(stage,draw);w.sustainFixture=f;
 for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='life5';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{started=false;stage.dataset.ready='false';const old=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...controlledGrowthBase(f.config(cat.value as CatId)),sustainRewards:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(p.ranks);f.a.sentries.ensure(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;for(const [dx,dy]of [[-70,-90],[80,-100],[145,40],[220,20]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',2000);e.body.moves=targets.value==='moving';}}
  document.getElementById('description')!.textContent=p.description;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.scope='controlled-presets-not-natural-growth';started=true;f.layout();draw(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.sustainSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('bubble')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused||f.session?.result)return;const p=f.a.cat.body.center;f.a.enemyBubble({x:p.x,y:p.y-65},{x:0,y:1},ENEMY_BUBBLE);});
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.sustainSampleReady=true;status.textContent='选择角色和方案，点击开始。';for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.sustainSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
