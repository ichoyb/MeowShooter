// Isolated visual samples. Never imported by the actual player entry.
import {makeRunConfig,fixedWeaponId} from '../../src/combat-config';
import {courtyardRunConfig} from '../../src/level-config';
import {RunGrowth,growthRoutes,growthCombinations,projectileTraitStats,experienceNeeded,GROWTH_CARDS,GROWTH_COMBINATIONS,type GrowthSnapshot,type GrowthRanks,type GrowthId} from '../../src/progression';
import {growthPage,growthBuild,growthDetail,nextGrowthMotion} from '../../src/ui/progression';
import {registerUIAsset,drawUIAssets} from '../../src/ui/assets';
import {ImageBudget} from '../../src/image-budget';

type View={kind:'offer'|'build'|'detail';id?:string;source?:'offer'|'owned';scroll:number};
const $=(id:string)=>document.getElementById(id)!;
const choices:Record<string,GrowthId[]>={three:['L1_SPLIT','L1_LIGHT_MAG','M31'],two:['L1_SPLIT','L1_HEART'],one:['L1_DAMAGE'],elite:['L1_SPLIT','L1_LIGHT_MAG','L1_RATE'],queue:['L1_SPLIT','L1_LIGHT_MAG','L1_MOVE'],evolution:['L1_EVO_BARRAGE','L1_EVO_PIERCE','L1_HEART'],combination:['L1_DUO_STAR_RING','L1_DUO_TRAIL_CADENCE','L1_MOVE'],critical:['A11','A12','L1_DAMAGE'],orbit:['L1_ORBIT_BELL','L1_RATE','L1_DAMAGE']};
let cat='CAT01',scenario='three',serial=0,selected:string|undefined,views:View[]=[],motion:ReturnType<typeof nextGrowthMotion>|undefined,confirmed='';
const base=()=>courtyardRunConfig({...makeRunConfig(cat,fixedWeaponId(cat),'p2-basic'),projectileTraits:{enabled:true}});
function sample():GrowthSnapshot {
 const run=base(),empty=new RunGrowth(900+serial,()=>.1,run).snapshot(),ranks:GrowthRanks={L1_DAMAGE:2,L1_RATE:1,L1_HEART:0,L1_ECHO:1,C23:1};
 if(['evolution','combination'].includes(scenario)){Object.assign(ranks,{L1_SPLIT:1,L1_PIERCE:1,L1_RATE:2,L1_RANGE:2,L1_RELOAD:2});}
 if(scenario==='combination')for(const combination of GROWTH_COMBINATIONS)for(const id of combination.requires)ranks[id]=Math.max(1,ranks[id]||0);
 if(scenario==='critical')Object.assign(ranks,{A11:5,A12:3});
 if(scenario==='orbit')ranks.L1_ORBIT_BELL=2;
 if(scenario==='build')Object.assign(ranks,{L1_DAMAGE:5,L1_RATE:4,L1_HEART:3,L1_MOVE:2,L1_RANGE:2,L1_RELOAD:2,L1_SPLIT:1,L1_PIERCE:1,L1_EVO_PIERCE:1,L1_LIGHT_MAG:1,L1_RICOCHET:1,L1_ORBIT_BELL:3,L1_TRAIL_BELL:1,L1_PICKUP_CHIME:1,L1_DUO_STAR_RING:1,A11:4,A12:2,M31:1,E21:1});
 if(scenario==='empty')Object.keys(ranks).forEach(id=>delete ranks[id as GrowthId]);
 const hasOffer=!['build','empty'].includes(scenario),level=scenario==='build'?26:8;
 return {...empty,level,totalXP:scenario==='build'?690:88,xp:3,nextXP:experienceNeeded(level,28),ranks,projectileTraits:projectileTraitStats(run,ranks),routes:growthRoutes(ranks),combinations:growthCombinations(ranks),pending:scenario==='queue'?3:hasOffer?1:0,offer:hasOffer?{id:100+serial,choices:choices[scenario],source:scenario==='elite'?'elite':'experience',...(scenario==='elite'?{encounterId:'sample-elite-2',birthId:2}:{})}:null,eliteRewards:scenario==='build'?[{offerId:70,encounterId:'sample-elite-1',birthId:1,cardId:'L1_RATE',recovered:9}]:[]};
}
let g=sample();
function reset(){serial++;selected=undefined;confirmed='';g=sample();views=[{kind:scenario==='build'||scenario==='empty'?'build':'offer',scroll:0}];motion=undefined;render();}
function render(){
 const v=views[views.length-1],run=base();let body='',footer='',title='选择一项成长';
 const nextMotion=nextGrowthMotion(motion?.state,g,selected,v.kind==='offer'&&!document.hidden&&!$('app').classList.contains('low-quality'));motion=nextMotion;
 if(v.kind==='offer'){const p=growthPage(g,run,selected,{courtyard:true,motion:nextMotion});body=p.body;footer=p.footer;title=g.offer?.source==='elite'?'精英战利品':'选择一项成长';}
 if(v.kind==='build'){body=growthBuild(g,run,{courtyard:true});footer='<button class="btn court-button" data-action="close">返回原位置</button>';title='本局构筑';}
 if(v.kind==='detail'){const p=growthDetail(v.id!,g,run,{courtyard:true,source:v.source});body=p.body;footer=p.footer;title=p.title;}
 $('modal').className='overlay courtyard-detail'+(v.kind==='offer'?' growth-modal courtyard-growth':'');$('modal-title').textContent=title;$('modal-scroll').innerHTML=body;$('modal-footer').innerHTML=footer;$('modal-scroll').scrollTop=v.scroll;drawUIAssets($('app'));
 $('fixture-status').textContent=confirmed||'示例数据 · 不发真实奖励，不修改正常游戏';
 $('app').dataset.sample=JSON.stringify({cat,scenario,view:v.kind,selected,offer:g.offer,pending:g.pending,ranks:g.ranks,motion});
}
document.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');if(!b||b.disabled)return;views[views.length-1].scroll=$('modal-scroll').scrollTop;const [action,...rest]=b.dataset.action!.split(':'),arg=rest.join(':');
 if(action==='growth-select')selected=arg.split('.').pop();
 if(action==='growth-detail'||action==='growth-owned-detail')views.push({kind:'detail',id:arg,source:action==='growth-owned-detail'||views[views.length-1].kind==='build'?'owned':'offer',scroll:0});
 if(action==='build')views.push({kind:'build',scroll:0});
 if(action==='settings'){confirmed='示例数据：画质可用上方控件调整；真实游戏设置按原入口返回。';}
 if(action==='close'){if(views.length>1)views.pop();else{reset();return;}}
 if(action==='growth-confirm'){
  if(!selected||!g.offer?.choices.includes(selected as GrowthId))return;
  confirmed='示例确认：'+(GROWTH_CARDS.find(c=>c.id===selected)?.name||selected)+'；没有向正常游戏发放奖励。';
  if(scenario==='queue'&&g.pending>1){g={...g,pending:g.pending-1,offer:{...g.offer,id:g.offer.id+1}};selected=undefined;views[0].scroll=0;}
 }
 render();
});
$('fixture-case').addEventListener('change',event=>{scenario=(event.target as HTMLSelectElement).value;reset();});
$('fixture-cat').addEventListener('change',event=>{cat=(event.target as HTMLSelectElement).value;reset();});
$('fixture-quality').addEventListener('change',event=>{$('app').classList.toggle('low-quality',(event.target as HTMLSelectElement).value==='low');render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){$('app').classList.add('reward-motion-suspended');}else{$('app').classList.remove('reward-motion-suspended');render();}});
window.addEventListener('resize',()=>drawUIAssets($('app')));
const budget=new ImageBudget(5*1024*1024);
Promise.all([...new Set(GROWTH_CARDS.map(c=>c.icon))].map(name=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{registerUIAsset(name,image,budget);resolve();};image.onerror=()=>reject(Error('Fixture icon failed:'+name));image.src='./assets/ui/'+name;}))).then(()=>{reset();$('app').dataset.ready='true';}).catch(error=>{$('fixture-status').textContent='示例加载失败：'+String(error);});
