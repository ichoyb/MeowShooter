import test from 'node:test';
import assert from 'node:assert/strict';
import * as UIAssets from '../src/ui/assets';
import {ImageBudget} from '../src/image-budget';
import {registerUIAsset,drawUIAssets,getUIAsset} from '../src/ui/assets';
import {catArt,weaponIcon,assetImage} from '../src/ui/components';
function decoded(): HTMLImageElement {
 return {naturalWidth:384,naturalHeight:384,complete:true,get src(){throw new Error('host address must not be read');},get currentSrc(){throw new Error('host address must not be read');}} as HTMLImageElement;
}
async function canvasFixture(run:()=>Promise<void>,mode='ok') {
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context={drawImage(){if(mode==='draw-fails')throw new Error('InvalidStateError');}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>mode==='no-context'?null:context,toBlob:()=>{throw new Error('SecurityError');},toDataURL:()=>{throw new Error('SecurityError');}})}});
 try{await run();}finally{if(original)Object.defineProperty(globalThis,'document',original);else delete (globalThis as any).document;}
}
test('asset markup escapes names and retains image accessibility',()=>{
 assert.match(assetImage('A"&.svg','icon','猫<'),/data-ui-asset="A&quot;&amp;.svg"/);assert.match(catArt({id:'CAT01',breed:'美短',name:'橘团'}),/role="img" aria-label="美短橘团"/);assert.doesNotMatch(weaponIcon('W01'),/src=/);
});
test('decoded pixels are retained without reading host URLs or exporting tainted canvas',()=>canvasFixture(async()=>{
 await registerUIAsset('PIXELS.png',decoded());await registerUIAsset('PIXELS.png',{} as HTMLImageElement);
}));
test('battle receives the same decoded pixels and missing sources fail visibly',()=>canvasFixture(async()=>{
 const image=decoded();registerUIAsset('SHARED.png',image);
 assert.equal(getUIAsset('SHARED.png'),image);
 assert.throws(()=>getUIAsset('UNLOADED.png'),/未加载/);
}));
test('new DOM copies draw the same decoded object and are not redrawn each frame',()=>canvasFixture(async()=>{
 const image=decoded(),sources:unknown[]=[];await registerUIAsset('CAT_CACHE.png',image);
 const nodes=[0,1].map(()=>({width:0,height:0,dataset:{uiAsset:'CAT_CACHE.png',assetReady:'',assetPaintKey:''},getBoundingClientRect:()=>({width:384,height:384}),getContext:()=>({drawImage:(source:unknown)=>sources.push(source)})}));
 const root={querySelectorAll:()=>nodes} as unknown as ParentNode;drawUIAssets(root);drawUIAssets(root);
 assert.deepEqual(sources,[image,image]);assert.ok(nodes.every(n=>n.width===384&&n.height===384&&n.dataset.assetReady==='true'));
 nodes[0].getBoundingClientRect=()=>({width:48,height:60});drawUIAssets(root);assert.equal(nodes[0].width,48);assert.equal(nodes[0].height,48);assert.equal(sources.length,3);
}));
test('background stays an independent file and needs no image drawing capability',async()=>{
 const image=decoded(),budget=new ImageBudget(5242880);
 await registerUIAsset('garden.jpeg',image,budget);
 assert.equal(getUIAsset('garden.jpeg'),image);
 assert.equal(budget.snapshot().sourceRGBA,0);
 assert.equal(budget.snapshot().backgroundRGBA,384*384*4);
});
test('invalid or undecoded source rejects before cache registration',()=>canvasFixture(async()=>{
 await assert.rejects(async()=>registerUIAsset('BAD.png',{naturalWidth:0,naturalHeight:0} as HTMLImageElement));
 await assert.rejects(async()=>registerUIAsset('HUGE.png',{naturalWidth:4096,naturalHeight:4096} as HTMLImageElement));
 await assert.rejects(async()=>registerUIAsset('PENDING.png',{naturalWidth:384,naturalHeight:384,complete:false} as HTMLImageElement));
}));
for(const mode of ['no-context','draw-fails'])test('drawing '+mode+' rejects for loading recovery',()=>canvasFixture(async()=>{
 await assert.rejects(async()=>registerUIAsset('FAIL-'+mode+'.png',decoded()));
},mode));
test('an initial loading placeholder stays unready until its asset exists',()=>{
 const node={dataset:{uiAsset:'UNLOADED.svg',assetReady:''}};drawUIAssets({querySelectorAll:()=>[node]} as unknown as ParentNode);assert.equal(node.dataset.assetReady,'');
});
test('retained source pixels have a bounded total budget',()=>canvasFixture(async()=>{
 await assert.rejects(async()=>{for(let i=0;i<5;i++)await registerUIAsset('BUDGET-'+i+'.png',{naturalWidth:512,naturalHeight:512,complete:true} as HTMLImageElement);},/预算/);
}));

// A cropped decoded portrait still occupies its approved original logical window.
test('trimmed UI source draws into its384px logical window without a second image',()=>canvasFixture(async()=>{
 const image={complete:true,naturalWidth:267,naturalHeight:359} as HTMLImageElement;
 const mapping={logicalSize:{w:384,h:384},destination:{x:82,y:12,w:267,h:359}};
 (registerUIAsset as Function)('TRIMMED.png',image,new ImageBudget(4194304),mapping);
 const calls:unknown[][]=[];
 const node={width:0,height:0,dataset:{uiAsset:'TRIMMED.png',assetReady:'',assetPaintKey:''},getBoundingClientRect:()=>({width:192,height:192}),getContext:()=>({drawImage:(...args:unknown[])=>calls.push(args)})};
 drawUIAssets({querySelectorAll:()=>[node]} as unknown as ParentNode);
 assert.equal(node.width,192);assert.equal(node.height,192);
 assert.deepEqual(calls,[[image,41,6,133.5,179.5]]);
}));

test('UI render Canvas surfaces are reported separately from decoded sources',()=>{
 const root={querySelectorAll:()=>[{width:48,height:48,dataset:{uiAsset:'CAT01.png'}},{width:84,height:84,dataset:{uiAsset:'W01.svg'}}]} as unknown as ParentNode;
 assert.equal(typeof (UIAssets as any).uiCanvasSnapshot,'function');
 const result=(UIAssets as any).uiCanvasSnapshot(root);
 assert.equal(result.surfaceRGBA,(48*48+84*84)*4);assert.equal(result.canvases.length,2);
});
