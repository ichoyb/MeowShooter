import r1UIMappings from './r1-art/ui-mappings.json';
import data from './ui/content.generated.json';
import {ImageBudget} from './image-budget';
import {runtimeImagePath} from './runtime-image-path.cjs';
import budgetLimits from '../asset-budget.json';
import {NavigationModel,createReviewModel,fixedLoadout} from './ui/model';
import {renderPage,stateNumber,type PageParts} from './ui/pages';
import {courtyardAudioStatus,renderLayer} from './ui/layers';
import {growthBuild,nextGrowthMotion,type GrowthMotionState} from './ui/progression';
import {hudMarkup,r1HUDValues,onboardingMarkup} from './ui/hud';
import {homeAudioState} from './ui/r1-home';
import {catArt,button} from './ui/components';
import {registerUIAsset,drawUIAssets,getUIAsset,uiCanvasSnapshot} from './ui/assets';
import {createModalFocus} from './ui/modal-accessibility';
import {bindActionInput,ActionInputObservation} from './ui/action-input';
import {readLayout} from './platform/layout';
import type {TouchInputObservation} from './platform/touch-compatibility';
import type {BattleInputObservation} from './platform/input-observation';
import {createBattle,BattleController,BattleSnapshot,PauseReason} from './battle';
import {COURTYARD_LEVEL,courtyardBalanceRunConfig} from './level-config';
import {playtestSummaryView,onboardingHelpView} from './ui/playtest-summary';
import {chapterCluePanel,chapterResult,chapterNames} from './ui/chapter';
import {createChapterImages} from './ui/chapter-images';
import {chapterMotionMarkup,chapterMoment,CHAPTER_DURATION,type ChapterKind} from './ui/chapter-motion';
import {makeRewardReceipt,type RewardReceipt} from './ui/reward-receipt';
import {rewardReceiptView} from './ui/reward-receipt-view';

