import {controlledGrowthBase} from './controlled-growth-base';
// Controlled P3 presets; never imported by the normal player entry.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMY_BUBBLE} from '../../src/level-config';
import type {CatId} from '../../src/combat-config';
import type {GrowthRanks} from '../../src/progression';
const shared:Partial<GrowthRanks>={L1_TRAIL_BELL:1,L1_ORBIT_BELL:1,C12:1,C13:1,C15:1,A07:1};
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>;benefit:string;cost:string}>={
 none7:{name:'无誓约 · 7次投入',ranks:{...shared,A13:1},benefit:'武器和独立技能不受走停影响；多一张护甲＋6。',cost:'对照：六项共同能力＋护甲，等7次投入。'},
 dash7:{name:'疾驰誓约 · 7次投入',ranks:{...shared,R06:1},benefit:'真正移动时，所有伤害×1.25。',cost:'停止时×0.8；顶墙无位移也算停止，与扎根互斥。'},
 root7:{name:'扎根誓约 · 7次投入',ranks:{...shared,R07:1},benefit:'停止满1秒后，所有伤害×1.4；首秒保持×1。',cost:'移动时×0.8；重走后蓄势归零，与疾驰互斥。'},
 artsDash8:{name:'术式＋疾驰 · 8次投入',ranks:{...shared,R04:1,R06:1},benefit:'来源取舍与走停各乘一次：移动时技能×1.6875。',cost:'武器×0.8；停止全伤再×0.8。跨组组合，共8次投入。'},
 artsRoot8:{name:'术式＋扎根 · 8次投入',ranks:{...shared,R04:1,R07:1},benefit:'驻足满1秒，独立技能×1.89。',cost:'武器×0.8；移动全伤再×0.8。跨组组合，共8次投入。'},
 fireDash8:{name:'火力＋疾驰 · 8次投入',ranks:{...shared,R05:1,R06:1},benefit:'真正移动时，武器×1.6875。',cost:'独立技能×0.8；停止全伤再×0.8。跨组组合，共8次投入。'},
 fireRoot8:{name:'火力＋扎根 · 8次投入',ranks:{...shared,R05:1,R07:1},benefit:'驻足满1秒，武器×1.89。',cost:'独立技能×0.8；移动全伤再×0.8。跨组组合，共8次投入。'}
};
const w=window as any,n=(v:number)=>Number(v.toFixed(3));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,targets=document.getElementById('targets') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const draw=(s:any)=>{stage.dataset.state=JSON.stringify(s);if(!started)return;
  document.getElementById('hud')!.textContent=`生命 ${n(s.hp)}/${s.maxHp} · 盾 ${n(s.defense.shield)} · ${s.elapsed.toFixed(1)}秒`;
  const c=s.contracts;
  document.getElementById('stats')!.textContent=`新主弹 ${n(s.weaponStats.damage*f.session!.runConfig.directDamageMultiplier)}/颗 ×${s.weaponStats.pellets}`;
  document.getElementById('metrics')!.textContent=c?`${c.moving?'移动':'停止'} · 驻足 ${n(c.stationarySeconds)}秒 · 走停倍率 ×${n(c.stance)}`:'当前无走停誓约';
  const damage=Object.values(s.abilitySources).reduce((sum:number,v:any)=>sum+v.damage,0) as number;
  document.getElementById('damage')!.textContent=`技能实伤 ${n(damage)} · 哨卫实伤 ${n(s.companionDiagnostics.sentry.actualDamage)}`;
  status.textContent=s.result?'本局结束，可以重开。':s.engine.paused?'已暂停；继续后重新按下移动。':'拖动／WASD；松手看驻足蓄势，走动看伤害切换。';
 };
 const f=await createTraitFixture(stage,draw);w.stancesFixture=f;
 for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='dash7';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{started=false;stage.dataset.ready='false';const old=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...controlledGrowthBase(f.config(cat.value as CatId)),sustainRewards:{enabled:true},rewardContracts:{enabled:true},movementContracts:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(p.ranks);f.a.sentries.ensure(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;for(const [dx,dy]of [[-35,0],[60,0],[130,15],[170,-30]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',5000);e.body.moves=targets.value==='moving';}}
  document.getElementById('benefit')!.textContent=p.benefit;document.getElementById('cost')!.textContent=p.cost;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.scope='controlled-preset-not-real-confirmations';started=true;f.layout();draw(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.stancesSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('bubble')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused||f.session?.result)return;const p=f.a.cat.body.center;f.a.enemyBubble({x:p.x,y:p.y-65},{x:0,y:1},ENEMY_BUBBLE);});
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.stancesSampleReady=true;status.textContent='选择角色和方案，点击开始。';for(const e of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))e.disabled=false;
}
void boot().catch(e=>{w.stancesSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
