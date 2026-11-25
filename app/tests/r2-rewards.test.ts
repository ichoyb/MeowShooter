import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/ui/content.generated.json';
import {makeRunConfig} from '../src/combat-config';
import {courtyardBalanceRunConfig,normalCourtyardRunConfig} from '../src/level-config';
import {Session} from '../src/rules';
import {growthCards,RunGrowth,growthRoutes,growthCombinations,projectileTraitStats,deriveGrowthConfig,type GrowthId,type GrowthRanks,type GrowthSnapshot} from '../src/progression';
import * as UI from '../src/ui/progression';
import {NavigationModel} from '../src/ui/model';
import {renderPage} from '../src/ui/pages';
import {renderLayer} from '../src/ui/layers';

const options={courtyard:true};
const zero:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
const text=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const base=(cat='CAT01',weapon='W01')=>normalCourtyardRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
function snap(ranks:GrowthRanks={...zero},choices:GrowthId[]=['L1_DAMAGE','L1_SPLIT','L1_RELOAD']):GrowthSnapshot {
 const b=base();return {...new RunGrowth(42,()=>0,b).snapshot(),ranks,routes:growthRoutes(ranks),combinations:growthCombinations(ranks),projectileTraits:projectileTraitStats(b,ranks),offer:{id:7,source:'experience',choices}};
}
const page=(g:GrowthSnapshot,selected?:string,motion?:object)=>(UI.growthPage as any)(g,base(),selected,{...options,motion});

test('elite offer previews actual capped healing and recomputes after a max-HP pick',()=>{
 const b=courtyardBalanceRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 const g=snap(zero,['L1_HEART','A13']);
 g.offer!.source='elite';
 for(const courtyard of [true,false]){
  const render=(hp:number,selected:string)=>text(UI.growthPage(g,b,selected,{courtyard,playerHp:hp}).body);
  assert.match(render(95,'L1_HEART'),/生命已满.*精英.*回复0生命/);
  assert.match(render(89,'A13'),/预计实际回复6生命/);
  const injured=new Session(b);injured.damage(40);
  const recovered=injured.applyGrowthReward({...zero,L1_HEART:1},.2);
  assert.equal(recovered,22);
  assert.match(render(55,'L1_HEART'),/预计实际回复22生命/);
 }
});

test('normal cadence detail describes the active main-volley passive; hot start previews actual timing after growth',()=>{
 const b=courtyardBalanceRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 const g=snap({...zero,L1_RATE:2,L1_ECHO:1},['L1_EVO_CADENCE','M12']);
 const detail=text(UI.growthDetail('L1_EVO_CADENCE',g,b,options).body);
 assert.match(detail,/开局.*前3次主齐射×1.35/);
 assert.doesNotMatch(detail,/替换.*75%/);
 assert.match(text(UI.growthDetail('M12',g,b,options).body),/0.523 → 0.392秒/);
 assert.match(UI.growthCardSummary('M12',g,b).benefit,/0.523 → 0.392秒/);
});

