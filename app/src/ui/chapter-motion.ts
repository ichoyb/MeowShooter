import type {CatId} from '../combat-config';
import {button} from './components';
import {chapterNames} from './chapter';
export type ChapterKind='opening'|'ending';
export const CHAPTER_DURATION={opening:18,ending:24} as const;
export type ChapterMoment={art:'fish'|'reaction'|'gate'|'plaque';shot:number;speaker:string;line:string;subline:string;
 x:number;y:number;scale:number;fit:'cover'|'contain';address?:boolean;next?:boolean;note?:string;handoff?:boolean};
export function chapterMoment(kind:ChapterKind,seconds:number,cat:CatId):ChapterMoment{
 const t=Math.max(0,Math.min(CHAPTER_DURATION[kind],seconds)),name=chapterNames[cat];
 if(kind==='opening'){
  if(t<4.2)return {art:'fish',shot:0,speaker:'鱼摊阿婆',line:'来，小满。给你留着呢。',subline:'',note:'给小满，\n多放一条。',x:.49,y:.59,scale:1.13,fit:'cover'};
  if(t<7.2)return {art:'reaction',shot:1,speaker:'鱼摊阿婆',line:'排我后面吧，我也在等摊主。',subline:'她就站在自己的鱼摊前。',x:.31,y:.48,scale:1.48,fit:'cover'};
  if(t<9.4)return {art:'reaction',shot:1,speaker:'小满',line:'……阿婆？',subline:'她认得小满，却认不出自己的鱼摊。',x:.63,y:.59,scale:1.45,fit:'cover'};
  if(t<14.5)return {art:'gate',shot:2,speaker:t<11.5?'院门外':name,line:t<11.5?'雾，追到庭院来了。':cat==='CAT01'?'你们先带街坊进去。这里交给我。':cat==='CAT02'?'先带街坊回去。我来守住这里。':'带大家进去。这里有我。',subline:t<11.5?'院里，还有等着回家的街坊。':'先守住这里，再一起找回家的路。',x:.5,y:.5,scale:1,fit:'contain'};
  return {art:'gate',shot:3,speaker:name,line:'接下来，轮到你。',subline:'留在庭院走位 · 自动开火 · 拾取星光升级',handoff:true,x:.5,y:.5,scale:1,fit:'contain'};
 }
 if(t<4.5)return {art:'plaque',shot:0,speaker:'这一夜',line:'院门没有倒。',subline:'巨兽退去了。门后，熟悉的灯还亮着。',x:.67,y:.31,scale:1.48,fit:'cover'};
 if(t<10)return {art:'plaque',shot:1,speaker:'乌舟',line:'“这颗弯钉，刚好对上这里的孔。”',subline:'巨兽一次次回头的地方，留下了这块木牌。',address:true,x:.53,y:.70,scale:1.35,fit:'cover'};
 if(t<12.4)return {art:'plaque',shot:2,speaker:'听雪',line:'“这块牌，是我写的。”',subline:'她认得那一笔：它绕开了木节。',x:.51,y:.51,scale:1.85,fit:'cover'};
 if(t<14.6)return {art:'plaque',shot:2,speaker:'小满',line:'“那风炉街，在哪？”',subline:'听雪看着门牌，很久没有回答。',x:.51,y:.51,scale:1.85,fit:'cover'};
 if(t<18)return {art:'plaque',shot:2,speaker:'听雪',line:'“我连这条街，都不记得。”',subline:'熟悉的字迹，通向一条陌生的路。',x:.51,y:.51,scale:1.85,fit:'cover'};
 return {art:'plaque',shot:3,speaker:'明天',line:'去找回那条街。',subline:'下一步：循门牌寻找风炉街。',next:true,x:.25,y:.30,scale:1.5,fit:'cover'};
}
export function chapterMotionMarkup(kind:ChapterKind,replay:boolean){
 return {body:`<section class="n1-motion" data-motion-kind="${kind}"><header class="n1-story-top"><span>第一章 · ${kind==='opening'?'今晚先守住庭院':'尾声'}</span>${button('chapter-skip',replay?(kind==='ending'?'返回结算':'返回庭院'):kind==='opening'?'跳过开场':'跳过尾声','n1-quiet')}</header><div class="n1-movie-frame"><div class="n1-art-slot" data-chapter-art="${kind==='opening'?'fish':'plaque'}" aria-label="第一章${kind==='opening'?'开场':'通关尾声'}"><span role="status">正在展开画卷…</span></div><div class="n1-movie-shade"></div><span class="n1-movie-note" hidden></span><div class="n1-movie-address" hidden><small>门牌正面</small><strong>风炉街七号</strong><span>背面，刻着庭院的地址。</span></div><div class="n1-movie-next" hidden><small>故事将继续</small><strong>第二章 · 第七个面包</strong></div><section class="n1-movie-dialogue"><span data-story-speaker></span><p data-story-line></p><small data-story-subline></small></section><span class="n1-movie-shot"></span></div><p class="n1-movie-status" role="status">正在准备画卷…</p></section>`,footer:`<div class="n1-movie-progress" role="progressbar" aria-label="剧情播放进度" aria-valuemin="0" aria-valuemax="${CHAPTER_DURATION[kind]}" aria-valuenow="0"><i></i></div><div class="n1-movie-controls">${button('chapter-toggle','Ⅱ 暂停','n1-primary')}${button('chapter-sound','声音开','n1-quiet')}<span data-story-time>00:00 / 00:${CHAPTER_DURATION[kind]}</span></div>`};
}
