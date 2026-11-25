import type {RewardReceipt} from './reward-receipt';
import {assetImage,catArt,esc} from './components';
import {orbitStats} from '../progression';
import {growthComparison} from './progression';

export function rewardReceiptView(r:RewardReceipt,cat:any){
 const key=r.runId+'.'+r.offerId;
 const intro={attribute:'力量又积累了一点',core:'新的能力，加入战斗',rank:'你的能力，正在成形',evolution:'进阶已取得',tradeoff:'你选择了自己的打法',elite:'这一战，值得收获'}[r.mode];
 const count=r.cardId==='L1_ORBIT_BELL'?orbitStats(r.rankAfter,0).count:0;
 const orbit=count?`<div class="n1-orbit-demo">${catArt(cat)}${Array.from({length:count},(_,i)=>`<span class="n1-orbit-symbol bell-${i}" aria-hidden="true">${assetImage('BALL.svg')}</span>`).join('')}<small>${count}枚飞铃 · 能力示意</small></div>`:'';
 const healed=r.healing.actual>0?`<div class="n1-receipt-heal"><strong>生命 +${Number(r.healing.actual.toFixed(3))}</strong><span>${Number(r.healing.before.toFixed(3))} → ${Number(r.healing.after.toFixed(3))} / ${r.healing.max}</span></div>`:r.mode==='elite'?'<p class="n1-receipt-noheal">生命已满 · 本次实际恢复0</p>':'';
 return {courtyardUI:true,growthUI:true,title:'已经取得',body:`<section class="n1-receipt is-${r.mode}" data-receipt-key="${key}" data-receipt-card="${r.cardId}" style="--n1-acquire-ms:${r.durationMs}ms"><span class="n1-receipt-intro">${intro}</span><div class="n1-receipt-icon">${assetImage(r.icon)}</div><h2>${esc(r.name)}</h2>${orbit}<p class="n1-receipt-benefit">${esc(r.benefit)}</p><p class="n1-receipt-change">${esc(growthComparison(r.change))}</p>${r.mode==='attribute'||r.mode==='rank'?`<p class="n1-receipt-rank">${r.mode==='rank'?'Lv.':'第'}${r.rankBefore} → ${r.mode==='rank'?'Lv.':'第'}${r.rankAfter}${r.mode==='attribute'?'次':''}</p>`:''}${r.cost?`<p class="n1-receipt-cost">${esc(r.cost)}</p>`:''}${healed}<span class="n1-receipt-progress" aria-hidden="true"></span></section>`,footer:`<p class="n1-receipt-foot">已取得 · 仅本局生效</p><button type="button" class="btn n1-receipt-skip" data-action="receipt-skip:${key}">继续守护</button>`};
}
