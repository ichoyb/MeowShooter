import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/ui/content.generated.json';
import {NavigationModel} from '../src/ui/model';
import {renderPage} from '../src/ui/pages';
import {renderLayer} from '../src/ui/layers';
import {makeRunConfig} from '../src/combat-config';
import {courtyardRunConfig,courtyardBalanceRunConfig} from '../src/level-config';
import {deriveGrowthConfig,RunGrowth,growthRoutes,growthCombinations,type GrowthSnapshot} from '../src/progression';

const text=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const number=(n:number)=>Number(n.toFixed(3));
function courtyard(){const m=new NavigationModel(false,true);m.page.context.firstLevel=true;return m;}
function page(m:NavigationModel,frame='PAGE-03-S01',context:Record<string,any>={}){
 m.openPage(frame,{firstLevel:true,...context});return renderPage(m,data,null);
}
function independentButtons(html:string){
 let depth=0;for(const match of html.matchAll(/<\/?button\b[^>]*>/g)){
  depth+=match[0].startsWith('</')?-1:1;assert(depth>=0&&depth<=1,'buttons must not nest');
 }assert.equal(depth,0);
}

test('R2 selection exposes real draft selection and confirms the complete fixed pair only',()=>{
 const m=courtyard();m.beginSelection();let p=page(m);
 assert.equal((p as any).courtyardUI,true);
 for(const cat of data.cats){assert.match(p.body,new RegExp('data-action="choose:'+cat.id+'"'));}
 assert.match(p.body,/data-action="choose:CAT01"[^>]*aria-pressed="true"/);
 m.previewCat('CAT02');p=renderPage(m,data,null);
 assert.match(p.body,/data-action="choose:CAT02"[^>]*aria-pressed="true"/);
 assert.match(p.body,/data-action="choose:CAT01"[^>]*aria-pressed="false"[^>]*>[\s\S]*?当前出战<\/span><\/button>/);
 assert.match(p.body,/data-action="choose:CAT02"[^>]*aria-pressed="true"[^>]*>[\s\S]*?已选<\/span><\/button>/);
 assert.match(p.footer,/确认后返回庭院.*确认选择/);
 assert.deepEqual(m.committed,{cat:'CAT01',weapon:'W01'});
 assert.deepEqual(m.draft,{cat:'CAT02',weapon:'W04'});
 m.cancelSelection();assert.deepEqual(m.draft,m.committed);
 m.beginSelection();m.previewCat('CAT03');assert.equal(m.confirmSelection(),true);
 assert.deepEqual(m.committed,{cat:'CAT03',weapon:'W02'});
 independentButtons(p.body+p.footer);
});

