import {esc} from './components';

type ButtonOptions={kind?:'secondary'|'gold'|'quiet';disabled?:boolean;pressed?:boolean;label?:string};
export function courtyardButton(action:string,label:string,options:ButtonOptions={}){
 return `<button type="button" data-action="${esc(action)}" class="btn court-button is-${options.kind||'secondary'}"${options.pressed===undefined?'':` aria-pressed="${options.pressed}"`}${options.label?` aria-label="${esc(options.label)}"`:''}${options.disabled?' disabled':''}>${esc(label)}</button>`;
}
export function courtyardNotice(text:string,kind:'info'|'error'='info'){
 return `<div class="court-notice is-${kind}" role="${kind==='error'?'alert':'status'}">${esc(text)}</div>`;
}
export function courtyardHeader(title:string,action:string,subtitle:string){
 return `<header class="court-page-head"><div class="court-head-row">${courtyardButton(action,'‹',{label:'返回上一页'})}<h1>${esc(title)}</h1></div><p>${esc(subtitle)}</p></header>`;
}
export function courtyardTabs(values:{value:string;label:string}[],active:string,prefix:string){
 return `<div class="court-tabs" role="group" aria-label="${prefix==='category'?'图鉴分类':'出战信息'}">${values.map(v=>courtyardButton(prefix+':'+v.value,v.label,{pressed:v.value===active})).join('')}</div>`;
}
export function courtyardStat(label:string,value:string|number){
 return `<div class="court-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}
export function courtyardBadge(label:string,kind=''){
 return `<span class="court-badge${kind?' is-'+esc(kind):''}">${esc(label)}</span>`;
}