test('courtyard rewards preserve actual 1/2/3-card transactions and separate gold confirmation',()=>{
 for(const choices of [['L1_DAMAGE'],['L1_DAMAGE','L1_SPLIT'],['L1_DAMAGE','L1_SPLIT','L1_RELOAD']] as GrowthId[][]){
  const g=snap({...zero,L1_DAMAGE:5},choices),before=JSON.stringify(g),p=page(g,choices[0]);
  assert.equal(p.courtyardUI,true);assert.equal(p.growthUI,true);
  assert.equal((p.body.match(/<article /g)||[]).length,choices.length);
  assert.equal((p.body.match(/data-action="growth-select:42\.7\./g)||[]).length,choices.length);
  assert.equal((p.body.match(/data-action="growth-detail:/g)||[]).length,choices.length);
  assert.doesNotMatch(p.body,/data-action="growth-confirm:/);
  assert.match(p.footer,new RegExp('data-action="growth-confirm:42.7.'+choices[0]+'"[^>]*class="[^"]*is-gold'));
  assert.match(page(g).footer,/data-action="growth-confirm:42\.7\."[^>]*disabled/);
  assert.match(text(p.body),/已选5次.*第6次/);assert.doesNotMatch(text(p.body),/5\s*\/\s*3/);
  assert.equal(JSON.stringify(g),before);
 }
});

test('new reward theme stays isolated from legacy, release, review and non-courtyard playtest',()=>{
 const g=snap();assert.equal((UI.growthPage(g,base()) as any).courtyardUI,undefined);
 for(const [review,playtest,firstLevel,sample,expected] of [[false,true,true,false,true],[false,false,true,false,undefined],[true,true,true,false,undefined],[false,true,false,false,undefined],[false,true,true,true,undefined]] as const){
  const m=new NavigationModel(review,playtest);m.run=base();m.openPage('PAGE-06-S01',{firstLevel,sample,actual:true});
  m.openLayer('PAGE-07-S01',{actual:true,selected:'L1_SPLIT',sample});
  assert.equal((renderPage(m,data,{progression:g},m.current) as any).courtyardUI,expected);
  m.layers=[];m.openLayer('LAYER-03-S04',{contentId:'build',progression:g,sample});
  assert.equal((renderLayer(m,data) as any).courtyardUI,expected);
  m.layers=[];m.openLayer('LAYER-03-S01',{growthDetail:'L1_SPLIT',progression:g,sample});
  assert.equal((renderLayer(m,data) as any).courtyardUI,expected);
 }
});

test('unknown or no-longer-offered selection leaves confirmation disabled',()=>{
 const g=snap({...zero},['L1_DAMAGE']);
 for(const selected of ['missing-id','L1_SPLIT']){
  const p=page(g,selected);assert.match(p.footer,/data-action="growth-confirm:42\.7\."[^>]*disabled/);
  assert.doesNotMatch(p.body,/aria-pressed="true"/);
 }
 const m=new NavigationModel(false,true);m.run=base();m.openPage('PAGE-06-S01',{firstLevel:true});
 for(const identity of [{runId:41,offerId:7},{runId:42,offerId:6}]){
  m.layers=[];m.openLayer('PAGE-07-S01',{actual:true,selected:'L1_DAMAGE',...identity});
  assert.match(renderPage(m,data,{progression:g},m.current).footer,/data-action="growth-confirm:42\.7\."[^>]*disabled/);
 }
});

test('rendered queue keys reject an old confirmation while the next actual offer waits for a new selection',()=>{
 const b=base(),run=new RunGrowth(42,()=>0,b);run.collect(100);
 const first=run.snapshot(),offer=first.offer!,selected=offer.choices[0],before=JSON.stringify(first);
 page(first,selected);(UI.growthBuild as any)(first,b,options);(UI.growthDetail as any)(selected,first,b,options);
 assert.equal(JSON.stringify(run.snapshot()),before,'rendering does not award a card or consume the queue');
 assert.equal(run.confirm(42,offer.id,selected),true);const next=run.snapshot();assert(next.offer);assert.notEqual(next.offer.id,offer.id);
 assert.equal(run.confirm(42,offer.id,selected),false);
 assert.match(page(next).footer,new RegExp('data-action="growth-confirm:42.'+next.offer.id+'."[^>]*disabled'));
 assert.doesNotMatch(page(next).body,/A15|M05|M09/);
});

test('elite cards explain pending recovery while build records only actual recovery',()=>{
 const g={...snap(),offer:{id:7,source:'elite' as const,encounterId:'elite-150',birthId:22,choices:['L1_HEART'] as GrowthId[]}},before=JSON.stringify(g);
 const p=page(g,'L1_HEART');assert.match(text(p.body),/精英战利品/);assert.match(text(p.body),/确认后回复20%最大生命/);
 assert.match(p.body,/data-reward-source="elite"/);assert.doesNotMatch(text(p.body),/实际回复/);
 const unclaimed=(UI.growthBuild as any)(g,base(),options);assert.doesNotMatch(text(unclaimed),/实际回复/);
 const claimed={...g,eliteRewards:[{offerId:7,encounterId:'elite-150',birthId:22,cardId:'L1_HEART' as GrowthId,recovered:6.5}]};
 assert.match(text((UI.growthBuild as any)(claimed,base(),options)),/实际回复6.5生命/);
 assert.equal(JSON.stringify(g),before);
});

test('owned details show current results instead of previewing the next reward',()=>{
 for(const [cat,weapon] of [['CAT01','W01'],['CAT02','W04'],['CAT03','W02']]){
  const b=base(cat,weapon),g=snap({...zero,L1_DAMAGE:4,L1_ORBIT_BELL:2,L1_SPLIT:1}),current=deriveGrowthConfig(b,g.ranks);
  const owned=(UI.growthDetail as any)('L1_ORBIT_BELL',g,b,{...options,source:'owned'});
  assert.match(text(owned.body),/当前效果/);assert.match(text(owned.body),/已获得.*Lv.2/);
  assert.doesNotMatch(text(owned.body),/本次变化|Lv.2 → Lv.3|再拿一次/);
  const split=text((UI.growthDetail as any)('L1_SPLIT',g,b,{...options,source:'owned'}).body);
  assert(split.includes(`主弹${current.weapon.pellets}颗`));
  const offer=(UI.growthDetail as any)('L1_ORBIT_BELL',g,b,options);
  assert.match(text(offer.body),/本次变化.*Lv.2 → Lv.3/);
  assert.doesNotMatch(owned.body+owned.footer,/data-action="growth-(?:select|confirm):/);
 }
});

test('build exposes obtained cards, repeated attributes, orbit level and real combination prerequisites',()=>{
 const g=snap({...zero,L1_DAMAGE:8,L1_SPLIT:1,L1_ORBIT_BELL:2,L1_PICKUP_CHIME:1}),before=JSON.stringify(g);
 const build=(UI.growthBuild as any)(g,base(),options),s=text(build);
 assert.match(s,/已选8次/);assert.match(s,/Lv.2/);assert.match(s,/巡游星环/);assert.match(s,/环身飞铃.*已获得.*拾光共鸣.*已获得/);
 assert.match(build,/data-action="growth-owned-detail:L1_ORBIT_BELL"/);
 assert.doesNotMatch(build,/data-action="growth-(?:select|confirm):/);
 assert.match(text((UI.growthBuild as any)(snap(),base(),options)),/还没有取得/);
 assert.equal(JSON.stringify(g),before);
});

test('long build lists all 50 normal identities and every owned rule stays read-only',()=>{
 const cards=growthCards(base());assert.equal(cards.length,50);
 const ranks={...zero,...Object.fromEntries(cards.map(c=>[c.id,1])),L1_ORBIT_BELL:3,L1_DAMAGE:7},g=snap(ranks),before=JSON.stringify(g);
 const build=(UI.growthBuild as any)(g,base(),options);assert.equal((build.match(/data-action="growth-owned-detail:/g)||[]).length,50);
 for(const c of cards){
  assert(text(build).includes(c.name));
  const owned=(UI.growthDetail as any)(c.id,g,base(),{...options,source:'owned'});
  assert.match(text(owned.body),/当前效果/);assert.doesNotMatch(text(owned.body),/本次变化|undefined|NaN/);
  assert.doesNotMatch(owned.body+owned.footer,/data-action="growth-(?:select|confirm):/);
 }
 assert.equal(JSON.stringify(g),before);
});

test('owned layer source keeps a repeatable owned card distinct from an offered repeat',()=>{
 const m=new NavigationModel(false,true);m.run=base();m.openPage('PAGE-06-S01',{firstLevel:true,actual:true});
 const g=snap({...zero,L1_DAMAGE:5});m.openLayer('LAYER-03-S01',{growthDetail:'L1_DAMAGE',progression:g,growthSource:'owned'});
 assert.match(text(renderLayer(m,data).body),/当前效果/);assert.doesNotMatch(text(renderLayer(m,data).body),/本次变化/);
 m.current.context.growthSource='offer';assert.match(text(renderLayer(m,data).body),/本次变化/);
});

test('new offer and changed selection produce bounded one-shot motion without return replay',()=>{
 const next=(UI as any).nextGrowthMotion;assert.equal(typeof next,'function');
 const g=snap(),first=next(undefined,g,undefined,true);assert.equal(first.enter,true);assert.equal(first.selected,undefined);
 const repeat=next(first.state,g,undefined,true);assert.equal(repeat.enter,false);
 const selected=next(repeat.state,g,'L1_SPLIT',true);assert.equal(selected.enter,false);assert.equal(selected.selected,'L1_SPLIT');
 const returned=next(selected.state,g,'L1_SPLIT',true);assert.equal(returned.enter,false);assert.equal(returned.selected,undefined);
 const hidden=next(returned.state,{...g,offer:{...g.offer!,id:8}},'L1_DAMAGE',false);assert.equal(hidden.enter,false);assert.equal(hidden.selected,undefined);
 const visible=next(hidden.state,{...g,offer:{...g.offer!,id:8}},'L1_DAMAGE',true);assert.equal(visible.enter,false);assert.equal(visible.selected,undefined);
 const run=next(visible.state,{...g,runId:43},undefined,true);assert.equal(run.enter,true);
 const p=page(g,'L1_SPLIT',{enter:true,selected:'L1_SPLIT'});
 assert.equal((p.body.match(/is-entering/g)||[]).length,3);
 assert.equal((p.body.match(/is-picking/g)||[]).length,1);
 assert.equal((p.body.match(/class="court-reward-spark/g)||[]).length,6);
 assert.doesNotMatch(page(g,'L1_SPLIT').body,/is-entering|is-picking|court-reward-spark/);
});

test('rendering and read-only child navigation keep reward identity, selection and scroll intact',()=>{
 const m=new NavigationModel(false,true);m.run=base();m.openPage('PAGE-06-S01',{actual:true,firstLevel:true});
 const g=snap();m.openLayer('PAGE-07-S01',{actual:true,selected:'L1_SPLIT',offerId:7,runId:42});m.current.scroll=114;
 const offer=m.current,before=JSON.stringify(g);renderPage(m,data,{progression:g},offer);
 for(const context of [{growthDetail:'L1_SPLIT',progression:g},{contentId:'build',progression:g},{runtimeAudio:null}]){
  m.openLayer(context.runtimeAudio===null?'LAYER-01-S02':'LAYER-03-S01',context);renderLayer(m,data);m.closeLayer();
  assert.equal(m.current,offer);assert.equal(m.current.scroll,114);assert.equal(m.current.context.selected,'L1_SPLIT');
 }
 assert.equal(JSON.stringify(g),before);
});
