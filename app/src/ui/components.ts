export const esc=(value:any)=>String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function button(action:string,label:string,kind='secondary',disabled=false){return `<button type="button" data-action="${esc(action)}" class="btn ${kind}"${disabled?' disabled':''}>${esc(label)}</button>`;}
export function notice(text:string,kind='mint'){return `<div class="notice ${kind}" role="status">${esc(text)}</div>`;}
export function badge(text:string,kind=''){return `<span class="badge ${kind}">${esc(text)}</span>`;}
export function header(title:string,action='back',sub=''){return `<header class="page-head">${button(action,'‹','back')}<div><h1>${esc(title)}</h1>${sub?`<p>${esc(sub)}</p>`:''}</div></header>`;}
export function tabs(values:string[],active:string,prefix:string){return `<div class="tabs" role="group">${values.map(v=>button(prefix+':'+v,v,v===active?'selected':'secondary')).join('')}</div>`;}
export function stat(label:string,value:any){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}
export function assetImage(name:string,className='',alt=''){return `<canvas class="${esc(className)}" data-ui-asset="${esc(name)}" role="img"${alt?` aria-label="${esc(alt)}"`:' aria-hidden="true"'}></canvas>`;}
export function catArt(cat:any,small=false){return assetImage(cat.id+'.png',small?'avatar':'cat-art',cat.breed+cat.name);}
export function weaponIcon(id:string){return assetImage(id+'.svg','weapon-icon');}
export function card(title:string,body:string,action:string,status=''){return `<article class="card"><div class="card-title"><strong>${esc(title)}</strong>${status?badge(status):''}</div><p>${esc(body)}</p>${button(action,'查看详情','small-button')}</article>`;}
