import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCanvasTouchCompatibility} from '../src/platform/touch-compatibility';

class Canvas {}
Object.assign(globalThis, { HTMLCanvasElement: Canvas, window: {scrollX: 17, scrollY: 29} });
function fixture(observe?: Parameters<typeof bindCanvasTouchCompatibility>[1]) {
 const canvas = new Canvas(), listeners = new Map<string, EventListener>();
 const stage = {contains:(node:unknown)=>node===canvas,addEventListener:(type:string,fn:EventListener)=>listeners.set(type,fn),removeEventListener:(type:string)=>listeners.delete(type)};
 const unbind=bindCanvasTouchCompatibility(stage as unknown as HTMLElement,observe);
 const send=(fields:any={})=>{const event:any={type:'touchstart',target:canvas,isTrusted:false,...fields};listeners.get(event.type)?.(event);return event;};
 return {canvas,listeners,unbind,send};
}
test('simplified records fill page coordinates and canvas target without mutating sender',()=>{
 const f=fixture(),t={identifier:4,clientX:80,clientY:100,pressure:.7};const e=f.send({touches:[t],targetTouches:[t],changedTouches:[t]});
 for(const key of ['touches','targetTouches','changedTouches'])assert.deepEqual(e[key][0],{...t,pageX:97,pageY:129,target:f.canvas});
 assert.equal('pageX' in t,false);assert.equal('target' in t,false);
});
test('finite page coordinates and existing target survive, including zero',()=>{
 const f=fixture(),target={},t={identifier:3,clientX:80,clientY:90,pageX:0,pageY:0,target};const list=[t];const e=f.send({changedTouches:list});
 assert.equal(e.changedTouches,list);assert.equal(e.changedTouches[0],t);
});
test('missing page coordinate and missing target are independently adapted',()=>{
 const f=fixture(),target={},t={identifier:7,clientX:1,clientY:2,pageX:99,pageY:NaN,target};const e=f.send({changedTouches:[t]});
 assert.equal(e.changedTouches[0].pageX,99);assert.equal(e.changedTouches[0].pageY,31);assert.equal(e.changedTouches[0].target,target);
 const targetOnly=f.send({changedTouches:[{identifier:7,clientX:1,clientY:2,pageX:3,pageY:4}]});assert.equal(targetOnly.changedTouches[0].target,f.canvas);assert.equal(targetOnly.changedTouches[0].pageY,4);
});
test('native TouchList identity and fields remain unchanged',()=>{
 const f=fixture(),t={identifier:8,clientX:1,clientY:2,pageX:3,pageY:4,target:f.canvas};const list={0:t,length:1,item:()=>t};const e=f.send({changedTouches:list});
 assert.equal(e.changedTouches,list);assert.equal(e.changedTouches[0],t);
});
test('immutable generic Event properties and diagnostic failure never throw',()=>{
 const f=fixture(()=>{throw new Error('observer failure');}),t={identifier:2,clientX:1,clientY:2},list=[t];
 const e:any={type:'touchstart',target:f.canvas,isTrusted:false};Object.defineProperty(e,'changedTouches',{value:list,writable:false});assert.doesNotThrow(()=>f.listeners.get('touchstart')!(e));assert.equal(e.changedTouches,list);
});
test('non-canvas/outside-stage input is untouched, unbind removes all handlers',()=>{
 const f=fixture(),list=[{identifier:1,clientX:1,clientY:2}];assert.equal(f.send({target:{},changedTouches:list}).changedTouches,list);assert.equal(f.send({target:new Canvas(),changedTouches:list}).changedTouches,list);
 assert.equal(f.listeners.size,4);f.unbind();assert.equal(f.listeners.size,0);assert.equal(f.send({changedTouches:list}).changedTouches,list);
});
test('bounded diagnostic describes raw missing fields before normalization',()=>{
 let record:any;const f=fixture(r=>record=r);f.send({type:'touchmove',changedTouches:Array.from({length:12},(_,identifier)=>({identifier,clientX:10,clientY:20}))});
 assert.equal(record.changed.length,8);assert.equal(record.changed[0].pageX,null);assert.equal(record.changed[0].hasTarget,false);assert.equal(record.normalized,true);assert.equal(record.arrayBacked,true);
 assert.equal(record.changedAfter[0].pageX,27);assert.equal(record.changedAfter[0].pageY,49);assert.equal(record.changedAfter[0].hasTarget,true);
});
test('partial read-only event reports actual unchanged changedTouches after other lists adapt',()=>{
 let record:any;const f=fixture(r=>record=r),t={identifier:2,clientX:1,clientY:2};const e:any={type:'touchstart',target:f.canvas,isTrusted:false,touches:[t]};Object.defineProperty(e,'changedTouches',{value:[t],writable:false});f.listeners.get('touchstart')!(e);
 assert.equal(record.normalized,true);assert.equal(record.changedAfter[0].pageX,null);assert.equal(record.changedAfter[0].hasTarget,false);
});
