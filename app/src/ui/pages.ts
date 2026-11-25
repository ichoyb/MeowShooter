import {NavigationModel,View} from './model';
import {r1HomeMarkup} from './r1-home';
import {courtyardSelection,courtyardBook,courtyardResult} from './courtyard-pages';
import {growthPage,growthBuild} from './progression';
import {makeRunConfig,type RunConfig} from '../combat-config';
import {button,notice,badge,header,tabs,stat,catArt,weaponIcon,assetImage,card,esc} from './components';
export type PageParts={body:string;footer:string;home?:boolean;r1Home?:boolean;courtyardUI?:boolean;growthUI?:boolean;resultUI?:boolean};
export const stateNumber=(frame:string)=>Number(frame.split('-S')[1]||1);
export function passiveSummary(run:RunConfig):string {
 if(run.openingPower)return `开局及每次装填后的前${run.openingPower.volleys}次主齐射强化。`;
 if(run.spiritMark)return '星灵命中留下星印，主弹命中该目标可引爆。';
 return run.passive==='reload-secondary'?'开局和装填后的首齐射额外发出1颗副弹。':run.passive==='chill'?'主弹首次命中敌人累积寒意，让雾团减速及短暂冻结。':run.passive==='spirit'?'初始1只星灵，自动攻击附近敌人，不消耗主弹药。':'中性诊断，无角色被动。';
}
export function renderPage(m:NavigationModel,d:any,probe:any,override?:View):PageParts {
 const v=override||m.page,n=stateNumber(v.frame),ctx=v.context,base=v.frame.slice(0,7),sample=!!ctx.sample;
 const previewDuration=m.page.context.previewDuration||120,firstLevel=!!m.page.context.firstLevel;
 const cat=d.cats.find((c:any)=>c.id===m.committed.cat),weapon=d.weapons.find((w:any)=>w.id===m.committed.weapon);
 const playtestNote=m.playtestEnabled&&!sample?notice('内部试玩：三猫临时开放，不保存进度'):'';
 const sampleNote=sample?notice('界面评审 · 示例数据，不产生真实升级、解锁或存档'):'';
 if(base==='PAGE-07'&&ctx.actual&&probe?.progression&&m.run){
  const g=probe.progression,matching=(ctx.runId===undefined||ctx.runId===g.runId)&&(ctx.offerId===undefined||ctx.offerId===g.offer?.id);
  return growthPage(g,m.run,matching?ctx.selected:undefined,{courtyard:firstLevel&&m.playtestEnabled&&!m.reviewEnabled&&!m.page.context.sample&&!sample,playerHp:probe.hp,motion:ctx.growthMotion});
 }
 if(!m.reviewEnabled&&(v.frame==='REVIEW'||v.frame==='COMPONENTS'||base==='PAGE-07'))return {body:notice('这个入口只用于内部设计评审。'),footer:button('home','返回庭院')};
 if(v.frame==='REVIEW')return {body:header('界面与状态评审','home','8类页面 · 4类弹层 · '+d.states.length+'当前状态')+notice('这里切换固定样例；返回庭院可体验真实120秒战斗。')+button('components','公共组件样板','primary')+`<label class="field">选择状态<select id="state-picker">${d.states.map((s:any)=>`<option value="${s.stateId}">${esc(s.stateId+' · '+s.name)}</option>`).join('')}</select></label>`+button('show-state','打开所选状态','primary')+`<div class="state-index">${d.states.map((s:any)=>button('state:'+s.stateId,s.name,'small-button')).join('')}</div>`,footer:button('home','返回庭院')};
 if(v.frame==='COMPONENTS')return {body:header('公共组件样板','review')+`<section class="card"><h2>按钮与状态</h2>${button('noop','主要操作','primary')}${button('noop','已选中','selected')}${button('noop','尚未开放','secondary',true)}${button('noop','危险确认','danger')}</section><section class="card"><h2>标签与属性</h2>${badge('已开放','mint')}${badge('锁定','locked')}${badge('示例数据')}${stat('生命', '80 / 100')}<div class="meter"><i style="width:80%"></i></div></section>${notice('成功反馈')}${notice('失败反馈：会话值仍保留，可重试。','danger')}${card('带代价的升级','主弹＋1；每颗伤害×0.8；散布＋8°','detail:BALL_02')}`,footer:button('review','返回状态评审')};
 if(base==='PAGE-01'){
  const failed=n===3||n===5,progress=ctx.loading;
  return {body:`<div class="loading-hero">${catArt(d.cats[0])}<h1>${n===5?'暂时无法绘制庭院':'猫咪正在集合'}</h1><p>${failed?'资源准备失败，请重试。':n===2?'正在准备包内资源…':progress?`已准备 ${progress.loaded} / ${progress.total} 项资源`:'示例进度：66%'}</p>${n===1?`<div class="meter"><i style="width:${progress?Math.round(progress.loaded/progress.total*100):66}%"></i></div>`:''}${n===4?notice('重试状态样例：再次失败时仍显示恢复入口。'):''}${sampleNote}</div>`,footer:failed||n===4?button(sample?'sample-retry':'reload','重新加载','primary'):sample?button('home','查看庭院','primary'):''};
 }
 if(base==='PAGE-02'&&firstLevel&&m.playtestEnabled&&!sample)return r1HomeMarkup(cat,weapon,m.canStartProbe);
 if(firstLevel&&m.playtestEnabled&&!m.reviewEnabled&&!m.page.context.sample&&!sample){
 if(base==='PAGE-03')return courtyardSelection(m,d);
  if(base==='PAGE-04')return courtyardBook(m,d,ctx);
  if(base==='PAGE-08'&&ctx.actual&&probe)return courtyardResult(m,d,probe);
 }
 if(base==='PAGE-02')return {home:true,body:`<div class="home-title"><h1>猫咪开火啦</h1><p>今天也要守护小庭院</p></div><div class="hero-wrap">${catArt(cat)}<div class="hero-weapon">${weaponIcon(weapon.id)}</div></div><div class="home-loadout"><button class="loadout-card" data-action="select">${catArt(cat,true)}<span><strong>${esc(cat.name)}</strong><small>${esc(cat.breed)} · 当前猫咪</small></span></button><button class="loadout-card" data-action="detail:${weapon.id}">${weaponIcon(weapon.id)}<span><strong>${esc(weapon.name)}</strong><small>自带武器</small></span></button></div>${n===3?notice('旧局已中断，本样例不补算离线战斗或奖励。'):''}${n===4?notice('保存失败样例：会话配置有效，尚未持久保存。','danger'):''}${sampleNote}<p class="center">本阶段真实体验：${esc(cat.name)}${firstLevel?'挑战庭院首关':'守护'+previewDuration+'秒'}</p>${playtestNote}`,footer:button('start',m.canStartProbe?(firstLevel?'开始守护 · 庭院首关':'开始守护 · '+previewDuration+'秒'):'该角色尚未开放','primary',!m.canStartProbe)+`<div class="two-buttons">${button('book','庭院图鉴')}${button('help','玩法说明')}</div><div class="two-buttons">${button('settings','设置','small-button')}${m.reviewEnabled?button('review','界面评审','small-button'):''}</div>`};
 if(base==='PAGE-03'){
  const tab=ctx.tab||'猫咪',selected=d.cats.find((c:any)=>c.id===m.draft.cat);
  const entries=tab==='猫咪'?d.cats.map((c:any)=>{const open=m.unlocked.indexOf(c.id)>=0;return `<article class="cat-card ${m.draft.cat===c.id?'chosen':''}"><button data-action="${open||m.reviewEnabled?'choose:':'detail:'}${c.id}" ${!open&&m.reviewEnabled?'disabled':''} aria-label="${open?'预览':'查看'}${esc(c.name)}">${catArt(c,true)}<span><strong>${esc(c.name)} · ${esc(c.breed)}</strong><small>优势：${esc(c.strength)}<br>短板：${esc(c.tradeoff)}</small></span>${badge(open?(m.draft.cat===c.id?'已选中':'可选择'):m.reviewEnabled?'锁定':'研发中')}</button><div class="cat-card-foot">${weaponIcon(c.startingWeapon)}<span>${esc(d.weapons.find((w:any)=>w.id===c.startingWeapon).name)}</span>${button('detail:'+c.id,'详情','small-button')}</div>${!open?`<p class="unlock">${esc(m.reviewEnabled?c.unlock:'后续版本开放；本次120秒体验暂不可出战。')}</p>`:''}</article>`;}).join(''):d.weapons.map((w:any)=>`<article class="card weapon-card">${weaponIcon(w.id)}<h2>${esc(w.name)}</h2><p>${esc(d.cats.find((c:any)=>c.id===w.ownerCat).name)}自带 · 随角色开放</p>${button('detail:'+w.id,'查看规则')}</article>`).join('');
  return {body:header('准备出战','cancel-select','预览不会立即换装；确认后整体生效')+tabs(['猫咪','武器'],tab,'select-tab')+notice(m.playtestEnabled?'每只猫固定携带自己的武器；确认后开始该配对的真实战斗。':'每只猫固定携带自己的武器。当前可以使用橘团，其他猫咪后续开放。')+playtestNote+entries+`<div class="card"><strong>当前预览：${esc(selected.name)}</strong><p>${esc(sample?selected.playerPassive:passiveSummary(makeRunConfig(selected.id,selected.startingWeapon,'p2-basic')))}</p><p>${esc(m.reviewEnabled?selected.balanceStatus:m.playtestEnabled?'三猫属性与被动真实生效，初值尚待试玩校准。':'当前只开放橘团；其余猫咪可查看介绍。')}</p></div>${n===4?notice('取消会同时舍弃猫咪与武器预览。'):''}${sampleNote}`,footer:`<div class="two-buttons">${button('cancel-select','取消')}${button('confirm-select','确认出战配置','primary')}</div>`};
 }
 if(base==='PAGE-04'){
  const category=ctx.category||['猫咪','武器','升级','协同','猫咪'][n-1]||'猫咪';let entries:any[]=category==='猫咪'?d.cats:category==='武器'?d.weapons:category==='升级'?d.upgrades:d.synergies;
  if(category==='升级'&&ctx.tree)entries=entries.filter((e:any)=>e.tree===ctx.tree);
  return {body:header('庭院图鉴','back','只浏览内容与规则，不购买或领取奖励')+tabs(m.reviewEnabled?['猫咪','武器','升级','协同']:['猫咪','武器'],category,'category')+(category==='升级'?tabs(['全部',...Object.keys(d.trees)],ctx.tree||'全部','tree'):'')+entries.map(e=>`<article class="card content-card">${e.id.startsWith('CAT')?catArt(e,true):e.id.startsWith('W')?weaponIcon(e.id):`${assetImage((e.tree||'SUMMON')+'.svg','content-icon')}`}<div><strong>${esc(e.name)}</strong><p>${esc(e.breed||d.trees[e.tree]||'自动协同')}</p>${e.id.startsWith('CAT')?badge(m.unlocked.indexOf(e.id)>=0?'已开放':'锁定'):''}</div>${button('detail:'+e.id,'详情','small-button')}</article>`).join('')+sampleNote,footer:button('back','返回庭院')};
 }
 if(base==='PAGE-05')return {body:header('玩法说明','back')+tabs(['手机','桌面'],ctx.device||(n===2?'桌面':'手机'),'help-tab')+`<section class="card"><h2>${ctx.device==='桌面'||n===2?'电脑预览操作':'手机单指操作'}</h2><p>${ctx.device==='桌面'||n===2?'WASD移动；按住鼠标主键拖动也可移动；射击与装填自动进行；Esc暂停。':'在战场或下方空白处按下并拖动移动；松手停止移动，射击继续自动进行。不必将手指固定在左下角。'}</p><p>${firstLevel?'每次开火选择射程内最近敌人；没有目标时停火。通过走位避开蹦冲和泡泡，也能改变下一发的攻击对象。':'每次开火选择射程内最近敌人；没有敌人时攻击最近金色小木箱；都没有时停火。通过走位改变下一发的攻击对象，箱子仅为测试物件，没有奖励。'}</p><h2>弹夹打空，自动装填</h2><p>最后一发后自动装填；装填期间仍可移动。没有手动换弹按钮或R键。</p><h2>暂停与中断</h2><p>打开暂停、说明、详情或设置，战斗停止。切到后台或触点异常后，回来需要明确点击继续；不会补射积压子弹。</p><h2>当前体验与正式规则</h2><p>${m.playtestEnabled?'内部试玩可选三猫及其固定武器，属性与被动真实生效。':'公开体验使用橘团与铃铛，其他猫咪后续开放。'}${firstLevel?'击败雾壳巨兽通关；生命归零或600秒未通关则挑战结束。':'生命归零或存活'+previewDuration+'秒结束。'}${firstLevel?'拾取星光经验升级，可选分弹、贯穿或装填爆发核心，搭配可重复属性后进阶；精英分别在150／300秒登场，击败后各领一次战利品并回复20%最大生命；450秒巨兽入场，600秒上限。每局重新成长。':'当前模式未接入经验成长。'}</p><p>其他猫固定携带自己的武器；自由换装、武器库扩展和局外天赋留在后续路线。</p></section>${sampleNote}`,footer:button('back','返回原入口')};
 if(base==='PAGE-06')return {body:'',footer:''};
 if(base==='PAGE-07'){
  const f=d.fixtures[['','THREE','TWO','ONE','COST','PREREQUISITE','AUTO','CONFIRMED_QUEUE','THREE','FULL'][n]]||d.fixtures.THREE;
  const candidates=ctx.candidates||f.candidates||[];
  const chosen=ctx.selected;
  return {body:header(n===8?'Boss奖励样例':'选择本局强化','close-upgrade','固定候选，不进行真实随机抽取')+notice('示例数据：卡片确认只演示反馈，不改变真实伤害或奖励。')+(n===6?notice('协同自动激活：两项终结节点已取得，不占选择。')+card(d.synergies[0].name,d.synergies[0].playerEffect,'detail:'+d.synergies[0].id):'')+(n===9?notice('通用强化已满：伤害5/5、拾取5/5且生命已满，跳过选择。'):'')+candidates.map((id:string)=>{const u=d.upgrades.find((x:any)=>x.id===id);return u?`<article class="upgrade-card ${chosen===id?'chosen':''}"><button class="upgrade-choice" data-action="upgrade-choice:${id}" ${chosen?'disabled':''}>${assetImage(u.tree+'.svg','upgrade-icon')}<strong>${esc(u.name)}</strong><p>${esc(u.playerEffect)}</p><small>${esc(u.requires_all.length?'前置：'+u.requires_all.map((r:string)=>d.upgrades.find((x:any)=>x.id===r)?.name||r).join('＋'):'根节点，无前置')}</small></button>${button('detail:'+id,'完整规则与代价','small-button')}</article>`:'';}).join('')+(chosen?notice('已确认一次。松开后点击下一步；这次操作不产生实际强化。'):'')+(n===7&&chosen?card('已确认：'+d.upgrades.find((x:any)=>x.id===chosen).name,'本项已提交，仅可查看详情；下一项使用带代价候选。','detail:'+chosen):'')+(n===5?card(d.upgrades.find((x:any)=>x.id===f.inspect).name+' · 前置未齐','已有守护根节点与分支一，仍缺少分支二；此终结节点不可进入候选。','detail:'+f.inspect):'')+(n===7?notice(`连续队列：第${ctx.queueIndex||1}项 / 2项。详情不提交选择。`):''),footer:chosen?button('upgrade-next',n===7&&(ctx.queueIndex||1)<2?'查看下一项候选':'完成样例并返回','primary'):button('close-upgrade','返回原入口')};
 }
 if(base==='PAGE-08'){
  const f=ctx.result||d.fixtures[['','VICTORY','VICTORY_NONE','DEATH_NONE','DEATH_FIRST','VICTORY_MULTI','VICTORY'][n]];
  const actual=!!ctx.actual,isWin=actual?(probe?.result==='survived'||probe?.result==='cleared'):f.outcome==='victory';
  const run=actual?{cat:probe.catId,weapon:probe.weaponId}:f.runLoadout,c=d.cats.find((x:any)=>x.id===run.cat),w=d.weapons.find((x:any)=>x.id===run.weapon);
  const unlocked=actual?[]:(n===2||n===3?[]:f.newUnlocks||[]);
  return {body:header(actual&&probe?.result==='timeout'?'守护时间用尽了':isWin?'庭院守住啦！':'猫咪需要休息','home',actual?(probe?.result==='cleared'?'已击败雾壳巨兽':probe?.result==='timeout'?'未能在600秒内击败雾壳巨兽':probe?.result==='death'?'下次再一起守护庭院':(probe?.durationSeconds||previewDuration)+'秒真实体验结果'):'结算样例 · 不发放实际解锁')+`<div class="result-hero">${catArt(c)}</div><div class="stats-grid">${stat('有效时长',actual?Math.floor(probe?.elapsed||0)+'秒':f.elapsed)}${stat('击退',actual?probe?.kills:f.kills)}${m.reviewEnabled?stat('等级',actual?'未接入':f.level):''}${stat('猫咪 / 武器',c.name+' / '+w.name)}</div>${unlocked.length?`<section class="card"><h2>样例中的新开放角色</h2>${unlocked.map((id:string)=>{const cat=d.cats.find((x:any)=>x.id===id);return `<p>${esc(cat.name)} · ${esc(d.weapons.find((x:any)=>x.id===cat.startingWeapon).name)}随角色可用</p>${button('detail:'+id,'查看'+cat.name,'small-button')}`}).join('')}</section>`:notice(actual?'本次短局不发放角色解锁或保存战绩。':'本次样例无新开放角色。')}${m.reviewEnabled?button('build','查看全部构筑'):''}${m.reviewEnabled&&n===6?notice('保存失败样例：结果留在本次会话中，未永久保存。','danger')+button('sample-save','模拟重试'):''}`,footer:`<div class="two-buttons">${button(actual?'restart':'sample-restart','再守护一次','primary',!actual&&run.cat!=='CAT01')}${button('home','返回庭院')}</div>`};
 }
 return {body:notice('无法识别当前页面。','danger'),footer:button('home','返回庭院')};
}

