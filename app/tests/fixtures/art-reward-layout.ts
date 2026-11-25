// Controlled DOM layout fixture only. Does not boot a battle or apply rewards.
import {makeRunConfig,type CatId} from '../../src/combat-config';
import {courtyardRunConfig} from '../../src/level-config';
import {GROWTH_CARDS,RunGrowth,type GrowthId,type GrowthRanks} from '../../src/progression';
import {growthPage,growthDetail} from '../../src/ui/progression';
import {drawUIAssets,registerUIAsset} from '../../src/ui/assets';

const win=window as any;
const pairs={CAT01:'W01',CAT02:'W04',CAT03:'W02'} as const;
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
function render(cat:CatId,choices:GrowthId[],selected?:GrowthId,source:'experience'|'elite'='experience',pending=1,ranks:GrowthRanks=zero,detail?:GrowthId){
 const base={...courtyardRunConfig(makeRunConfig(cat,pairs[cat],'p2-basic')),projectileTraits:{enabled:true as const},projectileFlight:{enabled:true as const}};
 const snapshot={...new RunGrowth(91,()=>0,base).snapshot(),ranks:{...ranks},pending,offer:{id:5,choices:choices.slice(),source}};
 const detailPage=detail?growthDetail(detail,snapshot,base):null;
 const page=detailPage||growthPage(snapshot,base,selected);
 document.getElementById('modal-title')!.textContent=detailPage?.title||'升级啦！';
 document.getElementById('modal-scroll')!.innerHTML=page.body;
 document.getElementById('modal-footer')!.innerHTML=page.footer;
 document.getElementById('modal-scroll')!.scrollTop=0;
 drawUIAssets(document);
 return {cat,choices,source,pending,ranks,scope:'CONTROLLED_SNAPSHOT_LAYOUT_NOT_NATURAL_GROWTH_OR_REAL_TRANSACTION'};
}
win.renderArtReward=render;
win.artRewardIds=GROWTH_CARDS.map(c=>c.id);
Promise.all(Array.from(new Set(GROWTH_CARDS.map(c=>c.icon))).map(name=>new Promise<void>((resolve,reject)=>{
 const image=new Image();image.onload=()=>{try{registerUIAsset(name,image);resolve();}catch(error){reject(error);}};image.onerror=()=>reject(new Error('fixture icon '+name));image.src='./assets/ui/'+name;
}))).then(()=>{render('CAT01',['L1_SPLIT','L1_RELOAD','L1_RATE']);win.artRewardReady=true;}).catch(error=>{win.artRewardError=String(error);throw error;});
