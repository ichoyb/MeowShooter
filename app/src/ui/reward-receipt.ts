import type {BattleSnapshot} from '../battle';
import type {RunConfig} from '../combat-config';
import {growthCards,growthCardEligible,growthRank,type GrowthId,type GrowthOffer} from '../progression';
import {growthCardSummary,growthChange} from './progression';

export type RewardReceiptMode='attribute'|'core'|'rank'|'evolution'|'tradeoff'|'elite';
export type RewardReceipt=Readonly<{
 runId:number;offerId:number;cardId:GrowthId;name:string;icon:string;
 mode:RewardReceiptMode;durationMs:200|400|650|300|450;
 benefit:string;cost?:string;change:string;rankBefore:number;rankAfter:number;
 healing:Readonly<{before:number;after:number;max:number;actual:number}>;
 source:GrowthOffer['source'];
}>;
const durations={attribute:200,core:400,rank:400,evolution:650,tradeoff:300,elite:450} as const;

// A read-only projection of one successful transaction, not a reward or a
// deduplication store. Reading the same before/after pair returns the same facts.
// The caller invokes this after confirmUpgrade succeeds and owns presentation
// identity/lifecycle using runId + offerId.
export function makeRewardReceipt(before:BattleSnapshot,after:BattleSnapshot,cardId:string,base:RunConfig):RewardReceipt|null {
 const previous=before.progression,current=after.progression,offer=previous?.offer;
 if(!previous||!current||!offer||previous.runId!==current.runId||previous.rulesVersion!==current.rulesVersion||
  before.catId!==base.catId||after.catId!==base.catId||before.weaponId!==base.weaponId||after.weaponId!==base.weaponId||
  current.confirmedPicks!==previous.confirmedPicks+1||!Number.isInteger(offer.id)||offer.id<1||
  current.offer&&current.offer.id<=offer.id)return null;
 const card=growthCards(base).find(card=>card.id===cardId);
 if(!card||!offer.choices.includes(card.id)||!growthCardEligible(card.id,previous.ranks,base,previous.confirmedPicks))return null;
 const rankBefore=growthRank(previous.ranks,card.id),rankAfter=growthRank(current.ranks,card.id);
 if(rankAfter!==rankBefore+1)return null;
 const ids=Object.keys({...previous.ranks,...current.ranks}) as GrowthId[];
 if(ids.some(id=>id!==card.id&&growthRank(previous.ranks,id)!==growthRank(current.ranks,id)))return null;
 if(offer.source==='elite'){
  const reward=current.eliteRewards[current.eliteRewards.length-1];
  if(current.eliteRewards.length!==previous.eliteRewards.length+1||!reward||reward.offerId!==offer.id||
   reward.cardId!==card.id||reward.encounterId!==offer.encounterId||reward.birthId!==offer.birthId)return null;
 }
 const mode:RewardReceiptMode=offer.source==='elite'?'elite':card.kind==='attribute'?'attribute':card.kind==='tradeoff'?'tradeoff':
  card.kind==='evolution'||card.kind==='combination'?'evolution':card.id==='L1_ORBIT_BELL'&&rankBefore>0?'rank':'core';
 const summary=growthCardSummary(card.id,previous,base);
 return Object.freeze({runId:previous.runId,offerId:offer.id,cardId:card.id,name:card.name,icon:card.icon,mode,durationMs:durations[mode],
  benefit:summary.benefit,cost:summary.cost,change:growthChange(card.id,previous,base),rankBefore,rankAfter,source:offer.source,
  // Includes any HP actually granted by this card (e.g. heart growth). The
  // elite log's recovered field only counts healing after growth was applied.
  healing:Object.freeze({before:before.hp,after:after.hp,max:after.maxHp,actual:Math.max(0,after.hp-before.hp)})});
}
