import type {RunConfig} from '../combat-config';
import {NavigationModel} from './model';
import type {BattleSnapshot} from '../battle';
import {growthBuild} from './progression';
import {catArt,weaponIcon,esc} from './components';
import {courtyardButton,courtyardHeader,courtyardTabs,courtyardStat,courtyardBadge,courtyardNotice} from './courtyard-components';

const number=(n:number)=>Number(n.toFixed(3));
const sessionNote='<p class="court-session-note">内部试玩：三猫临时开放，不保存进度</p>';
const card=(body:string,kind='')=>`<article class="court-card ${kind}"><div class="court-card-surface"><div class="court-card-inner">${body}</div></div></article>`;
const weaponLine=(weapon:any)=>`<span class="court-fixed-weapon">${weaponIcon(weapon.id)}<span>${esc(weapon.name)}</span></span>`;
const detailButton=(id:string,name:string)=>`<button type="button" class="court-card-detail" data-action="detail:${esc(id)}" aria-label="查看${esc(name)}详情"><span aria-hidden="true">›</span><span class="court-detail-label">详情</span></button>`;

export function courtyardResult(m:NavigationModel,d:any,probe:BattleSnapshot){
 const cat=d.cats.find((c:any)=>c.id===probe.catId),weapon=d.weapons.find((w:any)=>w.id===probe.weaponId),g=probe.progression;
 const won=probe.result==='cleared'||probe.result==='survived',seconds=Math.floor(probe.elapsed),duration=Math.floor(probe.durationSeconds);
 const title=won?'守护成功！':probe.result==='timeout'?'守护时间用尽了':'这次，先休息一下';
 const subtitle=probe.result==='cleared'?'已击败雾壳巨兽，庭院迎来新的清晨':probe.result==='survived'?'已完成'+duration+'秒守护':probe.result==='timeout'?'未能在'+duration+'秒内击败雾壳巨兽':'整理装备，再来守护庭院';
 const time=Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');
 return {courtyardUI:true,resultUI:true,body:`<div class="court-result" data-result="${esc(probe.result)}" data-result-seconds="${seconds}">${card(`<h1>${title}</h1><p>${subtitle}</p>`,'court-result-heading')}<div class="court-result-cat">${catArt(cat)}</div>${card(`<div class="court-result-stats"><div><strong>${time}</strong><span>有效时长</span></div><div><strong>${probe.kills}</strong><span>击退</span></div><div><strong>${g?.level??1}</strong><span>等级</span></div></div><div class="court-result-pair"><strong>${esc(cat.name)}</strong>${weaponLine(weapon)}</div>`,'court-result-summary')}<section class="court-result-build"><div class="court-result-build-head"><h2>本局回顾</h2>${g?courtyardButton('build','查看构筑',{kind:'quiet'}):''}</div>${g?growthBuild(g,m.run??undefined,{courtyard:true}):courtyardNotice('本次没有取得成长。')}</section></div>`,footer:`<div class="court-result-actions">${courtyardButton('restart','再守护一次',{kind:'gold'})}${courtyardButton('home','返回庭院')}</div>${sessionNote}`};
}

