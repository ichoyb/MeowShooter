// aria-modal alone does not isolate keyboard input on the Chrome 61 baseline.
export function createModalFocus(modal:HTMLElement) {
 let open=false,key='',origin:HTMLElement|null=null,originAction:string|undefined;
 const targets=()=>Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),input:not([disabled]),[tabindex="0"]')).filter(e=>e.getBoundingClientRect().height>0);
 const focusHeading=()=>{const heading=modal.querySelector<HTMLElement>('h1')!;heading.tabIndex=-1;heading.focus();};
 document.addEventListener('keydown',event=>{
  if(!open||event.key!=='Tab')return;
  const list=targets(),active=document.activeElement as HTMLElement,index=list.indexOf(active);
  if(index<0||(!event.shiftKey&&index===list.length-1)||(event.shiftKey&&index===0)){
   event.preventDefault();(event.shiftKey?list[list.length-1]:list[0])?.focus();
  }
 },true);
 return {prepare(isOpen:boolean){
  if(isOpen&&!open){origin=document.activeElement as HTMLElement;originAction=origin?.dataset.action;}
 },sync(isOpen:boolean,nextKey:string){
  if(isOpen){
   if(!open||key!==nextKey||!modal.contains(document.activeElement))focusHeading();
  }else if(open){
   const restored=origin?.isConnected?origin:originAction?Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).find(e=>e.dataset.action===originAction&&e.getBoundingClientRect().height>0):null;
   if(restored&&!(restored as HTMLButtonElement).disabled)restored.focus();
  }
  open=isOpen;key=nextKey;
 }};
}
