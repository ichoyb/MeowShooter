// Local review entry only. Normal player main never imports this fixture.
import {growthNumbers,type GrowthRanks} from '../../src/progression-content';
declare function require(path:string):any;
require('./progression-ui');
const w=window as any;
const presets:Record<string,{name:string;ranks:Partial<GrowthRanks>}>={
 base:{name:'原生武器',ranks:{}},
 barrage:{name:'多重投射／彗星弹幕 · 5次投入',ranks:{L1_SPLIT:1,L1_EVO_BARRAGE:1,L1_DAMAGE:2,L1_RATE:1}},
 pierce:{name:'贯穿／长虹贯穿 · 5次投入',ranks:{L1_PIERCE:1,L1_EVO_PIERCE:1,L1_DAMAGE:1,L1_RANGE:2}},
 cadence:{name:'尾弹／连奏／轻装 · 5次投入',ranks:{L1_ECHO:1,L1_EVO_CADENCE:1,L1_LIGHT_MAG:1,L1_RELOAD:1,L1_RATE:1}},
 orbit:{name:'三级环铃 · 5次投入',ranks:{L1_ORBIT_BELL:3,L1_DAMAGE:1,L1_RATE:1}}
};
const panel=document.createElement('section');panel.id='cross-weapon-controls';
panel.innerHTML='<strong>三武器构筑对照</strong><p>选择预置后开始一局；预置5次投入，不发经验或精英奖励。敌人、生命与时钟正常运行；可以走位、拾取并继续成长。</p><label>构筑 <select id="sample-build">'+Object.entries(presets).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')+'</select></label><button id="sample-start">开始本组小样</button><small id="sample-status">准备好后可先开启声音，再开始。</small><a href="./comparison.html">返回武器与节奏选择</a>';
document.body.appendChild(panel);
const style=document.createElement('style');style.textContent='body{display:flex;flex-direction:column;background:#ece7d5}#app{flex:1;min-height:0;width:100%;height:auto}#cross-weapon-controls{flex:none;box-sizing:border-box;width:100%;max-width:560px;margin:auto;background:#fff7df;color:#523d2d;padding:8px 12px;font:13px/1.4 sans-serif;border-top:1px solid #baa075}#cross-weapon-controls p{margin:3px 0}#cross-weapon-controls button,#cross-weapon-controls select{min-height:44px;border-radius:8px;border:1px solid #b89b68;background:#fff0bb;color:inherit;padding:6px}#cross-weapon-controls small{display:block;margin:4px 0}#cross-weapon-controls a{color:#526f58}#cross-weapon-controls.compact p,#cross-weapon-controls.compact strong{display:none}';document.head.appendChild(style);
const read=()=>JSON.parse(document.getElementById('app')!.dataset.state||'{}');
const status=document.getElementById('sample-status')!;
const click=(action:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-action="'+action+'"]')).find(b=>b.getClientRects().length);if(!button)throw Error('请先完成当前奖励，或刷新后开始。');button.click();};
const wait=async(predicate:()=>unknown)=>{const end=performance.now()+15000;while(!predicate()){if(performance.now()>end)throw Error('准备超时，请刷新重试。');await new Promise(r=>setTimeout(r,30));}};
document.getElementById('sample-start')!.addEventListener('click',async()=>{
 const button=document.getElementById('sample-start') as HTMLButtonElement;button.disabled=true;
 try{
  await wait(()=>document.getElementById('app')!.dataset.ready==='true');
  if(read().progression?.offer)throw Error('请先完成当前奖励，或刷新后切换预置。');
  if(['play','pause'].includes(read().view)){if(!read().engine.paused)click('pause');click('end');click('confirm-end');}
  if(read().view?.startsWith('PAGE-08'))click('home');
  panel.classList.add('compact');const old=w.growthTestSession;click('start');
  await wait(()=>w.growthTestSession&&w.growthTestSession!==old&&read().progression);
  const preset=presets[(document.getElementById('sample-build') as HTMLSelectElement).value],a=w.growthTestArena,session=w.growthTestSession;
  const ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,...preset.ranks};a.growth.ranks=ranks;session.applyGrowth(ranks);a.syncProjectileCapacity();a.abilities.ensure(ranks,session.elapsed);
  const n=growthNumbers(session.runConfig.growthTuning?.attributePlan),c=session.effectiveConfig;
  status.textContent=`${preset.name}；${c.weapon.pellets}颗／齐射 · 弹匣${c.weapon.ammoCapacity} · 装填${Number(c.weapon.reloadSeconds.toFixed(2))}秒 · 单弹${Number((c.weapon.damage*c.directDamageMultiplier).toFixed(2))} · 独立技能基数${Number((12*(1+n.damage*ranks.L1_DAMAGE)).toFixed(2))}。重开回到零成长，切预置请再次点本按钮。`;
 }catch(error){status.textContent=error instanceof Error?error.message:String(error);}finally{button.disabled=false;}
});