const selectionRoles:Record<string,string>={
 CAT01:'机动 · 装填爆发', CAT02:'穿透 · 寒意控场', CAT03:'近身散射 · 星灵协作'
};
export function courtyardSelection(m:NavigationModel,d:any){
 const selected=d.cats.find((cat:any)=>cat.id===m.draft.cat);
 const previewWeapon=selected&&d.weapons.find((weapon:any)=>weapon.id===selected.startingWeapon);
 const valid=!!previewWeapon&&m.unlocked.includes(selected.id)&&previewWeapon.id===m.draft.weapon;
 const entries=d.cats.map((cat:any)=>{
  const open=m.unlocked.includes(cat.id),chosen=m.draft.cat===cat.id,committed=m.committed.cat===cat.id;
  const weapon=d.weapons.find((item:any)=>item.id===cat.startingWeapon);
  const state=!open?'尚未开放':committed?'当前出战':chosen?'已选':'';
  return `<button type="button" class="court-select-cat" data-action="choose:${esc(cat.id)}" aria-pressed="${chosen}"${open?'':' disabled'}><span class="loadout-portrait" data-cat="${esc(cat.id)}" aria-hidden="true">${catArt(cat,true)}</span><span class="court-select-copy"><strong>${esc(cat.name)}</strong><span>${esc(weapon.name)}</span><small>${esc(selectionRoles[cat.id])}</small></span>${state?`<span class="court-select-state${chosen&&!committed&&open?' is-preview':''}">${state}</span>`:''}</button>`;
 }).join('');
 const detail=previewWeapon?`<button type="button" class="court-select-weapon" data-action="detail:${esc(previewWeapon.id)}" aria-label="查看${esc(previewWeapon.name)}武器详情"><strong>${esc(previewWeapon.name)}</strong><span aria-hidden="true">武器详情 ›</span></button>`:'';
 return {courtyardUI:true,body:courtyardHeader('选择猫咪','cancel-select','每只猫带着自己的武器')+`<div class="court-select-list">${entries}</div>`+detail+(!valid?courtyardNotice('当前配对不可出战，请选择已开放的猫咪。','error'):''),
  footer:`<div class="court-select-footer"><p>确认后返回庭院</p><div class="court-actions">${courtyardButton('cancel-select','取消')}${courtyardButton('confirm-select','确认选择',{kind:'gold',disabled:!valid})}</div></div>`};
}

export function courtyardBook(m:NavigationModel,d:any,context:Record<string,any>){
 const category=context.category==='武器'?'武器':'猫咪';
 const entries=category==='猫咪'?d.cats.map((cat:any)=>{
  const weapon=d.weapons.find((w:any)=>w.id===cat.startingWeapon);
  return card(`<div class="court-book-row"><span class="court-portrait">${catArt(cat,true)}</span><div class="court-cat-copy"><h2>${esc(cat.name)}</h2><p>${esc(cat.strength)}</p>${weaponLine(weapon)}<span class="court-book-hint">查看能力与属性</span></div></div>${detailButton(cat.id,cat.name)}`);
 }).join(''):d.weapons.map((weapon:any)=>{
  const owner=d.cats.find((c:any)=>c.id===weapon.ownerCat);
  return card(`<div class="court-book-row"><span class="court-weapon-portrait">${weaponIcon(weapon.id)}</span><div class="court-cat-copy"><h2>${esc(weapon.name)}</h2><p>${esc(owner.name)}固定自带</p><span class="court-book-hint">查看射程与攻击规则</span></div></div>${detailButton(weapon.id,weapon.name)}`);
 }).join('');
 return {courtyardUI:true,body:courtyardHeader('庭院图鉴','back','认识伙伴，了解每一种能力')+courtyardTabs([{value:'猫咪',label:'猫咪'},{value:'武器',label:'武器'}],category,'category')+`<div class="court-roster">${entries}</div><p class="court-book-note">图鉴只供浏览，不购买或领取奖励</p>`,footer:courtyardButton('back','返回庭院')+sessionNote};
}

function passiveDetails(run:RunConfig){
 if(run.openingPower)return `强化时每颗主弹伤害 ×${number(run.openingPower.multiplier)}。装填类成长的副弹仍独立生效。`;
 if(run.spiritMark)return `星灵基础每${number(run.spirit.intervalSeconds)}秒射击一次，每发${number(run.spirit.damage)}伤害。星印持续${run.spiritMark.seconds}秒，主弹触发一次追加伙伴伤害，基础${number(run.spirit.damage*run.spiritMark.multiplier)}点。`;
 if(run.passive==='reload-secondary')return `副弹伤害为当前单颗主弹的${number(run.secondary.damageMultiplier*100)}%；不穿透、不暴击、不累积寒意。`;
 if(run.passive==='chill')return `主弹首次命中按攻击节奏累积寒意。普通敌人每层减速${number(run.chill.slowPerLayer*100)}%，持续${number(run.chill.layerDurationSeconds)}秒；最多${run.chill.maxLayers}层，满层冻结${number(run.chill.freezeSeconds)}秒，解冻后${number(run.chill.protectionSeconds)}秒不再累积。巨兽仅减速与短暂迟缓，不会硬冻结或打断招式。`;
 if(run.passive==='spirit')return `星灵每${number(run.spirit.intervalSeconds)}秒攻击一次，每发${number(run.spirit.damage)}伤害，索敌${number(run.spirit.targetRange)}u，不消耗主弹药。`;
 return '';
}

