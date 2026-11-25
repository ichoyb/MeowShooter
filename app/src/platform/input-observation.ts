/** Read-only independent-fixture evidence. These listeners never claim, cancel, translate
 * or release a gesture; gameplay continues to use Phaser input exclusively. */
export type BattleInputObservation = {
  channel: 'dom' | 'phaser'; type: string; at: number; owner: number | null;
  target?: string; trusted?: boolean; prevented?: boolean;
  pointerId?: number; pointerType?: string; buttons?: number; wasTouch?: boolean; canceled?: boolean;
  x?: number; y?: number; changedIds?: number[]; activeIds?: number[];
};
const EVENTS = ['mousedown','mousemove','mouseup','mouseout','pointerdown','pointermove','pointerup','pointercancel',
  'lostpointercapture','touchstart','touchmove','touchend','touchcancel','blur'];
export function observeWindowInput(owner:()=>number|null, record:(value:BattleInputObservation)=>void):()=>void {
  const observe=(event:Event)=>{
    try {
      const e=event as MouseEvent & Partial<PointerEvent> & Partial<TouchEvent>;
      const first=e.changedTouches?.[0];
      record({channel:'dom',type:e.type,at:Date.now(),owner:owner(),
        target:e.target instanceof Element?e.target.tagName:e.target===window?'WINDOW':'DOCUMENT',
        trusted:e.isTrusted,prevented:e.defaultPrevented,pointerId:e.pointerId,pointerType:e.pointerType,
        buttons:e.buttons,x:first?.clientX??e.clientX,y:first?.clientY??e.clientY,
        changedIds:e.changedTouches?Array.from(e.changedTouches).slice(0,8).map(t=>t.identifier):undefined,
        activeIds:e.touches?Array.from(e.touches).slice(0,8).map(t=>t.identifier):undefined});
    } catch { /* Observation cannot interrupt delivery to Phaser. */ }
  };
  EVENTS.forEach(type=>window.addEventListener(type,observe,{capture:true,passive:true}));
  return ()=>EVENTS.forEach(type=>window.removeEventListener(type,observe,true));
}
