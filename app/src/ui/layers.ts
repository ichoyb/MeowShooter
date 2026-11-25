import {growthBuild,growthDetail} from './progression';
import {NavigationModel} from './model';
import {makeRunConfig} from '../combat-config';
import {courtyardRunConfig,courtyardBalanceRunConfig} from '../level-config';
import {deriveGrowthConfig} from '../progression';
import {courtyardDetail} from './courtyard-pages';
import {courtyardButton,courtyardNotice} from './courtyard-components';
import {button,notice,badge,stat,esc,catArt,weaponIcon,assetImage} from './components';
import {stateNumber,passiveSummary} from './pages';
export function courtyardAudioStatus(audio?:{error:string|null;ready:boolean;held?:boolean;contextState?:string}):string {
 if(!audio)return courtyardNotice('声音尚未准备好，请返回后重试。','error');
 if(audio.error)return courtyardNotice('声音暂不可用：'+audio.error,'error')+courtyardButton('sound-enable','重试开启声音',{kind:'quiet'});
 if(audio.ready||audio.held&&audio.contextState==='running')return '';
 return courtyardNotice('点击开启声音后，返回庭院或继续守护时播放。')+courtyardButton('sound-enable','开启声音',{kind:'quiet'});
}
export function renderLayer(m:NavigationModel,d:any):{title:string;body:string;footer:string;courtyardUI?:boolean;sessionUI?:'pause'|'settings'|'end'} {
 const v=m.current,n=stateNumber(v.frame),base=v.frame.slice(0,8),ctx=v.context;
 const courtyardUI=m.playtestEnabled&&!m.reviewEnabled&&m.page.context.firstLevel&&!m.page.context.sample&&!ctx.sample;
 const runFor=(cat:string,weapon:string)=>{
  if(!ctx.sample&&m.run?.catId===cat&&m.run?.weaponId===weapon)return m.run;
  const run=makeRunConfig(cat,weapon,'p2-basic');return !ctx.sample&&m.page.context.firstLevel&&cat==='CAT01'?courtyardRunConfig(run):run;
 };
 if(ctx.error)return courtyardUI?{courtyardUI:true,title:'暂时无法出战',body:courtyardNotice(ctx.error,'error'),footer:courtyardButton('close','返回原入口')}:{title:'暂时无法出战',body:notice(ctx.error,'danger'),footer:button('close','返回原入口','primary')};
 if(ctx.growthDetail)return growthDetail(ctx.growthDetail,ctx.progression,m.run??undefined,{courtyard:courtyardUI,source:ctx.growthSource==='owned'?'owned':'offer'});
 if(base==='LAYER-01'){
  if(courtyardUI){
   const a=ctx.runtimeAudio,s=a?.settings;
   const sound=(key:'music'|'effects',volume:'musicVolume'|'effectsVolume',label:string)=>`<section class="court-setting"><div class="court-setting-head"><h2>${label}</h2>${courtyardButton('sound-toggle:'+key,s?.[key]?'开启':'关闭',{pressed:!!s?.[key],disabled:!s})}</div><label class="court-volume"><span>${label}音量</span><output data-audio-value="${volume}" for="${volume}">${Math.round((s?.[volume]??0)*100)}%</output><input id="${volume}" type="range" min="0" max="100" value="${Math.round((s?.[volume]??0)*100)}" data-audio-volume="${volume}" aria-label="${label}音量"${s?'':' disabled'}></label></section>`;
   return {courtyardUI:true,sessionUI:'settings',title:'庭院设置',body:`<p class="court-session-copy">声音与画质仅在本次会话中应用</p>${sound('music','musicVolume','音乐')}${sound('effects','effectsVolume','音效')}<label class="court-quality" for="quality"><span>画质</span><select id="quality"><option${m.settings.quality==='标准'?' selected':''}>标准</option><option${m.settings.quality==='低'?' selected':''}>低</option></select></label><p class="court-session-copy">低档简化装饰，保留危险预警和操作反馈。</p><div data-courtyard-audio-status>${courtyardAudioStatus(a)}</div>`,footer:courtyardButton('close',ctx.returnLabel||'返回原入口',{kind:'gold'})};
  }
  const enabled=ctx.sample&&n!==2;
  if(m.playtestEnabled&&!m.reviewEnabled&&!ctx.sample&&ctx.runtimeAudio){const a=ctx.runtimeAudio,s=a.settings;return {title:'庭院设置',body:notice('声音与画质仅在本次会话中应用；不保存进度。')+notice(a.error?'声音暂不可用：'+a.error:'音乐和音效分别控制；返回庭院或继续游戏后播放。',a.error?'danger':'mint')+`<div class="field">音乐${button('sound-toggle:music',s.music?'开':'关')}</div><label class="field">音乐音量<input type="range" min="0" max="100" value="${Math.round(s.musicVolume*100)}" data-audio-volume="musicVolume" aria-label="音乐音量"></label><div class="field">音效${button('sound-toggle:effects',s.effects?'开':'关')}</div><label class="field">音效音量<input type="range" min="0" max="100" value="${Math.round(s.effectsVolume*100)}" data-audio-volume="effectsVolume" aria-label="音效音量"></label><label class="field">画面装饰<select id="quality"><option${m.settings.quality==='标准'?' selected':''}>标准</option><option${m.settings.quality==='低'?' selected':''}>低</option></select></label><p>低档简化页面装饰，不改变敌人数量、伤害或危险预警。</p>`,footer:button('close','返回原入口','primary')};}
  return {title:'庭院设置',body:notice('设置仅在本次会话中应用；持久存档尚未接入。')+(m.reviewEnabled?(notice(enabled?'示例音频控件可调；不播放声音，不写真实存档。':'音频尚未接入，音乐与音效不可用。')+`<div class="field">音乐${button('sample-audio:music',enabled?(ctx.music===false?'示例：关':'示例：开'):'尚未接入','secondary',!enabled)}</div><div class="field">音效${button('sample-audio:effects',enabled?(ctx.effects===false?'示例：关':'示例：开'):'尚未接入','secondary',!enabled)}</div><label class="field">音乐音量<input type="range" min="0" max="100" value="${ctx.musicVolume??60}" data-volume="musicVolume" ${enabled?'':'disabled'} aria-label="音乐音量样例"></label><label class="field">音效音量<input type="range" min="0" max="100" value="${ctx.effectsVolume??70}" data-volume="effectsVolume" ${enabled?'':'disabled'} aria-label="音效音量样例"></label>`):'<p>当前体验不播放音乐和音效。</p>')+`<label class="field">画面装饰<select id="quality"><option${m.settings.quality==='标准'?' selected':''}>标准</option><option${m.settings.quality==='低'?' selected':''}>低</option></select></label><p>低档简化页面装饰，不改变敌人数量、伤害或危险预警。</p>${n===3?notice('保存失败样例：会话设置有效，未永久保存。','danger')+button('sample-save','模拟重试'):''}`,footer:button('close','返回原入口','primary')};
 }
 if(base==='LAYER-02'&&courtyardUI){
  const interrupted=n===3||ctx.interrupted,waiting=ctx.waitReturn&&m.layers.some(v=>v.frame.startsWith('PAGE-07')&&v.context.actual);
  return {courtyardUI:true,sessionUI:'pause',title:interrupted?'等待明确继续':'休息一下',body:`<p class="court-pause-copy">${waiting?'继续后返回未完成的成长选择':interrupted?'战斗已暂停，点击继续后再守护':'准备好后，再继续守护'}</p><div class="court-pause-actions">${courtyardButton('resume','继续守护',{kind:'gold'})}${courtyardButton('build','本局构筑')}${courtyardButton('settings','设置')}${courtyardButton('help','玩法说明')}</div>`,footer:courtyardButton('end','结束本局 ›',{kind:'quiet'})};
 }
 if(base==='LAYER-02')return {title:n===3||ctx.interrupted?'等待明确继续':'花园小憩',body:notice(n===3||ctx.interrupted?'旧触点已清零；点击继续后恢复自动攻击，移动需重新按下。':'时间、敌人、子弹与装填已暂停。')+`<div class="pause-cat">${catArt(m.page.context.actual&&m.run?d.cats.find((c:any)=>c.id===m.run!.catId):d.cats[0])}</div>${n===4?notice('升级后台样例：继续会返回未完成候选；子详情保留来源。'):''}`+(m.reviewEnabled||ctx.progression?button('build','本局强化'):'')+button('settings','庭院设置')+button('help','玩法说明')+(m.reviewEnabled?button('upgrade','升级界面体验'):''),footer:button('resume',n===4?'返回未完成候选':'继续游戏','primary')+button('end','结束本局','link-button')};
 if(base==='LAYER-04'&&courtyardUI)return {courtyardUI:true,sessionUI:'end',title:'结束这次守护？',body:'<p class="court-end-copy">结束后返回庭院，本局成长随之结束，不会发放结算奖励。</p>',footer:`<div class="court-end-actions">${courtyardButton('close','返回暂停',{kind:'gold'})}${courtyardButton('confirm-end','结束并回庭院',{kind:'quiet'})}</div>`};
 if(base==='LAYER-04')return {title:'结束这次守护？',body:`<p>主动结束会返回庭院，不进入正常结算；本局未提交的解锁与奖励不会保留。</p>${notice('这里不提供广告复活或付费恢复。')}`,footer:`<div class="two-buttons">${button('close','继续休息')}${button('confirm-end','结束并回庭院','danger')}</div>`};
 const id=ctx.contentId||(['','CAT02','BALL_02','S01','build','build'][n]);
 if(id==='build'){
  if(ctx.progression)return courtyardUI?{courtyardUI:true,title:'本局构筑',body:growthBuild(ctx.progression,m.run??undefined,{courtyard:true}),footer:courtyardButton('close','返回原位置',{kind:'gold'})}:{title:'本局强化',body:growthBuild(ctx.progression),footer:button('close','返回原位置','primary')};
  const f=ctx.result||d.fixtures.LATE,ids=ctx.actual?[]:[...(f.ownedUpgrades||[]),...(f.synergies||[])];
  return {title:'本局构筑',body:notice(ctx.actual?'当前真实探针未接入升级，无实际构筑。':`${(f.ownedUpgrades||[]).length}项常规＋${(f.synergies||[]).length}项协同 · 示例数据`)+(ids.length?ids.map((id:string)=>{const u=[...d.upgrades,...d.synergies].find((u:any)=>u.id===id);return `<article class="card"><strong>${esc(u?.name||id)}</strong>${button('detail:'+id,'完整规则','small-button')}</article>`}).join(''):'<p>本次没有取得升级。</p>'),footer:button('close','关闭，返回原位置','primary')};
 }
 const c=d.cats.find((x:any)=>x.id===id),w=d.weapons.find((x:any)=>x.id===id),u=[...d.upgrades,...d.synergies].find((x:any)=>x.id===id);
 if(courtyardUI&&(c||w)){
  const catId=c?c.id:w.ownerCat,weaponId=c?c.startingWeapon:w.id;
  const active=m.run?.catId===catId&&m.run?.weaponId===weaponId;
  let run=active?m.run!:courtyardBalanceRunConfig(makeRunConfig(catId,weaponId,'p2-basic'));
  if(active&&ctx.progression)run=deriveGrowthConfig(run,ctx.progression.ranks,ctx.progression.contracts);
  return courtyardDetail(m,d,run,passiveSummary);
 }
 if(c){const run=runFor(c.id,c.startingWeapon);const passive=run.passive==='reload-secondary'?'开局和每次装填后的首齐射多1颗副弹，伤害为主弹75%。':run.passive==='chill'?'主弹首次命中敌人累积寒意，层数减速；三层冻结0.75秒，解冻后3秒保护。':'初始1只星灵，每1.5秒攻击附近敌人一次，每发6伤害。';return {title:c.name+' · '+c.breed,body:`<div class="detail-art">${catArt(c)}</div>${badge(m.unlocked.indexOf(c.id)>=0?'已开放':'锁定')}${stat('优势',c.strength)}${stat('短板',c.tradeoff)}<h2>专属能力</h2><p>${esc(ctx.sample?c.playerPassive:passiveSummary(run))}</p><h2>固定自带武器</h2><p>${esc(d.weapons.find((x:any)=>x.id===c.startingWeapon).name)}</p><p>${esc(m.reviewEnabled?c.unlock:m.unlocked.indexOf(c.id)>=0?'当前可出战':'后续版本开放；本次体验暂不可出战。')}</p>${ctx.sample?notice(c.balanceStatus):notice(`P2试玩初值：生命${run.maxHp}、移速${run.moveSpeed}、主弹伤害×${run.directDamageMultiplier}。${passive}尚待试玩校准。`)}`,footer:button('close','关闭详情','primary')};
 }
 if(w){const run=runFor(w.ownerCat,w.id),weapon=run.weapon;return {title:w.name,body:`<div class="detail-weapon">${weaponIcon(w.id)}</div><p>${esc(d.cats.find((c:any)=>c.id===w.ownerCat).name)}的固定自带武器，随角色开放。</p><p>${esc(ctx.sample?w.description:'沿自动攻击方向发射，每齐射只消耗1发；弹匣打空立即装填，期间仍可移动。'+(weapon.extraPierce?'穿透最多命中3个不同实体，伤害依次乘1、0.7、0.49。':'弹丸不穿透。'))}</p><p>${esc(w.themeNote)}</p>${ctx.sample?notice(w.numericStatus):notice(`P2试玩初值：单弹${weapon.damage}、弹匣${weapon.ammoCapacity}、间隔${Number(weapon.intervalSeconds.toFixed(3))}秒、自动装填${weapon.reloadSeconds}秒；每齐射${weapon.pellets}主弹，额外穿透${weapon.extraPierce}。固定配对实际伤害乘角色修正，尚待试玩校准。`)}`,footer:button('close','关闭详情','primary')};
 }
 if(u)return {title:u.name,body:`${assetImage((u.tree||'SUMMON')+'.svg','large-icon')}<p>${esc(u.playerEffect)}</p><h2>${u.id.startsWith('S')?'自动协同前置':'全部前置'}</h2>${u.requires_all.length?u.requires_all.map((id:string)=>{const r=d.upgrades.find((x:any)=>x.id===id);return `<article class="card"><strong>${esc(r?.name||id)}</strong>${button('detail:'+id,'查看前置','small-button')}</article>`}).join(''):'<p>根节点，无前置。</p>'}${u.id.startsWith('S')?notice('取得两项指定终结节点后自动激活，不占随机选择。'):notice('收益与代价是设计起始参数，仍待真实试玩校准。')}`,footer:button('close','关闭，返回原位置','primary')};
 return {title:'内容不可用',body:notice('此内容不在首版池中。','danger'),footer:button('close','返回原入口')};
}