export function courtyardDetail(m:NavigationModel,d:any,run:RunConfig,summary:(run:RunConfig)=>string){
 const id=m.current.context.contentId||run.catId,cat=d.cats.find((c:any)=>c.id===id),weapon=d.weapons.find((w:any)=>w.id===(cat?cat.startingWeapon:id));
 const current=m.run?.catId===run.catId&&m.run?.weaponId===run.weaponId;
 const source=courtyardBadge(current?'本局属性':'起始属性');
 if(cat)return {courtyardUI:true,title:'猫咪详情',body:card(`<div class="court-detail-hero"><div class="court-detail-cat">${catArt(cat)}</div><h2>${esc(cat.name)}</h2><p>${esc(cat.breed)} · ${esc(cat.strength)}</p>${source}${courtyardBadge(m.unlocked.includes(cat.id)?'可出战':'锁定',m.unlocked.includes(cat.id)?'selected':'locked')}</div><div class="court-detail-stats">${courtyardStat('生命上限',run.maxHp)}${courtyardStat('移速',number(run.moveSpeed)+'u/s')}${courtyardStat('优势',cat.strength)}${courtyardStat('短板',cat.tradeoff)}</div><section class="court-detail-section"><h3>专属能力</h3><p>${esc(summary(run))}</p><p>${esc(passiveDetails(run))}</p></section><section class="court-detail-section"><h3>固定自带武器</h3>${weaponLine(weapon)}<p>随猫咪固定携带，在出战页确认猫咪后整体生效。</p>${courtyardButton('detail:'+weapon.id,'查看武器规则',{kind:'quiet'})}</section>`,'court-detail-card'),footer:courtyardButton('close','关闭详情')};
 const w=run.weapon;
 return {courtyardUI:true,title:'武器详情',body:card(`<div class="court-detail-hero"><div class="court-detail-weapon">${weaponIcon(weapon.id)}</div><h2>${esc(weapon.name)}</h2><p>${esc(d.cats.find((c:any)=>c.id===weapon.ownerCat).name)}的固定自带武器</p>${source}</div><div class="court-detail-stats">${courtyardStat('单颗主弹',number(w.damage*run.directDamageMultiplier)+'伤害')}${courtyardStat('武器单颗伤害',number(w.damage))}${courtyardStat('角色直接伤害','×'+number(run.directDamageMultiplier))}${courtyardStat('索敌射程',number(w.targetRange)+'u')}${courtyardStat('射击方式',w.pellets+'颗'+(w.pellets>1?'散射':'直射')+' / 齐射')}${courtyardStat('自动齐射','间隔'+number(w.intervalSeconds)+'秒')}${courtyardStat('弹匣',w.ammoCapacity+'发')}${courtyardStat('自动装填',number(w.reloadSeconds)+'秒')}${courtyardStat('总散角',number(w.spreadDegrees)+'°')}</div><section class="court-detail-section"><h3>攻击规则</h3><p>自动寻找射程内最近敌人；每次齐射消耗1发，无目标时停火。最后一发后自动装填，期间仍可移动。</p><p>${esc(w.extraPierce?`每颗主弹最多连续穿透命中${w.extraPierce+1}个不同实体，逐敌伤害乘${number(w.pierceDamageMultiplier)}；其他命中效果按已取得的弹道能力结算。`:'基础主弹不穿透；其他命中效果按已取得的弹道能力结算。')}</p><p>${esc(w.pellets>1?`每次齐射${w.pellets}颗主弹，总散角${number(w.spreadDegrees)}°；各颗独立命中，不保证全部命中同一敌人。`:'主弹沿自动攻击方向直射。')}</p><p>射程表示自动索敌距离；弹丸按自身速度与寿命飞行。</p></section>`,'court-detail-card'),footer:courtyardButton('close','关闭详情')};
}
