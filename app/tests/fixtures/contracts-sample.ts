import {controlledGrowthBase} from './controlled-growth-base';
// P2 presets are review data, never imported by the normal player entry.
import {createTraitFixture} from './projectile-traits-sample';
import {ENEMY_BUBBLE} from '../../src/level-config';
import {abilityDamage,nativeSpiritDamage,deriveGrowthConfig} from '../../src/progression';
import {sentinelStats} from '../../src/sentinel-rules';
import type {CatId} from '../../src/combat-config';
import type {GrowthRanks} from '../../src/progression';
const shared:Partial<GrowthRanks>={L1_PIERCE:1,L1_ECHO:1,L1_ORBIT_BELL:1,C12:1,C13:1};
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>;benefit:string;cost:string}>={
 none6:{name:'不选契约 · 6次投入',ranks:{...shared,A13:1},benefit:'武器与独立技能保持原倍率；多一次坚实皮毛，护甲＋6。',cost:'相同投入基线：五项共同能力＋一张护甲。'},
 arts6:{name:'术式专注 · 6次投入',ranks:{...shared,R04:1},benefit:'独立技能与伙伴伤害＋35%。',cost:'武器主弹／副弹伤害−20%；与纯粹火力互斥。'},
 fire6:{name:'纯粹火力 · 6次投入',ranks:{...shared,R05:1},benefit:'武器主弹／副弹伤害＋35%。',cost:'独立技能与伙伴伤害−20%；与术式专注互斥。'}
};
const w=window as any,number=(n:number)=>Number(n.toFixed(3));
async function boot(){
 const stage=document.getElementById('stage')!,status=document.getElementById('status')!,cat=document.getElementById('cat') as HTMLSelectElement,scheme=document.getElementById('scheme') as HTMLSelectElement,targets=document.getElementById('targets') as HTMLSelectElement;
 let started=false,busy=false,quality:'standard'|'low'='standard';
 const draw=(s:any)=>{stage.dataset.state=JSON.stringify(s);if(!started)return;const base=f.session!.runConfig,r=s.progression.ranks,c=deriveGrowthConfig(base,r);
  document.getElementById('hud')!.textContent=`生命 ${number(s.hp)}/${s.maxHp} · 盾 ${number(s.defense.shield)} · ${s.elapsed.toFixed(1)}秒`;
  document.getElementById('stats')!.textContent=`新主弹 ${number(c.weapon.damage*base.directDamageMultiplier)}/颗 ×${c.weapon.pellets} · 技能S ${number(abilityDamage(base,r))}`;
  document.getElementById('metrics')!.textContent=`新哨弹 ${number(sentinelStats(base,r).damage)}${base.passive==='spirit'?` · 原生星灵 ${number(nativeSpiritDamage(base,r))}`:''} · 不改变射速与数量`;
  const a=s.abilitySources,skill=Object.values(a).reduce((sum:number,v:any)=>sum+v.damage,0) as number,part=s.companionDiagnostics;
  document.getElementById('damage')!.textContent=`技能实伤 ${number(skill)} · 哨卫 ${number(part.sentry.actualDamage)}${base.passive==='spirit'?` · 星灵 ${number(part.spirit.actualDamage)}`:''}`;
  status.textContent=s.result?'本局结束，可以重开。':s.engine.paused?'已暂停，点击继续才恢复。':'拖动／WASD走位；靠近可看环铃，6秒后部署哨卫。';
  (document.getElementById('bubble') as HTMLButtonElement).disabled=s.engine.paused||!!s.result;
 };
 const f=await createTraitFixture(stage,draw);w.contractsFixture=f;
 for(const [id,p]of Object.entries(presets))scheme.add(new Option(p.name,id));scheme.value='arts6';
 const wait=async(test:()=>boolean)=>{const end=performance.now()+8000;while(!test()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(r=>requestAnimationFrame(()=>r()));}};
 const start=async()=>{if(busy)return;busy=true;try{started=false;stage.dataset.ready='false';const old=f.session,p=presets[scheme.value];f.battle.setPresentation({quality});f.battle.start({...controlledGrowthBase(f.config(cat.value as CatId)),sustainRewards:{enabled:true},rewardContracts:{enabled:true}});
  await wait(()=>!!f.session&&f.session!==old);f.install(p.ranks);f.a.sentries.ensure(p.ranks);f.a.areas.ensure(p.ranks);
  f.a.spawns.take=()=>null;f.a.trySpecialSpawn=()=>{};f.a.reinforcements.dueEncounters=()=>[];f.a.growth.collect=()=>{};f.a.growth.queueElite=()=>false;
  const origin=f.a.cat.body.center;for(const [dx,dy]of [[-50,-60],[60,0],[130,15],[170,-30]]){const e=f.a.placeSliceEnemy('E01',origin.x+dx,origin.y+dy);if(e){e.setData('hp',5000);e.body.moves=targets.value==='moving';}}
  document.getElementById('benefit')!.textContent=p.benefit;document.getElementById('cost')!.textContent=p.cost;stage.dataset.cat=cat.value;stage.dataset.preset=scheme.value;stage.dataset.scope='controlled6-preset-not-real-confirmations';started=true;f.layout();draw(f.battle.snapshot());stage.dataset.ready='true';
 }catch(e){w.contractsSampleStartError=String(e);status.textContent='启动失败：'+String(e);}finally{busy=false;}};
 document.getElementById('start')!.addEventListener('click',()=>void start());document.getElementById('pause')!.addEventListener('click',()=>f.battle.pause('menu'));document.getElementById('resume')!.addEventListener('click',()=>f.battle.resume());
 document.getElementById('bubble')!.addEventListener('click',()=>{if(!started||f.battle.snapshot().engine.paused||f.session?.result)return;const p=f.a.cat.body.center;f.a.enemyBubble({x:p.x,y:p.y-65},{x:0,y:1},ENEMY_BUBBLE);});
 document.getElementById('quality')!.addEventListener('change',e=>{quality=(e.target as HTMLSelectElement).value as typeof quality;f.battle.setPresentation({quality});f.layout();});document.getElementById('sound')!.addEventListener('click',()=>void f.battle.audio?.enable().then(()=>document.getElementById('sound')!.textContent=f.battle.audio?.snapshot().ready?'声音已开':'声音不可用'));
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)f.battle.pause('inputLost');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)f.battle.pause('background');});
 w.contractsSampleReady=true;status.textContent='选择角色与方案，点击开始。';for(const c of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select')))c.disabled=false;
}
void boot().catch(e=>{w.contractsSampleBootError=String(e);document.getElementById('status')!.textContent='加载失败：'+String(e);});
