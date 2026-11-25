import type {BattleSnapshot} from '../battle';
import {button,esc} from './components';

export const chapterNames:Record<string,string>={CAT01:'小满',CAT02:'听雪',CAT03:'乌舟'};
type Frame={title:string;subtitle:string;speaker:string;quote:string;art:'fish'|'gate'|'plaque';crop?:string;note?:string;address?:boolean};
export const chapterFrames:{opening:Frame[];ending:Frame[]}={
 opening:[
  {title:'她忘了自己的鱼摊',subtitle:'雾还没进院子，有些事已经开始不对劲。',speaker:'鱼摊阿婆',quote:'“排我后面吧，我也在等摊主。”',art:'fish'},
  {title:'她还记得，多放一条',subtitle:'阿婆认得小满，却认不出纸上的字。',speaker:'小满',quote:'“这是您写的呀，阿婆。”',art:'fish',crop:'package',note:'给小满，多放一条。'},
  {title:'今晚，先守住这里',subtitle:'院门后面，还有等大家回家的灯。十分钟内击退巨兽，先守住这里。',speaker:'小满',quote:'“先守住院门。天亮了，再找回家的路。”',art:'gate',note:'留在庭院走位 · 自动开火 · 拾取星光升级'}
 ],
 ending:[
  {title:'院门还在。',subtitle:'巨兽退去了。门后，熟悉的灯还亮着。',speaker:'这一夜',quote:'院门没有倒。大家还有一个能回来的地方。',art:'plaque',crop:'gate'},
  {title:'巨掌护着的门牌',subtitle:'它一次次回头的地方，留着这块旧木牌。',speaker:'乌舟',quote:'“这颗弯钉，刚好对上了这里的孔。”',art:'plaque',address:true},
  {title:'她认得字，却不记得路',subtitle:'绕开木节的那一笔，她太熟悉了。',speaker:'听雪',quote:'“这块牌是我写的。可我连这条街，都不记得。”',art:'plaque',address:true}
 ]
};
export function chapterMarkup(kind:'opening'|'ending',index:number,replay:boolean){
 const frame=chapterFrames[kind][index]??chapterFrames[kind][0],end=kind==='ending';
 return {body:`<section class="n1-story ${end?'is-ending':''}" data-chapter-kind="${kind}" data-chapter-index="${index}"><header class="n1-story-top"><span>第一章 · ${end?'尾声':'今晚先守住庭院'}</span>${button('chapter-skip',replay?'返回庭院':end?'跳过尾声':'跳过故事','n1-quiet')}</header><div class="n1-story-heading"><h1>${frame.title}</h1><p>${frame.subtitle}</p></div><div class="n1-story-scene ${frame.crop||''}"><div class="n1-art-slot" data-chapter-art="${frame.art}" aria-label="${esc(frame.title)}"><span role="status">正在展开画卷…</span></div>${frame.note?`<span class="n1-story-note">${frame.note}</span>`:''}${frame.address?'<div class="n1-plaque"><strong>风炉街七号</strong><small>背面，竟是庭院的地址。</small></div>':''}</div><section class="n1-dialogue"><span>${frame.speaker}</span><p>${frame.quote}</p></section></section>`,footer:`<div class="n1-story-footer"><span class="n1-story-dots" aria-label="第${index+1}页，共3页">${[0,1,2].map(i=>`<i class="${index===i?'is-active':''}"></i>`).join('')}</span>${button('chapter-next',index<2?'下一页 →':replay?'回到庭院':end?'收起这条线索 →':'开始守护 ▶','n1-primary')}</div>`};
}
// These are observations of settled level facts, never timers or new rewards.
export function chapterClues(s:Pick<BattleSnapshot,'level'|'result'>):string[]{
 const defeats=s.level?.encounters.filter(e=>e.enemyId==='EL01'&&e.defeatedAt!==null).length??0;
 const lines:string[]=[];
 if(defeats>0)lines.push('听雪：“院里还亮着灯。再守一会儿。”');
 if(defeats>1)lines.push('乌舟：“它们没有散，像是在给什么让路。”');
 if(s.level?.bossAt!==null&&s.level?.bossAt!==undefined)lines.push('雾壳巨兽已经来到庭院。');
 return lines;
}
export function chapterCluePanel(s:Pick<BattleSnapshot,'level'|'result'>){
 const clues=chapterClues(s);
 return `<details class="n1-clues"><summary>本章线索</summary><p>雾让街坊忘了回家的路。今晚，先守住大家留下的庭院。</p><p>十分钟内击退雾壳巨兽；拾取经验，选择本局能力。</p>${clues.map(line=>`<p>${esc(line)}</p>`).join('')}${!clues.length?'<p>先守住这里，再一起找回家的路。</p>':''}</details>`;
}
export function chapterResult(s:Pick<BattleSnapshot,'result'|'level'>,endingRead:boolean,failures=0){
 const won=s.result==='cleared',timeout=s.result==='timeout';
 const clues=chapterClues(s);
 const replies=timeout?['先把路记下来。下一次，我们一起走。','先回灯下等一等。雾里还有路，我们再找。']:['别急，我还在这里等你。','路还在这里。下一次，我们换个办法。'];
 const reply=replies[Math.max(0,failures-1)%replies.length];
 return `<section class="n1-result-chapter"><span>第一章 · 今晚先守住庭院</span><h2>${won?'院门还在，灯也还亮着。':timeout?'雾还没有散。':'先回灯下，再出发。'}</h2>${won&&endingRead?'<h3>本章发现 · 一块不该在这里的门牌</h3><p>听雪认出了自己的笔迹，却不记得“风炉街七号”。</p><strong>下一条线索：失去的街</strong><p>院门外，还有谁在等我们？</p>':`<p>“${reply}” — 听雪</p>`}${!won&&clues.length?`<details><summary>本局已经发现</summary>${clues.map(line=>`<p>${esc(line)}</p>`).join('')}</details>`:''}</section>`;
}
