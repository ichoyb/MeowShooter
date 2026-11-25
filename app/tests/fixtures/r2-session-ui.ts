// Independent UI examples; never imported by the normal game entry.
// The model and renderers are shared, while every terminal number is marked as example data.
import data from '../../src/ui/content.generated.json';
import {NavigationModel} from '../../src/ui/model';
import {renderPage} from '../../src/ui/pages';
import {renderLayer} from '../../src/ui/layers';
import {hudMarkup} from '../../src/ui/hud';
import {makeRunConfig,fixedWeaponId} from '../../src/combat-config';
import {courtyardRunConfig} from '../../src/level-config';
import {RunGrowth,growthRoutes,growthCombinations,projectileTraitStats,GROWTH_CARDS,type GrowthSnapshot,type GrowthRanks} from '../../src/progression';
import {registerUIAsset,drawUIAssets} from '../../src/ui/assets';
import mappings from '../../src/r1-art/ui-mappings.json';
import {ImageBudget} from '../../src/image-budget';
import {createModalFocus} from '../../src/ui/modal-accessibility';
import {bindActionInput} from '../../src/ui/action-input';
import {loadSessionBackdrop,drawSessionBackdrop} from './r2-session-backdrop';

const $=(id:string)=>document.getElementById(id)!;
const m=new NavigationModel(false,true),focus=createModalFocus($('modal'));
const params=new URLSearchParams(location.search);
let scene=params.get('scene')||'pause',cat='CAT01',outcome='cleared',build='short',elite=0,serial=900;
let probe:any,g:GrowthSnapshot;
const audio={ready:true,error:'',held:false,contextState:'running',settings:{music:true,effects:true,musicVolume:.65,effectsVolume:.65}};
function sampleGrowth():GrowthSnapshot {
 const empty=new RunGrowth(++serial,()=>.1,m.run!).snapshot();
 const ranks:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
 if(build!=='empty')Object.assign(ranks,{L1_DAMAGE:4,L1_RATE:1,L1_ORBIT_BELL:2,L1_ECHO:1});
 if(build==='long')for(const c of GROWTH_CARDS.filter(c=>!['A15','M05','M09','C18','M26','M12','E23'].includes(c.id)))ranks[c.id]=c.kind==='attribute'?4:c.id==='L1_ORBIT_BELL'?3:1;
 return {...empty,level:build==='empty'?1:build==='long'?28:13,totalXP:build==='empty'?0:build==='long'?690:173,ranks,routes:growthRoutes(ranks),combinations:growthCombinations(ranks),projectileTraits:projectileTraitStats(m.run!,ranks),eliteRewards:[{offerId:71,encounterId:'sample-elite-150',birthId:1,cardId:'L1_RATE' as const,recovered:0},{offerId:72,encounterId:'sample-elite-300',birthId:2,cardId:'L1_DAMAGE' as const,recovered:6.5}].slice(0,elite)};
}
function reset(){
 m.layers=[];m.committed={cat,weapon:fixedWeaponId(cat)};m.beginSelection();m.run=courtyardRunConfig(m.beginRun());g=sampleGrowth();
 probe={catId:cat,weaponId:m.run.weaponId,result:outcome,elapsed:outcome==='death'?47.9:outcome==='timeout'?600:outcome==='survived'?120:519.8,kills:outcome==='death'?36:outcome==='timeout'?422:348,durationSeconds:600,hp:80,maxHp:m.run.maxHp,ammo:6,ammoCapacity:m.run.weapon.ammoCapacity,reloadLeft:0,reloadSeconds:m.run.weapon.reloadSeconds,progression:g};
 if(scene==='result')m.openPage('PAGE-08-S02',{actual:true,firstLevel:true},false);
 else if(scene==='settings'){m.openPage('PAGE-02-S01',{firstLevel:true},false);m.openLayer('LAYER-01-S02',{returnLabel:'返回庭院'});}
 else {m.openPage('PAGE-06-S01',{actual:true,firstLevel:true},false);
  if(scene==='waiting'){g={...g,pending:1,offer:{id:73,source:'experience',choices:['L1_DAMAGE','L1_RATE','L1_HEART']}};probe.progression=g;m.openLayer('PAGE-07-S01',{actual:true,runId:g.runId,offerId:73,selected:'L1_RATE'});}
  m.openLayer(scene==='background'||scene==='waiting'?'LAYER-02-S03':'LAYER-02-S01',{interrupted:scene!=='pause',waitReturn:scene==='waiting'});
 }
 render();
}
function recordSample(){
 $('app').dataset.sample=JSON.stringify({scene,cat,outcome,build,elite,frame:m.current.frame,layers:m.layers.map(v=>v.frame),settings:m.settings,audio,progression:g});
}
function render(){
 focus.prepare(!!m.layers.length);const parts=renderPage(m,data,probe),battle=m.page.frame.startsWith('PAGE-06');
 $('pages').hidden=battle;$('pages').className='screen'+(parts.courtyardUI?' courtyard-ui':'')+(parts.resultUI?' courtyard-result':'')+(parts.r1Home?' r1-home':'');
 $('page-scroll').innerHTML=parts.body;$('page-footer').innerHTML=parts.footer;$('page-scroll').scrollTop=m.page.scroll;
 $('sample-battle').hidden=!battle;$('hud').hidden=!battle;
 drawSessionBackdrop(m.settings.quality==='低');
 if(battle){$('hud').className='r1-hud';$('hud').innerHTML=hudMarkup(probe,false,1,false,'示例数据',true);}
 $('modal').hidden=!m.layers.length;$('modal').className='overlay';
 if(m.layers.length){const v=m.current;v.context.progression=g;v.context.runtimeAudio=audio;
  const p=v.frame.startsWith('PAGE-')?{title:v.frame.startsWith('PAGE-07')?'升级啦！':'玩法说明',...renderPage(m,data,probe,v)}:renderLayer(m,data);
  if(p.courtyardUI)$('modal').classList.add('courtyard-detail');
  if('sessionUI' in p&&p.sessionUI)$('modal').classList.add('courtyard-session','court-'+p.sessionUI);
  if('growthUI' in p&&p.growthUI)$('modal').classList.add('courtyard-growth');
  $('modal-title').textContent=p.title;$('modal-scroll').innerHTML=p.body;$('modal-footer').innerHTML=p.footer;$('modal-scroll').scrollTop=v.scroll;
  $('modal-close').hidden=v.frame.startsWith('LAYER-02')||v.frame.startsWith('PAGE-07');
 }
 $('app').classList.toggle('low-quality',m.settings.quality==='低');drawUIAssets($('app'));focus.sync(!!m.layers.length,m.layers.length+':'+m.current.frame);
 recordSample();
 for(const b of document.querySelectorAll<HTMLElement>('[data-scene]'))b.setAttribute('aria-pressed',String(b.dataset.scene===(scene==='result'?'result':scene==='settings'?'settings':'pause')));
}
function remember(){m.current.scroll=$(m.layers.length?'modal-scroll':'page-scroll').scrollTop;}
bindActionInput(document,'button[data-action]',button=>{
 if(m.layers.length&&!$('modal').contains(button))return;remember();const value=button.dataset.action!,[action,arg]=value.split(':');
 if(action==='settings')m.openLayer('LAYER-01-S02',{returnLabel:m.current.frame.startsWith('LAYER-02')?'返回暂停':m.current.frame.startsWith('PAGE-07')?'返回成长选择':'返回庭院'});
 if(action==='build')m.openLayer('LAYER-03-S04',{contentId:'build',actual:true});
 if(action==='growth-owned-detail')m.openLayer('LAYER-03-S01',{growthDetail:arg,growthSource:'owned'});
 if(action==='growth-detail')m.openLayer('LAYER-03-S01',{growthDetail:arg,growthSource:'offer'});
 if(action==='help')m.openLayer('PAGE-05-S01');
 if(action==='help-tab')m.current.context.device=arg;
 if(action==='close'||action==='back')m.back();
 if(action==='end')m.openLayer('LAYER-04-S01');
 if(action==='resume'){if(m.current.context.waitReturn)m.closeLayer();else m.layers=[];$('fixture-status').textContent='示例数据 · 已继续；不运行实际战斗';}
 if(action==='pause'){m.openLayer('LAYER-02-S01');}
 if(action==='confirm-end'||action==='home'){m.home();m.page.context.firstLevel=true;$('fixture-status').textContent='示例数据 · 已返回庭院，未发放奖励';}
 if(action==='restart'||action==='start'){build='empty';elite=0;$('fixture-build').querySelectorAll<HTMLOptionElement>('option').forEach(o=>o.selected=o.value===build);($('fixture-elite') as HTMLSelectElement).value='0';scene='pause';reset();$('fixture-status').textContent='示例数据 · 新局为空构筑，保留配对和会话设置';return;}
 if(action==='sound-toggle'&&(arg==='music'||arg==='effects'))audio.settings[arg]=!audio.settings[arg];
 if(action==='sound-enable'){audio.ready=true;audio.error='';audio.contextState='running';$('fixture-status').textContent='示例数据 · 仅演示声音控件，不实际播放';}
 if(action==='growth-select')m.current.context.selected=arg.split('.').pop();
 if(action==='growth-confirm'){$('fixture-status').textContent='示例数据 · 选择演示完成，不发放实际奖励';m.layers=[];}
 render();
});
document.addEventListener('input',event=>{const el=event.target as HTMLInputElement,key=el.dataset.audioVolume;if(key==='musicVolume'||key==='effectsVolume'){audio.settings[key]=Number(el.value)/100;const output=$('modal').querySelector('[data-audio-value="'+key+'"]');if(output)output.textContent=el.value+'%';recordSample();}});
document.addEventListener('change',event=>{const el=event.target as HTMLSelectElement;if(el.id==='quality'){m.settings.quality=el.value;drawSessionBackdrop(el.value==='低');$('app').classList.toggle('low-quality',el.value==='低');recordSample();}if(el.id==='fixture-cat'){cat=el.value;reset();}if(el.id==='fixture-outcome'){outcome=el.value;scene='result';reset();}if(el.id==='fixture-build'){build=el.value;reset();}if(el.id==='fixture-elite'){elite=Number(el.value);reset();}if(el.id==='fixture-pause'){scene=el.value;reset();}});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]'))button.addEventListener('click',()=>{scene=button.dataset.scene!;reset();});
$('fixture-options-toggle').addEventListener('click',()=>{$('fixture-options').hidden=!$('fixture-options').hidden;$('fixture-options-toggle').setAttribute('aria-expanded',String(!$('fixture-options').hidden));});
$('fixture-audio-error').addEventListener('click',()=>{audio.ready=false;audio.error='示例：声音暂不可用';scene='settings';reset();});
window.addEventListener('resize',()=>{drawUIAssets($('app'));drawSessionBackdrop(m.settings.quality==='低');});
const budget=new ImageBudget(5*1024*1024);
Promise.all([...new Set([...GROWTH_CARDS.map(c=>c.icon),'CAT01.png','CAT02.png','CAT03.png','W01.svg','W02.svg','W04.svg'])].map(name=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{registerUIAsset(name,image,budget,mappings[name as keyof typeof mappings]);resolve();};image.onerror=()=>reject(Error('Fixture asset failed:'+name));image.src='./assets/ui/'+name;}))).then(loadSessionBackdrop).then(()=>{reset();$('app').dataset.ready='true';}).catch(error=>{$('fixture-status').textContent='示例加载失败：'+String(error);});