declare const __BUILD_PROFILE__: 'release'|'review'|'playtest';
declare const __COURTYARD_ENABLED__: boolean;
declare const __COMBAT_SLICE_ENABLED__: boolean;
declare const __TEST_INPUT_DIAGNOSTICS__: boolean;
document.body.classList.toggle('courtyard-preview',__COURTYARD_ENABLED__);
const imageBudget=new ImageBudget(budgetLimits.sourceRGBALimits[__BUILD_PROFILE__]);
const n1Enabled=__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__;
document.getElementById('app')!.classList.toggle('n1-active',n1Enabled);
const d:any=n1Enabled?{...data,cats:data.cats.map(c=>({...c,name:chapterNames[c.id]||c.name}))}:data,realModel=new NavigationModel(__BUILD_PROFILE__==='review',__BUILD_PROFILE__==='playtest');let m=realModel;
const previewParams=new URLSearchParams(window.location.search);
if(__BUILD_PROFILE__==='playtest'&&['CAT01','CAT02','CAT03'].includes(previewParams.get('cat')||'')){realModel.committed=fixedLoadout(previewParams.get('cat')!);realModel.beginSelection();}
const $=(id:string)=>document.getElementById(id)!;
const updateLayout=()=>readLayout($('app'),()=>drawUIAssets($('app')));
const modalFocus=createModalFocus($('modal'));
let battle:BattleController|null=null,probe:BattleSnapshot|null=null,inProbe=false,reviewActive=false,rendering=false;
let growthMotionState:GrowthMotionState|undefined;
const chapterImages=createChapterImages(imageBudget,()=>stateRecord());
let openingRead=false,endingRead=false,chapterReplay=false,chapterIndex=0,failureCount=0;
let movie:{kind:ChapterKind;time:number;wanted:boolean;playing:boolean;preparing:boolean;loading:boolean;art:string|null;audioError:string}|null=null,movieEpoch=0;
let rewardReceipt:RewardReceipt|null=null,confirmingReward=false;
const receiptKey=(r:RewardReceipt)=>r.runId+'.'+r.offerId;
function finishReceipt(key:string){
 if(!rewardReceipt||receiptKey(rewardReceipt)!==key||m.current.frame!=='N1-RECEIPT')return;
 rewardReceipt=null;m.layers=[];
 if(!syncGrowth())battle?.resume();
 render();
}
function stopChapter(){movieEpoch++;if(movie){battle?.chapterTimeline?.stop();battle?.audio?.stopStory();}movie=null;chapterImages.clear();}
function pauseChapter(){if(!movie)return;movieEpoch++;movie.wanted=false;movie.preparing=false;if(movie.playing)movie.time=battle?.chapterTimeline?.pause()??movie.time;else battle?.chapterTimeline?.pause();battle?.audio?.pauseStory();movie.playing=false;paintChapter();}
function playChapter(){
 const current=movie;if(!current||!current.wanted||current.loading||current.playing||current.preparing||document.hidden)return;
 const epoch=++movieEpoch;current.preparing=true;
 const ready=battle?.audio?.playStory(current.kind,current.time)??Promise.resolve(false);
 void ready.then(audible=>{if(epoch!==movieEpoch||movie!==current||!current.wanted||document.hidden)return;
  current.preparing=false;current.audioError=audible?'':battle?.audio?.snapshot().story.error||'声音暂不可用，可重试开启。';
  current.playing=true;battle?.chapterTimeline?.start(current.kind,current.time,time=>{if(movie!==current)return;current.time=time;paintChapter();stateRecord();},()=>{if(movie===current)finishChapter();});paintChapter();stateRecord();
 }).catch(error=>{if(movie!==current||epoch!==movieEpoch)return;current.preparing=false;current.audioError=String(error);current.wanted=false;paintChapter();stateRecord();});
}
function paintChapter(){
 const current=movie,root=$('page-scroll');if(!current||!root.querySelector('.n1-motion'))return;
 const moment=chapterMoment(current.kind,current.time,m.committed.cat as 'CAT01'|'CAT02'|'CAT03');chapterIndex=moment.shot;
 const slot=root.querySelector<HTMLElement>('[data-chapter-art]')!,frame=root.querySelector<HTMLElement>('.n1-movie-frame')!;
 slot.dataset.chapterArt=moment.art;root.querySelector('.n1-motion')!.classList.toggle('is-ending',current.kind==='ending');
 root.querySelector('[data-story-speaker]')!.textContent=moment.speaker;root.querySelector('[data-story-line]')!.textContent=moment.line;root.querySelector('[data-story-subline]')!.textContent=moment.subline;
 const note=root.querySelector<HTMLElement>('.n1-movie-note')!;note.hidden=!moment.note;note.textContent=moment.note||'';
 root.querySelector<HTMLElement>('.n1-movie-address')!.hidden=!moment.address;root.querySelector<HTMLElement>('.n1-movie-next')!.hidden=!moment.next;
 root.querySelector('.n1-movie-shot')!.textContent=String(moment.shot+1).padStart(2,'0')+' / '+(moment.handoff?'轮到你了':current.kind==='ending'?'尾声':'铃响之前');
 const image=slot.querySelector<HTMLImageElement>('img');if(image){
  const w=frame.clientWidth,h=frame.clientHeight,iw=Math.max(w,h*2/3),s=moment.scale+(reducedMotion.matches||m.settings.quality==='低'?0:.009*Math.sin(current.time*.4));
  const x=Math.max(.5-w/(2*iw)+w/(2*iw*s),Math.min(.5+w/(2*iw)-w/(2*iw*s),moment.x));
  const y=Math.max(1/(2*s),Math.min(1-1/(2*s),moment.y));image.style.objectFit=moment.fit;image.style.objectPosition=moment.fit==='contain'?'center 34%':'center';
  image.style.transform=moment.fit==='contain'?'none':'translate('+(-(x-.5)*iw*s)+'px,'+(-(y-.5)*h*s)+'px) scale('+s+')';
 }
 const progress=$('page-footer').querySelector<HTMLElement>('.n1-movie-progress');if(progress){progress.setAttribute('aria-valuenow',String(current.time));progress.querySelector<HTMLElement>('i')!.style.width=current.time/CHAPTER_DURATION[current.kind]*100+'%';}
 const timeLabel=$('page-footer').querySelector('[data-story-time]');if(timeLabel)timeLabel.textContent='00:'+Math.floor(current.time).toString().padStart(2,'0')+' / 00:'+CHAPTER_DURATION[current.kind];
 const control=$('page-footer').querySelector('[data-action="chapter-toggle"]');if(control)control.textContent=current.playing?'Ⅱ 暂停':current.loading?'准备画卷中…':'▶ 继续播放';
 const sound=$('page-footer').querySelector('[data-action="chapter-sound"]'),settings=battle?.audio?.snapshot().settings;
 if(sound)sound.textContent=settings?.music||settings?.effects?'声音开':'声音关';
 const status=root.querySelector('.n1-movie-status')!;status.textContent=chapterImages.snapshot().status==='failed'?'画卷未载入，可重试图片或跳过剧情。':current.audioError|| (current.loading?'正在展开画卷…':current.playing?'': '已暂停，点击继续播放。');
 if(current.art!==moment.art){
  movieEpoch++;current.playing=false;current.preparing=false;battle?.chapterTimeline?.pause();battle?.audio?.pauseStory();current.loading=true;current.art=moment.art;status.textContent='正在展开画卷…';
  void chapterImages.sync(root).then(loaded=>{if(movie!==current||current.art!==moment.art)return;current.loading=false;if(!loaded)current.wanted=false;paintChapter();stateRecord();if(loaded&&current.wanted)playChapter();});
 }
}
function startChapter(replay=false,kind:ChapterKind='opening'){stopChapter();chapterReplay=replay;chapterIndex=0;movie={kind,time:0,wanted:true,playing:false,preparing:false,loading:false,art:null,audioError:''};m.openPage(kind==='ending'?'N1-END':'N1-OPEN',{},false);render();}
function finishChapter(){
 if(!movie||!['N1-OPEN','N1-END'].includes(m.page.frame))return;
 const ending=movie.kind==='ending',replay=chapterReplay;stopChapter();
 if(ending){endingRead=true;m.openPage('PAGE-08-S02',{actual:true},false);render();return;}
 openingRead=true;if(replay){chapterReplay=false;home();}else start(false,true);
}
function syncGrowth():boolean {
 const g=probe?.progression;if(confirmingReward||rewardReceipt||!inProbe||probe?.result||!g?.offer)return false;
 const existing=m.layers.find(v=>v.frame.startsWith('PAGE-07')&&v.context.actual);
 if(existing){if(existing.context.offerId===g.offer.id&&existing.context.runId===g.runId)return false;existing.context={actual:true,offerId:g.offer.id,runId:g.runId};existing.scroll=0;return true;}
 m.openLayer('PAGE-07-S01',{actual:true,offerId:g.offer.id,runId:g.runId});return true;
}
function rememberScroll(){const el=document.querySelector<HTMLElement>(m.layers.length?'#modal-scroll':'#page-scroll');if(el)m.current.scroll=el.scrollTop;}
// Preserve S1's actor area (96px controls + 24px bottom gap + 8px separation),
// independently of the transient floating indicator. Touching can use the lower area.
const ACTOR_BOTTOM_RESERVE_CSS=128;
function syncBounds(){if(!battle)return;const app=$('app').getBoundingClientRect(),hud=$('hud').getBoundingClientRect(),canvas=$('stage').querySelector('canvas');
 const layout=JSON.parse($('app').dataset.layout||'{}'),reviewGap=reviewActive?52:0;
 layout.battleTop=hud.bottom-app.top+8;layout.battleBottom=app.height-(layout.safeBottom||0)-ACTOR_BOTTOM_RESERVE_CSS-reviewGap;
 const rect=canvas?.getBoundingClientRect()||app;
 const world=(x:number,y:number)=>battle!.pageToInput(x+window.scrollX,y+window.scrollY);
 battle.setBounds({top:world(app.left,app.top+layout.battleTop).y,bottom:world(app.left,app.top+layout.battleBottom).y});
 layout.touchArea={left:Math.max(app.left,rect.left)-app.left,right:Math.min(app.right,rect.right)-app.left,top:Math.max(app.top+layout.battleTop,rect.top)-app.top,bottom:Math.min(app.bottom-(layout.safeBottom||0)-8-reviewGap,rect.bottom)-app.top};
 const excludedRects=Array.from($('hud').querySelectorAll<HTMLElement>('.ammo-chip,.mode-label')).map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
 const exclusions=excludedRects.map(r=>({left:world(r.left,r.top).x,right:world(r.right,r.bottom).x,top:world(r.left,r.top).y,bottom:world(r.right,r.bottom).y}));
 layout.touchExclusions=excludedRects.map(r=>({left:r.left-app.left,right:r.right-app.left,top:r.top-app.top,bottom:r.bottom-app.top}));
 battle.setInputArea({left:world(app.left+layout.touchArea.left,app.top+layout.touchArea.top).x,right:world(app.left+layout.touchArea.right,app.top+layout.touchArea.bottom).x,top:world(app.left+layout.touchArea.left,app.top+layout.touchArea.top).y,bottom:world(app.left+layout.touchArea.right,app.top+layout.touchArea.bottom).y},battle.cssPixelsPerLogicalUnit,exclusions);
 layout.visibleBattleHeight=layout.battleBottom-layout.battleTop;$('app').dataset.layout=JSON.stringify(layout);$('sample-battle').style.setProperty('--battle-top',layout.battleTop+'px');$('sample-battle').style.setProperty('--battle-bottom',(app.height-layout.battleBottom)+'px');
}
function stateRecord(){if(__BUILD_PROFILE__==='playtest')$('app').dataset.uiCanvasBudget=JSON.stringify(uiCanvasSnapshot($('app')));const source=m.page.context.actual?'actual':m.current.context.sample||m.page.context.sample?'sample':'navigation';$('app').dataset.ui=JSON.stringify({frame:m.current.frame,page:m.page.frame,layers:m.layers.map(v=>v.frame),committed:m.committed,draft:m.draft,unlocked:m.unlocked,runLoadout:m.run?{cat:m.run.catId,weapon:m.run.weaponId,rulesVersion:m.run.rulesVersion}:null,settings:m.settings,source,reviewActive,inProbe,narrative:n1Enabled?{openingRead,endingRead,page:m.page.frame,motion:movie?{kind:movie.kind,time:movie.time,playing:movie.playing,preparing:movie.preparing,loading:movie.loading,wanted:movie.wanted,audioError:movie.audioError,timeline:battle?.chapterTimeline?.snapshot()}:null,receipt:rewardReceipt?{key:receiptKey(rewardReceipt),cardId:rewardReceipt.cardId,mode:rewardReceipt.mode}:null,images:chapterImages.snapshot()}:null});$('app').dataset.state=JSON.stringify({...probe,imageBudget:imageBudget.snapshot(),view:inProbe?(m.layers.length?'pause':'play'):m.page.frame});if(__BUILD_PROFILE__==='playtest'&&battle?.audio)$('app').dataset.audio=JSON.stringify(battle.audio.snapshot());}
function refreshCourtyardAudio(){
 if(reviewActive||!battle?.audio)return;
 const audio=battle.audio.snapshot();
 $('app').dataset.audio=JSON.stringify(audio);
 if(!m.layers.length&&document.getElementById('home-audio'))syncAudio();
 const status=m.layers.length?$('modal-scroll').querySelector<HTMLElement>('[data-courtyard-audio-status]'):null;
 if(status){
  const focused=status.contains(document.activeElement);
  status.innerHTML=courtyardAudioStatus(audio);
  if(focused)(status.querySelector('button')??$('modal-footer').querySelector('button'))?.focus();
 }
}
function syncAudio(){if(__BUILD_PROFILE__!=='playtest'||!battle?.audio)return;
 const audio=battle.audio,previous=audio.snapshot().location,location=reviewActive||m.layers.length?'silent':inProbe?'battle':m.page.frame.startsWith('PAGE-02')?'courtyard':'silent';
 audio.setLocation(location);if(location==='courtyard'&&previous!==location&&audio.snapshot().contextState!=='not-created')void audio.continue().then(__COMBAT_SLICE_ENABLED__?refreshCourtyardAudio:render);
 $('app').dataset.audio=JSON.stringify(audio.snapshot());
 if(location==='courtyard'){
  const control=document.getElementById('home-audio');
  if(control){const s=homeAudioState(audio.snapshot());control.dataset.action=s.action;control.dataset.muted=String(s.muted);control.setAttribute('aria-label',s.label);control.setAttribute('title',s.label);$('home-audio-label').textContent=s.label;const error=$('home-audio-error');error.textContent=s.error;error.hidden=!s.error;}
  else{const box=document.createElement('div');box.className='notice mint';const snapshot=audio.snapshot();const label=snapshot.error?'重试开启声音':snapshot.ready?'声音已开启':'开启声音';box.innerHTML=button('sound-enable',label)+`<span role="status">${snapshot.error?'声音暂不可用；可重试':snapshot.ready?'庭院音乐 · 会话设置':'点击后播放庭院音乐'}</span>`;$('page-scroll').appendChild(box);}
 }
}
function syncOnboarding(){
 const hint=inProbe&&!reviewActive?probe?.onboarding?.hint:null;
 let node=document.getElementById('battle-onboarding');
 if(!node){node=document.createElement('div');node.id='battle-onboarding';node.setAttribute('role','status');node.setAttribute('aria-live','polite');$('app').appendChild(node);}
 const visible=!!hint&&hint.kind!=='upgrade'&&!m.layers.length&&!probe?.reasons?.length&&!probe?.result;
 node.hidden=!visible;
 if(visible){const key=hint.kind+':'+hint.text+':'+hint.compact;if(node.dataset.hint!==key){node.dataset.hint=key;node.dataset.kind=hint.kind;node.innerHTML=onboardingMarkup(hint);}}
 const old=document.getElementById('upgrade-onboarding'),upgrade=!!hint&&hint.kind==='upgrade'&&m.current.frame.startsWith('PAGE-07')&&!!m.current.context.actual;
 if(old&&!upgrade)old.remove();
 if(upgrade&&!old){const message=document.createElement('p');message.id='upgrade-onboarding';message.className='upgrade-onboarding';message.textContent=hint.text;$('modal-scroll').prepend(message);}
}
function syncFeedbackHUD(){
 let edge=document.getElementById('battle-hurt-edge');
 if(!edge){edge=document.createElement('div');edge.id='battle-hurt-edge';edge.setAttribute('aria-hidden','true');$('app').appendChild(edge);}
 const state=inProbe&&!reviewActive?probe?.feedback?.hud:undefined;
 edge.hidden=!state||!m.page.frame.startsWith('PAGE-06')||!!probe?.result;edge.style.opacity=String(state?.hurtEdgeAlpha??0);
 const trail=$('hud').querySelector<HTMLElement>('.hp-trail');if(trail)trail.style.width=((state?.hpTrailRatio??(probe?probe.hp/probe.maxHp:0))*100)+'%';
 const xp=$('survival-progress');if(xp)xp.style.filter=state?.xpPulse?'brightness('+(1+state.xpPulse*.55)+')':'';
}
function updateHUD(){if(m.page.frame.startsWith('PAGE-06')){
 const n=stateNumber(m.page.frame),sample=!m.page.context.actual;let s:any=sample?{...d.fixtures.NORMAL}:probe;
 if(sample){if(n===8)s={...d.fixtures.LATE};if(n===9)s={...d.fixtures.STRESS};if(n===2||n===9){s.hp=18;s.hpMax=125;}if(n===3||n===9){s.ammo=0;s.reloadRemaining=.8;s.magazine=16;}if(n===4||n===9)s.shield=true;if(n===6||n===9)s.boss=d.fixtures.STRESS.boss;if(n===13){s.ammo=s.magazine;delete s.reloadRemaining;}}
 const r1=__COURTYARD_ENABLED__&&__COMBAT_SLICE_ENABLED__&&!sample&&!reviewActive,kind=sample?m.page.frame:'actual:'+s?.catId+':'+s?.weaponId+':'+r1;
 $('hud').classList.toggle('r1-hud',r1);
 if(s&&$('hud').dataset.kind!==kind){$('hud').innerHTML=hudMarkup(s,sample,n,realModel.reviewEnabled,sample?'示例数据':d.cats.find((c:any)=>c.id===s.catId).name+' · '+d.weapons.find((w:any)=>w.id===s.weaponId).name,r1);$('hud').dataset.kind=kind;}
 if(s&&!sample){$('health').textContent=`♥ ${s.hp} / ${s.maxHp}`;$('hud').querySelector<HTMLElement>('.hp-meter i')!.style.width=(s.hp/s.maxHp*100)+'%';const left=Math.max(0,s.durationSeconds-Math.ceil(s.elapsed));$('timer').textContent=`${Math.floor(left/60).toString().padStart(2,'0')}:${(left%60).toString().padStart(2,'0')}`;if(!realModel.reviewEnabled){const progress=$('survival-progress'),g=s.progression;progress.style.width=(g?Math.min(100,g.xp/g.nextXP*100):Math.min(100,s.elapsed/s.durationSeconds*100))+'%';progress.parentElement!.setAttribute('aria-label',g?'升级经验':'守护进度');progress.parentElement!.setAttribute('aria-valuenow',String(g?g.xp:s.elapsed));progress.parentElement!.setAttribute('aria-valuemax',String(g?g.nextXP:s.durationSeconds));}}
 if(s&&!sample){const boss=$('boss-line');boss.hidden=!s.boss;if(s.boss){$('boss-name').textContent='雾壳巨兽';$('boss-hp').textContent=Math.ceil(s.boss.hp)+' / '+s.boss.maxHp;$('boss-fill').style.width=Math.max(0,s.boss.hp/s.boss.maxHp*100)+'%';boss.setAttribute('aria-valuenow',String(s.boss.hp));boss.setAttribute('aria-valuemax',String(s.boss.maxHp));}const encounter=$('encounter');if(encounter){encounter.textContent=r1?(s.encounter||''):s.encounter||(s.progression?`Lv.${s.progression.level} · ${s.progression.xp}/${s.progression.nextXP}`:'自动射击');if(r1)encounter.hidden=!s.encounter;}if(r1){const v=r1HUDValues(s);$('health').textContent=v.health;$('timer').textContent=v.remaining;$('ammo').textContent=v.ammo;$('level').textContent=v.level;}}
 $('hud').hidden=false;$('sample-battle').hidden=!sample;
 if(sample){$('sample-battle').innerHTML=`<div class="sample-field">${n===11?'':`<div class="ghost one">•ᴗ•</div><div class="ghost two">•ᴗ•</div><div class="ghost three">•ᴗ•</div>`}<div class="sample-cat">${catArt(d.cats[0])}</div></div>`;drawUIAssets($('sample-battle'));}
 const goal=document.getElementById('run-objective');if(goal)goal.textContent=probe?.level?.bossAt!==null&&probe?.level?.bossAt!==undefined?'击败雾壳巨兽 · 守住这一夜':'拾取星光变强 · 十分钟内击败巨兽';
 syncBounds();
 }else{$('hud').hidden=true;$('sample-battle').hidden=true;}syncOnboarding();syncFeedbackHUD();stateRecord();
}
function render(){if(rendering)return;rendering=true;
 try{modalFocus.prepare(!!m.layers.length);if(reviewActive){m.page.context.sample=true;m.layers.forEach(v=>v.context.sample=true);}m.page.context.firstLevel=__COMBAT_SLICE_ENABLED__&&!reviewActive;m.page.context.previewDuration=m.page.context.firstLevel?COURTYARD_LEVEL.duration:120;updateLayout();const chapterPage=n1Enabled&&['N1-OPEN','N1-END'].includes(m.page.frame);
 const parts:PageParts=chapterPage?chapterMotionMarkup(m.page.frame==='N1-END'?'ending':'opening',chapterReplay):renderPage(m,d,probe),isBattle=m.page.frame.startsWith('PAGE-06');
 $('pages').classList.toggle('n1-chapter-page',chapterPage);
 if(n1Enabled&&m.page.frame.startsWith('PAGE-02')){parts.body=parts.body.replace('<p class="r1-level-caption">','<p class="r1-level-caption n1-home-chapter">').replace('庭院首关','第一章 · 今晚先守住庭院').replace('<p class="r1-home-note">','<p class="n1-home-reason">守住庭院，等街坊找回家的路。</p><p class="r1-home-note">');parts.footer=parts.footer.replace('</nav>','<button type="button" class="n1-replay" data-action="chapter-replay">重看开场</button></nav>');}
 if(n1Enabled&&m.page.frame.startsWith('PAGE-08')&&m.page.context.actual&&probe){parts.footer+=button('playtest-summary','本局试玩摘要 ›','run-summary-entry');}
 if(n1Enabled&&m.page.frame.startsWith('PAGE-08')&&probe?.result==='cleared')parts.footer+=button('chapter-ending-replay','重看本章尾声','n1-replay');
 if(n1Enabled&&m.page.frame.startsWith('PAGE-08')&&m.page.context.actual&&probe)parts.body=parts.body.replace('<section class="court-result-build">',chapterResult(probe,endingRead,failureCount)+'<section class="court-result-build">');
 $('pages').hidden=isBattle;$('pages').classList.toggle('home-page',!!parts.home);$('pages').classList.toggle('r1-home',!!parts.r1Home);$('pages').classList.toggle('courtyard-ui',!!parts.courtyardUI);$('pages').classList.toggle('courtyard-selection',!!parts.courtyardUI&&m.page.frame.startsWith('PAGE-03'));$('pages').classList.toggle('courtyard-result',!!parts.resultUI);$('app').classList.toggle('r1-home-shell',!!parts.r1Home);updateLayout();$('page-scroll').innerHTML=parts.body;$('page-footer').innerHTML=parts.footer;if(!parts.resultUI&&m.page.frame.startsWith('PAGE-08')&&m.page.context.actual&&probe?.progression)$('page-scroll').insertAdjacentHTML('beforeend',growthBuild(probe.progression));
 $('modal').hidden=!m.layers.length;
 $('modal').classList.remove('courtyard-detail','courtyard-growth','courtyard-session','court-pause','court-settings','court-end','n1-receipt-modal','run-summary-modal');
 const reward=m.layers.find(v=>v.frame.startsWith('PAGE-07')&&v.context.actual);
 if(__COMBAT_SLICE_ENABLED__&&!reviewActive&&reward&&probe?.progression){const motion=nextGrowthMotion(growthMotionState,probe.progression,reward.context.selected,m.current===reward&&!document.hidden&&m.settings.quality!=='低');growthMotionState=motion.state;reward.context.growthMotion={enter:motion.enter,selected:motion.selected};}
 if(m.layers.length){const layer=m.current;if((inProbe||m.page.frame.startsWith('PAGE-08')&&m.page.context.actual)&&probe?.progression)layer.context.progression=probe.progression;if(__BUILD_PROFILE__==='playtest'&&!reviewActive&&battle?.audio)layer.context.runtimeAudio=battle.audio.snapshot();const summary=probe&&(layer.context.previous?probe.previousSummary:probe.summary??probe.previousSummary);const summaryCat=d.cats.find((c:any)=>c.id===summary?.catId),summaryWeapon=d.weapons.find((w:any)=>w.id===summary?.weaponId);
 const p=layer.frame==='PLAYTEST-SUMMARY'?playtestSummaryView(probe?.summary??null,probe?.previousSummary??null,!!layer.context.previous,document.documentElement.dataset.appVersion||'未标记',document.documentElement.dataset.buildId||'未标记',{cat:summaryCat?.name||'',weapon:summaryWeapon?.name||''}):layer.frame==='PLAYTEST-GUIDE'?onboardingHelpView():layer.frame==='N1-RECEIPT'&&rewardReceipt?rewardReceiptView(rewardReceipt,d.cats.find((c:any)=>c.id===probe?.catId)):layer.frame.startsWith('PAGE-')?{title:layer.frame.startsWith('PAGE-05')?'玩法说明':layer.context.actual?'升级啦！':'升级界面体验',...renderPage(m,d,probe,layer)}:renderLayer(m,d);
 if(n1Enabled&&layer.frame.startsWith('LAYER-02')&&probe){p.body+=chapterCluePanel(probe);p.body+=`<div class="run-pause-links">${button('onboarding-help','再看操作提示')}${button('playtest-summary','本局试玩摘要 ›')}</div>`;}
 if(n1Enabled&&layer.frame.startsWith('PAGE-07')&&probe?.progression?.offer?.source==='elite'){const count=probe.level?.encounters.filter(e=>e.enemyId==='EL01'&&e.defeatedAt!==null).length??0;p.title='精英战利品';p.body='<p class="n1-elite-line">'+(count>1?'乌舟：它们像是在给什么让路。':'听雪：院里还亮着灯。')+'</p>'+p.body;}
 $('modal').classList.toggle('run-summary-modal',layer.frame==='PLAYTEST-SUMMARY');
 $('modal').classList.toggle('n1-receipt-modal',layer.frame==='N1-RECEIPT');
 $('modal').classList.toggle('courtyard-detail',!!p.courtyardUI);if('sessionUI' in p&&p.sessionUI){$('modal').classList.add('courtyard-session','court-'+p.sessionUI);}$('modal').classList.toggle('courtyard-growth',!!('growthUI' in p&&p.growthUI));$('modal-title').textContent=p.title;$('modal-scroll').innerHTML=p.body;$('modal-footer').innerHTML=p.footer;$('modal-scroll').scrollTop=layer.context.scrollToEnd?$('modal-scroll').scrollHeight:layer.scroll;$('modal').querySelector<HTMLElement>('.close-button')!.hidden=inProbe&&(layer.frame.startsWith('LAYER-02')||layer.frame.startsWith('PAGE-07')&&!!layer.context.actual||layer.frame==='N1-RECEIPT');$('modal').classList.toggle('growth-modal',layer.frame.startsWith('PAGE-07')&&!!layer.context.actual);}
 $('review-return').hidden=!reviewActive||m.page.frame==='REVIEW'||m.page.frame==='COMPONENTS';$('app').classList.toggle('review-active',!$('review-return').hidden);$('review-return').textContent='返回状态评审 · '+m.current.frame;
 $('stage').style.visibility=isBattle&&!m.page.context.sample?'visible':'hidden';updateHUD();drawUIAssets($('app'));if(m.layers.length&&m.current.context.scrollToEnd)$('modal-scroll').scrollTop=$('modal-scroll').scrollHeight;
 modalFocus.sync(!!m.layers.length,m.layers.length+':'+m.current.frame);['pages','hud'].forEach(id=>$(id).setAttribute('aria-hidden',m.layers.length?'true':'false'));
 syncAudio();if(chapterPage&&movie){movie.art=null;paintChapter();}else void chapterImages.sync($('page-scroll'));
 // Restore after the sound controls are present; otherwise short screens clamp
 // the saved offset against the shorter, temporary page and hide the control.
 $('page-scroll').scrollTop=m.page.scroll;
 }finally{rendering=false;}
}
function home(){rewardReceipt=null;stopChapter();battle?.reset();inProbe=false;reviewActive=false;m=realModel;m.home();battle?.setPresentation({quality:m.settings.quality==='低'?'low':'standard'});$('app').classList.toggle('low-quality',m.settings.quality==='低');render();}
function enterReview(){if(!realModel.reviewEnabled)return;if(!reviewActive)m=createReviewModel(realModel);reviewActive=true;}
function openPause(reason:PauseReason){if(!inProbe)return;rememberScroll();const receiptInterrupted=!!rewardReceipt;if(receiptInterrupted){rewardReceipt=null;m.layers=[];}
battle?.pause(reason);const interrupt=reason==='background'||reason==='inputLost';
 if(!m.layers.length)m.openLayer(interrupt?'LAYER-02-S03':'LAYER-02-S01',{interrupted:interrupt,receiptReturn:receiptInterrupted});
 else if(reason==='menu'&&probe?.progression?.offer&&!m.current.frame.startsWith('LAYER-02'))m.openLayer('LAYER-02-S01',{waitReturn:true});
 else if(interrupt&&!m.current.context.interrupted)m.openLayer('LAYER-02-S03',{interrupted:true,waitReturn:true});render();
}
function start(restart=false,afterOpening=false){
 if(!battle)return;
 if(n1Enabled&&!reviewActive&&!restart&&!afterOpening&&!openingRead){startChapter();return;}
 rewardReceipt=null;stopChapter();
 if(reviewActive||m!==realModel){m.openPage('PAGE-06-S01',{sample:true},false);render();return;}
 try{let run=restart?m.run:m.beginRun();if(!run)throw new Error('没有可重开的当局配置，请返回庭院重新选择。');
  if(__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__){
   if(!restart){const xp=Number(previewParams.get('xp'));run=Object.freeze({...run,growthTuning:Object.freeze({attributePlan:previewParams.get('attributes')==='B'?'B' as const:'A' as const,xpTarget:xp===20?20 as const:xp===36?36 as const:28 as const})});}
   run=courtyardBalanceRunConfig(run);m.run=run;
  }
  battle.setPresentation({quality:m.settings.quality==='低'?'low':'standard'});
  $('app').classList.toggle('low-quality',m.settings.quality==='低');inProbe=true;m.openPage('PAGE-06-S01',{actual:true},false);$('hud').dataset.kind='';
  battle.start(run);probe=battle.snapshot();render();
 }catch(error){inProbe=false;m.openLayer('LAYER-03-S01',{error:error instanceof Error?error.message:String(error)});render();}
}
function reviewState(frame:string){if(!realModel.reviewEnabled||!d.states.some((s:any)=>s.stateId===frame))return;
 battle?.reset();inProbe=false;enterReview();m.layers=[];m.unlocked=['CAT01'];m.committed={cat:'CAT01',weapon:'W01'};m.beginSelection();
 const n=stateNumber(frame),ctx:any={sample:true};
 if(frame.startsWith('PAGE-02')&&n===2){m.committed={cat:'CAT02',weapon:'W04'};m.unlocked=['CAT01','CAT02'];}
 if(frame.startsWith('PAGE-03')){m.unlocked=n===1?['CAT01','CAT02']:['CAT01','CAT02','CAT03'];m.beginSelection();if(n===2)ctx.tab='武器';if(n===4)m.previewCat('CAT02');}
 if(frame.startsWith('PAGE-08'))ctx.result=d.fixtures[['','VICTORY','VICTORY_NONE','DEATH_NONE','DEATH_FIRST','VICTORY_MULTI','VICTORY'][n]];
 if(frame==='PAGE-07-S07'){ctx.selected='BALL_01';ctx.queueIndex=1;}
 if(frame==='PAGE-07-S06')ctx.selected=d.fixtures.AUTO.selected;
 if(frame.startsWith('PAGE-04'))ctx.category=['猫咪','武器','升级','协同','猫咪'][n-1];
 if(frame.startsWith('LAYER')){m.openPage('PAGE-06-S01',{sample:true},false);if(frame==='LAYER-02-S04'){m.openLayer('PAGE-07-S07',{sample:true,selected:'BALL_01',queueIndex:1});m.openLayer('LAYER-03-S02',{sample:true,contentId:'BALL_01'});ctx.waitReturn=true;ctx.interrupted=true;}if(frame==='LAYER-03-S05')ctx.scrollToEnd=true;m.openLayer(frame,ctx);if(frame==='LAYER-01-S04'){m.home();m.openLayer(frame,{sample:true});}}
 else{m.openPage(frame,ctx,false);if(frame==='PAGE-03-S03')m.openLayer('LAYER-03-S01',{sample:true,contentId:'CAT02'});if(frame==='PAGE-04-S05')m.openLayer('LAYER-03-S01',{sample:true,contentId:'CAT03'});}render();
}
function action(value:string){rememberScroll();const split=value.indexOf(':'),name=split<0?value:value.slice(0,split),arg=split<0?'':value.slice(split+1);
 const focused=document.activeElement instanceof HTMLElement&&document.activeElement.dataset.action===value;
 if(inProbe&&['help','settings','detail','build','end','growth-detail','growth-owned-detail'].includes(name))battle?.dismissOnboarding();
 switch(name){
 case 'sound-enable':if(__BUILD_PROFILE__==='playtest'&&!reviewActive)void battle?.audio?.enable().then(__COMBAT_SLICE_ENABLED__?refreshCourtyardAudio:render);return;
 case 'sound-toggle':if(__BUILD_PROFILE__==='playtest'&&!reviewActive&&battle?.audio&&(arg==='music'||arg==='effects'))battle.audio.configure({[arg]:!battle.audio.snapshot().settings[arg]});break;
 case 'receipt-skip':finishReceipt(arg);return;
 case 'chapter-replay':if(n1Enabled&&!inProbe)startChapter(true);return;
 case 'chapter-retry':if(movie){chapterImages.clear();movie.art=null;movie.wanted=true;paintChapter();}return;
 case 'chapter-toggle':if(movie){if(movie.playing||movie.wanted)pauseChapter();else{movie.wanted=true;playChapter();}}return;
 case 'chapter-sound':if(movie&&battle?.audio){const wanted=movie.wanted,settings=battle.audio.snapshot().settings;pauseChapter();const enabled=!(settings.music||settings.effects);battle.audio.configure({music:enabled,effects:enabled});movie.wanted=wanted;paintChapter();if(wanted)playChapter();}return;
 case 'chapter-ending-replay':if(n1Enabled&&probe?.result==='cleared'&&!inProbe)startChapter(true,'ending');return;
 case 'chapter-skip':finishChapter();return;
 case 'chapter-next':finishChapter();return;
 case 'home':home();return;
 case 'tutorial-skip':if(n1Enabled&&inProbe){battle?.skipOnboarding();updateHUD();}return;
 case 'onboarding-help':if(n1Enabled&&inProbe){m.openLayer('PLAYTEST-GUIDE',{actual:true});render();}return;
 case 'playtest-summary':if(n1Enabled&&!reviewActive&&(probe?.summary||probe?.previousSummary)){if(inProbe)battle?.pause('menu');m.openLayer('PLAYTEST-SUMMARY',{actual:true});render();}return;
 case 'summary-current':case 'summary-previous':if(m.current.frame==='PLAYTEST-SUMMARY'){m.current.context.previous=name==='summary-previous';render();}return;
 case 'start':start();return;
 case 'restart':start(true);return;
 case 'pause':if(inProbe){openPause('menu');return;}m.openLayer('LAYER-02-S01',{sample:true});break;
 case 'select':m.beginSelection();m.openPage('PAGE-03-S01');break;
 case 'choose':m.previewCat(arg);break;
 case 'cancel-select':m.cancelSelection();m.back();break;
 case 'confirm-select':if(m.confirmSelection())m.back();else m.openLayer('LAYER-03-S01',{error:'当前配对无效或猫咪尚未开放，请返回重新选择。'});break;
 case 'select-tab':m.current.context.tab=arg;break;
 case 'book':m.openPage('PAGE-04-S01',{category:'猫咪'});break;
 case 'category':m.current.context.category=arg;m.current.context.tree=null;m.current.scroll=0;break;
 case 'tree':m.current.context.tree=arg==='全部'?null:arg;m.current.scroll=0;break;
 case 'help':if(inProbe||m.layers.length)m.openLayer('PAGE-05-S01',{sample:!inProbe});else m.openPage('PAGE-05-S01');break;
 case 'help-tab':m.current.context.device=arg;m.current.frame=arg==='桌面'?'PAGE-05-S02':'PAGE-05-S01';break;
 case 'settings':m.openLayer('LAYER-01-S02',{sample:reviewActive,returnLabel:m.current.frame.startsWith('LAYER-02')?'返回暂停':m.current.frame.startsWith('PAGE-07')?'返回成长选择':m.page.frame.startsWith('PAGE-02')?'返回庭院':'返回原入口'});break;
 case 'detail':m.openLayer('LAYER-03-S01',{contentId:arg,sample:reviewActive});break;
 case 'build':m.openLayer('LAYER-03-S04',{contentId:'build',sample:reviewActive,actual:inProbe||!!m.page.context.actual,result:m.page.context.result});break;
 case 'back':case 'close':if(inProbe&&(m.current.frame.startsWith('LAYER-02')||m.current.frame.startsWith('PAGE-07')&&m.current.context.actual))return;m.back();break;
 case 'end':m.openLayer('LAYER-04-S01',{sample:reviewActive});break;
 case 'confirm-end':home();return;
 case 'resume':if(m.current.context.receiptReturn){m.layers=[];battle?.resume();syncGrowth();render();return;}if(m.current.context.waitReturn){m.closeLayer();if(probe?.progression?.offer)battle?.resume();break;}if(m.current.context.upgradeInterrupted){m.closeLayer();m.openLayer('PAGE-07-S07',{sample:true});break;}if(inProbe){m.layers=[];battle?.resume();render();return;}m.closeLayer();break;
 case 'growth-select':{
  const [run,offer,id]=arg.split('.'),g=probe?.progression;
  if(inProbe&&m.current.frame.startsWith('PAGE-07')&&m.current.context.actual&&g?.runId===Number(run)&&g.offer?.id===Number(offer)&&g.offer.choices.includes(id as any))m.current.context.selected=id;
  break;
 }
 case 'growth-confirm':{
  if(!inProbe||!m.current.frame.startsWith('PAGE-07')||!m.current.context.actual)return;
  const [run,offer,id]=arg.split('.');if(m.current.context.selected!==id)return;
  const before=battle?.snapshot(),layers=m.layers;m.layers=[];confirmingReward=n1Enabled;
  const confirmed=battle?.confirmUpgrade(Number(run),Number(offer),id,n1Enabled);confirmingReward=false;
  if(!confirmed)m.layers=layers;
  else if(n1Enabled&&before&&m.run&&battle){
   probe=battle.snapshot();rewardReceipt=makeRewardReceipt(before,probe,id,m.run);
   if(rewardReceipt){
    m.openLayer('N1-RECEIPT',{actual:true});render();const key=receiptKey(rewardReceipt);
    if(m.settings.quality==='低'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)window.requestAnimationFrame(()=>finishReceipt(key));
    battle.audio?.rewardCue();return;
   }
   if(!syncGrowth())battle.resume();
  }
  // The synchronous state callback already rendered a queued offer. Keep that
  // DOM so its new-offer animation is not removed before the browser paints.
  else if(m.layers.some(v=>v.frame.startsWith('PAGE-07')&&v.context.actual))return;
  break;
 }
 case 'growth-detail':m.openLayer('LAYER-03-S01',{actual:true,growthDetail:arg,growthSource:'offer'});break;
 case 'growth-owned-detail':m.openLayer('LAYER-03-S01',{actual:true,growthDetail:arg,growthSource:'owned'});break;
 case 'upgrade':if(!realModel.reviewEnabled)return;m.openLayer('PAGE-07-S01',{sample:true});break;
 case 'close-upgrade':if(m.layers.length)m.closeLayer();else m.openPage('REVIEW',{},false);break;
 case 'upgrade-choice':if(!m.current.context.selected)m.current.context.selected=arg;break;
 case 'upgrade-next':if(stateNumber(m.current.frame)===7&&(m.current.context.queueIndex||1)<2){m.current.context.queueIndex=2;m.current.context.selected=null;m.current.context.candidates=d.fixtures.COST.candidates;}else if(m.layers.length)m.closeLayer();else m.openPage('REVIEW',{},false);break;
 case 'sample-save':m.current.context.saveMessage='模拟重试成功；没有写入真实存档。';break;
 case 'sample-audio':m.current.context[arg]=m.current.context[arg]===false;break;
 case 'sample-retry':m.page.frame='PAGE-01-S02';break;
 case 'sample-restart':m.openPage('PAGE-06-S01',{sample:true},false);break;
 case 'review':if(!realModel.reviewEnabled)return;battle?.reset();inProbe=false;enterReview();m.openPage('REVIEW',{},false);break;
 case 'components':if(!realModel.reviewEnabled)return;m.openPage('COMPONENTS');break;
 case 'show-state':reviewState(($('state-picker') as HTMLSelectElement).value);return;
 case 'state':reviewState(arg);return;
 case 'reload':window.location.reload();return;
 case 'noop':return;
 }
 render();
 if(focused&&!m.layers.length){
  if((name==='select'||name==='choose')&&$('pages').classList.contains('courtyard-selection'))$('page-scroll').querySelector<HTMLElement>('.court-select-cat[aria-pressed="true"]:not(:disabled)')?.focus();
  if((name==='cancel-select'||name==='confirm-select')&&$('pages').classList.contains('r1-home'))$('page-scroll').querySelector<HTMLElement>('.r1-pair')?.focus();
 }
 if(m.current.context.saveMessage){const node=document.createElement('div');node.className='notice mint';node.textContent=m.current.context.saveMessage;($('modal').hidden?$('page-scroll'):$('modal-scroll')).appendChild(node);}
}
// Bounded traces exist only in explicitly compiled independent test fixtures.
// No console forwarding, persistence or network transmission.
const inputEvents:ActionInputObservation[]=[];
const touchEvents:TouchInputObservation[]=[];
// Preserve terminal events separately so a long drag cannot overwrite its start
// or an unrelated release. Session-only, no storage/network or player controls.
const battleInputEvents:{revision:string;sequence:number;terminal:(BattleInputObservation&{sequence:number})[];motion:(BattleInputObservation&{sequence:number})[]}={revision:'held-edge-trace-1',sequence:0,terminal:[],motion:[]};
function recordBattleInput(record:BattleInputObservation){
 if(!__TEST_INPUT_DIAGNOSTICS__)return;
 const moving=record.type==='mousemove'||record.type==='pointermove'||record.type==='touchmove',list=moving?battleInputEvents.motion:battleInputEvents.terminal;
 list.push({...record,sequence:++battleInputEvents.sequence});if(list.length>(moving?8:32))list.shift();
 $('app').dataset.battleInputEvents=JSON.stringify(battleInputEvents);
}
bindActionInput(document,'button[data-action]',target=>{
 if(m.layers.length&&!$('modal').contains(target)&&!(reviewActive&&target.id==='review-return'))return;
 const value=target.dataset.action!;
 const audio=__BUILD_PROFILE__==='playtest'&&__COMBAT_SLICE_ENABLED__&&!reviewActive&&!m.layers.length&&m.page.frame.startsWith('PAGE-02')?battle?.audio:undefined;
 const snapshot=audio?.snapshot();
 action(value);
 // Start the context within the button gesture, after navigation sets the actual
 // location. A direct start can then play battle audio without a courtyard loop.
 if(audio&&snapshot?.contextState==='not-created'&&!snapshot.error&&value!=='sound-enable'){
  void audio.enable().then(refreshCourtyardAudio);
 }
},__TEST_INPUT_DIAGNOSTICS__?record=>{inputEvents.push(record);if(inputEvents.length>32)inputEvents.shift();$('app').dataset.inputEvents=JSON.stringify(inputEvents);}:undefined);
document.addEventListener('animationend',event=>{const el=event.target as HTMLElement;if(event.animationName==='n1-acquire'&&el.dataset.receiptKey)finishReceipt(el.dataset.receiptKey);});
document.addEventListener('animationcancel',event=>{const el=event.target as HTMLElement;if(event.animationName==='n1-acquire'&&el.dataset.receiptKey){const key=el.dataset.receiptKey;window.requestAnimationFrame(()=>finishReceipt(key));}});
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addListener(event=>{if(event.matches&&rewardReceipt)finishReceipt(receiptKey(rewardReceipt));});
document.addEventListener('change',event=>{const el=event.target as HTMLSelectElement;if(el.id==='quality'){m.settings.quality=el.value;$('app').classList.toggle('low-quality',el.value==='低');if(!reviewActive&&m===realModel)battle?.setPresentation({quality:el.value==='低'?'low':'standard'});stateRecord();}});
document.addEventListener('input',event=>{const el=event.target as HTMLInputElement;if(el.dataset.volume&&!el.disabled)m.current.context[el.dataset.volume]=Number(el.value);if(__BUILD_PROFILE__==='playtest'&&!reviewActive&&el.dataset.audioVolume){battle?.audio?.configure({[el.dataset.audioVolume]:Number(el.value)/100});const output=$('modal').querySelector<HTMLOutputElement>('[data-audio-value="'+el.dataset.audioVolume+'"]');if(output)output.textContent=el.value+'%';if(battle?.audio)$('app').dataset.audio=JSON.stringify(battle.audio.snapshot());}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseChapter();battle?.audio?.pause('background');if(inProbe)openPause('background');else render();}});window.addEventListener('blur',()=>{pauseChapter();battle?.audio?.pause('inputLost');if(inProbe)openPause('inputLost');else render();});
window.addEventListener('resize',()=>{battle?.setPresentation({quality:realModel.settings.quality==='低'?'low':'standard'});if(inProbe&&battle?.snapshot().moveHeld)openPause('inputLost');updateLayout();updateHUD();drawUIAssets($('app'));paintChapter();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&rewardReceipt){openPause('menu');return;}if(event.key==='Escape'&&inProbe&&probe?.progression?.offer&&!m.current.frame.startsWith('LAYER-02')){openPause('menu');return;}if(event.key==='Escape'&&m.layers.length&&!inProbe){m.closeLayer();render();}});
function loadUIAssets():Promise<void>{
 const names=['CAT01.png','CAT02.png','CAT03.png','garden.jpeg','W01.svg','W02.svg','W04.svg','BALL.svg','MAG.svg',...(__COURTYARD_ENABLED__?[]:['FIRE.svg','FROST.svg','SHOCK.svg','SUMMON.svg']),'GUARD.svg','MOVE.svg'];
 const loading={loaded:0,total:names.length};let failed=false;m.openPage('PAGE-01-S01',{loading},false);render();
 return Promise.all(names.map(name=>new Promise<void>((resolve,reject)=>{
  const img=new Image(),timer=window.setTimeout(()=>{if(!failed)reject(new Error('页面图片加载超时：'+name));else resolve();},8000);
  img.onload=()=>{window.clearTimeout(timer);try{if(!failed){registerUIAsset(name,img,imageBudget,__COURTYARD_ENABLED__?r1UIMappings[name as keyof typeof r1UIMappings]:undefined);loading.loaded++;render();}resolve();}catch(error){reject(error);}};
  img.onerror=()=>{window.clearTimeout(timer);reject(new Error('页面图片加载失败：'+name));};img.src=runtimeImagePath('./assets/ui/'+name);
 }))).then(()=>{}).catch(error=>{failed=true;throw error;});
}
async function boot(){try{await loadUIAssets();battle=await createBattle($('stage'),{onState:s=>{probe=s;if(syncGrowth())render();else updateHUD();},onBattleInput:__TEST_INPUT_DIAGNOSTICS__?recordBattleInput:undefined,onTouchInput:__TEST_INPUT_DIAGNOSTICS__?record=>{touchEvents.push(record);if(touchEvents.length>32)touchEvents.shift();$('app').dataset.touchEvents=JSON.stringify(touchEvents);}:undefined,onResize:()=>{updateLayout();updateHUD();drawUIAssets($('app'));if(battle){probe=battle.snapshot();stateRecord();}},onInterrupt:openPause,onFinish:s=>{probe=s;inProbe=false;rewardReceipt=null;if(n1Enabled&&(s.result==='death'||s.result==='timeout'))failureCount++;if(n1Enabled&&s.result==='cleared'&&!endingRead){startChapter(false,'ending');return;}m.openPage(s.result==='survived'||s.result==='cleared'?'PAGE-08-S02':'PAGE-08-S03',{actual:true},false);render();}},{CAT01:getUIAsset('CAT01.png'),CAT02:getUIAsset('CAT02.png'),CAT03:getUIAsset('CAT03.png')},imageBudget,true);probe=battle.snapshot();home();$('app').dataset.ready='true';}catch(error){$('app').dataset.loadError=String(error);$('app').dataset.imageBudget=JSON.stringify(imageBudget.snapshot());m.openPage('PAGE-01-S03',{error:String(error)},false);render();(window as any).GameBoot.fail('资源或画布初始化失败。请重新加载；反复失败请记录设备环境。');}}
void boot();
