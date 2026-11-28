// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import {subscribe} from './bridge';
import {DEVTOOLS_LIMITS,readDevtoolsSettings,writeDevtoolsSettings,type DevtoolsController,type DevtoolsSettings} from './model';

document.documentElement.dataset.devtools='CAT_DEVTOOLS_V1';
const badge=document.createElement('button');
badge.type='button';badge.id='devtools-badge';badge.textContent='本机调试版';badge.setAttribute('aria-controls','devtools');
const panel=document.createElement('aside');panel.id='devtools';panel.setAttribute('aria-label','本机调试面板');
panel.innerHTML=`<header><strong>本机调试面板</strong><button type="button" id="devtools-close" aria-label="收起面板">×</button></header>
<p class="devtools-hint">Backquote（\u0060）或左上标记开关。仅本机调试，设置随网址保留。</p>
<form id="devtools-settings"><label class="devtools-inv"><input type="checkbox" name="inv"> B · 无敌（生命与护盾不受损）</label>
<fieldset><legend>E · 实时倍率</legend>${(['dmg','hp','spawn','xpm'] as const).map(key=>`<label>${{dmg:'玩家伤害',hp:'新怪物血量',spawn:'普通刷怪量',xpm:'拾取经验'}[key]}<input name="${key}" type="number" step="0.1" min="${DEVTOOLS_LIMITS[key].min}" max="${DEVTOOLS_LIMITS[key].max}" required></label>`).join('')}
<button type="submit">应用设置</button></fieldset></form>
<p id="devtools-settings-error" role="status"></p>
<details><summary>倍率生效边界</summary><p>伤害覆盖主弹、副弹、铃术、范围技能、震荡、星灵、哨卫及契约。已发射的弹与已部署物保留原伤害。怪物血量只影响之后出生的怪。</p><p>刷怪倍率只调整普通出生请求，保留并发与种类上限；精英、Boss、援军配额不变。经验倍率影响之后拾取的到账经验与拾光充能。</p></details>
<section aria-label="实时信息"><h2>F · 实时信息</h2><output id="devtools-info">等待游戏就绪</output></section>
<section><h2>D · 经验与升级</h2><div class="devtools-xp"><input id="devtools-xp-amount" aria-label="添加经验数量" type="number" min="1" step="1" value="8"><button type="button" id="devtools-add-xp">加经验</button><button type="button" id="devtools-level-up">升一级</button></div><p id="devtools-growth-info"></p></section>
<section><h2>C · 直接获得奖励 <span id="devtools-reward-count"></span></h2><p class="devtools-hint">遵守前置、互斥和等级上限。真实选卡期间请先完成选卡。</p><div id="devtools-rewards"></div></section>
<p id="devtools-action-status" role="status"></p>`;
document.body.appendChild(badge);document.body.appendChild(panel);
let controller:DevtoolsController|null=null,settings:DevtoolsSettings|null=null,rewardsKey='';
let opened=window.innerWidth>=1220;
function toggle(value=!opened){opened=value;panel.hidden=!opened;badge.setAttribute('aria-expanded',String(opened));}
toggle(opened);
window.matchMedia('(max-width:1219px)').addListener(event=>{if(event.matches)toggle(false);});
badge.addEventListener('click',()=>toggle());panel.querySelector('#devtools-close')!.addEventListener('click',()=>toggle(false));
const form=panel.querySelector<HTMLFormElement>('#devtools-settings')!;
const input=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
const params=new URLSearchParams(location.search),initial=readDevtoolsSettings(params);
settings=initial.settings;input('inv').checked=params.get('inv')==='1';
for(const key of ['dmg','hp','spawn','xpm'])input(key).value=params.get(key)??'1';
const error=panel.querySelector<HTMLElement>('#devtools-settings-error')!;
error.textContent=initial.errors.join('；');
const status=panel.querySelector<HTMLElement>('#devtools-action-status')!;
form.addEventListener('submit',event=>{
 event.preventDefault();const values=new URLSearchParams();values.set('inv',input('inv').checked?'1':'0');
 for(const key of ['dmg','hp','spawn','xpm'])values.set(key,input(key).value);
 const parsed=readDevtoolsSettings(values);error.textContent=parsed.errors.join('；');
 if(!parsed.settings)return;
 settings=parsed.settings;history.replaceState(null,'',writeDevtoolsSettings(new URL(location.href),settings).href);controller?.setSettings(settings);
 status.textContent='设置已应用；新出生与后续拾取使用新倍率。';
});
input('inv').addEventListener('change',()=>form.requestSubmit());
function typing(){const active=document.activeElement;return !!active&&panel.contains(active)&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);}
window.addEventListener('keydown',event=>{
 if(typing()){event.stopImmediatePropagation();return;}
 if(event.code==='Backquote'){event.preventDefault();event.stopImmediatePropagation();toggle();}
},true);
window.addEventListener('keyup',event=>{if(typing())event.stopImmediatePropagation();},true);
panel.addEventListener('focusin',()=>controller?.clearInput());
function refresh(){
 if(!controller)return;
 const snapshot=controller.read(),s=snapshot.battle,g=s.progression;
 const ordinary=s.enemyBehaviors.filter(enemy=>!['EL01','B01'].includes(enemy.enemyId)).length;
 panel.querySelector('#devtools-info')!.textContent='FPS '+(s.engine.renderFrames.avgFPS?.toFixed(1)??'—')+' · 怪物 '+s.enemies+'（普通 '+ordinary+'/'+snapshot.ordinaryCap+'） · 玩家弹 '+s.projectiles+' · 敌弹 '+s.enemyProjectiles.length;
 panel.querySelector('#devtools-growth-info')!.textContent=g?'Lv '+g.level+' · XP '+g.xp+'/'+g.nextXP+' · 累计 '+g.totalXP:'请先开始一局';
 const disabled=!settings||!snapshot.active||s.reasons.some(reason=>reason==='background'||reason==='inputLost');
 for(const id of ['devtools-add-xp','devtools-level-up'])(panel.querySelector('#'+id) as HTMLButtonElement).disabled=disabled;
 const key=JSON.stringify([snapshot.rewards,!!settings]);
 if(key!==rewardsKey){
  rewardsKey=key;panel.querySelector('#devtools-reward-count')!.textContent=snapshot.rewards.length?'('+snapshot.rewards.length+')':'';
  const root=panel.querySelector('#devtools-rewards')!;root.textContent='';
  for(const reward of snapshot.rewards){
   const row=document.createElement('div');row.className='devtools-reward';row.dataset.reward=reward.id;
   const label=document.createElement('span');label.textContent=reward.name+' · Lv '+reward.rank+(reward.limit===null?'':'/'+reward.limit);
   const reason=document.createElement('small');reason.textContent=reward.reason??(!settings?'请先修正设置':'可获得');
   const button=document.createElement('button');button.type='button';button.textContent='获得';button.disabled=!!reward.reason||!settings;
   button.addEventListener('click',()=>{status.textContent=controller?.grant(reward.id)?'已获得 '+reward.name:'当前状态不能领取';});
   row.appendChild(label);row.appendChild(button);row.appendChild(reason);root.appendChild(row);
  }
 }
}
subscribe(next=>{const changed=next!==controller;controller=next;if(changed&&controller&&settings)controller.setSettings(settings);refresh();});
panel.querySelector('#devtools-add-xp')!.addEventListener('click',()=>{
 const amount=Number((panel.querySelector('#devtools-xp-amount') as HTMLInputElement).value);
 if(!Number.isSafeInteger(amount)||amount<=0){status.textContent='经验必须为正整数';return;}
 status.textContent=controller?.experience(amount)?'经验已到账':'当前状态不能加经验';
});
panel.querySelector('#devtools-level-up')!.addEventListener('click',()=>{
 const growth=controller?.read().battle.progression;
 status.textContent=growth&&controller?.experience(growth.nextXP-growth.xp)?'已补足下一级经验，请完成真实选卡':'请先开始一局';
});
