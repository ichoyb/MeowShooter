import {catArt,esc} from './components';

const svg=(body:string)=>`<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>`;
export const homeIcons={
 sound:svg('<path d="M4 12h6l8-7v22l-8-7H4z" fill="currentColor"/><path class="sound-waves" d="M22 10q6 6 0 12m4-16q10 10 0 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path class="sound-slash" d="M4 4l24 24" stroke="currentColor" stroke-width="3"/>'),
 settings:svg('<path d="M13 2h6l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z" fill="currentColor"/><circle cx="16" cy="16" r="5" fill="#fff8e3"/>'),
 book:svg('<path d="M3 5q7-3 13 2 6-5 13-2v23q-7-3-13 1-6-4-13-1z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 7v22" stroke="currentColor" stroke-width="2"/>'),
 help:svg('<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M11 11c0-6 11-6 11 0 0 4-6 4-6 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="24" r="1.7" fill="currentColor"/>')
};
export function homeAudioState(s:{ready:boolean;error:string|null;contextState?:string;pending?:boolean;settings:{music:boolean}}){
 const resume=!s.ready&&!s.pending&&s.contextState!=='not-created';
 return {action:s.error||resume?'sound-enable':'sound-toggle:music',label:s.error?'重试声音':resume?'恢复声音':s.settings.music?'音乐开':'音乐关',muted:!!s.error||resume||!s.settings.music,error:s.error?'声音暂不可用，请重试':''};
}
export function r1HomeMarkup(cat:any,weapon:any,canStart:boolean){
 return {home:true,r1Home:true,body:`<div class="r1-home-tools"><button type="button" class="r1-round" id="home-audio" data-action="sound-toggle:music" data-muted="false" aria-label="音乐开">${homeIcons.sound}<span id="home-audio-label">音乐开</span></button><button type="button" class="r1-round" data-action="settings" aria-label="庭院设置">${homeIcons.settings}</button></div><div id="home-audio-error" class="r1-audio-error" role="status" hidden></div><h1 class="r1-home-title">猫咪<br><span>开火啦</span></h1><div class="r1-home-scene"><div class="r1-home-cat">${catArt(cat)}</div></div><button type="button" class="r1-pair" data-action="select" aria-label="换猫，当前${esc(cat.name)}" aria-describedby="home-weapon-label"><span class="loadout-portrait" data-cat="${esc(cat.id)}" aria-hidden="true">${catArt(cat,true)}</span><span class="r1-select-copy"><strong>${esc(cat.name)}</strong><span id="home-weapon-label">${esc(weapon.name)}</span></span><span class="r1-select-action" aria-hidden="true">换猫 <span>›</span></span></button><p class="r1-level-caption"><span>◆</span> 庭院首关 <span>◆</span></p><p class="r1-home-note">试玩版 · 三猫开放 · 不保存进度</p>`,footer:`<button type="button" data-action="start" class="r1-start"${canStart?'':' disabled'}>${canStart?'开始守护':'该角色尚未开放'}<span aria-hidden="true">▶</span></button><nav class="r1-home-links" aria-label="庭院导航"><button type="button" data-action="book">${homeIcons.book}<span>庭院图鉴</span></button><button type="button" data-action="help">${homeIcons.help}<span>玩法说明</span></button></nav>`};
}