test('R2 selection shows an independent detail action for the previewed weapon',()=>{
 const m=courtyard();m.beginSelection();m.previewCat('CAT02');const before={...m.draft};
 const p=page(m);
 assert.equal((p as any).courtyardUI,true);
 assert.match(p.body,/data-action="detail:W04"[^>]*>[\s\S]*?武器详情/);
 assert.doesNotMatch(p.body,/data-action="(?:select-tab:|detail:W01|detail:W02)/);
 m.openLayer('LAYER-03-S01',{contentId:'W04'});renderLayer(m,data);m.closeLayer();
 assert.deepEqual(m.draft,before);assert.deepEqual(m.committed,{cat:'CAT01',weapon:'W01'});independentButtons(p.body+p.footer);
});

test('R2 theme stays outside release, review, samples and unrelated pages or layers',()=>{
 for(const m of [new NavigationModel(),new NavigationModel(true,false),new NavigationModel(true,true)]){
  assert.equal((page(m) as any).courtyardUI,undefined);
  m.openLayer('LAYER-03-S01',{contentId:'W04'});const p=renderLayer(m,data);
  assert.equal(p.courtyardUI,undefined);assert.match(text(p.body),/P2试玩初值：单弹32/);
 }
 const m=courtyard();assert.equal((page(m,'PAGE-03-S01',{sample:true}) as any).courtyardUI,undefined);
 m.openLayer('LAYER-03-S01',{contentId:'W04',sample:true});const sample=renderLayer(m,data);
 assert.equal(sample.courtyardUI,undefined);assert.match(text(sample.body),/每颗伤害32/);
 page(m,'PAGE-05-S01');assert.equal((renderPage(m,data,null) as any).courtyardUI,undefined);
 m.page.context.firstLevel=false;m.openLayer('LAYER-03-S01',{contentId:'CAT01'});
 assert.equal((renderLayer(m,data) as any).courtyardUI,undefined);
});

test('all three R2 character details show the same courtyard starting values used by start',()=>{
 const m=courtyard();
 for(const cat of data.cats){
  m.layers=[];m.openLayer('LAYER-03-S01',{contentId:cat.id});
  const p=renderLayer(m,data),run=courtyardBalanceRunConfig(makeRunConfig(cat.id,cat.startingWeapon,'p2-basic')),body=text(p.body);
  assert.equal((p as any).courtyardUI,true);
  assert(body.includes('生命上限 '+run.maxHp));assert(body.includes('移速 '+number(run.moveSpeed)+'u/s'));
  assert(body.includes(cat.strength));assert(body.includes(cat.tradeoff));
  if(cat.id==='CAT01')assert.match(body,/强化/);
  if(cat.id==='CAT03')assert.match(body,/星印持续3秒.*基础9点/);
  assert.doesNotMatch(body,/P2|研发|初值|未试玩校准|正常结算后开放/);
  assert.doesNotMatch(p.body+p.footer,/data-action="(?:choose|confirm-select|growth-confirm):?/);
  independentButtons(p.body+p.footer);
 }
});

test('R2 weapon details include real damage correction, targeting range, timing and projectile limits',()=>{
 const m=courtyard();
 for(const [id,damage,hit] of [['W01',16,16],['W04',29,26.1],['W02',7.5,7.5]] as const){
  const w=data.weapons.find(w=>w.id===id)!;
  m.layers=[];m.openLayer('LAYER-03-S01',{contentId:w.id});
  const p=renderLayer(m,data),run=courtyardBalanceRunConfig(makeRunConfig(w.ownerCat,w.id,'p2-basic')),body=text(p.body);
  assert.equal((p as any).courtyardUI,true);
  for(const value of ['单颗主弹 '+hit+'伤害','武器单颗伤害 '+damage,'角色直接伤害 ×'+number(run.directDamageMultiplier),'索敌射程 '+run.weapon.targetRange+'u','间隔'+number(run.weapon.intervalSeconds)+'秒','弹匣 '+run.weapon.ammoCapacity+'发','自动装填 '+run.weapon.reloadSeconds+'秒'])assert(body.includes(value),value+' missing from '+body);
  assert(body.includes('总散角 '+run.weapon.spreadDegrees+'°'));assert.match(body,run.weapon.extraPierce?/穿透/ : /不穿透/);
  assert.doesNotMatch(p.body+p.footer,/data-action="(?:choose|confirm-select|growth-confirm):?/);
 }
});

test('R2 details consume current frozen run and its actual growth snapshot without mutating either',()=>{
 const m=courtyard(),base=courtyardBalanceRunConfig(makeRunConfig('CAT02','W04','p2-basic'));
 m.run=base;const ranks={L1_DAMAGE:2,L1_RATE:1,L1_HEART:1,L1_RANGE:1,L1_RELOAD:1,L1_MOVE:1};
 const expected=deriveGrowthConfig(base,ranks),progression={ranks};
 const before=JSON.stringify({base,progression});
 m.openLayer('LAYER-03-S01',{contentId:'W04',progression});let p=renderLayer(m,data);
 assert(text(p.body).includes('单颗主弹 '+number(expected.weapon.damage*expected.directDamageMultiplier)+'伤害'));
 assert(text(p.body).includes('索敌射程 '+number(expected.weapon.targetRange)+'u'));
 m.layers=[];m.openLayer('LAYER-03-S01',{contentId:'CAT02',progression});p=renderLayer(m,data);
 assert(text(p.body).includes('生命上限 '+expected.maxHp));assert(text(p.body).includes('移速 '+number(expected.moveSpeed)+'u/s'));
 assert.equal(m.run,base);assert.equal(base.weapon.damage,29);assert.equal(JSON.stringify({base,progression}),before);
});

for(const [id,moving,stationarySeconds,multiplier] of [['R06',true,0,1.25],['R07',false,1.1,1.4]] as const)
test('R2 '+id+' weapon detail consumes current movement context while character facts remain stable',()=>{
 const m=courtyard(),base={...courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic')),movementContracts:{enabled:true as const}};
 m.run=base;
 const ranks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,[id]:1};
 const contracts={enabled:true,moving,stationarySeconds,stationarySince:moving?null:0,stance:multiplier};
 const progression={ranks,contracts},expected=deriveGrowthConfig(base,ranks,contracts),before=JSON.stringify({base,progression});
 for(const contentId of ['W01','CAT01']){
  m.layers=[];m.openLayer('LAYER-03-S01',{contentId,progression});
  const p=renderLayer(m,data),body=text(p.body);
  assert.equal(p.courtyardUI,true);
  if(contentId==='W01')assert(body.includes('单颗主弹 '+number(expected.weapon.damage*expected.directDamageMultiplier)+'伤害'),body);
  else {assert(body.includes('生命上限 '+expected.maxHp));assert(body.includes('移速 '+number(expected.moveSpeed)+'u/s'));}
  assert.equal(JSON.stringify({base,progression}),before);
 }
 assert.equal(m.run,base);assert.equal(base.weapon.damage,12);
});

test('R2 book only offers cats and weapons and detail return retains category and scroll',()=>{
 const m=courtyard();page(m,'PAGE-04-S02',{category:'武器'});m.page.scroll=137;
 const p=renderPage(m,data,null);assert.equal((p as any).courtyardUI,true);
 assert.match(p.body,/data-action="category:武器"[^>]*aria-pressed="true"/);
 assert.doesNotMatch(p.body,/data-action="(?:category:(?:升级|协同)|choose:|confirm-select|growth-confirm)/);
 const before={...m.committed};m.openLayer('LAYER-03-S01',{contentId:'W04'});renderLayer(m,data);m.closeLayer();
 assert.equal(m.page.context.category,'武器');assert.equal(m.page.scroll,137);assert.deepEqual(m.committed,before);
 independentButtons(p.body+p.footer);
});

test('R2 locked cats remain browsable in the book and unavailable pairs cannot be confirmed',()=>{
 const m=courtyard();m.unlocked=['CAT01'];m.draft={cat:'CAT02',weapon:'W04'};
 const p=page(m);
 assert.match(p.body,/data-action="choose:CAT02"[^>]*disabled/);
 assert.match(p.footer,/data-action="confirm-select"[^>]*disabled/);assert.match(p.body,/role="alert"/);
 assert.equal(m.confirmSelection(),false);assert.deepEqual(m.committed,{cat:'CAT01',weapon:'W01'});
 assert.match(page(m,'PAGE-04-S01').body,/data-action="detail:CAT02"/);
});

test('R2 default character detail retains the existing frame content mapping',()=>{
 const m=courtyard();m.openLayer('LAYER-03-S01');
 const p=renderLayer(m,data);assert.equal((p as any).courtyardUI,true);assert.match(text(p.body),/雪团/);
});

test('R2 rendering honors an explicit view context and a sample base cannot enable its theme',()=>{
 const m=courtyard(),view={frame:'PAGE-04-S02',context:{category:'武器'},scroll:0};
 const p=renderPage(m,data,null,view);assert.match(p.body,/data-action="category:武器"[^>]*aria-pressed="true"/);
 m.page.context.sample=true;assert.equal((renderPage(m,data,null,view) as any).courtyardUI,undefined);
});

test('R2 no-pierce weapon detail does not promise recycling when the run owns ricochet',()=>{
 const m=courtyard();m.run=courtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 const progression={ranks:{L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,L1_RICOCHET:1}};
 m.openLayer('LAYER-03-S01',{contentId:'W01',progression});
 const body=text(renderLayer(m,data).body);assert.match(body,/不穿透/);assert.doesNotMatch(body,/命中后回收/);
});

test('courtyard pause leads with continue and returns to an untouched waiting offer',()=>{
 const m=courtyard();m.run=courtyardRunConfig(makeRunConfig('CAT02','W04','p2-basic'));
 page(m,'PAGE-06-S01',{actual:true});m.openLayer('PAGE-07-S01',{actual:true,runId:42,offerId:8,selected:'L1_RATE'});
 const offer=m.current;m.openLayer('LAYER-02-S03',{interrupted:true,waitReturn:true});
 const p=renderLayer(m,data);assert.equal(p.courtyardUI,true);assert.match(p.title,/等待明确继续/);
 assert.match(text(p.body),/返回未完成的成长选择/);assert.doesNotMatch(p.body,/pause-cat|CAT\d+\.png|旧触点|研发/);
 const actions=Array.from((p.body+p.footer).matchAll(/data-action="([^"]+)"/g),m=>m[1]);
 assert.deepEqual(actions,['resume','build','settings','help','end']);assert.match(p.body,/data-action="resume"[^>]*is-gold/);
 m.openLayer('LAYER-01-S02',{returnLabel:'返回暂停'});m.closeLayer();assert.equal(m.current.frame,'LAYER-02-S03');
 m.closeLayer();assert.equal(m.current,offer);assert.equal(m.current.context.selected,'L1_RATE');
});

test('courtyard settings render independent live values, real select, source return and unlock retry',()=>{
 const m=courtyard();const audio={ready:false,error:null,settings:{music:true,effects:false,musicVolume:.37,effectsVolume:.81}};
 m.openLayer('LAYER-01-S02',{runtimeAudio:audio,returnLabel:'返回暂停'});let p=renderLayer(m,data);
 assert.equal(p.courtyardUI,true);assert.match(p.footer,/返回暂停/);assert.match(p.body,/data-action="sound-toggle:music"[^>]*aria-pressed="true"/);
 assert.match(p.body,/data-action="sound-toggle:effects"[^>]*aria-pressed="false"/);
 assert.match(p.body,/value="37"[^>]*data-audio-volume="musicVolume"/);assert.match(p.body,/value="81"[^>]*data-audio-volume="effectsVolume"/);
 assert.match(p.body,/<output[^>]*data-audio-value="musicVolume"[^>]*>37%<\/output>/);assert.match(p.body,/<select id="quality">/);
 assert.match(p.body,/data-action="sound-enable"/);assert.match(text(p.body),/仅在本次会话/);assert.doesNotMatch(text(p.body),/保存成功/);
 audio.ready=true;p=renderLayer(m,data);assert.doesNotMatch(p.body,/data-action="sound-enable"/);
 (audio as any).error='解码失败';p=renderLayer(m,data);assert.match(p.body,/role="alert"/);assert.match(p.body,/重试开启声音/);
 Object.assign(audio,{ready:false,error:'',held:true,contextState:'running'});p=renderLayer(m,data);assert.doesNotMatch(p.body,/data-action="sound-enable"/,'intentional pause is not a failed audio unlock');
});

test('courtyard end confirmation states only the actual consequence and leaves pause on cancellation',()=>{
 const m=courtyard();page(m,'PAGE-06-S01',{actual:true});m.openLayer('LAYER-02-S01');m.openLayer('LAYER-04-S01');
 const p=renderLayer(m,data);assert.equal(p.courtyardUI,true);assert.match(text(p.body),/返回庭院/);assert.match(text(p.body),/不会发放结算奖励/);
 assert.doesNotMatch(text(p.body),/广告|付费|解锁/);assert.match(p.footer,/data-action="close"/);assert.match(p.footer,/data-action="confirm-end"/);
 m.closeLayer();assert.equal(m.current.frame,'LAYER-02-S01');
});

function resultSnapshot(m:NavigationModel):GrowthSnapshot {
 m.run=courtyardRunConfig(makeRunConfig('CAT02','W04','p2-basic'));
 const g=new RunGrowth(42,()=>0,m.run).snapshot(),ranks={...g.ranks,L1_DAMAGE:4,L1_ORBIT_BELL:2};
 return {...g,level:13,totalXP:173,ranks,routes:growthRoutes(ranks),combinations:growthCombinations(ranks)};
}
test('courtyard results read terminal reason and real frozen pair, duration, kills and level',()=>{
 const m=courtyard(),g=resultSnapshot(m);m.committed={cat:'CAT03',weapon:'W02'};
 for(const [result,title,elapsed,kills] of [['cleared','守护成功',519.8,348],['survived','守护成功',120,37],['death','这次，先休息一下',47.9,36],['timeout','守护时间用尽了',600,422]] as const){
  m.openPage('PAGE-08-S02',{firstLevel:true,actual:true});const p=renderPage(m,data,{result,elapsed,kills,durationSeconds:600,catId:'CAT02',weaponId:'W04',progression:g});
  const body=text(p.body);assert.equal(p.courtyardUI,true);assert(body.includes(title));assert(body.includes('雪团'));assert(body.includes('小鱼干飞镖'));assert.doesNotMatch(body,/墨团|鱼骨散射炮|新开放角色|评分|金币/);
  assert(body.includes(String(kills)));assert.match(body,/等级.*13/);assert.match(p.body,new RegExp('data-result-seconds="'+Math.floor(elapsed)+'"'));
  assert.match(body,/已选4次/);assert.match(body,/已获得.*Lv.2/);assert.doesNotMatch(body,/Lv.2 → Lv.3/);
  assert.match(p.footer,/data-action="restart"/);assert.match(p.footer,/data-action="home"/);assert.match(p.body,/data-action="build"/);
 }
});
test('courtyard result lists only confirmed elite rewards, including zero and clipped actual recovery',()=>{
 const m=courtyard(),g=resultSnapshot(m);m.openPage('PAGE-08-S02',{firstLevel:true,actual:true});
 g.offer={id:9,source:'elite',choices:['L1_HEART'],encounterId:'elite-300',birthId:2};g.elitePending=[{encounterId:'elite-300',birthId:2}];
 for(let count=0;count<=2;count++){
  g.eliteRewards=[{offerId:7,encounterId:'elite-150',birthId:1,cardId:'L1_RATE' as const,recovered:0},{offerId:8,encounterId:'elite-300',birthId:2,cardId:'L1_DAMAGE' as const,recovered:6.5}].slice(0,count);
  const before=JSON.stringify(g),body=text(renderPage(m,data,{result:'death',elapsed:308,kills:99,catId:'CAT02',weaponId:'W04',progression:g}).body);
  assert.equal((body.match(/实际回复/g)||[]).length,count);if(count)assert.match(body,/实际回复0生命/);if(count===2)assert.match(body,/实际回复6.5生命/);
  assert.doesNotMatch(body,/确认后回复20%|生命上限 \+10/);assert.equal(JSON.stringify(g),before);
 }
});
