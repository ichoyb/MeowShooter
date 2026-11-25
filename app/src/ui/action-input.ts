type Position={x:number;y:number};
type Gesture={button:HTMLButtonElement;start:Position;last:Position;pointerId?:number;touchId?:number;moved:boolean;scrolls:{node:Element;top:number;left:number}[]};
export type ActionInputObservation={at:number;type:string;action:string|null;trusted:boolean;detail:number|null;firesTouchEvents:boolean|null;x:number;y:number;sequence:number;outcome:'activated'|'suppressed'|'observed'};

/** Activate a real button on click or a completed tap, without requiring the
 * WebView to synthesize a mouse click. Drag, cancel and disabled controls stay inert. */
export function bindActionInput(root:Document|HTMLElement,selector:string,activate:(button:HTMLButtonElement)=>void,observe?:(record:ActionInputObservation)=>void):()=>void {
 let gesture:Gesture|null=null,ghost:{at:number;point:Position;sequence:number}|null=null,sequence=0;
 let activationCount=0;
 const activateButton=(button:HTMLButtonElement)=>{activationCount++;activate(button);};
 let mousePress:{button:HTMLButtonElement;point:Position;sequence:number}|null=null;
 const buttonAt=(target:EventTarget|null)=>{
  const node=target instanceof Element?target:null,button=node?.closest<HTMLButtonElement>(selector);
  return button?.tagName==='BUTTON'&&!button.disabled&&root.contains(button)&&button.getBoundingClientRect().height>0?button:null;
 };
 const position=(p:{clientX:number;clientY:number}):Position=>({x:p.clientX,y:p.clientY});
 const near=(a:Position,b:Position,d=8)=>Math.hypot(a.x-b.x,a.y-b.y)<=d;
 function begin(button:HTMLButtonElement,p:Position,pointerId?:number,touchId?:number){
  if(gesture){
   if(pointerId!==undefined&&gesture.pointerId!==undefined&&pointerId!==gesture.pointerId)return;
   if(touchId!==undefined&&gesture.touchId!==undefined&&touchId!==gesture.touchId)return;
   if(gesture.button===button&&near(gesture.start,p)){if(pointerId!==undefined)gesture.pointerId=pointerId;if(touchId!==undefined)gesture.touchId=touchId;}return;
  }
  const scrolls=[];for(let node:Element|null=button.parentElement;node;node=node.parentElement)scrolls.push({node,top:node.scrollTop,left:node.scrollLeft});
  gesture={button,start:p,last:p,pointerId,touchId,moved:false,scrolls};
 }
 function move(p:Position){if(!gesture)return;gesture.last=p;if(!near(gesture.start,p))gesture.moved=true;}
 function finish(event:Event,p:Position,cancelled=false){
  const g=gesture;if(!g)return;gesture=null;ghost={at:Date.now(),point:p,sequence:++sequence};
  if(cancelled||g.moved||!near(g.start,p)||g.button.disabled||!g.button.isConnected||g.scrolls.some(s=>s.node.scrollTop!==s.top||s.node.scrollLeft!==s.left))return;
  const hit=document.elementFromPoint(p.x,p.y);if(hit!==g.button&&!g.button.contains(hit))return;
  // Let Phaser observe the native release and free its pointer. Suppress the
  // compatibility click below instead of cancelling touchend / pointerup.
  activateButton(g.button);
 }
 const listeners:{type:string;fn:EventListener;passive:boolean}[]=[];
 function listen(type:string,fn:EventListener,passive=true){
  const wrapped:EventListener=event=>{const button=observe?(buttonAt(event.target)||gesture?.button):null,count=activationCount;try{fn(event);}finally{if(observe&&button){const e=event as MouseEvent&{changedTouches?:TouchList;sourceCapabilities?:{firesTouchEvents:boolean}|null},t=e.changedTouches?.[0];try{observe({at:Date.now(),type:event.type,action:button.dataset.action||null,trusted:event.isTrusted,detail:typeof e.detail==='number'?e.detail:null,firesTouchEvents:e.sourceCapabilities?.firesTouchEvents??null,x:t?.clientX??e.clientX??0,y:t?.clientY??e.clientY??0,sequence,outcome:activationCount>count?'activated':event.defaultPrevented?'suppressed':'observed'});}catch{/* Diagnostics must not interrupt input. */}}}};
  listeners.push({type,fn:wrapped,passive});root.addEventListener(type,wrapped,{capture:true,passive});
 }
 listen('mousedown',event=>{const e=event as MouseEvent,b=buttonAt(e.target);mousePress=e.isTrusted&&e.button===0&&b?{button:b,point:position(e),sequence}:null;});
 listen('pointerdown',event=>{const e=event as PointerEvent;if(e.pointerType!=='touch')return;const b=buttonAt(e.target);if(b)begin(b,position(e),e.pointerId);});
 listen('pointermove',event=>{const e=event as PointerEvent;if(gesture?.pointerId===e.pointerId)move(position(e));});
 listen('pointerup',event=>{const e=event as PointerEvent;if(gesture?.pointerId===e.pointerId&&gesture.touchId===undefined)finish(e,position(e));},false);
 listen('pointercancel',event=>{const e=event as PointerEvent;if(gesture?.pointerId===e.pointerId)finish(e,position(e),true);});
 listen('touchstart',event=>{const e=event as TouchEvent,b=buttonAt(e.target);if(!b)return;const t=e.changedTouches[0];if(t)begin(b,position(t),undefined,t.identifier);});
 listen('touchmove',event=>{const e=event as TouchEvent,t=Array.from(e.changedTouches).find(t=>t.identifier===gesture?.touchId);if(t)move(position(t));});
 listen('touchend',event=>{const e=event as TouchEvent,t=Array.from(e.changedTouches).find(t=>t.identifier===gesture?.touchId);if(t)finish(e,position(t));},false);
 listen('touchcancel',event=>{const e=event as TouchEvent,t=Array.from(e.changedTouches).find(t=>t.identifier===gesture?.touchId);if(t)finish(e,position(t),true);});
 listen('click',event=>{
  const e=event as MouseEvent,b=buttonAt(e.target);if(!b)return;
  const capabilities=(e as MouseEvent&{sourceCapabilities?:{firesTouchEvents:boolean}|null}).sourceCapabilities;
  const press=mousePress;mousePress=null;
  // A host may label the click following its translated tap as a mouse event.
  // Only a new press on the current button after the completed gesture can
  // establish a new mouse operation. The old press cannot click through a repaint.
  const freshMouse=capabilities?.firesTouchEvents===false&&press?.button===b&&press.sequence===sequence&&near(press.point,position(e),25);
  // The simulator's synthetic tap click has detail=0. Native keyboard clicks
  // are trusted, so zero detail alone cannot distinguish the two.
  if((e.detail>0||!e.isTrusted)&&!freshMouse&&ghost&&Date.now()-ghost.at<800&&near(ghost.point,position(e),25)){if(e.cancelable)e.preventDefault();e.stopPropagation();return;}
  activateButton(b);
 },false);
 return ()=>{gesture=null;ghost=null;mousePress=null;listeners.forEach(l=>root.removeEventListener(l.type,l.fn,true));};
}
