import type {ImageBudget} from '../image-budget';
import scenes from './chapter-scenes.json';

// Own one original decoded object; never copy its public src into another image.
export function createChapterImages(budget:ImageBudget,changed=()=>{}){
 let source:HTMLImageElement|null=null,path='',generation=0,registered=false,slot:HTMLElement|null=null;
 let status:'idle'|'loading'|'ready'|'failed'='idle',error='',pending:Promise<boolean>|null=null,settle:((ready:boolean)=>void)|null=null;
 const clear=()=>{generation++;settle?.(false);settle=null;pending=null;if(source){source.onload=null;source.onerror=null;source.remove();budget.release(source);source.src='';source=null;}registered=false;path='';slot=null;status='idle';error='';changed();};
 return {
  sync(root:HTMLElement):Promise<boolean>{
   const nextSlot=root.querySelector<HTMLElement>('[data-chapter-art]');
   if(!nextSlot){clear();return Promise.resolve(false);}
   const scene=scenes[nextSlot.dataset.chapterArt as keyof typeof scenes];if(!scene){clear();return Promise.resolve(false);}
   const next='./'+scene;
   if(path===next&&source){slot=nextSlot;if(registered){slot.textContent='';slot.appendChild(source);return Promise.resolve(true);}if(pending)return pending;}
   clear();slot=nextSlot;path=next;status='loading';const token=generation,img=new Image();const loading=document.createElement('span');loading.setAttribute('role','status');loading.textContent='正在展开画卷…';slot.textContent='';slot.appendChild(loading);source=img;img.alt=slot.getAttribute('aria-label')||'第一章分镜';
   pending=new Promise<boolean>(resolve=>{settle=resolve;});const result=pending;
   const done=(ready:boolean)=>{pending=null;const resolve=settle;settle=null;resolve?.(ready);changed();};
   const failed=(reason:string)=>{if(token!==generation)return;budget.release(img);registered=false;status='failed';error=reason;img.onload=null;img.onerror=null;img.remove();img.src='';if(source===img)source=null;if(slot){slot.textContent='画卷暂未展开。';const retry=document.createElement('button');retry.type='button';retry.dataset.action='chapter-retry';retry.className='btn n1-quiet';retry.textContent='重试图片';slot.appendChild(retry);}done(false);};
   img.onload=()=>{if(token!==generation)return;try{budget.register(next,img);if(slot){slot.textContent='';slot.appendChild(img);}registered=true;status='ready';error='';done(true);}catch(e){failed('图片预算登记失败：'+String(e));}};
   img.onerror=()=>failed('图片请求或解码失败：'+next);img.src=next;return result;
  },
  clear,
  snapshot:()=>({active:registered,path,status,error,width:source?.naturalWidth??0,height:source?.naturalHeight??0})
 };
}
